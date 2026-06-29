use super::{CoreError, FastApplyInput, git, response};
use crate::json::JsonValue;
use crate::sha256;
use crate::workspace;
use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;

pub(crate) fn fast_apply_inner(
    root: &Path,
    input: &FastApplyInput,
) -> Result<JsonValue, CoreError> {
    let root_real = workspace::real_root(root)?;
    if input.patch.trim().is_empty() {
        return Ok(response::fail(
            "fast_apply",
            "",
            "empty_patch",
            "Provide a unified diff patch.",
        ));
    }
    let paths = extract_patch_paths(&input.patch, input.strip);
    if paths.is_empty() {
        return Ok(response::fail(
            "fast_apply",
            "",
            "no_patch_paths",
            "No file paths were found in the patch.",
        ));
    }
    let resolved = resolve_patch_paths(&root_real, &paths)?;
    verify_expected_hashes(&root_real, &input.expected_hashes)?;
    let strip_arg = format!("-p{}", input.strip);
    let check = git::run_git(
        &root_real,
        &["apply", "--check", &strip_arg],
        &input.patch,
        input.max_evidence_bytes,
    )?;
    if check.exit_code != 0 {
        return Ok(response::git_fail(
            "git_apply_check_failed",
            &resolved,
            check,
            input.max_evidence_bytes,
        ));
    }
    let apply = git::run_git(
        &root_real,
        &["apply", &strip_arg],
        &input.patch,
        input.max_evidence_bytes,
    )?;
    if apply.exit_code != 0 {
        return Ok(response::git_fail(
            "git_apply_failed_after_check",
            &resolved,
            apply,
            input.max_evidence_bytes,
        ));
    }
    success_response(&root_real, &resolved, input.max_evidence_bytes)
}

fn resolve_patch_paths(
    root_real: &Path,
    paths: &[String],
) -> Result<Vec<workspace::WorkspacePath>, CoreError> {
    let mut resolved = Vec::with_capacity(paths.len());
    for path in paths {
        resolved.push(workspace::resolve(root_real, path, true)?);
    }
    Ok(resolved)
}

fn verify_expected_hashes(
    root_real: &Path,
    expected_hashes: &BTreeMap<String, String>,
) -> Result<(), CoreError> {
    for (relative, expected) in expected_hashes {
        let target = workspace::resolve(root_real, relative, false)?;
        let actual = sha256::file_hex(&target.absolute)?;
        if actual != expected.to_lowercase() {
            return Err(CoreError::new(
                "expected_hash_mismatch",
                "Read the file again and retry with the new expectedHashes entry.",
            ));
        }
    }
    Ok(())
}

fn success_response(
    root_real: &Path,
    resolved: &[workspace::WorkspacePath],
    max: usize,
) -> Result<JsonValue, CoreError> {
    let mut hashes = BTreeMap::new();
    for item in resolved {
        if item.absolute.exists() {
            hashes.insert(
                item.relative.clone(),
                JsonValue::String(sha256::file_hex(&item.absolute)?),
            );
        }
    }
    let path_args = resolved
        .iter()
        .map(|item| item.relative.as_str())
        .collect::<Vec<_>>();
    let evidence = git::bounded_git_diff(root_real, &path_args, max)?;
    let mut output = BTreeMap::new();
    output.insert("ok".to_string(), JsonValue::Bool(true));
    output.insert(
        "operation".to_string(),
        JsonValue::String("fast_apply".to_string()),
    );
    output.insert("paths".to_string(), response::paths_json(resolved));
    output.insert("hashes".to_string(), JsonValue::Object(hashes));
    output.insert("evidence".to_string(), JsonValue::String(evidence));
    output.insert("verified".to_string(), JsonValue::Bool(true));
    Ok(JsonValue::Object(output))
}

fn extract_patch_paths(patch: &str, strip: usize) -> Vec<String> {
    let mut paths = BTreeSet::new();
    for line in patch.lines() {
        if let Some(rest) = line.strip_prefix("diff --git ") {
            let mut parts = rest.split_whitespace();
            if let (Some(left), Some(right)) = (parts.next(), parts.next()) {
                add_patch_path(&mut paths, left, strip);
                add_patch_path(&mut paths, right, strip);
            }
            continue;
        }
        let Some(raw) = line
            .strip_prefix("+++ ")
            .or_else(|| line.strip_prefix("--- "))
        else {
            continue;
        };
        let first = raw.trim().split('\t').next().unwrap_or_default();
        add_patch_path(&mut paths, first, strip);
    }
    paths.into_iter().collect()
}

fn add_patch_path(paths: &mut BTreeSet<String>, raw: &str, strip: usize) {
    if raw.is_empty() || raw == "/dev/null" {
        return;
    }
    let normalized = raw.replace('\\', "/");
    let value = if let Some(path) = normalized
        .strip_prefix("a/")
        .or_else(|| normalized.strip_prefix("b/"))
    {
        path.to_string()
    } else if strip > 0 {
        normalized
            .split('/')
            .skip(strip)
            .collect::<Vec<_>>()
            .join("/")
    } else {
        normalized
    };
    if !value.is_empty() {
        paths.insert(value);
    }
}

#[cfg(test)]
mod tests {
    use super::extract_patch_paths;

    #[test]
    fn extract_patch_paths_when_diff_git_rename() {
        let patch = "diff --git a/old.txt b/new.txt\nsimilarity index 100%\nrename from old.txt\nrename to new.txt\n";
        assert_eq!(extract_patch_paths(patch, 1), ["new.txt", "old.txt"]);
    }

    #[test]
    fn extract_patch_paths_when_header_only_mode_change() {
        let patch = "diff --git a/script.ps1 b/script.ps1\nold mode 100644\nnew mode 100755\n";
        assert_eq!(extract_patch_paths(patch, 1), ["script.ps1"]);
    }
}
