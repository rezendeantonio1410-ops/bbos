import assert from "node:assert/strict";
import test from "node:test";
import type { CashFlowLine } from "./finance-cashflow";
import { buildForecast, cashBufferDays, recurringOccurrences } from "./cash-forecast";

const line = (kind: CashFlowLine["kind"], dueDate: string, amount: number, counterparty: string): CashFlowLine => ({
  id: dueDate + counterparty, kind, dueDate, amount, signedAmount: kind === "RECEIVABLE" ? amount : -amount,
  document: "PED", counterparty, description: "", status: "", balance: 0, group: "",
});
// Cenário real de 26/11/2026 (valores do rascunho aprovado).
const today = new Date("2026-11-26T15:00:00Z");
const lines = [
  line("RECEIVABLE", "2026-11-23T15:00:00Z", 2070, "Cliente A"), line("RECEIVABLE", "2026-11-25T15:00:00Z", 720, "Cliente B"),
  line("RECEIVABLE", "2026-11-27T15:00:00Z", 1020, "Cliente C"), line("RECEIVABLE", "2026-11-30T15:00:00Z", 252, "Cliente E"),
  line("RECEIVABLE", "2026-12-02T15:00:00Z", 1700, "Cliente C"), line("RECEIVABLE", "2026-12-02T15:00:00Z", 288, "Cliente F"),
  line("RECEIVABLE", "2026-12-07T15:00:00Z", 2950, "Cliente A"), line("RECEIVABLE", "2026-12-11T15:00:00Z", 1086, "Cliente D"),
  line("RECEIVABLE", "2026-12-12T15:00:00Z", 520, "Cliente D"), line("RECEIVABLE", "2026-12-23T15:00:00Z", 336, "Cliente D"),
];
const recurring = [
  { id: "a", label: "Aluguel", category: "Aluguel", amount: 7991.13, dayOfMonth: 10, active: true },
  { id: "s", label: "Sanepar", category: "Água", amount: 359.54, dayOfMonth: 6, active: true },
  { id: "c", label: "Copel", category: "Energia elétrica", amount: 185.11, dayOfMonth: 6, active: true },
  { id: "g", label: "GVT", category: "Internet / telefonia", amount: 99.99, dayOfMonth: 6, active: true },
  { id: "i", label: "Seguro Itaú", category: "Seguros", amount: 1042.84, dayOfMonth: 25, active: true },
  { id: "l", label: "Locaweb", category: "Site / sistemas", amount: 120, dayOfMonth: 25, active: true },
  { id: "m", label: "Desligada", category: "Outras", amount: 999, dayOfMonth: 1, active: false },
];

test("forecast of 26/11: rent on the 10th is the worst day, R$ 3.039 at the end", () => {
  const f = buildForecast({ startBalance: 4685.49, lines, recurring, horizonDays: 30, minimum: 5000, today });
  assert.equal(f.final, 3038.88);
  assert.equal(f.worst.date, "2026-12-10");
  assert.equal(f.worst.balance, 2259.72);
  assert.equal(f.firstBelow!.date, "2026-11-26");
  assert.equal(f.inflow, 8152);
  assert.equal(f.outflowRecurring, 9798.61);
  assert.equal(f.overdueReceivable, 2790);
  assert.deepEqual(f.alerts.map((a) => a.key), ["low", "overdue", "recurring"]);
  assert.equal(f.alerts[0]!.title.replace(/\s/g, " "), "Dia 10/12 o caixa cai para R$ 2.260");
  assert.match(f.alerts[0]!.detail, /Aluguel/);
  assert.match(f.alerts[1]!.detail, /sobe de R\$\s?2\.260 para R\$\s?5\.050/);
  const rentWeek = f.weeks.find((w) => w.from <= "2026-12-10" && w.to >= "2026-12-10")!;
  assert.equal(rentWeek.outflow, 7991.13);
  assert.equal(rentWeek.low, true);
  assert.equal(f.weeks[0]!.from, "2026-11-26");
  assert.equal(f.weeks[0]!.to, "2026-11-29");
});

test("monthly occurrences respect short months and skip inactive", () => {
  assert.deepEqual(recurringOccurrences({ id: "x", label: "", category: "", amount: 1, dayOfMonth: 31, active: true }, "2026-01-15", "2026-03-31"), ["2026-01-31", "2026-02-28", "2026-03-31"]);
  assert.deepEqual(recurringOccurrences({ id: "x", label: "", category: "", amount: 1, dayOfMonth: 10, active: false }, "2026-01-15", "2026-03-31"), []);
  assert.deepEqual(recurringOccurrences({ id: "x", label: "", category: "", amount: 1, dayOfMonth: 26, active: true }, "2026-11-26", "2026-12-26"), ["2026-12-26"]);
});

test("cash buffer days (JPMorgan Chase Institute)", () => {
  assert.equal(cashBufferDays(4685.49, 37702.86), 4);
  assert.equal(cashBufferDays(1000, 0), null);
});
