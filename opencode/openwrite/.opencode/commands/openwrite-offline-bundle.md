# OpenWrite Offline Bundle

Create an offline bundle on a GitHub-enabled machine.

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\.opencode\openwrite\scripts\make-offline-bundle.ps1 -OutputDir .\dist -Json -Force
```

Verify the bundle on the receiving machine.

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\.opencode\openwrite\scripts\verify-offline-bundle.ps1 -Bundle .\dist\openwrite-opencode-assets.zip -Json
```
