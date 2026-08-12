export type SensoryEvaluation = { fragrance?: number | null; flavor?: number | null; finish?: number | null; acidity?: number | null; body?: number | null; sweetness?: number | null; uniformity?: number | null; cleanliness?: number | null; descriptors?: string[] };
const attributes = ["fragrance", "flavor", "finish", "acidity", "body", "sweetness", "uniformity", "cleanliness"] as const;
export function consolidateSensoryEvaluations(evaluations: SensoryEvaluation[]) {
  if (!evaluations.length) throw new Error("At least one evaluation is required");
  const averages = Object.fromEntries(attributes.map((attribute) => [attribute, Number((evaluations.reduce((sum, item) => sum + (item[attribute] ?? 0), 0) / evaluations.length).toFixed(2))]));
  const descriptorCounts = new Map<string, number>();
  evaluations.forEach((evaluation) => (evaluation.descriptors ?? []).forEach((descriptor) => descriptorCounts.set(descriptor, (descriptorCounts.get(descriptor) ?? 0) + 1)));
  const score = Number((Object.values(averages).reduce((sum, value) => sum + value, 0) / attributes.length).toFixed(2));
  return { averages, score, recurringDescriptors: [...descriptorCounts.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })) };
}

export function qualityDecisionTransition(decision: "APPROVED" | "APPROVED_WITH_OBSERVATION" | "RETEST_REQUIRED" | "REJECTED") {
  if (decision === "APPROVED" || decision === "APPROVED_WITH_OBSERVATION")
    return { lotStatus: "APPROVED", sampleStatus: "APPROVED", requiresReason: decision === "APPROVED_WITH_OBSERVATION" } as const;
  if (decision === "RETEST_REQUIRED")
    return { lotStatus: "QUALITY_REVIEW", sampleStatus: "PENDING", requiresReason: true } as const;
  return { lotStatus: "BLOCKED", sampleStatus: "BLOCKED", requiresReason: true } as const;
}

export function sensoryIntelligence(
  profiles: Array<{ sessionId?: string | null; score?: number | null; descriptors?: string[]; acidityTypes?: string[] }>,
) {
  const scored = profiles.map((item) => item.score).filter((score): score is number => score != null && Number.isFinite(score));
  const count = (values: string[]) => [...values.reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1]);
  const scores = scored.length ? { average: scored.reduce((sum, score) => sum + score, 0) / scored.length, minimum: Math.min(...scored), maximum: Math.max(...scored) } : null;
  return {
    sessionsConsidered: new Set(profiles.map((item, index) => item.sessionId ?? `profile:${index}`)).size,
    scores,
    descriptors: count(profiles.flatMap((item) => item.descriptors ?? [])).map(([name, occurrences]) => ({ name, occurrences })),
    acidityTypes: count(profiles.flatMap((item) => item.acidityTypes ?? [])).map(([name, occurrences]) => ({ name, occurrences })),
  };
}
