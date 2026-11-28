import assert from "node:assert/strict";
import test from "node:test";
import { abcCurve, buildActions, cityKey, cityLabel, forecast, greenCoverage, marginWhatIf, productMatrix, profitBridge, resultTree, swot, threeSentences, windowMetrics, type Window } from "./bi-reading";

// Números de outubro e novembro (vendas diretas), custo por kg ≈ 37 e 38,6.
const base: Window = { revenue: 0, orders: 0, clients: 0, newClients: 0, newClientsRevenue: 0, kg: 0, units: 0, cost: 0, costedRevenue: 0, marketplaceRevenue: 0, marketplaceOrders: 0, greenInputKg: 0, roastedKg: 0 };
const prev = windowMetrics({ ...base, revenue: 9577, orders: 9, clients: 6, newClients: 6, newClientsRevenue: 9577, kg: 89.8, units: 215, cost: 89.8 * 37, costedRevenue: 9577, marketplaceRevenue: 995, marketplaceOrders: 13, greenInputKg: 90, roastedKg: 81 });
const cur = windowMetrics({ ...base, revenue: 29256, orders: 27, clients: 11, newClients: 8, newClientsRevenue: 18528, kg: 346.3, units: 788, cost: 346.3 * 38.6, costedRevenue: 29256, marketplaceRevenue: 2609, marketplaceOrders: 31, greenInputKg: 374, roastedKg: 317.9 });

test("métricas e árvore: clientes, frequência, pedido médio, preço e custo", () => {
  assert.equal(cur.ordersPerClient, 2.45);
  assert.equal(cur.ticket, 1084);
  assert.equal(cur.pricePerKg, 84.48);
  assert.equal(cur.lossPercent, 15);
  assert.equal(cur.totalRevenue, 31865);
  const t = resultTree(cur, prev);
  assert.equal(t.clients.better, true);
  assert.equal(t.pricePerKg.better, false);
  assert.equal(t.costPerKg.better, false);
  assert.equal(t.lossPercent.better, false);
});

test("ponte do lucro fecha: anterior + volume + preço + custo = atual", () => {
  const b = profitBridge(cur, prev);
  assert.ok(b.volume > 17000 && b.volume < 18500);
  assert.ok(b.price < -7000 && b.price > -8000);
  assert.ok(b.cost < 0);
  assert.ok(Math.abs(b.end - cur.profit) <= 3);
});

test("3 frases, projeção, café verde e simulação", () => {
  const s = threeSentences(cur, prev, ["o café verde acaba por volta de 27/12"]);
  assert.match(s.pulled, /11 clientes compraram \(eram 6\), 8 novos/);
  assert.match(s.held, /preço médio caiu de R\$ 107 para R\$ 84/);
  assert.match(s.watch, /^O café verde/);
  const f = forecast(cur, 8);
  assert.equal(f.likely, Math.round(11 * 2.45 * 1084 + 2609));
  assert.ok(f.conservative < f.likely && f.likely < f.growth);
  const g = greenCoverage(361, 374, new Date("2026-11-28T12:00:00Z"));
  assert.equal(g.days, 28);
  assert.equal(g.runOutAt, "2026-12-26");
  assert.equal(g.buyBy, "2026-12-11");
  assert.equal(greenCoverage(100, 0, new Date()).days, null);
  const w = marginWhatIf(cur, 28.28)!;
  assert.equal(w.lossTarget, 12);
  assert.ok(w.marginPercent > cur.marginPercent!);
});

test("matriz de produtos e curva ABC", () => {
  const m = productMatrix([
    { name: "Essencial", kg: 134, marginPercent: 51, revenue: 10769 },
    { name: "Singular", kg: 44, marginPercent: 70, revenue: 5896 },
    { name: "Raros", kg: 20, marginPercent: 73, revenue: 3038 },
    { name: "Intenso", kg: 14.5, marginPercent: 55, revenue: 1244 },
  ], 58);
  assert.deepEqual(m.groups.AJUSTAR_PRECO!.map((c) => c.name), ["Essencial"]);
  assert.deepEqual(m.groups.PROTEGER!.map((c) => c.name), ["Singular"]);
  assert.deepEqual(m.groups.EMPURRAR!.map((c) => c.name), ["Raros"]);
  assert.deepEqual(m.groups.REVER!.map((c) => c.name), ["Intenso"]);
  const abc = abcCurve([{ name: "A1", total: 60 }, { name: "A2", total: 20 }, { name: "B1", total: 12 }, { name: "C1", total: 5 }, { name: "C2", total: 3 }]);
  assert.deepEqual(abc.A, ["A1", "A2"]);
  assert.deepEqual(abc.B, ["B1"]);
  assert.deepEqual(abc.C, ["C1", "C2"]);
  assert.equal(abc.share.A, 80);
});

test("plano 5W2H: ações vêm dos ramos que pioraram e dos riscos, por impacto", () => {
  const green = greenCoverage(361, 374, new Date("2026-11-28T12:00:00Z"));
  const actions = buildActions({ cur, prev, green, greenCostPerKg: 28.28, reactivate: { id: "s", name: "Cliente Grande", value: 5360, daysSince: 45 }, newClients: 8, topShare: 55, latePayer: { id: "h", name: "Cliente Lento", days: 6.8 }, batchConfirmShare: 50, pushCoffees: ["Raros"], adjustCoffees: ["Essencial", "Dual"] });
  const keys = actions.map((a) => a.key);
  assert.equal(keys[0], "GREEN");
  assert.ok(keys.includes("PRICE") && keys.includes("LOSS") && keys.includes("REACTIVATE:s") && keys.includes("SECOND") && keys.includes("DELIVERY_DATA"));
  const price = actions.find((a) => a.key === "PRICE")!;
  assert.equal(price.impact, Math.round(5 * 346.3));
  assert.match(price.why, /caiu 21/);
  assert.equal(actions.find((a) => a.key === "GREEN")!.when, "até 11/12");
  for (const a of actions) assert.ok(a.why && a.how && a.who && a.when);
});

test("FOFA com números e cidades normalizadas", () => {
  const green = greenCoverage(361, 374, new Date("2026-11-28T12:00:00Z"));
  const s = swot({ cur, prev, repeatRate: 53, bestChannel: { name: "Distribuidor", marginPercent: 66 }, overdueAmount: 0, avgDaysToCash: 4.7, topShare: 55, topName: "Cliente A", green, stalledBig: { name: "Cliente G", value: 5360 }, latePayer: null, pushCoffees: ["Raros"], bestCity: { name: "Ponta Grossa", revenue: 16046, clients: 2 }, marketplaceGrowth: 162, weakDay: "Quinta", exactCostShare: 76, batchConfirmShare: 50, adjustCoffees: ["Essencial"] });
  assert.match(s.strengths.join(" "), /Ninguém em atraso; o dinheiro entra em 4,7 dias/);
  assert.match(s.weaknesses.join(" "), /Perda na torra subiu de 10% para 15%/);
  assert.match(s.opportunities.join(" "), /Ponta Grossa/);
  assert.match(s.threats.join(" "), /3 clientes fazem 55%/);
  assert.equal(cityKey("LONDRINA", "pr"), cityKey("Londrina", "PR"));
  assert.equal(cityKey("Maringá", "PR"), cityKey("MARINGA", "PR"));
  assert.equal(cityLabel("PONTA GROSSA"), "Ponta Grossa");
  assert.equal(cityLabel("são josé dos pinhais"), "São José dos Pinhais");
});
