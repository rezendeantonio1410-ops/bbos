import assert from "node:assert/strict";
import test from "node:test";
import { purchaseOrigin, supplierWithoutUnits } from "./purchase-origin";

const farm = { id: "u1", name: "Sítio Boa Vista", state: "MG", municipality: "Carmo de Minas", coffeeRegionId: "r1", coffeeRegion: { name: "Mantiqueira" } };

test("a company without farms is allowed and the origin is typed on the purchase", () => {
  const belaEpoca = { city: "Garça", country: "Brasil", originUnits: [] };
  assert.equal(supplierWithoutUnits(belaEpoca), true);
  assert.equal(supplierWithoutUnits({ originUnits: [farm] }), false);
  assert.equal(supplierWithoutUnits(undefined), false);
  assert.deepEqual(purchaseOrigin({ supplier: belaEpoca, state: "SP", municipality: " ", region: { id: "r9", name: "Alta Mogiana" } }), {
    originUnitId: undefined, farmName: undefined, state: "SP", municipality: "Garça", originRegion: "Alta Mogiana", coffeeRegionId: "r9", country: "Brasil",
  });
  assert.equal(purchaseOrigin({ supplier: belaEpoca, state: "SP" }).originRegion, "");
});

test("a producer keeps the farm as origin", () => {
  const origin = purchaseOrigin({ supplier: { originUnits: [farm] }, unit: farm, state: "SP", municipality: "ignored" });
  assert.equal(origin.originUnitId, "u1");
  assert.equal(origin.state, "MG");
  assert.equal(origin.municipality, "Carmo de Minas");
  assert.equal(origin.coffeeRegionId, "r1");
});
