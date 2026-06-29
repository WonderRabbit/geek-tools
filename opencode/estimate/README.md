# Wonder Estimate OpenCode Pack

이 디렉터리는 견적 작업을 OpenCode project-local asset으로 실행하기 위한 Windows 중심 패키지다. 목적은 OpenCode/Qwen 조합에서 작업 단위를 작게 고정하고, 임의 shell command 대신 검증 가능한 wrapper와 PowerShell script로만 실행 경로를 제한하는 것이다.

## 시작

현재 폴더에서 구조를 확인한다.

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\.opencode\estimate\scripts\doctor.ps1 -Json
```

다른 OpenCode 프로젝트에 복사 설치한다.

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\.opencode\estimate\scripts\install.ps1 -TargetRoot C:\path\to\opencode-project -Json
```

Qwen config를 확인한다.

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\.opencode\estimate\scripts\qwen-preflight.ps1 -SkipNetwork -Json
```

설치된 `rg`, `fd`, `sg`, `jq`, `yq`, `mdq`를 이용해 source/flow evidence 후보를 만든다.

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\.opencode\estimate\scripts\collect-evidence.ps1 -Json
```

## 포함된 실행면

- OpenCode commands: `.opencode/commands/estimate*.md`
- OpenCode agents: `.opencode/agents/estimate-*.md`
- Node wrappers: `.opencode/tools/wonder_estimate_*.js`
- PowerShell scripts: `.opencode/estimate/scripts/*.ps1`
- Evidence adapter: `.opencode/estimate/scripts/collect-evidence.ps1`
- Qwen example config: `.opencode/estimate/config/qwen3.6-35b.example.json`

자세한 설치 절차는 `.opencode/estimate/install.md`를 본다.
