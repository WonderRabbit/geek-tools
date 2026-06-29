import { tool } from "@opencode-ai/plugin";
import { fastWrite } from "../openwrite/lib/openwrite-core.mjs";

export default tool({
  description:
    "Fast workspace-local file writer for large files. Uses atomic temp-file replacement and returns bounded JSON without full diff output.",
  args: {
    path: tool.schema.string().describe("Workspace-relative target path."),
    content: tool.schema.string().describe("Full replacement content."),
    mode: tool.schema.enum(["create", "overwrite"]).optional().describe("create refuses existing files; overwrite is default."),
    expectedHash: tool.schema.string().optional().describe("Optional current file SHA-256 that must match before writing."),
    fsync: tool.schema.boolean().optional().describe("When true or omitted, fsync temp file and parent directory when possible."),
  },
  async execute(args, context) {
    const root = resolveRoot(context);
    const result = await fastWrite(root, args);
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
