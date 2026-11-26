import assert from "node:assert/strict";
import test from "node:test";
import { agendaDays, dayLabel, daysUntil, horizonTotals, spDay } from "./receivable-agenda";

// 26/11/2026 14:00 in São Paulo.
const today = new Date("2026-11-26T17:00:00Z");
const row = (id: string, dueDate: string, openAmount: number, status = "OPEN") => ({ id, dueDate, openAmount, status, customer: { name: id } });

const rows = [
  row("vencido", "2026-11-23T18:00:15Z", 2070),
  row("ontem-noite", "2026-11-25T23:34:24Z", 720), // 20:34 in São Paulo → still the 25th
  row("amanha", "2026-11-27T21:29:33Z", 1020),
  row("segunda", "2026-11-30T19:10:48Z", 252),
  row("dez-02a", "2026-12-02T23:21:44Z", 1700),
  row("dez-02b", "2026-12-02T23:36:54Z", 288),
  row("dez-07", "2026-12-07T12:00:00Z", 2950),
  row("dez-23", "2026-12-23T19:07:42Z", 336),
  row("jan", "2027-01-20T12:00:00Z", 500),
  row("pago", "2026-11-28T12:00:00Z", 999, "PAID"),
  row("zerado", "2026-11-28T12:00:00Z", 0),
];

test("due days follow the São Paulo calendar", () => {
  assert.equal(spDay("2026-11-25T23:34:24Z"), "2026-11-25");
  assert.equal(spDay("2026-11-26T02:30:00Z"), "2026-11-25");
  assert.equal(daysUntil("2026-11-25T23:34:24Z", today), -1);
  assert.equal(daysUntil("2026-11-27T21:29:33Z", today), 1);
});

test("horizons add up open amounts only", () => {
  const totals = horizonTotals(rows, today);
  assert.deepEqual(totals.overdue, { amount: 2790, count: 2 });
  assert.deepEqual(totals.week, { amount: 1020 + 252 + 1700 + 288, count: 4 });
  assert.deepEqual(totals.fortnight, { amount: 2950, count: 1 });
  assert.deepEqual(totals.month, { amount: 336, count: 1 });
  assert.deepEqual(totals.later, { amount: 500, count: 1 });
});

test("the agenda groups the next 30 days by day, earliest first", () => {
  const days = agendaDays(rows, "next30", today);
  assert.deepEqual(days.map((d) => d.key), ["2026-11-23", "2026-11-25", "2026-11-27", "2026-11-30", "2026-12-02", "2026-12-07", "2026-12-23"]);
  assert.equal(days[1]!.label, "Ontem");
  assert.equal(days[2]!.label, "Amanhã");
  const dec2 = days.find((d) => d.key === "2026-12-02")!;
  assert.equal(dec2.rows.length, 2);
  assert.equal(dec2.total, 1988);
  assert.equal(days.some((d) => d.rows.some((r) => r.id === "pago" || r.id === "zerado" || r.id === "jan")), false);
});

test("day labels are friendly", () => {
  assert.equal(dayLabel("2026-11-26", today), "Hoje");
  assert.equal(dayLabel("2026-11-27", today), "Amanhã");
  assert.match(dayLabel("2026-11-30", today), /^seg\.?, 30\/11$/);
  assert.deepEqual(agendaDays(rows, "fortnight", today).map((d) => d.key), ["2026-12-07"]);
});
