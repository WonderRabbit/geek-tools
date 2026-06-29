use crate::json::JsonValue;
use std::collections::BTreeMap;
use std::path::Path;

mod apply;
mod error;
mod git;
mod response;
mod write;

pub use error::CoreError;

const DEFAULT_MAX_EVIDENCE_BYTES: usize = 8192;

#[derive(Debug, Clone)]
pub struct FastWriteInput {
    pub path: String,
    pub content: String,
    pub mode: WriteMode,
    pub expected_hash: Option<String>,
    pub fsync: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WriteMode {
    Create,
    Overwrite,
}

#[derive(Debug, Clone)]
pub struct FastApplyInput {
    pub patch: String,
    pub strip: usize,
    pub expected_hashes: BTreeMap<String, String>,
    pub max_evidence_bytes: usize,
}

pub fn fast_write(root: &Path, input: &FastWriteInput) -> JsonValue {
    match write::fast_write_inner(root, input) {
        Ok(value) => value,
        Err(error) => response::fail("fast_write", &input.path, error.code(), error.message()),
    }
}

pub fn fast_apply(root: &Path, input: &FastApplyInput) -> JsonValue {
    match apply::fast_apply_inner(root, input) {
        Ok(value) => value,
        Err(error) => response::fail("fast_apply", "", error.code(), error.message()),
    }
}

pub const fn default_max_evidence_bytes() -> usize {
    DEFAULT_MAX_EVIDENCE_BYTES
}
