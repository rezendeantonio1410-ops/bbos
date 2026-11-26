import assert from "node:assert/strict";
import test from "node:test";
import { greenConsumptionPortions } from "./production-consumption";

const lots = [
  { id: "c1", coffeeLotId: "lv3", reservedKg: "15.000", consumedKg: "0.000", coffeeLot: { warehouseId: "w" } },
  { id: "c2", coffeeLotId: "lv4", reservedKg: "45.000", consumedKg: "0.000", coffeeLot: { warehouseId: "w" } },
];

test("a roast takes its green input from the reserved lots, in order", () => {
  assert.deepEqual(greenConsumptionPortions(lots, 50).map((p) => [p.coffeeLotId, p.quantityKg]), [["lv3", 15], ["lv4", 35]]);
});

test("never more than what is still reserved, and nothing twice", () => {
  assert.deepEqual(greenConsumptionPortions(lots, 80).map((p) => p.quantityKg), [15, 45]);
  const half = [{ ...lots[0]!, consumedKg: "15.000" }, { ...lots[1]!, consumedKg: "20.000" }];
  assert.deepEqual(greenConsumptionPortions(half, 30).map((p) => [p.coffeeLotId, p.quantityKg]), [["lv4", 25]]);
  assert.deepEqual(greenConsumptionPortions(lots, 0), []);
});
