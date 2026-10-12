import assert from "node:assert/strict";
import test from "node:test";
import { calculateProductionCost } from "@bbos/shared";
import { buildProductionCostInput } from "./production-cost-input";

test("reconstrói o custo completo da OP sem duplicar a embalagem", () => {
  const input = buildProductionCostInput({
    consumptions: [{ reservedKg: 30, realCostPerKg: 28.3333 }],
    batches: [{ lossKg: 4.5 }],
    packagingConsumptions: [{ totalCost: 84 }],
    costEvents: [
      { id: "packaging", type: "PACKAGING", amount: 84 },
      { id: "energy", type: "ENERGY", amount: 0.28 },
      { id: "gas", type: "GAS", amount: 5.19 },
    ],
    roastedOutputKg: 25.5,
    finishedOutputKg: 15,
    producedPackages: 30,
    sku: "GOU ESS 500",
  });
  const result = calculateProductionCost(input);

  assert.equal(input.packagingCost, 84);
  assert.equal(input.energyCost, 0.28);
  assert.equal(input.gasCost, 5.19);
  assert.ok(Math.abs(result.totalCost - 939.469) < 0.001);
  assert.ok(Math.abs(result.costPerFinishedKg - 62.631266) < 0.001);
  assert.ok(Math.abs(result.costPerPackage - 31.315633) < 0.001);
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
