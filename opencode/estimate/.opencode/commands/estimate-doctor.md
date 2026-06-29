---
description: Diagnose the Wonder estimate OpenCode local asset pack.
---

<command-instruction>
`impl/estimate`의 OpenCode asset pack 설치 상태를 진단한다.

다음 중 하나를 실행하고 결과를 요약한다.

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\.opencode\estimate\scripts\doctor.ps1 -Json
```

```powershell
node .\.opencode\tools\wonder_estimate_doctor.js --json
```

`status`가 `fail`이면 누락 파일, 잘못된 JSON config, unsafe wrapper pattern을 먼저 해결한다. `warn`은 Windows가 아닌 host 또는 PowerShell 7.6 미만 같은 환경 경고일 수 있으므로 실제 배포 차단 여부를 구분해 보고한다.
</command-instruction>

