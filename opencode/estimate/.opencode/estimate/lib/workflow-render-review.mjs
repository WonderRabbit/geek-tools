import { estimate } from "./workflow-build-estimate.mjs";
import { asArray, invalidFlowEvidenceRefs, invalidSourceEvidenceRefs, isFlowEvidenceRef, isSourceEvidenceRef, MODIFIER_KEYS, VERSION } from "./workflow-utils.mjs";

export function render(value) {
  const est = value?.kind === "estimate.estimate" ? value : estimate(value);
  const cls = est.work_classification;
  return [
    `# ${est.title}`,
    "",
    "| feature | class | confidence | P50h | P80h | P95h | duration P80d | status |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | --- |",
    `| ${est.intakeId} | ${cls.class} | ${est.confidence} | ${est.effort_hours.p50} | ${est.effort_hours.p80} | ${est.effort_hours.p95} | ${est.duration_days.p80} | ${est.status} |`,
    "",
    "## Modifier dimensions",
    ...MODIFIER_KEYS.map((key) => `- ${key}: ${cls.modifier_dimensions[key]}`),
    "",
    "## Evidence",
    ...(est.evidence_refs.length > 0 ? est.evidence_refs.map((item) => `- ${item}`) : ["- insufficient evidence"]),
    "",
    "## Missing info",
    ...(est.missing_info.length > 0 ? est.missing_info.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Assumptions",
    ...est.assumptions.map((item) => `- ${item}`),
    "",
  ].join("\n");
}

export function review(value) {
  const est = value?.kind === "estimate.estimate" ? value : estimate(value);
  const findings = [];
  const cls = est.work_classification ?? {};
  const modifiers = cls.modifier_dimensions ?? {};
  const missingModifiers = MODIFIER_KEYS.filter((key) => !modifiers[key]);
  const unknownModifierCount = Object.values(modifiers).filter((item) => item === "unknown" || item === "none").length;
  const invalidSourceRefs = invalidSourceEvidenceRefs(est.source_evidence_refs);
  const invalidFlowRefs = invalidFlowEvidenceRefs(est.flow_evidence_refs);

  if (!Array.isArray(est.evidence_refs) || est.evidence_refs.length === 0) findings.push({ severity: "error", code: "insufficient_evidence", message: "estimate has no evidence refs" });
  if (invalidSourceRefs.length > 0) findings.push({ severity: "error", code: "invalid_source_evidence", message: `non-source refs in source_evidence_refs: ${invalidSourceRefs.join(", ")}` });
  if (invalidFlowRefs.length > 0) findings.push({ severity: "error", code: "invalid_flow_evidence", message: `non-flow refs in flow_evidence_refs: ${invalidFlowRefs.join(", ")}` });
  if (!asArray(est.source_evidence_refs).some(isSourceEvidenceRef)) findings.push({ severity: "error", code: "missing_source_evidence", message: "estimate has no source evidence refs" });
  if (!asArray(est.flow_evidence_refs).some(isFlowEvidenceRef)) findings.push({ severity: "error", code: "missing_flow_evidence", message: "estimate has no flow evidence refs" });
  if (!cls.class || !["simple_large_change", "complex_small_change", "complex_large_change", "simple_small_change"].includes(cls.class)) findings.push({ severity: "error", code: "missing_work_class", message: "estimate has no supported work class" });
  if (missingModifiers.length > 0) findings.push({ severity: "error", code: "missing_modifiers", message: `missing modifier dimensions: ${missingModifiers.join(", ")}` });
  if (unknownModifierCount >= 2 && est.confidence !== "low") findings.push({ severity: "error", code: "confidence_too_high", message: "unknown modifiers require low confidence" });
  if (Array.isArray(cls.packet_evidence_statuses)) {
    const unmappedPackets = cls.packet_evidence_statuses.filter((packetItem) => !packetItem.has_source || !packetItem.has_flow);
    if (unmappedPackets.length > 0) findings.push({ severity: "error", code: "packet_source_flow_not_mapped", message: `packets missing source or flow evidence: ${unmappedPackets.map((item) => item.feature_id).join(", ")}` });
  }
  if (cls.source_flow_alignment_status !== "mapped") findings.push({ severity: "error", code: "source_flow_not_mapped", message: "source-flow alignment is not mapped" });
  if (!est.effort_hours?.p50 || !est.effort_hours?.p80 || !est.effort_hours?.p95) findings.push({ severity: "error", code: "missing_percentiles", message: "estimate must include P50/P80/P95 effort" });
  if (!est.duration_days?.p80) findings.push({ severity: "error", code: "missing_duration", message: "estimate must separate duration from effort" });
  if (est.status === "insufficient_evidence") findings.push({ severity: "error", code: "blocked_status", message: "estimate is blocked by insufficient evidence" });

  return {
    kind: "estimate.review",
    version: VERSION,
    intakeId: est.intakeId,
    title: est.title,
    ok: findings.every((item) => item.severity !== "error"),
    status: findings.some((item) => item.severity === "error") ? "blocked" : "ok",
    findings,
  };
}
