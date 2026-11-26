import type { BrazilStateSalesInput } from "@/components/brazil-sales-map";

export type SignaRegionRow = {
  state: string | null;
  city: string | null;
  orders: number;
  kilograms: number;
  orderValue: number;
  customers?: number;
  /** Pedido sem cliente final: aparece na cidade de entrega. */
  deliveryOnly?: boolean;
};

const UFS = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

/**
 * Aggregates the Signa report rows (UF + city of commercial end customers)
 * into the Brazil map input. No targets or margins exist for partners, so
 * the map shows only "with purchases" vs "no purchases" per state.
 */
export function signaStateSales(rows: readonly SignaRegionRow[]): BrazilStateSalesInput[] {
  const byState = new Map<string, BrazilStateSalesInput>();
  for (const row of rows) {
    const uf = String(row.state ?? "").trim().toUpperCase();
    if (!UFS.has(uf)) continue;
    const current = byState.get(uf) ?? {
      stateCode: uf, revenue: 0, volumeKg: 0, target: 0, achievement: 0,
      marginPercent: 0, growthPercent: 0, customers: 0, status: "on-track" as const,
      hasMargin: false, hasTarget: false, hasPreviousPeriod: false,
    };
    current.revenue += Number(row.orderValue) || 0;
    current.volumeKg += Number(row.kilograms) || 0;
    current.customers += Number(row.customers) || 0;
    byState.set(uf, current);
  }
  return [...byState.values()]
    .filter((state) => state.revenue > 0 || state.volumeKg > 0)
    .map((state) => ({ ...state, revenue: Math.round(state.revenue * 100) / 100, volumeKg: Math.round(state.volumeKg * 1000) / 1000 }))
    .sort((a, b) => b.revenue - a.revenue);
}

export type SignaStatePurchase = {
  uf: string;
  revenue: number;
  volumeKg: number;
  customers: number;
  orders: number;
  cities: Array<{ city: string; revenue: number; volumeKg: number }>;
};

/** Per-UF totals with the top cities, for the interactive purchases map. */
export function signaStatePurchases(rows: readonly SignaRegionRow[]): SignaStatePurchase[] {
  const byState = new Map<string, SignaStatePurchase>();
  for (const row of rows) {
    const uf = String(row.state ?? "").trim().toUpperCase();
    if (!UFS.has(uf)) continue;
    const entry = byState.get(uf) ?? { uf, revenue: 0, volumeKg: 0, customers: 0, orders: 0, cities: [] };
    const revenue = Number(row.orderValue) || 0;
    const volumeKg = Number(row.kilograms) || 0;
    entry.revenue += revenue;
    entry.volumeKg += volumeKg;
    entry.customers += Number(row.customers) || 0;
    entry.orders += Number(row.orders) || 0;
    if (row.city) entry.cities.push({ city: row.city, revenue, volumeKg });
    byState.set(uf, entry);
  }
  return [...byState.values()]
    .filter((state) => state.revenue > 0 || state.volumeKg > 0)
    .map((state) => ({
      ...state,
      revenue: Math.round(state.revenue * 100) / 100,
      volumeKg: Math.round(state.volumeKg * 1000) / 1000,
      cities: state.cities.sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    }))
    .sort((a, b) => b.revenue - a.revenue);
}
