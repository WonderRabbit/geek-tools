# OpenWrite Doctor

Run the package diagnostics from the project root.

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\.opencode\openwrite\scripts\doctor.ps1 -Json
```

Expected:

- `status` is `ok`, or `warn` only when OpenCode registration cannot be checked on this host.
- Node and Git are present.
- OpenWrite files exist under `.opencode`.
