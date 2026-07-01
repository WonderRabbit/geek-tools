# CodeGraph local binary slot

폐쇄망에서는 사전 반입한 CodeGraph release bundle을 이 디렉터리에 푼다.

예상 파일:

- Windows: `codegraph.exe` 또는 `codegraph.cmd`
- macOS/Linux: `codegraph`

운영 우선순위:

1. `CODEGRAPH_BIN`
2. `.opencode/codegraph/bin/codegraph`
3. `.opencode/codegraph/bin/codegraph.exe`
4. `.opencode/codegraph/runtime/current/bin/codegraph.cmd`
5. `PATH`의 `codegraph`

이 디렉터리는 single-file override용이다. 공식 Windows release zip은 launcher만 복사하지 말고 `.opencode/codegraph/runtime/current/`에 전체 extract한다.
