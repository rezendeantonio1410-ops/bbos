import assert from "node:assert/strict";
import test from "node:test";
import { purchaseOriginSnapshot } from "./purchase-origin-policy";

test("commercial seller without declared productive origin has no inferred farm or growing state", () => {
  const origin = purchaseOriginSnapshot({
    // A supplier's fiscal address must never be passed as growing provenance.
    originUnitId: null,
  });
  assert.deepEqual(origin, {
    originRegion: "",
    municipality: undefined,
    state: undefined,
    country: "Brasil",
    farmName: undefined,
  });
});

test("rural person owning multiple properties stores the explicitly selected farm only", () => {
  const farmA = purchaseOriginSnapshot({
    originUnitId: "farm-a",
    farmName: "Fazenda Santa Maria",
    municipality: "Londrina",
    state: "PR",
    originRegion: "Norte do Paraná",
  });
  const farmB = purchaseOriginSnapshot({
    originUnitId: "farm-b",
    farmName: "Fazenda Boa Vista",
    municipality: "Jacarezinho",
    state: "PR",
  });
  assert.equal(farmA.farmName, "Fazenda Santa Maria");
  assert.equal(farmB.farmName, "Fazenda Boa Vista");
  assert.equal(farmB.municipality, "Jacarezinho");
  assert.notEqual(farmA.farmName, farmB.farmName);
});
