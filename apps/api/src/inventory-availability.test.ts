import assert from "node:assert/strict";
import test from "node:test";
import { isGreenCoffeeProductionAvailable, productionAvailableWeight } from "./inventory-availability";

test("approved lot with positive balance is production-available", () => {
  assert.equal(isGreenCoffeeProductionAvailable("APPROVED", 1200), true);
  assert.equal(productionAvailableWeight("APPROVED", 1200), 1200);
});

test("quality review and blocked lots are not production-available", () => {
  assert.equal(isGreenCoffeeProductionAvailable("QUALITY_REVIEW", 1200), false);
  assert.equal(productionAvailableWeight("BLOCKED", 1200), 0);
  assert.equal(productionAvailableWeight("APPROVED", -1), 0);
});
