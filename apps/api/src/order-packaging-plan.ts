/**
 * Plano de embalagem de um pedido: para cada item, quanto café torrado é
 * preciso e qual torra (OP) consegue atender. Não grava nada; a embalagem em
 * si continua na tela de Produção, que dá baixa no torrado e calcula o custo.
 */
export type PackagingItemRow = {
  salesOrderItemId: string;
  productVariantId: string;
  productName: string;
  sku: string;
  quantity: number;
  packageWeightG: number;
  coffeeProductId: string;
  coffeeName: string;
  lineName: string;
  reservedUnits: number;
  finishedAvailable: number;
};

export type PackagingOpRow = {
  id: string;
  code: string;
  status: string;
  coffeeProductId: string;
  plannedKg: number;
  greenInputKg: number;
  reservedGreenKg: number;
  roastedKg: number;
  packedKg: number;
  wipKg: number;
};

export type PackagingPlanItem = {
  salesOrderItemId: string;
  productVariantId: string;
  productName: string;
  sku: string;
  coffeeProductId: string;
  coffeeName: string;
  lineName: string;
  packages: number;
  packageWeightG: number;
  requiredKg: number;
  state: "PACKED" | "FROM_STOCK" | "READY" | "ROASTING" | "NEEDS_ROAST";
  readyOp: { id: string; code: string; kind: "ROASTED" | "WIP"; availableKg: number } | null;
  roastingOp: { id: string; code: string; status: string; plannedKg: number } | null;
  bestAvailableKg: number;
  suggestedGreenKg: number;
};

/** Perda média de torra usada só para sugerir quanto café verde torrar. */
export const DEFAULT_ROAST_LOSS = 0.16;

const kg = (value: number) => Math.round(value * 1000) / 1000;

export function buildPackagingPlan(items: PackagingItemRow[], ops: PackagingOpRow[], roastLoss = DEFAULT_ROAST_LOSS): PackagingPlanItem[] {
  return items.map((item) => {
    const packages = Math.max(0, item.quantity - item.reservedUnits);
    const missing = Math.max(0, packages - item.finishedAvailable);
    const requiredKg = kg((missing * item.packageWeightG) / 1000);
    const sameCoffee = ops.filter((op) => op.coffeeProductId === item.coffeeProductId);
    const available = sameCoffee
      .map((op) => {
        if (["ROASTED", "PACKAGING"].includes(op.status) && op.greenInputKg > 0 && Math.abs(op.reservedGreenKg - op.greenInputKg) <= 0.001 && op.packedKg <= 0.001)
          return { id: op.id, code: op.code, kind: "ROASTED" as const, availableKg: kg(op.roastedKg) };
        if (op.status === "COMPLETED" && op.wipKg > 0.001)
          return { id: op.id, code: op.code, kind: "WIP" as const, availableKg: kg(op.wipKg) };
        return null;
      })
      .filter((op): op is NonNullable<typeof op> => op !== null)
      .sort((a, b) => b.availableKg - a.availableKg);
    const readyOp = available.find((op) => op.availableKg + 0.001 >= requiredKg) ?? null;
    const roasting = sameCoffee.find((op) => ["PLANNED", "RESERVED", "IN_PROGRESS"].includes(op.status)
      || (["ROASTED", "PACKAGING"].includes(op.status) && op.packedKg <= 0.001 && !available.some((a) => a.id === op.id)));
    const state: PackagingPlanItem["state"] = packages === 0
      ? "PACKED"
      : missing === 0
        ? "FROM_STOCK"
        : readyOp
          ? "READY"
          : roasting
            ? "ROASTING"
            : "NEEDS_ROAST";
    const shortfall = Math.max(0, requiredKg - (available[0]?.availableKg ?? 0));
    return {
      salesOrderItemId: item.salesOrderItemId,
      productVariantId: item.productVariantId,
      productName: item.productName,
      sku: item.sku,
      coffeeProductId: item.coffeeProductId,
      coffeeName: item.coffeeName,
      lineName: item.lineName,
      packages,
      packageWeightG: item.packageWeightG,
      requiredKg,
      state,
      readyOp: state === "READY" ? readyOp : null,
      roastingOp: state === "ROASTING" && roasting ? { id: roasting.id, code: roasting.code, status: roasting.status, plannedKg: roasting.plannedKg } : null,
      bestAvailableKg: available[0]?.availableKg ?? 0,
      suggestedGreenKg: state === "NEEDS_ROAST" ? Math.ceil(requiredKg / (1 - roastLoss)) : 0,
    };
  });
}
