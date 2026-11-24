import assert from "node:assert/strict";
import test from "node:test";
import { buildSalesSummary } from "./sales-summary";

const order = (id: string, day: string, amount: number, customer: { id: string; name: string; state?: string | null; city?: string | null }, grams = 250, qty = 4) => ({
  id, totalAmount: amount, orderedAt: new Date(`${day}T12:00:00Z`), customer,
  items: [{ quantity: qty, productVariant: { netWeightGrams: grams } }],
});
const londrina = { id: "c1", name: "Café Central", state: "PR", city: "Londrina" };
const curitiba = { id: "c2", name: "Empório", state: "Paraná", city: "Curitiba" };
const semCidade = { id: "c3", name: "Sem Endereço", state: null, city: null };

test("totais, ticket, volume e crescimento contra o período anterior", () => {
  const summary = buildSalesSummary(
    [order("a", "2026-11-02", 100, londrina), order("b", "2026-11-03", 300, curitiba), order("c", "2026-11-03", 100, semCidade)],
    [order("p", "2026-10-02", 250, londrina)],
    { start: new Date("2026-11-01T00:00:00Z"), now: new Date("2026-11-04T00:00:00Z"), previousStart: new Date("2026-10-01T00:00:00Z") },
  );
  assert.equal(summary.revenue, 500);
  assert.equal(summary.orders, 3);
  assert.equal(summary.averageTicket, 166.67);
  assert.equal(summary.volumeKg, 3);
  assert.equal(summary.growthPercent, 100);
  assert.deepEqual(summary.cumulative.map((p) => [p.day, p.current, p.previous]), [[1, 0, 0], [2, 100, 250], [3, 500, 250]]);
});

test("vendas por estado (sigla ou nome) e por cidade; sem endereço fica separado", () => {
  const summary = buildSalesSummary(
    [order("a", "2026-11-02", 100, londrina), order("b", "2026-11-03", 300, curitiba), order("c", "2026-11-03", 50, semCidade), order("d", "2026-11-03", 20, { id: "c1", name: "Café Central", state: "pr", city: "LONDRINA" })],
    [],
    { start: new Date("2026-11-01T00:00:00Z"), now: new Date("2026-11-04T00:00:00Z"), previousStart: new Date("2026-10-01T00:00:00Z") },
  );
  assert.deepEqual(summary.byState.map((s) => [s.state, s.name, s.revenue, s.orders, s.customers]), [["PR", "Paraná", 420, 3, 2]]);
  assert.deepEqual(summary.byCity.map((c) => [c.city, c.revenue, c.orders, c.customers]), [["Curitiba", 300, 1, 1], ["Londrina", 120, 2, 1]]);
  assert.deepEqual(summary.unlocated, { revenue: 50, orders: 1 });
  assert.equal(summary.growthPercent, null);
  assert.equal(summary.topCustomers[0]?.name, "Empório");
});
