import {
  allocateRoastStageCosts,
  type ProductionCostInput,
} from "@bbos/shared";

type ProductionCostSource = {
  consumptions: Array<Record<string, unknown>>;
  batches: Array<Record<string, unknown>>;
  packagingConsumptions: Array<Record<string, unknown>>;
  costEvents: Array<Record<string, unknown>>;
  roastedOutputKg: number;
  finishedOutputKg: number;
  producedPackages: number;
  sku: string;
};

export function buildProductionCostInput({
  consumptions,
  batches,
  packagingConsumptions,
  costEvents,
  roastedOutputKg,
  finishedOutputKg,
  producedPackages,
  sku,
}: ProductionCostSource): ProductionCostInput {
  const totalGreenCoffeeCost = consumptions.reduce(
    (sum, item) =>
      sum + Number(item.reservedKg ?? 0) * Number(item.realCostPerKg ?? 0),
    0,
  );
  const totalGreenCoffeeKg = consumptions.reduce(
    (sum, item) => sum + Number(item.reservedKg ?? 0),
    0,
  );
  const roastLossKg = batches.reduce(
    (sum, batch) => sum + Number(batch.lossKg ?? 0),
    0,
  );
  const averageGreenCoffeeCost =
    totalGreenCoffeeKg > 0 ? totalGreenCoffeeCost / totalGreenCoffeeKg : 0;
  const roastLossCost = Math.min(
    totalGreenCoffeeCost,
    roastLossKg * averageGreenCoffeeCost,
  );
  const eventAmount = (types: string[]) =>
    costEvents.reduce(
      (sum, item) =>
        types.includes(String(item.type))
          ? sum + Number(item.amount ?? 0)
          : sum,
      0,
    );
  const packagingConsumptionCost = packagingConsumptions.reduce(
    (sum, item) => sum + Number(item.totalCost ?? 0),
    0,
  );
  const greenCoffeeConsumedCost = Math.max(
    0,
    totalGreenCoffeeCost - roastLossCost,
  );
  const energyCost = eventAmount(["ENERGY"]);
  const gasCost = eventAmount(["GAS"]);
  const roastStageAllocation =
    roastedOutputKg > 0 &&
    finishedOutputKg > 0 &&
    finishedOutputKg <= roastedOutputKg
      ? allocateRoastStageCosts({
          greenCoffeeConsumedCost,
          roastLossCost,
          energyCost,
          gasCost,
          roastedOutputKg,
          finishedOutputKg,
        })
      : {
          allocatedGreenCoffeeConsumedCost: greenCoffeeConsumedCost,
          allocatedRoastLossCost: roastLossCost,
          allocatedEnergyCost: energyCost,
          allocatedGasCost: gasCost,
        };

  return {
    greenCoffeeConsumedCost:
      roastStageAllocation.allocatedGreenCoffeeConsumedCost,
    roastLossCost: roastStageAllocation.allocatedRoastLossCost,
    packagingCost: packagingConsumptions.length
      ? packagingConsumptionCost
      : eventAmount(["PACKAGING", "LABEL", "VALVE", "BOX"]),
    suppliesCost: eventAmount(["SUPPLIES"]),
    laborCost: eventAmount(["LABOR"]),
    energyCost: roastStageAllocation.allocatedEnergyCost,
    gasCost: roastStageAllocation.allocatedGasCost,
    otherIndustrialCosts: eventAmount([
      "DEPRECIATION",
      "MAINTENANCE",
      "OVERHEAD",
      "OTHER",
    ]),
    roastedOutputKg,
    finishedOutputKg,
    producedPackages,
    standardCostPerKg: 0,
    sku,
    sourceCostEventIds: costEvents.map((item) => String(item.id)),
  };
}
