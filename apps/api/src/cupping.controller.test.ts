import test from "node:test";
import assert from "node:assert/strict";
import { scoreCuppingAttributes } from "./cupping-score";

test("calculates the cupping score from completed attributes", () => {
  const attributes = { fragrance: 8, flavor: 8.5, aftertaste: 7.5, acidity: 8, body: 7, uniformity: 10, balance: 8, cleanCup: 10, sweetness: 9, overall: 8.5 };
  assert.equal(scoreCuppingAttributes(attributes), 8.45);
});

test("returns no score for an incomplete evaluation", () => {
  assert.equal(scoreCuppingAttributes({ fragrance: 8, flavor: "" }), 8);
});
