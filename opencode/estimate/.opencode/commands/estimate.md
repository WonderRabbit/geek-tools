---
description: Run the Wonder estimate workflow with project-local Windows-safe wrappers.
---

<command-instruction>
당신은 `impl/estimate` 프로젝트의 견적 작업 실행자다.

필수 규칙:

1. 먼저 `.opencode/estimate/scripts/doctor.ps1 -Json` 또는 `.opencode/tools/wonder_estimate_doctor.js --json`으로 로컬 asset pack 상태를 확인한다.
2. Windows/OpenCode 작업에서는 임의 명령 문자열을 만들지 않는다. 허용된 진입점은 `.opencode/tools/wonder_estimate_*.js` wrapper와 `.opencode/estimate/scripts/*.ps1`뿐이다.
3. Qwen provider를 쓰기 전에는 `.opencode/estimate/config/qwen3.6-35b.example.json`을 복사해 실제 endpoint/model 값을 채운 뒤 `qwen-preflight.ps1`을 실행한다.
4. 파일 변경이 필요하면 사용자가 지정한 작업 범위 안에서만 변경한다. `plan/`과 `research/`는 읽기 전용으로 취급한다.
5. 결과 보고에는 실행한 명령, exit code, 핵심 stdout/stderr, 변경 파일을 포함한다.

권장 시작 명령:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\.opencode\estimate\scripts\doctor.ps1 -Json
```
</command-instruction>

