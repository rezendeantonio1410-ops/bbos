export const SAMPLE_FISCAL_UNIT_VALUE = 0.01;

export const SAMPLE_DEFAULT_SHIPPING_BOX = {
  widthCm: 35,
  heightCm: 22,
  lengthCm: 11,
  maxWeightGrams: 2_500,
} as const;

export type SalesOrderType = "COMMERCIAL" | "SAMPLE";

export function resolveSalesOrderType(value: unknown): SalesOrderType {
  return String(value ?? "COMMERCIAL").trim().toUpperCase() === "SAMPLE"
    ? "SAMPLE"
    : "COMMERCIAL";
}

export function sampleFiscalPrice(quantity: number) {
  return Math.round(quantity * SAMPLE_FISCAL_UNIT_VALUE * 100) / 100;
}

export function sampleShippingPackages(weightGrams: number) {
  const normalizedWeight = Math.max(1, Math.ceil(Number(weightGrams) || 0));
  const packageCount = Math.max(
    1,
    Math.ceil(normalizedWeight / SAMPLE_DEFAULT_SHIPPING_BOX.maxWeightGrams),
  );
  const baseWeightGrams = Math.floor(normalizedWeight / packageCount);
  const remainderGrams = normalizedWeight % packageCount;

  return Array.from({ length: packageCount }, (_, index) => ({
    widthCm: SAMPLE_DEFAULT_SHIPPING_BOX.widthCm,
    heightCm: SAMPLE_DEFAULT_SHIPPING_BOX.heightCm,
    lengthCm: SAMPLE_DEFAULT_SHIPPING_BOX.lengthCm,
    weightGrams: baseWeightGrams + (index < remainderGrams ? 1 : 0),
  }));
}
