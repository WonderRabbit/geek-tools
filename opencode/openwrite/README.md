# OpenWrite OpenCode Pack

OpenWrite는 OpenCode에서 큰 파일을 만들거나 수정할 때 built-in `write`/`apply_patch`가 느려지는 구간을 우회하기 위한 project-local 도구 묶음이다.

대상 환경:

- Windows 10
- PowerShell 7.6
- 기존 OpenCode 프로젝트
- Node.js와 Git이 이미 설치되어 있거나, 조직 내부 GitHub/mirror로 승인된 설치 파일을 확보한 폐쇄망

금지 기본값:

- `winget`, `choco`, WSL, Bash 전용 설치 스크립트
- public npm registry 의존
- built-in `write` 또는 `apply_patch`를 첫 단계부터 shadowing

## 포함 항목

- `.opencode/tools/fast_write.js`: atomic temp-file rewrite 기반 빠른 파일 쓰기 도구
- `.opencode/tools/fast_apply.js`: `git apply --check` 후 patch 적용 도구
- `.opencode/commands/openwrite*.md`: OpenCode command 안내
- `.opencode/agents/openwrite-*.md`: OpenWrite 운영/검토 agent 지침
- `.opencode/openwrite/bin/openwrite.mjs`: Node CLI smoke/운영 진단용 실행기
- `.opencode/openwrite/scripts/*.ps1`: Windows PowerShell 설치, 진단, smoke, offline bundle 스크립트
- `MANIFEST.json`: 복사/검증 범위

## 빠른 진단

현재 폴더에서 실행한다.

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\.opencode\openwrite\scripts\doctor.ps1 -Json
```

예상 결과:

- `status`가 `ok` 또는 Windows가 아닌 개발 PC에서는 `warn`
- `node`, `git`, 필수 파일 검사 통과

## 다른 OpenCode 프로젝트에 설치

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\.opencode\openwrite\scripts\install.ps1 -TargetRoot C:\work\your-opencode-project -Json
```

설치 후 대상 프로젝트 루트에서 다시 진단한다.

```powershell
cd C:\work\your-opencode-project
pwsh -NoProfile -ExecutionPolicy Bypass -File .\.opencode\openwrite\scripts\doctor.ps1 -Json
```

## Smoke test

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\.opencode\openwrite\scripts\smoke.ps1 -Json
```

Smoke는 임시 폴더를 만들고 다음을 검증한다.

- `fast_write`가 900라인 파일을 생성한다.
- `expectedHash` mismatch가 실패한다.
- root escape 경로가 실패한다.
- `fast_apply`가 valid patch를 적용한다.
- invalid patch가 mutation 전에 실패한다.
- 임시 폴더를 삭제한다.

## 자세한 운영 파일

- `.opencode/openwrite/bin/openwrite.mjs`: 로컬 CLI 진입점
- `.opencode/openwrite/lib/`: 파일 쓰기, patch 적용, hash, workspace safety 구현
- `.opencode/openwrite/scripts/install.ps1`: 대상 OpenCode 프로젝트로 asset 복사
- `.opencode/openwrite/scripts/make-offline-bundle.ps1`: 폐쇄망 전달용 bundle 생성
- `.opencode/openwrite/scripts/verify-offline-bundle.ps1`: bundle 구조 검증
