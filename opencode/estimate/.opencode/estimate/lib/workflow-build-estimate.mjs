import { referenceClass } from "./workflow-reference.mjs";
import { round, VERSION } from "./workflow-utils.mjs";

export function estimate(value) {
  const ref = value?.kind === "estimate.reference-class" ? value : referenceClass(value);
  const classification = ref.classification;
  const unknownModifierCount = Object.values(ref.modifier_dimensions).filter((item) => item === "unknown" || item === "none").length;
  const hasSourceEvidence = classification.packet_evidence_statuses.every((item) => item.has_source);
  const hasFlowEvidence = classification.packet_evidence_statuses.every((item) => item.has_flow);
  const hours = {
    p50: round(ref.base_hours.p50 * ref.calibration_factor),
    p80: round(ref.base_hours.p80 * ref.calibration_factor),
    p95: round(ref.base_hours.p95 * ref.calibration_factor),
  };

  return {
    kind: "estimate.estimate",
    version: VERSION,
    intakeId: ref.intakeId,
    title: ref.title,
    work_classification: {
      logic_complexity: classification.logic_complexity,
      change_volume: classification.change_volume,
      class: classification.class,
      modifier_dimensions: ref.modifier_dimensions,
      signals: classification.signals,
      classification_confidence: classification.classification_confidence,
      split_required: classification.split_required,
      source_flow_alignment_status: classification.source_flow_alignment_status,
      packet_evidence_statuses: classification.packet_evidence_statuses,
    },
    reference_class: {
      match_basis: ref.match_basis,
      calibration_factor: ref.calibration_factor,
      sample_count: ref.samples.length,
    },
    effort_hours: hours,
    duration_days: { p50: round(hours.p50 / 6), p80: round(hours.p80 / 6), p95: round(hours.p95 / 6) },
    confidence: hasSourceEvidence && hasFlowEvidence && unknownModifierCount < 2 ? classification.classification_confidence : "low",
    drivers: [`work_class=${classification.class}`, `coupling=${ref.modifier_dimensions.coupling}`, `verification_burden=${ref.modifier_dimensions.verification_burden}`],
    assumptions: [
      "Source and flow evidence remains representative of the requested feature.",
      "Developer profile is a modifier, not the sole basis of the estimate.",
      "Qwen receives filtered evidence packets, not raw repository dumps.",
    ],
    missing_info: [
      ...classification.packets.flatMap((packetItem) => packetItem.unknowns),
      ...(!hasSourceEvidence ? ["source evidence"] : []),
      ...(!hasFlowEvidence ? ["flow evidence"] : []),
      ...(unknownModifierCount >= 2 ? ["too many unknown modifier dimensions"] : []),
    ],
    evidence_refs: classification.evidence_refs,
    source_evidence_refs: classification.source_evidence_refs,
    flow_evidence_refs: classification.flow_evidence_refs,
    counterevidence: [],
    status: hasSourceEvidence && hasFlowEvidence ? "draft" : "insufficient_evidence",
  };
}
