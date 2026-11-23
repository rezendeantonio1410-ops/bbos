import type { BrazilStateSalesInput } from "@/components/brazil-sales-map";

export type SignaRegionRow = {
  state: string | null;
  city: string | null;
  orders: number;
  kilograms: number;
  orderValue: number;
  customers?: number;
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
