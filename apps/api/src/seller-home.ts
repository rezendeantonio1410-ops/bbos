/**
 * Hoje e Minha BI do vendedor: números da própria carteira, calculados a partir
 * de pedidos, itens, contas a receber e dias em campo. Funções puras, testáveis.
 */

const DAY = 86_400_000;
const TZ_OFFSET = 3 * 3_600_000; // America/Sao_Paulo (sem horário de verão)

export type HomeOrder = { id: string; number: string; customerId: string; customerName: string; status: string; total: number; orderDate: Date; expectedDeliveryDate: Date | null };
export type HomeItem = { orderId: string; productName: string; amount: number; kg: number };
/** amount = valor ainda em aberto (openAmount). */
export type HomeReceivable = { orderId: string | null; customerId: string; amount: number; dueDate: Date; status: string };
export type HomeCustomer = { id: string; name: string; city: string | null; phone: string | null };

export type HomeInput = {
  orders: HomeOrder[];
  items: HomeItem[];
  receivables: HomeReceivable[];
  customers: HomeCustomer[];
  visitsThisMonth: number;
  now: Date;
};

const DONE = new Set(["CANCELLED", "DRAFT"]);
const WEEKDAYS: string[] = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** Data local de São Paulo à meia-noite (em UTC "falso", só para contas de dia). */
function localDay(date: Date) {
  const local = new Date(date.getTime() - TZ_OFFSET);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
}
/**
 * Datas "só dia" (vencimento, entrega prevista) chegam do banco à meia-noite UTC.
 * Nesses casos o dia é o próprio dia UTC; aplicar o fuso empurraria para o dia anterior.
 */
export function calendarDay(date: Date) {
  if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0) {
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  }
  return localDay(date);
}
function weekStart(date: Date) {
  const day = localDay(date);
  const dow = new Date(day).getUTCDay(); // 0 = domingo
  return day - ((dow + 6) % 7) * DAY; // semana começa na segunda
}
const ddmm = (ms: number) => { const d = new Date(ms); return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Só os dígitos, com 55 na frente quando vier só DDD + número. Vazio se não der para usar no WhatsApp. */
export function whatsappNumber(phone: string | null | undefined) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return digits;
  return "";
}

export function buildSellerHome(input: HomeInput) {
  const { now } = input;
  const today = localDay(now);
  const orders = input.orders.filter((o) => !DONE.has(o.status));
  const kgByOrder = new Map<string, number>();
  for (const it of input.items) kgByOrder.set(it.orderId, (kgByOrder.get(it.orderId) ?? 0) + it.kg);
  const phones = new Map(input.customers.map((c) => [c.id, whatsappNumber(c.phone)]));

  // Semanas (segunda a domingo), as 4 últimas incluindo a atual.
  const thisWeek = weekStart(now);
  const weeks = [3, 2, 1, 0].map((back) => {
    const start = thisWeek - back * 7 * DAY;
    const inWeek = orders.filter((o) => weekStart(o.orderDate) === start);
    return {
      start: ddmm(start),
      revenue: Math.round(inWeek.reduce((t, o) => t + o.total, 0)),
      kg: round1(inWeek.reduce((t, o) => t + (kgByOrder.get(o.id) ?? 0), 0)),
      orders: inWeek.length,
    };
  });
  const prevWeek = weeks[2] ?? { revenue: 0 };
  const curWeek = weeks[3] ?? { revenue: 0 };
  const weekDeltaPct = prevWeek.revenue > 0 ? Math.round(((curWeek.revenue - prevWeek.revenue) / prevWeek.revenue) * 100) : null;

  // Mês corrente.
  const local = new Date(today);
  const monthStart = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1);
  const daysInMonth = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 0)).getUTCDate();
  const dayOfMonth = local.getUTCDate();
  const monthOrders = orders.filter((o) => localDay(o.orderDate) >= monthStart);
  const revenue = Math.round(monthOrders.reduce((t, o) => t + o.total, 0));
  const kg = round1(monthOrders.reduce((t, o) => t + (kgByOrder.get(o.id) ?? 0), 0));
  const activeCustomers = new Set(monthOrders.map((o) => o.customerId)).size;
  const month = {
    revenue,
    orders: monthOrders.length,
    kg,
    ticket: monthOrders.length ? Math.round(revenue / monthOrders.length) : null,
    perKg: kg > 0 ? Math.round(revenue / kg) : null,
    activeCustomers,
    portfolio: input.customers.length,
    dayOfMonth,
    daysInMonth,
    daysLeft: daysInMonth - dayOfMonth,
    // Ritmo diário × dias do mês; só a partir do 5º dia para não exagerar no começo.
    projection: dayOfMonth >= 5 && revenue > 0 ? Math.round((revenue / dayOfMonth) * daysInMonth) : null,
  };

  // Cafés do mês.
  const monthIds = new Set(monthOrders.map((o) => o.id));
  const byProduct = new Map<string, { revenue: number; kg: number }>();
  for (const it of input.items) {
    if (!monthIds.has(it.orderId)) continue;
    const p = byProduct.get(it.productName) ?? { revenue: 0, kg: 0 };
    p.revenue += it.amount;
    p.kg += it.kg;
    byProduct.set(it.productName, p);
  }
  const products = [...byProduct.entries()]
    .map(([name, p]) => ({ name, revenue: Math.round(p.revenue), kg: round1(p.kg), share: revenue > 0 ? Math.round((p.revenue / revenue) * 100) : 0 }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);

  // Pedidos por dia da semana (últimos 90 dias).
  const since = today - 90 * DAY;
  const weekdays = [1, 2, 3, 4, 5, 6, 0].map((dow) => ({
    day: WEEKDAYS[dow] ?? "",
    orders: orders.filter((o) => localDay(o.orderDate) >= since && new Date(localDay(o.orderDate)).getUTCDay() === dow).length,
  }));
  const bestDay = [...weekdays].sort((a, b) => b.orders - a.orders)[0];
  const totalRecent = weekdays.reduce((t, d) => t + d.orders, 0);

  // Sequência de semanas seguidas com venda (contando a atual só se já houver venda).
  let streak = 0;
  for (let back = curWeek.revenue > 0 ? 0 : 1; back < 52; back += 1) {
    const start = thisWeek - back * 7 * DAY;
    if (orders.some((o) => weekStart(o.orderDate) === start)) streak += 1;
    else break;
  }

  // Precisa de você: entregas e vencimentos que pedem uma mensagem ao cliente.
  const needs: Array<{
    kind: "DELIVERY_LATE" | "DELIVERY_SOON" | "DUE_OVERDUE" | "DUE_SOON";
    customerId: string; customerName: string; phone: string;
    orderNumber: string | null; amount: number; date: string; daysLate: number;
  }> = [];
  for (const o of orders) {
    if (!["CONFIRMED", "RESERVED", "PICKING", "IN_PRODUCTION", "READY_TO_SHIP", "INVOICED"].includes(o.status) || !o.expectedDeliveryDate) continue;
    const diff = Math.round((calendarDay(o.expectedDeliveryDate) - today) / DAY);
    if (diff > 2) continue;
    needs.push({
      kind: diff < 0 ? "DELIVERY_LATE" : "DELIVERY_SOON",
      customerId: o.customerId, customerName: o.customerName, phone: phones.get(o.customerId) ?? "",
      orderNumber: o.number, amount: Math.round(o.total), date: new Date(calendarDay(o.expectedDeliveryDate)).toISOString().slice(0, 10), daysLate: Math.max(0, -diff),
    });
  }
  const numberByOrder = new Map(input.orders.map((o) => [o.id, o]));
  for (const r of input.receivables) {
    if (r.status !== "OPEN" && r.status !== "OVERDUE" && r.status !== "PARTIALLY_PAID") continue;
    const diff = Math.round((calendarDay(r.dueDate) - today) / DAY);
    if (diff > 3) continue;
    const order = r.orderId ? numberByOrder.get(r.orderId) : undefined;
    needs.push({
      kind: diff < 0 ? "DUE_OVERDUE" : "DUE_SOON",
      customerId: r.customerId, customerName: order?.customerName ?? input.customers.find((c) => c.id === r.customerId)?.name ?? "Cliente",
      phone: phones.get(r.customerId) ?? "", orderNumber: order?.number ?? null, amount: Math.round(r.amount),
      date: new Date(calendarDay(r.dueDate)).toISOString().slice(0, 10), daysLate: Math.max(0, -diff),
    });
  }
  const urgency = { DELIVERY_LATE: 0, DUE_OVERDUE: 1, DUE_SOON: 2, DELIVERY_SOON: 3 } as const;
  needs.sort((a, b) => urgency[a.kind] - urgency[b.kind] || a.date.localeCompare(b.date));

  // A receber dos clientes.
  const open = input.receivables.filter((r) => r.status === "OPEN" || r.status === "OVERDUE" || r.status === "PARTIALLY_PAID");
  const receivable = {
    open: Math.round(open.reduce((t, r) => t + r.amount, 0)),
    overdue: Math.round(open.filter((r) => calendarDay(r.dueDate) < today).reduce((t, r) => t + r.amount, 0)),
    next7: Math.round(open.filter((r) => { const d = calendarDay(r.dueDate); return d >= today && d <= today + 7 * DAY; }).reduce((t, r) => t + r.amount, 0)),
  };

  // Leituras (só quando há dado que as sustente).
  const insights: Array<{ tone: "green" | "blue" | "orange" | "dark"; big: string; text: string }> = [];
  if (products[0] && products[0].share >= 25) insights.push({ tone: "green", big: `${products[0].share}%`, text: `da sua venda do mês vem de ${products[0].name}. Ofereça aos clientes que ainda não compram.` });
  if (bestDay && totalRecent >= 5 && bestDay.orders >= 2) insights.push({ tone: "blue", big: bestDay.day.charAt(0).toUpperCase() + bestDay.day.slice(1), text: `é o seu melhor dia: ${bestDay.orders} de ${totalRecent} pedidos nos últimos 90 dias.` });
  insights.push({ tone: input.visitsThisMonth === 0 ? "orange" : "dark", big: `${input.visitsThisMonth} ${input.visitsThisMonth === 1 ? "visita" : "visitas"}`, text: input.visitsThisMonth === 0 ? "registradas no mês. Com o app, cada parada vira visita e o BBOS aprende o que funciona." : "registradas no mês. Cada visita ensina o BBOS sobre a sua carteira." });
  if (month.portfolio > 0) insights.push({ tone: "dark", big: `${activeCustomers} de ${month.portfolio}`, text: activeCustomers === month.portfolio ? "clientes da carteira compraram no mês. Próximo passo: clientes novos." : `clientes compraram no mês. ${month.portfolio - activeCustomers} ainda não.` });

  return { weeks, weekDeltaPct, month, products, weekdays, streak, needs: needs.slice(0, 8), receivable, insights };
}

export type BiDay = { stops: Array<{ minutes: number; place: { id: string; kind: string } | null }>; customerMinutes: number; drivingMinutes: number; stoppedMinutes: number; pauseMinutes: number; totalMinutes: number; km: number };

/** Minha BI: venda, kg e tempo investido por cliente no período. */
export function buildSellerBi(input: { orders: HomeOrder[]; items: HomeItem[]; receivables: HomeReceivable[]; customers: HomeCustomer[]; days: BiDay[]; from: Date; now: Date }) {
  const from = localDay(input.from);
  const orders = input.orders.filter((o) => !DONE.has(o.status) && localDay(o.orderDate) >= from);
  const kgByOrder = new Map<string, number>();
  for (const it of input.items) kgByOrder.set(it.orderId, (kgByOrder.get(it.orderId) ?? 0) + it.kg);
  const minutesBy = new Map<string, number>();
  const visitsBy = new Map<string, number>();
  for (const day of input.days) for (const s of day.stops) {
    if (!s.place || s.place.kind !== "CUSTOMER") continue;
    minutesBy.set(s.place.id, (minutesBy.get(s.place.id) ?? 0) + s.minutes);
    visitsBy.set(s.place.id, (visitsBy.get(s.place.id) ?? 0) + 1);
  }
  const revenue = orders.reduce((t, o) => t + o.total, 0);
  const customers = input.customers.map((c) => {
    const mine = orders.filter((o) => o.customerId === c.id);
    const total = mine.reduce((t, o) => t + o.total, 0);
    const minutes = Math.round(minutesBy.get(c.id) ?? 0);
    const last = [...input.orders].filter((o) => o.customerId === c.id && !DONE.has(o.status)).sort((a, b) => b.orderDate.getTime() - a.orderDate.getTime())[0];
    return {
      id: c.id, name: c.name, city: c.city, phone: whatsappNumber(c.phone),
      revenue: Math.round(total), orders: mine.length, kg: round1(mine.reduce((t, o) => t + (kgByOrder.get(o.id) ?? 0), 0)),
      share: revenue > 0 ? Math.round((total / revenue) * 100) : 0,
      minutes: minutes || null, fieldVisits: visitsBy.get(c.id) ?? 0,
      perHour: minutes >= 5 ? Math.round(total / (minutes / 60)) : null,
      daysSinceOrder: last ? Math.round((localDay(input.now) - localDay(last.orderDate)) / DAY) : null,
      openAmount: Math.round(input.receivables.filter((r) => r.customerId === c.id && (r.status === "OPEN" || r.status === "OVERDUE" || r.status === "PARTIALLY_PAID")).reduce((t, r) => t + r.amount, 0)),
    };
  }).sort((a, b) => b.revenue - a.revenue);
  const sum = (k: keyof Omit<BiDay, "stops">) => Math.round(input.days.reduce((t, d) => t + d[k], 0));
  const time = input.days.length ? { days: input.days.length, total: sum("totalMinutes"), customer: sum("customerMinutes"), driving: sum("drivingMinutes"), stopped: sum("stoppedMinutes"), pause: sum("pauseMinutes"), km: round1(input.days.reduce((t, d) => t + d.km, 0)) } : null;
  const top = customers[0];
  const reading = top && top.share >= 40
    ? `${top.share}% da sua venda vem de um cliente só: ${top.name}. É o seu cliente-chave e também o seu maior risco.`
    : top && revenue > 0 ? `Sua venda está distribuída: o maior cliente, ${top.name}, responde por ${top.share}%.` : "Ainda não há vendas no período.";
  return { revenue: Math.round(revenue), orders: orders.length, kg: round1(orders.reduce((t, o) => t + (kgByOrder.get(o.id) ?? 0), 0)), customers, time, reading };
}
