use super::{CoreError, FastWriteInput, WriteMode, response};
use crate::json::JsonValue;
use crate::sha256;
use crate::workspace;
use std::collections::BTreeMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

pub(crate) fn fast_write_inner(
    root: &Path,
    input: &FastWriteInput,
) -> Result<JsonValue, CoreError> {
    let root_real = workspace::real_root(root)?;
    let target = workspace::resolve(&root_real, &input.path, true)?;
    let exists = target.absolute.exists();
    if input.mode == WriteMode::Create && exists {
        return Ok(response::fail(
            "fast_write",
            &input.path,
            "file_exists",
            "Use mode=overwrite or choose a new path.",
        ));
    }
    if let Some(expected) = &input.expected_hash {
        verify_expected_hash(&target.absolute, exists, expected)?;
    }
    workspace::assert_parent_inside(&root_real, &target.absolute)?;
    atomic_write(&target.absolute, &input.content, input.fsync)?;
    let metadata = fs::metadata(&target.absolute)?;
    let mut output = BTreeMap::new();
    output.insert("ok".to_string(), JsonValue::Bool(true));
    output.insert(
        "operation".to_string(),
        JsonValue::String("fast_write".to_string()),
    );
    output.insert("path".to_string(), JsonValue::String(target.relative));
    output.insert("bytes".to_string(), JsonValue::Number(metadata.len()));
    output.insert(
        "sha256".to_string(),
        JsonValue::String(sha256::file_hex(&target.absolute)?),
    );
    output.insert("created".to_string(), JsonValue::Bool(!exists));
    output.insert("verified".to_string(), JsonValue::Bool(true));
    Ok(JsonValue::Object(output))
}

fn verify_expected_hash(target: &Path, exists: bool, expected: &str) -> Result<(), CoreError> {
    if !exists {
        return Err(CoreError::new(
            "expected_hash_target_missing",
            "Read the file again and retry without expectedHash for new files.",
        ));
    }
    let actual = sha256::file_hex(target)?;
    if actual != expected.to_lowercase() {
        return Err(CoreError::new(
            "expected_hash_mismatch",
            "Read the file again and retry with the new expectedHash.",
        ));
    }
    Ok(())
}

fn atomic_write(target: &Path, content: &str, fsync: bool) -> Result<(), CoreError> {
    let temp = temp_path(target)?;
    {
        let mut file = fs::OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&temp)?;
        file.write_all(content.as_bytes())?;
        if fsync {
            file.sync_all()?;
        }
    }
    fs::rename(&temp, target)?;
    Ok(())
}

fn temp_path(target: &Path) -> Result<PathBuf, CoreError> {
    let Some(parent) = target.parent() else {
        return Err(CoreError::new("invalid_path", "Path has no parent."));
    };
    let Some(name) = target.file_name() else {
        return Err(CoreError::new("invalid_path", "Path has no file name."));
    };
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| CoreError::new("write_failed", &error.to_string()))?
        .as_nanos();
    Ok(parent.join(format!(
        ".{}.openwrite-r-{}-{nanos}.tmp",
        name.to_string_lossy(),
        std::process::id()
    )))
}
