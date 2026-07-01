---
description: Show the frontend/backend repository connection map for CodeGraph evidence work.
---

<command-instruction>
Run `wonder_codegraph_repo_map`.

Return a compact table with:

- repo id
- kind
- framework
- path
- CodeGraph index hint
- contract artifacts
- runtime artifacts

If the manifest is missing, instruct the user to copy `.opencode/codegraph/examples/repo-link-manifest.json` to `.opencode/codegraph/repo-link-manifest.json` and edit repo paths.
</command-instruction>
