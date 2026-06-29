import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const testDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(testDir, "../../../..");
export const cli = path.resolve(testDir, "../bin/opencode-estimate.mjs");

export function run(args, options = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
  });
}

export function makeTempDir(t) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "estimate-cli-"));
  t.after(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });
  return tmp;
}

