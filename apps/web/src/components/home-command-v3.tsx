"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardCheck,
  Factory,
  Plus,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  Sprout,
  UsersRound,
  WalletCards,
} from "lucide-react";
import {
  getApiRoot,
  fetchSessionIdentity,
  type SessionIdentity,
} from "@/lib/auth-session";
import { getApiBaseUrl } from "@/lib/api-url";
import { roastPace } from "@/lib/roast-pace";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const kg = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/* Small hand-drawn illustrations for the coffee path (decorative). */
function SackArt() {
  return (
    <svg aria-hidden width="34" height="34" viewBox="0 0 34 34"><path d="M8 10c0-3 18-3 18 0l-2 18c0 2-14 2-14 0z" fill="#E6D3B8" stroke="#8A5A35" strokeWidth="1.5" /><ellipse cx="14" cy="18" rx="2" ry="3" fill="#6B8F4E" /><ellipse cx="20" cy="20" rx="2" ry="3" fill="#6B8F4E" /></svg>
  );
}
function FlaskArt() {
  return (
    <svg aria-hidden width="34" height="34" viewBox="0 0 34 34"><path d="M13 6h8M15 6v8l-6 12c-1 2 0 3 2 3h12c2 0 3-1 2-3l-6-12V6" fill="none" stroke="#2F6B57" strokeWidth="1.8" /><path d="M11 22h12" stroke="#2F6B57" strokeWidth="1.5" /></svg>
  );
}
function RoasterArt() {
  return (
    <svg aria-hidden width="34" height="34" viewBox="0 0 34 34"><rect x="7" y="12" width="20" height="14" rx="3" fill="#F3E1C4" stroke="#9A5B06" strokeWidth="1.5" /><path d="M12 12c0-3 2-4 2-6M17 12c0-3 2-4 2-6M22 12c0-3 2-4 2-6" stroke="#9A5B06" strokeWidth="1.4" fill="none" /></svg>
  );
}
function BoxArt() {
  return (
    <svg aria-hidden width="34" height="34" viewBox="0 0 34 34"><rect x="8" y="10" width="18" height="18" rx="2" fill="#EFE7DA" stroke="#56615C" strokeWidth="1.4" /><path d="M8 15h18" stroke="#56615C" /><circle cx="17" cy="21" r="3" fill="#8A5A35" /></svg>
  );
}
function InvoiceArt() {
  return (
    <svg aria-hidden width="34" height="34" viewBox="0 0 34 34"><path d="M9 7h16v20H9z" fill="#fff" stroke="#2F6B57" strokeWidth="1.5" /><path d="M12 12h10M12 16h10M12 20h6" stroke="#2F6B57" strokeWidth="1.4" /></svg>
  );
}
function TruckArt() {
  return (
    <svg aria-hidden width="34" height="34" viewBox="0 0 34 34"><path d="M4 12h16v11H4zM20 15h5l4 4v4h-9z" fill="#fff" stroke="#56615C" strokeWidth="1.5" /><circle cx="9" cy="24" r="2.5" fill="#56615C" /><circle cx="24" cy="24" r="2.5" fill="#56615C" /></svg>
  );
}

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
    ])
      .then(async ([summaryResponse, settingsResponse]) => {
        if (!summaryResponse.ok) return;
        const summary = await summaryResponse.json();
        const settings = settingsResponse.ok ? await settingsResponse.json() : {};
        setFinance({
          cash: typeof summary?.cash === "number" ? summary.cash : null,
          overdue: Number(summary?.delinquency ?? 0),
          cashStarted: Boolean(settings?.cashStartDate),
        });
      })
      .catch(() => undefined);
  }, []);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const firstName = identity?.name?.split(" ")[0] ?? "";
  const isSales = identity?.role === "SALES";
  const critical = home.alerts.filter((i) => i.tone === "CRÍTICO").length;
  const attention = home.alerts.filter((i) => i.tone === "ATENÇÃO").length;
  const greenAvailable = home.greenLots.reduce((s, l) => s + l.currentKg, 0);
  const greenReserved = home.greenLots.reduce((s, l) => s + l.reservedKg, 0);
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

  const openAI = () => window.dispatchEvent(new Event("bbos:open-assistant"));
  const finishedAvailable = Math.max(
    0,
    home.finishedGoodsUnits - home.finishedGoodsReserved,
  );

  if (loaded && isSales) {
    return (
      <SalesHome
        greeting={greeting}
        firstName={firstName}
        home={home}
        state={state}
        onOpenAssistant={openAI}
      />
    );
  }

  const plannedKg = home.productionPlannedKg;
  const roastPercent = plannedKg > 0 ? Math.min(100, (home.productionActualKg / plannedKg) * 100) : 0;
  const dateLabel = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  // The coffee's path today (SAP Fiori process flow): each step opens its list.
  const coffeePath: Array<{
    key: string;
    label: string;
    value: string;
    href: string;
    tone: "neutral" | "ok" | "attention" | "critical";
    badge?: string;
    art: React.ReactNode;
  }> = [
    {
      key: "purchase",
      label: "Compras a receber",
      value: String(home.openPurchases),
      href: "/cafe-verde",
      tone: "neutral",
      art: <SackArt />,
    },
    {
      key: "lab",
      label: "No laboratório",
      value: String(home.pendingLab),
      href: "/laboratorio",
      tone: home.pendingLab ? "attention" : "ok",
      badge: home.pendingLab ? "aguardando análise" : "em dia",
      art: <FlaskArt />,
    },
    {
      key: "roast",
      label: "Torra no mês",
      value: plannedKg > 0 ? `${kg.format(home.productionActualKg)} / ${kg.format(plannedKg)} kg` : `${kg.format(home.productionActualKg)} kg`,
      href: "/producao",
      tone: plannedKg > 0 && roastPercent < 50 ? "attention" : "neutral",
      badge: plannedKg > 0 ? `${percent.format(roastPercent)}% do plano` : undefined,
      art: <RoasterArt />,
    },
    {
      key: "stock",
      label: "Produto acabado livre",
      value: `${kg.format(finishedAvailable)} un.`,
      href: "/estoque",
      tone: finishedAvailable > 0 ? "neutral" : "attention",
      art: <BoxArt />,
    },
    {
      key: "fiscal",
      label: "Prontos para NF-e",
      value: String(home.orderFlow.fiscal),
      href: home.orderFlow.fiscal ? "/pedidos?filtro=emitir-nf" : "/pedidos",
      tone: home.orderFlow.fiscal ? "ok" : "neutral",
      badge: home.orderFlow.fiscal ? "emitir" : undefined,
      art: <InvoiceArt />,
    },
    {
      key: "shipping",
      label: "Na expedição",
      value: String(home.orderFlow.shipping),
      href: home.overdueOrders ? "/pedidos?filtro=atrasados" : "/pedidos",
      tone: home.overdueOrders ? "critical" : "neutral",
      badge: home.overdueOrders ? `${home.overdueOrders} sem entrega registrada` : undefined,
      art: <TruckArt />,
    },
  ];
  const decisions = home.alerts.filter((alert) => alert.tone === "CRÍTICO" || alert.tone === "ATENÇÃO");
  return (
    <CommandCenter
      home={home}
      greeting={greeting}
      firstName={firstName}
      dateLabel={dateLabel}
      decisions={decisions}
      state={state}
      roastPercent={roastPercent}
      greenAvailable={greenAvailable}
      greenReserved={greenReserved}
      finishedAvailable={finishedAvailable}
      finance={finance}
      coffeePath={coffeePath}
    />
  );
}

type CoffeeStep = {
  key: string;
  label: string;
  value: string;
  href: string;
  tone: "neutral" | "ok" | "attention" | "critical";
  badge?: string;
  art: React.ReactNode;
};
type FinanceSnapshot = { cash: number | null; overdue: number; cashStarted: boolean } | null;
type Task = { key: string; tone: "critical" | "attention" | "ok"; title: string; detail: string; href: string; action: string };

/**
 * Command center (SAP Fiori overview page / Dynamics 365 workspace): what needs
 * a decision first, then four numbers with a comparison, free stock and the
 * coffee path. Each card says something no other card repeats.
 */
function CommandCenter({
  home, greeting, firstName, dateLabel, decisions, state, roastPercent,
  greenAvailable, greenReserved, finishedAvailable, finance, coffeePath,
}: {
  home: HomeData; greeting: string; firstName: string; dateLabel: string;
  decisions: HomeData["alerts"]; state: EvidenceState; roastPercent: number;
  greenAvailable: number; greenReserved: number; finishedAvailable: number;
  finance: FinanceSnapshot; coffeePath: CoffeeStep[];
}) {
  const pace = roastPace(home.productionActualKg, home.productionPlannedKg);
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const greenFree = Math.max(0, greenAvailable - greenReserved);

  const tasks: Task[] = [
    ...decisions.map((alert) => ({
      key: alert.title,
      tone: alert.tone === "CRÍTICO" ? ("critical" as const) : ("attention" as const),
      title: alert.title.replace(/\(s\)/g, ""),
      detail: alert.impact,
      href: alert.href,
      action: alert.action,
    })),
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
    ...(pace.behindKg > 0
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
  const summary =
    state === "loading"
      ? "Reunindo a operação de hoje…"
      : state === "unavailable"
        ? "A conexão com os dados está sendo retomada."
        : tasks.length
          ? `${tasks.length} ${tasks.length === 1 ? "coisa pede" : "coisas pedem"} você`
          : "Nada pede decisão agora";
  const taskTone = {
    critical: "bg-[#fdecea] text-[var(--bbos-danger)]",
    attention: "bg-[var(--bbos-warning-soft)] text-[var(--bbos-warning)]",
    ok: "bg-[var(--bbos-success-soft)] text-[var(--bbos-success)]",
  } as const;
  const stepTone = {
    neutral: "",
    ok: "border-[var(--bbos-success)] bg-[var(--bbos-success-soft)]",
    attention: "",
    critical: "border-[#f3c1bb] bg-[#fdecea]",
  } as const;
  const card = "rounded-2xl border border-[var(--bbos-border)] bg-white";

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 pb-24 sm:pb-6">
      <section className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-.01em]">
            {greeting}{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-0.5 text-sm text-[var(--bbos-text-secondary)] first-letter:uppercase">
            {dateLabel} · {summary}
          </p>
        </div>
        <NewMenu />
      </section>

      <section aria-label="Números do mês" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Link href="/vendas" className={`${card} p-4 hover:bg-[var(--bbos-surface-subtle)]`}>
          <span className="block text-[11px] font-bold uppercase tracking-[.06em] text-[var(--bbos-text-secondary)]">Vendas no mês</span>
          <span className="mt-1 block text-[clamp(20px,2vw,26px)] font-bold tabular-nums">{money.format(home.salesMonth).replace(/,\d\d$/, "")}</span>
          <span className="block text-xs text-[var(--bbos-text-secondary)]">hoje {money.format(home.salesToday).replace(/,\d\d$/, "")} · dia {today.getDate()} de {daysInMonth}</span>
        </Link>
        <Link href="/financeiro" className={`${card} p-4 hover:bg-[var(--bbos-surface-subtle)]`}>
          <span className="block text-[11px] font-bold uppercase tracking-[.06em] text-[var(--bbos-text-secondary)]">A receber vencido</span>
          <span className={`mt-1 block text-[clamp(20px,2vw,26px)] font-bold tabular-nums ${finance && finance.overdue > 0 ? "text-[var(--bbos-danger)]" : ""}`}>
            {finance ? money.format(finance.overdue).replace(/,\d\d$/, "") : "—"}
          </span>
          <span className="block text-xs text-[var(--bbos-text-secondary)]">{finance && finance.overdue > 0 ? "cobrar com Pix" : "nada vencido"}</span>
        </Link>
        <Link href={finance?.cashStarted ? "/financeiro" : "/financeiro/parametros"} className={`${card} p-4 hover:bg-[var(--bbos-surface-subtle)]`}>
          <span className="block text-[11px] font-bold uppercase tracking-[.06em] text-[var(--bbos-text-secondary)]">Caixa</span>
          <span className="mt-1 block text-[clamp(20px,2vw,26px)] font-bold tabular-nums">
            {finance?.cashStarted && finance.cash !== null ? money.format(finance.cash).replace(/,\d\d$/, "") : "R$ —"}
          </span>
          <span className="block text-xs text-[var(--bbos-text-secondary)]">
            {finance?.cashStarted ? "saldo em conta hoje" : "informe o saldo em Parâmetros"}
          </span>
        </Link>
        <Link href="/producao" className={`${card} p-4 hover:bg-[var(--bbos-surface-subtle)]`}>
          <span className="block text-[11px] font-bold uppercase tracking-[.06em] text-[var(--bbos-text-secondary)]">Torra do mês</span>
          <span className={`mt-1 block text-[clamp(20px,2vw,26px)] font-bold tabular-nums ${pace.behindKg > 0 ? "text-[var(--bbos-warning)]" : ""}`}>
            {kg.format(home.productionActualKg)}
            {home.productionPlannedKg > 0 && <span className="text-sm font-semibold text-[var(--bbos-text-secondary)]"> / {kg.format(home.productionPlannedKg)} kg</span>}
          </span>
          <span className="block text-xs text-[var(--bbos-text-secondary)]">
            {home.productionPlannedKg > 0 ? `esperado até hoje: ${kg.format(pace.expectedKg)} kg` : "sem plano no mês"}
          </span>
          {home.productionPlannedKg > 0 && (
            <span aria-hidden className="relative mt-2.5 block h-1.5 rounded-full bg-[#eceee9]">
              <span className={`absolute inset-y-0 left-0 rounded-full ${pace.behindKg > 0 ? "bg-[var(--bbos-warning)]" : "bg-[var(--bbos-success)]"}`} style={{ width: `${roastPercent}%` }} />
              <span className="absolute -top-1 h-3.5 w-0.5 bg-[var(--bbos-text-primary,#14201b)]" style={{ left: `${Math.min(100, (pace.expectedKg / home.productionPlannedKg) * 100)}%` }} />
            </span>
          )}
        </Link>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <section aria-labelledby="decisions-title" className={`${card} p-4`}>
          <h2 id="decisions-title" className="mb-1 flex items-center gap-2 text-base font-semibold">
            Para resolver agora
            {tasks.length > 0 && <span className="rounded-full bg-[var(--bbos-text-primary,#14201b)] px-2 text-xs font-semibold text-white">{tasks.length}</span>}
          </h2>
          {tasks.length === 0 ? (
            <p className="py-4 text-sm text-[var(--bbos-text-secondary)]">
              {state === "loading" ? "Carregando…" : "Nada pendente. Bom trabalho."}
            </p>
          ) : (
            <ul className="divide-y divide-[#eef1ed]">
              {tasks.map((task, index) => (
                <li key={task.key} className="grid grid-cols-[36px_1fr] items-center gap-x-3 gap-y-2 py-3 sm:grid-cols-[36px_1fr_auto]">
                  <span aria-hidden className={`grid size-9 place-items-center rounded-xl ${taskTone[task.tone]}`}>
                    {task.tone === "ok" ? <ClipboardCheck size={17} /> : task.key === "roast" ? <Factory size={17} /> : <ShieldAlert size={17} />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{task.title}</p>
                    <p className="text-xs text-[var(--bbos-text-secondary)]">{task.detail}</p>
                  </div>
                  <Link
                    href={task.href}
                    className={`col-start-2 inline-flex min-h-10 items-center justify-self-start whitespace-nowrap rounded-lg px-3 text-xs font-semibold sm:col-start-3 ${index === 0 ? "bg-[var(--bbos-action-primary)] text-white hover:bg-[var(--bbos-action-primary-hover)]" : "border border-[var(--bbos-border)] bg-white hover:bg-[var(--bbos-surface-subtle)]"}`}
                  >
                    {task.action}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="stock-title" className={`${card} p-4`}>
          <div className="mb-2 flex items-center justify-between">
            <h2 id="stock-title" className="text-base font-semibold">Estoque livre</h2>
            <Link href="/estoque" className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--bbos-coffee-green)]">Ver estoque <ArrowRight size={13} /></Link>
          </div>
          <StockLine
            label="Café verde"
            value={`${kg.format(greenFree)} kg`}
            share={greenAvailable > 0 ? greenFree / greenAvailable : 0}
            note={`${kg.format(greenAvailable)} kg no total · ${kg.format(greenReserved)} kg reservados · ${greenFree >= 60 ? `≈ ${percent.format(greenFree / 60)} sacas livres` : "menos de 1 saca livre"}`}
          />
          <StockLine
            label="Café torrado"
            value={`${kg.format(home.roastedStock.availableKg)} kg`}
            share={home.roastedStock.physicalKg > 0 ? home.roastedStock.availableKg / home.roastedStock.physicalKg : 0}
            note={home.roastedStock.reservedKg > 0 ? `${kg.format(home.roastedStock.reservedKg)} kg reservados` : "nada reservado"}
          />
          <StockLine
            label="Produto embalado"
            value={`${kg.format(finishedAvailable)} un.`}
            share={home.finishedGoodsUnits > 0 ? finishedAvailable / home.finishedGoodsUnits : 0}
            note={home.finishedGoodsReserved > 0 ? `${kg.format(home.finishedGoodsReserved)} un. reservadas` : "pronto para vender"}
          />
        </section>
      </div>

      <section aria-labelledby="coffee-path-title" className={`${card} p-4`}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="coffee-path-title" className="text-base font-semibold">O caminho do café</h2>
          <Link href="/pedidos" className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--bbos-coffee-green)]">Ver pedidos <ArrowRight size={13} /></Link>
        </div>
        <ol className="grid grid-cols-3 gap-2 xl:grid-cols-6">
          {coffeePath.map((step) => {
            const zero = /^0( |$)/.test(step.value);
            return (
              <li key={step.key}>
                <Link
                  href={step.href}
                  className={`block h-full rounded-xl border border-[var(--bbos-border)] p-3 transition hover:bg-[var(--bbos-surface-subtle)] ${zero ? "opacity-50" : stepTone[step.tone]}`}
                >
                  <span className="block text-lg font-bold tabular-nums leading-tight">{step.value}</span>
                  <span className="block text-xs text-[var(--bbos-text-secondary)]">{step.label}</span>
                  {!zero && step.tone === "ok" && step.badge && (
                    <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-[var(--bbos-success)]">{step.badge} <ArrowRight size={11} /></span>
                  )}
                </Link>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function StockLine({ label, value, share, note }: { label: string; value: string; share: number; note: string }) {
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-lg font-bold tabular-nums">{value}</span>
      </div>
      <span aria-hidden className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-[#dfe6df]">
        <span className="bg-[var(--bbos-success)]" style={{ width: `${Math.max(0, Math.min(1, share)) * 100}%` }} />
      </span>
      <span className="mt-1 block text-xs text-[var(--bbos-text-secondary)]">{note}</span>
    </div>
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


function SalesHome({
  greeting,
  firstName,
  home,
  state,
  onOpenAssistant,
}: {
  greeting: string;
  firstName: string;
  home: HomeData;
  state: EvidenceState;
  onOpenAssistant: () => void;
}) {
  const priority = home.alerts[0];
  const priorityCount = home.alerts.length;

  return (
    <div className="mx-auto w-full max-w-[1320px] space-y-4 pb-24 sm:pb-8">
      <section className="rounded-[24px] border border-stone-200 bg-gradient-to-br from-white via-white to-[#f8f4ec] p-5 shadow-[0_12px_35px_rgba(18,37,33,.055)] sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-emerald-700">
              Bispo Coffees · Painel comercial
            </p>
            <h1 className="mt-2 text-[clamp(30px,4vw,44px)] font-semibold leading-none tracking-[-.04em] text-stone-950">
              {greeting}, {firstName}.
            </h1>
            <p className="mt-3 text-sm leading-6 text-stone-500">
              {priority
                ? `${priorityCount} assunto${priorityCount > 1 ? "s" : ""} pede${priorityCount > 1 ? "m" : ""} acompanhamento comercial.`
                : "Sua carteira está pronta para clientes, visitas e novos pedidos."}
            </p>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Link
              href="/pedidos"
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#10201d] px-5 text-xs font-bold text-white shadow-[0_8px_18px_rgba(14,25,29,.12)] sm:flex-none"
            >
              Acompanhar pedidos <ArrowRight size={15} />
            </Link>
            <button
              type="button"
              onClick={onOpenAssistant}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white px-4 text-xs font-bold text-violet-700 sm:flex-none"
            >
              <Sparkles size={15} /> Perguntar ao BBOS
            </button>
          </div>
        </div>
      </section>

      <section
        aria-label="Ações rápidas"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <SalesQuickAction
          href="/pedidos?novo=1"
          icon={Plus}
          title="Novo pedido"
          copy="Montar uma venda"
          tone="green"
        />
        <SalesQuickAction
          href="/clientes?novo=1"
          icon={UsersRound}
          title="Novo cliente"
          copy="Cadastrar e acompanhar"
          tone="blue"
        />
        <SalesQuickAction
          href="/atendimento"
          icon={ClipboardCheck}
          title="Registrar visita"
          copy="Salvar o atendimento"
          tone="violet"
        />
        <SalesQuickAction
          href="/vendas"
          icon={WalletCards}
          title="Minha carteira"
          copy="Ver histórico e resultados"
          tone="amber"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
        <div className="rounded-[20px] border border-stone-200 bg-white p-5 shadow-[0_4px_18px_rgba(18,37,33,.035)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-emerald-700">
                Prioridade de hoje
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-stone-950">
                O que merece sua atenção
              </h2>
            </div>
            {priorityCount > 0 && (
              <span className="rounded-full bg-red-50 px-3 py-1 text-[10px] font-black text-red-700">
                {priorityCount}{" "}
                {priorityCount === 1 ? "pendência" : "pendências"}
              </span>
            )}
          </div>

          {priority ? (
            <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-red-100 bg-red-50/55 p-4 sm:flex-row sm:items-center">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-red-100 text-red-700">
                <ShieldAlert size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <strong className="block text-sm text-red-950">
                  {priority.title}
                </strong>
                <p className="mt-1 text-xs leading-5 text-red-800/80">
                  {priority.impact}
                </p>
              </div>
              <Link
                href={priority.href}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-xl bg-white px-4 text-xs font-bold text-red-700 shadow-sm"
              >
                {priority.action} <ArrowRight size={13} />
              </Link>
            </div>
          ) : (
            <div className="mt-4">
              <CompactDecision state={state} isSales />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <SalesMetric
            href="/vendas"
            label="Vendas hoje"
            value={money.format(home.salesToday)}
            note={`No mês: ${money.format(home.salesMonth)}`}
            icon={WalletCards}
          />
          <SalesMetric
            href="/pedidos"
            label="Pedidos abertos"
            value={String(home.openOrders)}
            note={
              home.overdueOrders
                ? `${home.overdueOrders} atrasado${home.overdueOrders > 1 ? "s" : ""}`
                : "Nenhum atraso"
            }
            icon={ShoppingBag}
          />
        </div>
      </section>
    </div>
  );
}

function SalesQuickAction({
  href,
  icon: Icon,
  title,
  copy,
  tone,
}: {
  href: string;
  icon: typeof Factory;
  title: string;
  copy: string;
  tone: "green" | "blue" | "violet" | "amber";
}) {
  const toneClass =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "blue"
        ? "bg-blue-50 text-blue-700"
        : tone === "violet"
          ? "bg-violet-50 text-violet-700"
          : "bg-amber-50 text-amber-700";
  return (
    <Link
      href={href}
      className="group flex min-h-[108px] items-center gap-3 rounded-[18px] border border-stone-200 bg-white p-4 shadow-[0_4px_18px_rgba(18,37,33,.035)] transition active:scale-[.99]"
    >
      <span
        className={`grid size-11 shrink-0 place-items-center rounded-xl ${toneClass}`}
      >
        <Icon size={19} />
      </span>
      <span className="min-w-0">
        <strong className="block text-sm text-stone-950">{title}</strong>
        <span className="mt-1 block text-[10px] leading-4 text-stone-500">
          {copy}
        </span>
      </span>
      <ArrowRight className="ml-auto shrink-0 text-stone-300" size={14} />
    </Link>
  );
}

function SalesMetric({
  href,
  label,
  value,
  note,
  icon: Icon,
}: {
  href: string;
  label: string;
  value: string;
  note: string;
  icon: typeof Factory;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[144px] flex-col rounded-[20px] border border-stone-200 bg-white p-4 shadow-[0_4px_18px_rgba(18,37,33,.035)] sm:min-h-[168px]"
    >
      <span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
        <Icon size={17} />
      </span>
      <span className="mt-auto text-[9px] font-extrabold uppercase tracking-[.11em] text-stone-400">
        {label}
      </span>
      <strong className="mt-1 block text-[clamp(20px,2.5vw,28px)] tracking-tight text-stone-950">
        {value}
      </strong>
      <span className="mt-1 text-[10px] text-stone-500">{note}</span>
    </Link>
  );
}

function CompactDecision({
  state,
  isSales,
}: {
  state: EvidenceState;
  isSales: boolean;
}) {
  const unavailable = state === "unavailable";
  const insufficient = state === "insufficient";
  const Icon = unavailable ? ShieldAlert : Sparkles;
  const title = unavailable
    ? "Leitura temporariamente indisponível"
    : insufficient
      ? "Ainda faltam sinais para concluir"
      : "Nenhuma exceção crítica agora";
  const copy = unavailable
    ? "A conexão está sendo retomada."
    : insufficient
      ? "Vendas, pedidos, produção, estoque ou qualidade ainda precisam de movimentação."
      : "O BBOS continuará observando mudanças relevantes.";
  const href = isSales || insufficient ? "/pedidos" : "/dashboard";
  const action = insufficient
    ? "Registrar primeira movimentação"
    : isSales
      ? "Ver pedidos"
      : "Ver panorama";
  return (
    <div className="grid items-center gap-3 rounded-[16px] border border-dashed border-stone-200 bg-white px-4 py-3 sm:grid-cols-[34px_1fr_auto]">
      <span className="grid size-8 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
        <Icon size={16} />
      </span>
      <div>
        <strong className="text-xs text-stone-900">{title}</strong>
        <p className="mt-1 text-[10px] text-stone-500">{copy}</p>
      </div>
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700"
      >
        {action} <ArrowRight size={11} />
      </Link>
    </div>
  );
}
