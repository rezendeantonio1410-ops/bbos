import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateComponentRequirements,
  calculateRoastMetrics,
  calculateRoasterUtilityCost,
  validateBlendComponents,
} from "./production-planning";

test("receita soma 100% e calcula necessidade por componente", () => {
  assert.equal(
    validateBlendComponents([
      { coffeeLotId: "a", percentage: 60 },
      { coffeeLotId: "b", percentage: 40 },
    ]),
    100,
  );
  assert.deepEqual(
    calculateComponentRequirements(100, [
      { coffeeLotId: "a", percentage: 60 },
      { coffeeLotId: "b", percentage: 40 },
    ]).map((item) => item.requiredKg),
    [60, 40],
  );
});

test("receita inválida é rejeitada", () => {
  assert.throws(() =>
    validateBlendComponents([{ coffeeLotId: "a", percentage: 99 }]),
  );
  assert.throws(() =>
    validateBlendComponents([
      { coffeeLotId: "a", percentage: 50 },
      { coffeeLotId: "a", percentage: 50 },
    ]),
  );
});

test("perda e rendimento são calculados sem valores fictícios", () => {
  assert.deepEqual(calculateRoastMetrics(100, 83), {
    lossKg: 17,
    lossPercent: 17,
    yieldPercent: 83,
  });
  assert.throws(() => calculateRoastMetrics(100, 101));
});

test("custo do Atilla separa energia do ciclo e GLP da torra", () => {
  const result = calculateRoasterUtilityCost({
    batchCount: 1,
    energyConsumptionKwhPerHour: 1.37,
    energyRatePerKwh: 1.03,
    gasConsumptionKgPerHour: 3.5,
    gasRatePerKg: 400 / 45,
  });
  assert.equal(result.energyKwh, 0.274);
  assert.ok(Math.abs(result.gasKg - 0.5833333333) < 0.000001);
  assert.ok(Math.abs(result.energyCost - 0.28222) < 0.000001);
  assert.ok(Math.abs(result.gasCost - 5.1851851852) < 0.000001);
  assert.ok(Math.abs(result.totalCost - 5.4674051852) < 0.000001);
});
