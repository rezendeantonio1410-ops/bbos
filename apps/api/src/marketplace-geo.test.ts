import assert from "node:assert/strict";
import test from "node:test";
import { marketplaceSummaryOrders, shipmentDestination, shipmentIdOf } from "./marketplace-geo";
import { buildSalesSummary } from "./sales-summary";

test("destino do envio: formato clássico e novo", () => {
  assert.deepEqual(
    shipmentDestination({ receiver_address: { city: { name: "Cidade Exemplo" }, state: { id: "BR-SP", name: "São Paulo" }, street_name: "Rua X" } }),
    { city: "Cidade Exemplo", state: "SP" },
  );
  assert.deepEqual(
    shipmentDestination({ destination: { shipping_address: { city: { name: "Outra Cidade" }, state: { name: "Paraná" } } } }),
    { city: "Outra Cidade", state: "PR" },
  );
  assert.equal(shipmentDestination({ receiver_address: { city: { name: "" }, state: { id: "BR-SP" } } }), null);
  assert.equal(shipmentDestination({}), null);
});

test("número do envio dentro do pedido", () => {
  assert.equal(shipmentIdOf({ shipping: { id: 4433 } }), "4433");
  assert.equal(shipmentIdOf({ shipping: {} }), null);
});

test("pedidos do marketplace entram no mapa e no ranking de cidades sem nomes de compradores", () => {
  const rows = [
    { id: "1", channelName: "Mercado Livre", orderedAt: "2026-11-20T12:00:00Z", grossAmount: 89.9, city: "Cidade Exemplo", state: "SP", payload: { order_items: [{ quantity: 2, item: { seller_sku: "cafe-250" } }] } },
    { id: "2", channelName: "Mercado Livre", orderedAt: "2026-11-21T12:00:00Z", grossAmount: 60, city: null, state: null },
  ];
  const orders = marketplaceSummaryOrders(rows, new Map([["CAFE-250", 250]]));
  assert.equal(orders[0]!.customer.name, "Mercado Livre · consumidores");
  const summary = buildSalesSummary(orders, [], { start: new Date("2026-11-01T03:00:00Z"), now: new Date("2026-11-27T12:00:00Z"), previousStart: new Date("2026-10-01T03:00:00Z") });
  assert.equal(summary.revenue, 149.9);
  assert.equal(summary.volumeKg, 0.5);
  assert.deepEqual(summary.byState.map((s) => s.state), ["SP"]);
  assert.deepEqual(summary.byCity.map((c) => c.city), ["Cidade Exemplo"]);
  assert.equal(summary.unlocated.orders, 1);
});
