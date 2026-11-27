import assert from "node:assert/strict";
import test from "node:test";
import {
  delayFor,
  fixedBufferDays,
  goalProgress,
  orderTasks,
  parseGoalInput,
  repeatedDays,
  saneBufferDays,
  taskSnoozeKey,
  weekWins,
  withoutSnoozed,
  type CommandInsights,
} from "./command-center-v6";

test("tarefa adiada some; se o texto muda, volta", () => {
  const tasks = [{ key: "roast", title: "Torra 18 kg atrás" }, { key: "overdue", title: "Cobrar R$ 720" }];
  const hidden = [taskSnoozeKey(tasks[0]!)];
  assert.deepEqual(withoutSnoozed(tasks, hidden).map((t) => t.key), ["overdue"]);
  assert.equal(withoutSnoozed([{ key: "roast", title: "Torra 30 kg atrás" }], hidden).length, 1);
});

test("alerta repetido há 7+ dias vai para o fim da mesma gravidade", () => {
  const now = Date.parse("2026-11-27T12:00:00Z");
  assert.equal(repeatedDays("2026-11-17T12:00:00Z", now), 10);
  const ordered = orderTasks([
    { id: "old", tone: "attention" as const, repeatedDays: 10 },
    { id: "ok", tone: "ok" as const },
    { id: "new", tone: "attention" as const, repeatedDays: 1 },
    { id: "crit", tone: "critical" as const, repeatedDays: 20 },
  ]);
  assert.deepEqual(ordered.map((t) => t.id), ["crit", "new", "old", "ok"]);
});

test("dias de caixa: barra valor absurdo e calcula só com fixas", () => {
  assert.equal(saneBufferDays(13392), null);
  assert.equal(saneBufferDays(5), 5);
  assert.equal(fixedBufferDays(6740, [{ amount: 9798.61 }]), 21);
  assert.equal(fixedBufferDays(6740, []), null);
});

test("meta do mês: progresso, projeção e falta por dia", () => {
  assert.deepEqual(goalProgress(24000, 30000, 26600, 3), {
    target: 30000, percent: 80, projectedPercent: 89, missing: 6000, perDay: 2000, reached: false, onTrack: false,
  });
  assert.equal(goalProgress(24000, null, 26600, 3), null);
  assert.equal(parseGoalInput("R$ 30.000,00"), 30000);
  assert.equal(parseGoalInput(""), null);
});

test("vitórias só com fatos positivos", () => {
  const insights = { wins: { deliveredOrders: 7, received: 5400.4, newCustomers: 0, directShipmentsPosted: 1 } } as CommandInsights;
  assert.deepEqual(
    weekWins({ insights, growthPercent: 153, previousMonthName: "outubro", goal: null, roastDone: false }).map((w) => w.replace(/\u00a0/g, " ")),
    ["7 pedidos entregues", "R$ 5.400 recebidos", "1 envio direto postado", "2,5× outubro"],
  );
  assert.deepEqual(weekWins({ insights: null, growthPercent: -5, previousMonthName: "outubro", goal: null, roastDone: false }), []);
});

test("atraso habitual pelo nome do cliente", () => {
  const delays = [{ customerId: "a", name: "Hospital Exemplo", avgDelayDays: 6, paidCount: 3 }];
  assert.equal(delayFor("hospital exemplo ", delays), 6);
  assert.equal(delayFor("Outro", delays), null);
});

test("faixa de hoje destaca só o que chegou desde a última leitura", async () => {
  const { freshSaleIds, saleTime } = await import("./command-center-v6");
  const sale = (id: string) => ({ id, code: id, at: "2026-11-27T11:11:00Z", amount: 10, customer: null, channel: "Mercado Livre", marketplace: true });
  const base = { generatedAt: "", total: 0, orders: 0, byChannel: [], marketplaceMonth: { amount: 0, orders: 0, byChannel: [] } };
  assert.equal(freshSaleIds(null, { ...base, feed: [sale("a")] }).size, 0);
  assert.deepEqual([...freshSaleIds({ ...base, feed: [sale("a")] }, { ...base, feed: [sale("b"), sale("a")] })], ["b"]);
  assert.equal(saleTime("2026-11-27T11:11:00Z"), "08:11");
});
