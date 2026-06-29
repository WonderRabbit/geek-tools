import fs from "node:fs/promises";
import path from "node:path";

export async function realRoot(root) {
  const resolved = path.resolve(root || process.cwd());
  return fs.realpath(resolved);
}

export async function resolveWorkspacePath(rootReal, requested, options = {}) {
  if (!requested || typeof requested !== "string") {
    throw codeError("invalid_path", "Path must be a non-empty workspace-relative string.");
  }
  if (path.isAbsolute(requested)) {
    throw codeError("path_escapes_root", "Absolute paths are not allowed.");
  }
  const normalized = requested.replace(/\\/g, "/");
  if (normalized.split("/").includes("..")) {
    throw codeError("path_escapes_root", "Parent directory segments are not allowed.");
  }
  const absolute = path.resolve(rootReal, normalized);
  assertInside(rootReal, absolute);
  if (!options.allowMissing) {
    const real = await fs.realpath(absolute);
    assertInside(rootReal, real);
  }
  return { absolute, relative: toPortable(path.relative(rootReal, absolute)) };
}

export async function assertParentInsideRoot(rootReal, absolute) {
  const parent = path.dirname(absolute);
  await fs.mkdir(parent, { recursive: true });
  const parentReal = await fs.realpath(parent);
  assertInside(rootReal, parentReal);
}

export function assertInside(rootReal, absolute) {
  const relative = path.relative(rootReal, absolute);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    return;
  }
  throw codeError("path_escapes_root", "Path escapes the workspace root.");
}

export async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function codeError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function toPortable(value) {
  return value.split(path.sep).join("/");
}
