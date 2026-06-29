import crypto from "node:crypto";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import { boundedGitDiff, extractPatchPaths, runGit, stripArgs } from "./git-helpers.mjs";
import { fsyncDirectory, sha256File } from "./hash-io.mjs";
import { assertParentInsideRoot, pathExists, realRoot, resolveWorkspacePath } from "./workspace-safety.mjs";

const DEFAULT_MAX_EVIDENCE_BYTES = 8192;

export async function fastWrite(root, input) {
  try {
    const rootReal = await realRoot(root);
    const target = await resolveWorkspacePath(rootReal, input.path, { allowMissing: true });
    const mode = input.mode ?? "overwrite";
    if (mode !== "create" && mode !== "overwrite") {
      return fail("fast_write", input.path, "invalid_mode", "mode must be create or overwrite.");
    }

    const exists = await pathExists(target.absolute);
    if (mode === "create" && exists) {
      return fail("fast_write", input.path, "file_exists", "Use mode=overwrite or choose a new path.");
    }
    if (input.expectedHash) {
      if (!exists) {
        return fail("fast_write", input.path, "expected_hash_target_missing", "Read the file again and retry without expectedHash for new files.");
      }
      const currentHash = await sha256File(target.absolute);
      if (currentHash !== input.expectedHash.toLowerCase()) {
        return fail("fast_write", input.path, "expected_hash_mismatch", "Read the file again and retry with the new expectedHash.");
      }
    }

    await fs.mkdir(path.dirname(target.absolute), { recursive: true });
    await assertParentInsideRoot(rootReal, target.absolute);
    const temp = path.join(
      path.dirname(target.absolute),
      `.${path.basename(target.absolute)}.openwrite-${process.pid}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.tmp`,
    );
    const content = String(input.content ?? "");
    const fsync = input.fsync !== false;
    const handle = await fs.open(temp, "w", 0o666);
    try {
      await handle.writeFile(content, "utf8");
      if (fsync) {
        await handle.sync();
      }
    } finally {
      await handle.close();
    }
    await fs.rename(temp, target.absolute);
    if (fsync) {
      await fsyncDirectory(path.dirname(target.absolute));
    }
    const finalHash = await sha256File(target.absolute);
    const stats = await fs.stat(target.absolute);
    return {
      ok: true,
      operation: "fast_write",
      path: target.relative,
      bytes: stats.size,
      sha256: finalHash,
      created: !exists,
      verified: true,
    };
  } catch (error) {
    return fail("fast_write", input?.path ?? "", error.code ?? "write_failed", error.message);
  }
}

export async function fastApply(root, input) {
  const patch = String(input.patch ?? "");
  const maxEvidenceBytes = positiveInteger(input.maxEvidenceBytes, DEFAULT_MAX_EVIDENCE_BYTES);
  try {
    const rootReal = await realRoot(root);
    if (!patch.trim()) {
      return fail("fast_apply", "", "empty_patch", "Provide a unified diff patch.");
    }
    const paths = extractPatchPaths(patch, input.strip ?? 1);
    if (paths.length === 0) {
      return fail("fast_apply", "", "no_patch_paths", "No file paths were found in the patch.");
    }
    const resolved = [];
    for (const patchPath of paths) {
      resolved.push(await resolveWorkspacePath(rootReal, patchPath, { allowMissing: true }));
    }
    const expectedHashes = input.expectedHashes ?? {};
    for (const [relative, expected] of Object.entries(expectedHashes)) {
      const target = await resolveWorkspacePath(rootReal, relative, { allowMissing: false });
      const actual = await sha256File(target.absolute);
      if (actual !== String(expected).toLowerCase()) {
        return fail("fast_apply", relative, "expected_hash_mismatch", "Read the file again and retry with the new expectedHashes entry.");
      }
    }

    const check = await runGit(rootReal, ["apply", "--check", ...stripArgs(input.strip)], patch, maxEvidenceBytes);
    if (check.exitCode !== 0) {
      return {
        ok: false,
        operation: "fast_apply",
        error: "git_apply_check_failed",
        paths: resolved.map((item) => item.relative),
        exitCode: check.exitCode,
        stderr: check.stderr,
        stdout: check.stdout,
      };
    }
    const apply = await runGit(rootReal, ["apply", ...stripArgs(input.strip)], patch, maxEvidenceBytes);
    if (apply.exitCode !== 0) {
      return {
        ok: false,
        operation: "fast_apply",
        error: "git_apply_failed_after_check",
        paths: resolved.map((item) => item.relative),
        exitCode: apply.exitCode,
        stderr: apply.stderr,
        stdout: apply.stdout,
      };
    }
    const hashes = {};
    for (const item of resolved) {
      if (await pathExists(item.absolute)) {
        hashes[item.relative] = await sha256File(item.absolute);
      }
    }
    const stat = await boundedGitDiff(rootReal, resolved.map((item) => item.relative), maxEvidenceBytes);
    return {
      ok: true,
      operation: "fast_apply",
      paths: resolved.map((item) => item.relative),
      hashes,
      evidence: stat,
      verified: true,
    };
  } catch (error) {
    return fail("fast_apply", "", error.code ?? "apply_failed", error.message);
  }
}

function positiveInteger(value, fallback) {
  if (value === undefined || value === null) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 256) {
    return fallback;
  }
  return parsed;
}

function fail(operation, targetPath, error, hint) {
  return { ok: false, operation, path: targetPath, error, hint };
}

export function tempRoot(prefix = "openwrite-") {
  return fsSync.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export { sha256File };
