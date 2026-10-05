export const SAMPLE_FISCAL_UNIT_VALUE = 0.01;

export type SalesOrderType = "COMMERCIAL" | "SAMPLE";

export function resolveSalesOrderType(value: unknown): SalesOrderType {
  return String(value ?? "COMMERCIAL").trim().toUpperCase() === "SAMPLE"
    ? "SAMPLE"
    : "COMMERCIAL";
}

export function sampleFiscalPrice(quantity: number) {
  return Math.round(quantity * SAMPLE_FISCAL_UNIT_VALUE * 100) / 100;
}
