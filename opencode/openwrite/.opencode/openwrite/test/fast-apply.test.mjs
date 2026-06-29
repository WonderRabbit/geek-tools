import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fastApply } from "../lib/openwrite-core.mjs";

test("fastApply checks and applies a unified diff", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "openwrite-fast-apply-"));
  try {
    await fs.writeFile(path.join(root, "target.txt"), "before\n", "utf8");
    const patch = [
      "diff --git a/target.txt b/target.txt",
      "--- a/target.txt",
      "+++ b/target.txt",
      "@@ -1 +1 @@",
      "-before",
      "+after",
      "",
    ].join("\n");
    const result = await fastApply(root, { patch });
    assert.equal(result.ok, true);
    assert.deepEqual(result.paths, ["target.txt"]);
    assert.equal(await fs.readFile(path.join(root, "target.txt"), "utf8"), "after\n");
    assert.equal(result.patch, undefined);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("fastApply rejects invalid and escaping patches before mutation", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "openwrite-fast-apply-edge-"));
  try {
    await fs.writeFile(path.join(root, "target.txt"), "before\n", "utf8");
    const invalid = [
      "diff --git a/target.txt b/target.txt",
      "--- a/target.txt",
      "+++ b/target.txt",
      "@@ -1 +1 @@",
      "-missing",
      "+after",
      "",
    ].join("\n");
    const bad = await fastApply(root, { patch: invalid });
    assert.equal(bad.ok, false);
    assert.equal(bad.error, "git_apply_check_failed");
    assert.equal(await fs.readFile(path.join(root, "target.txt"), "utf8"), "before\n");
    const escapePatch = [
      "diff --git a/../escape.txt b/../escape.txt",
      "--- a/../escape.txt",
      "+++ b/../escape.txt",
      "@@ -1 +1 @@",
      "-before",
      "+after",
      "",
    ].join("\n");
    const escape = await fastApply(root, { patch: escapePatch });
    assert.equal(escape.ok, false);
    assert.equal(escape.error, "path_escapes_root");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
