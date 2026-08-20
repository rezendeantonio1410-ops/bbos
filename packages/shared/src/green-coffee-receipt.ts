export type ReceiptUnit = "KG" | "BAG";
export type ReceiptQuality =
  | "AWAITING_ANALYSIS"
  | "APPROVED"
  | "APPROVED_WITH_RESTRICTION"
  | "BLOCKED"
  | "REJECTED";

export function calculateNetWeight(grossWeightKg: number, tareWeightKg = 0) {
  return Math.max(0, grossWeightKg - tareWeightKg);
}

export function validateReceiptWeight(input: {
  unit: ReceiptUnit;
  grossWeightKg: number;
  tareWeightKg?: number;
  netWeightKg: number;
  bagQuantity?: number;
  bagWeightKg?: number;
}) {
  if (
    !Number.isFinite(input.grossWeightKg) ||
    !Number.isFinite(input.netWeightKg) ||
    input.grossWeightKg <= 0 ||
    input.netWeightKg <= 0
  )
    return false;
  if (
    (input.tareWeightKg ?? 0) < 0 ||
    Math.abs(
      calculateNetWeight(input.grossWeightKg, input.tareWeightKg) -
        input.netWeightKg,
    ) > 0.01
  )
    return false;
  if (
    input.unit === "BAG" &&
    (!input.bagQuantity ||
      !input.bagWeightKg ||
      Math.abs(input.bagQuantity * input.bagWeightKg - input.netWeightKg) >
        0.01)
  )
    return false;
  return true;
}

export function isProductionEligible(quality: ReceiptQuality) {
  return quality === "APPROVED" || quality === "APPROVED_WITH_RESTRICTION";
}

export function deriveGreenStockBalance(
  movements: Array<{ quantityKg: number; direction: "IN" | "OUT" }>,
) {
  return movements.reduce(
    (balance, movement) =>
      balance +
      (movement.direction === "IN"
        ? movement.quantityKg
        : -movement.quantityKg),
    0,
  );
}

export function calculatePurchaseBalance(
  contractedKg: number,
  receivedWeightsKg: number[],
) {
  const receivedKg = receivedWeightsKg.reduce((sum, value) => sum + value, 0);
  return {
    receivedKg,
    balanceKg: Math.max(0, contractedKg - receivedKg),
    excessKg: Math.max(0, receivedKg - contractedKg),
    status:
      receivedKg === 0
        ? "CONFIRMED"
        : receivedKg < contractedKg
          ? "PARTIALLY_RECEIVED"
          : "RECEIVED",
  };
}

export function comparePurchaseReceipt(input: {
  contractedWeightKg: number;
  receivedWeightKg: number;
  tolerancePercent: number;
  contractedSpecies: string;
  receivedSpecies: string;
  contractedOrigin: string;
  receivedOrigin: string;
  maxMoisturePercent?: number;
  receivedMoisturePercent?: number;
}) {
  const allowed = (input.contractedWeightKg * input.tolerancePercent) / 100;
  const differences = [
    ...(input.receivedWeightKg - input.contractedWeightKg > allowed
      ? ["WEIGHT"]
      : []),
    ...(input.contractedSpecies !== input.receivedSpecies ? ["SPECIES"] : []),
    ...(input.contractedOrigin !== input.receivedOrigin ? ["ORIGIN"] : []),
    ...(input.maxMoisturePercent != null &&
    input.receivedMoisturePercent != null &&
    input.receivedMoisturePercent > input.maxMoisturePercent
      ? ["MOISTURE"]
      : []),
  ];
  return { differences, approvalRequired: differences.length > 0 };
}

export type PurchaseActorRole =
  "ADMIN" | "EXECUTIVE" | "INDUSTRIAL" | "FINANCE" | "SALES";
export function canApproveGreenCoffeePurchase(role: PurchaseActorRole) {
  return role === "ADMIN" || role === "EXECUTIVE";
}

export function initialPurchaseApproval(
  action: "DRAFT" | "SUBMIT" | "APPROVE",
  role: PurchaseActorRole,
) {
  if (action === "DRAFT") return "DRAFT";
  if (action === "APPROVE") {
    if (!canApproveGreenCoffeePurchase(role))
      throw new Error("ROLE_NOT_ALLOWED");
    return "APPROVED";
  }
  return "PENDING_APPROVAL";
}

export function buildEqualInstallments(
  total: number,
  count: number,
  firstDueDate: string,
) {
  if (
    !Number.isFinite(total) ||
    total <= 0 ||
    !Number.isInteger(count) ||
    count < 1
  )
    throw new Error("INVALID_INSTALLMENTS");
  const base = Math.floor((total * 100) / count) / 100;
  let allocated = 0;
  return Array.from({ length: count }, (_, index) => {
    const amount =
      index === count - 1 ? Math.round((total - allocated) * 100) / 100 : base;
    allocated = Math.round((allocated + amount) * 100) / 100;
    const due = new Date(`${firstDueDate}T12:00:00.000Z`);
    due.setUTCMonth(due.getUTCMonth() + index);
    return {
      installmentNumber: index + 1,
      percentage:
        index === count - 1
          ? Math.round(
              (100 - (Math.floor(10000 / count) / 100) * index) * 100,
            ) / 100
          : Math.floor(10000 / count) / 100,
      amount,
      dueDate: due.toISOString(),
    };
  });
}

export function filterVarietiesBySpecies<T extends { speciesCode: string }>(
  items: T[],
  speciesCode: string,
) {
  return items.filter((item) => item.speciesCode === speciesCode);
}
