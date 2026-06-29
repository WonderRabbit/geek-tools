# Wonder Estimate OpenCode Asset Pack

이 디렉터리는 OpenCode를 project-local로 운용하기 위한 estimate asset pack이다. Windows 10 + PowerShell 7.6 환경을 기준으로 하며, Qwen 계열 OpenAI-compatible endpoint를 사용할 때 command 폭주와 임의 shell 실행을 줄이는 데 초점을 둔다.

## 구성

- `../commands/`: OpenCode slash command용 Markdown prompt.
- `../agents/`: 작업 실행자와 검토자 agent prompt.
- `../tools/wonder_estimate_*.js`: Node built-in만 사용하는 wrapper. 고정된 PowerShell script key와 option allowlist만 허용한다.
- `scripts/*.ps1`: 설치, 진단, Qwen preflight, smoke, evidence adapter, offline bundle 생성/검증.
- `scripts/collect-evidence.ps1`: `rg`, `fd`, `sg`, `jq`, `yq`, `mdq`가 설치되어 있으면 source/flow evidence 후보를 수집.
- `config/qwen3.6-35b.example.json`: OpenAI-compatible Qwen endpoint 예시 config.

## 빠른 확인

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\.opencode\estimate\scripts\doctor.ps1 -Json
```

PowerShell이 없는 host에서는 최소한 다음 정적 검사를 실행한다.

```bash
rg -n "shell\\s*:\\s*true|\\bexec(File|Sync)?\\s*\\(|spawnSync\\s*\\(" .opencode/tools .opencode/estimate/scripts
rg -n "spawn\\(file, args, \\{\\s*shell: false" .opencode/tools
```

## 안전 경계

이 pack은 임의 명령 실행기가 아니다. 사용자가 전달한 문자열을 shell command로 실행하지 않으며, wrapper는 정해진 script key와 option만 PowerShell script로 전달한다.
