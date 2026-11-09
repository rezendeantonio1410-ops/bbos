const roundMoney = (value: number) => Math.round(value * 100) / 100;
const roundPercent = (value: number) => Math.round(value * 1000) / 1000;

export type SalesLineDiscountInput = {
  officialUnitPrice: number;
  finalUnitPrice?: number | string | null;
  discountAmount?: number | string | null;
  maxDiscountPercent?: number | null;
  minimumPrice?: number | null;
  unitCost?: number | null;
  minimumMarginPercent?: number | null;
  minimumRoiPercent?: number | null;
};

export type SalesLineDiscountResult = {
  valid: boolean;
  message: string | null;
  officialUnitPrice: number;
  finalUnitPrice: number;
  discountAmount: number;
  discountPercent: number;
  marginPercent: number | null;
  roiPercent: number | null;
};

export function calculateSalesLineDiscount(
  input: SalesLineDiscountInput,
): SalesLineDiscountResult {
  const officialUnitPrice = roundMoney(Number(input.officialUnitPrice));
  const hasFinalPrice =
    input.finalUnitPrice !== undefined &&
    input.finalUnitPrice !== null &&
    String(input.finalUnitPrice).trim() !== "";
  const hasDiscountAmount =
    input.discountAmount !== undefined &&
    input.discountAmount !== null &&
    String(input.discountAmount).trim() !== "";
  const informedDiscountAmount = hasDiscountAmount
    ? roundMoney(Number(input.discountAmount))
    : 0;
  const finalUnitPrice = roundMoney(
    hasDiscountAmount
      ? officialUnitPrice - informedDiscountAmount
      : hasFinalPrice
        ? Number(input.finalUnitPrice)
        : officialUnitPrice,
  );

  const base = {
    officialUnitPrice,
    finalUnitPrice,
    discountAmount: Math.max(0, roundMoney(officialUnitPrice - finalUnitPrice)),
    discountPercent:
      officialUnitPrice > 0
        ? Math.max(
            0,
            roundPercent(
              ((officialUnitPrice - finalUnitPrice) / officialUnitPrice) * 100,
            ),
          )
        : 0,
    marginPercent: null as number | null,
    roiPercent: null as number | null,
  };

  if (!Number.isFinite(officialUnitPrice) || officialUnitPrice <= 0) {
    return {
      ...base,
      valid: false,
      message: "O preço de tabela precisa ser maior que zero.",
    };
  }
  if (
    hasDiscountAmount &&
    (!Number.isFinite(informedDiscountAmount) || informedDiscountAmount < 0)
  ) {
    return {
      ...base,
      valid: false,
      message: "Informe um desconto em reais igual ou maior que zero.",
    };
  }
  if (
    hasDiscountAmount &&
    informedDiscountAmount >= officialUnitPrice
  ) {
    return {
      ...base,
      valid: false,
      message: "O desconto em reais deve ser menor que o preço de tabela.",
    };
  }
  if (!Number.isFinite(finalUnitPrice) || finalUnitPrice <= 0) {
    return {
      ...base,
      valid: false,
      message: "Informe um preço final maior que zero.",
    };
  }
  if (finalUnitPrice > officialUnitPrice) {
    return {
      ...base,
      valid: false,
      message: "O preço final não pode superar o preço de tabela neste campo.",
    };
  }

  const maxDiscountPercent =
    input.maxDiscountPercent === undefined || input.maxDiscountPercent === null
      ? null
      : Number(input.maxDiscountPercent);
  if (
    maxDiscountPercent !== null &&
    Number.isFinite(maxDiscountPercent) &&
    base.discountPercent > maxDiscountPercent + 0.0005
  ) {
    return {
      ...base,
      valid: false,
      message: `O desconto máximo permitido é ${maxDiscountPercent.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%.`,
    };
  }

  const minimumPrice =
    input.minimumPrice === undefined || input.minimumPrice === null
      ? null
      : Number(input.minimumPrice);
  if (
    minimumPrice !== null &&
    Number.isFinite(minimumPrice) &&
    finalUnitPrice < minimumPrice
  ) {
    return {
      ...base,
      valid: false,
      message: `O preço mínimo protegido é ${minimumPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
    };
  }

  const unitCost = Number(input.unitCost ?? 0);
  const marginPercent =
    Number.isFinite(unitCost) && unitCost > 0
      ? ((finalUnitPrice - unitCost) / finalUnitPrice) * 100
      : null;
  const roiPercent =
    Number.isFinite(unitCost) && unitCost > 0
      ? ((finalUnitPrice - unitCost) / unitCost) * 100
      : null;
  const result = { ...base, marginPercent, roiPercent };

  if (
    marginPercent !== null &&
    input.minimumMarginPercent !== undefined &&
    input.minimumMarginPercent !== null &&
    marginPercent < Number(input.minimumMarginPercent)
  ) {
    return {
      ...result,
      valid: false,
      message: `A margem resultante de ${marginPercent.toFixed(1)}% está abaixo do mínimo protegido de ${Number(input.minimumMarginPercent).toFixed(1)}%.`,
    };
  }
  if (
    roiPercent !== null &&
    input.minimumRoiPercent !== undefined &&
    input.minimumRoiPercent !== null &&
    roiPercent < Number(input.minimumRoiPercent)
  ) {
    return {
      ...result,
      valid: false,
      message: `O ROI resultante de ${roiPercent.toFixed(1)}% está abaixo do mínimo protegido de ${Number(input.minimumRoiPercent).toFixed(1)}%.`,
    };
  }

  return { ...result, valid: true, message: null };
}
