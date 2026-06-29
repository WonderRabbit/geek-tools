use super::git;
use crate::json::JsonValue;
use crate::workspace;
use std::collections::BTreeMap;

pub(crate) fn fail(operation: &str, path: &str, error: &str, hint: &str) -> JsonValue {
    let mut output = BTreeMap::new();
    output.insert("ok".to_string(), JsonValue::Bool(false));
    output.insert(
        "operation".to_string(),
        JsonValue::String(operation.to_string()),
    );
    output.insert("path".to_string(), JsonValue::String(path.to_string()));
    output.insert("error".to_string(), JsonValue::String(error.to_string()));
    output.insert("hint".to_string(), JsonValue::String(hint.to_string()));
    JsonValue::Object(output)
}

pub(crate) fn git_fail(
    error: &str,
    paths: &[workspace::WorkspacePath],
    result: git::GitResult,
    max: usize,
) -> JsonValue {
    let mut output = BTreeMap::new();
    output.insert("ok".to_string(), JsonValue::Bool(false));
    output.insert(
        "operation".to_string(),
        JsonValue::String("fast_apply".to_string()),
    );
    output.insert("error".to_string(), JsonValue::String(error.to_string()));
    output.insert("paths".to_string(), paths_json(paths));
    output.insert(
        "exitCode".to_string(),
        JsonValue::Number(u64::try_from(result.exit_code).unwrap_or(1)),
    );
    output.insert(
        "stderr".to_string(),
        JsonValue::String(git::limit(&result.stderr, max)),
    );
    output.insert(
        "stdout".to_string(),
        JsonValue::String(git::limit(&result.stdout, max)),
    );
    JsonValue::Object(output)
}

pub(crate) fn paths_json(paths: &[workspace::WorkspacePath]) -> JsonValue {
    JsonValue::Array(
        paths
            .iter()
            .map(|item| JsonValue::String(item.relative.clone()))
            .collect(),
    )
}
