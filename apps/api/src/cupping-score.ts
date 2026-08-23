export const CUPPING_ATTRIBUTES = ["fragrance", "flavor", "aftertaste", "acidity", "body", "uniformity", "balance", "cleanCup", "sweetness", "overall"] as const;

export function scoreCuppingAttributes(attributes: Record<string, unknown>) {
  const values = CUPPING_ATTRIBUTES.map((key) => attributes[key]).filter((value) => value !== "" && value !== null && value !== undefined).map(Number).filter((value) => Number.isFinite(value));
  if (!values.length) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}
