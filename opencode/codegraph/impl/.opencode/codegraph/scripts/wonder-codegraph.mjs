#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import { resolveCodeGraph } from "./resolve-codegraph.mjs"

const DEFAULT_MANIFEST = ".opencode/codegraph/repo-link-manifest.json"
const EXAMPLE_MANIFEST = ".opencode/codegraph/examples/repo-link-manifest.json"

function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg.startsWith("--")) {
      out._.push(arg)
      continue
    }
    const key = arg.slice(2)
    if (key === "json") {
      out.json = true
      continue
    }
    out[key] = argv[i + 1]
    i += 1
  }
  return out
}

function readManifest(manifestPath) {
  const resolved = path.resolve(process.cwd(), manifestPath)
  if (!fs.existsSync(resolved)) {
    return { ok: false, path: resolved, error: `manifest not found: ${manifestPath}` }
  }
  try {
    const data = JSON.parse(fs.readFileSync(resolved, "utf8"))
    return { ok: true, path: resolved, data }
  } catch (error) {
    return { ok: false, path: resolved, error: `manifest JSON parse failed: ${error.message}` }
  }
}

function findManifest(args) {
  if (args.manifest) return args.manifest
  if (fs.existsSync(path.resolve(process.cwd(), DEFAULT_MANIFEST))) return DEFAULT_MANIFEST
  return EXAMPLE_MANIFEST
}

function codegraphStatus() {
  const resolved = resolveCodeGraph(process.cwd())
  return {
    available: resolved.ok,
    source: resolved.source,
    command: resolved.command,
    version: resolved.version,
    status: resolved.status,
    stderr: resolved.stderr,
    error: resolved.ok ? undefined : resolved.message,
  }
}

function repoRows(manifest) {
  const frontend = manifest.repositories?.frontend ? [manifest.repositories.frontend] : []
  const backends = Array.isArray(manifest.repositories?.backends) ? manifest.repositories.backends : []
  return [...frontend, ...backends]
}

function repoCheck(repo) {
  const repoPath = path.resolve(process.cwd(), repo.path || "")
  const indexPath = path.resolve(process.cwd(), repo.codegraphIndex || path.join(repo.path || "", ".codegraph"))
  return {
    id: repo.id,
    kind: repo.kind,
    framework: repo.framework || "unknown",
    path: repo.path,
    pathExists: fs.existsSync(repoPath),
    codegraphIndex: repo.codegraphIndex || `${repo.path}/.codegraph`,
    codegraphIndexExists: fs.existsSync(indexPath),
    contracts: repo.contracts || [],
    runtime: repo.runtime || [],
    tests: repo.tests || [],
  }
}

function renderDoctor(payload) {
  const lines = ["# CodeGraph evidence doctor", ""]
  lines.push(`CodeGraph CLI: ${payload.codegraph.available ? "available" : "missing"}`)
  lines.push(`Manifest: ${payload.manifest.ok ? payload.manifest.path : payload.manifest.error}`)
  lines.push("")
  lines.push("| repo | kind | framework | path | index | status |")
  lines.push("|---|---|---|---|---|---|")
  for (const repo of payload.repositories) {
    const status = repo.pathExists && repo.codegraphIndexExists ? "ready" : "check"
    lines.push(`| ${repo.id} | ${repo.kind} | ${repo.framework} | ${repo.pathExists ? repo.path : `${repo.path} missing`} | ${repo.codegraphIndexExists ? repo.codegraphIndex : `${repo.codegraphIndex} missing`} | ${status} |`)
  }
  if (!payload.manifest.ok) {
    lines.push("")
    lines.push(`Copy ${EXAMPLE_MANIFEST} to ${DEFAULT_MANIFEST}, then edit repository paths.`)
  }
  return lines.join("\n")
}

function renderRepoMap(payload) {
  const lines = ["# CodeGraph repo map", ""]
  lines.push("| repo | kind | framework | path | contracts | runtime | tests |")
  lines.push("|---|---|---|---|---|---|---|")
  for (const repo of payload.repositories) {
    lines.push(`| ${repo.id} | ${repo.kind} | ${repo.framework} | ${repo.path} | ${repo.contracts.length} | ${repo.runtime.length} | ${repo.tests.length} |`)
  }
  return lines.join("\n")
}

function buildImpactPacket(manifestResult, target) {
  const repositories = manifestResult.ok ? repoRows(manifestResult.data).map(repoCheck) : []
  const hasContracts = repositories.some((repo) => repo.contracts.length > 0)
  const hasRuntimeOrTests = repositories.some((repo) => repo.runtime.length > 0 || repo.tests.length > 0)
  const confidence = hasContracts && hasRuntimeOrTests ? "medium" : hasContracts ? "low" : "unresolved"
  return {
    target,
    confidence,
    manifest: manifestResult.ok ? manifestResult.path : manifestResult.error,
    staticEvidence: [
      "Use CodeGraph MCP or codegraph CLI to resolve frontend symbol, backend route, callers, and affected tests.",
    ],
    contractEvidence: repositories.flatMap((repo) => repo.contracts.map((artifact) => ({
      repo: repo.id,
      kind: artifact.kind,
      path: artifact.path,
    }))),
    runtimeOrTestEvidence: repositories.flatMap((repo) => [...repo.runtime, ...repo.tests].map((artifact) => ({
      repo: repo.id,
      kind: artifact.kind,
      path: artifact.path,
    }))),
    recommendedNextAction: confidence === "medium"
      ? "Run CodeGraph symbol/route lookup, then confirm one formal contract match before patch planning."
      : "Do not patch yet. Add contract/runtime/test evidence or fix the manifest first.",
  }
}

function renderImpactPacket(packet) {
  const lines = ["# CodeGraph impact packet", ""]
  lines.push(`Target: ${packet.target}`)
  lines.push(`Confidence: ${packet.confidence}`)
  lines.push(`Manifest: ${packet.manifest}`)
  lines.push("")
  lines.push("## Static evidence")
  for (const item of packet.staticEvidence) lines.push(`- ${item}`)
  lines.push("")
  lines.push("## Contract evidence")
  if (packet.contractEvidence.length === 0) lines.push("- none")
  for (const item of packet.contractEvidence) lines.push(`- ${item.repo}: ${item.kind} ${item.path}`)
  lines.push("")
  lines.push("## Runtime/test evidence")
  if (packet.runtimeOrTestEvidence.length === 0) lines.push("- none")
  for (const item of packet.runtimeOrTestEvidence) lines.push(`- ${item.repo}: ${item.kind} ${item.path}`)
  lines.push("")
  lines.push(`Recommended next action: ${packet.recommendedNextAction}`)
  return lines.join("\n")
}

function main() {
  const [command, ...rest] = process.argv.slice(2)
  const args = parseArgs(rest)
  const manifestPath = findManifest(args)
  const manifest = readManifest(manifestPath)

  if (command === "doctor") {
    const payload = {
      codegraph: codegraphStatus(),
      manifest,
      repositories: manifest.ok ? repoRows(manifest.data).map(repoCheck) : [],
    }
    console.log(args.json ? JSON.stringify(payload, null, 2) : renderDoctor(payload))
    return
  }

  if (command === "repo-map") {
    if (!manifest.ok) {
      console.error(manifest.error)
      process.exit(1)
    }
    const payload = { manifest: manifest.path, repositories: repoRows(manifest.data).map(repoCheck) }
    console.log(args.json ? JSON.stringify(payload, null, 2) : renderRepoMap(payload))
    return
  }

  if (command === "impact-packet") {
    if (!args.target) {
      console.error("--target is required")
      process.exit(1)
    }
    const packet = buildImpactPacket(manifest, args.target)
    console.log(args.json ? JSON.stringify(packet, null, 2) : renderImpactPacket(packet))
    return
  }

  console.error("usage: wonder-codegraph.mjs <doctor|repo-map|impact-packet> [--manifest path] [--target value] [--json]")
  process.exit(1)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export {
  buildImpactPacket,
  codegraphStatus,
  findManifest,
  parseArgs,
  readManifest,
  renderDoctor,
  renderImpactPacket,
  renderRepoMap,
  repoCheck,
  repoRows,
}
