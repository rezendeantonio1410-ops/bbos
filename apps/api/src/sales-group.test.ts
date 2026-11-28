import assert from "node:assert/strict";
import test from "node:test";
import { dailySalesGroups, groupSales, salesGroup } from "./sales-group";

test("Signa é o único B2B de parceiro; o resto se separa pelo tipo de cliente", () => {
  assert.equal(salesGroup({ partnerB2B: true, webStore: false, segment: "White Label" }), "Signa · parceira B2B");
  assert.equal(salesGroup({ partnerB2B: false, webStore: false, segment: "White Label" }), "White Label (Bispo)");
  assert.equal(salesGroup({ partnerB2B: false, webStore: false, segment: "Distribuidor" }), "Distribuidores");
  assert.equal(salesGroup({ partnerB2B: false, webStore: false, segment: "CAFETERIA" }), "Pontos de consumo");
  assert.equal(salesGroup({ partnerB2B: false, webStore: false, segment: "POSTO_CONVENIENCIA" }), "Pontos de consumo");
  assert.equal(salesGroup({ partnerB2B: false, webStore: false, segment: "Restaurante / Hotel" }), "Pontos de consumo");
  assert.equal(salesGroup({ partnerB2B: false, webStore: true, segment: "Cafeteria" }), "Loja online");
  assert.equal(salesGroup({ partnerB2B: false, webStore: false, marketplace: true, segment: null }), "Mercado Livre");
  assert.equal(salesGroup({ partnerB2B: false, webStore: false, segment: null }), "Outros / sem segmento");
});

test("soma por grupo e ordena pelo valor", () => {
  const g = groupSales([
    { partnerB2B: false, webStore: false, segment: "Cafeteria", revenue: 1368, orders: 3 },
    { partnerB2B: false, webStore: false, segment: "CAFETERIA", revenue: 360, orders: 1 },
    { partnerB2B: true, webStore: false, segment: "White Label", revenue: 9295, orders: 4 },
  ]);
  assert.deepEqual(g.map((x) => [x.name, x.revenue, x.orders]), [["Signa · parceira B2B", 9295, 4], ["Pontos de consumo", 1728, 4]]);
});

test("vendas por dia: soma por grupo dentro do mesmo dia, dias em ordem", () => {
  const days = dailySalesGroups([
    { day: "2026-11-27", partnerB2B: false, webStore: false, marketplace: true, segment: null, revenue: 100.5 },
    { day: "2026-11-27", partnerB2B: false, webStore: false, marketplace: true, segment: null, revenue: 50 },
    { day: "2026-11-27", partnerB2B: false, webStore: false, segment: "CAFETERIA", revenue: 300 },
    { day: "2026-11-20", partnerB2B: true, webStore: false, segment: "White Label", revenue: 1000 },
  ]);
  assert.deepEqual(days.map((d) => d.day), ["2026-11-20", "2026-11-27"]);
  assert.equal(days[0]?.groups["Signa · parceira B2B"], 1000);
  assert.equal(days[1]?.groups["Mercado Livre"], 150.5);
  assert.equal(days[1]?.groups["Pontos de consumo"], 300);
});
