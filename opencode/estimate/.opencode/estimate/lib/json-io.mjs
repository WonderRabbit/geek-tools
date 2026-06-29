import fs from "node:fs";
import { EstimateError, toBoundedString } from "./errors.mjs";
import { ensureParentDirectory } from "./path-safety.mjs";

export const DEFAULT_MAX_JSON_BYTES = 1_000_000;

export function readTextFileBounded(filePath, maxBytes = DEFAULT_MAX_JSON_BYTES) {
  const stat = fs.statSync(filePath);
  if (stat.size > maxBytes) {
    throw new EstimateError("E_JSON_TOO_LARGE", `JSON input is ${stat.size} bytes, max is ${maxBytes}`);
  }
  return fs.readFileSync(filePath, "utf8");
}

export function readJsonBounded(filePath, maxBytes = DEFAULT_MAX_JSON_BYTES) {
  const text = readTextFileBounded(filePath, maxBytes);
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new EstimateError("E_JSON_PARSE", `Invalid JSON in ${filePath}: ${toBoundedString(error.message, 160)}`);
  }
}

export function writeTextFile(filePath, text) {
  ensureParentDirectory(filePath);
  fs.writeFileSync(filePath, text, "utf8");
}

export function writeJsonFile(filePath, value, pretty = true) {
  const text = `${JSON.stringify(value, null, pretty ? 2 : 0)}\n`;
  writeTextFile(filePath, text);
}

export function stableJson(value) {
  return JSON.stringify(sortStable(value));
}

function sortStable(value) {
  if (Array.isArray(value)) {
    return value.map(sortStable);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, sortStable(nested)]),
    );
  }
  return value;
}
