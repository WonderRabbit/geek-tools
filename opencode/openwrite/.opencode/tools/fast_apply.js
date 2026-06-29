import { tool } from "@opencode-ai/plugin";
import { fastApply } from "../openwrite/lib/openwrite-core.mjs";

export default tool({
  description:
    "Fast workspace-local patch applicator. Runs git apply --check before mutation and returns bounded JSON evidence.",
  args: {
    patch: tool.schema.string().describe("Unified diff text."),
    strip: tool.schema.number().optional().describe("Optional git apply -p value."),
    expectedHashes: tool.schema.record(tool.schema.string()).optional().describe("Optional pre-apply SHA-256 per path."),
    maxEvidenceBytes: tool.schema.number().optional().describe("Maximum bytes of textual evidence returned."),
  },
  async execute(args, context) {
    const root = resolveRoot(context);
    const result = await fastApply(root, args);
    return JSON.stringify(result, null, 2);
  },
});

function resolveRoot(context) {
  return (
    context?.project?.root ??
    context?.session?.directory ??
    context?.worktree ??
    context?.cwd ??
    process.cwd()
  );
}
