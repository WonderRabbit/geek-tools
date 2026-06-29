#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fastApply, fastWrite } from "../lib/openwrite-core.mjs";

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: "cli_failed", message: error.message }, null, 2));
  process.exitCode = 1;
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.command) {
    printHelp();
    return;
  }
  const root = path.resolve(args.root ?? process.cwd());
  let result;
  if (args.command === "fast-write") {
    const content = args.contentFile ? await fs.readFile(args.contentFile, "utf8") : args.content ?? "";
    result = await fastWrite(root, {
      path: required(args.path, "--path"),
      content,
      mode: args.mode,
      expectedHash: args.expectedHash,
      fsync: args.fsync !== "false",
    });
  } else if (args.command === "fast-apply") {
    const patch = args.patchFile ? await fs.readFile(args.patchFile, "utf8") : args.patch ?? "";
    const expectedHashes = args.expectedHashesFile
      ? JSON.parse(await fs.readFile(args.expectedHashesFile, "utf8"))
      : undefined;
    result = await fastApply(root, {
      patch,
      strip: args.strip === undefined ? undefined : Number(args.strip),
      expectedHashes,
      maxEvidenceBytes: args.maxEvidenceBytes === undefined ? undefined : Number(args.maxEvidenceBytes),
    });
  } else if (args.command === "doctor") {
    result = await doctor(root, args);
  } else {
    throw new Error(`Unsupported command: ${args.command}`);
  }
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    process.exitCode = 2;
  }
}

function parseArgs(argv) {
  const parsed = {};
  parsed.command = argv[0];
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--help") {
      parsed.help = true;
      continue;
    }
    const key = flagName(token);
    parsed[key] = required(argv[index + 1], token);
    index += 1;
  }
  return parsed;
}

function flagName(token) {
  if (!token.startsWith("--")) {
    throw new Error(`Expected --flag, got ${token}`);
  }
  return token.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function required(value, name) {
  if (value === undefined || value === "") {
    throw new Error(`Missing value for ${name}.`);
  }
  return value;
}

function printHelp() {
  console.log(`openwrite CLI

Commands:
  fast-write --root <dir> --path <file> --content-file <file> [--mode create|overwrite] [--expected-hash <sha256>]
  fast-apply --root <dir> --patch-file <file> [--strip <n>] [--expected-hashes-file <json>]
  doctor --root <dir> [--require-opencode-tools true]
`);
}

async function doctor(root, args) {
  const checks = [];
  await checkPath(checks, root, ".opencode/tools/fast_write.js");
  await checkPath(checks, root, ".opencode/tools/fast_apply.js");
  await checkPath(checks, root, ".opencode/tools/openwrite_doctor.js");
  await checkPath(checks, root, ".opencode/tools/openwrite_install.js");
  await checkPath(checks, root, ".opencode/tools/openwrite_smoke.js");
  await checkPath(checks, root, ".opencode/tools/openwrite_make_offline_bundle.js");
  await checkPath(checks, root, ".opencode/tools/openwrite_verify_offline_bundle.js");
  await checkPath(checks, root, ".opencode/commands/openwrite.md");
  await checkPath(checks, root, ".opencode/commands/openwrite-doctor.md");
  await checkPath(checks, root, ".opencode/commands/openwrite-smoke.md");
  await checkPath(checks, root, ".opencode/commands/openwrite-offline-bundle.md");
  await checkPath(checks, root, ".opencode/agents/openwrite-operator.md");
  await checkPath(checks, root, ".opencode/agents/openwrite-reviewer.md");
  await checkPath(checks, root, ".opencode/openwrite/bin/openwrite.mjs");
  await checkPath(checks, root, ".opencode/openwrite/lib/openwrite-core.mjs");
  await checkPath(checks, root, ".opencode/openwrite/lib/workspace-safety.mjs");
  await checkPath(checks, root, ".opencode/openwrite/lib/hash-io.mjs");
  await checkPath(checks, root, ".opencode/openwrite/lib/git-helpers.mjs");
  await checkPath(checks, root, ".opencode/openwrite/scripts/doctor.ps1");
  await checkPath(checks, root, ".opencode/openwrite/scripts/install.ps1");
  await checkPath(checks, root, ".opencode/openwrite/scripts/smoke.ps1");
  await checkPath(checks, root, ".opencode/openwrite/scripts/prepare-tools.ps1");
  await checkPath(checks, root, ".opencode/openwrite/scripts/make-offline-bundle.ps1");
  await checkPath(checks, root, ".opencode/openwrite/scripts/verify-offline-bundle.ps1");
  await checkAnyPath(checks, root, "doc:readme", ["OPENWRITE.md", "README.md"]);
  await checkAnyPath(checks, root, "doc:manifest", [".opencode/openwrite/MANIFEST.json", "MANIFEST.json"]);
  const git = await commandCheck("git", ["--version"]);
  checks.push(git);
  const node = await commandCheck("node", ["--version"]);
  checks.push(node);
  const opencode = await commandCheck("opencode", ["--version"], true);
  checks.push(opencode);
  const requireOpenCodeTools = args.requireOpencodeTools === "true";
  const hasFail = checks.some((check) => check.status === "fail");
  const hasWarn = checks.some((check) => check.status === "warn");
  const status = hasFail || (requireOpenCodeTools && opencode.status !== "ok") ? "fail" : hasWarn ? "warn" : "ok";
  return { ok: status !== "fail", operation: "doctor", status, root, checks };
}

async function checkPath(checks, root, relative) {
  try {
    await fs.access(path.join(root, relative));
    checks.push({ name: `file:${relative}`, status: "ok" });
  } catch {
    checks.push({ name: `file:${relative}`, status: "fail", detail: "missing" });
  }
}

async function checkAnyPath(checks, root, name, relatives) {
  for (const relative of relatives) {
    try {
      await fs.access(path.join(root, relative));
      checks.push({ name, status: "ok", detail: relative });
      return;
    } catch {
      // Try next accepted location.
    }
  }
  checks.push({ name, status: "fail", detail: `missing one of: ${relatives.join(", ")}` });
}

function commandCheck(command, args, optional = false) {
  return new Promise((resolve) => {
    const child = import("node:child_process").then(({ spawn }) => {
      const spawned = spawn(command, args, { shell: false, windowsHide: true });
      let output = "";
      spawned.stdout.on("data", (chunk) => {
        output += chunk.toString("utf8");
      });
      spawned.stderr.on("data", (chunk) => {
        output += chunk.toString("utf8");
      });
      spawned.on("error", (error) => {
        resolve({ name: `tool:${command}`, status: optional ? "warn" : "fail", detail: error.message });
      });
      spawned.on("close", (code) => {
        resolve({
          name: `tool:${command}`,
          status: code === 0 ? "ok" : optional ? "warn" : "fail",
          detail: output.trim().slice(0, 300),
        });
      });
    });
    child.catch((error) => resolve({ name: `tool:${command}`, status: "fail", detail: error.message }));
  });
}
