import { tool } from "@opencode-ai/plugin";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runWonderWriteR, resolveRoot } from "./wonder_write_r_runner.js";

export default tool({
  description:
    "Rust-backed workspace-local file writer for large files. Uses Wonder-write-r executable and returns bounded JSON without full diff output.",
  args: {
    path: tool.schema.string().describe("Workspace-relative target path."),
    content: tool.schema.string().describe("Full replacement content."),
    mode: tool.schema.enum(["create", "overwrite"]).optional().describe("create refuses existing files; overwrite is default."),
    expectedHash: tool.schema.string().optional().describe("Optional current file SHA-256 that must match before writing."),
    fsync: tool.schema.boolean().optional().describe("When false, skips file sync before atomic rename."),
  },
  async execute(args, context) {
    const root = resolveRoot(context);
    const scratch = await mkdtemp(path.join(os.tmpdir(), "wonder-write-r-"));
    try {
      const contentFile = path.join(scratch, "content.txt");
      await writeFile(contentFile, args.content ?? "", "utf8");
      const cliArgs = ["fast-write", "--root", root, "--path", args.path, "--content-file", contentFile];
      if (args.mode) cliArgs.push("--mode", args.mode);
      if (args.expectedHash) cliArgs.push("--expected-hash", args.expectedHash);
      if (args.fsync === false) cliArgs.push("--fsync", "false");
      return await runWonderWriteR(cliArgs);
    } finally {
      await rm(scratch, { recursive: true, force: true });
    }
  },
});
