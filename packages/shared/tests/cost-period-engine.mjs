import test from "node:test";
import assert from "node:assert/strict";
import { assertCostPeriodMutable, evaluateClosingReadiness, nextCostPeriodStatus, validateCostPeriod } from "../dist/cost-period-engine.js";

test("abre e percorre cálculo, revisão e fechamento", () => {
  validateCostPeriod({ startsAt: new Date("2026-08-01"), endsAt: new Date("2026-08-31") });
  assert.equal(nextCostPeriodStatus("OPEN", "CALCULATE"), "CALCULATING");
  assert.equal(nextCostPeriodStatus("CALCULATING", "REVIEW"), "REVIEW");
  assert.equal(nextCostPeriodStatus("REVIEW", "CLOSE"), "CLOSED");
});

test("período fechado rejeita alteração", () => {
  assert.throws(() => assertCostPeriodMutable("CLOSED"), /imutável/);
});

test("pré-fechamento identifica inconsistências críticas", () => {
  const issues = evaluateClosingReadiness({ costsWithoutCenter: 1, missingTariffs: 2, machinesWithoutParameters: 0, ordersWithoutUsage: 1, unallocatedCosts: 3, productsWithoutCost: 1 });
  assert.equal(issues.length, 5);
  assert.ok(issues.every((issue) => issue.severity === "CRITICAL"));
});
