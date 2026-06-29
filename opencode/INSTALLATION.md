# OpenCode write JSON repair 설치 매뉴얼

이 패키지는 Windows 10 + PowerShell 7.6에서 실행 중인 OpenCode source checkout에 `write` tool-call JSON parse 실패 보정 패치를 적용한다. 문제의 핵심은 Markdown 파서가 아니라 `write` tool-call argument JSON이 `{` 같은 불완전한 문자열로 끊기는 경계다.

## 포함 파일

- `patches/opencode-write-json-repair.patch`: OpenCode에 적용할 구현 patch.
- `install-opencode-write-json-repair.ps1`: 백업, patch 적용, 검증, 롤백을 수행하는 자동 설치 스크립트.
- `verify-installer.ps1`: PowerShell parser 기준 installer 문법 검증 스크립트.
- `verify-package.sh`: macOS/Linux에서 패키지 구조와 patch 적용성을 검증하는 보조 스크립트.

## 사전 준비

1. Windows 10에서 PowerShell 7.6 이상을 연다.
2. `git --version`이 동작해야 한다.
3. `bun --version`이 동작해야 한다. OpenCode checkout은 `package.json`에서 `bun@1.3.14`를 요구한다.
4. OpenCode source checkout 경로를 확인한다. 예: `C:\src\opencode`.

## 자동 설치

`opencode` 디렉터리에서 실행한다.

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\install-opencode-write-json-repair.ps1 -OpenCodeRoot C:\src\opencode
```

설치 스크립트는 다음 순서로 동작한다.

1. PowerShell 7.6 이상인지 확인한다.
2. `OpenCodeRoot`가 OpenCode source checkout인지 확인한다.
3. 수정 대상 파일을 `.opencode-write-json-repair-backup\<timestamp>\` 아래에 백업한다.
4. `git apply --check`로 patch 적용 가능성을 먼저 검증한다.
5. `patches/opencode-write-json-repair.patch`를 적용한다.
6. `bun install --frozen-lockfile`, targeted tests, `bun run --cwd packages/opencode typecheck`를 실행한다.

검증을 나중에 직접 실행하려면 다음처럼 설치만 할 수 있다.

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\install-opencode-write-json-repair.ps1 -OpenCodeRoot C:\src\opencode -SkipVerify
```

Windows가 아닌 host에서 installer 문법만 확인해야 하는 경우에만 `-ForceUnsupportedOS`를 붙인다. 실제 설치에는 사용하지 않는다.

## 수동 검증 명령

설치 후 OpenCode checkout에서 아래 명령을 실행한다.

```powershell
cd C:\src\opencode
bun test packages/opencode/test/session/tool-call-diagnostics.test.ts
bun test packages/opencode/test/tool/parameters.test.ts --test-name-pattern "invalid|write|diagnostic|filePath"
bun run --cwd packages/opencode typecheck
```

기대 결과:

- `Text:{` 형태의 불완전한 tool-call input이 `truncated_json`으로 분류된다.
- `invalid` tool feedback에 `diagnostic`, `expectedKeys`, `receivedKeys`, `rawSnippet`가 포함된다.
- `write` schema는 `filePath`를 `content`보다 먼저 노출한다.
- `path`, `fileContent` 같은 alias는 허용하지 않는다.

## 롤백

마지막 백업으로 되돌리려면 다음을 실행한다.

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\install-opencode-write-json-repair.ps1 -OpenCodeRoot C:\src\opencode -Rollback
```

롤백은 `.opencode-write-json-repair-backup` 아래의 최신 manifest에 기록된 파일만 복원한다.

## 설치 후 OpenCode 실행

source checkout 기준으로 실행한다.

```powershell
cd C:\src\opencode
bun run --cwd packages/opencode --conditions=browser src/index.ts
```

이후 Markdown 파일 작성 요청에서 JSON parse 실패가 다시 발생하면, 에러는 단순 `JSON parsing failed: Text:{` 루프가 아니라 `truncated_json` diagnostic과 기대 key 정보를 포함해야 한다.
