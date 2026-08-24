import test from "node:test";
import assert from "node:assert/strict";
import { calculateWeightVariance } from "./receipts-weight";

test("calculates a complete receipt inside tolerance", () => {
  const result = calculateWeightVariance(6000, 0, 5970, 1);
  assert.equal(result.differenceKg, -30);
  assert.equal(result.differencePercent, -0.5);
  assert.equal(result.withinTolerance, true);
});

test("flags a complete receipt outside tolerance", () => {
  const result = calculateWeightVariance(6000, 0, 6060, 0.5);
  assert.equal(result.differencePercent, 1);
  assert.equal(result.withinTolerance, false);
});

test("does not flag an intentionally partial receipt", () => {
  const result = calculateWeightVariance(6000, 0, 1800, 1);
  assert.equal(result.partial, true);
  assert.equal(result.withinTolerance, true);
});
