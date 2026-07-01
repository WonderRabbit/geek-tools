# CodeGraph runtime slot

Official CodeGraph Windows bundles include a launcher plus a vendored Node runtime and app files.

For offline Windows 10 operation, extract the complete release zip here:

```text
.opencode/codegraph/runtime/current/
  bin/codegraph.cmd
  node/node.exe
  lib/
  dist/
  node_modules/
```

Do not copy only `codegraph.cmd`; it depends on the files beside the bundle.
