import assert from "node:assert/strict";
import test from "node:test";
import { buildCustomerOrderInsights, cadenceText, searchOrderCustomers } from "./customer-order-insights";

const variants = [
  { productVariantId: "v250", sku: "RES-250", product: "Reserva", presentationGrams: 250 },
  { productVariantId: "v1k", sku: "CLA-1000", product: "Clássico", presentationGrams: 1000 },
  { productVariantId: "v500", sku: "CAR-500", product: "Caramelo", presentationGrams: 500 },
];
const order = (orderNumber: string, orderedAt: string, items: Array<[string, number]>, status = "DELIVERED") => ({
  orderNumber, orderedAt, status, totalAmount: 100,
  items: items.map(([sku, quantity]) => ({ sku, quantity, productName: sku })),
});

test("último pedido vira linhas para repetir, ignorando cancelados e SKU sem produto", () => {
  const insights = buildCustomerOrderInsights([
    order("B-3", "2026-11-20T12:00:00Z", [["RES-250", 6], ["CLA-1000", 2]], "CANCELLED"),
    order("B-2", "2026-11-14T12:00:00Z", [["RES-250", 6], ["X-NOPE", 3], ["RES-250", 2]]),
    order("B-1", "2026-11-01T12:00:00Z", [["CLA-1000", 4]]),
  ], variants, Date.parse("2026-11-23T12:00:00Z"));
  assert.equal(insights.ordersCount, 2);
  assert.equal(insights.lastOrder?.orderNumber, "B-2");
  assert.deepEqual(insights.lastOrder?.lines, [{ variantId: "v250", quantity: 8 }]);
  assert.equal(insights.daysSinceLast, 9);
  assert.equal(insights.cadenceDays, 13);
});

test("produtos habituais vêm com a quantidade mediana e os mais frequentes primeiro", () => {
  const insights = buildCustomerOrderInsights([
    order("B-4", "2026-11-21T12:00:00Z", [["RES-250", 10]]),
    order("B-3", "2026-11-14T12:00:00Z", [["RES-250", 6], ["CAR-500", 3]]),
    order("B-2", "2026-11-07T12:00:00Z", [["RES-250", 6]]),
  ], variants);
  assert.deepEqual(insights.usualProducts.map((p) => [p.variantId, p.quantity, p.timesOrdered]), [["v250", 6, 3], ["v500", 3, 1]]);
  assert.equal(insights.usualProducts[0]?.label, "Reserva 250 g");
  assert.equal(insights.cadenceDays, 7);
});

test("cliente sem histórico não gera sugestão", () => {
  const insights = buildCustomerOrderInsights([], variants);
  assert.equal(insights.lastOrder, null);
  assert.equal(insights.cadenceDays, null);
  assert.deepEqual(insights.usualProducts, []);
  assert.equal(cadenceText(insights), null);
});

test("busca de cliente por nome sem acento; sem busca mostra os recentes", () => {
  const customers = [
    { id: "a", name: "Café Central", segment: "Cafeteria" },
    { id: "b", name: "Empório Serra", segment: "Varejo" },
    { id: "c", name: "Central Distribuidora", segment: "Distribuidor" },
  ];
  assert.deepEqual(searchOrderCustomers(customers, "central", []).map((c) => c.id), ["c", "a"]);
  assert.deepEqual(searchOrderCustomers(customers, "emporio", []).map((c) => c.id), ["b"]);
  assert.deepEqual(searchOrderCustomers(customers, "", ["b", "zz", "a"]).map((c) => c.id), ["b", "a"]);
});
