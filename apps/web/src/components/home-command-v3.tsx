"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardCheck,
  Factory,
  PackageCheck,
  Plus,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  Sprout,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { Card } from "@bbos/ui";
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

  const hero = getHeroState(state, critical, attention);
  const openAI = () => window.dispatchEvent(new Event("bbos:open-assistant"));
  const finishedAvailable = Math.max(
    0,
    home.finishedGoodsUnits - home.finishedGoodsReserved,
  );
  const flowSteps = [
    {
      label: "Pedido",
      value: home.orderFlow.order,
      detail: "rascunhos e confirmados",
      icon: ShoppingBag,
    },
    {
      label: "Preparação",
      value: home.orderFlow.preparation,
      detail: "reserva, separação e produção",
      icon: Factory,
    },
    {
      label: "Fiscal",
      value: home.orderFlow.fiscal,
      detail: "prontos para emissão",
      icon: ClipboardCheck,
    },
    {
      label: "Expedição",
      value: home.orderFlow.shipping,
      detail: "faturados ou em trânsito",
      icon: PackageCheck,
    },
  ];
  const bottleneck = flowSteps.reduce((largest, step) =>
    step.value > largest.value ? step : largest,
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

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-4 pb-6">
      <section className="flex flex-col gap-4 rounded-[18px] border bg-[var(--bbos-surface-card)] p-4 shadow-[0_8px_24px_rgba(21,58,51,.045)] sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[.15em] text-[var(--bbos-coffee-green)]">
            Bispo Coffees · Fluxo operacional
          </p>
          <h1 className="mt-1 text-[clamp(26px,2.6vw,36px)] font-semibold leading-tight tracking-[-.035em]">
            {greeting}, {firstName}.
          </h1>
          <p className="mt-1 text-sm text-[var(--bbos-text-secondary)]">
            {hero.summary}
          </p>
        </div>
        <button
          type="button"
          onClick={openAI}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--bbos-control-border)] bg-white px-4 text-xs font-bold text-[var(--bbos-intelligence)] hover:bg-[var(--bbos-intelligence-soft)]"
        >
          <Sparkles size={15} /> Perguntar ao BBOS
        </button>
      </section>

      <section className="overflow-hidden rounded-[18px] border bg-[var(--bbos-surface-card)] shadow-[0_6px_20px_rgba(21,58,51,.035)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[.13em] text-[var(--bbos-coffee-green)]">
              Do pedido à entrega
            </p>
            <p className="mt-0.5 text-xs text-[var(--bbos-text-muted)]">
              {bottleneck.value > 0
                ? `Maior concentração agora: ${bottleneck.label.toLowerCase()} (${bottleneck.value}).`
                : "Nenhum pedido ativo nas etapas operacionais."}
            </p>
          </div>
          <Link
            href="/pedidos"
            className="inline-flex items-center gap-1 text-xs font-bold text-[var(--bbos-coffee-green)]"
          >
            Abrir pedidos <ArrowRight size={13} />
          </Link>
        </div>
        <div className="grid gap-px bg-[var(--bbos-surface-border)] sm:grid-cols-2 xl:grid-cols-4">
          {flowSteps.map((step, index) => (
            <FlowStep
              key={step.label}
              {...step}
              index={index + 1}
              highlighted={step.value > 0 && step.label === bottleneck.label}
            />
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section
          id="prioridades"
          className="rounded-[18px] border bg-[var(--bbos-surface-card)] p-4 shadow-[0_6px_20px_rgba(21,58,51,.035)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[.13em] text-[var(--bbos-coffee-green)]">
                Fila que precisa avançar
              </p>
              <h2 className="mt-1 text-lg font-bold tracking-tight">
                O que merece sua atenção
              </h2>
            </div>
            {home.alerts.length > 0 && (
              <span className="rounded-full bg-[var(--bbos-danger-soft)] px-2.5 py-1 text-[11px] font-extrabold text-[var(--bbos-danger)]">
                {home.alerts.length}{" "}
                {home.alerts.length === 1 ? "pendência" : "pendências"}
              </span>
            )}
          </div>
          <div className="mt-3 space-y-2">
            {home.alerts.length ? (
              home.alerts
                .slice(0, 4)
                .map((item) => (
                  <ActionCard key={`${item.tone}-${item.title}`} {...item} />
                ))
            ) : (
              <CompactDecision state={state} isSales={isSales} />
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-[18px] border bg-[var(--bbos-surface-card)] p-4 shadow-[0_6px_20px_rgba(21,58,51,.035)]">
            <p className="text-[11px] font-extrabold uppercase tracking-[.13em] text-[var(--bbos-coffee-green)]">
              Capacidade disponível
            </p>
            <div className="mt-3 divide-y">
              <CapacityRow
                label="Café torrado livre"
                value={`${kg.format(home.roastedStock.availableKg)} kg`}
                note={`${kg.format(home.roastedStock.reservedKg)} kg reservados`}
                href="/estoque"
              />
              <CapacityRow
                label="Produção planejada"
                value={`${kg.format(home.productionPlannedKg)} kg`}
                note={`${kg.format(home.productionActualKg)} kg produzidos no período`}
                href="/producao"
              />
              <CapacityRow
                label="Produto acabado livre"
                value={`${kg.format(finishedAvailable)} un.`}
                note={`${kg.format(home.finishedGoodsReserved)} un. reservadas`}
                href="/estoque"
              />
            </div>
          </section>

          <section className="rounded-[18px] border bg-[var(--bbos-surface-card)] p-4 shadow-[0_6px_20px_rgba(21,58,51,.035)]">
            <p className="text-[11px] font-extrabold uppercase tracking-[.13em] text-[var(--bbos-coffee-green)]">
              Ações rápidas
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <QuickAction
                href="/pedidos?novo=1"
                icon={Plus}
                label="Novo pedido"
              />
              <QuickAction
                href="/producao"
                icon={Factory}
                label="Programar torra"
              />
              <QuickAction
                href="/estoque"
                icon={PackageCheck}
                label="Ver estoque"
              />
              <QuickAction
                href="/pedidos"
                icon={ClipboardCheck}
                label="Avançar pedidos"
              />
            </div>
          </section>
        </aside>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PulseCard
          icon={WalletCards}
          label="Vendas hoje"
          value={money.format(home.salesToday)}
          note={`No mês: ${money.format(home.salesMonth)}`}
          href="/vendas"
          tone="green"
        />
        <PulseCard
          icon={PackageCheck}
          label="Pedidos em aberto"
          value={String(home.openOrders)}
          note={
            home.overdueOrders
              ? `${home.overdueOrders} atrasados`
              : "Nenhum atraso"
          }
          href={home.overdueOrders ? "/pedidos?filtro=atrasados" : "/pedidos"}
          tone={home.overdueOrders ? "amber" : "neutral"}
        />
        <PulseCard
          icon={Sprout}
          label="Café verde livre"
          value={`${kg.format(Math.max(0, greenAvailable - greenReserved))} kg`}
          note={`${kg.format(greenReserved)} kg reservados`}
          href="/cafe-verde"
          tone="neutral"
        />
        <PulseCard
          icon={ClipboardCheck}
          label="Qualidade"
          value={`${home.pendingLab} em análise`}
          note={
            home.pendingLab
              ? "Aguardando liberação"
              : "Nenhuma análise pendente"
          }
          href="/laboratorio"
          tone="violet"
        />
      </section>

      <p className="text-[11px] leading-5 text-[var(--bbos-text-muted)]">
        Estado de confiança: {confidenceLabel(state)}. O BBOS não converte
        ausência de dados em certeza.
      </p>
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
      className="flex min-h-[168px] flex-col rounded-[20px] border border-stone-200 bg-white p-4 shadow-[0_4px_18px_rgba(18,37,33,.035)]"
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

function FlowStep({
  label,
  value,
  detail,
  icon: Icon,
  index,
  highlighted,
}: {
  label: string;
  value: number;
  detail: string;
  icon: typeof Factory;
  index: number;
  highlighted: boolean;
}) {
  return (
    <Link
      href="/pedidos"
      className="group bg-[var(--bbos-surface-card)] p-3.5 transition hover:bg-[var(--bbos-surface-subtle)]"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex items-center gap-2">
          <span
            className={`grid size-8 place-items-center rounded-lg ${
              highlighted
                ? "bg-[var(--bbos-warning-soft)] text-[var(--bbos-warning)]"
                : "bg-[var(--bbos-nav-active)] text-[var(--bbos-coffee-green)]"
            }`}
          >
            <Icon size={16} />
          </span>
          <span>
            <small className="block text-[10px] font-bold text-[var(--bbos-text-muted)]">
              Etapa {index}
            </small>
            <strong className="block text-sm">{label}</strong>
          </span>
        </span>
        <strong className="text-2xl tracking-tight">{value}</strong>
      </div>
      <p className="mt-2 text-[11px] leading-4 text-[var(--bbos-text-muted)]">
        {detail}
      </p>
    </Link>
  );
}

function CapacityRow({
  label,
  value,
  note,
  href,
}: {
  label: string;
  value: string;
  note: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
    >
      <span className="min-w-0">
        <span className="block text-xs font-bold">{label}</span>
        <span className="mt-0.5 block truncate text-[10px] text-[var(--bbos-text-muted)]">
          {note}
        </span>
      </span>
      <strong className="shrink-0 text-sm text-[var(--bbos-coffee-green)]">
        {value}
      </strong>
    </Link>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Factory;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-20 flex-col justify-between rounded-xl border bg-[var(--bbos-surface-subtle)] p-3 text-xs font-bold transition hover:border-[var(--bbos-control-border)] hover:bg-white"
    >
      <Icon size={17} className="text-[var(--bbos-coffee-green)]" />
      <span>{label}</span>
    </Link>
  );
}

function getHeroState(
  state: EvidenceState,
  critical: number,
  attention: number,
) {
  if (state === "loading")
    return {
      summary: "Estou reunindo o contexto da operação para você.",
      aiTitle: "Estou conectando os sinais",
      aiCopy:
        "Assim que os dados chegarem, eu separo o que é ruído do que pede decisão.",
    };
  if (state === "unavailable")
    return {
      summary:
        "A conexão operacional está sendo retomada. Não vou concluir nada até os dados voltarem.",
      aiTitle: "Aguardando dados confiáveis",
      aiCopy: "Indisponibilidade não será tratada como operação saudável.",
    };
  if (state === "critical")
    return {
      summary: `${critical} ponto${critical > 1 ? "s" : ""} crítico${critical > 1 ? "s" : ""} pede${critical > 1 ? "m" : ""} decisão agora.`,
      aiTitle: "Há uma decisão prioritária",
      aiCopy: "Posso explicar causa, impacto e o próximo passo mais seguro.",
    };
  if (state === "attention")
    return {
      summary: `${attention} ponto${attention > 1 ? "s" : ""} merece${attention > 1 ? "m" : ""} atenção hoje.`,
      aiTitle: "Há algo para acompanhar",
      aiCopy: "Posso ordenar por impacto e mostrar o que fazer primeiro.",
    };
  if (state === "insufficient")
    return {
      summary:
        "Ainda preciso de alguns registros para entender a operação de hoje.",
      aiTitle: "O que falta para eu avaliar?",
      aiCopy:
        "Eu mostro quais sinais ainda faltam e conduzo você ao próximo registro útil.",
    };
  return {
    summary:
      "A operação não apresenta exceção crítica com base nos dados disponíveis.",
    aiTitle: "O que vale acompanhar agora?",
    aiCopy:
      "Eu conecto vendas, estoque, produção e qualidade para antecipar a próxima decisão.",
  };
}

function confidenceLabel(state: EvidenceState) {
  if (state === "insufficient")
    return "dados insuficientes para classificar a operação";
  if (state === "unavailable") return "conexão operacional indisponível";
  if (state === "healthy") return "leitura baseada nos dados disponíveis";
  if (state === "loading") return "contexto em atualização";
  return "há exceções operacionais a avaliar";
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

function ActionCard({
  tone,
  title,
  impact,
  href,
  action,
}: HomeData["alerts"][number]) {
  const Icon =
    tone === "CRÍTICO"
      ? ShieldAlert
      : tone === "ATENÇÃO"
        ? Factory
        : tone === "POSITIVO"
          ? WalletCards
          : ClipboardCheck;
  const toneClass =
    tone === "CRÍTICO"
      ? "text-red-700 bg-red-50"
      : tone === "ATENÇÃO"
        ? "text-amber-700 bg-amber-50"
        : tone === "POSITIVO"
          ? "text-emerald-700 bg-emerald-50"
          : "text-stone-600 bg-stone-100";
  return (
    <Card className="rounded-xl border-[var(--bbos-surface-border)] p-3 shadow-none">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <span
          className={`grid size-8 shrink-0 place-items-center rounded-lg ${toneClass}`}
        >
          <Icon size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-black tracking-wide text-[var(--bbos-text-muted)]">
            {tone}
          </span>
          <h3 className="text-[13px] font-extrabold">{title}</h3>
          <p className="mt-0.5 text-[11px] leading-4 text-[var(--bbos-text-secondary)]">
            {impact}
          </p>
        </div>
        <Link
          href={href}
          className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1 rounded-lg border border-[var(--bbos-control-border)] bg-white px-3 text-[10px] font-black text-[var(--bbos-coffee-green)]"
        >
          {action} <ArrowRight size={11} />
        </Link>
      </div>
    </Card>
  );
}

function PulseCard({
  icon: Icon,
  label,
  value,
  note,
  href,
  tone,
}: {
  icon: typeof Factory;
  label: string;
  value: string;
  note: string;
  href: string;
  tone: "green" | "neutral" | "amber" | "violet";
}) {
  const toneClass =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "amber"
        ? "bg-amber-50 text-amber-700"
        : tone === "violet"
          ? "bg-violet-50 text-violet-700"
          : "bg-stone-100 text-stone-600";
  return (
    <Link
      href={href}
      className="group block rounded-[16px] border bg-[var(--bbos-surface-card)] p-3.5 text-inherit shadow-[0_4px_14px_rgba(18,37,33,.03)] transition hover:-translate-y-0.5"
    >
      <span
        className={`grid size-8 place-items-center rounded-xl ${toneClass}`}
      >
        <Icon size={16} />
      </span>
      <small className="mt-3 block text-[10px] font-extrabold uppercase tracking-[.09em] text-[var(--bbos-text-muted)]">
        {label}
      </small>
      <strong className="mt-1 block text-[22px] tracking-tight text-stone-950">
        {value}
      </strong>
      <p className="mt-1 text-[11px] text-[var(--bbos-text-secondary)]">
        {note}
      </p>
    </Link>
  );
}
