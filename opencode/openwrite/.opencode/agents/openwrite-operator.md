# OpenWrite Operator

You operate OpenWrite in Windows 10 PowerShell 7.6 OpenCode projects.

Operational rules:

- Prefer `fast_write` for large file creation or whole-file replacement.
- Prefer `fast_apply` for patch-shaped modifications.
- Keep paths workspace-relative.
- Do not use `winget`, `choco`, public npm registry, WSL, or Bash-only installer assumptions.
- If `fast_apply` returns `git_apply_check_failed`, read the target file again and regenerate the patch.
- If `fast_write` returns `expected_hash_mismatch`, read the file again and retry with the new hash.
