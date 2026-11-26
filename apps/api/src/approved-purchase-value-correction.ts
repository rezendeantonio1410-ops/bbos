/**
 * Corrections to approved green-coffee purchases are deliberate administrative
 * actions, not a way to rewrite paid, accepted, received, or invoiced purchases.
 */
export type ApprovedPurchaseValueCorrection = {
  expectedTotalValue: number;
  totalValue: number;
  reason: string;
};

function exactCents(input: unknown, label: string): number {
  if (typeof input !== "number" || !Number.isFinite(input) || input <= 0 ||
      input > 100_000_000 || Math.abs(Math.round(input * 100) - input * 100) > 0.000001) {
    throw new Error(`${label} deve ser um valor positivo com duas casas decimais.`);
  }
  return Math.round(input * 100);
}

export function parseApprovedPurchaseValueCorrection(body: unknown): ApprovedPurchaseValueCorrection {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Correção inválida.");
  const data = body as Record<string, unknown>;
  if (Object.keys(data).some(key => !["expectedTotalValue", "totalValue", "reason"].includes(key))) {
    throw new Error("Campos não permitidos na correção.");
  }
  const oldCents = exactCents(data.expectedTotalValue, "Valor anterior");
  const newCents = exactCents(data.totalValue, "Novo valor");
  if (oldCents === newCents) throw new Error("O valor corrigido deve ser diferente do anterior.");
  if (typeof data.reason !== "string" || data.reason.trim().length < 10 || data.reason.trim().length > 500) {
    throw new Error("Informe uma justificativa de 10 a 500 caracteres.");
  }
  return { expectedTotalValue: oldCents / 100, totalValue: newCents / 100, reason: data.reason.trim() };
}

export function approvedPurchaseCorrectionEligible(purchase: {
  approvalStatus: string;
  status: string;
  externalAcceptanceStatus: string;
  operationalStatus: string;
  paymentTermType: string;
  currency: string;
  brokerCommissionAmount: unknown;
  pricePerBag: unknown;
}): boolean {
  return purchase.approvalStatus === "APPROVED" &&
    purchase.status === "CONFIRMED" &&
    purchase.externalAcceptanceStatus === "NOT_SENT" &&
    purchase.operationalStatus === "AWAITING_DELIVERY" &&
    purchase.paymentTermType === "CASH" &&
    purchase.currency === "BRL" &&
    purchase.brokerCommissionAmount == null &&
    purchase.pricePerBag == null;
}

export type PurchaseFiscalAllocation = {
  allocationType: string;
  direction: string;
  status: string;
  matchStatus: string;
  totalAmount: number;
};

/**
 * If an inbound NF-e has already been linked, an approved value correction
 * is allowed only when it reconciles the purchase total to that exact invoice.
 * Never alter fiscal documents or silently mark them matched.
 */
export function approvedPurchaseFiscalCorrectionEligible(
  allocations: PurchaseFiscalAllocation[],
  correctedTotal: number,
): boolean {
  if (allocations.length === 0) return true;
  if (allocations.length !== 1) return false;
  const invoice = allocations[0]!;
  return invoice.allocationType === "GREEN_COFFEE_PURCHASE" &&
    invoice.direction === "INBOUND" &&
    invoice.status === "AUTHORIZED" &&
    invoice.matchStatus === "DIVERGENT" &&
    Number.isFinite(invoice.totalAmount) &&
    Math.round(invoice.totalAmount * 100) === Math.round(correctedTotal * 100);
}

/**
 * A purchase may be adjusted alongside its already-created payable only if
 * the payable is still entirely open and has no settlement history.
 * The controller checks the database link and Payment rows under the same
 * serializable transaction before calling this predicate.
 */
export function approvedPurchaseOpenPayableEligible(payable: {
  status: string;
  amount: number;
  openAmount: number;
  paymentDate: Date | string | null;
  paymentCount: number;
}, previousTotal: number): boolean {
  const cents = (value: number) => Number.isFinite(value) ? Math.round(value * 100) : NaN;
  return payable.status === "OPEN" &&
    payable.paymentDate == null &&
    payable.paymentCount === 0 &&
    cents(payable.amount) === cents(previousTotal) &&
    cents(payable.openAmount) === cents(previousTotal);
}
