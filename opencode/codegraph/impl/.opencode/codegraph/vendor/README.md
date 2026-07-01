# CodeGraph vendor slot

온라인 준비 PC 또는 내부 mirror에서 받은 CodeGraph 산출물을 보관하는 위치다.

허용 입력물:

- GitHub release archive: `codegraph-<target>.zip`, `codegraph-<target>.tar.gz`
- 내부 Git mirror에서 checkout한 pinned SHA
- 내부 npm mirror에서 받은 `@colbymchenry/codegraph` package와 platform package

폐쇄망 운영에서는 public network 명령을 실행하지 않는다. 준비 PC에서 검증한 archive를 반입하고, hash를 기록한 뒤 `.opencode/codegraph/bin/`으로 풀어 실행한다.
