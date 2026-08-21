import test from "node:test";
import assert from "node:assert/strict";
import { calculateComponentRequirements, calculateRoastMetrics, validateBlendComponents } from "./production-planning";

test("receita soma 100% e calcula necessidade por componente", () => {
  assert.equal(validateBlendComponents([{ coffeeLotId: "a", percentage: 60 }, { coffeeLotId: "b", percentage: 40 }]), 100);
  assert.deepEqual(calculateComponentRequirements(100, [{ coffeeLotId: "a", percentage: 60 }, { coffeeLotId: "b", percentage: 40 }]).map((item) => item.requiredKg), [60, 40]);
});

test("receita inválida é rejeitada", () => {
  assert.throws(() => validateBlendComponents([{ coffeeLotId: "a", percentage: 99 }]));
  assert.throws(() => validateBlendComponents([{ coffeeLotId: "a", percentage: 50 }, { coffeeLotId: "a", percentage: 50 }]));
});

test("perda e rendimento são calculados sem valores fictícios", () => {
  assert.deepEqual(calculateRoastMetrics(100, 83), { lossKg: 17, lossPercent: 17, yieldPercent: 83 });
  assert.throws(() => calculateRoastMetrics(100, 101));
});
