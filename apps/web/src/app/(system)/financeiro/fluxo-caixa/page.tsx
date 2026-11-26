"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarRange,
  ReceiptText,
} from "lucide-react";
import { Card } from "@bbos/ui";
import { getApiBaseUrl } from "@/lib/api-url";
import { CashBridge, CashChart, CashNumbers, NextCashDays, RealizedMonths, SegmentedControl } from "@/components/cash-flow-overview";
import { cashPeriods, realizedMonths, withinHorizon } from "@/lib/cash-flow-view";
import {
  buildCashFlowLines,
  type CashFlowKind,
  type CashFlowLine,
  type CashFlowProjectionSource,
  type CashFlowTransaction,
  type GreenCoffeeProjectionSource,
  type TaxProjectionSource,
  firstBelowMinimum,
} from "@/lib/finance-cashflow";

type Summary = {
  source?: string;
  cash: number;
  receivables: number;
  payables: number;
  plannedPurchases: number;
  projectedBalance: number;
  delinquency: number;
  transactions?: CashFlowTransaction[];
  receivableProjection?: CashFlowProjectionSource[];
  payableProjection?: CashFlowProjectionSource[];
  greenCoffeePurchaseProjection?: GreenCoffeeProjectionSource[];
  taxProjection?: TaxProjectionSource[];
  settings?: {
    minimumCashBalance: number;
    monthlyRevenueTarget: number | null;
    taxRegime: string;
    configured: boolean;
    taxRatesConfirmed: boolean;
    icmsEstimated: boolean;
    cashStartDate?: string | null;
    cashStartBalance?: number | null;
  };
  dataGaps?: {
    greenCoffeePurchasesWithoutPayable: Array<{ id: string; purchaseNumber: string; supplier: string | null; totalValue: number }>;
  };
};

type Filter = "ALL" | CashFlowKind;

const emptySummary: Summary = {
  source: "database",
  cash: 0,
  receivables: 0,
  payables: 0,
  plannedPurchases: 0,
  projectedBalance: 0,
  delinquency: 0,
  transactions: [],
  receivableProjection: [],
  payableProjection: [],
  greenCoffeePurchaseProjection: [],
};

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const date = new Intl.DateTimeFormat("pt-BR");
const filterOptions: Array<{ value: Filter; label: string }> = [
  { value: "ALL", label: "Todos" },
  { value: "RECEIVABLE", label: "A receber" },
  { value: "PAYABLE", label: "A pagar" },
  { value: "PURCHASE", label: "Compras previstas" },
  { value: "TAX", label: "Impostos (estimados)" },
];

export default function CashFlowPage() {
  const [data, setData] = React.useState<Summary>(emptySummary);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [filter, setFilter] = React.useState<Filter>("ALL");
  const [reload, setReload] = React.useState(0);
  const [showAll, setShowAll] = React.useState(false);
  const [horizon, setHorizon] = React.useState<30 | 60 | 90>(30);
  const [step, setStep] = React.useState<7 | 1>(7);

  React.useEffect(() => {
    const controller = new AbortController();
    fetch(`${getApiBaseUrl()}/finance/summary`, {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(
            body.message ?? "Não foi possível carregar o fluxo de caixa.",
          );
        return body as Summary;
      })
      .then((result) => {
        setData({ ...emptySummary, ...result });
        setStatus("ready");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setData(emptySummary);
        setStatus("error");
      });
    return () => controller.abort();
  }, [reload]);

  const projection = React.useMemo(
    () =>
      buildCashFlowLines({
        cash: data.cash,
        receivables: data.receivableProjection,
        payables: data.payableProjection,
        purchases: data.greenCoffeePurchaseProjection,
        taxes: data.taxProjection,
      }),
    [data],
  );
  const minimum = data.settings?.minimumCashBalance ?? 0;
  const belowMinimum = React.useMemo(() => firstBelowMinimum(projection, minimum), [projection, minimum]);
  const [gapBusy, setGapBusy] = React.useState<string | null>(null);
  const [gapMessage, setGapMessage] = React.useState("");
  const createCoffeePayables = async (purchaseId: string) => {
    setGapBusy(purchaseId);
    setGapMessage("");
    try {
      const response = await fetch(`${getApiBaseUrl()}/green-coffee-purchases/${encodeURIComponent(purchaseId)}/financial-commitment`, {
        method: "POST",
        credentials: "include",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? "Não foi possível gerar as contas a pagar.");
      setGapMessage(`${body.created} conta(s) a pagar criada(s). Se já foi pago, registre o pagamento em Pagar.`);
      setReload((value) => value + 1);
    } catch (error) {
      setGapMessage(error instanceof Error ? error.message : "Não foi possível gerar as contas a pagar.");
    } finally {
      setGapBusy(null);
    }
  };
  const horizonLines = React.useMemo(() => withinHorizon(projection, horizon), [projection, horizon]);
  const periods = React.useMemo(
    () => cashPeriods(horizonLines, { days: horizon, step, cash: data.cash }),
    [horizonLines, horizon, step, data.cash],
  );
  const startKnown = Boolean(data.settings?.cashStartDate);
  const monthsRealized = React.useMemo(() => realizedMonths(data.transactions ?? []), [data.transactions]);
  const thisMonth = monthsRealized.at(-1);
  // Expenses are barely recorded when the month paid out under 5% of what came in.
  const expensesMissing = Boolean(thisMonth && thisMonth.inflow > 0 && thisMonth.outflow < thisMonth.inflow * 0.05);
  const visibleLines = React.useMemo(
    () => horizonLines.filter((item) => filter === "ALL" || item.kind === filter),
    [filter, horizonLines],
  );
  return (
    <div className="mx-auto max-w-[1500px] pb-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/financeiro"
            className="inline-flex min-h-9 items-center gap-2 text-xs font-bold text-forest-700"
          >
            <ArrowLeft size={14} /> Financeiro
          </Link>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="text-2xl font-bold sm:text-3xl">Fluxo de caixa</h1>
            <CalendarRange size={19} className="text-forest-700" />
          </div>
          <p className="mt-1 text-xs text-stone-500 sm:text-sm">
            Realizado, projeção e cada título que forma o saldo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl label="Período" value={horizon} onChange={setHorizon} options={[[30, "30 dias"], [60, "60 dias"], [90, "90 dias"]]} />
          <SegmentedControl label="Agrupar" value={step} onChange={setStep} options={[[7, "Semanal"], [1, "Diário"]]} />
          <DataStatus status={status} />
        </div>
      </header>

      {status === "ready" && (
        <div className="mt-4 grid gap-4">
          <CashChart periods={periods} minimum={minimum} startKnown={startKnown} daily={step === 1} />
          <CashNumbers lines={horizonLines} cash={data.cash} startKnown={startKnown} days={horizon} minimum={minimum} />
        </div>
      )}

      {status === "ready" && (
        <div className="mt-4 grid gap-3">
          {minimum > 0 && data.cash < minimum ? (
            <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              <strong>O caixa de hoje ({money.format(data.cash)}) já está abaixo do saldo mínimo de {money.format(minimum)}.</strong>{" "}
              Faltam {money.format(minimum - data.cash)}.{" "}
              {(projection.at(-1)?.balance ?? data.cash) >= minimum
                ? "Pela previsão, o saldo volta ao mínimo dentro do período."
                : "Pela previsão, o saldo não volta ao mínimo dentro do período."}
            </div>
          ) : belowMinimum ? (
            <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              <strong>O caixa previsto fica abaixo do saldo mínimo de {money.format(minimum)}</strong> em{" "}
              {date.format(new Date(belowMinimum.dueDate))}, com {money.format(belowMinimum.balance)}, depois de “{belowMinimum.document}”.
            </div>
          ) : minimum > 0 ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              O caixa previsto fica acima do saldo mínimo de {money.format(minimum)} em todo o período.
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Defina o saldo mínimo e os impostos em{" "}
              <Link href="/financeiro/parametros" className="font-semibold underline">Parâmetros</Link> para o sistema avisar antes de o caixa ficar curto.
            </div>
          )}
          {expensesMissing && thisMonth && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-white p-4 text-sm">
              <p className="min-w-0 flex-1">
                <strong className="text-amber-900">Saídas quase vazias.</strong>{" "}
                <span className="text-stone-600">Só {money.format(thisMonth.outflow)} de despesas pagas neste mês, contra {money.format(thisMonth.inflow)} recebidos. Lance aluguel, folha, energia, embalagens e compras de café para a previsão ficar real.</span>
              </p>
              <Link href="/financeiro/pagar" className="inline-flex min-h-10 items-center rounded-xl border border-stone-200 px-3 font-semibold">Lançar despesas</Link>
            </div>
          )}
          {data.settings && !data.settings.cashStartDate && (
            <p className="rounded-2xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
              Informe o saldo real do Itaú e a data em{" "}
              <Link href="/financeiro/parametros" className="font-semibold underline">Parâmetros → Início do controle de caixa</Link>{" "}
              para o caixa de hoje bater com o banco.
            </p>
          )}
          {data.settings && !data.settings.taxRatesConfirmed && (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Impostos calculados com as alíquotas padrão do {data.settings.taxRegime === "LUCRO_REAL" ? "Lucro Real" : "regime escolhido"}
              {data.settings.icmsEstimated ? "" : ", sem ICMS"}. Confirme com o contador em{" "}
              <Link href="/financeiro/parametros" className="font-semibold underline">Parâmetros</Link>.
            </p>
          )}
          {!!data.dataGaps?.greenCoffeePurchasesWithoutPayable.length && (
            <div className="rounded-2xl border border-amber-200 bg-white p-4 text-sm">
              <p className="font-semibold text-amber-900">Compras de café aprovadas sem conta a pagar</p>
              <p className="mt-1 text-stone-600">
                Elas não aparecem nas saídas. Gere as contas a pagar; se já foram pagas, registre o pagamento em Pagar com a data e a conta usadas.
              </p>
              <ul className="mt-3 grid gap-2">
                {data.dataGaps.greenCoffeePurchasesWithoutPayable.map((purchase) => (
                  <li key={purchase.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-stone-50 px-3 py-2">
                    <span>
                      <strong>{purchase.purchaseNumber}</strong> · {purchase.supplier ?? "fornecedor"} · {money.format(purchase.totalValue)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void createCoffeePayables(purchase.id)}
                      disabled={gapBusy !== null}
                      className="min-h-10 rounded-xl bg-stone-950 px-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {gapBusy === purchase.id ? "Gerando..." : "Gerar contas a pagar"}
                    </button>
                  </li>
                ))}
              </ul>
              {gapMessage && <p role="status" className="mt-2 text-sm text-stone-700">{gapMessage}</p>}
            </div>
          )}
        </div>
      )}

      {status === "error" ? (
        <Card className="mt-4 p-8 text-center text-sm text-red-700">
          Não foi possível confirmar o fluxo no banco. Nenhum número fictício
          foi usado como substituto.
        </Card>
      ) : (
        <>
          {status === "ready" && (
            <div className="mt-4 grid gap-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <CashBridge lines={horizonLines} startKnown={startKnown} cash={data.cash} days={horizon} taxesConfigured={Boolean(data.settings?.configured)} />
                <RealizedMonths transactions={data.transactions ?? []} />
              </div>
              <NextCashDays lines={projection} />
            </div>
          )}

          <section className="mt-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.14em] text-forest-700">
                  Linhas do fluxo
                </p>
                <h2 className="mt-0.5 text-lg font-bold">
                  Contas que formam a projeção
                </h2>
              </div>
              <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-stone-200 bg-white p-1">
                {filterOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFilter(option.value)}
                    className={`min-h-9 shrink-0 rounded-lg px-3 text-[11px] font-bold transition ${filter === option.value ? "bg-forest-900 text-white" : "text-stone-600 hover:bg-stone-50"}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <Card className="mt-3 overflow-hidden p-0">
              <div className="hidden grid-cols-[.78fr_.85fr_1.3fr_1.25fr_.7fr_.85fr_.85fr] gap-3 border-b bg-[#F7F9F8] px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-stone-500 lg:grid">
                <span>Tipo</span>
                <span>Vencimento</span>
                <span>Documento / origem</span>
                <span>Cliente / fornecedor</span>
                <span>Status</span>
                <span className="text-right">Valor</span>
                <span className="text-right">Saldo após</span>
              </div>
              {status === "loading" ? (
                <div className="p-10 text-center text-sm text-stone-500">
                  Carregando títulos…
                </div>
              ) : visibleLines.length === 0 ? (
                <div className="p-10 text-center">
                  <ReceiptText className="mx-auto text-stone-300" />
                  <p className="mt-2 text-sm font-semibold">
                    Nenhuma linha nesta seleção
                  </p>
                  <p className="mt-1 text-xs text-stone-500">
                    Os próximos títulos aparecerão assim que forem registrados.
                  </p>
                </div>
              ) : (
                <>
                  {(showAll ? visibleLines : visibleLines.slice(0, 15)).map((line) => (
                    <ProjectionRow key={line.id} line={line} />
                  ))}
                  {visibleLines.length > 15 && (
                    <button
                      type="button"
                      onClick={() => setShowAll((value) => !value)}
                      className="min-h-11 w-full text-sm font-semibold text-stone-700 hover:bg-stone-50"
                    >
                      {showAll ? "Mostrar só os próximos 15" : `Ver todos os ${visibleLines.length} lançamentos`}
                    </button>
                  )}
                </>
              )}
            </Card>
            <p className="mt-2 text-xs leading-relaxed text-stone-500">
              O saldo após cada linha parte do caixa atual e respeita a ordem de
              vencimento. Títulos pagos e cancelados não entram na projeção.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function DataStatus({ status }: { status: "loading" | "ready" | "error" }) {
  return (
    <span
      className={`rounded-full px-3 py-2 text-[10px] font-bold ${status === "ready" ? "bg-emerald-50 text-emerald-800" : status === "error" ? "bg-red-50 text-red-800" : "bg-stone-100 text-stone-600"}`}
    >
      {status === "ready"
        ? "Dados reais conferidos"
        : status === "error"
          ? "Falha ao carregar"
          : "Carregando…"}
    </span>
  );
}

function ProjectionRow({ line }: { line: CashFlowLine }) {
  const incoming = line.kind === "RECEIVABLE";
  const typeLabel = incoming
    ? "A receber"
    : line.kind === "PAYABLE"
      ? "A pagar"
      : line.kind === "TAX"
        ? "Imposto estimado"
        : "Compra prevista";
  const typeClass = incoming
    ? "bg-emerald-50 text-emerald-800"
    : line.kind === "PAYABLE"
      ? "bg-rose-50 text-rose-800"
      : line.kind === "TAX"
        ? "bg-violet-50 text-violet-800"
        : "bg-amber-50 text-amber-900";
  const statusClass =
    line.status === "Vencido"
      ? "bg-red-50 text-red-700"
      : line.status === "Parcial"
        ? "bg-amber-50 text-amber-800"
        : "bg-stone-100 text-stone-600";
  return (
    <div className="grid gap-2.5 border-b border-stone-100 px-4 py-3 text-xs lg:grid-cols-[.78fr_.85fr_1.3fr_1.25fr_.7fr_.85fr_.85fr] lg:items-center">
      <div>
        <span
          className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${typeClass}`}
        >
          {typeLabel}
        </span>
      </div>
      <span className="font-semibold">
        <span className="mr-1 text-stone-400 lg:hidden">Vence:</span>
        {date.format(new Date(line.dueDate))}
      </span>
      <div className="min-w-0">
        <p className="truncate font-semibold text-stone-800">{line.document}</p>
        <p className="mt-0.5 truncate text-[10px] text-stone-400">
          {line.description}
        </p>
      </div>
      <span className="truncate text-stone-600">{line.counterparty}</span>
      <div>
        <span
          className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${statusClass}`}
        >
          {line.status}
        </span>
      </div>
      <strong
        className={`lg:text-right ${incoming ? "text-emerald-700" : "text-rose-700"}`}
      >
        {incoming ? "+" : "−"}
        {money.format(line.amount)}
      </strong>
      <strong className="lg:text-right">{money.format(line.balance)}</strong>
    </div>
  );
}
