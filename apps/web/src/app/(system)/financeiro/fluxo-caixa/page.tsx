"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CalendarRange,
  CircleCheck,
  CircleDollarSign,
  Landmark,
  ReceiptText,
} from "lucide-react";
import { Card } from "@bbos/ui";
import { getApiBaseUrl } from "@/lib/api-url";
import {
  buildCashFlowLines,
  buildCashFlowSeries,
  type CashFlowKind,
  type CashFlowLine,
  type CashFlowPoint,
  type CashFlowProjectionSource,
  type CashFlowTransaction,
  type GreenCoffeeProjectionSource,
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
const shortMoney = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});
const date = new Intl.DateTimeFormat("pt-BR");
const filterOptions: Array<{ value: Filter; label: string }> = [
  { value: "ALL", label: "Todos" },
  { value: "RECEIVABLE", label: "A receber" },
  { value: "PAYABLE", label: "A pagar" },
  { value: "PURCHASE", label: "Compras previstas" },
];

export default function CashFlowPage() {
  const [data, setData] = React.useState<Summary>(emptySummary);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [filter, setFilter] = React.useState<Filter>("ALL");

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
  }, []);

  const projection = React.useMemo(
    () =>
      buildCashFlowLines({
        cash: data.cash,
        receivables: data.receivableProjection,
        payables: data.payableProjection,
        purchases: data.greenCoffeePurchaseProjection,
      }),
    [data],
  );
  const series = React.useMemo(
    () =>
      buildCashFlowSeries({
        cash: data.cash,
        transactions: data.transactions,
        projection,
      }),
    [data.cash, data.transactions, projection],
  );
  const visibleLines = React.useMemo(
    () => projection.filter((item) => filter === "ALL" || item.kind === filter),
    [filter, projection],
  );
  const projectedFromLines = projection.at(-1)?.balance ?? data.cash;
  const reconciled =
    Math.abs(projectedFromLines - data.projectedBalance) < 0.01;

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
        <DataStatus status={status} />
      </header>

      <section className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Metric
          label="Caixa atual"
          value={money.format(data.cash)}
          detail="Saldo realizado"
          icon={Landmark}
        />
        <Metric
          label="A receber"
          value={money.format(data.receivables)}
          detail={`${data.receivableProjection?.length ?? 0} título(s) em aberto`}
          icon={ArrowDownLeft}
          tone="positive"
        />
        <Metric
          label="A pagar"
          value={money.format(data.payables + data.plannedPurchases)}
          detail={
            data.plannedPurchases > 0
              ? `${money.format(data.plannedPurchases)} em compras previstas`
              : "Compromissos em aberto"
          }
          icon={ArrowUpRight}
          tone="negative"
        />
        <Metric
          label="Saldo projetado"
          value={money.format(data.projectedBalance)}
          detail={
            reconciled ? "Composição conferida" : "Composição em atualização"
          }
          icon={CircleDollarSign}
          tone={data.projectedBalance >= 0 ? "positive" : "negative"}
        />
      </section>

      {status === "error" ? (
        <Card className="mt-4 p-8 text-center text-sm text-red-700">
          Não foi possível confirmar o fluxo no banco. Nenhum número fictício
          foi usado como substituto.
        </Card>
      ) : (
        <>
          <section className="mt-4 grid gap-3 xl:grid-cols-[1.65fr_.75fr]">
            <Card className="overflow-hidden p-0">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 px-4 py-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.14em] text-forest-700">
                    Evolução do saldo
                  </p>
                  <h2 className="mt-0.5 text-base font-bold">
                    Realizado e projetado
                  </h2>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-semibold text-stone-500">
                  <Legend color="bg-forest-700" label="Realizado" />
                  <Legend color="bg-amber-500" label="Projetado" dashed />
                </div>
              </div>
              <div className="px-3 pb-2 pt-1 sm:px-4">
                {status === "loading" ? (
                  <div className="grid h-52 place-items-center text-sm text-stone-500">
                    Carregando série real…
                  </div>
                ) : (
                  <CashFlowChart
                    actual={series.actual}
                    projected={series.projected}
                  />
                )}
              </div>
            </Card>

            <Card className="p-4">
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-forest-700">
                Composição da projeção
              </p>
              <h2 className="mt-0.5 text-base font-bold">
                De onde vem o saldo
              </h2>
              <div className="mt-4 space-y-2.5">
                <Composition label="Caixa atual" value={data.cash} />
                <Composition
                  label="Contas a receber"
                  value={data.receivables}
                  positive
                />
                <Composition label="Contas a pagar" value={-data.payables} />
                <Composition
                  label="Compras previstas"
                  value={-data.plannedPurchases}
                />
                <div className="mt-3 flex items-center justify-between border-t border-stone-200 pt-3">
                  <strong className="text-xs">Saldo projetado</strong>
                  <strong
                    className={
                      data.projectedBalance >= 0
                        ? "text-emerald-800"
                        : "text-red-700"
                    }
                  >
                    {money.format(data.projectedBalance)}
                  </strong>
                </div>
              </div>
              <p
                className={`mt-4 flex items-start gap-2 rounded-xl px-3 py-2 text-[11px] ${reconciled ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}
              >
                <CircleCheck size={14} className="mt-0.5 shrink-0" />
                {reconciled
                  ? "Todos os títulos abaixo fecham com o saldo projetado."
                  : "Há uma atualização entre o resumo e as linhas. Recarregue antes de decidir."}
              </p>
            </Card>
          </section>

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
                visibleLines.map((line) => (
                  <ProjectionRow key={line.id} line={line} />
                ))
              )}
            </Card>
            <p className="mt-2 text-[11px] leading-relaxed text-stone-500">
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

function Metric({
  label,
  value,
  detail,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Landmark;
  tone?: "neutral" | "positive" | "negative";
}) {
  const iconTone =
    tone === "positive"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "negative"
        ? "bg-rose-50 text-rose-700"
        : "bg-stone-100 text-stone-600";
  return (
    <Card className="min-w-0 p-3.5 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-stone-500">
            {label}
          </p>
          <p className="mt-1.5 truncate text-lg font-bold sm:text-xl">
            {value}
          </p>
        </div>
        <span
          className={`grid size-8 shrink-0 place-items-center rounded-lg ${iconTone}`}
        >
          <Icon size={15} />
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-[10px] text-stone-500">{detail}</p>
    </Card>
  );
}

function Legend({
  color,
  label,
  dashed = false,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-0.5 w-5 ${color} ${dashed ? "opacity-70" : ""}`} />{" "}
      {label}
    </span>
  );
}

function Composition({
  label,
  value,
  positive = false,
}: {
  label: string;
  value: number;
  positive?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-stone-500">{label}</span>
      <strong
        className={
          positive
            ? "text-emerald-700"
            : value < 0
              ? "text-rose-700"
              : "text-stone-800"
        }
      >
        {value > 0 && positive ? "+" : ""}
        {money.format(value)}
      </strong>
    </div>
  );
}

function ProjectionRow({ line }: { line: CashFlowLine }) {
  const incoming = line.kind === "RECEIVABLE";
  const typeLabel = incoming
    ? "A receber"
    : line.kind === "PAYABLE"
      ? "A pagar"
      : "Compra prevista";
  const typeClass = incoming
    ? "bg-emerald-50 text-emerald-800"
    : line.kind === "PAYABLE"
      ? "bg-rose-50 text-rose-800"
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

function CashFlowChart({
  actual,
  projected,
}: {
  actual: CashFlowPoint[];
  projected: CashFlowPoint[];
}) {
  const width = 860;
  const height = 220;
  const padding = { left: 58, right: 24, top: 24, bottom: 36 };
  const values = [...actual, ...projected].map((point) => point.balance);
  const rawMin = Math.min(...values, 0);
  const rawMax = Math.max(...values, 0);
  const spread = Math.max(rawMax - rawMin, 1);
  const min = rawMin - spread * 0.12;
  const max = rawMax + spread * 0.12;
  const y = (value: number) =>
    padding.top +
    ((max - value) / (max - min)) * (height - padding.top - padding.bottom);
  const actualWidth =
    projected.length > 1 ? width * 0.46 : width - padding.right;
  const actualX = (index: number) =>
    actual.length === 1
      ? actualWidth
      : padding.left +
        (index / Math.max(actual.length - 1, 1)) * (actualWidth - padding.left);
  const projectedX = (index: number) =>
    actualWidth +
    (index / Math.max(projected.length - 1, 1)) *
      (width - padding.right - actualWidth);
  const actualPath = actual
    .map(
      (point, index) =>
        `${index ? "L" : "M"}${actualX(index)},${y(point.balance)}`,
    )
    .join(" ");
  const projectedPath = projected
    .map(
      (point, index) =>
        `${index ? "L" : "M"}${projectedX(index)},${y(point.balance)}`,
    )
    .join(" ");
  const ticks = [max, max - (max - min) / 2, min];
  return (
    <div
      className="w-full overflow-hidden"
      aria-label="Gráfico do fluxo de caixa realizado e projetado"
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto min-h-[180px] w-full"
        role="img"
      >
        <title>Fluxo de caixa realizado e projetado</title>
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="#e7e5e4"
              strokeWidth="1"
            />
            <text
              x={padding.left - 8}
              y={y(tick) + 4}
              textAnchor="end"
              fill="#78716c"
              fontSize="10"
            >
              {shortMoney.format(tick)}
            </text>
          </g>
        ))}
        <line
          x1={actualWidth}
          x2={actualWidth}
          y1={padding.top}
          y2={height - padding.bottom}
          stroke="#d6d3d1"
          strokeDasharray="4 5"
        />
        <path
          d={actualPath}
          fill="none"
          stroke="#0f766e"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={projectedPath}
          fill="none"
          stroke="#d97706"
          strokeWidth="3"
          strokeDasharray="7 6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx={actualX(actual.length - 1)}
          cy={y(actual.at(-1)?.balance ?? 0)}
          r="4"
          fill="#0f766e"
        />
        <circle
          cx={projectedX(projected.length - 1)}
          cy={y(projected.at(-1)?.balance ?? 0)}
          r="4"
          fill="#d97706"
        />
        <text x={padding.left} y={height - 10} fill="#78716c" fontSize="10">
          Histórico
        </text>
        <text x={actualWidth + 8} y={height - 10} fill="#78716c" fontSize="10">
          Hoje
        </text>
        <text
          x={width - padding.right}
          y={height - 10}
          textAnchor="end"
          fill="#78716c"
          fontSize="10"
        >
          Último vencimento
        </text>
      </svg>
    </div>
  );
}
