export const LAB_DECISIONS = [
  "APPROVED",
  "APPROVED_WITH_RESTRICTION",
  "BLOCKED",
  "REJECTED",
] as const;

export type LabDecision = (typeof LAB_DECISIONS)[number];

export const labDecisionForForm = (qualityStatus: string): LabDecision =>
  LAB_DECISIONS.includes(qualityStatus as LabDecision)
    ? (qualityStatus as LabDecision)
    : "APPROVED";
