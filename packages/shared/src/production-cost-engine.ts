import type { ProductionCostInput, ProductionCostResult } from './index';

export class ProductionCostRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductionCostRuleError';
  }
}

export function calculateRoastLoss(greenInputKg: number, roastedOutputKg: number): { lossKg: number; lossPercent: number } {
  if (!Number.isFinite(greenInputKg) || greenInputKg <= 0) throw new ProductionCostRuleError('O peso verde deve ser maior que zero.');
  if (!Number.isFinite(roastedOutputKg) || roastedOutputKg < 0 || roastedOutputKg > greenInputKg) throw new ProductionCostRuleError('O peso torrado deve estar entre zero e o peso verde.');
  const lossKg = greenInputKg - roastedOutputKg;
  return { lossKg, lossPercent: (lossKg / greenInputKg) * 100 };
}

export function calculateProductionCost(input: ProductionCostInput): ProductionCostResult {
  const monetaryValues = [input.greenCoffeeConsumedCost, input.roastLossCost, input.packagingCost, input.suppliesCost, input.laborCost, input.energyCost, input.otherIndustrialCosts];
  if (monetaryValues.some(value => !Number.isFinite(value) || value < 0)) throw new ProductionCostRuleError('Os componentes de custo devem ser valores não negativos.');
  if (input.roastedOutputKg <= 0 || input.finishedOutputKg <= 0 || input.producedPackages <= 0) throw new ProductionCostRuleError('A produção realizada deve ser maior que zero para calcular custos unitários.');
  if (new Set(input.sourceCostEventIds).size !== input.sourceCostEventIds.length) throw new ProductionCostRuleError('CostEvents duplicados não podem compor o custo da OP.');
  const totalCost = monetaryValues.reduce((sum, value) => sum + value, 0);
  const costPerFinishedKg = totalCost / input.finishedOutputKg;
  const standardTotal = input.standardCostPerKg * input.finishedOutputKg;
  const standardCostDeviationAmount = totalCost - standardTotal;
  return {
    totalCost,
    costPerRoastedKg: totalCost / input.roastedOutputKg,
    costPerFinishedKg,
    costPerPackage: totalCost / input.producedPackages,
    costPerSku: totalCost / input.producedPackages,
    standardCostDeviationAmount,
    standardCostDeviationPercent: standardTotal > 0 ? (standardCostDeviationAmount / standardTotal) * 100 : 0,
    sourceCostEventIds: [...input.sourceCostEventIds],
  };
}
