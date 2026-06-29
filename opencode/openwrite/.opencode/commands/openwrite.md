# OpenWrite

Use OpenWrite when a task needs to create or modify large files in this project.

Rules:

- Use `fast_write` for large new files or whole-file replacement.
- Use `fast_apply` for unified-diff changes.
- Use built-in `write` only for small changes where OpenCode's full diff review is valuable.
- Run `/openwrite-doctor` before first use on a new Windows machine.

Do not use public npm registry, `winget`, `choco`, WSL, or Bash-only installation steps for this pack.
