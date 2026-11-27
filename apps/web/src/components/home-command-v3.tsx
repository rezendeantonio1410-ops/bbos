"use client";

import * as React from "react";
import Link from "next/link";
import {
  Factory,
  Plus,
  Sprout,
  UsersRound,
} from "lucide-react";
import {
  getApiRoot,
  fetchSessionIdentity,
  type SessionIdentity,
} from "@/lib/auth-session";
import { getApiBaseUrl } from "@/lib/api-url";
import { roastPace } from "@/lib/roast-pace";
import { buildCashFlowLines, type CashFlowLine } from "@/lib/finance-cashflow";
import { buildBrief, greenCoverageDays, greenStock, payableSnapshot, salesPace, type SalesGeo } from "@/lib/command-center";
import { buildForecast, cashBufferDays, paidLast30Days, plannedLabel, type RecurringExpense } from "@/lib/cash-forecast";
import type { CashView, CenterTask, TimelineItem } from "./command-center-v4";
import {
  delayFor,
  fixedBufferDays,
  orderTasks,
  repeatedDays,
  saneBufferDays,
  taskSnoozeKey,
  withoutSnoozed,
  freshSaleIds,
  type CommandInsights,
  type SnoozeAction,
  type TodaySales,
} from "@/lib/command-center-v6";
import { CommandCenterV4 } from "./command-center-v4";
import { SellerHome } from "./seller-portfolio";

const kg = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

type AlertTone = "CRÍTICO" | "ATENÇÃO" | "INFORMATIVO" | "POSITIVO";
type HomeData = {
  salesToday: number;
  salesMonth: number;
  openOrders: number;
  overdueOrders: number;
  orderFlow: {
    order: number;
    preparation: number;
    fiscal: number;
    shipping: number;
  };
  productionActualKg: number;
  productionPlannedKg: number;
  pendingLab: number;
  openPurchases: number;
  greenInboundKg?: number;
  finishedGoodsUnits: number;
  finishedGoodsReserved: number;
  roastedStock: {
    physicalKg: number;
    reservedKg: number;
    availableKg: number;
  };
  greenLots: Array<{
    origin: string;
    code: string;
    variety: string;
    currentKg: number;
    reservedKg: number;
    status: string;
  }>;
  alerts: Array<{
    tone: AlertTone;
    title: string;
    impact: string;
    href: string;
    action: string;
  }>;
};

type EvidenceState =
  | "loading"
  | "unavailable"
  | "insufficient"
  | "healthy"
  | "attention"
  | "critical";

const emptyHome: HomeData = {
  salesToday: 0,
  salesMonth: 0,
  openOrders: 0,
  overdueOrders: 0,
  orderFlow: { order: 0, preparation: 0, fiscal: 0, shipping: 0 },
  productionActualKg: 0,
  productionPlannedKg: 0,
  pendingLab: 0,
  openPurchases: 0,
  finishedGoodsUnits: 0,
  finishedGoodsReserved: 0,
  roastedStock: { physicalKg: 0, reservedKg: 0, availableKg: 0 },
  greenLots: [],
  alerts: [],
};

export function HomeCommandV3() {
  const [home, setHome] = React.useState<HomeData>(emptyHome);
  const [identity, setIdentity] = React.useState<SessionIdentity | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [available, setAvailable] = React.useState(true);
  const [finance, setFinance] = React.useState<FinanceSnapshot>(null);
  const [geo, setGeo] = React.useState<SalesGeo | null>(null);
  const [samples, setSamples] = React.useState<ExportSample[]>([]);
  const [insights, setInsights] = React.useState<CommandInsights | null>(null);

  const loadInsights = React.useCallback(async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/command-center/insights`, { credentials: "include", cache: "no-store" });
      if (response.ok) setInsights((await response.json()) as CommandInsights);
    } catch {
      /* a Central funciona sem os dados novos */
    }
  }, []);
  React.useEffect(() => { void loadInsights(); }, [loadInsights]);

  // Vendas de hoje (BBOS + marketplaces), atualizadas a cada minuto com a aba visível.
  const [today, setToday] = React.useState<TodaySales | null>(null);
  const [freshIds, setFreshIds] = React.useState<Set<string>>(new Set());
  React.useEffect(() => {
    let last: TodaySales | null = null;
    let stopped = false;
    const load = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const response = await fetch(`${getApiBaseUrl()}/command-center/today`, { credentials: "include", cache: "no-store" });
        if (!response.ok || stopped) return;
        const next = (await response.json()) as TodaySales;
        setFreshIds(freshSaleIds(last, next));
        last = next;
        setToday(next);
      } catch {
        /* tenta de novo no próximo minuto */
      }
    };
    void load();
    const timer = window.setInterval(load, 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { stopped = true; window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  React.useEffect(() => {
    const apiRoot = getApiBaseUrl();
    const authRoot = getApiRoot();
    void Promise.all([
      fetch(`${apiRoot}/dashboard/home`, {
        credentials: "include",
        cache: "no-store",
      }).then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json();
      }),
      fetchSessionIdentity(authRoot),
    ])
      .then(([data, user]) => {
        const received = data as Partial<HomeData>;
        setHome({
          ...emptyHome,
          ...received,
          orderFlow: received.orderFlow ?? emptyHome.orderFlow,
          roastedStock: received.roastedStock ?? emptyHome.roastedStock,
          greenLots: received.greenLots ?? [],
          alerts: received.alerts ?? [],
        });
        setIdentity(user);
        setAvailable(true);
      })
      .catch(() => setAvailable(false))
      .finally(() => setLoaded(true));
    // Cash and overdue come from Finance; roles without access simply don't see them.
    void Promise.all([
      fetch(`${apiRoot}/finance/summary`, { credentials: "include", cache: "no-store" }),
      fetch(`${apiRoot}/finance/settings`, { credentials: "include", cache: "no-store" }),
      fetch(`${apiRoot}/finance/recurring-expenses`, { credentials: "include", cache: "no-store" }).catch(() => null),
    ])
      .then(async ([summaryResponse, settingsResponse, recurringResponse]) => {
        if (!summaryResponse.ok) return;
        const summary = await summaryResponse.json();
        const settings = settingsResponse.ok ? await settingsResponse.json() : {};
        const recurring: RecurringExpense[] = recurringResponse?.ok ? (await recurringResponse.json()).map((r: RecurringExpense) => ({ ...r, amount: Number(r.amount) })) : [];
        const paid30 = paidLast30Days(summary);
        setFinance({
          cash: typeof summary?.cash === "number" ? summary.cash : null,
          overdue: Number(summary?.delinquency ?? 0),
          cashStarted: Boolean(settings?.cashStartDate),
          cashStartDate: settings?.cashStartDate ?? null,
          minimum: Number(settings?.minimumCashBalance) || 5000,
          recurring,
          paid30,
          lines: buildCashFlowLines({
            cash: Number(summary?.cash ?? 0),
            receivables: summary?.receivableProjection,
            payables: summary?.payableProjection,
            purchases: summary?.greenCoffeePurchaseProjection,
            taxes: summary?.taxProjection,
            marketplace: summary?.marketplaceProjection,
          }),
        });
      })
      .catch(() => undefined);
    // Month comparison, best customers and cities (roles without sales access skip it).
    void fetch(`${apiRoot}/dashboard/sales-geography?period=month`, { credentials: "include", cache: "no-store" })
      .then(async (response) => (response.ok ? ((await response.json()) as SalesGeo) : null))
      .then((data) => setGeo(data && typeof data.revenue === "number" ? data : null))
      .catch(() => undefined);
    // Amostras de exportação com problema na transportadora (quem não tem acesso não vê).
    void fetch(`${apiRoot}/exports/samples`, { credentials: "include", cache: "no-store" })
      .then(async (response) => (response.ok ? ((await response.json()) as ExportSample[]) : []))
      .then((list) => setSamples(Array.isArray(list) ? list : []))
      .catch(() => undefined);
  }, []);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const firstName = identity?.name?.split(" ")[0] ?? "";
  const isSales = identity?.role === "SALES";
  const critical = home.alerts.filter((i) => i.tone === "CRÍTICO").length;
  const attention = home.alerts.filter((i) => i.tone === "ATENÇÃO").length;
  const green = greenStock(home.greenLots);
  const hasEvidence =
    home.salesToday > 0 ||
    home.salesMonth > 0 ||
    home.openOrders > 0 ||
    home.overdueOrders > 0 ||
    home.productionActualKg > 0 ||
    home.productionPlannedKg > 0 ||
    home.pendingLab > 0 ||
    home.openPurchases > 0 ||
    home.finishedGoodsUnits > 0 ||
    home.finishedGoodsReserved > 0 ||
    home.greenLots.length > 0 ||
    home.alerts.length > 0;

  const state: EvidenceState = !loaded
    ? "loading"
    : !available
      ? "unavailable"
      : critical
        ? "critical"
        : attention
          ? "attention"
          : !hasEvidence
            ? "insufficient"
            : "healthy";


  if (loaded && isSales) {
    return (
      <SellerHome greeting={greeting} firstName={firstName} />
    );
  }

  const decisions = home.alerts.filter((alert) => alert.tone === "CRÍTICO" || alert.tone === "ATENÇÃO");
  return (
    <CommandCenter
      home={home}
      greeting={greeting}
      firstName={firstName}
      decisions={decisions}
      state={state}
      green={green}
      finance={finance}
      geo={geo}
      samples={samples}
      insights={insights}
      reloadInsights={loadInsights}
      today={today}
      freshIds={freshIds}
    />
  );
}

type ExportSample = { id: string; buyerCountry?: string | null; buyerName?: string | null; carrier?: string | null; status: string; trackingProblem?: string | null; lastEventAt?: string | null };
type FinanceSnapshot = {
  cash: number | null; overdue: number; cashStarted: boolean; lines: CashFlowLine[];
  cashStartDate?: string | null; minimum?: number; recurring?: RecurringExpense[]; paid30?: number;
} | null;
type Task = CenterTask;

const CAUSE: Record<string, string> = {
  Aluguel: "o aluguel", Seguros: "o seguro", "Energia elétrica": "a conta de luz", Água: "a conta de água",
  "Internet / telefonia": "a conta de telefone", "Site / sistemas": "o site", "Funcionários / salários": "a folha", Contabilidade: "a contabilidade",
};
const dayMonth = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const brlTaskShort = (value: number) => brlTask.format(value);

/**
 * Contas a pagar que pedem ação hoje (Salesforce/Dynamics "next best action"):
 * o que vence hoje e o que ficou vencido para trás. O pagamento continua sendo
 * aprovado no app do banco; aqui só se confere e se dá baixa.
 */
function payableTasks(finance: FinanceSnapshot): Task[] {
  if (!finance) return [];
  const snap = payableSnapshot(finance.lines);
  const list: Task[] = [];
  if (snap.dueToday > 0) {
    const first = snap.dueTodayLines[0]!;
    const who = snap.dueTodayLines.length === 1 ? `${first.document} · ${first.counterparty}` : `${snap.dueTodayLines.length} contas`;
    list.push({ key: "pay-today", tone: "critical", title: `${brlTask.format(snap.dueToday)} a pagar hoje`, detail: `${who} · aprovar no app do Itaú e dar baixa aqui`, href: "/financeiro/pagar", action: "Ver contas a pagar" });
  }
  if (snap.overdueCount > 0)
    list.push({ key: "pay-overdue", tone: "attention", title: `${snap.overdueCount} ${snap.overdueCount === 1 ? "conta a pagar vencida" : "contas a pagar vencidas"}`, detail: `${brlTask.format(snap.overdue)} · confira se já foram pagas e dê baixa`, href: "/financeiro/pagar", action: "Revisar" });
  return list;
}

const brlTask = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/**
 * Command center (SAP Fiori overview page / Dynamics 365 workspace): what needs
 * a decision first, then four numbers with a comparison, free stock and the
 * coffee path. Each card says something no other card repeats.
 */
function CommandCenter({
  home, greeting, firstName, decisions, state,
  green, finance, geo, samples, insights, reloadInsights, today, freshIds,
}: {
  home: HomeData; greeting: string; firstName: string;
  decisions: HomeData["alerts"]; state: EvidenceState;
  green: { total: number; reserved: number; free: number };
  finance: FinanceSnapshot; geo: SalesGeo | null; samples: ExportSample[];
  insights: CommandInsights | null; reloadInsights: () => Promise<void>;
  today: TodaySales | null; freshIds: Set<string>;
}) {
  // Tarefas adiadas (Feito / Amanhã / 7 dias): vêm do servidor e somem na hora ao clicar.
  const [snoozed, setSnoozed] = React.useState<Set<string>>(new Set());
  React.useEffect(() => {
    if (insights) setSnoozed(new Set(insights.snoozes.map((item) => item.taskKey)));
  }, [insights]);
  // Desde quando cada tarefa aparece (neste navegador), para o alerta repetido perder força.
  const [firstSeen, setFirstSeen] = React.useState<Record<string, string>>({});
  React.useEffect(() => {
    try {
      setFirstSeen(JSON.parse(window.localStorage.getItem("bbos.center.firstSeen") || "{}"));
    } catch {
      /* sem histórico local, nada se repete */
    }
  }, []);

  const snooze = async (task: CenterTask, action: SnoozeAction) => {
    const key = taskSnoozeKey(task);
    setSnoozed((current) => new Set(current).add(key));
    const response = await fetch(`${getApiBaseUrl()}/command-center/tasks/snooze`, {
      method: "POST", credentials: "include", headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskKey: key, action }),
    }).catch(() => null);
    if (!response?.ok) {
      setSnoozed((current) => { const next = new Set(current); next.delete(key); return next; });
      return false;
    }
    return true;
  };
  const undoSnooze = async (task: CenterTask) => {
    const key = taskSnoozeKey(task);
    setSnoozed((current) => { const next = new Set(current); next.delete(key); return next; });
    await fetch(`${getApiBaseUrl()}/command-center/tasks/snooze/${encodeURIComponent(key)}`, { method: "DELETE", credentials: "include" }).catch(() => null);
  };
  const saveGoal = async (month: string, salesTarget: number | null) => {
    const response = await fetch(`${getApiBaseUrl()}/command-center/goal`, {
      method: "PUT", credentials: "include", headers: { "content-type": "application/json" },
      body: JSON.stringify({ month, salesTarget }),
    }).catch(() => null);
    if (!response) return "Sem conexão. Tente de novo.";
    if (response.status === 403) return "Só a liderança (administrador ou executivo) define a meta.";
    if (!response.ok) return ((await response.json().catch(() => ({}))) as { message?: string }).message ?? "Não foi possível salvar a meta.";
    await reloadInsights();
    return null;
  };
  const pace = roastPace(home.productionActualKg, home.productionPlannedKg);
  // Marketplace que ainda está só na caixa de entrada entra nas vendas do mês.
  const marketplaceMonth = today?.marketplaceMonth.amount ?? 0;
  const salesMonthAll = home.salesMonth + marketplaceMonth;
  const minimum = finance?.minimum ?? 5000;
  // Previsão do caixa (mesma do Fluxo de caixa): saldo + títulos + despesas fixas.
  const forecast = finance
    ? buildForecast({ startBalance: finance.cashStarted ? finance.cash ?? 0 : 0, lines: finance.lines, recurring: finance.recurring ?? [], horizonDays: 30, minimum })
    : null;
  const known = Boolean(finance?.cashStarted && forecast);
  const worstCauseEvent = forecast ? [...forecast.worst.events].sort((a, b) => a.amount - b.amount)[0] : undefined;
  const worstCause = worstCauseEvent && worstCauseEvent.amount < 0
    ? (worstCauseEvent.kind === "previsto" ? CAUSE[worstCauseEvent.detail] : undefined) ?? `o pagamento a ${worstCauseEvent.label}`
    : undefined;
  const cashView: CashView | null = finance && forecast ? {
    known,
    balance: finance.cash ?? 0,
    bufferDays: known ? saneBufferDays(cashBufferDays(finance.cash ?? 0, finance.paid30 ?? 0)) : null,
    fixedBufferDays: known ? fixedBufferDays(finance.cash ?? 0, finance.recurring ?? []) : null,
    worst: known ? { date: forecast.worst.date, balance: forecast.worst.balance } : null,
    minimum,
  } : null;
  const brief = buildBrief({
    projection: salesPace(salesMonthAll).projection,
    revenue: (geo?.revenue ?? home.salesMonth) + marketplaceMonth,
    previousRevenue: geo?.previousRevenue ?? 0,
    worst: known && forecast ? { date: forecast.worst.date, balance: forecast.worst.balance, cause: worstCause } : null,
    minimum,
    overdue: forecast?.overdueReceivable ?? 0,
    coverageDays: greenCoverageDays(green.free, home.productionPlannedKg),
  });

  // Decidir hoje: cada item diz por que importa; ordem por impacto.
  const overdueTask: Task[] = forecast && forecast.overdueReceivable > 0 ? [{
    key: "overdue",
    tone: "critical",
    title: `Cobrar ${brlTaskShort(forecast.overdueReceivable)} vencidos`,
    detail: forecast.overdueIn.slice(0, 3).map((line) => `${line.counterparty} ${brlTaskShort(line.amount)}`).join(" · "),
    why: known && forecast.worst.balance < minimum && forecast.worst.date > forecast.today
      ? `Evita o caixa abaixo do mínimo no dia ${dayMonth(forecast.worst.date)}`
      : undefined,
    href: "/financeiro/receber",
    action: "Cobrar com Pix ou boleto",
  }] : [];
  const statementAge = finance?.cashStartDate ? Math.floor((Date.now() - Date.parse(`${finance.cashStartDate}T12:00:00Z`)) / 86_400_000) : null;
  const statementTask: Task[] = finance && (!finance.cashStarted || (statementAge !== null && statementAge > 7)) ? [{
    key: "statement",
    tone: "attention",
    title: finance.cashStarted ? "Atualizar o extrato do Itaú" : "Importar o extrato do Itaú",
    detail: finance.cashStarted ? `O último saldo é de ${dayMonth(finance.cashStartDate!)}` : "O saldo do banco, as baixas e as despesas fixas vêm dele",
    why: finance.cashStarted ? "Pagamentos feitos no banco aparecem em aberto até lá" : undefined,
    href: "/financeiro/conciliacao/importar",
    action: "Importar extrato",
  }] : [];
  const stuck = samples.filter((sample) => sample.trackingProblem && !["DELIVERED", "EVALUATED", "LOST", "RETURNED"].includes(sample.status));
  const sampleTask: Task[] = stuck.length ? [{
    key: "samples",
    tone: "attention",
    title: `Amostra ${stuck[0]!.buyerCountry ? `para ${stuck[0]!.buyerCountry} ` : ""}com problema no envio`,
    detail: `${stuck[0]!.carrier ?? "Transportadora"} · ${stuck[0]!.trackingProblem!.replace(/^Ocorrência no envio: /, "")}`.slice(0, 140),
    why: stuck.length > 1 ? `Mais ${stuck.length - 1} ${stuck.length === 2 ? "amostra" : "amostras"} com problema` : undefined,
    href: "/exportacoes/amostras",
    action: "Ver amostras",
  }] : [];
  const lapsed = insights?.customers.lapsed ?? [];
  const lapsedTask: Task[] = lapsed.length ? [{
    key: "lapsed",
    tone: "attention",
    title: lapsed.length === 1 ? `Falar com ${lapsed[0]!.name}` : `Falar com ${lapsed.length} clientes sem recompra`,
    detail: lapsed.length === 1
      ? `${lapsed[0]!.daysSince} dias sem pedido · costuma comprar a cada ${lapsed[0]!.avgIntervalDays} dias`
      : lapsed.slice(0, 3).map((c) => `${c.name} · ${c.daysSince} dias (costuma ${c.avgIntervalDays})`).join(" · "),
    why: "Cliente recorrente que passou do ritmo de compra costuma ser recuperado com uma ligação",
    href: "/clientes",
    action: "Ver clientes",
  }] : [];
  const tasks: Task[] = [
    ...overdueTask,
    ...statementTask,
    ...decisions
      .filter((alert) => !(overdueTask.length && alert.href.startsWith("/financeiro/receber")))
      .map((alert) => ({
      key: alert.title,
      tone: alert.tone === "CRÍTICO" ? ("critical" as const) : ("attention" as const),
      title: alert.title.replace(/\(s\)/g, Number.parseInt(alert.title, 10) > 1 ? "s" : ""),
      detail: alert.impact,
      href: alert.href,
      action: alert.action,
    })),
    ...payableTasks(finance),
    ...(home.orderFlow.fiscal > 0
      ? [{
          key: "nfe",
          tone: "ok" as const,
          title: `${home.orderFlow.fiscal} ${home.orderFlow.fiscal === 1 ? "pedido pronto" : "pedidos prontos"} para NF-e`,
          detail: "Emitir libera a expedição e o e-mail com PDF e XML",
          href: "/pedidos?filtro=emitir-nf",
          action: "Emitir NF-e",
        }]
      : []),
    ...sampleTask,
    ...lapsedTask,
    ...(pace.behindKg >= 10
      ? [{
          key: "roast",
          tone: "attention" as const,
          title: `Torra ${kg.format(pace.behindKg)} kg atrás do plano`,
          detail: pace.daysLeft > 0
            ? `Faltam ${kg.format(pace.missingKg)} kg em ${pace.daysLeft} ${pace.daysLeft === 1 ? "dia útil" : "dias úteis"} → cerca de ${kg.format(pace.perDayKg)} kg por dia`
            : `Faltam ${kg.format(pace.missingKg)} kg para fechar o plano do mês`,
          href: "/producao",
          action: "Programar torra",
        }]
      : []),
  ];
  const withAge = tasks.map((task) => ({ ...task, repeatedDays: repeatedDays(firstSeen[taskSnoozeKey(task)]) }));
  const visibleTasks = orderTasks(withoutSnoozed(withAge, snoozed)).slice(0, 5);
  const seenSignature = tasks.map(taskSnoozeKey).join("\n");
  React.useEffect(() => {
    const keys = seenSignature ? seenSignature.split("\n") : [];
    if (!keys.length) return;
    const now = new Date().toISOString();
    const next: Record<string, string> = {};
    for (const key of keys) next[key] = firstSeen[key] ?? now;
    if (keys.every((key) => firstSeen[key]) && Object.keys(firstSeen).length === keys.length) return;
    setFirstSeen(next);
    try { window.localStorage.setItem("bbos.center.firstSeen", JSON.stringify(next)); } catch { /* opcional */ }
  }, [seenSignature, firstSeen]);

  // Próximos 7 dias: dinheiro (previsão) e operação; o pior dia entra em destaque.
  const timeline: TimelineItem[] = [];
  if (forecast) {
    for (const day of forecast.days.slice(0, 8)) {
      const launched = day.events.filter((e) => e.kind === "lancado");
      const planned = day.events.filter((e) => e.kind === "previsto");
      for (const e of launched) {
        const delay = e.amount > 0 ? delayFor(e.label, insights?.payerDelays) : null;
        timeline.push({ key: e.id, date: day.date, label: e.amount > 0 ? `${e.label} paga` : e.label, amount: e.amount, note: delay ? `costuma atrasar ${delay} dias` : undefined, warn: Boolean(delay) });
      }
      if (planned.length)
        timeline.push({ key: `p${day.date}`, date: day.date, label: plannedLabel(planned), note: planned.every((e) => e.id.startsWith("tax-")) ? "imposto estimado" : "previsto", amount: planned.reduce((sum, e) => sum + e.amount, 0) });
    }
    const lastDay = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
    const lastIso = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;
    if (lastIso <= forecast.days[Math.min(7, forecast.days.length - 1)]!.date && home.productionPlannedKg > 0)
      timeline.push({ key: "close", date: lastIso, label: "Fechamento do mês", note: pace.missingKg > 0 ? `faltam ${kg.format(pace.missingKg)} kg de torra` : "meta de torra batida", amount: null });
    if (known && forecast.worst.balance < minimum && forecast.worst.date > forecast.days[7]!.date)
      timeline.push({ key: "worst", date: forecast.worst.date, label: worstCause ? worstCause.charAt(0).toUpperCase() + worstCause.slice(1) : "Pior dia do caixa", note: `saldo cai para ${brlTaskShort(forecast.worst.balance)}`, amount: worstCauseEvent?.amount ?? null, alert: true });
    timeline.sort((a, b) => a.date.localeCompare(b.date));
  }

  // Confiança no número: de quando é o saldo e quando a tela foi montada.
  const freshness = [
    finance?.cashStartDate ? `Extrato de ${dayMonth(finance.cashStartDate)}` : finance ? "Sem extrato importado" : null,
    `dados de ${new Date(insights?.generatedAt ?? Date.now()).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
  ].filter(Boolean).join(" · ");

  const summary =
    state === "loading"
      ? "Reunindo a operação de hoje…"
      : state === "unavailable"
        ? "A conexão com os dados está sendo retomada."
        : visibleTasks.length
          ? `${visibleTasks.length} ${visibleTasks.length === 1 ? "coisa pede" : "coisas pedem"} você`
          : "Nada pede decisão agora";
  return (
    <CommandCenterV4
      home={{ ...home, salesMonth: salesMonthAll, salesToday: today?.total ?? home.salesToday }}
      today={today}
      freshIds={freshIds}
      greeting={greeting}
      firstName={firstName}
      summary={summary}
      tasks={visibleTasks}
      onSnooze={snooze}
      onUndoSnooze={undoSnooze}
      insights={insights}
      onSaveGoal={saveGoal}
      freshness={freshness}
      greenTotal={green.total}
      greenReserved={green.reserved}
      greenFree={green.free}
      cashLines={finance?.lines ?? []}
      financeReady={Boolean(finance)}
      brief={brief}
      cashView={cashView}
      timeline={timeline}
      geo={geo}
      newMenu={<NewMenu />}
    />
  );
}

/** The four quick actions in one "+ Novo" menu, top right (SAP / Dynamics). */
function NewMenu() {
  const [open, setOpen] = React.useState(false);
  const items = [
    { href: "/pedidos?novo=1", label: "Novo pedido", icon: Plus },
    { href: "/clientes?novo=1", label: "Novo cliente", icon: UsersRound },
    { href: "/producao", label: "Programar torra", icon: Factory },
    { href: "/recebimento", label: "Registrar recebimento", icon: Sprout },
  ];
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-xl bg-[var(--bbos-action-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--bbos-action-primary-hover)]"
      >
        <Plus size={16} /> Novo
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-[var(--bbos-border)] bg-white py-1 shadow-lg">
          {items.map(({ href, label, icon: Icon }) => (
            <Link key={href} role="menuitem" href={href} onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-2 px-3 text-sm hover:bg-[var(--bbos-surface-subtle)]">
              <Icon size={15} /> {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

