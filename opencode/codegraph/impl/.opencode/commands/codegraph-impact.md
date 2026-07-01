---
description: Build a bounded impact packet for a frontend symbol, backend route, or edge id.
---

<command-instruction>
Use `wonder_codegraph_impact_packet`.

If `$ARGUMENTS` is non-empty, pass `$ARGUMENTS` as `target`.
If no argument is provided, ask for one frontend symbol, backend route, endpoint, or edge id.

The output must include:

- target
- candidate frontend sources
- candidate backend sources
- static evidence
- contract evidence
- runtime/test evidence
- confidence
- recommended next action

Do not modify files.
</command-instruction>
