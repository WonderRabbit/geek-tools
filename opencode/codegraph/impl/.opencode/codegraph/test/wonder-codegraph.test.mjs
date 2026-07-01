import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import {
  buildImpactPacket,
  parseArgs,
  readManifest,
  repoRows,
} from "../scripts/wonder-codegraph.mjs"
import { resolveCodeGraph } from "../scripts/resolve-codegraph.mjs"

const fixtureManifestPath = path.resolve(import.meta.dirname, "../examples/repo-link-manifest.json")

test("parseArgs reads flags and positional values", () => {
  const parsed = parseArgs(["impact-packet", "--target", "OrderPage", "--json"])
  assert.deepEqual(parsed, { _: ["impact-packet"], target: "OrderPage", json: true })
})

test("readManifest returns an explicit missing-manifest error", () => {
  const result = readManifest("missing-repo-link-manifest.json")
  assert.equal(result.ok, false)
  assert.match(result.error, /manifest not found/)
})

test("repoRows combines the frontend and every backend", () => {
  const result = readManifest(fixtureManifestPath)
  assert.equal(result.ok, true)
  const rows = repoRows(result.data)
  assert.deepEqual(rows.map((repo) => repo.id), ["frontend-web", "order-service", "billing-service"])
})

test("impact packet stays bounded and does not recommend patching below high confidence", () => {
  const result = readManifest(fixtureManifestPath)
  assert.equal(result.ok, true)
  const packet = buildImpactPacket(result, "OrderPage")
  assert.equal(packet.confidence, "medium")
  assert.match(packet.recommendedNextAction, /confirm one formal contract match/)
  assert.equal(packet.contractEvidence.length, 3)
})

test("resolver reports missing runtime clearly when PATH and local candidates are absent", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codegraph-missing-"))
  const originalPath = process.env.PATH
  const originalBin = process.env.CODEGRAPH_BIN
  try {
    process.env.PATH = "/usr/bin:/bin"
    process.env.CODEGRAPH_BIN = path.join(tempRoot, "missing-codegraph")
    const resolved = resolveCodeGraph(tempRoot)
    assert.equal(resolved.ok, false)
    assert.match(resolved.message, /install a bundle/)
  } finally {
    process.env.PATH = originalPath
    if (originalBin === undefined) {
      delete process.env.CODEGRAPH_BIN
    } else {
      process.env.CODEGRAPH_BIN = originalBin
    }
    fs.rmSync(tempRoot, { recursive: true, force: true })
  }
})
