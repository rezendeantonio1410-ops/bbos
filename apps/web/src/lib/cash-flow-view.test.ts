import assert from "node:assert/strict";
import test from "node:test";
import type { CashFlowLine } from "./finance-cashflow";
import { cashBridge, cashPeriods, inflowAging, nextCashDays, niceScale, realizedMonths, withinHorizon } from "./cash-flow-view";

// 26/11/2026 14:00 in São Paulo.
const today = new Date("2026-11-26T17:00:00Z");
let n = 0;
const line = (kind: CashFlowLine["kind"], dueDate: string, amount: number): CashFlowLine => ({
  id: `l${++n}`, kind, dueDate, amount, signedAmount: kind === "RECEIVABLE" ? amount : -amount,
  document: "", counterparty: "c", description: "", status: "", balance: 0, group: "",
});

// Real figures of 26/11: receivables and the small overdue payables.
const lines = [
  line("PAYABLE", "2026-09-29T15:00:00Z", 15), line("PAYABLE", "2026-10-13T15:00:00Z", 148),
  line("PAYABLE", "2026-10-26T15:00:00Z", 16), line("PAYABLE", "2026-10-28T15:00:00Z", 16),
  line("PAYABLE", "2026-11-23T15:00:00Z", 24),
  line("RECEIVABLE", "2026-11-23T18:00:15Z", 2070), line("RECEIVABLE", "2026-11-25T23:34:24Z", 720),
  line("RECEIVABLE", "2026-11-27T21:29:33Z", 1020), line("RECEIVABLE", "2026-11-30T19:10:48Z", 252),
  line("RECEIVABLE", "2026-12-02T23:21:44Z", 1700), line("RECEIVABLE", "2026-12-02T23:36:54Z", 288),
  line("RECEIVABLE", "2026-12-07T12:00:00Z", 2950), line("RECEIVABLE", "2026-12-11T20:38:16Z", 1086),
  line("RECEIVABLE", "2026-12-12T18:06:17Z", 520), line("RECEIVABLE", "2026-12-23T19:07:42Z", 336),
  line("RECEIVABLE", "2027-02-10T12:00:00Z", 999),
];

test("the horizon keeps overdue lines and drops what is after it", () => {
  assert.equal(withinHorizon(lines, 30, today).length, 15);
  assert.equal(withinHorizon(lines, 90, today).length, 16);
});

test("weekly periods: overdue first, then 7-day windows with the closing balance", () => {
  const periods = cashPeriods(withinHorizon(lines, 30, today), { days: 30, step: 7, cash: 0, today });
  assert.deepEqual(periods.map((p) => p.label), ["Atrasados", "26/11–02/12", "03–09/12", "10–16/12", "17–23/12", "24–26/12"]);
  assert.deepEqual(periods.map((p) => p.inflow), [2790, 3260, 2950, 1606, 336, 0]);
  assert.equal(periods[0]!.outflow, 219);
  assert.deepEqual(periods.map((p) => p.closing), [2571, 5831, 8781, 10387, 10723, 10723]);
  const withCash = cashPeriods(withinHorizon(lines, 30, today), { days: 30, step: 7, cash: 5000, today });
  assert.equal(withCash.at(-1)!.closing, 15723);
});

test("daily periods have one bar per day", () => {
  const periods = cashPeriods(withinHorizon(lines, 7, today), { days: 7, step: 1, cash: 0, today });
  assert.equal(periods.length, 1 + 8);
  assert.equal(periods.find((p) => p.label === "02/12")!.inflow, 1988);
});

test("inflow aging and the bridge to 30 days", () => {
  const horizon = withinHorizon(lines, 30, today);
  assert.deepEqual(inflowAging(horizon, today), { overdue: 2790, week: 3260, fortnight: 4036, month: 856, later: 0 });
  assert.deepEqual(cashBridge(horizon, today), { lateIn: 2790, onTimeIn: 8152, payables: 219, purchases: 0, taxes: 0, net: 10723 });
});

test("realized months add receipts and payments by São Paulo month", () => {
  const months = realizedMonths([
    { id: "a", type: "RECEIPT", amount: 1561, occurredAt: "2026-09-20T12:00:00Z" },
    { id: "b", type: "TRANSFER_IN", amount: 15, occurredAt: "2026-09-30T12:00:00Z" },
    { id: "c", type: "PAYMENT", amount: 41, occurredAt: "2026-10-10T12:00:00Z" },
    { id: "d", type: "RECEIPT", amount: 7883, occurredAt: "2026-10-31T12:00:00Z" },
    { id: "e", type: "RECEIPT", amount: 100, occurredAt: "2026-11-01T02:00:00Z" }, // 31/10 23h in São Paulo
    { id: "f", type: "RECEIPT", amount: 14917, occurredAt: "2026-11-20T12:00:00Z" },
    { id: "g", type: "PAYMENT", amount: 25, occurredAt: "2026-11-21T12:00:00Z" },
    { id: "h", type: "RECEIPT", amount: 5, occurredAt: "2026-07-01T12:00:00Z" },
  ], today);
  assert.deepEqual(months.map((m) => [m.label, m.inflow, m.outflow]), [["Setembro", 1576, 0], ["Outubro", 7983, 41], ["Novembro", 14917, 25]]);
});

test("next days: overdue together, then each day", () => {
  const days = nextCashDays(lines, 7, today);
  assert.deepEqual(days.map((d) => d.label).slice(0, 3), ["Atrasados", "Amanhã", days[2]!.label]);
  assert.equal(days[0]!.inflow, 2790);
  assert.equal(days[0]!.outflow, 219);
  assert.equal(days.at(-1)!.key, "2026-12-02");
});

test("chart scale rounds up to friendly steps", () => {
  assert.deepEqual(niceScale(10723), { top: 20000, step: 5000 });
  assert.deepEqual(niceScale(9000), { top: 10000, step: 2500 });
  assert.deepEqual(niceScale(0), { top: 4, step: 1 });
});
