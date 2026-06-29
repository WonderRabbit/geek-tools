use super::CoreError;
use std::io::{Read, Write};
use std::path::Path;
use std::process::{Command, Stdio};
use std::thread;

#[derive(Debug)]
pub(crate) struct GitResult {
    pub(crate) exit_code: i32,
    pub(crate) stdout: String,
    pub(crate) stderr: String,
}

pub(crate) fn bounded_git_diff(
    root: &Path,
    paths: &[&str],
    max: usize,
) -> Result<String, CoreError> {
    let mut args = vec!["diff", "--stat", "--"];
    args.extend_from_slice(paths);
    let result = run_git(root, &args, "", max)?;
    Ok(limit(&format!("{}{}", result.stdout, result.stderr), max))
}

pub(crate) fn run_git(
    root: &Path,
    args: &[&str],
    stdin: &str,
    max: usize,
) -> Result<GitResult, CoreError> {
    let mut child = Command::new("git")
        .args(args)
        .current_dir(root)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| CoreError::new("git_failed", "git stdout was unavailable."))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| CoreError::new("git_failed", "git stderr was unavailable."))?;
    let stdout_reader = thread::spawn(move || read_capped(stdout, max));
    let stderr_reader = thread::spawn(move || read_capped(stderr, max));
    if let Some(mut handle) = child.stdin.take() {
        handle.write_all(stdin.as_bytes())?;
    }
    let status = child.wait()?;
    let stdout = stdout_reader
        .join()
        .map_err(|_| CoreError::new("git_failed", "git stdout reader panicked."))??;
    let stderr = stderr_reader
        .join()
        .map_err(|_| CoreError::new("git_failed", "git stderr reader panicked."))??;
    Ok(GitResult {
        exit_code: status.code().unwrap_or(1),
        stdout,
        stderr,
    })
}

fn read_capped(mut reader: impl Read, max: usize) -> Result<String, CoreError> {
    let mut output = Vec::new();
    let mut truncated = false;
    let mut buffer = [0_u8; 4096];
    loop {
        let read = reader.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        let remaining = max.saturating_sub(output.len());
        if remaining > 0 {
            output.extend_from_slice(&buffer[..read.min(remaining)]);
        }
        if read > remaining {
            truncated = true;
        }
    }
    let mut text = String::from_utf8_lossy(&output).to_string();
    if truncated {
        text.push_str(&format!("\n...[truncated to {max} bytes]"));
    }
    Ok(text)
}

pub(crate) fn limit(input: &str, max: usize) -> String {
    if input.len() <= max {
        input.to_string()
    } else {
        input.chars().take(max).collect()
    }
}
