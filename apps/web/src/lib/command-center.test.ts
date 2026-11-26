import assert from "node:assert/strict";
import test from "node:test";
import type { CashFlowLine } from "./finance-cashflow";
import { buildHeadlines, cashNext14, payableSnapshot, greenCoverageDays, receivableSnapshot, salesPace, type SalesGeo } from "./command-center";

// 26/11/2026 14:00 in São Paulo (local test clock may differ; dates built from it).
const today = new Date(2026, 10, 26, 14, 0, 0);
const geo: SalesGeo = {
  revenue: 23968,
  previousRevenue: 9310,
  growthPercent: 157.4,
  cumulative: [],
  topCustomers: [{ id: "s", name: "Signa Coffee", revenue: 8203, orders: 5 }],
  byState: [{ customers: 10 }],
  byCity: [{ state: "PR", city: "Ponta Grossa", revenue: 13296, orders: 3 }],
};

test("headlines tell the month against the previous one, the best customer and green coverage", () => {
  const list = buildHeadlines({ geo, greenFreeKg: 52, plannedKg: 359, today });
  assert.deepEqual(list.map((h) => h.title), [
    "Novembro já vendeu 2,6× outubro",
    "Signa Coffee é o cliente do mês",
    "Café verde livre cobre só ~4 dias de torra",
  ]);
  assert.match(list[0]!.detail, /R\$\s?23\.968 até hoje, contra R\$\s?9\.310/);
  assert.match(list[1]!.detail, /10 clientes compraram em novembro/);
  assert.equal(list[2]!.tone, "warn");
});

test("with enough green coffee the third headline is the leading city", () => {
  const list = buildHeadlines({ geo, greenFreeKg: 600, plannedKg: 359, today });
  assert.equal(list[2]!.title, "Ponta Grossa lidera as vendas do mês");
  const down = buildHeadlines({ geo: { ...geo, revenue: 7000 }, greenFreeKg: 600, plannedKg: 359, today });
  assert.equal(down[0]!.title, "Vendas 25% abaixo de outubro");
  assert.equal(down[0]!.tone, "warn");
  assert.deepEqual(buildHeadlines({ geo: null, greenFreeKg: 600, plannedKg: 0, today }), []);
});

test("sales pace and coverage", () => {
  const pace = salesPace(23968, today);
  assert.equal(Math.round(pace.perDay), 922);
  assert.equal(Math.round(pace.projection), 27655);
  assert.equal(pace.daysLeft, 4);
  assert.equal(Math.round(greenCoverageDays(52, 359, today)!), 4);
  assert.equal(greenCoverageDays(52, 0, today), null);
});

const line = (kind: CashFlowLine["kind"], dueDate: string, amount: number): CashFlowLine => ({
  id: dueDate + amount, kind, dueDate, amount, signedAmount: kind === "RECEIVABLE" ? amount : -amount,
  document: "", counterparty: "", description: "", status: "", balance: 0, group: "",
});
const clock = new Date("2026-11-26T17:00:00Z");
const lines = [
  line("RECEIVABLE", "2026-11-23T18:00:15Z", 2070), line("RECEIVABLE", "2026-11-25T23:34:24Z", 720),
  line("RECEIVABLE", "2026-11-27T21:29:33Z", 1020), line("RECEIVABLE", "2026-12-07T12:00:00Z", 2950),
  line("RECEIVABLE", "2026-12-23T19:07:42Z", 336), line("PAYABLE", "2026-10-13T15:00:00Z", 148),
  line("PAYABLE", "2026-12-01T15:00:00Z", 500),
];

test("receivables and the next 14 days of cash", () => {
  assert.deepEqual(receivableSnapshot(lines, clock), { total: 7096, overdue: 2790, overdueCount: 2, next14: 3970, oldestOverdueDays: 3 });
  assert.deepEqual(cashNext14(lines, clock), { inflow: 3970, outflow: 500, net: 3470 });
});

test("green coffee: current weight is already net of reservations (real lots of 26/11)", async () => {
  const { greenStock } = await import("./command-center");
  const lots = [
    { currentKg: 300, reservedKg: 60, status: "APPROVED" },
    { currentKg: 76, reservedKg: 104, status: "APPROVED" },
    { currentKg: 0, reservedKg: 120, status: "APPROVED" },
    { currentKg: 0, reservedKg: 40, status: "APPROVED" },
  ];
  assert.deepEqual(greenStock(lots), { total: 700, reserved: 324, free: 376 });
  assert.equal(greenStock([{ currentKg: 200, reservedKg: 0, status: "QUALITY_REVIEW" }]).free, 0);
  assert.equal(Math.round(greenCoverageDays(376, 359, new Date(2026, 10, 26))!), 31);
});

test("payables: overdue apart, due today listed (26/11: CP-2026-000005 and old commissions)", () => {
  const now = new Date("2026-11-26T17:00:00Z");
  const list = [
    line("PAYABLE", "2026-11-26T12:00:00Z", 5000), line("PAYABLE", "2026-10-13T15:00:00Z", 148),
    line("PAYABLE", "2026-11-23T15:00:00Z", 24), line("RECEIVABLE", "2026-11-25T12:00:00Z", 720),
  ];
  const snap = payableSnapshot(list, now);
  assert.equal(snap.overdue, 172);
  assert.equal(snap.overdueCount, 2);
  assert.equal(snap.dueToday, 5000);
  assert.equal(cashNext14(list, now).outflow, 5000);
});
