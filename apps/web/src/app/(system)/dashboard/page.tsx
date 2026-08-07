"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Banknote,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Download,
  Factory,
  Gauge,
  Lightbulb,
  Package,
  Percent,
  ShoppingBag,
  SlidersHorizontal,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";
import { Badge, Card } from "@bbos/ui";
import type {
  PerformanceDiagnostic,
  PerformanceStatus,
  Period,
} from "@bbos/shared";
import {
  CommercialDetailDrawer,
  DiagnosticDrawer,
  RoiDrawer,
  SalesMapDrawer,
} from "@/components/executive-drawers";
import { demoDashboard } from "@/lib/demo-data";
import { executiveV3DemoData } from "@/lib/executive-v3-demo-data";
import { BrazilSalesPanel } from "@/components/brazil-sales-map";

const periods: Array<{ key: Period; label: string }> = [
  { key: "day", label: "Dia" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mês" },
  { key: "year", label: "Ano" },
];
const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const statusStyle: Record<
  PerformanceStatus,
  { label: string; dot: string; text: string }
> = {
  "on-track": {
    label: "Na meta",
    dot: "bg-emerald-500",
    text: "text-emerald-700",
  },
  attention: { label: "Atenção", dot: "bg-amber-500", text: "text-amber-700" },
  "off-track": { label: "Crítico", dot: "bg-red-500", text: "text-red-700" },
};

function MiniTrend({
  values,
  color = "text-forest-700",
}: {
  values: number[];
  color?: string;
}) {
  const min = Math.min(...values) - 1;
  const max = Math.max(...values) + 1;
  const points = values
    .map(
      (value, index) =>
        `${(index / (values.length - 1)) * 100},${28 - ((value - min) / (max - min)) * 22}`,
    )
    .join(" ");
  return (
    <svg
      viewBox="0 0 100 30"
      className={`h-8 w-20 overflow-visible ${color}`}
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function KpiCard({
  label,
  value,
  supporting,
  change,
  icon: Icon,
  onClick,
  href,
  status,
}: {
  label: string;
  value: string;
  supporting: string;
  change?: number;
  icon: typeof Banknote;
  onClick?: () => void;
  href?: string;
  status?: PerformanceStatus;
}) {
  const content = (
    <Card className="group h-full border-0 p-4 shadow-[0_1px_2px_rgba(28,25,23,.06),0_8px_24px_rgba(28,25,23,.035)] transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-forest-50 text-forest-700">
          <Icon size={15} strokeWidth={1.7} />
        </span>
        {status ? (
          <span
            className={`flex items-center gap-1.5 text-[10px] font-bold ${statusStyle[status].text}`}
          >
            <span
              className={`size-1.5 rounded-full ${statusStyle[status].dot}`}
            />
            {statusStyle[status].label}
          </span>
        ) : change !== undefined ? (
          <span
            className={`flex items-center text-[10px] font-bold ${change >= 0 ? "text-emerald-700" : "text-amber-700"}`}
          >
            <ArrowUpRight size={11} />
            {number.format(Math.abs(change))}%
          </span>
        ) : null}
      </div>
      <p className="mt-4 text-sm font-semibold text-stone-800">{label}</p>
      <p className="mt-1 text-[27px] font-bold leading-tight tracking-tight text-stone-950">
        {value}
      </p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs text-stone-600">{supporting}</p>
          <MiniTrend
            values={
              change !== undefined
                ? [42, 45, 44, 48, 47, 51, 51 + change]
                : [42, 43, 45, 44, 47, 46, 49]
            }
          />
        </div>
        <ChevronRight
          size={15}
          className="shrink-0 text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-forest-700"
        />
      </div>
    </Card>
  );
  if (href)
    return (
      <Link href={href} className="block h-full">
        {content}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} className="h-full w-full text-left">
      {content}
    </button>
  );
}

function RevenueChart({
  period,
  onOpen,
}: {
  period: Period;
  onOpen: () => void;
}) {
  const goal = demoDashboard.goals.find((item) => item.period === period)!;
  const previous =
    goal.actual / (1 + demoDashboard.metricsByPeriod[period][0]!.change / 100);
  const sets: Record<Period, number[]> = {
    day: [17, 18, 20, 19, 22, 23, 24.86],
    week: [82, 88, 91, 98, 104, 112, 118.74],
    month: [312, 338, 361, 397, 421, 455, 486.32],
    year: [1.9, 2.15, 2.52, 2.81, 3.16, 3.49, 3.84],
  };
  const values = sets[period];
  const min = Math.min(...values) * 0.92;
  const max = Math.max(...values) * 1.05;
  const points = values
    .map(
      (value, index) =>
        `${(index / (values.length - 1)) * 100},${72 - ((value - min) / (max - min)) * 58}`,
    )
    .join(" ");
  return (
    <button type="button" onClick={onOpen} className="w-full text-left">
      <Card className="group border-0 p-6 shadow-[0_1px_2px_rgba(28,25,23,.06),0_12px_32px_rgba(28,25,23,.04)] transition hover:shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.14em] text-forest-700">
              Receita x Meta
            </p>
            <div className="mt-2 flex items-end gap-3">
              <p className="text-2xl font-bold">
                {currency.format(goal.actual)}
              </p>
              <span
                className={`mb-1 text-xs font-bold ${statusStyle[goal.status].text}`}
              >
                {number.format(goal.attainment)}%
              </span>
            </div>
            <p className="mt-1 text-xs text-stone-400">
              Meta {currency.format(goal.target)} • projeção{" "}
              {currency.format(goal.closingProjection)} • anterior{" "}
              {currency.format(previous)}
            </p>
          </div>
          <span className="flex items-center gap-1 text-[11px] font-bold text-forest-700">
            Detalhar <ChevronRight size={13} />
          </span>
        </div>
        <div className="relative mt-6">
          <svg
            viewBox="0 0 100 78"
            className="h-48 w-full overflow-visible"
            role="img"
            aria-label="Evolução da receita"
          >
            <defs>
              <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#7065a8" stopOpacity=".20" />
                <stop offset="1" stopColor="#7065a8" stopOpacity="0" />
              </linearGradient>
            </defs>
            <line
              x1="0"
              y1="18"
              x2="100"
              y2="18"
              stroke="#d6d3d1"
              strokeDasharray="2 3"
              strokeWidth=".5"
            />
            <polygon
              points={`0,74 ${points} 100,74`}
              fill="url(#revenue-fill)"
            />
            <polyline
              points={points}
              fill="none"
              stroke="#7065a8"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points={points
                .split(" ")
                .map((point) => {
                  const [x, y] = point.split(",").map(Number);
                  return `${x},${Math.min((y ?? 0) + 8, 74)}`;
                })
                .join(" ")}
              fill="none"
              stroke="#9ca3af"
              strokeWidth="1"
              strokeDasharray="2 2"
              strokeLinecap="round"
            />
            <line
              x1="0"
              y1="14"
              x2="100"
              y2="14"
              stroke="#b98955"
              strokeWidth="1"
              strokeDasharray="3 2"
            />
            <line
              x1="82"
              y1={Number(points.split(" ").at(-2)?.split(",")[1])}
              x2="100"
              y2="8"
              stroke="#4d7b82"
              strokeWidth="1.4"
              strokeDasharray="2 2"
            />
            <circle
              cx="100"
              cy={Number(points.split(" ").at(-1)?.split(",")[1])}
              r="2.5"
              fill="white"
              stroke="#7065a8"
              strokeWidth="1.5"
            />
          </svg>
          <div className="absolute bottom-1 left-0 right-0 flex justify-between text-[9px] text-stone-400">
            <span>Início</span>
            <span>Realizado</span>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-[9px] text-stone-500">
          <span className="flex items-center gap-1.5">
            <i className="h-px w-4 bg-[#7065a8]" />
            Realizado
          </span>
          <span className="flex items-center gap-1.5">
            <i className="h-px w-4 border-t border-dashed border-[#b98955]" />
            Meta
          </span>
          <span className="flex items-center gap-1.5">
            <i className="h-px w-4 border-t border-dashed border-[#4d7b82]" />
            Projeção
          </span>
          <span className="flex items-center gap-1.5">
            <i className="h-px w-4 border-t border-dashed border-stone-400" />
            Período anterior
          </span>
        </div>
      </Card>
    </button>
  );
}

function SalesMapCard({ onOpen }: { onOpen: () => void }) {
  return <BrazilSalesPanel onStateClick={onOpen} onRegionClick={onOpen} />;
  /* Legacy regional card retained temporarily for reference; replaced by the vector map.
  const regions: Array<{
    id: string;
    name: string;
    revenue: number;
    salesShare: number;
    attainment: number;
    status: PerformanceStatus;
  }> = [
    {
      id: "eu",
      name: "Europa",
      revenue: 132400,
      salesShare: 27.2,
      attainment: 103.4,
      status: "on-track",
    },
    {
      id: "sa",
      name: "América do Sul",
      revenue: 248600,
      salesShare: 51.1,
      attainment: 96.2,
      status: "attention",
    },
    {
      id: "na",
      name: "América do Norte",
      revenue: 74400,
      salesShare: 15.3,
      attainment: 84.1,
      status: "off-track",
    },
    {
      id: "as",
      name: "Ásia",
      revenue: 30920,
      salesShare: 6.4,
      attainment: 92.8,
      status: "attention",
    },
    {
      id: "af",
      name: "África",
      revenue: 0,
      salesShare: 0,
      attainment: 0,
      status: "attention",
    },
    {
      id: "oc",
      name: "Oceania",
      revenue: 0,
      salesShare: 0,
      attainment: 0,
      status: "attention",
    },
  ];
  return (
    <button type="button" onClick={onOpen} className="h-full w-full text-left">
      <Card className="group relative h-full min-h-[330px] overflow-hidden border-0 bg-white p-6 text-[#111514] transition hover:-translate-y-0.5">
        <div className="absolute -right-20 -top-20 size-64 rounded-full border-[38px] border-[#F7F9F8]" />
        <div className="relative flex h-full flex-col">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.14em] text-coffee-300">
                <MapPinned size={14} strokeWidth={1.7} />
                Mapa de Vendas
              </div>
              <p className="mt-2 text-sm text-[#626B69]">
                Participação e atingimento regional
              </p>
            </div>
            <ChevronRight
              size={16}
              className="text-[#7A8381] transition group-hover:translate-x-1"
            />
          </div>
          <div className="mt-5 grid flex-1 grid-cols-2 gap-x-5 gap-y-3">
            {regions.map((region) => (
              <div
                key={region.id}
                className="rounded-xl border border-[#E7ECEA] bg-[#F7F9F8] p-3"
              >
                <div className="flex items-start justify-between">
                  <p className="text-xs font-bold">{region.name}</p>
                  <span
                    className={`size-2 rounded-full ${region.revenue ? statusStyle[region.status].dot : "bg-stone-400"}`}
                  />
                </div>
                <p className="mt-2 text-sm font-bold">
                  {currency.format(region.revenue)}
                </p>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-[#E7ECEA]">
                  <div
                    className={`h-full rounded-full ${region.revenue ? "bg-coffee-300" : "bg-stone-500"}`}
                    style={{ width: `${Math.min(region.attainment, 100)}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-[9px] text-[#626B69]">
                  <span>{number.format(region.salesShare)}% das vendas</span>
                  <span>
                    {region.revenue
                      ? `${number.format(region.attainment)}% da meta`
                      : "Sem dados"}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-5 text-[10px] text-[#7A8381]">
            Mundo → País → Região → Estado → Cidade → Cliente → Produto → Pedido
          </p>
        </div>
      </Card>
    </button>
  ); */
}

const cashFlowSeries = [
  {
    label: "Sem 1",
    cash: 118000,
    inflow: 92000,
    outflow: 74000,
    projected: 120000,
    minimum: 85000,
  },
  {
    label: "Sem 2",
    cash: 136000,
    inflow: 108000,
    outflow: 90000,
    projected: 139000,
    minimum: 85000,
  },
  {
    label: "Sem 3",
    cash: 129000,
    inflow: 86000,
    outflow: 93000,
    projected: 145000,
    minimum: 85000,
  },
  {
    label: "Sem 4",
    cash: 151000,
    inflow: 121000,
    outflow: 99000,
    projected: 158000,
    minimum: 85000,
  },
  {
    label: "Sem 5",
    cash: 143000,
    inflow: 97000,
    outflow: 105000,
    projected: 166000,
    minimum: 85000,
  },
  {
    label: "Sem 6",
    cash: 162000,
    inflow: 126000,
    outflow: 107000,
    projected: 178000,
    minimum: 85000,
  },
  {
    label: "Fech.",
    cash: 174000,
    inflow: 132000,
    outflow: 120000,
    projected: 186000,
    minimum: 85000,
  },
];

function CashFlowChart() {
  const [hovered, setHovered] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const min = 65000;
  const max = 200000;
  const x = (index: number) => 28 + index * 107;
  const y = (value: number) => 190 - ((value - min) / (max - min)) * 150;
  const points = (
    key: "cash" | "inflow" | "outflow" | "projected" | "minimum",
  ) =>
    cashFlowSeries
      .map((item, index) => `${x(index)},${y(item[key])}`)
      .join(" ");
  const focus = hovered === null ? null : cashFlowSeries[hovered];
  const detail = selected === null ? null : cashFlowSeries[selected];
  return (
    <>
      <Card className="border-0 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-forest-700">
              Financeiro
            </p>
            <h2 className="mt-1 text-lg font-bold">
              Fluxo de Caixa — Realizado e Projetado
            </h2>
          </div>
          <Link
            href="/financeiro/fluxo-caixa"
            className="flex items-center gap-1 text-[10px] font-bold text-forest-700"
          >
            Detalhar <ChevronRight size={11} />
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["Caixa atual", 174000, "#275f66"],
            ["Entradas", 132000, "#5c8f6b"],
            ["Saídas", 120000, "#b86f4b"],
            ["Fechamento projetado", 186000, "#7567a7"],
          ].map(([label, value, tone]) => (
            <div
              key={String(label)}
              className="rounded-xl bg-[#F7F9F8] px-3 py-2.5"
            >
              <p className="text-[9px] text-stone-500">{label}</p>
              <p
                className="mt-1 text-sm font-bold"
                style={{ color: String(tone) }}
              >
                {currency.format(Number(value))}
              </p>
            </div>
          ))}
        </div>
        <div className="relative mt-4">
          <svg
            data-testid="cash-flow-chart"
            viewBox="0 0 700 220"
            className="h-52 w-full"
            role="img"
            aria-label="Fluxo de caixa realizado e projetado"
          >
            {[40, 90, 140, 190].map((line) => (
              <line
                key={line}
                x1="28"
                x2="670"
                y1={line}
                y2={line}
                stroke="#e7e5e4"
                strokeWidth=".7"
              />
            ))}
            <polyline
              points={points("minimum")}
              fill="none"
              stroke="#a8a29e"
              strokeWidth="1"
            />
            <polyline
              points={points("outflow")}
              fill="none"
              stroke="#b86f4b"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points={points("inflow")}
              fill="none"
              stroke="#5c8f6b"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points={points("projected")}
              fill="none"
              stroke="#7567a7"
              strokeWidth="2"
              strokeDasharray="6 5"
              strokeLinecap="round"
            />
            <polyline
              points={points("cash")}
              fill="none"
              stroke="#275f66"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {cashFlowSeries.map((item, index) => (
              <g key={item.label}>
                <circle
                  cx={x(index)}
                  cy={y(item.cash)}
                  r={hovered === index ? 5 : 3.2}
                  fill="#275f66"
                  className="cursor-pointer"
                  onMouseEnter={() => setHovered(index)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => setSelected(index)}
                >
                  <title>{`${item.label} • Caixa ${currency.format(item.cash)}`}</title>
                </circle>
                <text
                  x={x(index)}
                  y="212"
                  textAnchor="middle"
                  fontSize="9"
                  fill="#78716c"
                >
                  {item.label}
                </text>
              </g>
            ))}
          </svg>
          {focus && (
            <div
              role="tooltip"
              className="pointer-events-none absolute right-4 top-2 rounded-xl border bg-white/95 p-3 text-[9px] shadow-lg"
            >
              <strong>{focus.label}</strong>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-stone-500">
                <span>Caixa</span>
                <b className="text-stone-900">{currency.format(focus.cash)}</b>
                <span>Entradas</span>
                <b className="text-stone-900">
                  {currency.format(focus.inflow)}
                </b>
                <span>Saídas</span>
                <b className="text-stone-900">
                  {currency.format(focus.outflow)}
                </b>
                <span>Projetado</span>
                <b className="text-stone-900">
                  {currency.format(focus.projected)}
                </b>
              </div>
            </div>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-[9px] text-stone-500">
          {[
            ["#275f66", "Saldo de Caixa"],
            ["#5c8f6b", "Entradas"],
            ["#b86f4b", "Saídas"],
            ["#7567a7", "Caixa Projetado"],
            ["#a8a29e", "Limite Mínimo"],
          ].map(([tone, label]) => (
            <span key={label} className="flex items-center gap-1.5">
              <i className="h-px w-4" style={{ background: tone }} />
              {label}
            </span>
          ))}
        </div>
      </Card>
      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            aria-label="Fechar composição"
            className="absolute inset-0 bg-forest-950/25"
            onClick={() => setSelected(null)}
          />
          <aside className="relative h-full w-full max-w-md bg-white p-6 shadow-2xl">
            <div className="flex justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-forest-700">
                  Composição do período
                </p>
                <h2 className="mt-2 text-xl font-bold">{detail.label}</h2>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-xl border p-2"
              >
                ×
              </button>
            </div>
            <div className="mt-7 space-y-3">
              {[
                ["Saldo de Caixa", detail.cash],
                ["Entradas", detail.inflow],
                ["Saídas", detail.outflow],
                ["Caixa Projetado", detail.projected],
                ["Limite Mínimo", detail.minimum],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="flex justify-between rounded-xl bg-[#F7F9F8] p-4 text-sm"
                >
                  <span className="text-stone-500">{label}</span>
                  <strong>{currency.format(Number(value))}</strong>
                </div>
              ))}
            </div>
            <Link
              href="/financeiro/fluxo-caixa"
              className="mt-6 flex items-center justify-center rounded-xl bg-forest-900 px-4 py-3 text-xs font-bold text-white"
            >
              Abrir fluxo de caixa
            </Link>
          </aside>
        </div>
      )}
    </>
  );
}

function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-forest-700">
          {eyebrow}
        </p>
        <h2 className="mt-1 font-[var(--font-manrope)] text-lg font-bold">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

function CompactStat({
  label,
  value,
  supporting,
  status,
}: {
  label: string;
  value: string;
  supporting?: string;
  status?: PerformanceStatus;
}) {
  return (
    <div className="rounded-xl bg-[#F7F9F8] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] text-stone-500">{label}</p>
        {status && (
          <span
            title={statusStyle[status].label}
            className={`size-1.5 rounded-full ${statusStyle[status].dot}`}
          />
        )}
      </div>
      <p className="mt-1 text-sm font-bold">{value}</p>
      {supporting && (
        <p className="mt-1 truncate text-[9px] text-stone-400">{supporting}</p>
      )}
    </div>
  );
}

function Ranking({
  items,
  kind,
}: {
  items: typeof executiveV3DemoData.topCustomers;
  kind: "customer" | "product";
}) {
  const max = Math.max(...items.map((item) => item.primaryValue));
  return (
    <div className="mt-4 space-y-3">
      {items.map((item, index) => (
        <div key={item.id}>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 w-4 text-[10px] font-bold text-stone-300">
              0{index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-xs font-semibold">{item.name}</p>
                <p className="shrink-0 text-[10px] font-bold">
                  {kind === "customer"
                    ? currency.format(item.revenue)
                    : `${number.format(item.primaryValue)} kg`}
                </p>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-stone-100">
                <div
                  className="h-full rounded-full bg-[#7065a8]"
                  style={{ width: `${(item.primaryValue / max) * 100}%` }}
                />
              </div>
              <div className="mt-1 flex gap-3 text-[9px] text-stone-400">
                <span>Margem {number.format(item.marginPercent)}%</span>
                <span
                  className={
                    item.growthPercent >= 0
                      ? "text-emerald-700"
                      : "text-red-700"
                  }
                >
                  {item.growthPercent > 0 ? "+" : ""}
                  {number.format(item.growthPercent)}%
                </span>
                {item.salesShare !== undefined && (
                  <span>{number.format(item.salesShare)}% participação</span>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>("month");
  const [roiOpen, setRoiOpen] = useState(false);
  const [commercialOpen, setCommercialOpen] = useState(false);
  const [salesMapOpen, setSalesMapOpen] = useState(false);
  const [diagnostic, setDiagnostic] = useState<PerformanceDiagnostic | null>(
    null,
  );
  const data = demoDashboard;
  const v3 = executiveV3DemoData;
  useEffect(() => {
    const saved = window.localStorage.getItem(
      "bbos-executive-period",
    ) as Period | null;
    if (saved && periods.some((item) => item.key === saved)) setPeriod(saved);
  }, []);
  const selectPeriod = (next: Period) => {
    setPeriod(next);
    window.localStorage.setItem("bbos-executive-period", next);
  };
  const metrics = data.metricsByPeriod[period];
  const openDiagnostic = (sourceId: string) =>
    setDiagnostic(
      data.diagnostics.find((item) => item.sourceId === sourceId) ??
        data.diagnostics[0]!,
    );
  const kpis = [
    {
      label: "Vendas",
      value: metrics[0]!.value,
      supporting: "94,6% da meta",
      change: metrics[0]!.change,
      icon: Banknote,
      href: "/vendas",
    },
    {
      label: "Receita",
      value: metrics[0]!.value,
      supporting: metrics[0]!.supportingText,
      change: metrics[0]!.change,
      icon: CircleDollarSign,
      onClick: () => setCommercialOpen(true),
    },
    {
      label: "Lucro líquido",
      value: metrics[1]!.value,
      supporting: metrics[1]!.supportingText,
      change: metrics[1]!.change,
      icon: CircleDollarSign,
      onClick: () => openDiagnostic("roi"),
    },
    {
      label: "ROI",
      value: `${number.format(data.roi.current)}%`,
      supporting: `Meta ${number.format(data.roi.target)}% • ${number.format(data.roi.difference)} p.p.`,
      icon: Percent,
      status: data.roi.status,
      onClick: () => setRoiOpen(true),
    },
    {
      label: "Margem líquida",
      value: metrics[2]!.value,
      supporting: metrics[2]!.supportingText,
      change: metrics[2]!.change,
      icon: Gauge,
      onClick: () => openDiagnostic("roi"),
    },
    {
      label: "Pedidos em aberto",
      value: "27",
      supporting: `${metrics[6]!.value} no período`,
      change: metrics[6]!.change,
      icon: ShoppingBag,
      href: "/pedidos",
    },
    {
      label: "Produção",
      value: metrics[4]!.value,
      supporting: metrics[4]!.supportingText,
      change: metrics[4]!.change,
      icon: Factory,
      href: "/producao",
    },
  ];
  return (
    <div className="executive-dashboard flex w-full max-w-none flex-col">
      <header className="order-1 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.16em] text-forest-700">
            <Factory size={13} />
            Cockpit Executivo
          </div>
          <h1 className="font-[var(--font-manrope)] text-3xl font-bold tracking-tight">
            Dashboard Executivo
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            Visão consolidada da Bispo Coffees • atualizado hoje, 10:30
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div
            className="flex w-fit rounded-xl border border-[#E7ECEA] bg-white p-1"
            aria-label="Período do dashboard"
          >
            {periods.map((item) => (
              <button
                key={item.key}
                onClick={() => selectPeriod(item.key)}
                aria-pressed={period === item.key}
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${period === item.key ? "bg-[#F0F3F2] text-stone-950" : "bg-white text-stone-500 hover:bg-[#F7F9F8] hover:text-stone-900"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            title="Filtrar dashboard"
            className="flex items-center gap-2 rounded-xl border border-[#E7ECEA] bg-white px-3 py-2.5 text-xs font-semibold text-stone-700 transition hover:bg-[#F7F9F8]"
          >
            <SlidersHorizontal size={14} />
            Filtros
          </button>
          <button
            title="Exportar visão executiva"
            className="flex items-center gap-2 rounded-xl border border-[#E7ECEA] bg-white px-3 py-2.5 text-xs font-semibold text-stone-700 transition hover:bg-[#F7F9F8]"
          >
            <Download size={14} />
            Exportar
          </button>
        </div>
      </header>
      <section className="order-2 mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {kpis.map((item) => (
          <KpiCard key={item.label} {...item} />
        ))}
      </section>
      <section className="order-4 mt-4 grid gap-4 xl:grid-cols-[3fr_2fr]">
        <RevenueChart period={period} onOpen={() => setCommercialOpen(true)} />
        <SalesMapCard onOpen={() => setSalesMapOpen(true)} />
      </section>
      <section className="order-5 mt-5">
        <CashFlowChart />
      </section>
      <section className="order-3 mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Link href="/estoque">
          <Card className="group h-full border-0 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
            <div className="flex items-center justify-between">
              <span className="grid size-9 place-items-center rounded-xl bg-coffee-50 text-coffee-700">
                <Warehouse size={17} />
              </span>
              <span
                className="grid size-11 place-items-center rounded-full text-[10px] font-bold text-coffee-700"
                style={{
                  background:
                    "radial-gradient(closest-side, white 76%, transparent 78% 99%), conic-gradient(#8b6f47 72%, #f4eee7 0)",
                }}
              >
                72%
              </span>
            </div>
            <p className="mt-4 text-sm font-semibold text-stone-800">
              Estoque de café verde
            </p>
            <p className="mt-1 text-2xl font-bold">42.180 kg</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full w-[72%] rounded-full bg-coffee-500" />
            </div>
            <p className="mt-2 text-[10px] text-stone-400">
              {currency.format(v3.inventory.stockValue)} • 703 sacas
              equivalentes
            </p>
          </Card>
        </Link>
        <Link href="/estoque">
          <Card className="group h-full border-0 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
            <div className="flex items-center justify-between">
              <span className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-700">
                <Gauge size={17} />
              </span>
              <span
                className="grid size-11 place-items-center rounded-full text-[10px] font-bold text-amber-700"
                style={{
                  background:
                    "radial-gradient(closest-side, white 76%, transparent 78% 99%), conic-gradient(#d97706 63%, #fef3c7 0)",
                }}
              >
                38d
              </span>
            </div>
            <p className="mt-4 text-sm font-semibold text-stone-800">
              Cobertura de estoque
            </p>
            <p className="mt-1 text-2xl font-bold">38 dias</p>
            <div className="mt-3 flex items-end justify-between">
              <p className="text-[10px] text-stone-500">
                Meta 60 dias • 63% da cobertura ideal
              </p>
              <ChevronRight size={14} className="text-stone-300" />
            </div>
          </Card>
        </Link>
        <Link href="/pedidos" className="h-full text-left">
          <Card className="group h-full border-0 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
            <div className="flex items-center justify-between">
              <span className="grid size-9 place-items-center rounded-xl bg-[#edf4f5] text-[#4d7b82]">
                <ShoppingBag size={17} />
              </span>
              <MiniTrend
                values={[18, 20, 17, 23, 21, 25, 27]}
                color="text-[#4d7b82]"
              />
            </div>
            <p className="mt-4 text-sm font-semibold text-stone-800">
              Backlog de pedidos
            </p>
            <p className="mt-1 text-2xl font-bold">27 pedidos</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-[10px]">
              <span className="text-stone-500">
                Valor
                <br />
                <strong className="text-xs text-stone-900">R$ 184.600</strong>
              </span>
              <span className="text-stone-500">
                Entrega média
                <br />
                <strong className="text-xs text-stone-900">3,4 dias</strong>
              </span>
            </div>
          </Card>
        </Link>
        <Card
          id="atencao-gestor"
          role="button"
          tabIndex={0}
          onClick={() =>
            document
              .getElementById("atencao-executiva")
              ?.scrollIntoView({ behavior: "smooth" })
          }
          onKeyDown={(event) => {
            if (event.key === "Enter")
              document
                .getElementById("atencao-executiva")
                ?.scrollIntoView({ behavior: "smooth" });
          }}
          className="cursor-pointer border-0 bg-white p-5 text-[#111514] transition hover:-translate-y-0.5"
        >
          <div className="flex items-center gap-2">
            <Lightbulb size={16} className="text-coffee-300" />
            <p className="text-sm font-semibold">Alertas críticos</p>
            <Badge tone="danger">{data.alerts.length}</Badge>
          </div>
          <div className="mt-4 space-y-3">
            {data.alerts.slice(0, 3).map((alert, index) => (
              <div
                key={alert.id}
                className="flex gap-3 border-t border-[#E7ECEA] pt-3 first:border-0 first:pt-0"
              >
                <span className="text-[10px] font-bold text-[#7A8381]">
                  0{index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold">
                    {alert.title}
                  </p>
                  <Link
                    href={
                      alert.area === "Estoque"
                        ? "/estoque"
                        : alert.area === "Produção"
                          ? "/producao"
                          : "/recebimento"
                    }
                    className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-coffee-300"
                  >
                    {alert.area === "Estoque"
                      ? "Ver estoque"
                      : alert.area === "Produção"
                        ? "Ver produção"
                        : "Analisar"}
                    <ChevronRight size={10} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>
      <section className="order-5 mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Link href="/producao">
          <Card className="group h-full border-0 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Factory size={16} className="text-[#7065a8]" />
                <h2 className="text-sm font-bold">Performance Industrial</h2>
              </div>
              <ChevronRight size={14} className="text-stone-300" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <CompactStat
                label="Eficiência"
                value={`${number.format(v3.industrial.efficiencyPercent)}%`}
                status="on-track"
              />
              <CompactStat
                label="Perda de torra"
                value={`${number.format(v3.industrial.roastLossPercent)}%`}
                status="attention"
              />
              <CompactStat
                label="Custo real/kg"
                value={currency.format(v3.industrial.realCostPerKg)}
              />
              <CompactStat
                label="OPs em andamento"
                value={String(v3.industrial.workOrdersInProgress)}
              />
            </div>
            <p className="mt-3 text-[10px] font-semibold text-red-700">
              {v3.industrial.delayedWorkOrders} OP atrasada
            </p>
          </Card>
        </Link>
        <Link href="/estoque">
          <Card className="group h-full border-0 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Warehouse size={16} className="text-coffee-700" />
                <h2 className="text-sm font-bold">Estoque / Suprimentos</h2>
              </div>
              <ChevronRight size={14} className="text-stone-300" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <CompactStat
                label="Café verde"
                value={`${number.format(v3.inventory.greenCoffeeAvailableKg)} kg`}
              />
              <CompactStat
                label="Produto acabado"
                value={`${number.format(v3.inventory.finishedGoodsUnits)} kg`}
              />
              <CompactStat
                label="Cobertura total"
                value={`${v3.inventory.coverageDays} dias`}
                status="attention"
              />
              <CompactStat
                label="Embalagens críticas"
                value={String(v3.logistics.criticalPackaging)}
                status="off-track"
              />
            </div>
          </Card>
        </Link>
        <Link href="/recebimento">
          <Card className="group h-full border-0 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck size={16} className="text-[#4d7b82]" />
                <h2 className="text-sm font-bold">Logística</h2>
              </div>
              <Badge tone="neutral">Demo</Badge>
            </div>
            <div className="mt-4 space-y-3">
              <CompactStat
                label="Containers em trânsito"
                value={String(v3.logistics.containersInTransit)}
              />
              <CompactStat
                label="Próximas chegadas"
                value={`${v3.logistics.nextArrivals} dias`}
              />
              <CompactStat
                label="Compras em aberto"
                value={currency.format(v3.logistics.openPurchases)}
              />
            </div>
            <p className="mt-3 text-[9px] text-stone-400">
              Dados mock preparados para futura API.
            </p>
          </Card>
        </Link>
        <button
          onClick={() => setSalesMapOpen(true)}
          className="h-full text-left"
        >
          <Card className="group h-full border-0 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-forest-700" />
                <h2 className="text-sm font-bold">Top Clientes</h2>
              </div>
              <ChevronRight size={14} className="text-stone-300" />
            </div>
            <Ranking items={v3.topCustomers.slice(0, 3)} kind="customer" />
            <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold text-forest-700">
              Abrir ranking <ChevronRight size={10} />
            </span>
          </Card>
        </button>
      </section>
      <section className="hidden" aria-hidden="true">
        <SectionHeading
          eyebrow="Performance Industrial"
          title="Produção e eficiência"
          action={
            <Link
              href="/producao"
              className="flex items-center gap-1 text-[11px] font-bold text-forest-700"
            >
              Abrir Produção <ChevronRight size={12} />
            </Link>
          }
        />
        <Link href="/producao" className="mt-4 block">
          <Card className="border-0 p-5 shadow-sm transition hover:shadow-lg">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              <CompactStat
                label="Produção hoje"
                value={`${number.format(v3.industrial.productionTodayKg)} kg`}
                supporting={`${number.format((v3.industrial.productionTodayKg / v3.industrial.targetTodayKg) * 100)}% da meta`}
              />
              <CompactStat
                label="Meta de produção"
                value={`${number.format(v3.industrial.targetTodayKg)} kg`}
              />
              <CompactStat
                label="Eficiência"
                value={`${number.format(v3.industrial.efficiencyPercent)}%`}
                status="on-track"
              />
              <CompactStat
                label="Capacidade utilizada"
                value={`${number.format(v3.industrial.capacityUsedPercent)}%`}
              />
              <CompactStat
                label="Perda de torra"
                value={`${number.format(v3.industrial.roastLossPercent)}%`}
                status="attention"
              />
              <CompactStat
                label="Custo real/kg"
                value={currency.format(v3.industrial.realCostPerKg)}
              />
              <CompactStat
                label="OPs em andamento"
                value={String(v3.industrial.workOrdersInProgress)}
              />
              <CompactStat
                label="OPs atrasadas"
                value={String(v3.industrial.delayedWorkOrders)}
                status="off-track"
              />
            </div>
            <div className="mt-4 grid grid-cols-[1fr_auto] items-center gap-4">
              <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
                <div
                  className="h-full rounded-full bg-[#7065a8]"
                  style={{
                    width: `${(v3.industrial.productionTodayKg / v3.industrial.targetTodayKg) * 100}%`,
                  }}
                />
              </div>
              <p className="text-[10px] text-stone-400">
                Realizado x meta do dia
              </p>
            </div>
          </Card>
        </Link>
      </section>
      <section className="hidden" aria-hidden="true">
        <div>
          <SectionHeading
            eyebrow="Estoque / Suprimentos"
            title="Cobertura e disponibilidade"
            action={
              <Link
                href="/estoque"
                className="text-[11px] font-bold text-forest-700"
              >
                Ver estoque
              </Link>
            }
          />
          <Link href="/estoque" className="mt-4 block">
            <Card className="border-0 p-5 shadow-sm transition hover:shadow-lg">
              <div className="grid gap-3 sm:grid-cols-3">
                <CompactStat
                  label="Café verde disponível"
                  value={`${number.format(v3.inventory.greenCoffeeAvailableKg)} kg`}
                />
                <CompactStat
                  label="Valor do estoque"
                  value={currency.format(v3.inventory.stockValue)}
                />
                <CompactStat
                  label="Produto acabado"
                  value={`${number.format(v3.inventory.finishedGoodsUnits)} un.`}
                />
                <CompactStat
                  label="Cobertura"
                  value={`${v3.inventory.coverageDays} dias`}
                  supporting={`Meta ${v3.inventory.coverageTargetDays} dias`}
                  status="attention"
                />
                <CompactStat
                  label="Lotes em atenção"
                  value={String(v3.inventory.attentionLots)}
                  status="attention"
                />
                <CompactStat
                  label="Estoque crítico"
                  value={String(v3.inventory.criticalItems)}
                  status="off-track"
                />
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-[9px] text-stone-400">
                  <span>Cobertura atual</span>
                  <span>
                    {number.format(
                      (v3.inventory.coverageDays /
                        v3.inventory.coverageTargetDays) *
                        100,
                    )}
                    % da meta
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
                  <div
                    className="h-full rounded-full bg-amber-500"
                    style={{
                      width: `${(v3.inventory.coverageDays / v3.inventory.coverageTargetDays) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </Card>
          </Link>
        </div>
        <div>
          <SectionHeading
            eyebrow="Logística"
            title="Trânsito, compras e expedição"
            action={<Badge tone="neutral">Dados demonstrativos</Badge>}
          />
          <Link
            href="/recebimento"
            className="mt-4 block"
            title="Abrir recebimentos e suprimentos"
          >
            <Card className="border-0 p-5 shadow-sm transition hover:shadow-lg">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <CompactStat
                  label="Containers em trânsito"
                  value={String(v3.logistics.containersInTransit)}
                />
                <CompactStat
                  label="Próximas chegadas"
                  value={String(v3.logistics.nextArrivals)}
                />
                <CompactStat
                  label="Compras em aberto"
                  value={String(v3.logistics.openPurchases)}
                />
                <CompactStat
                  label="Aguardando expedição"
                  value={String(v3.logistics.ordersAwaitingShipment)}
                />
                <CompactStat
                  label="Insumos críticos"
                  value={String(v3.logistics.criticalSupplies)}
                  status="attention"
                />
                <CompactStat
                  label="Embalagens críticas"
                  value={String(v3.logistics.criticalPackaging)}
                  status="off-track"
                />
              </div>
              <p className="mt-4 flex items-center gap-2 text-[9px] text-stone-400">
                <Truck size={11} />
                Contrato preparado para futura API; valores desta área são
                mocks.
              </p>
            </Card>
          </Link>
        </div>
      </section>
      <section className="hidden" aria-hidden="true">
        <SectionHeading
          eyebrow="Comercial"
          title="Clientes e produtos"
          action={
            <button
              onClick={() => setSalesMapOpen(true)}
              className="text-[11px] font-bold text-forest-700"
            >
              Explorar vendas
            </button>
          }
        />
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <button onClick={() => setSalesMapOpen(true)} className="text-left">
            <Card className="h-full border-0 p-5 shadow-sm transition hover:shadow-lg">
              <div className="flex items-center gap-2">
                <Users size={15} className="text-[#4d7b82]" />
                <h3 className="text-sm font-bold">Top clientes</h3>
              </div>
              <Ranking items={v3.topCustomers} kind="customer" />
            </Card>
          </button>
          <Link href="/produtos">
            <Card className="h-full border-0 p-5 shadow-sm transition hover:shadow-lg">
              <div className="flex items-center gap-2">
                <Package size={15} className="text-[#7065a8]" />
                <h3 className="text-sm font-bold">Top produtos</h3>
              </div>
              <Ranking items={v3.topProducts} kind="product" />
            </Card>
          </Link>
        </div>
      </section>
      <section className="hidden" aria-hidden="true">
        <SectionHeading
          eyebrow="Financeiro"
          title="Liquidez e resultado projetado"
          action={
            <Link
              href="/financeiro"
              className="text-[11px] font-bold text-forest-700"
            >
              Abrir Financeiro
            </Link>
          }
        />
        <Link href="/financeiro" className="mt-4 block">
          <Card className="border-0 p-5 shadow-sm transition hover:shadow-lg">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <CompactStat
                label="Caixa"
                value={currency.format(v3.finance.cash)}
              />
              <CompactStat
                label="Contas a receber"
                value={currency.format(v3.finance.receivables)}
              />
              <CompactStat
                label="Contas a pagar"
                value={currency.format(v3.finance.payables)}
                status="attention"
              />
              <CompactStat
                label="Margem"
                value={`${number.format(v3.finance.marginPercent)}%`}
              />
              <CompactStat
                label="Lucro projetado"
                value={currency.format(v3.finance.projectedProfit)}
              />
              <CompactStat
                label="ROI projetado"
                value={`${number.format(v3.finance.projectedRoiPercent)}%`}
                status="attention"
              />
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl bg-[#F7F9F8] px-4 py-2">
              <span className="flex items-center gap-2 text-[10px] text-stone-500">
                <CreditCard size={12} />
                Tendência de caixa
              </span>
              <MiniTrend values={v3.finance.cashTrend} color="text-[#4d7b82]" />
            </div>
          </Card>
        </Link>
      </section>
      <section
        id="atencao-executiva"
        className="order-6 mt-6 grid gap-5 xl:grid-cols-[1.3fr_1fr_.8fr]"
      >
        <div>
          <SectionHeading
            eyebrow="Alta prioridade"
            title="Hoje precisa da sua atenção"
          />
          <Card className="mt-4 overflow-hidden border-0 shadow-sm">
            <div className="divide-y">
              {v3.attention.map((item) => (
                <div
                  key={item.id}
                  className="grid gap-3 p-4 sm:grid-cols-[1fr_150px_85px_150px] sm:items-center"
                >
                  <div>
                    <p className="text-xs font-bold">{item.problem}</p>
                    <p className="mt-1 text-[10px] leading-4 text-stone-500">
                      {item.impact}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase text-stone-400">
                      Impacto
                    </p>
                    <p className="mt-1 text-xs font-bold">
                      {currency.format(item.impactAmount)}
                    </p>
                  </div>
                  <Badge
                    tone={
                      item.priority === "high"
                        ? "danger"
                        : item.priority === "medium"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {item.priority === "high"
                      ? "Alta"
                      : item.priority === "medium"
                        ? "Média"
                        : "Baixa"}
                  </Badge>
                  {item.diagnosticSourceId ? (
                    <button
                      onClick={() => openDiagnostic(item.diagnosticSourceId!)}
                      className="flex items-center justify-end gap-1 text-[10px] font-bold text-forest-700"
                    >
                      {item.actionLabel}
                      <ChevronRight size={11} />
                    </button>
                  ) : (
                    <Link
                      href={item.href}
                      className="flex items-center justify-end gap-1 text-[10px] font-bold text-forest-700"
                    >
                      {item.actionLabel}
                      <ChevronRight size={11} />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div id="bbos-ia">
          <SectionHeading
            eyebrow="Inteligência gerencial"
            title="BBOS IA"
            action={<Badge tone="neutral">Simulação</Badge>}
          />
          <Card className="mt-4 border-0 bg-white p-5 text-[#111514]">
            <p className="text-[9px] leading-4 text-[#626B69]">
              Insights demonstrativos. Não representam análise real até a
              conexão do motor analítico.
            </p>
            <div className="mt-4 space-y-4">
              {v3.aiInsights.map((insight, index) => (
                <div
                  key={insight.id}
                  className="border-t border-[#E7ECEA] pt-4 first:border-0 first:pt-0"
                >
                  <div className="flex gap-3">
                    <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-[#EDF7F5] text-[9px] font-bold text-forest-800">
                      0{index + 1}
                    </span>
                    <div>
                      <p className="text-xs font-bold">{insight.insight}</p>
                      <p className="mt-2 text-[10px] leading-4 text-[#626B69]">
                        <strong className="text-[#111514]">Causa:</strong>{" "}
                        {insight.cause}
                      </p>
                      <p className="mt-1 text-[10px] leading-4 text-[#626B69]">
                        <strong className="text-[#111514]">Impacto:</strong>{" "}
                        {insight.impact}
                      </p>
                      <p className="mt-1 text-[10px] leading-4 text-[#626B69]">
                        <strong className="text-[#111514]">Recomendação:</strong>{" "}
                        {insight.recommendation}
                      </p>
                      <Link
                        href={insight.href}
                        className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-forest-700"
                      >
                        {insight.actionLabel}
                        <ChevronRight size={10} />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div>
          <SectionHeading
            eyebrow="Financeiro"
            title="Resumo"
            action={
              <Link
                href="/financeiro"
                className="text-[11px] font-bold text-forest-700"
              >
                Detalhar
              </Link>
            }
          />
          <Link href="/financeiro" className="mt-4 block">
            <Card className="border-0 p-5 shadow-sm transition hover:shadow-lg">
              <div className="space-y-4">
                {[
                  {
                    label: "Caixa",
                    value: currency.format(v3.finance.cash),
                    trend: [98, 104, 108, 116, 121, 136, 143],
                  },
                  {
                    label: "Contas a receber",
                    value: currency.format(v3.finance.receivables),
                    trend: [320, 338, 342, 356, 365, 378, 384],
                  },
                  {
                    label: "Contas a pagar",
                    value: currency.format(v3.finance.payables),
                    trend: [242, 238, 231, 228, 224, 221, 219],
                  },
                  {
                    label: "Margem projetada",
                    value: `${number.format(v3.finance.marginPercent)}%`,
                    trend: [16.8, 17.1, 17.4, 18, 18.2, 18.5, 18.8],
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between border-t pt-3 first:border-0 first:pt-0"
                  >
                    <div>
                      <p className="text-[10px] text-stone-500">{item.label}</p>
                      <p className="mt-1 text-sm font-bold">{item.value}</p>
                    </div>
                    <MiniTrend values={item.trend} color="text-[#4d7b82]" />
                  </div>
                ))}
              </div>
            </Card>
          </Link>
        </div>
      </section>
      {roiOpen && (
        <RoiDrawer
          roi={data.roi}
          metrics={metrics}
          diagnostic={
            data.diagnostics.find((item) => item.sourceId === "roi") ??
            data.diagnostics[0]!
          }
          onClose={() => setRoiOpen(false)}
        />
      )}{" "}
      {commercialOpen && (
        <CommercialDetailDrawer
          goals={data.goals}
          projections={data.projections}
          onDiagnose={(sourceId) => {
            setCommercialOpen(false);
            openDiagnostic(sourceId);
          }}
          onClose={() => setCommercialOpen(false)}
        />
      )}{" "}
      {diagnostic && (
        <DiagnosticDrawer
          diagnostic={diagnostic}
          onClose={() => setDiagnostic(null)}
        />
      )}{" "}
      {salesMapOpen && (
        <SalesMapDrawer
          root={data.salesMap}
          onClose={() => setSalesMapOpen(false)}
        />
      )}
    </div>
  );
}
