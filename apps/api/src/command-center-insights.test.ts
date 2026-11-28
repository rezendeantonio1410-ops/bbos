import assert from "node:assert/strict";
import test from "node:test";
import { itemLabel, marketplaceOrderList, marketplaceShipState, monthMargin, orderShipState, salesOfTheDay, payerDelays, repurchaseHealth, snoozeUntil, validateGoal, validateTaskKey } from "./command-center-insights";

const now = new Date("2026-11-27T12:00:00Z");
const d = (iso: string) => new Date(`${iso}T12:00:00Z`);

test("recompra: aponta quem passou bem do ritmo habitual", () => {
  const result = repurchaseHealth([
    // a cada ~20 dias, último há 37 dias → atrasado
    { customerId: "a", name: "Café Exemplo", orderedAt: [d("2026-09-01"), d("2026-09-21"), d("2026-10-11"), d("2026-10-21")] },
    // a cada ~30 dias, último há 10 dias → em dia
    { customerId: "b", name: "Padaria Teste", orderedAt: [d("2026-08-17"), d("2026-09-17"), d("2026-10-17"), d("2026-11-17")] },
    // só 2 pedidos → não é recorrente
    { customerId: "c", name: "Novo", orderedAt: [d("2026-06-01"), d("2026-07-01")] },
    // sumiu há mais de 180 dias → fora
    { customerId: "e", name: "Antigo", orderedAt: [d("2025-12-01"), d("2026-01-01"), d("2026-02-01")] },
  ], now);
  assert.equal(result.recurring, 3);
  assert.deepEqual(result.lapsed.map((c) => c.name), ["Café Exemplo"]);
  assert.equal(result.lapsed[0]!.daysSince, 37);
  assert.equal(result.onTimeRate, 67);
});

test("recompra: pedidos no mesmo dia contam uma vez", () => {
  const result = repurchaseHealth([{ customerId: "a", name: "X", orderedAt: [d("2026-11-01"), d("2026-11-01"), d("2026-11-10")] }], now);
  assert.equal(result.recurring, 0);
});

test("atraso médio só para quem tem 2+ títulos e atrasa 3+ dias", () => {
  const rows = [
    { customerId: "a", name: "Hospital Exemplo", dueDate: d("2026-10-01"), paymentDate: d("2026-10-08") },
    { customerId: "a", name: "Hospital Exemplo", dueDate: d("2026-11-01"), paymentDate: d("2026-11-06") },
    { customerId: "b", name: "Pontual", dueDate: d("2026-10-01"), paymentDate: d("2026-09-30") },
    { customerId: "b", name: "Pontual", dueDate: d("2026-11-01"), paymentDate: d("2026-11-01") },
    { customerId: "c", name: "Uma vez", dueDate: d("2026-10-01"), paymentDate: d("2026-10-20") },
  ];
  assert.deepEqual(payerDelays(rows), [{ customerId: "a", name: "Hospital Exemplo", avgDelayDays: 6, paidCount: 2 }]);
});

test("adiar: amanhã 6h, 7 dias ou 30 dias quando feito", () => {
  assert.equal(snoozeUntil("TOMORROW", now).toISOString(), "2026-11-28T09:00:00.000Z");
  assert.equal(snoozeUntil("WEEK", now).toISOString(), "2026-12-04T12:00:00.000Z");
  assert.equal(snoozeUntil("DONE", now).toISOString(), "2026-12-27T12:00:00.000Z");
  assert.throws(() => snoozeUntil("NUNCA", now), /inválida/);
  assert.throws(() => validateTaskKey(""), /inválida/);
});

test("meta do mês aceita formato brasileiro e remove com zero", () => {
  assert.deepEqual(validateGoal({ month: "2026-12", salesTarget: "30.000,50" }), { month: "2026-12", salesTarget: 30000.5 });
  assert.deepEqual(validateGoal({ month: "2026-12", salesTarget: 0 }), { month: "2026-12", salesTarget: null });
  assert.throws(() => validateGoal({ month: "2026-13", salesTarget: 1 }), /Mês/);
  assert.throws(() => validateGoal({ month: "2026-12", salesTarget: "abc" }), /meta/);
});

test("margem usa só itens com custo e informa a cobertura", () => {
  assert.deepEqual(monthMargin({ revenue: 20000, costedRevenue: 16000, cost: 10400 }), {
    revenue: 20000, marginPercent: 35, marginAmount: 7000, coveragePercent: 80,
  });
  assert.equal(monthMargin({ revenue: 1000, costedRevenue: 0, cost: 0 }).marginPercent, null);
});

test("vendas do dia somam BBOS e marketplace, por canal e mais recentes primeiro", () => {
  const day = salesOfTheDay(
    [{ id: "1", code: "B-1", at: "2026-11-27T13:00:00Z", amount: 288, customer: "Cafeteria Exemplo", channel: "Consumidor final", marketplace: false }],
    [
      { id: "mp-1", code: "200001", at: "2026-11-27T11:11:00Z", amount: 89.9, customer: null, channel: "Mercado Livre", marketplace: true },
      { id: "mp-2", code: "200002", at: "2026-11-27T14:30:00Z", amount: 59.9, customer: null, channel: "Mercado Livre", marketplace: true },
    ],
  );
  assert.equal(day.total, 437.8);
  assert.equal(day.orders, 3);
  assert.deepEqual(day.byChannel.map((c) => [c.channel, c.orders]), [["Consumidor final", 1], ["Mercado Livre", 2]]);
  assert.deepEqual(day.feed.map((s) => s.code), ["200002", "B-1", "200001"]);
});

test("lista do marketplace: itens, situação e totais sem cancelados", () => {
  const base = { externalStatus: "paid", orderedAt: "2026-11-27T17:32:00Z", fee: 10, freight: 0, importStatus: "RECEIVED", salesOrderId: null, channel: "Mercado Livre", platform: "MERCADO_LIVRE", city: "Cidade Exemplo", state: "SP" };
  const list = marketplaceOrderList([
    { ...base, id: "1", externalOrderId: "2001", gross: 77, items: [{ item: { title: "Café Exemplo 250 g", seller_sku: "C-250" }, quantity: 2, unit_price: 38.5 }] },
    { ...base, id: "2", externalOrderId: "2002", gross: 50, externalStatus: "cancelled", items: [] },
    { ...base, id: "3", externalOrderId: "2003", gross: 84, salesOrderId: "so-1", city: null, items: null },
  ]);
  assert.deepEqual(list.orders.map((o) => o.status), ["TO_IMPORT", "CANCELLED", "IMPORTED"]);
  assert.equal(list.orders[0]!.destination, "Cidade Exemplo/SP");
  assert.equal(list.orders[2]!.destination, null);
  assert.deepEqual(list.totals, { orders: 2, cancelled: 1, gross: 161, fees: 20, net: 141, averageTicket: 80.5, units: 2 });
});

test("vendas de hoje: produto resumido e situação do envio", () => {
  assert.equal(itemLabel([{ name: "Café Em Grãos Especial Bispo Caramelo Chocolate 500g", quantity: 2 }]), "2× Caramelo Chocolate");
  assert.equal(itemLabel([{ name: "Café Moído Especial Bispo Singular Frutado 500g", quantity: 1 }, { name: "Outro", quantity: 1 }]), "1× Singular Frutado e mais 1");
  assert.equal(itemLabel([{ name: "Espresso Clássico 1 kg", quantity: 3 }]), "3× Espresso Clássico");
  assert.equal(itemLabel([]), null);
  assert.equal(orderShipState("READY_TO_SHIP"), "TO_SHIP");
  assert.equal(orderShipState("SHIPPED"), "SHIPPED");
  assert.equal(orderShipState("DELIVERED"), "DELIVERED");
  assert.equal(marketplaceShipState(["paid", "not_delivered"]), "TO_SHIP");
  assert.equal(marketplaceShipState(["paid", "delivered"]), "DELIVERED");
  assert.equal(marketplaceShipState(null), "TO_SHIP");
});
