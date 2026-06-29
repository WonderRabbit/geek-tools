---
description: Generate a feature-by-feature duration estimate from bounded evidence packets.
---

<command-instruction>
You are running the Windows-safe Wonder Estimate workflow.

Rules:

1. Use only project-local tools under `.opencode/tools/wonder_estimate_*.js`.
2. Never request or pass a whole repository dump to Qwen.
3. Build estimate rows from evidence packet, work classification, reference class, and developer profile summary only.
4. If source or flow evidence is missing, return `insufficient_evidence` instead of inventing a medium/high-confidence estimate.
5. Report `.estimate/output.md`, `.estimate/output.json`, and `.estimate/review.json` when the run completes.

Recommended sequence:

```text
wonder_estimate_intake
wonder_estimate_split_features
wonder_estimate_source_packet
wonder_estimate_flow_align
wonder_estimate_classify_work
wonder_estimate_reference_class
wonder_estimate_render_table
wonder_estimate_review_gate
```
</command-instruction>
