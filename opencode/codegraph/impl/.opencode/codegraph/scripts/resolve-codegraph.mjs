#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

function isExecutableCandidate(filePath) {
  return Boolean(filePath) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()
}

function candidates(root) {
  const localBin = path.join(root, ".opencode", "codegraph", "bin")
  const runtimeCurrent = path.join(root, ".opencode", "codegraph", "runtime", "current")
  const runtimeBin = path.join(runtimeCurrent, "bin")
  return [
    process.env.CODEGRAPH_BIN,
    path.join(localBin, process.platform === "win32" ? "codegraph.exe" : "codegraph"),
    path.join(localBin, "codegraph.cmd"),
    path.join(runtimeCurrent, process.platform === "win32" ? "codegraph.exe" : "codegraph"),
    path.join(runtimeCurrent, "codegraph.cmd"),
    path.join(runtimeBin, process.platform === "win32" ? "codegraph.cmd" : "codegraph"),
    path.join(runtimeBin, "codegraph.exe"),
    "codegraph",
  ].filter(Boolean)
}

function versionProbe(commandPath) {
  const isWindowsCommand = process.platform === "win32" && /\.(cmd|bat)$/i.test(commandPath)
  if (isWindowsCommand) {
    return spawnSync("cmd.exe", ["/d", "/s", "/c", `"${commandPath}" --version`], { encoding: "utf8", shell: false })
  }
  return spawnSync(commandPath, ["--version"], { encoding: "utf8", shell: false })
}

function resolveCodeGraph(root = process.cwd()) {
  for (const candidate of candidates(root)) {
    if (candidate === "codegraph") {
      const result = versionProbe(candidate)
      if (!result.error && result.status === 0) {
        return { ok: true, source: "PATH", command: candidate, version: result.stdout.trim() }
      }
      continue
    }

    const absolute = path.isAbsolute(candidate) ? candidate : path.resolve(root, candidate)
    if (!isExecutableCandidate(absolute)) continue
    const result = versionProbe(absolute)
    return {
      ok: result.status === 0,
      source: candidate === process.env.CODEGRAPH_BIN ? "CODEGRAPH_BIN" : candidate.includes(`${path.sep}runtime${path.sep}`) ? "runtime-bundle" : "local-bin",
      command: absolute,
      version: result.stdout.trim(),
      stderr: result.stderr.trim(),
      status: result.status,
    }
  }

  return {
    ok: false,
    source: "missing",
    command: null,
    message: "Set CODEGRAPH_BIN, place codegraph(.exe) under .opencode/codegraph/bin/, or install a bundle under .opencode/codegraph/runtime/current/.",
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const resolved = resolveCodeGraph()
  console.log(JSON.stringify(resolved, null, 2))
  process.exit(resolved.ok ? 0 : 1)
}

export { candidates, resolveCodeGraph }
