import { segmentFamily, normalizeCustomerSegment } from "@bbos/shared";

/**
 * Grupo de venda para relatórios. A Signa (cliente ligado a um parceiro com
 * usuário PARTNER, ou pedido feito pelo portal dela) é o único B2B de parceiro;
 * o resto é trabalhado pela Bispo e se separa pelo tipo de cliente.
 */
export const SALES_GROUPS = ["Signa · parceira B2B", "Distribuidores", "White Label (Bispo)", "Pontos de consumo", "Loja online", "Mercado Livre", "Outros / sem segmento"] as const;
export type SalesGroup = (typeof SALES_GROUPS)[number];

export function salesGroup(row: { partnerB2B: boolean; webStore: boolean; marketplace?: boolean; segment: string | null }): SalesGroup {
  if (row.marketplace) return "Mercado Livre";
  if (row.partnerB2B) return "Signa · parceira B2B";
  if (row.webStore) return "Loja online";
  const segment = normalizeCustomerSegment(row.segment);
  if (segment === "Distribuidor") return "Distribuidores";
  if (segment === "White Label") return "White Label (Bispo)";
  if (segment === "E-commerce" || segment === "Consumidor final") return "Loja online";
  if (segmentFamily(segment) === "CONSUMO") return "Pontos de consumo";
  return "Outros / sem segmento";
}

export function groupSales(rows: Array<{ partnerB2B: boolean; webStore: boolean; marketplace?: boolean; segment: string | null; revenue: number; orders: number }>) {
  const map = new Map<SalesGroup, { name: SalesGroup; revenue: number; orders: number }>();
  for (const r of rows) {
    const name = salesGroup(r);
    const g = map.get(name) ?? { name, revenue: 0, orders: 0 };
    g.revenue += r.revenue;
    g.orders += r.orders;
    map.set(name, g);
  }
  return [...map.values()].filter((g) => g.revenue > 0 || g.orders > 0).sort((a, b) => b.revenue - a.revenue);
}
