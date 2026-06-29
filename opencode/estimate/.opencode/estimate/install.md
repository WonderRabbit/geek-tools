# 설치 가이드

대상 환경은 Windows 10, PowerShell 7.6 이상, Node.js가 설치된 기존 OpenCode 프로젝트다. 이 패키지는 npm 의존성을 설치하지 않는다. Node.js built-in module만 사용하므로 폐쇄망에서도 폴더 복사만으로 동작하도록 구성했다.

## 0. 설치 전에 확인할 것

설치할 PC에서 PowerShell 7.6을 열고 다음을 확인한다.

```powershell
$PSVersionTable.PSVersion
node --version
opencode --version
```

예상 결과:

- PowerShell은 `7.6.x` 이상이면 가장 좋다. 낮은 버전이면 일부 스크립트가 경고를 낼 수 있다.
- Node.js는 `v20` 이상을 권장한다.
- `opencode --version`이 실패하면 OpenCode를 먼저 설치하거나 PATH를 확인한다.

이미 설치되어 있으면 다음 CLI 도구도 그대로 활용한다.

```powershell
rg --version
fd --version
sg --version
jq --version
yq --version
mdq --version
```

이 도구들은 필수는 아니지만, 실제 legacy source code 필터링과 evidence packet 작성 품질을 높이는 데 사용한다. WSL, winget, bash, apt, choco 설치를 전제로 하지 않는다.

## 1. 파일 배치 방식 선택

### 같은 폴더에서 바로 시험 실행

현재 `impl/estimate` 폴더를 그대로 사용할 때는 이 폴더가 테스트용 OpenCode 프로젝트 루트라고 보면 된다.

```powershell
cd C:\path\to\impl\estimate
pwsh -NoProfile -ExecutionPolicy Bypass -File .\.opencode\estimate\scripts\doctor.ps1 -Json
```

### 다른 OpenCode 프로젝트에 설치

대상 프로젝트 예시는 `C:\work\legacy-app`이라고 가정한다.

```powershell
cd C:\path\to\impl\estimate
pwsh -NoProfile -ExecutionPolicy Bypass -File .\.opencode\estimate\scripts\install.ps1 -TargetRoot C:\work\legacy-app -Json
```

설치 스크립트는 대상 프로젝트의 `.opencode` 폴더를 통째로 지우지 않는다. 같은 파일이 이미 있고 내용이 다르면 중단한다. 기존 파일을 덮어써야 하는 경우에만 `-Force`를 붙인다.

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\.opencode\estimate\scripts\install.ps1 -TargetRoot C:\work\legacy-app -Force -Json
```

설치 후 대상 프로젝트에는 다음 파일군이 생긴다.

- `.opencode\commands\estimate*.md`
- `.opencode\agents\estimate-*.md`
- `.opencode\tools\wonder_estimate_*.js`
- `.opencode\estimate\bin\opencode-estimate.mjs`
- `.opencode\estimate\lib\*.mjs`
- `.opencode\estimate\scripts\*.ps1`
- `.opencode\estimate\config\qwen3.6-35b.example.json`

## 2. 설치 결과 진단

대상 프로젝트 루트로 이동한 뒤 실행한다.

```powershell
cd C:\work\legacy-app
pwsh -NoProfile -ExecutionPolicy Bypass -File .\.opencode\estimate\scripts\doctor.ps1 -Json
```

정상 기준:

- `status`가 `ok` 또는 환경 경고만 포함한 `warn`이다.
- 필수 파일 check가 `ok`다.
- `host.windows`가 `ok`다.
- `powershell.version`이 `ok`다.
- wrapper 안전성 검사에서 `shell:true`, `execSync`, `execFileSync`, 직접 `exec(`가 나오지 않는다.

macOS나 Linux에서 구조만 점검하면 `host.windows`가 `warn`일 수 있다. 실제 운영 검증은 Windows 10 + PowerShell 7.6에서 다시 수행한다.

## 3. Qwen 3.6 35B 연결 설정

예제 config를 복사한다.

```powershell
Copy-Item .\.opencode\estimate\config\qwen3.6-35b.example.json .\.opencode\estimate\config\qwen3.6-35b.local.json
notepad .\.opencode\estimate\config\qwen3.6-35b.local.json
```

수정할 값:

- `endpoint`: OpenAI-compatible base URL. 예: `http://127.0.0.1:8000/v1`
- `model`: 실제 서버에 등록된 Qwen 3.6 35B model id
- `temperature`: 견적 산출에는 낮은 값을 권장한다.
- `max_tokens`: context packet 크기에 맞게 조정한다.

네트워크 없이 config 형식만 확인한다.

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\.opencode\estimate\scripts\qwen-preflight.ps1 -ConfigPath .\.opencode\estimate\config\qwen3.6-35b.local.json -SkipNetwork -Json
```

서버의 `/v1/models`까지 확인하려면 API key를 설정하고 실행한다.

```powershell
$env:OPENAI_API_KEY = "YOUR_KEY"
pwsh -NoProfile -ExecutionPolicy Bypass -File .\.opencode\estimate\scripts\qwen-preflight.ps1 -ConfigPath .\.opencode\estimate\config\qwen3.6-35b.local.json -Json
```

폐쇄망에서 내부 모델 서버를 쓴다면 `OPENAI_API_KEY`는 서버 정책에 맞게 비우거나 내부 토큰으로 설정한다.

## 4. Smoke test

설치된 파일과 기본 fixture가 동작하는지 확인한다.

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\.opencode\estimate\scripts\smoke.ps1 -Json
```

예상 결과:

- `status`가 `ok`다.
- `.estimate\output.json`, `.estimate\output.md`, `.estimate\review.json`이 생성된다.
- review 결과의 `ok`가 `true`다.

만약 `status`가 `fail`이면 다음 순서로 확인한다.

1. `doctor.ps1 -Json`으로 누락 파일을 찾는다.
2. `node --version`이 실행되는지 확인한다.
3. `.opencode\tools\package.json`이 존재하는지 확인한다. 이 파일은 대상 프로젝트가 `"type": "module"`이어도 wrapper를 CommonJS로 실행하게 한다.
4. 기존 `.opencode` 파일과 충돌했다면 `install.ps1 -Force`가 필요한지 판단한다.

## 5. Evidence adapter 실행

폐쇄망 PC에 이미 설치된 `rg`, `fd`, `sg`, `jq`, `yq`, `mdq`를 이용해 source/flow evidence 후보를 만든다.

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\.opencode\estimate\scripts\collect-evidence.ps1 -TargetRoot . -Out .estimate\evidence-adapters.json -Json
```

예상 결과:

- `.estimate\evidence-adapters.json`이 생성된다.
- `tools`에 각 CLI의 PATH와 version 또는 warn이 기록된다.
- `adapters.fileInventory`에는 `fd` 또는 `rg --files` 기반 파일 후보가 들어간다.
- `adapters.sourceSignals`에는 `rg` 기반 source 후보가 들어간다.
- `adapters.flowSignals`에는 data/business flow 후보가 들어간다.
- `adapters.astSignals`에는 `sg` 기반 TypeScript function 후보가 들어간다.

이 파일은 Qwen에게 legacy source 전체를 넘기지 않고, 관련 evidence packet을 좁히기 위한 원천 자료로 사용한다.

## 6. OpenCode에서 사용하는 방법

OpenCode를 대상 프로젝트 루트에서 실행한다.

```powershell
cd C:\work\legacy-app
opencode
```

사용할 command:

- `/estimate`: 전체 견적 workflow 실행용
- `/estimate-feature-duration`: 기능별 개발 기간 표 산출용
- `/estimate-doctor`: 설치와 환경 점검용
- `/estimate-offline-bundle`: 폐쇄망 이동용 bundle 생성/검증 안내용

사용할 agent:

- `estimate-worker`: source/flow evidence packet 작성
- `estimate-estimator`: 작업 분류, reference class, P50/P80/P95 산출
- `estimate-reviewer`: 증거 누락, 과신, source-flow 불일치 검토

중요 운영 규칙:

- Qwen에게 legacy source 전체를 그대로 넣지 않는다.
- `rg`, `fd`, `sg`, `jq`, `yq`, `mdq`로 관련 파일, symbol, business flow, data flow만 좁혀 evidence packet을 만든다.
- 견적 표에는 반드시 source evidence와 flow evidence를 분리해 남긴다.
- source evidence가 없는 기능, flow evidence가 없는 기능, 요구사항 문서만 있는 기능은 `review`에서 막히거나 낮은 confidence로 처리한다.

## 7. 오프라인 번들 만들기

인터넷이 되는 PC에서 이 패키지를 하나의 zip으로 묶는다.

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\.opencode\estimate\scripts\make-offline-bundle.ps1 -OutputDir .\dist -Json
```

생성된 zip을 폐쇄망 PC로 옮긴 뒤 검증한다.

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\.opencode\estimate\scripts\verify-offline-bundle.ps1 -Bundle .\dist\wonder-estimate-opencode-assets.zip -Json
```

검증이 끝나면 압축을 풀고 1~4단계를 반복한다. 이 패키지는 외부 npm 다운로드가 필요 없도록 설계되어 있다.

## 8. 산출물 위치

기본 실행 산출물은 프로젝트 루트의 `.estimate` 아래에 쌓인다.

- `.estimate\output.json`: 구조화된 견적 결과
- `.estimate\output.md`: 사람이 읽는 기능별 견적 표
- `.estimate\review.json`: 리뷰 게이트 결과

Git에 포함할지 여부는 프로젝트 정책에 따른다. 실제 고객/내부 보고서에 붙일 때는 `.estimate\output.md`를 기준으로 검토한다.

## 문제 해결

- `node executable was not found`: Node.js를 PATH에 추가한다.
- `Endpoint must start with http:// or https://`: Qwen endpoint 값을 OpenAI-compatible base URL로 바꾼다.
- `wrapper uses an unsafe process execution pattern`: `.opencode\tools\wonder_estimate_*.js`에 `shell:true`, `exec`, `spawnSync` 설정이 들어갔는지 확인한다.
- `PowerShell 7.6 or newer recommended`: 실제 Windows 운영에서는 PowerShell 7.6 이상으로 재확인한다.
- `path escapes root`: 입력 또는 출력 경로가 프로젝트 루트 밖을 가리킨다. 상대 경로를 프로젝트 내부로 바꾼다.
- `invalid_source_evidence`: `source_evidence_refs`에 `file:`로 시작하지 않는 ref가 섞여 있다.
- `invalid_flow_evidence`: `flow_evidence_refs`에 `flow:`로 시작하지 않는 ref가 섞여 있다.
- `packet_source_flow_not_mapped`: 기능 packet 중 source evidence와 flow evidence가 모두 갖춰지지 않은 항목이 있다.
