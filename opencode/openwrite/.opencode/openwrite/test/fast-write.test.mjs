import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fastWrite, sha256File } from "../lib/openwrite-core.mjs";

test("fastWrite creates a large file with bounded result", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "openwrite-fast-write-"));
  try {
    const content = Array.from({ length: 900 }, (_, index) => `line ${index}`).join("\n");
    const result = await fastWrite(root, { path: "docs/large.md", content, mode: "create" });
    assert.equal(result.ok, true);
    assert.equal(result.operation, "fast_write");
    assert.equal(result.path, "docs/large.md");
    assert.match(result.sha256, /^[0-9a-f]{64}$/);
    assert.equal(result.content, undefined);
    assert.equal(result.diff, undefined);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("fastWrite rejects hash mismatch and root escape", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "openwrite-fast-write-edge-"));
  try {
    await fs.mkdir(path.join(root, "docs"), { recursive: true });
    const target = path.join(root, "docs/file.md");
    await fs.writeFile(target, "before", "utf8");
    const hash = await sha256File(target);
    const mismatch = await fastWrite(root, {
      path: "docs/file.md",
      content: "after",
      expectedHash: "0".repeat(64),
    });
    assert.equal(mismatch.ok, false);
    assert.equal(mismatch.error, "expected_hash_mismatch");
    assert.equal(await fs.readFile(target, "utf8"), "before");
    const ok = await fastWrite(root, { path: "docs/file.md", content: "after", expectedHash: hash });
    assert.equal(ok.ok, true);
    const escape = await fastWrite(root, { path: "../escape.md", content: "bad" });
    assert.equal(escape.ok, false);
    assert.equal(escape.error, "path_escapes_root");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
