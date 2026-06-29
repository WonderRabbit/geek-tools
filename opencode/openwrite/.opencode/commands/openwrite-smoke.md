# OpenWrite Smoke

Run a local smoke test from the project root.

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\.opencode\openwrite\scripts\smoke.ps1 -Json
```

Expected:

- `fast_write` creates a 900-line file in a temp root.
- hash mismatch and root escape are rejected.
- `fast_apply` applies a valid patch and rejects an invalid patch.
- temporary smoke root is removed unless `-KeepTemp` is used.
