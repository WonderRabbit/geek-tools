import { estimate } from "./workflow-build-estimate.mjs";
import { round, VERSION } from "./workflow-utils.mjs";

export function calibrate(value, options = {}) {
  const est = value?.kind === "estimate.estimate" ? value : estimate(value);
  const actualHours = Number(options.actualHours ?? value?.actualHours ?? 0);
  const errorRatio = actualHours > 0 ? round(actualHours / est.effort_hours.p50) : null;
  return {
    kind: "estimate.calibration",
    version: VERSION,
    intakeId: est.intakeId,
    title: est.title,
    work_class: est.work_classification.class,
    estimate_hours_p50: est.effort_hours.p50,
    estimate_hours_p80: est.effort_hours.p80,
    actual_hours: actualHours || null,
    error_ratio: errorRatio,
    modifier_dimensions: est.work_classification.modifier_dimensions,
    advice: errorRatio === null
      ? "provide --actual-hours to compute calibration"
      : errorRatio > 1.25
        ? "increase future P50/P80 for this reference class"
        : errorRatio < 0.75
          ? "decrease future P50/P80 for this reference class"
          : "reference class is within tolerance",
  };
}
