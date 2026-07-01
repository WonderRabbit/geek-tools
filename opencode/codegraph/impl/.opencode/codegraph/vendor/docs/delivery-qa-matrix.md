# Delivery QA Matrix

작성일: 2026-07-01

## 범위

대상 구현 범위는 `opencode/codegraph/impl/**`이다. 기존 `opencode/openwrite/**`, `opencode/estimate/**`, `opencode/codegraph/plan/**`, repo root의 기존 dirty 파일은 커밋 범위에서 제외한다.

## 기준별 증거

| 기준 | 결과 | 증거 |
|---|---|---|
| C001 CLI happy path | PASS | `.omo/evidence/opencode-codegraph-impl/C001-cli-happy.txt` |
| C002 closed-network missing-runtime edge | PASS | `.omo/evidence/opencode-codegraph-impl/C002-offline-missing-runtime.txt` |
| C003 adjacent pack regression | PASS | `.omo/evidence/opencode-codegraph-impl/C003-regression.txt` |

## 실행 검증

- `node --test opencode/codegraph/impl/.opencode/codegraph/test/*.mjs`: PASS
- `node --check opencode/codegraph/impl/.opencode/codegraph/scripts/wonder-codegraph.mjs`: PASS
- `node --check opencode/codegraph/impl/.opencode/codegraph/scripts/resolve-codegraph.mjs`: PASS
- `node --check opencode/codegraph/impl/.opencode/codegraph/scripts/mcp-proxy.mjs`: PASS
- `git diff --check --cached`: PASS after staging only `opencode/codegraph/impl/**`
- `command -v pwsh`: no executable found on this host; PowerShell runtime execution is host-limited and must be rerun on Windows 10 + PowerShell 7.6.

## Host Limitation

이 macOS 검증 host에는 `pwsh`가 설치되어 있지 않다. 따라서 Windows 10 + PowerShell 7.6에서의 `install-opencode-codegraph.ps1`, `install-codegraph-mcp.ps1`, `verify-codegraph-mcp.ps1`, `smoke.ps1` 실행은 이 host에서 직접 수행하지 못했다.

대신 다음을 확인했다.

- PowerShell 스크립트는 pack에 포함되어 있으며 public network 없이 offline archive path를 받는다.
- Node runtime resolver와 CLI evidence path는 실제 실행으로 검증했다.
- `pwsh` 부재는 숨기지 않고 이 문서와 최종 보고에 명시한다.
