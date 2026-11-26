import type { CashFlowLine } from "./finance-cashflow";
import { daysUntil } from "./receivable-agenda";

/**
 * Numbers and sentences of the Central de comando, kept apart from the screen
 * so they can be tested: the three headlines of the day, sales pace, the
 * receivables split and the cash of the next 14 days.
 */

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const brl = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
const kg = (value: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);

export type SalesGeo = {
  revenue: number;
  previousRevenue: number;
  growthPercent: number | null;
  cumulative: Array<{ day: number; current: number; previous: number }>;
  topCustomers: Array<{ id: string; name: string; revenue: number; orders: number }>;
  byState?: Array<{ customers: number }>;
  byCity: Array<{ state: string; city: string; revenue: number; orders: number }>;
};

export type Headline = { key: string; tone: "info" | "warn"; icon: "trend" | "award" | "sprout" | "pin"; title: string; detail: string };

export function monthName(date: Date, offset = 0) {
  return MONTHS[(date.getMonth() + offset + 12) % 12]!;
}

/** Sales pace: per day so far and where the month lands at that pace. */
export function salesPace(salesMonth: number, today: Date = new Date()) {
  const day = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const perDay = day > 0 ? salesMonth / day : 0;
  return { perDay, projection: perDay * daysInMonth, day, daysInMonth, daysLeft: daysInMonth - day };
}

/** Days of roasting the free green coffee covers, at the month's planned pace. */
export function greenCoverageDays(freeKg: number, plannedKg: number, today: Date = new Date()) {
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const perDay = plannedKg / daysInMonth;
  return perDay > 0 ? freeKg / perDay : null;
}

/** Up to three short findings, most useful first (Dynamics 365 headlines). */
export function buildHeadlines(input: { geo: SalesGeo | null; greenFreeKg: number; plannedKg: number; today?: Date }): Headline[] {
  const today = input.today ?? new Date();
  const list: Headline[] = [];
  const geo = input.geo;
  if (geo && geo.revenue > 0) {
    const current = monthName(today);
    const previous = monthName(today, -1);
    if (geo.previousRevenue > 0) {
      const ratio = geo.revenue / geo.previousRevenue;
      const title = ratio >= 1.5
        ? `${capitalize(current)} já vendeu ${ratio.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}× ${previous}`
        : ratio >= 1
          ? `Vendas ${Math.round((ratio - 1) * 100)}% acima de ${previous}`
          : `Vendas ${Math.round((1 - ratio) * 100)}% abaixo de ${previous}`;
      list.push({ key: "sales", tone: ratio >= 1 ? "info" : "warn", icon: "trend", title, detail: `${brl(geo.revenue)} até hoje, contra ${brl(geo.previousRevenue)} no mesmo período de ${previous}` });
    }
    const top = geo.topCustomers[0];
    if (top) {
      const buyers = (geo.byState ?? []).reduce((sum, state) => sum + state.customers, 0);
      list.push({ key: "customer", tone: "info", icon: "award", title: `${top.name} é o cliente do mês`, detail: `${brl(top.revenue)} em ${top.orders} ${top.orders === 1 ? "pedido" : "pedidos"}${buyers ? ` · ${buyers} clientes compraram em ${current}` : ""}` });
    }
  }
  const coverage = greenCoverageDays(input.greenFreeKg, input.plannedKg, today);
  if (coverage !== null && coverage < 10) {
    list.push({ key: "green", tone: "warn", icon: "sprout", title: `Café verde livre cobre só ~${Math.max(0, Math.round(coverage))} dias de torra`, detail: `${kg(input.greenFreeKg)} kg livres; o plano do mês pede ~${kg(input.plannedKg / new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate())} kg por dia` });
  } else if (geo?.byCity[0]) {
    const city = geo.byCity[0];
    list.push({ key: "city", tone: "info", icon: "pin", title: `${city.city} lidera as vendas do mês`, detail: `${brl(city.revenue)} em ${city.orders} ${city.orders === 1 ? "pedido" : "pedidos"}` });
  }
  return list.slice(0, 3);
}

/** Open receivables: total, overdue and due within 14 days. */
export function receivableSnapshot(lines: CashFlowLine[], today: Date = new Date()) {
  const receivables = lines.filter((line) => line.kind === "RECEIVABLE");
  const sum = (filter: (line: CashFlowLine) => boolean) => receivables.filter(filter).reduce((total, line) => total + line.amount, 0);
  const overdueLines = receivables.filter((line) => daysUntil(line.dueDate, today) < 0);
  return {
    total: sum(() => true),
    overdue: sum((line) => daysUntil(line.dueDate, today) < 0),
    overdueCount: overdueLines.length,
    next14: sum((line) => { const d = daysUntil(line.dueDate, today); return d >= 0 && d <= 14; }),
    oldestOverdueDays: overdueLines.reduce((max, line) => Math.max(max, -daysUntil(line.dueDate, today)), 0),
  };
}

/** What comes in and goes out from today to 14 days ahead (overdue left out). */
export function cashNext14(lines: CashFlowLine[], today: Date = new Date()) {
  const window = lines.filter((line) => { const d = daysUntil(line.dueDate, today); return d >= 0 && d <= 14; });
  const inflow = window.filter((line) => line.signedAmount >= 0).reduce((sum, line) => sum + line.amount, 0);
  const outflow = window.filter((line) => line.signedAmount < 0).reduce((sum, line) => sum + line.amount, 0);
  return { inflow, outflow, net: inflow - outflow };
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Green coffee by lot: the stored current weight is already net of what
 * orders reserved (physical = current + reserved). Only approved lots are
 * free for roasting.
 */
export function greenStock(lots: Array<{ currentKg: number; reservedKg: number; status: string }>) {
  const reserved = lots.reduce((sum, lot) => sum + Math.max(0, lot.reservedKg), 0);
  const total = lots.reduce((sum, lot) => sum + Math.max(0, lot.currentKg) + Math.max(0, lot.reservedKg), 0);
  const free = lots.filter((lot) => lot.status === "APPROVED").reduce((sum, lot) => sum + Math.max(0, lot.currentKg), 0);
  return { total, reserved, free };
}
