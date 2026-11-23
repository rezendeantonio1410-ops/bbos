import assert from "node:assert/strict";
import test from "node:test";
import { signaStateSales } from "./signa-region-map";

test("agrupa cidades por UF, ignora UF ausente/inválida e não inventa metas", () => {
  const result = signaStateSales([
    { state: "PR", city: "Londrina", orders: 2, kilograms: 2.5, orderValue: 187, customers: 1 },
    { state: "pr", city: "Maringá", orders: 1, kilograms: 1, orderValue: 38, customers: 1 },
    { state: "SP", city: "Campinas", orders: 1, kilograms: 0.5, orderValue: 19.5, customers: 1 },
    { state: null, city: null, orders: 1, kilograms: 3, orderValue: 100 },
    { state: "XX", city: "?", orders: 1, kilograms: 3, orderValue: 100 },
  ]);
  assert.deepEqual(result.map((s) => [s.stateCode, s.revenue, s.volumeKg, s.customers]), [["PR", 225, 3.5, 2], ["SP", 19.5, 0.5, 1]]);
  assert.ok(result.every((s) => s.status === "on-track" && !s.hasTarget && !s.hasMargin));
});
