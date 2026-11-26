import type { CashFlowLine, CashFlowTransaction } from "./finance-cashflow";
import { dayLabel, daysUntil, spDay } from "./receivable-agenda";

/**
 * Views of the cash-flow projection for the Fluxo de caixa screen:
 * periods for the chart, the bridge from today's balance, the last months
 * actually received and paid, and the next days one by one. Days always
 * follow the São Paulo calendar.
 */

const isIn = (line: CashFlowLine) => line.signedAmount >= 0;

/** Lines due within the horizon, overdue ones included. */
export function withinHorizon(lines: CashFlowLine[], days: number, today: Date = new Date()) {
  return lines.filter((line) => daysUntil(line.dueDate, today) <= days);
}

export type CashPeriod = {
  key: string;
  label: string;
  inflow: number;
  outflow: number;
  overdue: boolean;
  closing: number;
};

const ddmm = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000);

/**
 * Overdue lines first (one "Atrasados" period), then windows of 7 days (or 1)
 * from today up to the horizon. `closing` is the balance at the end of each
 * period, starting from the cash of today.
 */
export function cashPeriods(lines: CashFlowLine[], options: { days: number; step: 1 | 7; cash: number; today?: Date }): CashPeriod[] {
  const today = options.today ?? new Date();
  const periods: CashPeriod[] = [];
  const overdue = lines.filter((line) => daysUntil(line.dueDate, today) < 0);
  if (overdue.length) {
    periods.push({
      key: "overdue",
      label: "Atrasados",
      inflow: overdue.filter(isIn).reduce((sum, line) => sum + line.amount, 0),
      outflow: overdue.filter((line) => !isIn(line)).reduce((sum, line) => sum + line.amount, 0),
      overdue: true,
      closing: 0,
    });
  }
  for (let start = 0; start <= options.days; start += options.step) {
    const end = Math.min(start + options.step - 1, options.days);
    const inside = lines.filter((line) => {
      const d = daysUntil(line.dueDate, today);
      return d >= start && d <= end;
    });
    const first = spDay(addDays(today, start));
    const last = spDay(addDays(today, end));
    periods.push({
      key: first,
      label: options.step === 1 ? ddmm(first) : first.slice(5, 7) === last.slice(5, 7) ? `${first.slice(8, 10)}–${ddmm(last)}` : `${ddmm(first)}–${ddmm(last)}`,
      inflow: inside.filter(isIn).reduce((sum, line) => sum + line.amount, 0),
      outflow: inside.filter((line) => !isIn(line)).reduce((sum, line) => sum + line.amount, 0),
      overdue: false,
      closing: 0,
    });
  }
  let balance = options.cash;
  for (const period of periods) {
    balance += period.inflow - period.outflow;
    period.closing = balance;
  }
  return periods;
}

/** Inflows split by how soon they arrive (for the stacked bar). */
export function inflowAging(lines: CashFlowLine[], today: Date = new Date()) {
  const split = { overdue: 0, week: 0, fortnight: 0, month: 0, later: 0 };
  for (const line of lines.filter(isIn)) {
    const d = daysUntil(line.dueDate, today);
    const key = d < 0 ? "overdue" : d <= 7 ? "week" : d <= 15 ? "fortnight" : d <= 30 ? "month" : "later";
    split[key] += line.amount;
  }
  return split;
}

/** From today's balance to the balance at the end of the horizon. */
export function cashBridge(lines: CashFlowLine[], today: Date = new Date()) {
  const sum = (filter: (line: CashFlowLine) => boolean) => lines.filter(filter).reduce((total, line) => total + line.amount, 0);
  const lateIn = sum((line) => line.kind === "RECEIVABLE" && daysUntil(line.dueDate, today) < 0);
  const onTimeIn = sum((line) => line.kind === "RECEIVABLE" && daysUntil(line.dueDate, today) >= 0);
  const payables = sum((line) => line.kind === "PAYABLE");
  const purchases = sum((line) => line.kind === "PURCHASE");
  const taxes = sum((line) => line.kind === "TAX");
  return { lateIn, onTimeIn, payables, purchases, taxes, net: lateIn + onTimeIn - payables - purchases - taxes };
}

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** Money actually received and paid in the last `count` months (this one included). */
export function realizedMonths(transactions: CashFlowTransaction[], today: Date = new Date(), count = 3) {
  const current = spDay(today).slice(0, 7);
  const [year, month] = current.split("-").map(Number);
  const months = Array.from({ length: count }, (_, index) => {
    const d = new Date(Date.UTC(year!, month! - 1 - (count - 1 - index), 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    return { key, label: MONTH_NAMES[d.getUTCMonth()]!, inflow: 0, outflow: 0 };
  });
  for (const transaction of transactions) {
    const month = months.find((item) => item.key === spDay(transaction.occurredAt).slice(0, 7));
    if (!month) continue;
    const value = Math.abs(Number(transaction.amount) || 0);
    if (["PAYMENT", "TRANSFER_OUT"].includes(transaction.type)) month.outflow += value;
    else month.inflow += value;
  }
  return months;
}

export type CashDay = { key: string; label: string; inflow: number; outflow: number; lines: CashFlowLine[] };

/** Overdue lines together, then each of the next `days` days that has a line. */
export function nextCashDays(lines: CashFlowLine[], days = 7, today: Date = new Date()): CashDay[] {
  const groups = new Map<string, CashDay>();
  for (const line of lines) {
    const d = daysUntil(line.dueDate, today);
    if (d > days) continue;
    const key = d < 0 ? "overdue" : spDay(line.dueDate);
    let group = groups.get(key);
    if (!group) {
      group = { key, label: d < 0 ? "Atrasados" : dayLabel(key, today), inflow: 0, outflow: 0, lines: [] };
      groups.set(key, group);
    }
    group.lines.push(line);
    if (isIn(line)) group.inflow += line.amount;
    else group.outflow += line.amount;
  }
  // Inside a day: money coming in first, biggest amounts first.
  for (const group of groups.values()) group.lines.sort((a, b) => b.signedAmount - a.signedAmount || b.amount - a.amount);
  return [...groups.values()].sort((a, b) => (a.key === "overdue" ? -1 : b.key === "overdue" ? 1 : a.key.localeCompare(b.key)));
}

/** Round chart top: 1, 2 or 5 times a power of ten, with 4 equal steps. */
export function niceScale(max: number) {
  if (!(max > 0)) return { top: 4, step: 1 };
  const raw = max / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((value) => value >= raw)!;
  return { top: step * 4, step };
}
