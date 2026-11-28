import assert from "node:assert/strict";
import test from "node:test";
import { coffeeCosts, costFromSetting, customerInsights, marginBreakdown, parseCoffeeCostSetting } from "./business-intelligence";

const coffees = [
  { coffeeId: "raros", coffeeName: "Raros" },
  { coffeeId: "frutado", coffeeName: "Frutado" },
  { coffeeId: "essencial", coffeeName: "Essencial" },
];
const roasts = [
  { coffeeId: "raros", coffeeName: "Raros", roasts: 4, greenKg: 57, greenCost: 1693.5, roastedKg: 48.5 },
  { coffeeId: "essencial", coffeeName: "Essencial", roasts: 3, greenKg: 82, greenCost: 2354.83, roastedKg: 69.7 },
];

test("custo: manual > torras reais > média da empresa", () => {
  const { average, costs } = coffeeCosts(coffees, roasts, [
    { coffeeId: "essencial", greenCostPerKg: 30, roastLossPercent: 15, updatedByName: "Gestor", updatedAt: "2026-11-28T00:00:00Z" },
  ]);
  assert.equal(average, 34.25);
  assert.equal(costs.get("raros")!.source, "ROASTS");
  assert.equal(costs.get("raros")!.costPerRoastedKg, 34.92);
  assert.equal(costs.get("frutado")!.source, "AVERAGE");
  assert.equal(costs.get("frutado")!.costPerRoastedKg, 34.25);
  assert.equal(costs.get("essencial")!.source, "MANUAL");
  assert.equal(costs.get("essencial")!.costPerRoastedKg, costFromSetting({ greenCostPerKg: 30, roastLossPercent: 15 }));
  assert.equal(costs.get("essencial")!.realCostPerRoastedKg, 33.79);
});

test("margem: café + embalagem, por café e por canal, com parte estimada", () => {
  const { costs } = coffeeCosts(coffees, roasts, []);
  const m = marginBreakdown([
    { orderId: "a", channel: "Distribuidor", coffeeId: "raros", coffeeName: "Raros", units: 4, kg: 1, revenue: 150 },
    { orderId: "b", channel: "Consumidor final", coffeeId: "frutado", coffeeName: "Frutado", units: 2, kg: 2, revenue: 200 },
    { orderId: "b", channel: "Consumidor final", coffeeId: null, coffeeName: null, units: 1, kg: 0, revenue: 50 },
  ], costs, 2);
  // custo: 1×34,92+4×2 = 42,92 ; 2×34,25+2×2 = 72,5 → 115,42 sobre 350 com custo
  assert.equal(m.total.revenue, 400);
  assert.equal(m.total.cost, 115);
  assert.equal(m.total.marginPercent, 67);
  assert.equal(m.total.orders, 2);
  assert.equal(m.total.estimatedShare, 50);
  assert.deepEqual(m.byChannel.map((c) => c.name), ["Consumidor final", "Distribuidor"]);
  assert.equal(m.byCoffee.find((c) => c.name === "Sem café definido")!.marginPercent, null);
  assert.equal(m.byCoffee.find((c) => c.name === "Raros")!.pricePerKg, 150);
});

test("clientes: ritmo, atraso, grande parado, uma vez e lista de ligação", () => {
  const now = new Date("2026-11-28T12:00:00Z");
  const d = (s: string) => `${s}T12:00:00Z`;
  const r = customerInsights([
    { customerId: "s", name: "Distribuidora A", phone: null, orderedAt: d("2026-11-12"), amount: 2000 },
    { customerId: "s", name: "Distribuidora A", phone: null, orderedAt: d("2026-11-20"), amount: 2000 },
    { customerId: "s", name: "Distribuidora A", phone: null, orderedAt: d("2026-11-28"), amount: 2000 },
    { customerId: "h", name: "Hospital B", phone: null, orderedAt: d("2026-11-13"), amount: 1360 },
    { customerId: "h", name: "Hospital B", phone: null, orderedAt: d("2026-11-18"), amount: 1360 },
    { customerId: "g", name: "Grande C", phone: null, orderedAt: d("2026-10-13"), amount: 5360 },
    { customerId: "u", name: "Novo D", phone: null, orderedAt: d("2026-11-19"), amount: 288 },
  ], now);
  const seg = Object.fromEntries(r.segments.map((s) => [s.key, s.count]));
  assert.deepEqual(seg, { NO_RITMO: 1, ATRASADO: 1, GRANDE_PARADO: 1, UMA_VEZ: 1, PARADO: 0 });
  assert.deepEqual(r.callList.map((c) => c.name), ["Grande C", "Hospital B", "Novo D"]);
  assert.equal(r.repeatRate, 50);
  assert.equal(r.concentration.top[0]!.name, "Distribuidora A");
  assert.equal(r.ticket, 2053);
});

test("ajuste manual: aceita vírgula, limpa com vazio, recusa absurdos", () => {
  assert.deepEqual(parseCoffeeCostSetting({ coffeeId: "x", greenCostPerKg: "31,50", roastLossPercent: "15" }), { coffeeId: "x", greenCostPerKg: 31.5, roastLossPercent: 15 });
  assert.deepEqual(parseCoffeeCostSetting({ coffeeId: "x", greenCostPerKg: "" }), { coffeeId: "x", greenCostPerKg: null, roastLossPercent: null });
  assert.throws(() => parseCoffeeCostSetting({ coffeeId: "x", greenCostPerKg: 0 }), /custo/);
  assert.throws(() => parseCoffeeCostSetting({ coffeeId: "x", greenCostPerKg: 30, roastLossPercent: 60 }), /perda/);
  assert.throws(() => parseCoffeeCostSetting({ greenCostPerKg: 30 }), /café/);
});

test("linha: lotes marcados dão o custo de cafés sem torra; até 3 linhas por lote", async () => {
  const { lineCosts, averageRoastLoss, parseIntendedLines } = await import("./business-intelligence");
  assert.equal(averageRoastLoss(roasts), 15.0);
  assert.equal(averageRoastLoss([]), 14);
  const byLine = lineCosts([
    { line: "EPICOS", greenCost: 3000, greenKg: 100 },
    { line: "EPICOS", greenCost: 1000, greenKg: 25 },
    { line: "RAROS", greenCost: 0, greenKg: 60 },
  ], 15);
  assert.equal(byLine.get("EPICOS"), 37.65);
  assert.equal(byLine.has("RAROS"), false);
  const { costs } = coffeeCosts([{ coffeeId: "frutado", coffeeName: "Frutado", line: "EPICOS" }, { coffeeId: "x", coffeeName: "X", line: "GOURMET" }], roasts, [], byLine);
  assert.equal(costs.get("frutado")!.source, "LINE");
  assert.equal(costs.get("frutado")!.costPerRoastedKg, 37.65);
  assert.equal(costs.get("x")!.source, "AVERAGE");
  assert.deepEqual(parseIntendedLines(["epicos", "RAROS", "EPICOS"]), ["EPICOS", "RAROS"]);
  assert.deepEqual(parseIntendedLines([]), []);
  assert.throws(() => parseIntendedLines(["RAROS", "EPICOS", "CLASSICOS", "GOURMET"]), /no máximo 3/);
  assert.throws(() => parseIntendedLines(["VERDE"]), /inválida/);
});
