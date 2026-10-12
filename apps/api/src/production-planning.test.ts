import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateComponentRequirements,
  calculateRoastCycleCount,
  calculateRoastMetrics,
  calculateRoasterUtilityCost,
  validateBlendComponents,
  validateRoastBatchCapacity,
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

test("custo por ciclo mantém energia e GLP com carga operacional de 17 kg", () => {
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
  assert.equal(result.operationalLoadKg, 17);
  assert.equal(result.roastMinutesPerBatch, 10);
  assert.equal(result.coolingMinutesPerBatch, 2);
  assert.equal(result.cycleMinutesPerBatch, 12);
  assert.ok(Math.abs(result.energyCostPerBatch - 0.28222) < 0.000001);
  assert.ok(Math.abs(result.gasCostPerBatch - 5.1851851852) < 0.000001);
});

test("custos totais escalam a partir da mesma referência por batelada", () => {
  const result = calculateRoasterUtilityCost({
    batchCount: 2,
    energyConsumptionKwhPerHour: 1.37,
    energyRatePerKwh: 1.03,
    gasConsumptionKgPerHour: 3.5,
    gasRatePerKg: 400 / 45,
  });
  assert.ok(Math.abs(result.energyCost - result.energyCostPerBatch * 2) < 1e-9);
  assert.ok(Math.abs(result.gasCost - result.gasCostPerBatch * 2) < 1e-9);
  assert.ok(Math.abs(result.totalCost - result.totalCostPerBatch * 2) < 1e-9);
});

test("quantidade de ciclos respeita a referência operacional de 17 kg", () => {
  assert.equal(calculateRoastCycleCount([17]), 1);
  assert.equal(calculateRoastCycleCount([17, 13]), 2);
  assert.equal(calculateRoastCycleCount([30]), 2);
  assert.equal(calculateRoastCycleCount([8, 8]), 2);
});

test("uma batelada não aceita mais de 17 kg de café verde", () => {
  assert.equal(validateRoastBatchCapacity(17), 17);
  assert.throws(
    () => validateRoastBatchCapacity(17.001),
    /até 17 kg de café verde/,
  );
});
