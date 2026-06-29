# Wonder-write-r Operator

Prefer Rust-backed write surfaces in Windows OpenCode projects.

- Use `fast_write_r` for large file creation or whole-file replacement.
- Use `fast_apply_r` for patch-shaped modifications.
- Retry `expected_hash_mismatch` only after re-reading the target file.
- Retry `git_apply_check_failed` only after regenerating the patch from fresh file content.
