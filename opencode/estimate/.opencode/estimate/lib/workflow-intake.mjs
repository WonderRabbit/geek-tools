import { asArray, asText, shortHash, slug, VERSION } from "./workflow-utils.mjs";

function normalizeFile(file) {
  if (typeof file === "string") return { path: file, reason: "referenced by request" };
  return {
    path: asText(file?.path ?? file?.file ?? file?.name, "unknown"),
    reason: asText(file?.reason ?? file?.purpose, "referenced by request"),
  };
}

function normalizeReference(reference) {
  if (typeof reference === "string") return { label: reference, url: "" };
  return {
    label: asText(reference?.label ?? reference?.title ?? reference?.name, "reference"),
    url: asText(reference?.url ?? reference?.href, ""),
  };
}

function normalizeProfile(profile = {}) {
  return {
    general_level: asText(profile.general_level ?? profile.level, "unknown"),
    domain_experience: asText(profile.domain_experience, "unknown"),
    stack_experience: asText(profile.stack_experience, "unknown"),
    subsystem_familiarity: asText(profile.subsystem_familiarity, "unknown"),
    review_dependency: asText(profile.review_dependency, "normal"),
    availability_factor: Number.isFinite(Number(profile.availability_factor))
      ? Number(profile.availability_factor)
      : 1,
  };
}

export function intake(raw) {
  const title = asText(raw?.title ?? raw?.name ?? raw?.task, "Untitled estimate");
  const summary = asText(raw?.summary ?? raw?.description ?? raw?.prompt, title);
  const goals = asArray(raw?.goals ?? raw?.requirements ?? raw?.acceptance).map((item) => asText(item)).filter(Boolean);
  const constraints = asArray(raw?.constraints ?? raw?.rules).map((item) => asText(item)).filter(Boolean);
  const acceptance = asArray(raw?.acceptance ?? raw?.done ?? raw?.definitionOfDone).map((item) => asText(item)).filter(Boolean);
  const files = asArray(raw?.files ?? raw?.paths).map(normalizeFile).filter((file) => file.path && file.path !== "unknown");
  const references = asArray(raw?.references ?? raw?.sources).map(normalizeReference);
  const risks = asArray(raw?.risks).map((item) => asText(item)).filter(Boolean);
  const flowRefs = asArray(raw?.flows ?? raw?.flowRefs ?? raw?.businessFlows).map((item) => asText(item)).filter(Boolean);
  const developerProfile = normalizeProfile(raw?.developer_profile ?? raw?.developerProfile);
  const calibrationExamples = asArray(raw?.calibrationExamples ?? raw?.priorRuns).map((example, index) => ({
    id: asText(example?.id, `C${String(index + 1).padStart(3, "0")}`),
    label: asText(example?.label ?? example?.title, "prior run"),
    actualHours: Number(example?.actualHours ?? example?.hours ?? 0),
    workClass: asText(example?.workClass ?? example?.work_class, ""),
    notes: asText(example?.notes ?? example?.outcome, ""),
  }));

  return {
    kind: "estimate.intake",
    version: VERSION,
    id: `${slug(title)}-${shortHash({ title, summary, goals, constraints, acceptance, files, flowRefs })}`,
    title,
    summary,
    goals,
    constraints,
    acceptance,
    files,
    references,
    risks,
    flowRefs,
    developerProfile,
    calibrationExamples,
  };
}

export function ensureIntake(value) {
  return value?.kind === "estimate.intake" ? value : intake(value);
}
