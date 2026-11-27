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


export type DaySale = { id: string; code: string; at: Date | string; amount: number; customer: string | null; channel: string; marketplace: boolean };

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
