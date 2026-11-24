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
function ProgressRing({ value }: { value: number }) {
  const circumference = 2 * Math.PI * 19;
  return (
    <svg aria-hidden width="46" height="46" viewBox="0 0 46 46" className="shrink-0">
      <circle cx="23" cy="23" r="19" fill="none" stroke="#E3E8E2" strokeWidth="6" />
      <circle cx="23" cy="23" r="19" fill="none" stroke="#2F6B57" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(Math.max(0, Math.min(100, value)) / 100) * circumference} ${circumference}`} transform="rotate(-90 23 23)" />
    </svg>
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
  const sacks = greenAvailable / 60;
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
      href: "/pedidos",
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
  const toneRing = {
    neutral: "bg-[var(--bbos-surface-subtle)] border-[var(--bbos-border)]",
    ok: "bg-[var(--bbos-success-soft)] border-[#cfe6d8]",
    attention: "bg-[var(--bbos-warning-soft)] border-[#f1d9a8]",
    critical: "bg-[#fdecea] border-[#f3c1bb]",
  } as const;
  const toneBadge = {
    neutral: "bg-[var(--bbos-surface-subtle)] text-[var(--bbos-text-secondary)]",
    ok: "bg-[var(--bbos-success-soft)] text-[var(--bbos-success)]",
    attention: "bg-[var(--bbos-warning-soft)] text-[var(--bbos-warning)]",
    critical: "bg-[#fdecea] text-[var(--bbos-danger)]",
  } as const;
  const decisions = home.alerts.filter((alert) => alert.tone === "CRÍTICO" || alert.tone === "ATENÇÃO");
  const summary =
    state === "loading"
      ? "Reunindo a operação de hoje…"
      : state === "unavailable"
        ? "A conexão com os dados está sendo retomada."
        : decisions.length
          ? `${decisions.length} ${decisions.length === 1 ? "coisa pede" : "coisas pedem"} você hoje. O resto está andando.`
          : "Nada pede decisão agora. A operação está andando.";

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-4 pb-6">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[var(--bbos-coffee-green)] first-letter:uppercase">
            {dateLabel}
          </p>
          <h1 className="mt-1 text-[clamp(24px,2.4vw,32px)] font-semibold leading-tight tracking-[-.02em]">
            {greeting}{firstName ? `, ${firstName}` : ""}.
          </h1>
          <p className="mt-1 text-sm text-[var(--bbos-text-secondary)]">{summary}</p>
        </div>
        <button
          type="button"
          onClick={openAI}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 self-start rounded-full border border-[var(--bbos-border)] bg-white px-4 text-xs font-semibold text-[var(--bbos-intelligence)] hover:bg-[var(--bbos-intelligence-soft)] sm:self-auto"
        >
          <Sparkles size={15} /> Perguntar ao BBOS
        </button>
      </section>

      <section aria-labelledby="coffee-path-title" className="rounded-2xl border bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="coffee-path-title" className="text-base font-semibold">O caminho do café hoje</h2>
          <Link href="/pedidos" className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--bbos-coffee-green)]">
            Ver pedidos <ArrowRight size={13} />
          </Link>
        </div>
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {coffeePath.map((step, index) => (
            <li key={step.key} className="relative">
              {index < coffeePath.length - 1 && (
                <span aria-hidden className="absolute left-[calc(50%+38px)] right-[-12px] top-[34px] hidden border-t-2 border-dashed border-[#c9d2cb] xl:block" />
              )}
              <Link
                href={step.href}
                className="group flex flex-col items-center rounded-xl px-2 py-2 text-center transition hover:bg-[var(--bbos-surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--bbos-focus-ring)]"
              >
                <span className={`grid size-[60px] place-items-center rounded-2xl border transition group-hover:-translate-y-0.5 ${toneRing[step.tone]}`}>
                  {step.art}
                </span>
                <span className="mt-2 text-lg font-semibold tabular-nums leading-tight">{step.value}</span>
                <span className="text-[12px] text-[var(--bbos-text-secondary)]">{step.label}</span>
                {step.badge && (
                  <span className={`mt-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${toneBadge[step.tone]}`}>
                    {step.badge}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="decisions-title" className="rounded-2xl border bg-white p-4">
          <div className="mb-1 flex items-center justify-between">
            <h2 id="decisions-title" className="text-base font-semibold">Para resolver agora</h2>
            <span className="text-xs text-[var(--bbos-text-secondary)]">{decisions.length}</span>
          </div>
          {decisions.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--bbos-text-secondary)]">
              {state === "loading" ? "Carregando…" : "Nada pendente. Bom trabalho."}
            </p>
          ) : (
            <ul className="divide-y divide-[#eef1ed]">
              {decisions.map((alert) => (
                <li key={alert.title} className="flex flex-wrap items-center gap-3 py-3">
                  <span
                    aria-hidden
                    className={`grid size-9 shrink-0 place-items-center rounded-xl ${alert.tone === "CRÍTICO" ? "bg-[#fdecea] text-[var(--bbos-danger)]" : "bg-[var(--bbos-warning-soft)] text-[var(--bbos-warning)]"}`}
                  >
                    <ShieldAlert size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{alert.title}</p>
                    <p className="text-xs text-[var(--bbos-text-secondary)]">{alert.impact}</p>
                  </div>
                  <Link
                    href={alert.href}
                    className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-[var(--bbos-action-primary)] px-3 text-xs font-semibold text-white hover:bg-[var(--bbos-action-primary-hover)]"
                  >
                    {alert.action} <ArrowRight size={13} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="today-title" className="rounded-2xl border bg-white p-4">
          <h2 id="today-title" className="mb-3 text-base font-semibold">Hoje</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/vendas" className="rounded-xl bg-[var(--bbos-surface-subtle)] p-3 hover:bg-[#eef3ee]">
              <span className="block text-xs text-[var(--bbos-text-secondary)]">Vendas hoje</span>
              <span className="mt-0.5 block text-lg font-semibold tabular-nums">{money.format(home.salesToday)}</span>
              <span className="block text-[11px] text-[var(--bbos-text-secondary)]">mês: {money.format(home.salesMonth)}</span>
            </Link>
            <Link href="/producao" className="flex items-center gap-3 rounded-xl bg-[var(--bbos-surface-subtle)] p-3 hover:bg-[#eef3ee]">
              <ProgressRing value={roastPercent} />
              <span>
                <span className="block text-xs text-[var(--bbos-text-secondary)]">Torra do mês</span>
                <span className="block text-lg font-semibold tabular-nums">{plannedKg > 0 ? `${percent.format(roastPercent)}%` : "—"}</span>
              </span>
            </Link>
            <Link href="/estoque" className="rounded-xl bg-[var(--bbos-surface-subtle)] p-3 hover:bg-[#eef3ee]">
              <span className="block text-xs text-[var(--bbos-text-secondary)]">Café torrado livre</span>
              <span className="mt-0.5 block text-lg font-semibold tabular-nums">{kg.format(home.roastedStock.availableKg)} kg</span>
              <span className="block text-[11px] text-[var(--bbos-text-secondary)]">{kg.format(home.roastedStock.reservedKg)} kg reservados</span>
            </Link>
            <Link href="/estoque" className="rounded-xl bg-[var(--bbos-surface-subtle)] p-3 hover:bg-[#eef3ee]">
              <span className="block text-xs text-[var(--bbos-text-secondary)]">Café verde</span>
              <span className="mt-0.5 block text-lg font-semibold tabular-nums">{kg.format(greenAvailable)} kg</span>
              <span className="block text-[11px] text-[var(--bbos-text-secondary)]">
                {sacks >= 1 ? `≈ ${percent.format(sacks)} sacas de 60 kg` : "menos de 1 saca"}
                {greenReserved > 0 ? ` · ${kg.format(greenReserved)} kg reservados` : ""}
              </span>
            </Link>
          </div>
        </section>
      </div>

      <nav aria-label="Ações rápidas" className="flex flex-wrap gap-2">
        {[
          { href: "/pedidos?novo=1", label: "Novo pedido", icon: Plus },
          { href: "/clientes?novo=1", label: "Novo cliente", icon: UsersRound },
          { href: "/producao", label: "Programar torra", icon: Factory },
          { href: "/recebimento", label: "Registrar recebimento", icon: Sprout },
        ].map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--bbos-border)] bg-white px-4 text-xs font-semibold hover:bg-[var(--bbos-surface-subtle)]"
          >
            <Icon size={15} /> {label}
          </Link>
        ))}
      </nav>
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
