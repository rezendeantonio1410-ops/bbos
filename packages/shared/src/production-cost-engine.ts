import type { ProductionCostInput, ProductionCostResult } from "./index";

/** Fonte única da referência operacional adotada para o Torrador 01. */
export const ROASTER_OPERATIONAL_PROFILE = {
  greenLoadKg: 17,
  roastMinutesPerBatch: 10,
  coolingMinutesPerBatch: 2,
  cycleMinutesPerBatch: 12,
} as const;

export const ROASTER_OPERATIONAL_GREEN_LOAD_KG =
  ROASTER_OPERATIONAL_PROFILE.greenLoadKg;

export const ROASTER_OPERATIONAL_USAGE_NOTE =
  `Carga operacional de até ${ROASTER_OPERATIONAL_PROFILE.greenLoadKg} kg: ` +
  `${ROASTER_OPERATIONAL_PROFILE.roastMinutesPerBatch} min de torra + ` +
  `${ROASTER_OPERATIONAL_PROFILE.coolingMinutesPerBatch} min de resfriamento por batelada.`;

export class ProductionCostRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductionCostRuleError";
  }
}

export type RoastStageCostAllocationInput = {
  greenCoffeeConsumedCost: number;
  roastLossCost: number;
  energyCost: number;
  gasCost: number;
  roastedOutputKg: number;
  finishedOutputKg: number;
};

export type RoastStageCostAllocationResult = {
  finishedShareRatio: number;
  remainingWipKg: number;
  roastCostPerKg: number;
  allocatedGreenCoffeeConsumedCost: number;
  allocatedRoastLossCost: number;
  allocatedEnergyCost: number;
  allocatedGasCost: number;
  allocatedRoastStageCost: number;
  remainingWipCost: number;
};

/**
 * Rateia os custos já incorridos na torra entre o produto que seguiu para
 * embalagem e o café torrado que permanece em processo (WIP).
 */
export function allocateRoastStageCosts(
  input: RoastStageCostAllocationInput,
): RoastStageCostAllocationResult {
  const monetaryValues = [
    input.greenCoffeeConsumedCost,
    input.roastLossCost,
    input.energyCost,
    input.gasCost,
  ];
  if (monetaryValues.some((value) => !Number.isFinite(value) || value < 0))
    throw new ProductionCostRuleError(
      "Os custos da torra devem ser valores não negativos.",
    );
  if (!Number.isFinite(input.roastedOutputKg) || input.roastedOutputKg <= 0)
    throw new ProductionCostRuleError(
      "O peso torrado deve ser maior que zero para ratear o custo da torra.",
    );
  if (
    !Number.isFinite(input.finishedOutputKg) ||
    input.finishedOutputKg <= 0 ||
    input.finishedOutputKg > input.roastedOutputKg
  )
    throw new ProductionCostRuleError(
      "O peso acabado deve estar entre zero e o peso torrado.",
    );

  const finishedShareRatio =
    input.finishedOutputKg / input.roastedOutputKg;
  const remainingWipKg = input.roastedOutputKg - input.finishedOutputKg;
  const totalRoastStageCost = monetaryValues.reduce(
    (sum, value) => sum + value,
    0,
  );
  const roastCostPerKg = totalRoastStageCost / input.roastedOutputKg;
  const allocate = (value: number) => value * finishedShareRatio;

  return {
    finishedShareRatio,
    remainingWipKg,
    roastCostPerKg,
    allocatedGreenCoffeeConsumedCost: allocate(
      input.greenCoffeeConsumedCost,
    ),
    allocatedRoastLossCost: allocate(input.roastLossCost),
    allocatedEnergyCost: allocate(input.energyCost),
    allocatedGasCost: allocate(input.gasCost),
    allocatedRoastStageCost: totalRoastStageCost * finishedShareRatio,
    remainingWipCost: roastCostPerKg * remainingWipKg,
  };
}

export function calculateRoastLoss(
  greenInputKg: number,
  roastedOutputKg: number,
): { lossKg: number; lossPercent: number } {
  if (!Number.isFinite(greenInputKg) || greenInputKg <= 0)
    throw new ProductionCostRuleError("O peso verde deve ser maior que zero.");
  if (
    !Number.isFinite(roastedOutputKg) ||
    roastedOutputKg < 0 ||
    roastedOutputKg > greenInputKg
  )
    throw new ProductionCostRuleError(
      "O peso torrado deve estar entre zero e o peso verde.",
    );
  const lossKg = greenInputKg - roastedOutputKg;
  return { lossKg, lossPercent: (lossKg / greenInputKg) * 100 };
}

export function calculateProductionCost(
  input: ProductionCostInput,
): ProductionCostResult {
  const monetaryValues = [
    input.greenCoffeeConsumedCost,
    input.roastLossCost,
    input.packagingCost,
    input.suppliesCost,
    input.laborCost,
    input.energyCost,
    input.gasCost,
    input.otherIndustrialCosts,
  ];
  if (monetaryValues.some((value) => !Number.isFinite(value) || value < 0))
    throw new ProductionCostRuleError(
      "Os componentes de custo devem ser valores não negativos.",
    );
  if (
    input.roastedOutputKg <= 0 ||
    input.finishedOutputKg <= 0 ||
    input.producedPackages <= 0
  )
    throw new ProductionCostRuleError(
      "A produção realizada deve ser maior que zero para calcular custos unitários.",
    );
  if (
    new Set(input.sourceCostEventIds).size !== input.sourceCostEventIds.length
  )
    throw new ProductionCostRuleError(
      "CostEvents duplicados não podem compor o custo da OP.",
    );
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
    standardCostDeviationPercent:
      standardTotal > 0
        ? (standardCostDeviationAmount / standardTotal) * 100
        : 0,
    sourceCostEventIds: [...input.sourceCostEventIds],
  };
}
