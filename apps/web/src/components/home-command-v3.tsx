"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
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
import { OperationalNextBestAction } from "@/components/operational-next-best-action";

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
  productionActualKg: number;
  productionPlannedKg: number;
  pendingLab: number;
  openPurchases: number;
  finishedGoodsUnits: number;
  finishedGoodsReserved: number;
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
  productionActualKg: 0,
  productionPlannedKg: 0,
  pendingLab: 0,
  openPurchases: 0,
  finishedGoodsUnits: 0,
  finishedGoodsReserved: 0,
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
        setHome(data as HomeData);
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
  const priorityGridClass =
    home.alerts.length <= 1
      ? "grid-cols-1"
      : home.alerts.length === 2
        ? "md:grid-cols-2"
        : home.alerts.length === 3
          ? "md:grid-cols-2 xl:grid-cols-3"
          : "md:grid-cols-2 xl:grid-cols-4";
  const primaryHref = isSales
    ? "/pedidos"
    : state === "insufficient"
      ? "/pedidos"
      : state === "critical" || state === "attention"
        ? "#prioridades"
        : "/dashboard";
  const primaryLabel = isSales
    ? "Abrir carteira comercial"
    : state === "insufficient"
      ? "Começar o dia"
      : state === "critical" || state === "attention"
        ? "Ver o que pede decisão"
        : "Abrir visão executiva";
  const openAI = () => window.dispatchEvent(new Event("bbos:open-assistant"));

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
    <div className="mx-auto w-full max-w-[1580px] space-y-6 pb-8">
      <section className="grid gap-5 rounded-[24px] border border-stone-200 bg-gradient-to-br from-white via-white to-[#f8f4ec] p-6 shadow-[0_12px_35px_rgba(18,37,33,.055)] lg:grid-cols-[1.35fr_.65fr] lg:p-7">
        <div className="flex min-h-[205px] flex-col justify-center">
          <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-emerald-700">
            Bispo Coffees · Central de comando
          </p>
          <h1 className="mt-2 text-[clamp(34px,3.4vw,52px)] font-semibold leading-[1.02] tracking-[-.045em] text-stone-950">
            {greeting}, {firstName}.
          </h1>
          <p className="mt-3 max-w-3xl text-[15px] leading-6 text-stone-500">
            {hero.summary}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link
              href={primaryHref}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#10201d] px-4 text-xs font-bold text-white shadow-[0_8px_18px_rgba(14,25,29,.12)] transition hover:-translate-y-px"
            >
              {primaryLabel} <ArrowRight size={14} />
            </Link>
            <button
              type="button"
              onClick={openAI}
              className="text-xs font-bold text-violet-700 transition hover:text-violet-900"
            >
              Perguntar ao BBOS
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={openAI}
          className="group grid min-h-[190px] grid-cols-[42px_1fr] content-center gap-3 rounded-[20px] border border-violet-200 bg-gradient-to-br from-[#fbf9ff] to-[#f5f1fb] p-5 text-left transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(109,79,163,.10)]"
        >
          <span className="grid size-10 place-items-center rounded-xl bg-white text-violet-700 shadow-sm">
            <BrainCircuit size={19} />
          </span>
          <span>
            <small className="block text-[9px] font-black uppercase tracking-[.14em] text-violet-700">
              BBOS Intelligence
            </small>
            <strong className="mt-1 block text-[15px] leading-5 text-stone-900">
              {hero.aiTitle}
            </strong>
            <span className="mt-2 block text-[11px] leading-[1.55] text-stone-500">
              {hero.aiCopy}
            </span>
            <span className="mt-4 inline-flex items-center gap-1 text-[11px] font-extrabold text-violet-700">
              Abrir neste contexto <ArrowRight size={12} />
            </span>
          </span>
        </button>
      </section>

      <section id="prioridades" className="space-y-3">
        <SectionHeader
          eyebrow="Agora"
          title="O que merece sua atenção"
          subtitle="O BBOS mostra exceções; silêncio não vira certeza."
        />
        {home.alerts.length ? (
          <div className={`grid gap-3 ${priorityGridClass}`}>
            {home.alerts.map((item) => (
              <ActionCard key={`${item.tone}-${item.title}`} {...item} />
            ))}
          </div>
        ) : (
          <CompactDecision state={state} isSales={isSales} />
        )}
      </section>

      {!isSales && (
        <section className="space-y-3">
          <SectionHeader
            eyebrow="Próximo passo"
            title="Próxima melhor ação"
            subtitle="Uma recomendação de cada vez, baseada no que o sistema consegue provar."
          />
          <OperationalNextBestAction />
        </section>
      )}

      <section className="space-y-3">
        <SectionHeader
          eyebrow="Hoje"
          title={isSales ? "Pulso comercial" : "Pulso da operação"}
          subtitle={
            isSales
              ? "Vendas e pedidos para orientar o atendimento do dia."
              : "Quatro sinais para entender o dia sem navegar por relatórios."
          }
        />
        <div
          className={`grid gap-3 md:grid-cols-2 ${isSales ? "" : "xl:grid-cols-4"}`}
        >
          <PulseCard
            icon={WalletCards}
            label="Vendas"
            value={money.format(home.salesToday)}
            note={
              home.salesMonth > 0
                ? `Mês: ${money.format(home.salesMonth)}`
                : "Nenhuma venda registrada"
            }
            href="/vendas"
            tone="green"
          />
          <PulseCard
            icon={PackageCheck}
            label="Pedidos"
            value={`${home.openOrders} em aberto`}
            note={
              home.overdueOrders
                ? `${home.overdueOrders} atrasado${home.overdueOrders > 1 ? "s" : ""}`
                : "Nenhum atraso registrado"
            }
            href={
              home.overdueOrders > 0 ? "/pedidos?filtro=atrasados" : "/pedidos"
            }
            tone={home.overdueOrders > 0 ? "amber" : "neutral"}
          />
          {!isSales && (
            <PulseCard
              icon={Factory}
              label="Produção"
              value={`${kg.format(home.productionActualKg)} kg`}
              note={
                home.productionPlannedKg
                  ? `Planejado: ${kg.format(home.productionPlannedKg)} kg`
                  : "Nenhuma produção programada"
              }
              href="/producao"
              tone="amber"
            />
          )}
          {!isSales && (
            <PulseCard
              icon={ClipboardCheck}
              label="Qualidade"
              value={`${home.pendingLab} em análise`}
              note={
                home.pendingLab
                  ? "Há lotes aguardando liberação"
                  : "Nenhuma análise pendente"
              }
              href="/laboratorio"
              tone="violet"
            />
          )}
        </div>
      </section>

      {!isSales && (
        <section className="space-y-3">
          <SectionHeader
            eyebrow="Cobertura"
            title="Antes de faltar"
            subtitle="Estoque só ganha destaque quando muda uma decisão."
          />
          <Card className="overflow-hidden rounded-[18px] border-stone-200 bg-white p-0 shadow-[0_4px_18px_rgba(18,37,33,.035)]">
            <div className="grid gap-px bg-stone-200 sm:grid-cols-2">
              <StockPanel
                icon={PackageCheck}
                title="Produto acabado"
                value={`${kg.format(home.finishedGoodsUnits)} un.`}
                secondary={`${kg.format(home.finishedGoodsReserved)} reservadas`}
                href="/estoque"
              />
              <StockPanel
                icon={Sprout}
                title="Café verde"
                value={`${kg.format(greenAvailable)} kg`}
                secondary={`${kg.format(greenReserved)} kg reservados`}
                href="/cafe-verde"
              />
            </div>
          </Card>
        </section>
      )}

      {!isSales && home.greenLots.length > 0 && (
        <section className="space-y-3">
          <SectionHeader
            eyebrow="Matéria-prima"
            title="Lotes que pedem acompanhamento"
            subtitle="Só aparece quando há contexto útil para acompanhar."
          />
          <Card className="overflow-hidden rounded-[18px] border-stone-200 bg-white p-0 shadow-[0_4px_18px_rgba(18,37,33,.035)]">
            <div className="divide-y divide-stone-100">
              {home.greenLots.slice(0, 5).map((l) => (
                <Link
                  href="/cafe-verde"
                  key={`${l.code}-${l.origin}`}
                  className="grid gap-3 px-4 py-3 text-xs transition hover:bg-stone-50 sm:grid-cols-[1.7fr_.7fr_.7fr_auto] sm:items-center"
                >
                  <div>
                    <strong className="block">
                      {l.origin} · {l.code}
                    </strong>
                    <span className="mt-1 block text-[10px] text-stone-400">
                      {l.variety}
                    </span>
                  </div>
                  <div>
                    <small className="block text-[8px] uppercase tracking-wider text-stone-400">
                      Disponível
                    </small>
                    <strong>{kg.format(l.currentKg)} kg</strong>
                  </div>
                  <div>
                    <small className="block text-[8px] uppercase tracking-wider text-stone-400">
                      Reservado
                    </small>
                    <strong>{kg.format(l.reservedKg)} kg</strong>
                  </div>
                  <span className="rounded-full bg-stone-100 px-2 py-1 text-[8px] font-extrabold tracking-wide">
                    {l.status}
                  </span>
                </Link>
              ))}
            </div>
          </Card>
        </section>
      )}

      <p className="text-[9px] leading-5 text-stone-400">
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

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-extrabold uppercase tracking-[.17em] text-emerald-700">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-xl font-bold tracking-tight text-stone-950">
        {title}
      </h2>
      <p className="mt-1 text-xs text-stone-500">{subtitle}</p>
    </div>
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
    <Card className="rounded-[17px] border-stone-200 p-4 shadow-none transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between">
        <span
          className={`grid size-8 place-items-center rounded-full ${toneClass}`}
        >
          <Icon size={15} />
        </span>
        <span className="text-[8px] font-black tracking-wider text-stone-400">
          {tone}
        </span>
      </div>
      <h3 className="mt-3 text-[13px] font-extrabold">{title}</h3>
      <p className="mt-1 text-[11px] leading-5 text-stone-500">{impact}</p>
      <Link
        href={href}
        className="mt-4 inline-flex min-h-10 items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-[10px] font-black text-emerald-800 transition hover:bg-emerald-100"
      >
        {action} <ArrowRight size={11} />
      </Link>
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
      className="group block rounded-[18px] border border-stone-200 bg-white p-4 text-inherit shadow-[0_4px_18px_rgba(18,37,33,.035)] transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <span
        className={`grid size-8 place-items-center rounded-xl ${toneClass}`}
      >
        <Icon size={16} />
      </span>
      <small className="mt-4 block text-[9px] font-extrabold uppercase tracking-[.1em] text-stone-400">
        {label}
      </small>
      <strong className="mt-1 block text-[22px] tracking-tight text-stone-950">
        {value}
      </strong>
      <p className="mt-1 text-[10px] text-stone-500">{note}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-[9px] font-bold text-stone-400 opacity-0 transition group-hover:opacity-100">
        Abrir <ArrowRight size={10} />
      </span>
    </Link>
  );
}

function StockPanel({
  icon: Icon,
  title,
  value,
  secondary,
  href,
}: {
  icon: typeof Factory;
  title: string;
  value: string;
  secondary: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block bg-white p-5 text-inherit transition hover:bg-stone-50"
    >
      <div className="flex items-center gap-2 text-[11px] font-bold text-stone-500">
        <Icon size={16} />
        {title}
      </div>
      <strong className="mt-3 block text-2xl tracking-tight text-stone-950">
        {value}
      </strong>
      <p className="mt-1 text-[10px] text-stone-400">{secondary}</p>
    </Link>
  );
}
