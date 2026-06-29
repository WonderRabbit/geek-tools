import fs from "node:fs";
import path from "node:path";
import { EstimateError } from "./errors.mjs";

function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function existingAncestor(target) {
  let current = target;
  while (!fs.existsSync(current)) {
    const next = path.dirname(current);
    if (next === current) {
      return current;
    }
    current = next;
  }
  return current;
}

export function resolveRoot(rootCandidate) {
  const root = path.resolve(rootCandidate);
  if (!fs.existsSync(root)) {
    throw new EstimateError("E_ROOT_MISSING", `Root does not exist: ${root}`);
  }
  return fs.realpathSync(root);
}

export function resolveSafePath(root, candidate, label = "path") {
  if (!candidate || typeof candidate !== "string") {
    throw new EstimateError("E_PATH_MISSING", `Missing ${label}`);
  }

  const realRoot = resolveRoot(root);
  const absolute = path.resolve(realRoot, candidate);
  if (!isWithin(realRoot, absolute)) {
    throw new EstimateError("E_PATH_ESCAPE", `${label} escapes root: ${candidate}`);
  }

  const ancestor = fs.realpathSync(existingAncestor(absolute));
  if (!isWithin(realRoot, ancestor)) {
    throw new EstimateError("E_PATH_ESCAPE", `${label} escapes root through realpath: ${candidate}`);
  }

  if (fs.existsSync(absolute)) {
    const realTarget = fs.realpathSync(absolute);
    if (!isWithin(realRoot, realTarget)) {
      throw new EstimateError("E_PATH_ESCAPE", `${label} escapes root through symlink: ${candidate}`);
    }
    return realTarget;
  }

  return absolute;
}

export function ensureParentDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}
