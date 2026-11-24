import { brazilStateCode, brazilStateName } from "./sales-map";

/**
 * Numeric sales summary for the executive panel and the sales map: totals,
 * the cumulative revenue curve against the previous period, top customers and
 * sales by state and by city. Pure: callers pass orders already scoped to the
 * company and to what the user may see.
 */
type NumericValue = number | string | null | undefined | { toString(): string };

export type SummaryOrder = {
  id: string;
  totalAmount: NumericValue;
  orderedAt: Date | string;
  customer: { id: string; name: string; state?: string | null; city?: string | null };
  items?: Array<{ quantity: number; productVariant?: { netWeightGrams?: number | null } | null }>;
};

export type GeoTotals = { revenue: number; orders: number; customers: number; volumeKg: number };

export type SalesSummary = {
  revenue: number;
  previousRevenue: number;
  /** Null when the previous period had no sales (growth is undefined). */
  growthPercent: number | null;
  orders: number;
  averageTicket: number;
  volumeKg: number;
  /** One point per elapsed day of the period: cumulative revenue now and in the previous period. */
  cumulative: Array<{ day: number; current: number; previous: number }>;
  topCustomers: Array<{ id: string; name: string; revenue: number; orders: number }>;
  byState: Array<GeoTotals & { state: string; name: string }>;
  byCity: Array<GeoTotals & { state: string; city: string }>;
  /** Sales whose customer has no recognizable Brazilian state or city. */
  unlocated: { revenue: number; orders: number };
};

const DAY = 86_400_000;
const num = (value: NumericValue) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const round2 = (value: number) => Math.round(value * 100) / 100;
const orderKg = (order: SummaryOrder) =>
  (order.items ?? []).reduce((sum, item) => sum + (item.quantity * num(item.productVariant?.netWeightGrams)) / 1000, 0);

export const cityKey = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();

export function buildSalesSummary(
  orders: SummaryOrder[],
  previousOrders: SummaryOrder[],
  window: { start: Date; now: Date; previousStart: Date },
): SalesSummary {
  const revenue = orders.reduce((sum, order) => sum + num(order.totalAmount), 0);
  const previousRevenue = previousOrders.reduce((sum, order) => sum + num(order.totalAmount), 0);
  const volumeKg = orders.reduce((sum, order) => sum + orderKg(order), 0);

  const days = Math.max(1, Math.ceil((window.now.getTime() - window.start.getTime()) / DAY));
  const curve = (list: SummaryOrder[], from: Date) => {
    const perDay = new Array<number>(days).fill(0);
    for (const order of list) {
      const index = Math.floor((new Date(order.orderedAt).getTime() - from.getTime()) / DAY);
      if (index >= 0 && index < days) perDay[index] = (perDay[index] ?? 0) + num(order.totalAmount);
    }
    let running = 0;
    return perDay.map((value) => (running += value));
  };
  const currentCurve = curve(orders, window.start);
  const previousCurve = curve(previousOrders, window.previousStart);

  const customers = new Map<string, { id: string; name: string; revenue: number; orders: number }>();
  const states = new Map<string, GeoTotals & { customerIds: Set<string> }>();
  const cities = new Map<string, GeoTotals & { state: string; city: string; customerIds: Set<string> }>();
  const unlocated = { revenue: 0, orders: 0 };
  for (const order of orders) {
    const amount = num(order.totalAmount);
    const kg = orderKg(order);
    const customer = customers.get(order.customer.id) ?? { id: order.customer.id, name: order.customer.name, revenue: 0, orders: 0 };
    customer.revenue += amount;
    customer.orders += 1;
    customers.set(order.customer.id, customer);

    const state = brazilStateCode(order.customer.state);
    const city = String(order.customer.city ?? "").trim();
    if (!state || !city) {
      unlocated.revenue += amount;
      unlocated.orders += 1;
      if (!state) continue;
    }
    const stateTotals = states.get(state) ?? { revenue: 0, orders: 0, customers: 0, volumeKg: 0, customerIds: new Set<string>() };
    stateTotals.revenue += amount;
    stateTotals.orders += 1;
    stateTotals.volumeKg += kg;
    stateTotals.customerIds.add(order.customer.id);
    states.set(state, stateTotals);
    if (!city) continue;
    const key = `${state}|${cityKey(city)}`;
    const cityTotals = cities.get(key) ?? { state, city, revenue: 0, orders: 0, customers: 0, volumeKg: 0, customerIds: new Set<string>() };
    cityTotals.revenue += amount;
    cityTotals.orders += 1;
    cityTotals.volumeKg += kg;
    cityTotals.customerIds.add(order.customer.id);
    cities.set(key, cityTotals);
  }

  const byRevenue = <T extends { revenue: number }>(a: T, b: T) => b.revenue - a.revenue;
  return {
    revenue: round2(revenue),
    previousRevenue: round2(previousRevenue),
    growthPercent: previousRevenue > 0 ? round2(((revenue - previousRevenue) / previousRevenue) * 100) : null,
    orders: orders.length,
    averageTicket: orders.length ? round2(revenue / orders.length) : 0,
    volumeKg: round2(volumeKg),
    cumulative: currentCurve.map((current, index) => ({ day: index + 1, current: round2(current), previous: round2(previousCurve[index] ?? 0) })),
    topCustomers: [...customers.values()].sort(byRevenue).slice(0, 5).map((item) => ({ ...item, revenue: round2(item.revenue) })),
    byState: [...states.entries()]
      .map(([state, totals]) => ({ state, name: brazilStateName(state), revenue: round2(totals.revenue), orders: totals.orders, customers: totals.customerIds.size, volumeKg: round2(totals.volumeKg) }))
      .sort(byRevenue),
    byCity: [...cities.values()]
      .map(({ customerIds, ...totals }) => ({ ...totals, revenue: round2(totals.revenue), volumeKg: round2(totals.volumeKg), customers: customerIds.size }))
      .sort(byRevenue),
    unlocated: { revenue: round2(unlocated.revenue), orders: unlocated.orders },
  };
}
