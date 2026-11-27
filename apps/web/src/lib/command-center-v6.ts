// Central de comando v6: tipos do /command-center/insights e regras puras da tela
// (adiar tarefas, alerta repetido, meta, vitórias, dias de caixa com e sem compras).

export type CommandInsights = {
  generatedAt: string;
  month: string;
  margin: { revenue: number; marginPercent: number | null; marginAmount: number | null; coveragePercent: number };
  goal: { month: string; salesTarget: number | null; updatedByName: string | null };
  nextGoal: { month: string; salesTarget: number | null };
  wins: { deliveredOrders: number; received: number; newCustomers: number; directShipmentsPosted: number };
  growth: { activeProspects: number; proposals: number; visitsMonth: number; newCustomersMonth: number; newCustomerNames: string[] };
  customers: {
    recurring: number;
    onTimeRate: number | null;
    lapsed: Array<{ customerId: string; name: string; lastOrderAt: string; avgIntervalDays: number; daysSince: number }>;
    topCustomer: { name: string; share: number } | null;
  };
  channels: Array<{ name: string; revenue: number; orders: number }>;
  payerDelays: Array<{ customerId: string; name: string; avgDelayDays: number; paidCount: number }>;
  snoozes: Array<{ taskKey: string; action: string; until: string }>;
};

export type SnoozeAction = "DONE" | "TOMORROW" | "WEEK";

/** Chave do adiamento: o tipo da tarefa + o texto. Se a situação mudar, a tarefa volta. */
export function taskSnoozeKey(task: { key: string; title: string }) {
  return `${task.key}|${task.title}`.slice(0, 300);
}

export function withoutSnoozed<T extends { key: string; title: string }>(tasks: T[], snoozedKeys: Iterable<string>) {
  const hidden = new Set(snoozedKeys);
  return tasks.filter((task) => !hidden.has(taskSnoozeKey(task)));
}

/** Há quantos dias a tarefa aparece (registro por navegador). */
export function repeatedDays(firstSeenIso: string | undefined, now = Date.now()) {
  if (!firstSeenIso) return 0;
  const first = Date.parse(firstSeenIso);
  return Number.isFinite(first) ? Math.max(0, Math.floor((now - first) / 86_400_000)) : 0;
}

/**
 * Ordena por gravidade e, dentro da mesma gravidade, o que é novo vem antes do
 * que se repete há 7+ dias (alerta repetido perde força: fadiga de alertas).
 */
export function orderTasks<T extends { tone: "critical" | "attention" | "ok"; repeatedDays?: number }>(tasks: T[]) {
  const rank = { critical: 0, attention: 1, ok: 2 } as const;
  const stale = (task: T) => ((task.repeatedDays ?? 0) >= 7 ? 1 : 0);
  return [...tasks].sort((a, b) => rank[a.tone] - rank[b.tone] || stale(a) - stale(b));
}

/** Dias de caixa; acima de um ano é sinal de dado incompleto, então não mostra. */
export function saneBufferDays(days: number | null) {
  return days === null || !Number.isFinite(days) || days > 365 ? null : days;
}

/** Dias de caixa contando só as despesas fixas previstas (sem compras de café). */
export function fixedBufferDays(balance: number, recurring: Array<{ amount: number; active?: boolean }>) {
  const monthly = recurring.filter((r) => r.active !== false).reduce((sum, r) => sum + Math.max(0, Number(r.amount) || 0), 0);
  return monthly > 0 ? saneBufferDays(Math.max(0, Math.round(balance / (monthly / 30)))) : null;
}

/** Progresso da meta do mês: realizado, projeção e quanto falta por dia. */
export function goalProgress(revenue: number, target: number | null, projection: number, daysLeft: number) {
  if (!target || target <= 0) return null;
  const missing = Math.max(0, target - revenue);
  return {
    target,
    percent: Math.min(100, Math.round((revenue / target) * 100)),
    projectedPercent: Math.round((projection / target) * 100),
    missing,
    perDay: daysLeft > 0 ? missing / daysLeft : missing,
    reached: revenue >= target,
    onTrack: projection >= target,
  };
}

const brl0 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** Vitórias da semana: só o que é real e positivo. Nada a celebrar → lista vazia. */
export function weekWins(input: {
  insights: CommandInsights | null;
  growthPercent: number | null;
  previousMonthName: string;
  goal: ReturnType<typeof goalProgress>;
  roastDone: boolean;
}) {
  const wins: string[] = [];
  const w = input.insights?.wins;
  if (w && w.deliveredOrders > 0) wins.push(`${w.deliveredOrders} ${w.deliveredOrders === 1 ? "pedido entregue" : "pedidos entregues"}`);
  if (w && w.received >= 1) wins.push(`${brl0.format(w.received)} recebidos`);
  if (w && w.newCustomers > 0) wins.push(`${w.newCustomers} ${w.newCustomers === 1 ? "cliente novo" : "clientes novos"}`);
  if (w && w.directShipmentsPosted > 0) wins.push(`${w.directShipmentsPosted} ${w.directShipmentsPosted === 1 ? "envio direto postado" : "envios diretos postados"}`);
  if (input.goal?.reached) wins.push("Meta de vendas batida");
  else if (input.growthPercent !== null && input.growthPercent >= 10) {
    const factor = 1 + input.growthPercent / 100;
    wins.push(factor >= 2 ? `${factor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}× ${input.previousMonthName}` : `+${Math.round(input.growthPercent)}% sobre ${input.previousMonthName}`);
  }
  if (input.roastDone) wins.push("Meta de torra batida");
  return wins;
}

/** Atraso habitual do cliente pelo nome mostrado na previsão. */
export function delayFor(name: string, delays: CommandInsights["payerDelays"] | undefined) {
  const key = name.trim().toLowerCase();
  return delays?.find((d) => d.name.trim().toLowerCase() === key)?.avgDelayDays ?? null;
}

export function parseGoalInput(value: string) {
  const cleaned = value.replace(/[^\d,.]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return cleaned && Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

export type TodaySale = { id: string; code: string; at: string; amount: number; customer: string | null; channel: string; marketplace: boolean };
export type TodaySales = {
  generatedAt: string;
  total: number;
  orders: number;
  byChannel: Array<{ channel: string; amount: number; orders: number; marketplace: boolean }>;
  feed: TodaySale[];
  marketplaceMonth: { amount: number; orders: number; byChannel: Array<{ channel: string; amount: number; orders: number }> };
};

/** Pedidos que chegaram desde a última leitura (para destacar na faixa). */
export function freshSaleIds(previous: TodaySales | null, next: TodaySales) {
  if (!previous) return new Set<string>();
  const seen = new Set(previous.feed.map((sale) => sale.id));
  return new Set(next.feed.filter((sale) => !seen.has(sale.id)).map((sale) => sale.id));
}

/** Hora local (São Paulo) de um pedido, "08:11". */
export function saleTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}
