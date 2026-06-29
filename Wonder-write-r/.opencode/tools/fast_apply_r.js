import { tool } from "@opencode-ai/plugin";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runWonderWriteR, resolveRoot } from "./wonder_write_r_runner.js";

export default tool({
  description:
    "Rust-backed workspace-local patch applicator. Runs git apply --check before mutation and returns bounded JSON evidence.",
  args: {
    patch: tool.schema.string().describe("Unified diff text."),
    strip: tool.schema.number().optional().describe("Optional git apply -p value."),
    expectedHashes: tool.schema.record(tool.schema.string()).optional().describe("Optional pre-apply SHA-256 per path."),
    maxEvidenceBytes: tool.schema.number().optional().describe("Maximum bytes of textual evidence returned."),
  },
  async execute(args, context) {
    const root = resolveRoot(context);
    const scratch = await mkdtemp(path.join(os.tmpdir(), "wonder-write-r-"));
    try {
      const patchFile = path.join(scratch, "change.patch");
      await writeFile(patchFile, args.patch ?? "", "utf8");
      const cliArgs = ["fast-apply", "--root", root, "--patch-file", patchFile];
      if (args.strip !== undefined) cliArgs.push("--strip", String(args.strip));
      if (args.expectedHashes) {
        const hashesFile = path.join(scratch, "expected-hashes.json");
        await writeFile(hashesFile, JSON.stringify(args.expectedHashes), "utf8");
        cliArgs.push("--expected-hashes-file", hashesFile);
      }
      if (args.maxEvidenceBytes !== undefined) cliArgs.push("--max-evidence-bytes", String(args.maxEvidenceBytes));
      return await runWonderWriteR(cliArgs);
    } finally {
      await rm(scratch, { recursive: true, force: true });
    }
  },
});
