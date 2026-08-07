export type OperationalCostPeriodStatus = "OPEN" | "CALCULATING" | "REVIEW" | "CLOSED";
export type ClosingIssue = { code: string; severity: "CRITICAL" | "WARNING"; message: string; entityId?: string };

export function assertCostPeriodMutable(status: OperationalCostPeriodStatus) {
  if (status === "CLOSED") throw new Error("Período fechado é imutável.");
}

export function validateCostPeriod(input: { startsAt: Date; endsAt: Date }) {
  if (!(input.startsAt instanceof Date) || !(input.endsAt instanceof Date) || input.endsAt < input.startsAt)
    throw new Error("Período de custos inválido.");
}

export function evaluateClosingReadiness(input: {
  costsWithoutCenter: number;
  missingTariffs: number;
  machinesWithoutParameters: number;
  ordersWithoutUsage: number;
  unallocatedCosts: number;
  productsWithoutCost: number;
}): ClosingIssue[] {
  const issues: ClosingIssue[] = [];
  const add = (count: number, code: string, message: string, severity: ClosingIssue["severity"] = "CRITICAL") => {
    if (count > 0) issues.push({ code, severity, message: `${count} ${message}` });
  };
  add(input.costsWithoutCenter, "COST_WITHOUT_CENTER", "lançamento(s) sem centro de custo");
  add(input.missingTariffs, "MISSING_TARIFF", "tarifa(s) obrigatória(s) ausente(s)");
  add(input.machinesWithoutParameters, "MACHINE_PARAMETERS", "máquina(s) sem parâmetros completos");
  add(input.ordersWithoutUsage, "ORDER_WITHOUT_USAGE", "OP(s) concluída(s) sem apontamento produtivo");
  add(input.unallocatedCosts, "UNALLOCATED_COST", "custo(s) indireto(s) ou corporativo(s) não rateado(s)");
  add(input.productsWithoutCost, "PRODUCT_WITHOUT_COST", "SKU(s) produzido(s) sem custo calculável");
  return issues;
}

export function nextCostPeriodStatus(status: OperationalCostPeriodStatus, action: "CALCULATE" | "REVIEW" | "CLOSE") {
  assertCostPeriodMutable(status);
  if (action === "CALCULATE" && status === "OPEN") return "CALCULATING" as const;
  if (action === "REVIEW" && (status === "OPEN" || status === "CALCULATING")) return "REVIEW" as const;
  if (action === "CLOSE" && status === "REVIEW") return "CLOSED" as const;
  throw new Error(`Transição inválida: ${status} → ${action}.`);
}
