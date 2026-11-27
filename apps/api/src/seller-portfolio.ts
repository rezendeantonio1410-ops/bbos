// Carteira do vendedor: situação de cada cliente, o que fazer hoje e os avisos.
// Regras aprovadas em 27/11 (rascunho "Minha carteira"):
// - Cobrança: título vencido em aberto.
// - Novo: cliente sem nenhum pedido, cadastrado há 3+ dias.
// - Esfriando: com 3+ pedidos, passou de 1,5× o ritmo; com 1–2 pedidos, 21+ dias.
// - Recompra chegando: faltam até 3 dias para o ritmo habitual (1 pedido: 21 dias).

const DAY = 86_400_000;
export const SINGLE_ORDER_INTERVAL_DAYS = 21;
export const NEW_CUSTOMER_GRACE_DAYS = 3;
export const REORDER_HEADS_UP_DAYS = 3;

export type PortfolioStatus = "COBRANCA" | "NOVO" | "ESFRIANDO" | "RECOMPRA" | "EM_DIA";

export type PortfolioCustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  creditStatus: string | null;
  paymentTerms: string | null;
  createdAt: Date | string;
  orderDates: Array<Date | string>;
  revenue90: number;
  lastOrderAmount: number | null;
  overdueAmount: number;
  overdueSince: Date | string | null;
  lastVisitAt: Date | string | null;
};

const day = (value: Date | string) => Math.floor(new Date(value).getTime() / DAY);

export function classifyCustomer(row: PortfolioCustomerRow, now = new Date()) {
  const today = day(now);
  // Pedidos no mesmo dia contam como um.
  const days = [...new Set(row.orderDates.map(day))].sort((a, b) => a - b);
  const last = days.at(-1) ?? null;
  const daysSince = last === null ? null : today - last;
  const gaps = days.slice(1).map((d, i) => d - days[i]!);
  const rhythm = gaps.length ? Math.max(1, Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length)) : SINGLE_ORDER_INTERVAL_DAYS;
  const coolingLimit = days.length >= 3 ? Math.max(rhythm * 1.5, rhythm + 5) : SINGLE_ORDER_INTERVAL_DAYS;
  const thermometer = daysSince === null ? 0 : Math.min(1, daysSince / coolingLimit);

  let status: PortfolioStatus = "EM_DIA";
  if (row.overdueAmount > 0.009) status = "COBRANCA";
  else if (!days.length) status = today - day(row.createdAt) >= NEW_CUSTOMER_GRACE_DAYS ? "NOVO" : "EM_DIA";
  else if (daysSince! > coolingLimit) status = "ESFRIANDO";
  else if (daysSince! >= rhythm - REORDER_HEADS_UP_DAYS) status = "RECOMPRA";

  return { status, orders: days.length, daysSince, rhythm, coolingLimit: Math.round(coolingLimit), thermometer };
}

const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const dm = (value: Date | string) => new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });

const PRIORITY: Record<PortfolioStatus, number> = { COBRANCA: 0, NOVO: 1, ESFRIANDO: 2, RECOMPRA: 3, EM_DIA: 9 };

export function buildPortfolio(rows: PortfolioCustomerRow[], now = new Date()) {
  const customers = rows.map((row) => {
    const info = classifyCustomer(row, now);
    const lastOrderAt = row.orderDates.length ? new Date(Math.max(...row.orderDates.map((d) => new Date(d).getTime()))).toISOString() : null;
    let title = "";
    let detail = "";
    let why = "";
    let nextStep = "—";
    if (info.status === "COBRANCA") {
      title = `${row.name} · ${brl(row.overdueAmount)} vencido`;
      detail = row.overdueSince ? `Venceu em ${dm(row.overdueSince)}` : "Título vencido em aberto";
      why = "Cobrar hoje evita bloquear o próximo pedido dele";
      nextStep = `Cobrar ${brl(row.overdueAmount)}`;
    } else if (info.status === "NOVO") {
      title = `${row.name} · ainda sem o 1º pedido`;
      detail = row.creditStatus === "APPROVED" ? `Crédito aprovado${row.paymentTerms ? ` (${row.paymentTerms})` : ""}` : "Cliente cadastrado, sem compra ainda";
      why = "O primeiro pedido nos primeiros dias firma o cliente";
      nextStep = "1º pedido";
    } else if (info.status === "ESFRIANDO") {
      title = `${row.name} · ${info.daysSince} dias sem comprar`;
      detail = info.orders >= 3 ? `Costuma comprar a cada ${info.rhythm} dias` : `Comprou ${info.orders} ${info.orders === 1 ? "vez" : "vezes"}${row.lastOrderAmount ? ` · último pedido ${brl(row.lastOrderAmount)}` : ""}`;
      why = "Cliente que passa do ritmo costuma não voltar sem contato";
      nextStep = "Ligar ou visitar";
    } else if (info.status === "RECOMPRA") {
      title = `${row.name} · recompra chegando`;
      detail = `Último pedido há ${info.daysSince} dias · ritmo de ${info.rhythm} dias`;
      why = "Ligar antes de acabar o café garante o pedido com você";
      nextStep = "Oferecer reposição";
    }
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      status: info.status,
      orders: info.orders,
      daysSince: info.daysSince,
      rhythm: info.rhythm,
      thermometer: Math.round(info.thermometer * 100) / 100,
      lastOrderAt,
      revenue90: Math.round(row.revenue90 * 100) / 100,
      overdueAmount: Math.round(row.overdueAmount * 100) / 100,
      lastVisitAt: row.lastVisitAt ? new Date(row.lastVisitAt).toISOString() : null,
      nextStep,
      task: info.status === "EM_DIA" ? null : { title, detail, why },
    };
  });
  customers.sort((a, b) => PRIORITY[a.status] - PRIORITY[b.status] || (b.daysSince ?? 0) - (a.daysSince ?? 0) || a.name.localeCompare(b.name, "pt-BR"));
  const tasks = customers.filter((c) => c.task).slice(0, 5).map((c) => ({ customerId: c.id, status: c.status, phone: c.phone, ...c.task! }));
  const overdue = customers.reduce((sum, c) => sum + c.overdueAmount, 0);
  return {
    summary: {
      customers: customers.length,
      revenue90: Math.round(customers.reduce((sum, c) => sum + c.revenue90, 0) * 100) / 100,
      buyers90: customers.filter((c) => c.revenue90 > 0).length,
      overdue: Math.round(overdue * 100) / 100,
      overdueCustomers: customers.filter((c) => c.overdueAmount > 0).map((c) => c.name),
      withoutVisit: customers.filter((c) => !c.lastVisitAt).length,
      newWithoutOrder: customers.filter((c) => c.status === "NOVO").map((c) => c.name),
      attention: customers.filter((c) => c.status !== "EM_DIA").length,
    },
    tasks,
    customers,
  };
}

/** Avisos do sino (cobrança já tem aviso próprio no BBOS e fica de fora). */
export function portfolioAlerts(portfolio: ReturnType<typeof buildPortfolio>) {
  return portfolio.customers
    .filter((c) => c.status === "NOVO" || c.status === "ESFRIANDO" || c.status === "RECOMPRA")
    .map((c) => ({
      type: `SALES_PORTFOLIO_${c.status}:${c.id}`,
      title:
        c.status === "NOVO" ? `${c.name}: faça o 1º pedido`
        : c.status === "ESFRIANDO" ? `${c.name}: ${c.daysSince} dias sem comprar`
        : `${c.name}: recompra chegando`,
      message: c.task?.why ?? "",
    }));
}

/** Link do WhatsApp com o número brasileiro (sem nada além dos dígitos). */
export function whatsappNumber(phone: string | null | undefined) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return digits;
  return null;
}

/** Mês do vendedor: realizado em R$ e kg contra a meta, com projeção e falta por dia. */
export function sellerMonth(input: {
  revenue: number;
  kg: number;
  orders: number;
  salesTarget: number | null;
  kgTarget: number | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const local = new Date(now.getTime() - 3 * 3_600_000);
  const day = local.getUTCDate();
  const daysInMonth = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 0)).getUTCDate();
  const daysLeft = Math.max(0, daysInMonth - day);
  const track = (done: number, target: number | null) => {
    const projection = day > 0 ? (done / day) * daysInMonth : done;
    if (!target || target <= 0) return { done: round(done), target: null, percent: null, projection: round(projection), missing: null, perDay: null, onTrack: null };
    const missing = Math.max(0, target - done);
    return {
      done: round(done),
      target: round(target),
      percent: Math.round((done / target) * 100),
      projection: round(projection),
      missing: round(missing),
      perDay: daysLeft > 0 ? round(missing / daysLeft) : round(missing),
      onTrack: projection >= target,
    };
  };
  return {
    month: local.toISOString().slice(0, 7),
    daysLeft,
    orders: input.orders,
    revenue: track(input.revenue, input.salesTarget),
    kg: track(input.kg, input.kgTarget),
  };
}

const round = (value: number) => Math.round(value * 100) / 100;

/** Meta do vendedor: AAAA-MM e valores ≥ 0; vazio ou zero remove. */
export function validateSellerGoal(input: { partnerId?: unknown; month?: unknown; salesTarget?: unknown; kgTarget?: unknown }) {
  const partnerId = String(input.partnerId ?? "").trim();
  if (!partnerId) throw new Error("Escolha o vendedor.");
  const month = String(input.month ?? "").trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Mês inválido (use AAAA-MM).");
  const parse = (value: unknown, label: string) => {
    const raw = typeof value === "string" ? value.replace(/\./g, "").replace(",", ".").trim() : value;
    if (raw === null || raw === undefined || raw === "") return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) throw new Error(`Meta de ${label} inválida.`);
    return n > 0 ? Math.round(n * 1000) / 1000 : null;
  };
  return { partnerId, month, salesTarget: parse(input.salesTarget, "vendas (R$)"), kgTarget: parse(input.kgTarget, "volume (kg)") };
}
