import { stableJson } from "./json-io.mjs";
import { ensurePacket } from "./workflow-packet.mjs";
import { isFlowEvidenceRef, isSourceEvidenceRef, VERSION } from "./workflow-utils.mjs";

function countUniqueFiles(packets) {
  return new Set(packets.flatMap((packetItem) => packetItem.impacted_files.map((file) => file.path))).size;
}

export function classify(value) {
  const source = ensurePacket(value);
  const fileCount = countUniqueFiles(source.packets);
  const featureCount = source.packets.length;
  const integrationEdges = source.packets.reduce((sum, packetItem) => sum + packetItem.data_flow_edges.length, 0);
  const text = stableJson(source).toLowerCase();
  const branchOrStateIndicators = ["retry", "idempot", "concurrency", "security", "money", "permission", "transaction", "state", "domain", "external"].filter((term) => text.includes(term));
  const logicComplexity = branchOrStateIndicators.length > 0 || integrationEdges > 1 ? "complex" : "simple";
  const changeVolume = fileCount > 3 || featureCount > 3 ? "large" : "small";
  const workClass = `${logicComplexity}_${changeVolume}_change`;
  const packetEvidenceStatuses = source.packets.map((packetItem) => ({
    feature_id: packetItem.feature_id,
    has_source: packetItem.source_evidence_refs.some(isSourceEvidenceRef),
    has_flow: packetItem.flow_evidence_refs.some(isFlowEvidenceRef),
  }));
  const hasEvidence = packetEvidenceStatuses.length > 0 && packetEvidenceStatuses.every((item) => item.has_source && item.has_flow);
  const unknowns = source.packets.reduce((sum, packetItem) => sum + packetItem.unknowns.length, 0);
  const modifierDimensions = {
    functional_size: featureCount === 1 ? "small" : featureCount <= 3 ? "medium" : "large",
    coupling: integrationEdges > 0 ? "external_system" : fileCount > 2 ? "cross_module" : "module",
    uncertainty: unknowns > 0 ? "partial" : "clear",
    verification_burden: source.packets.some((packetItem) => packetItem.tests.length > 0) ? "normal" : "heavy",
    reversibility: text.includes("migration") || text.includes("data change") ? "hard" : "moderate",
    developer_familiarity: source.developerProfile?.subsystem_familiarity === "unknown" ? "none" : source.developerProfile?.subsystem_familiarity ?? "none",
    mechanical_repetition: changeVolume === "large" && logicComplexity === "simple" ? "high" : "none",
  };
  const unknownModifierCount = Object.values(modifierDimensions).filter((item) => item === "unknown" || item === "none").length;

  return {
    kind: "estimate.classification",
    version: VERSION,
    intakeId: source.intakeId,
    title: source.title,
    logic_complexity: logicComplexity,
    change_volume: changeVolume,
    class: workClass,
    modifier_dimensions: modifierDimensions,
    signals: {
      impacted_file_count: fileCount,
      impacted_module_count: Math.max(1, new Set(source.packets.flatMap((packetItem) => packetItem.impacted_files.map((file) => file.path.split(/[\\/]/)[0]))).size),
      symbol_reference_count: source.packets.reduce((sum, packetItem) => sum + packetItem.symbols.length, 0),
      branch_or_state_indicators: branchOrStateIndicators,
      business_rule_refs: source.packets.flatMap((packetItem) => packetItem.business_flow_refs),
      integration_edges: integrationEdges,
      test_surface_count: source.packets.reduce((sum, packetItem) => sum + packetItem.tests.length, 0),
    },
    classification_confidence: hasEvidence && unknownModifierCount < 2 ? "medium" : "low",
    split_required: workClass === "complex_large_change" || (workClass === "complex_small_change" && modifierDimensions.verification_burden === "heavy"),
    evidence_refs: source.packets.flatMap((packetItem) => packetItem.evidence_refs),
    source_evidence_refs: source.packets.flatMap((packetItem) => packetItem.source_evidence_refs),
    flow_evidence_refs: source.packets.flatMap((packetItem) => packetItem.flow_evidence_refs),
    packet_evidence_statuses: packetEvidenceStatuses,
    source_flow_alignment_status: hasEvidence ? "mapped" : "partial",
    packets: source.packets,
    calibrationExamples: source.calibrationExamples,
  };
}
