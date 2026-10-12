import assert from "node:assert/strict";
import test from "node:test";
import {
  allocateRoastStageCosts,
  calculateProductionCost,
} from "@bbos/shared";
import { buildProductionCostInput } from "./production-cost-input";

test("rateia a torra entre produto acabado e WIP sem duplicar a embalagem", () => {
  const input = buildProductionCostInput({
    consumptions: [{ reservedKg: 30, realCostPerKg: 28.3333 }],
    batches: [{ lossKg: 4.5 }],
    packagingConsumptions: [{ totalCost: 84 }],
    costEvents: [
      { id: "packaging", type: "PACKAGING", amount: 84 },
      { id: "energy", type: "ENERGY", amount: 0.56 },
      { id: "gas", type: "GAS", amount: 10.37 },
    ],
    roastedOutputKg: 25.5,
    finishedOutputKg: 15,
    producedPackages: 30,
    sku: "GOU ESS 500",
  });
  const result = calculateProductionCost(input);

  assert.equal(input.packagingCost, 84);
  assert.ok(Math.abs(input.energyCost - 0.32941176) < 0.000001);
  assert.ok(Math.abs(input.gasCost - 6.1) < 0.000001);
  assert.ok(Math.abs(result.totalCost - 590.42882352) < 0.000001);
  assert.ok(Math.abs(result.costPerFinishedKg - 39.36192157) < 0.000001);
  assert.ok(Math.abs(result.costPerPackage - 19.68096078) < 0.000001);

  const allocation = allocateRoastStageCosts({
    greenCoffeeConsumedCost: 700,
    roastLossCost: 150,
    energyCost: 0.56,
    gasCost: 10.37,
    roastedOutputKg: 25.5,
    finishedOutputKg: 15,
  });
  assert.ok(Math.abs(allocation.remainingWipKg - 10.5) < 0.000001);
  assert.ok(Math.abs(allocation.remainingWipCost - 354.50058824) < 0.000001);
});

test("usa o lançamento de embalagem quando não há consumo detalhado", () => {
  const input = buildProductionCostInput({
    consumptions: [],
    batches: [],
    packagingConsumptions: [],
    costEvents: [
      { id: "packaging", type: "PACKAGING", amount: 42 },
      { id: "label", type: "LABEL", amount: 8 },
    ],
    roastedOutputKg: 1,
    finishedOutputKg: 1,
    producedPackages: 1,
    sku: "TESTE",
  });

  assert.equal(input.packagingCost, 50);
});
