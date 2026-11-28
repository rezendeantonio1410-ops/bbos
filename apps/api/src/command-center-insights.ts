// Regras puras da Central de comando v6: recompra, atraso de pagamento,
// adiamento de tarefas e meta do mês. Sem acesso a banco, para testar.

const DAY = 86_400_000;

export type CustomerOrderDates = { customerId: string; name: string; orderedAt: Date[] };

export type LapsedCustomer = {
  customerId: string;
  name: string;
  lastOrderAt: string;
  avgIntervalDays: number;
  daysSince: number;
};

/**
 * Clientes recorrentes (3+ pedidos no ano) cujo intervalo desde o último
 * pedido passou bastante do ritmo habitual: 1,5× a média e pelo menos 10 dias
 * além dela. Quem sumiu há mais de 180 dias já é outro assunto (reativação).
 */
export function repurchaseHealth(customers: CustomerOrderDates[], now = new Date()) {
  const lapsed: LapsedCustomer[] = [];
  let recurring = 0;
  for (const customer of customers) {
    const dates = [...customer.orderedAt].map((d) => new Date(d).getTime()).sort((a, b) => a - b);
    // Pedidos no mesmo dia contam como um.
    const days = dates.filter((t, i) => i === 0 || Math.floor(t / DAY) !== Math.floor(dates[i - 1]! / DAY));
    if (days.length < 3) continue;
    recurring += 1;
    const gaps = days.slice(1).map((t, i) => (t - days[i]!) / DAY);
    const avg = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
    const last = days[days.length - 1]!;
    const since = Math.floor((now.getTime() - last) / DAY);
    if (since > Math.max(avg * 1.5, avg + 10) && since <= 180) {
      lapsed.push({
        customerId: customer.customerId,
        name: customer.name,
        lastOrderAt: new Date(last).toISOString(),
        avgIntervalDays: Math.round(avg),
        daysSince: since,
      });
    }
  }
  lapsed.sort((a, b) => b.daysSince / b.avgIntervalDays - a.daysSince / a.avgIntervalDays);
  return {
    recurring,
    lapsed,
    onTimeRate: recurring ? Math.round(((recurring - lapsed.length) / recurring) * 100) : null,
  };
}

export type PaidReceivable = { customerId: string; name: string; dueDate: Date; paymentDate: Date };

/** Atraso médio de pagamento por cliente (só quem tem 2+ títulos pagos). */
export function payerDelays(rows: PaidReceivable[]) {
  const byCustomer = new Map<string, { name: string; total: number; count: number }>();
  for (const row of rows) {
    const delay = Math.max(0, Math.round((new Date(row.paymentDate).getTime() - new Date(row.dueDate).getTime()) / DAY));
    const entry = byCustomer.get(row.customerId) ?? { name: row.name, total: 0, count: 0 };
    entry.total += delay;
    entry.count += 1;
    byCustomer.set(row.customerId, entry);
  }
  return [...byCustomer.entries()]
    .filter(([, e]) => e.count >= 2)
    .map(([customerId, e]) => ({ customerId, name: e.name, avgDelayDays: Math.round(e.total / e.count), paidCount: e.count }))
    .filter((e) => e.avgDelayDays >= 3)
    .sort((a, b) => b.avgDelayDays - a.avgDelayDays);
}

export const SNOOZE_ACTIONS = ["DONE", "TOMORROW", "WEEK"] as const;
export type SnoozeAction = (typeof SNOOZE_ACTIONS)[number];

/** Até quando a tarefa some: amanhã às 6h (São Paulo), 7 dias, ou 30 dias quando feita. */
export function snoozeUntil(action: string, now = new Date()): Date {
  if (action === "TOMORROW") {
    // 6h em São Paulo = 9h UTC.
    const next = new Date(now.getTime() + DAY);
    return new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate(), 9, 0, 0));
  }
  if (action === "WEEK") return new Date(now.getTime() + 7 * DAY);
  if (action === "DONE") return new Date(now.getTime() + 30 * DAY);
  throw new Error("Ação inválida: use Feito, Amanhã ou Adiar 7 dias.");
}

export function validateTaskKey(value: unknown) {
  const key = String(value ?? "").trim();
  if (!key || key.length > 300) throw new Error("Tarefa inválida.");
  return key;
}

/** Meta de vendas de um mês (AAAA-MM). Zero ou vazio remove a meta. */
export function validateGoal(input: { month?: unknown; salesTarget?: unknown }) {
  const month = String(input.month ?? "").trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Mês inválido (use AAAA-MM).");
  const raw = typeof input.salesTarget === "string" ? input.salesTarget.replace(/\./g, "").replace(",", ".") : input.salesTarget;
  const target = raw === null || raw === undefined || raw === "" ? null : Number(raw);
  if (target !== null && (!Number.isFinite(target) || target < 0 || target > 100_000_000)) {
    throw new Error("Informe a meta em reais, por exemplo 30000.");
  }
  return { month, salesTarget: target && target > 0 ? Math.round(target * 100) / 100 : null };
}

/** Margem do mês só com itens de custo conhecido; diz quanto das vendas tem custo. */
export function monthMargin(input: { revenue: number; costedRevenue: number; cost: number }) {
  const revenue = Math.max(0, input.revenue);
  const costedRevenue = Math.max(0, input.costedRevenue);
  if (!revenue || !costedRevenue) return { revenue, marginPercent: null, marginAmount: null, coveragePercent: 0 };
  const marginPercent = ((costedRevenue - input.cost) / costedRevenue) * 100;
  return {
    revenue,
    marginPercent: Math.round(marginPercent * 10) / 10,
    // Estimativa para o mês inteiro com a mesma margem.
    marginAmount: Math.round(revenue * (marginPercent / 100)),
    coveragePercent: Math.round((costedRevenue / revenue) * 100),
  };
}


export type ShipState = "TO_SHIP" | "SHIPPED" | "DELIVERED";
export type DaySale = {
  id: string; code: string; at: Date | string; amount: number; customer: string | null; channel: string; marketplace: boolean;
  /** "2× Caramelo Chocolate" (+ "e mais N" quando há outros itens). */
  item?: string | null;
  ship?: ShipState | null;
};

const SHIPPED = new Set(["INVOICED", "SHIPPED"]);
/** Situação de envio de um pedido do BBOS pelo status. */
export function orderShipState(status: string): ShipState {
  if (status === "DELIVERED") return "DELIVERED";
  return SHIPPED.has(status) ? "SHIPPED" : "TO_SHIP";
}

/** Situação de envio de um pedido de marketplace pelas etiquetas do Mercado Livre. */
export function marketplaceShipState(tags: unknown): ShipState {
  const list = Array.isArray(tags) ? tags.map(String) : [];
  return list.includes("delivered") ? "DELIVERED" : "TO_SHIP";
}

/** "2× Caramelo Chocolate" a partir do primeiro item; tira "Café em grãos especial Bispo" e o peso. */
export function itemLabel(items: Array<{ name: string; quantity: number }>) {
  const first = items[0];
  if (!first) return null;
  const name = first.name
    .replace(/caf[ée]\s+(em\s+gr[ãa]os|mo[íi]do)?\s*(especial)?\s*/i, "")
    .replace(/^bispo\s+/i, "")
    .replace(/\s*\d+\s*(g|kg)\b.*$/i, "")
    .trim() || first.name;
  const more = items.length > 1 ? ` e mais ${items.length - 1}` : "";
  return `${first.quantity}× ${name}${more}`;
}

/** Vendas do dia: total, por canal (maior primeiro) e os 8 pedidos mais recentes. */
export function salesOfTheDay(orders: DaySale[], marketplaceInbox: DaySale[]) {
  const all = [...orders, ...marketplaceInbox]
    .map((sale) => ({ ...sale, amount: Math.max(0, Number(sale.amount) || 0), at: new Date(sale.at).toISOString() }))
    .sort((a, b) => b.at.localeCompare(a.at));
  const byChannel = new Map<string, { channel: string; amount: number; orders: number; marketplace: boolean }>();
  for (const sale of all) {
    const entry = byChannel.get(sale.channel) ?? { channel: sale.channel, amount: 0, orders: 0, marketplace: sale.marketplace };
    entry.amount += sale.amount;
    entry.orders += 1;
    byChannel.set(sale.channel, entry);
  }
  return {
    total: Math.round(all.reduce((sum, sale) => sum + sale.amount, 0) * 100) / 100,
    orders: all.length,
    byChannel: [...byChannel.values()].sort((a, b) => b.amount - a.amount),
    feed: all.slice(0, 8),
  };
}


const CANCELLED = new Set(["cancelled", "canceled", "cancelado"]);

/** Lista de pedidos de marketplace com itens resumidos e totais (cancelados fora dos totais). */
export function marketplaceOrderList(rows: Array<{
  id: string; externalOrderId: string; externalStatus: string | null; orderedAt: Date | string;
  gross: number; fee: number; freight: number; importStatus: string; salesOrderId: string | null;
  channel: string; platform: string | null; city: string | null; state: string | null; items: any;
}>) {
  const orders = rows.map((row) => {
    const items = (Array.isArray(row.items) ? row.items : []).map((entry: any) => ({
      title: String(entry?.item?.title ?? "Item").slice(0, 120),
      sku: entry?.item?.seller_sku ? String(entry.item.seller_sku) : null,
      quantity: Number(entry?.quantity ?? 0) || 0,
      unitPrice: Number(entry?.unit_price ?? 0) || 0,
    }));
    const cancelled = CANCELLED.has(String(row.externalStatus ?? "").toLowerCase());
    return {
      id: row.id,
      number: row.externalOrderId,
      at: new Date(row.orderedAt).toISOString(),
      channel: row.channel,
      platform: row.platform,
      status: cancelled ? "CANCELLED" : row.salesOrderId || row.importStatus === "IMPORTED" ? "IMPORTED" : "TO_IMPORT",
      gross: Number(row.gross) || 0,
      fee: Number(row.fee) || 0,
      destination: row.city && row.state ? `${row.city}/${row.state}` : null,
      items,
      units: items.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0),
    };
  });
  const valid = orders.filter((order) => order.status !== "CANCELLED");
  const gross = valid.reduce((sum, order) => sum + order.gross, 0);
  const fees = valid.reduce((sum, order) => sum + order.fee, 0);
  return {
    totals: {
      orders: valid.length,
      cancelled: orders.length - valid.length,
      gross: Math.round(gross * 100) / 100,
      fees: Math.round(fees * 100) / 100,
      net: Math.round((gross - fees) * 100) / 100,
      averageTicket: valid.length ? Math.round((gross / valid.length) * 100) / 100 : 0,
      units: valid.reduce((sum, order) => sum + order.units, 0),
    },
    orders,
  };
}
