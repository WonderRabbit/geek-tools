# 패치 패키지

`opencode-write-json-repair.patch`는 OpenCode `write` tool-call JSON 복구 패치를 적용하기 위한 patch 파일이다.

현재 체크아웃에서는 `opencode/fix` 디렉터리에서 Windows installer를 실행한다.

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\install-opencode-write-json-repair.ps1 -OpenCodeRoot C:\src\opencode
```

상세 절차는 저장소 루트의 `README.md`와 `opencode/fix/INSTALLATION.md`를 확인한다.
