import crypto from "node:crypto";
import { stableJson } from "./json-io.mjs";

export const VERSION = 1;
export const MODIFIER_KEYS = [
  "functional_size",
  "coupling",
  "uncertainty",
  "verification_burden",
  "reversibility",
  "developer_familiarity",
  "mechanical_repetition",
];

export function asArray(value) {
  if (Array.isArray(value)) return value.filter((item) => item !== undefined && item !== null);
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

export function asText(value, fallback = "") {
  if (typeof value === "string") return value.trim();
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

export function shortHash(value) {
  return crypto.createHash("sha256").update(stableJson(value)).digest("hex").slice(0, 12);
}

export function slug(value) {
  return asText(value, "untitled")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42) || "untitled";
}

export function round(value) {
  return Math.round(value * 10) / 10;
}

export function isSourceEvidenceRef(ref) {
  return typeof ref === "string" && ref.startsWith("file:") && ref.length > "file:".length;
}

export function isFlowEvidenceRef(ref) {
  return typeof ref === "string" && ref.startsWith("flow:") && ref.length > "flow:".length;
}

export function invalidSourceEvidenceRefs(refs) {
  return asArray(refs).filter((ref) => !isSourceEvidenceRef(ref));
}

export function invalidFlowEvidenceRefs(refs) {
  return asArray(refs).filter((ref) => !isFlowEvidenceRef(ref));
}
