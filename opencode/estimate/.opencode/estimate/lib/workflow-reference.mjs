import { classify } from "./workflow-classify.mjs";
import { asArray, round, VERSION } from "./workflow-utils.mjs";

export function referenceClass(value) {
  const classification = value?.kind === "estimate.classification" ? value : classify(value);
  const base = {
    simple_small_change: { p50: 4, p80: 7, p95: 10 },
    simple_large_change: { p50: 12, p80: 22, p95: 34 },
    complex_small_change: { p50: 14, p80: 28, p95: 44 },
    complex_large_change: { p50: 34, p80: 64, p95: 96 },
  }[classification.class] ?? { p50: 16, p80: 32, p95: 48 };
  const samples = asArray(classification.calibrationExamples).filter((sample) => !sample.workClass || sample.workClass === classification.class);
  const calibrationFactor = samples.length > 0
    ? Math.max(0.75, Math.min(2.5, round(samples.reduce((sum, sample) => sum + Number(sample.actualHours || base.p50), 0) / samples.length / base.p50)))
    : 1;

  return {
    kind: "estimate.reference-class",
    version: VERSION,
    intakeId: classification.intakeId,
    title: classification.title,
    match_basis: ["work_class", "modifier_dimensions", "evidence_packet"],
    work_class: classification.class,
    modifier_dimensions: classification.modifier_dimensions,
    base_hours: base,
    calibration_factor: calibrationFactor,
    samples,
    classification,
  };
}
