import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { makeTempDir, run } from "./helpers.mjs";

test("review fails closed when evidence is empty", (t) => {
  const tmp = makeTempDir(t);
  const estimatePath = path.join(tmp, "bad-estimate.json");
  fs.writeFileSync(estimatePath, JSON.stringify({
    kind: "estimate.estimate",
    intakeId: "bad",
    title: "Bad estimate",
    work_classification: {
      class: "simple_small_change",
      modifier_dimensions: {
        functional_size: "small",
        coupling: "module",
        uncertainty: "clear",
        verification_burden: "normal",
        reversibility: "easy",
        developer_familiarity: "high",
        mechanical_repetition: "none",
      },
    },
    effort_hours: { p50: 1, p80: 2, p95: 3 },
    duration_days: { p50: 0.2, p80: 0.4, p95: 0.5 },
    confidence: "medium",
    evidence_refs: [],
    assumptions: [],
    missing_info: [],
    status: "draft",
  }));
  const result = run(["review", "--root", tmp, "--input", "bad-estimate.json"]);
  assert.equal(result.status, 2, result.stderr);
  const reviewDoc = JSON.parse(result.stdout);
  assert.equal(reviewDoc.ok, false);
  assert.equal(reviewDoc.status, "blocked");
  assert.ok(reviewDoc.findings.some((item) => item.code === "insufficient_evidence"));
});

test("failure fixture is accepted by review command and exits blocked", () => {
  const result = run(["review", "--fixture", "failure-empty-evidence"]);
  assert.equal(result.status, 2, result.stderr);
  const reviewDoc = JSON.parse(result.stdout);
  assert.equal(reviewDoc.ok, false);
  assert.equal(reviewDoc.status, "blocked");
  assert.ok(reviewDoc.findings.some((item) => item.code === "insufficient_evidence"));
});

test("review fails when requirements exist but source and flow evidence are missing", (t) => {
  const tmp = makeTempDir(t);
  fs.writeFileSync(path.join(tmp, "request.json"), JSON.stringify({
    title: "Requirement-only request",
    goals: ["Change behavior"],
    acceptance: ["It works"],
    files: [],
    flows: [],
  }));
  const estimateResult = run(["estimate", "--root", tmp, "--input", "request.json"]);
  assert.equal(estimateResult.status, 0, estimateResult.stderr);
  const estimateDoc = JSON.parse(estimateResult.stdout);
  assert.equal(estimateDoc.status, "insufficient_evidence");
  assert.ok(estimateDoc.evidence_refs.some((item) => item.startsWith("requirement:")));

  fs.writeFileSync(path.join(tmp, "estimate.json"), estimateResult.stdout);
  const reviewResult = run(["review", "--root", tmp, "--input", "estimate.json"]);
  assert.equal(reviewResult.status, 2, reviewResult.stderr);
  const reviewDoc = JSON.parse(reviewResult.stdout);
  assert.ok(reviewDoc.findings.some((item) => item.code === "missing_source_evidence"));
  assert.ok(reviewDoc.findings.some((item) => item.code === "missing_flow_evidence"));
});

test("review rejects forged source and flow refs that are only requirements", (t) => {
  const tmp = makeTempDir(t);
  fs.writeFileSync(path.join(tmp, "forged.json"), JSON.stringify({
    kind: "estimate.estimate",
    intakeId: "forged",
    title: "Forged estimate",
    work_classification: {
      class: "simple_small_change",
      source_flow_alignment_status: "mapped",
      modifier_dimensions: {
        functional_size: "small",
        coupling: "module",
        uncertainty: "clear",
        verification_burden: "normal",
        reversibility: "easy",
        developer_familiarity: "high",
        mechanical_repetition: "none",
      },
    },
    effort_hours: { p50: 1, p80: 2, p95: 3 },
    duration_days: { p50: 0.2, p80: 0.4, p95: 0.5 },
    confidence: "medium",
    evidence_refs: ["requirement:REQ-001"],
    source_evidence_refs: ["requirement:REQ-001"],
    flow_evidence_refs: ["requirement:REQ-001"],
    status: "draft",
  }));
  const result = run(["review", "--root", tmp, "--input", "forged.json"]);
  assert.equal(result.status, 2, result.stderr);
  const reviewDoc = JSON.parse(result.stdout);
  assert.ok(reviewDoc.findings.some((item) => item.code === "missing_source_evidence"));
  assert.ok(reviewDoc.findings.some((item) => item.code === "missing_flow_evidence"));
});

test("classify requires every packet to have both source and flow evidence", (t) => {
  const tmp = makeTempDir(t);
  fs.writeFileSync(path.join(tmp, "packet.json"), JSON.stringify({
    kind: "estimate.packet",
    version: 1,
    intakeId: "mixed",
    title: "Mixed evidence",
    developerProfile: { subsystem_familiarity: "high" },
    calibrationExamples: [],
    constraints: [],
    risks: [],
    packets: [
      {
        feature_id: "F001",
        title: "source only",
        impacted_files: [{ path: "src/a.ts", reason: "source" }],
        source_evidence_refs: ["file:src/a.ts"],
        flow_evidence_refs: [],
        evidence_refs: ["file:src/a.ts", "requirement:REQ-001"],
        data_flow_edges: [],
        symbols: [],
        tests: [],
        configs: [],
        unknowns: ["flow evidence"],
        business_flow_refs: [],
      },
      {
        feature_id: "F002",
        title: "flow only",
        impacted_files: [],
        source_evidence_refs: [],
        flow_evidence_refs: ["flow:BF-001"],
        evidence_refs: ["flow:BF-001", "requirement:REQ-002"],
        data_flow_edges: [{ ref: "BF-001" }],
        symbols: [],
        tests: [],
        configs: [],
        unknowns: ["source evidence"],
        business_flow_refs: ["BF-001"],
      },
    ],
  }));
  const classifyResult = run(["classify", "--root", tmp, "--input", "packet.json"]);
  assert.equal(classifyResult.status, 0, classifyResult.stderr);
  const classifyDoc = JSON.parse(classifyResult.stdout);
  assert.equal(classifyDoc.source_flow_alignment_status, "partial");
  assert.deepEqual(classifyDoc.packet_evidence_statuses.map((item) => [item.feature_id, item.has_source, item.has_flow]), [
    ["F001", true, false],
    ["F002", false, true],
  ]);
});

test("documented flow-align to classify sequence preserves evidence", (t) => {
  const tmp = makeTempDir(t);
  const packetResult = run(["packet", "--fixture", "legacy-sample"]);
  assert.equal(packetResult.status, 0, packetResult.stderr);
  fs.writeFileSync(path.join(tmp, "packet.json"), packetResult.stdout);

  const flowResult = run(["flow-align", "--root", tmp, "--input", "packet.json", "--out", "flow.json"]);
  assert.equal(flowResult.status, 0, flowResult.stderr);
  const classifyResult = run(["classify", "--root", tmp, "--input", "flow.json"]);
  assert.equal(classifyResult.status, 0, classifyResult.stderr);
  const classifyDoc = JSON.parse(classifyResult.stdout);
  assert.equal(classifyDoc.source_flow_alignment_status, "mapped");
  assert.ok(classifyDoc.source_evidence_refs.length > 0);
  assert.ok(classifyDoc.flow_evidence_refs.length > 0);
});
