# geek-tools

개인 개발 작업 중 재사용할 수 있는 패치, 설치 스크립트, 검증 보조 도구를 모아 두는 저장소다. 현재 포함된 항목은 OpenCode 관련 패치 패키지와 project-local 도구 묶음이다.

## 포함 패키지

### `opencode/fix`

Windows 10 + PowerShell 7.6 환경에서 실행하는 OpenCode source checkout에 `write` tool-call JSON 복구 패치를 적용한다.

이 패키지가 다루는 문제는 Markdown 문법 문제가 아니라, OpenCode가 `write` tool-call argument JSON을 읽는 과정에서 입력이 `{` 같은 불완전한 문자열로 끊겨 `JSON parsing failed` 루프에 빠지는 경계다.

### `opencode/openwrite`

OpenCode에서 큰 파일을 만들거나 수정할 때 built-in `write`/`apply_patch`가 느려지는 구간을 우회하기 위한 project-local OpenWrite 도구 묶음이다.

### `opencode/estimate`

OpenCode/Qwen 조합에서 견적 작업 단위를 작게 고정하고, 검증 가능한 wrapper와 PowerShell script 중심으로 실행 경로를 제한하는 project-local estimator asset pack이다.

## 구성

- `opencode/fix/patches/opencode-write-json-repair.patch`: OpenCode source checkout에 적용할 구현 patch.
- `opencode/fix/install-opencode-write-json-repair.ps1`: 백업, patch 적용, 검증, 롤백을 수행하는 Windows용 설치 스크립트.
- `opencode/fix/verify-installer.ps1`: PowerShell parser 기준 installer 문법 검증 스크립트.
- `opencode/fix/verify-package.sh`: macOS/Linux에서 패키지와 patch 적용성을 확인하는 보조 스크립트.
- `opencode/fix/INSTALLATION.md`: 상세 설치 매뉴얼.
- `opencode/fix/MANIFEST.json`: 패키지 생성 대상, 요구 환경, patch 대상 파일 목록.
- `opencode/openwrite/.opencode/`: OpenWrite command, agent, tool, script assets.
- `opencode/openwrite/MANIFEST.json`: OpenWrite 복사/검증 범위.
- `opencode/estimate/.opencode/`: Estimate command, agent, tool, workflow, script assets.
- `opencode/estimate/MANIFEST.json`: Estimate asset pack 복사/검증 범위.

## 사전 준비

설치 대상은 OpenCode source checkout이다. Windows 10에서 다음 도구가 동작해야 한다.

- PowerShell 7.6 이상
- `git`
- `bun`

예시 OpenCode checkout 경로:

```powershell
C:\src\opencode
```

## 설치

`opencode/fix` 디렉터리에서 실행한다.

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\install-opencode-write-json-repair.ps1 -OpenCodeRoot C:\src\opencode
```

설치 스크립트는 다음 작업을 수행한다.

1. PowerShell 버전과 Windows 실행 환경을 확인한다.
2. `OpenCodeRoot`가 OpenCode source checkout인지 확인한다.
3. 수정 대상 파일을 `.opencode-write-json-repair-backup\<timestamp>\` 아래에 백업한다.
4. `git apply --check`로 patch 적용 가능성을 먼저 검증한다.
5. `patches/opencode-write-json-repair.patch`를 적용한다.
6. `bun install --frozen-lockfile`, targeted tests, `bun run --cwd packages/opencode typecheck`를 실행한다.

검증을 나중에 직접 수행하려면 설치만 실행할 수 있다.

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\install-opencode-write-json-repair.ps1 -OpenCodeRoot C:\src\opencode -SkipVerify
```

Windows가 아닌 host에서 installer 문법이나 패키지 구조만 확인해야 하는 경우에만 `-ForceUnsupportedOS`를 사용한다. 실제 설치에는 사용하지 않는다.

## 수동 검증

패치 적용 후 OpenCode checkout에서 실행한다.

```powershell
cd C:\src\opencode
bun test packages/opencode/test/session/tool-call-diagnostics.test.ts
bun test packages/opencode/test/tool/parameters.test.ts --test-name-pattern "invalid|write|diagnostic|filePath"
bun run --cwd packages/opencode typecheck
```

기대 결과:

- 불완전한 tool-call input이 `truncated_json` diagnostic으로 분류된다.
- `invalid` tool feedback에 `diagnostic`, `expectedKeys`, `receivedKeys`, `rawSnippet`가 포함된다.
- `write` schema는 `filePath`를 `content`보다 먼저 노출한다.
- `path`, `fileContent` 같은 alias는 허용하지 않는다.

## 롤백

마지막 백업으로 되돌린다.

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\install-opencode-write-json-repair.ps1 -OpenCodeRoot C:\src\opencode -Rollback
```

롤백은 `.opencode-write-json-repair-backup` 아래의 최신 manifest에 기록된 파일만 복원한다.

## 참고

각 패키지는 현재 체크아웃의 실제 디렉터리를 패키지 루트로 보고 실행한다. 예를 들어 `opencode/fix`는 `opencode/fix`에서, `opencode/openwrite`는 `opencode/openwrite`에서, `opencode/estimate`는 `opencode/estimate`에서 검증한다.
