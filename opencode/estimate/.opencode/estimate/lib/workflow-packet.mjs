import { intake, ensureIntake } from "./workflow-intake.mjs";
import { isFlowEvidenceRef, isSourceEvidenceRef, VERSION } from "./workflow-utils.mjs";

export function split(value) {
  const source = ensureIntake(value);
  const seeds = source.goals.length > 0 ? source.goals : [source.summary];
  const features = seeds.map((goal, index) => ({
    feature_id: `F${String(index + 1).padStart(3, "0")}`,
    title: goal.length > 72 ? `${goal.slice(0, 69)}...` : goal,
    description: goal,
    requirement_refs: [`REQ-${String(index + 1).padStart(3, "0")}`],
    files: source.files,
    flow_refs: source.flowRefs,
    acceptance: source.acceptance,
    dependencies: index === 0 ? [] : [`F${String(index).padStart(3, "0")}`],
  }));

  return {
    kind: "estimate.split",
    version: VERSION,
    intakeId: source.id,
    title: source.title,
    developerProfile: source.developerProfile,
    calibrationExamples: source.calibrationExamples,
    constraints: source.constraints,
    risks: source.risks,
    features,
  };
}

export function ensureSplit(value) {
  return value?.kind === "estimate.split" ? value : split(value);
}

export function packet(value) {
  const source = ensureSplit(value);
  return {
    kind: "estimate.packet",
    version: VERSION,
    intakeId: source.intakeId,
    title: source.title,
    developerProfile: source.developerProfile,
    calibrationExamples: source.calibrationExamples,
    constraints: source.constraints,
    risks: source.risks,
    packets: source.features.map((feature) => packetFromFeature(feature)),
  };
}

function packetFromFeature(feature) {
  const sourceEvidenceRefs = feature.files.map((file) => `file:${file.path}`);
  const flowEvidenceRefs = feature.flow_refs.map((ref) => `flow:${ref}`);
  const requirementEvidenceRefs = feature.requirement_refs.map((ref) => `requirement:${ref}`);
  return {
    feature_id: feature.feature_id,
    title: feature.title,
    requirement_refs: feature.requirement_refs,
    entrypoints: feature.files.map((file) => file.path),
    impacted_files: feature.files,
    symbols: [],
    call_edges: [],
    data_flow_edges: feature.flow_refs.map((ref) => ({ ref, status: "mapped_from_input" })),
    business_flow_refs: feature.flow_refs,
    tests: feature.files.filter((file) => /test|spec/i.test(file.path)),
    configs: feature.files.filter((file) => /config|ya?ml|json/i.test(file.path)),
    unknowns: [
      ...(sourceEvidenceRefs.length === 0 ? ["source evidence"] : []),
      ...(flowEvidenceRefs.length === 0 ? ["flow evidence"] : []),
    ],
    source_evidence_refs: sourceEvidenceRefs,
    flow_evidence_refs: flowEvidenceRefs,
    requirement_evidence_refs: requirementEvidenceRefs,
    evidence_refs: [...sourceEvidenceRefs, ...flowEvidenceRefs, ...requirementEvidenceRefs],
    completeness_flags: {
      has_requirements: feature.requirement_refs.length > 0,
      has_source: sourceEvidenceRefs.length > 0,
      has_flow: flowEvidenceRefs.length > 0,
    },
  };
}

export function ensurePacket(value) {
  if (value?.kind === "estimate.flow-align") return value;
  return value?.kind === "estimate.packet" ? value : packet(value);
}

export function flowAlign(value) {
  const source = ensurePacket(value);
  return {
    kind: "estimate.flow-align",
    version: VERSION,
    intakeId: source.intakeId,
    title: source.title,
    developerProfile: source.developerProfile,
    calibrationExamples: source.calibrationExamples,
    constraints: source.constraints,
    risks: source.risks,
    packets: source.packets.map((item) => ({
      ...item,
      source_flow_alignment_status: item.source_evidence_refs.some(isSourceEvidenceRef) && item.flow_evidence_refs.some(isFlowEvidenceRef)
        ? "mapped"
        : "partial",
      missing_info: [
        ...item.unknowns,
        ...(!item.source_evidence_refs.some(isSourceEvidenceRef) ? ["source entrypoint"] : []),
        ...(!item.flow_evidence_refs.some(isFlowEvidenceRef) ? ["data/business flow mapping"] : []),
      ],
    })),
  };
}

export { intake };
