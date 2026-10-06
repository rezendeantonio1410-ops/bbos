// O Melhor Envio exige que o valor segurado seja igual ao total da NF-e e
// nunca inferior a R$ 1,00. Como toda amostra possui ao menos um pacote,
// R$ 1,00 por pacote mantém o valor simbólico e torna a nota compatível com
// a contratação da etiqueta.
export const SAMPLE_FISCAL_PACKAGE_VALUE = 1;

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

export function sampleFiscalPrice(packageQuantity: number) {
  return Math.round(
    packageQuantity * SAMPLE_FISCAL_PACKAGE_VALUE * 100,
  ) / 100;
}

export function sampleFiscalSubtotalCents(quantity: number) {
  return Math.round(sampleFiscalPrice(quantity) * 100);
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
