# Wonder CodeGraph OpenCode Pack

이 패키지는 OpenCode 프로젝트에 CodeGraph MCP와 read-only evidence 도구를 한 번에 복사 설치하기 위한 project-local asset pack이다.

대상 운영 환경:

- Windows 10
- PowerShell 7.6
- OpenCode project root
- 폐쇄망에서는 사전 반입한 `codegraph-win32-x64.zip` 또는 `codegraph-win32-arm64.zip`

## 빠른 설치

준비 PC에서 CodeGraph release zip을 받은 뒤 운영망으로 반입한다. 대상 OpenCode 프로젝트 루트가 `C:\work\legacy-project`라면 이 패키지 루트에서 실행한다.

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\install-opencode-codegraph.ps1 -TargetRoot C:\work\legacy-project -CodeGraphArchive C:\drop\codegraph-win32-x64.zip -Json
```

설치 후 대상 프로젝트에서 검증한다.

```powershell
cd C:\work\legacy-project
pwsh -NoProfile -ExecutionPolicy Bypass -File .\.opencode\codegraph\scripts\verify-codegraph-mcp.ps1 -Json
```

## 포함 항목

- `opencode.json`: OpenCode MCP가 `node .opencode/codegraph/scripts/mcp-proxy.mjs`를 호출하도록 설정한다.
- `.opencode/agents/codegraph-evidence.md`: read-only 분석 agent.
- `.opencode/commands/codegraph-*.md`: OpenCode TUI command.
- `.opencode/tools/wonder_codegraph_*.js`: OpenCode custom tool wrapper.
- `.opencode/codegraph/scripts/wonder-codegraph.mjs`: doctor, repo-map, impact-packet CLI.
- `.opencode/codegraph/scripts/resolve-codegraph.mjs`: `CODEGRAPH_BIN`, local bin, project-local runtime, `PATH` 순서로 CodeGraph를 찾는다.
- `.opencode/codegraph/scripts/install-codegraph-mcp.ps1`: offline release zip을 `.opencode/codegraph/runtime/current/`에 전체 extract한다.
- `.opencode/codegraph/examples/repo-link-manifest.json`: React frontend 1개와 Spring Boot/Vert.x backend N개 연결 예시.

## 폐쇄망 원칙

- 운영망에서는 `curl | sh`, `irm | iex`, `npm i -g`를 실행하지 않는다.
- Windows release bundle은 launcher만 복사하지 않는다. zip 전체를 `.opencode/codegraph/runtime/current/`에 풀어야 한다.
- 대상 프로젝트에 기존 `opencode.json`이 있고 `-Force`를 사용하면 installer는 `opencode.json.codegraph-backup-*` 백업을 먼저 만든다.
- `codegraph init`은 자동 실행하지 않는다. 각 업무 repo에서 사람이 승인한 뒤 별도로 실행한다.
- confidence가 `low` 또는 `unresolved`인 edge는 코드 수정에 사용하지 않는다.

## 기본 흐름

1. `.opencode/codegraph/examples/repo-link-manifest.json`을 `.opencode/codegraph/repo-link-manifest.json`으로 복사한다.
2. frontend/backend repo path와 contract/runtime/test artifact path를 실제 값으로 바꾼다.
3. OpenCode에서 `/codegraph-doctor`로 상태를 확인한다.
4. `/codegraph-map`으로 repo 연결 지도를 확인한다.
5. `/codegraph-impact <symbol-or-edge>`로 수정 전 evidence packet을 만든다.

## 로컬 검증

```bash
node --test .opencode/codegraph/test/*.mjs
node --check .opencode/codegraph/scripts/wonder-codegraph.mjs
node --check .opencode/codegraph/scripts/resolve-codegraph.mjs
node --check .opencode/codegraph/scripts/mcp-proxy.mjs
node .opencode/codegraph/scripts/wonder-codegraph.mjs doctor --manifest .opencode/codegraph/examples/repo-link-manifest.json --json
```
