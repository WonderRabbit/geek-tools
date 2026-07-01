import { tool } from "@opencode-ai/plugin"

function resolveNodeCommand(worktree) {
  const windowsBundleNode = `${worktree}/.opencode/codegraph/runtime/current/node/node.exe`
  return typeof process !== "undefined" && process.platform === "win32" ? windowsBundleNode : "node"
}

async function runWrapper(context, args) {
  const script = `${context.worktree}/.opencode/codegraph/scripts/wonder-codegraph.mjs`
  const proc = Bun.spawn([resolveNodeCommand(context.worktree), script, ...args], {
    cwd: context.worktree,
    stdout: "pipe",
    stderr: "pipe",
  })
  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  const code = await proc.exited
  if (code !== 0) throw new Error(stderr.trim() || stdout.trim() || `wonder-codegraph exited ${code}`)
  return stdout.trim()
}

export default tool({
  description: "Create a bounded read-only impact packet for a symbol, route, endpoint, or edge id.",
  args: {
    target: tool.schema.string().describe("Frontend symbol, backend route, endpoint, or edge id."),
    manifest: tool.schema.string().optional().describe("Manifest path relative to the worktree."),
    json: tool.schema.boolean().optional().describe("Return JSON output."),
  },
  async execute(args, context) {
    const argv = ["impact-packet", "--target", args.target]
    if (args.manifest) argv.push("--manifest", args.manifest)
    if (args.json) argv.push("--json")
    return runWrapper(context, argv)
  },
})
