import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("wrappers do not use unsafe process execution APIs", async () => {
  const root = path.resolve(new URL("../../..", import.meta.url).pathname);
  const files = await collectJs(path.join(root, ".opencode"));
  const unsafe = [];
  for (const file of files) {
    const text = await fs.readFile(file, "utf8");
    if (/shell\s*:\s*true|\bexec(File|Sync)?\s*\(|spawnSync\s*\(/.test(text)) {
      unsafe.push(file);
    }
  }
  assert.deepEqual(unsafe, []);
});

async function collectJs(directory) {
  const results = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await collectJs(absolute)));
    } else if (entry.name.endsWith(".js") || entry.name.endsWith(".mjs")) {
      results.push(absolute);
    }
  }
  return results;
}
