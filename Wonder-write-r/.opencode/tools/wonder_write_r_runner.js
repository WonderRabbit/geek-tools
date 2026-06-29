import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function resolveRoot(context) {
  return (
    context?.project?.root ??
    context?.session?.directory ??
    context?.worktree ??
    context?.cwd ??
    process.cwd()
  );
}

export function runWonderWriteR(args) {
  const executable = process.env.WONDER_WRITE_R_EXE ?? defaultExecutable();
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { shell: false, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", () => {
      resolve(stdout.trim() || JSON.stringify({ ok: false, error: "empty_output", stderr: stderr.slice(0, 8000) }));
    });
  });
}

function defaultExecutable() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const extension = process.platform === "win32" ? ".exe" : "";
  return path.resolve(here, "..", "bin", `wonder-write-r${extension}`);
}
