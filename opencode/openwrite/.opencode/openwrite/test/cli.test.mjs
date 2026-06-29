import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const cli = new URL("../bin/openwrite.mjs", import.meta.url).pathname;

test("CLI fast-write emits JSON success", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "openwrite-cli-"));
  try {
    const content = path.join(root, "content.txt");
    await fs.writeFile(content, "hello\n", "utf8");
    const result = await runNode([cli, "fast-write", "--root", root, "--path", "docs/a.md", "--content-file", content]);
    assert.equal(result.code, 0);
    const json = JSON.parse(result.stdout);
    assert.equal(json.ok, true);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("CLI doctor reports package files", async () => {
  const root = path.resolve(new URL("../../..", import.meta.url).pathname);
  const result = await runNode([cli, "doctor", "--root", root]);
  assert.equal(result.code, 0);
  const json = JSON.parse(result.stdout);
  assert.equal(json.operation, "doctor");
  assert.equal(json.checks.some((check) => check.name === "file:.opencode/tools/fast_write.js" && check.status === "ok"), true);
});

test("CLI doctor verifies installed target surface", async () => {
  const packRoot = path.resolve(new URL("../../..", import.meta.url).pathname);
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "openwrite-installed-surface-"));
  try {
    await copyDir(path.join(packRoot, ".opencode", "tools"), path.join(root, ".opencode", "tools"));
    await copyDir(path.join(packRoot, ".opencode", "commands"), path.join(root, ".opencode", "commands"));
    await copyDir(path.join(packRoot, ".opencode", "agents"), path.join(root, ".opencode", "agents"));
    await copyDir(path.join(packRoot, ".opencode", "openwrite"), path.join(root, ".opencode", "openwrite"));
    await fs.copyFile(path.join(packRoot, "README.md"), path.join(root, "OPENWRITE.md"));
    await fs.copyFile(path.join(packRoot, "MANIFEST.json"), path.join(root, ".opencode", "openwrite", "MANIFEST.json"));
    const result = await runNode([cli, "doctor", "--root", root]);
    assert.equal(result.code, 0);
    const json = JSON.parse(result.stdout);
    const failures = json.checks.filter((check) => check.name.startsWith("file:") && check.status !== "ok");
    assert.deepEqual(failures, []);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

function runNode(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

async function copyDir(source, destination) {
  await fs.mkdir(destination, { recursive: true });
  for (const entry of await fs.readdir(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      await copyDir(from, to);
    } else {
      await fs.mkdir(path.dirname(to), { recursive: true });
      await fs.copyFile(from, to);
    }
  }
}
