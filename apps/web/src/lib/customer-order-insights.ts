/**
 * Reads a customer's order history (GET /customers/:id/sales-history) and turns
 * it into suggestions for a new order: repeat the last order, the products the
 * customer usually buys with their usual quantity, and how often they buy.
 * Suggestions only; the seller confirms every line.
 */
export type SalesHistoryEntry = {
  id?: string;
  orderNumber: string;
  status: string;
  orderedAt: string;
  totalAmount: number | string;
  paymentStatus?: string | null;
  items: Array<{ productName?: string | null; sku?: string | null; quantity: number | string; unitPrice?: number | string; totalAmount?: number | string }>;
};

export type InsightVariant = { productVariantId: string; sku: string; product: string; presentationGrams: number; availableStock?: number };

export type SuggestedLine = { variantId: string; quantity: number };

export type CustomerOrderInsights = {
  ordersCount: number;
  lastOrder: { orderNumber: string; orderedAt: string; totalAmount: number; lines: SuggestedLine[] } | null;
  /** Median number of days between orders; null with fewer than 2 orders. */
  cadenceDays: number | null;
  daysSinceLast: number | null;
  /** Most frequent products, each with the median quantity ordered. */
  usualProducts: Array<SuggestedLine & { label: string; timesOrdered: number }>;
};

const IGNORED_STATUSES = new Set(["CANCELLED", "DRAFT"]);
const DAY = 86_400_000;

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};

export const variantLabel = (variant: InsightVariant) =>
  `${variant.product}${variant.presentationGrams ? ` ${variant.presentationGrams >= 1000 ? `${variant.presentationGrams / 1000} kg` : `${variant.presentationGrams} g`}` : ""}`;

export function buildCustomerOrderInsights(
  history: SalesHistoryEntry[],
  variants: InsightVariant[],
  now = Date.now(),
): CustomerOrderInsights {
  const bySku = new Map<string, InsightVariant>();
  for (const variant of variants) if (variant.sku && !bySku.has(variant.sku)) bySku.set(variant.sku, variant);

  const orders = history
    .filter((order) => !IGNORED_STATUSES.has(order.status) && Number.isFinite(Date.parse(order.orderedAt)))
    .sort((a, b) => Date.parse(b.orderedAt) - Date.parse(a.orderedAt));

  const toLines = (order: SalesHistoryEntry): SuggestedLine[] => {
    const merged = new Map<string, number>();
    for (const item of order.items ?? []) {
      const variant = item.sku ? bySku.get(item.sku) : undefined;
      const quantity = Math.round(Number(item.quantity));
      if (!variant || !(quantity > 0)) continue;
      merged.set(variant.productVariantId, (merged.get(variant.productVariantId) ?? 0) + quantity);
    }
    return [...merged.entries()].map(([variantId, quantity]) => ({ variantId, quantity }));
  };

  const last = orders[0];
  const lastOrder = last
    ? { orderNumber: last.orderNumber, orderedAt: last.orderedAt, totalAmount: Number(last.totalAmount) || 0, lines: toLines(last) }
    : null;

  const times = orders.map((order) => Date.parse(order.orderedAt));
  const gaps = times.slice(0, -1).map((time, index) => (time - times[index + 1]!) / DAY).filter((gap) => gap > 0);
  const cadenceDays = gaps.length ? Math.max(1, Math.round(median(gaps))) : null;
  const daysSinceLast = last ? Math.max(0, Math.floor((now - Date.parse(last.orderedAt)) / DAY)) : null;

  // Frequency over the last 12 orders keeps suggestions close to current habits.
  const recent = orders.slice(0, 12);
  const stats = new Map<string, { quantities: number[]; lastSeen: number }>();
  recent.forEach((order, index) => {
    for (const line of toLines(order)) {
      const entry = stats.get(line.variantId) ?? { quantities: [], lastSeen: index };
      entry.quantities.push(line.quantity);
      entry.lastSeen = Math.min(entry.lastSeen, index);
      stats.set(line.variantId, entry);
    }
  });
  const variantById = new Map(variants.map((variant) => [variant.productVariantId, variant]));
  const usualProducts = [...stats.entries()]
    .map(([variantId, entry]) => ({
      variantId,
      quantity: Math.max(1, Math.round(median(entry.quantities))),
      timesOrdered: entry.quantities.length,
      lastSeen: entry.lastSeen,
      label: variantById.has(variantId) ? variantLabel(variantById.get(variantId)!) : variantId,
    }))
    .sort((a, b) => b.timesOrdered - a.timesOrdered || a.lastSeen - b.lastSeen)
    .slice(0, 6)
    .map(({ lastSeen: _lastSeen, ...rest }) => rest);

  return { ordersCount: orders.length, lastOrder, cadenceDays, daysSinceLast, usualProducts };
}

/** "Compra a cada ~14 dias · último há 9 dias" style summary. */
export function cadenceText(insights: CustomerOrderInsights): string | null {
  if (!insights.lastOrder) return null;
  const since = insights.daysSinceLast === 0 ? "hoje" : insights.daysSinceLast === 1 ? "há 1 dia" : `há ${insights.daysSinceLast} dias`;
  return insights.cadenceDays ? `Compra a cada ~${insights.cadenceDays} dias · último pedido ${since}` : `Último pedido ${since}`;
}

/** Customers ordered for the picker: matches first by name start, recents on top when there is no query. */
export function searchOrderCustomers<T extends { id: string; name: string; segment?: string | null }>(
  customers: T[],
  query: string,
  recentIds: string[],
  limit = 8,
): T[] {
  const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) {
    const byId = new Map(customers.map((customer) => [customer.id, customer]));
    return recentIds.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])).slice(0, limit);
  }
  return customers
    .filter((customer) => {
      const haystack = normalize(`${customer.name} ${customer.segment ?? ""}`);
      return terms.every((term) => haystack.includes(term));
    })
    .sort((a, b) => Number(!normalize(a.name).startsWith(terms[0]!)) - Number(!normalize(b.name).startsWith(terms[0]!)) || a.name.localeCompare(b.name, "pt-BR"))
    .slice(0, limit);
}
