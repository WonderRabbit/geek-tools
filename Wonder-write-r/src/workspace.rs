use std::fs;
use std::path::{Component, Path, PathBuf};

#[derive(Debug, Clone)]
pub struct WorkspacePath {
    pub absolute: PathBuf,
    pub relative: String,
}

pub fn real_root(root: &Path) -> Result<PathBuf, WorkspaceError> {
    fs::canonicalize(root).map_err(|source| WorkspaceError::Io {
        code: "invalid_root",
        message: source.to_string(),
    })
}

pub fn resolve(
    root_real: &Path,
    requested: &str,
    allow_missing: bool,
) -> Result<WorkspacePath, WorkspaceError> {
    if requested.is_empty() {
        return Err(WorkspaceError::new(
            "invalid_path",
            "Path must be a non-empty workspace-relative string.",
        ));
    }
    let path = Path::new(requested);
    if path.is_absolute() {
        return Err(WorkspaceError::new(
            "path_escapes_root",
            "Absolute paths are not allowed.",
        ));
    }
    if path
        .components()
        .any(|item| matches!(item, Component::ParentDir))
    {
        return Err(WorkspaceError::new(
            "path_escapes_root",
            "Parent directory segments are not allowed.",
        ));
    }
    let normalized = requested.replace('\\', "/");
    let absolute = root_real.join(normalized);
    let checked = if allow_missing {
        absolute.clone()
    } else {
        fs::canonicalize(&absolute).map_err(|source| WorkspaceError::Io {
            code: "invalid_path",
            message: source.to_string(),
        })?
    };
    assert_inside(root_real, &checked)?;
    let relative = absolute
        .strip_prefix(root_real)
        .map_err(|_| WorkspaceError::new("path_escapes_root", "Path escapes the workspace root."))?
        .to_string_lossy()
        .replace('\\', "/");
    Ok(WorkspacePath { absolute, relative })
}

pub fn assert_parent_inside(root_real: &Path, absolute: &Path) -> Result<(), WorkspaceError> {
    let Some(parent) = absolute.parent() else {
        return Err(WorkspaceError::new("invalid_path", "Path has no parent."));
    };
    fs::create_dir_all(parent).map_err(|source| WorkspaceError::Io {
        code: "write_failed",
        message: source.to_string(),
    })?;
    let parent_real = fs::canonicalize(parent).map_err(|source| WorkspaceError::Io {
        code: "path_escapes_root",
        message: source.to_string(),
    })?;
    assert_inside(root_real, &parent_real)
}

fn assert_inside(root_real: &Path, absolute: &Path) -> Result<(), WorkspaceError> {
    if absolute.starts_with(root_real) {
        Ok(())
    } else {
        Err(WorkspaceError::new(
            "path_escapes_root",
            "Path escapes the workspace root.",
        ))
    }
}

#[derive(Debug)]
pub enum WorkspaceError {
    Invalid { code: &'static str, message: String },
    Io { code: &'static str, message: String },
}

impl WorkspaceError {
    fn new(code: &'static str, message: &str) -> Self {
        Self::Invalid {
            code,
            message: message.to_string(),
        }
    }

    pub const fn code(&self) -> &'static str {
        match self {
            Self::Invalid { code, .. } | Self::Io { code, .. } => code,
        }
    }

    pub fn message(&self) -> &str {
        match self {
            Self::Invalid { message, .. } | Self::Io { message, .. } => message,
        }
    }
}
