import { spawn } from "node:child_process";
import path from "node:path";
import { codeError, pathExists } from "./workspace-safety.mjs";

export function extractPatchPaths(patch, strip = 1) {
  const found = new Set();
  for (const line of patch.split(/\r?\n/)) {
    if (line.startsWith("diff --git ")) {
      const match = line.match(/^diff --git\s+a\/(.+?)\s+b\/(.+)$/);
      if (match) {
        addPatchPath(found, match[1], strip);
        addPatchPath(found, match[2], strip);
      }
      continue;
    }
    if (line.startsWith("--- ") || line.startsWith("+++ ")) {
      const raw = line.slice(4).trim().split(/\t/)[0];
      addPatchPath(found, raw, strip);
    }
  }
  return [...found].sort();
}

export function runGit(cwd, args, input, maxBytes) {
  return new Promise((resolve) => {
    const child = spawn("git", args, {
      cwd,
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout = boundedAppend(stdout, chunk, maxBytes);
    });
    child.stderr.on("data", (chunk) => {
      stderr = boundedAppend(stderr, chunk, maxBytes);
    });
    child.on("error", (error) => {
      resolve({ exitCode: 127, stdout: "", stderr: error.message });
    });
    child.on("close", (code) => {
      resolve({ exitCode: code ?? 1, stdout, stderr });
    });
    child.stdin.end(input);
  });
}

export async function boundedGitDiff(root, paths, maxBytes) {
  if (!(await pathExists(path.join(root, ".git")))) {
    return { kind: "hash_only", stdout: "", stderr: "" };
  }
  const result = await runGit(root, ["diff", "--stat", "--", ...paths], "", maxBytes);
  if (result.exitCode === 0) {
    return { kind: "git_diff_stat", stdout: result.stdout, stderr: result.stderr };
  }
  return { kind: "hash_only", stdout: "", stderr: result.stderr };
}

export function stripArgs(strip) {
  if (strip === undefined || strip === null) {
    return [];
  }
  const value = Number(strip);
  if (!Number.isInteger(value) || value < 0 || value > 9) {
    throw codeError("invalid_strip", "strip must be an integer from 0 to 9.");
  }
  return [`-p${value}`];
}

function addPatchPath(found, raw, strip) {
  if (!raw || raw === "/dev/null") {
    return;
  }
  let value = raw.replace(/\\/g, "/");
  if (value.startsWith("a/") || value.startsWith("b/")) {
    value = value.slice(2);
  } else if (strip > 0) {
    value = value.split("/").slice(strip).join("/");
  }
  if (value) {
    found.add(value);
  }
}

function boundedAppend(current, chunk, maxBytes) {
  const text = current + chunk.toString("utf8");
  if (Buffer.byteLength(text, "utf8") <= maxBytes) {
    return text;
  }
  return text.slice(0, maxBytes) + `\n...[truncated to ${maxBytes} bytes]`;
}
