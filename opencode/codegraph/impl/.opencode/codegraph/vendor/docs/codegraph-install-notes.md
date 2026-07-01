# CodeGraph install notes for this pack

이 파일은 CodeGraph upstream 설치 표면을 운영 pack 안에서 자체적으로 추적하기 위한 요약본이다. 원문을 그대로 vendor하지 않고, Windows 10 + PowerShell 7.6 운영에 필요한 설치 사실과 검증 포인트만 유지한다.

## Upstream source

- Repository: https://github.com/colbymchenry/codegraph
- Windows installer: `install.ps1`
- Bundle notes: `BUNDLING.md`

## Facts this pack depends on

- Windows standalone installer downloads a GitHub Release zip named by target such as `codegraph-win32-x64.zip` or `codegraph-win32-arm64.zip`.
- The Windows bundle includes a launcher and a vendored Node runtime. The complete bundle must stay together.
- Installing the CLI alone is not enough for agent use; `codegraph install` wires MCP into agents, while `codegraph init` builds each project index separately.
- This pack does not rely on upstream `codegraph install` mutating OpenCode config. It provides its own `opencode.json` and uses `mcp-proxy.mjs`.

## Closed-network rule

Do not run public network commands in the operating environment. Prepare the official release archive or an internally mirrored equivalent outside the closed network, verify its hash, then run:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\.opencode\codegraph\scripts\install-codegraph-mcp.ps1 -CodeGraphArchive C:\drop\codegraph-win32-x64.zip -Json
```
