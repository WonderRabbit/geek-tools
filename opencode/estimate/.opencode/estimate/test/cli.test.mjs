import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { makeTempDir, run } from "./helpers.mjs";

test("--help lists every command", () => {
  const result = run(["--help"]);
  assert.equal(result.status, 0);
  for (const command of [
    "doctor",
    "intake",
    "split",
    "packet",
    "flow-align",
    "classify",
    "reference-class",
    "estimate",
    "render",
    "review",
    "calibrate",
  ]) {
    assert.match(result.stdout, new RegExp(`\\b${command}\\b`));
  }
});

test("fixture can run through estimate and render", (t) => {
  const estimateResult = run(["estimate", "--fixture", "legacy-sample"]);
  assert.equal(estimateResult.status, 0, estimateResult.stderr);
  const estimateDoc = JSON.parse(estimateResult.stdout);
  assert.equal(estimateDoc.kind, "estimate.estimate");
  assert.match(estimateDoc.work_classification.class, /^(simple_large_change|complex_small_change|complex_large_change|simple_small_change)$/);
  assert.ok(estimateDoc.effort_hours.p50 > 0);
  assert.ok(estimateDoc.effort_hours.p95 >= estimateDoc.effort_hours.p80);
  assert.ok(estimateDoc.duration_days.p80 > 0);
  assert.ok(estimateDoc.evidence_refs.length > 0);
  assert.ok(estimateDoc.source_evidence_refs.length > 0);
  assert.ok(estimateDoc.flow_evidence_refs.length > 0);

  const tmp = makeTempDir(t);
  const input = path.join(tmp, "estimate.json");
  fs.writeFileSync(input, estimateResult.stdout);
  const renderResult = run(["render", "--root", tmp, "--input", "estimate.json"]);
  assert.equal(renderResult.status, 0, renderResult.stderr);
  assert.match(renderResult.stdout, /^# OpenCode Qwen estimator CLI core/m);
  assert.match(renderResult.stdout, /P50h/);
});

test("out paths fail closed when they escape root", (t) => {
  const tmp = makeTempDir(t);
  const escapePath = path.resolve(tmp, `../estimate-cli-escape-${process.pid}.json`);
  fs.rmSync(escapePath, { force: true });
  const result = run(["intake", "--root", tmp, "--fixture", "legacy-sample", "--out", path.basename(escapePath)]);
  assert.equal(result.status, 0, result.stderr);

  const escapeResult = run([
    "intake",
    "--root",
    tmp,
    "--fixture",
    "legacy-sample",
    "--out",
    `../${path.basename(escapePath)}`,
  ]);
  assert.equal(escapeResult.status, 1);
  const error = JSON.parse(escapeResult.stderr);
  assert.equal(error.code, "E_PATH_ESCAPE");
  assert.equal(fs.existsSync(escapePath), false);
});

test("input paths fail closed when they escape root", (t) => {
  const tmp = makeTempDir(t);
  const escapePath = path.resolve(tmp, `../estimate-cli-input-${process.pid}.json`);
  fs.writeFileSync(escapePath, "{}");
  const result = run(["intake", "--root", tmp, "--input", `../${path.basename(escapePath)}`]);
  assert.equal(result.status, 1);
  const error = JSON.parse(result.stderr);
  assert.equal(error.code, "E_PATH_ESCAPE");
  fs.rmSync(escapePath, { force: true });
});

test("invalid JSON errors are bounded", (t) => {
  const tmp = makeTempDir(t);
  fs.writeFileSync(path.join(tmp, "bad.json"), `{"a":"${"x".repeat(5000)}`);
  const result = run(["intake", "--root", tmp, "--input", "bad.json"]);
  assert.equal(result.status, 1);
  assert.ok(result.stderr.length < 500);
  const error = JSON.parse(result.stderr);
  assert.equal(error.code, "E_JSON_PARSE");
});

test("doctor reports dependency-free runtime checks", () => {
  const result = run(["doctor"]);
  assert.equal(result.status, 0, result.stderr);
  const doc = JSON.parse(result.stdout);
  assert.equal(doc.kind, "estimate.doctor");
  assert.equal(doc.ok, true);
  assert.equal(doc.dependencyFree, true);
  assert.equal(doc.fixturePresent, true);
});

test("calibrate emits current schema field names", (t) => {
  const tmp = makeTempDir(t);
  const estimateResult = run(["estimate", "--fixture", "legacy-sample"]);
  assert.equal(estimateResult.status, 0, estimateResult.stderr);
  fs.writeFileSync(path.join(tmp, "estimate.json"), estimateResult.stdout);

  const calibrateResult = run(["calibrate", "--root", tmp, "--input", "estimate.json", "--actual-hours", "30"]);
  assert.equal(calibrateResult.status, 0, calibrateResult.stderr);
  const doc = JSON.parse(calibrateResult.stdout);
  assert.equal(doc.kind, "estimate.calibration");
  assert.equal(doc.intakeId, "opencode-qwen-estimator-cli-core-071eaa06afca");
  assert.equal(doc.actual_hours, 30);
  assert.ok(doc.estimate_hours_p50 > 0);
  assert.ok(doc.estimate_hours_p80 >= doc.estimate_hours_p50);
  assert.ok(doc.error_ratio > 0);
});
