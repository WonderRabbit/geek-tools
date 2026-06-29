---
description: Build or verify the Wonder estimate offline OpenCode asset bundle.
---

<command-instruction>
오프라인 전달용 bundle을 만들거나 검증한다.

생성:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\.opencode\estimate\scripts\make-offline-bundle.ps1 -Json -Force
```

검증:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\.opencode\estimate\scripts\verify-offline-bundle.ps1 -Bundle .\release\wonder-estimate-opencode-assets.zip -Json
```

생성물은 zip과 `SHA256SUMS`를 함께 전달한다. 검증 결과에는 hash 일치 여부와 압축 해제 후 `doctor.ps1` 결과를 포함한다.
</command-instruction>

