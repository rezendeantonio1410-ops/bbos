"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  ChevronRight,
  CircleDollarSign,
  Download,
  Factory,
  Gauge,
  Leaf,
  PackageCheck,
  PackageOpen,
  Plus,
  Settings2,
  SlidersHorizontal,
  Target,
  TrendingUp,
  Warehouse,
} from "lucide-react";
import { Badge, Card } from "@bbos/ui";
import type {
  IndustrialMetric,
  PerformanceStatus,
  Period,
  ProductionGoal,
  ProductionHistoryItem,
} from "@bbos/shared";
import { industrialDemoDashboard } from "@/lib/industrial-demo-data";
import { inventoryDemoDashboard } from "@/lib/inventory-demo-data";

const periodOptions: Array<{ key: Period; label: string }> = [
  { key: "day", label: "Dia" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mês" },
  { key: "year", label: "Ano" },
];
const periodLabels: Record<Period, string> = {
  day: "Dia",
  week: "Semana",
  month: "Mês",
  year: "Ano",
};
const metricIcons = [
  Gauge,
  TrendingUp,
  ArrowDownRight,
  Leaf,
  Factory,
  PackageCheck,
  CircleDollarSign,
];
const kg = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});

const statuses: Record<
  PerformanceStatus,
  { label: string; text: string; bg: string; border: string; bar: string }
> = {
  "on-track": {
    label: "Dentro da meta",
    text: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    bar: "bg-emerald-600",
  },
  attention: {
    label: "Atenção",
    text: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    bar: "bg-amber-500",
  },
  "off-track": {
    label: "Abaixo da meta",
    text: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
    bar: "bg-red-600",
  },
};

function Status({
  status,
  compact = false,
}: {
  status: PerformanceStatus;
  compact?: boolean;
}) {
  const style = statuses[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${style.bg} ${style.text}`}
    >
      <span className={`size-1.5 rounded-full ${style.bar}`} />
      {compact ? style.label.split(" ")[0] : style.label}
    </span>
  );
}

function GoalCard({
  goal,
  active,
  onClick,
}: {
  goal: ProductionGoal;
  active: boolean;
  onClick: () => void;
}) {
  const style = statuses[goal.status];
  return (
    <button type="button" onClick={onClick} className="text-left">
      <Card
        className={`h-full p-5 transition hover:-translate-y-0.5 hover:shadow-lg ${active ? `border-2 ${style.border}` : ""}`}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold">{periodLabels[goal.period]}</p>
          <Status status={goal.status} compact />
        </div>
        <div className="mt-5 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-stone-400">
              Realizado
            </p>
            <p className="mt-1 text-xl font-bold">
              {kg.format(goal.actualKg)} kg
            </p>
          </div>
          <p className={`text-lg font-bold ${style.text}`}>
            {goal.attainment.toLocaleString("pt-BR")}%
          </p>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-stone-100">
          <div
            className={`h-full rounded-full ${style.bar}`}
            style={{ width: `${Math.min(goal.attainment, 100)}%` }}
          />
        </div>
        <div className="mt-3 flex justify-between text-xs">
          <span className="text-stone-400">
            Meta {kg.format(goal.targetKg)} kg
          </span>
          <span className={`font-semibold ${style.text}`}>
            {goal.differenceKg > 0 ? "+" : ""}
            {kg.format(goal.differenceKg)} kg
          </span>
        </div>
      </Card>
    </button>
  );
}

function MetricCard({
  item,
  index,
}: {
  item: IndustrialMetric;
  index: number;
}) {
  const Icon = metricIcons[index] ?? Settings2;
  const style = statuses[item.status];
  const favorable =
    item.id === "losses" || item.id === "average-cost"
      ? (item.change ?? 0) <= 0
      : (item.change ?? 0) >= 0;
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-stone-500">{item.label}</p>
        <span
          className={`grid size-8 place-items-center rounded-lg ${style.bg} ${style.text}`}
        >
          <Icon size={16} />
        </span>
      </div>
      <p className="mt-5 text-2xl font-bold tracking-tight">{item.value}</p>
      <div className="mt-2 flex items-center gap-1.5">
        <span
          className={`flex items-center text-xs font-bold ${favorable ? "text-emerald-700" : "text-amber-700"}`}
        >
          {(item.change ?? 0) >= 0 ? (
            <ArrowUpRight size={13} />
          ) : (
            <ArrowDownRight size={13} />
          )}
          {Math.abs(item.change ?? 0).toLocaleString("pt-BR")}%
        </span>
        <span className="truncate text-xs text-stone-400">
          {item.supportingText}
        </span>
      </div>
      {item.status !== "on-track" && (
        <Link
          href="/producao#alertas"
          className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-forest-700"
        >
          Ver causas e ações <ChevronRight size={12} />
        </Link>
      )}
    </Card>
  );
}

function IndustrialKpi({ label, value, reference, change, icon: Icon, status = "on-track", href = "/producao" }: { label: string; value: string; reference: string; change: string; icon: typeof Factory; status?: PerformanceStatus; href?: string }) {
  const style = statuses[status];
  return <Link href={href} className="group min-w-0"><Card className="h-full p-4 transition hover:-translate-y-0.5 hover:shadow-lg"><div className="flex items-start justify-between"><span className="grid size-8 place-items-center rounded-lg bg-[#F0F0ED] text-forest-800"><Icon size={15} strokeWidth={1.7}/></span><span className={`text-[10px] font-bold ${style.text}`}>{change}</span></div><p className="mt-3 truncate text-[11px] font-semibold text-stone-600">{label}</p><p className="mt-1 text-xl font-bold tracking-tight">{value}</p><div className="mt-2 flex items-end justify-between gap-2"><p className="truncate text-[10px] text-stone-500">{reference}</p><svg viewBox="0 0 50 14" className="h-3.5 w-12" aria-hidden="true"><polyline points="1,11 9,9 17,10 25,5 33,7 41,3 49,4" fill="none" stroke="#0D1B1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div></Card></Link>;
}

function ProductionChart() {
  const points = industrialDemoDashboard.productionChart;
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const width = 760;
  const height = 270;
  const margin = { top: 14, right: 16, bottom: 38, left: 58 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maxKg = 2000;
  const ticks = [0, 500, 1000, 1500, 2000];
  const bandWidth = plotWidth / points.length;
  const barWidth = Math.min(28, bandWidth * 0.32);
  const y = (value: number) =>
    margin.top + plotHeight - (value / maxKg) * plotHeight;
  const hovered = hoveredIndex === null ? null : points[hoveredIndex];
  const tooltipLeft =
    hoveredIndex === null
      ? 50
      : ((margin.left + bandWidth * (hoveredIndex + 0.5)) / width) * 100;
  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-[var(--font-manrope)] text-base font-bold">
            Produção planejada x realizada
          </h2>
          <p className="mt-1 text-xs text-stone-500">
            Volume diário em quilogramas
          </p>
        </div>
        <div className="flex gap-5 text-[13px] font-medium text-[#687371]">
          <span className="flex items-center gap-2">
            <span className="size-2.5 rounded-sm bg-[#C8CFCD]" />
            Planejado
          </span>
          <span className="flex items-center gap-2">
            <span className="size-2.5 rounded-sm bg-[#0D1B1E]" />
            Realizado
          </span>
        </div>
      </div>
      <div className="mt-6 overflow-x-auto pb-1">
        <div className="relative min-w-[680px]">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-[270px] w-full"
            role="img"
            aria-label="Gráfico de barras agrupadas da produção planejada e realizada por dia"
          >
            {ticks.map((tick) => {
              const tickY = y(tick);
              return (
                <g key={tick}>
                  <line
                    x1={margin.left}
                    x2={width - margin.right}
                    y1={tickY}
                    y2={tickY}
                    stroke="#D7DEDC"
                    strokeWidth="1"
                    opacity="0.75"
                  />
                  <text
                    x={margin.left - 10}
                    y={tickY + 4}
                    textAnchor="end"
                    fill="#687371"
                    fontSize="12"
                    fontWeight="500"
                  >
                    {tick === 2000 ? "2.000 kg" : kg.format(tick)}
                  </text>
                </g>
              );
            })}
            {points.map((point, index) => {
              const center = margin.left + bandWidth * (index + 0.5);
              const plannedY = y(point.plannedKg);
              const actualY = y(point.actualKg);
              const active = hoveredIndex === index;
              return (
                <g key={point.label}>
                  {active && (
                    <rect
                      x={margin.left + bandWidth * index + 5}
                      y={margin.top}
                      width={bandWidth - 10}
                      height={plotHeight}
                      rx="8"
                      fill="#F3F6F5"
                    />
                  )}
                  <rect
                    x={center - barWidth - 3}
                    y={plannedY}
                    width={barWidth}
                    height={margin.top + plotHeight - plannedY}
                    rx="3"
                    fill="#C8CFCD"
                  />
                  <rect
                    x={center + 3}
                    y={actualY}
                    width={barWidth}
                    height={Math.max(margin.top + plotHeight - actualY, 2)}
                    rx="3"
                    fill="#0D1B1E"
                  />
                  <text
                    x={center}
                    y={height - 13}
                    textAnchor="middle"
                    fill="#687371"
                    fontSize="12"
                    fontWeight="500"
                  >
                    {point.label.replace(" ago", "")}
                  </text>
                  <rect
                    x={margin.left + bandWidth * index}
                    y={margin.top}
                    width={bandWidth}
                    height={plotHeight + margin.bottom}
                    fill="transparent"
                    className="cursor-pointer"
                    tabIndex={0}
                    role="button"
                    aria-label={`${point.label}: planejado ${kg.format(point.plannedKg)} kg, realizado ${kg.format(point.actualKg)} kg`}
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onFocus={() => setHoveredIndex(index)}
                    onBlur={() => setHoveredIndex(null)}
                  />
                </g>
              );
            })}
          </svg>
          {hovered && (
            <div
              role="tooltip"
              className="pointer-events-none absolute top-2 z-10 min-w-48 -translate-x-1/2 rounded-[10px] border border-[#E1E6E4] bg-white px-3.5 py-3 text-xs shadow-[0_6px_20px_rgba(0,0,0,0.10)]"
              style={{ left: `${Math.max(16, Math.min(84, tooltipLeft))}%` }}
            >
              <p className="font-semibold text-[#0D1B1E]">
                Dia {hovered.label.replace(" ago", "")}
              </p>
              <div className="mt-2 space-y-1 text-[#687371]">
                <p>Planejado: <strong className="font-semibold text-[#0D1B1E]">{kg.format(hovered.plannedKg)} kg</strong></p>
                <p>Realizado: <strong className="font-semibold text-[#0D1B1E]">{kg.format(hovered.actualKg)} kg</strong></p>
                <p>Desvio: <strong className="font-semibold text-[#0D1B1E]">{hovered.actualKg - hovered.plannedKg > 0 ? "+" : ""}{kg.format(hovered.actualKg - hovered.plannedKg)} kg</strong></p>
                <p>Variação: <strong className="font-semibold text-[#0D1B1E]">{hovered.plannedKg ? (((hovered.actualKg - hovered.plannedKg) / hovered.plannedKg) * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "0,0"}%</strong></p>
              </div>
            </div>
          )}
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-[#687371]">
        Comparativo entre o volume planejado e o volume efetivamente produzido
        por dia.
      </p>
    </Card>
  );
}

function HistoryStatus({
  status,
}: {
  status: ProductionHistoryItem["status"];
}) {
  if (status === "completed") return <Badge tone="success">Concluída</Badge>;
  if (status === "in-progress")
    return <Badge tone="warning">Em andamento</Badge>;
  return <Badge tone="neutral">Aberta</Badge>;
}

function historyCatalog(item: ProductionHistoryItem) {
  const name = item.blend.toLocaleLowerCase("pt-BR");
  if (["caramelo", "doce de leite", "áureo"].some((product) => name.includes(product))) return { line: "Clássicos", product: item.blend, sku: "—" };
  if (name.includes("melpo")) return { line: "Gourmet", product: item.blend, sku: "—" };
  if (name.includes("raro")) return { line: "Raros", product: item.blend, sku: "—" };
  if (name.includes("épico")) return { line: "Épicos", product: item.blend, sku: "—" };
  return { line: "Não classificada", product: item.blend, sku: "—" };
}

export default function IndustrialDashboardPage() {
  const [period, setPeriod] = useState<Period>("month");
  const [costSummary, setCostSummary] = useState<{ metrics: { energy: number; gas: number; maintenance: number; averageCostPerKg: number } } | null>(null);
  useEffect(() => { void fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api"}/costing/summary`).then((response) => response.ok ? response.json() : null).then(setCostSummary).catch(() => undefined); }, []);
  const data = industrialDemoDashboard;
  const greenAvailableKg = inventoryDemoDashboard.lots
    .filter((lot) => lot.status !== "blocked")
    .reduce((sum, lot) => sum + lot.availableQuantityKg, 0);
  const activeGoal =
    data.goals.find((goal) => goal.period === period) ?? data.goals[2]!;
  const lineMatchers = [
    { name: "Raros", match: (name: string) => name.toLocaleLowerCase("pt-BR").includes("raro") },
    { name: "Épicos", match: (name: string) => name.toLocaleLowerCase("pt-BR").includes("épico") },
    { name: "Clássicos", match: (name: string) => ["caramelo", "doce de leite", "áureo"].some((product) => name.toLocaleLowerCase("pt-BR").includes(product)) },
    { name: "Gourmet", match: (name: string) => name.toLocaleLowerCase("pt-BR").includes("melpo") },
  ];
  const productionByLine = lineMatchers.map((line) => {
    const orders = data.history.filter((item) => line.match(item.blend));
    const producedKg = orders.reduce((sum, item) => sum + item.producedKg, 0);
    const plannedKg = orders.reduce((sum, item) => sum + item.plannedKg, 0);
    const costBase = orders.filter((item) => item.costPerKg > 0);
    return { name: line.name, producedKg, yieldPercent: plannedKg ? producedKg / plannedKg * 100 : 0, averageCost: costBase.length ? costBase.reduce((sum, item) => sum + item.costPerKg, 0) / costBase.length : 0 };
  });
  const classifiedProduction = productionByLine.reduce((sum, line) => sum + line.producedKg, 0);
  return (
    <div className="industrial-dashboard mx-auto max-w-[1600px]">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.14em] text-forest-700">
            <Factory size={14} />
            Cockpit Industrial
          </div>
          <h1 className="font-[var(--font-manrope)] text-3xl font-bold tracking-tight text-stone-950">
            Dashboard Industrial
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            Visão consolidada da operação industrial
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2"><div className="flex w-fit rounded-xl border border-[#E7E7E3] bg-white p-1">
          {periodOptions.map((item) => (
            <button
              key={item.key}
              onClick={() => setPeriod(item.key)}
              aria-pressed={period === item.key}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${period === item.key ? "bg-[#F0F3F2] text-stone-950" : "bg-white text-stone-500 hover:bg-[#F7F9F8] hover:text-stone-900"}`}
            >
              {item.label}
            </button>
          ))}
        </div><button className="flex items-center gap-2 rounded-xl border border-[#E7E7E3] bg-white px-3 py-2.5 text-xs font-semibold text-stone-700 hover:bg-[#F7F9F8]"><SlidersHorizontal size={14}/>Filtros</button><button className="flex items-center gap-2 rounded-xl border border-[#E7E7E3] bg-white px-3 py-2.5 text-xs font-semibold text-stone-700 hover:bg-[#F7F9F8]"><Download size={14}/>Exportar</button></div>
      </div>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <IndustrialKpi label="Produção realizada" value={`${kg.format(activeGoal.actualKg)} kg`} reference={`${activeGoal.attainment.toLocaleString("pt-BR")}% da meta`} change="+6,8%" icon={Factory}/>
        <IndustrialKpi label="Produção planejada" value={`${kg.format(activeGoal.targetKg)} kg`} reference={periodLabels[period]} change="Meta" icon={Target}/>
        <IndustrialKpi label="Eficiência" value={data.metrics[0]?.value ?? "—"} reference={data.metrics[0]?.supportingText ?? ""} change="+2,4%" icon={Gauge}/>
        <IndustrialKpi label="Rendimento" value={data.metrics[1]?.value ?? "—"} reference={data.metrics[1]?.supportingText ?? ""} change="+0,8%" icon={TrendingUp} status="attention"/>
        <IndustrialKpi label="Perda de torra" value={data.metrics[2]?.value ?? "—"} reference={data.metrics[2]?.supportingText ?? ""} change="-0,4%" icon={ArrowDownRight}/>
        <IndustrialKpi label="Custo médio/kg" value={data.metrics[6]?.value ?? "—"} reference={data.metrics[6]?.supportingText ?? ""} change="-1,6%" icon={CircleDollarSign} href="/custos"/>
        <IndustrialKpi label="OPs em andamento" value={String(data.orders.inProgress)} reference={`${data.orders.open} abertas`} change="Operação" icon={Boxes}/>
      </section>

      <section className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/recebimento"
          className="flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-xs font-bold text-forest-800 shadow-sm transition hover:bg-forest-50"
        >
          <Plus size={15} />
          Novo recebimento
        </Link>
        <Link
          href="/producao"
          className="flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-xs font-bold text-stone-700 shadow-sm transition hover:bg-stone-50"
        >
          <Factory size={15} />
          Ver Produção
        </Link>
        <Link
          href="/estoque"
          className="flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-xs font-bold text-stone-700 shadow-sm transition hover:bg-stone-50"
        >
          <Warehouse size={15} />
          Estoque
        </Link>
        <Link
          href="/estoque"
          className="flex items-center gap-2 rounded-xl border border-[#E7E7E3] bg-white px-4 py-2.5 text-xs font-bold text-amber-800 hover:bg-[#F7F9F8]"
        >
          <AlertTriangle size={15} />
          Lotes em atenção
        </Link>
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-3">
        <Link href="/estoque">
          <Card className="p-4 transition hover:-translate-y-0.5">
            <p className="text-[11px] text-stone-500">Café verde disponível</p>
            <p className="mt-2 text-lg font-bold">
              {kg.format(greenAvailableKg)} kg
            </p>
          </Card>
        </Link>
        <Link href="/estoque">
          <Card className="p-4 transition hover:-translate-y-0.5">
            <p className="text-[11px] text-stone-500">Cobertura</p>
            <p className="mt-2 text-lg font-bold text-amber-700">
              {inventoryDemoDashboard.summary.estimatedCoverageDays} dias
            </p>
          </Card>
        </Link>
        <Link href="/estoque">
          <Card className="p-4 transition hover:-translate-y-0.5">
            <p className="text-[11px] text-stone-500">Valor do estoque</p>
            <p className="mt-2 text-lg font-bold">
              {currency.format(
                inventoryDemoDashboard.summary.financialStockValue,
              )}
            </p>
          </Card>
        </Link>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="relative overflow-hidden bg-white p-6 text-[#111514]">
          <div className="absolute -right-16 -top-16 size-52 rounded-full border-[34px] border-[#F7F9F8]" />
          <div className="relative">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-forest-700">
                  <Target size={15} />
                  Produção — {periodLabels[period]}
                </div>
                <p className="mt-5 text-4xl font-bold tracking-tight">
                  {kg.format(activeGoal.actualKg)} kg
                </p>
                <p className="mt-2 text-sm text-stone-600">
                  realizados de {kg.format(activeGoal.targetKg)} kg planejados
                </p>
              </div>
              <Status status={activeGoal.status} />
            </div>
            <div className="mt-8 h-2 overflow-hidden rounded-full bg-[#E7E7E3]">
              <div
                className="h-full rounded-full bg-coffee-400"
                style={{ width: `${Math.min(activeGoal.attainment, 100)}%` }}
              />
            </div>
            <div className="mt-3 flex justify-between text-xs">
              <span className="text-stone-500">Atingimento</span>
              <span className="font-bold">
                {activeGoal.attainment.toLocaleString("pt-BR")}%
              </span>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.14em] text-forest-700">
                Capacidade produtiva
              </p>
              <h2 className="mt-1 text-base font-bold">Utilização mensal</h2>
            </div>
            <span className="grid size-10 place-items-center rounded-xl bg-forest-50 text-forest-700">
              <Gauge size={19} />
            </span>
          </div>
          <p className="mt-6 text-3xl font-bold tracking-tight">
            {data.capacity.utilization.toLocaleString("pt-BR")}%
          </p>
          <p className="mt-2 text-xs text-stone-500">
            {kg.format(data.capacity.usedKg)} kg de{" "}
            {kg.format(data.capacity.totalKg)} kg disponíveis
          </p>
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full rounded-full bg-forest-800"
              style={{ width: `${data.capacity.utilization}%` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-stone-400">
              5.580 kg de capacidade livre
            </span>
            <Status status={data.capacity.status} compact />
          </div>
        </Card>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
        <Card className="p-6">
          <div className="flex items-start justify-between"><div><h2 className="font-[var(--font-manrope)] text-base font-bold">Produção por linha</h2><p className="mt-1 text-xs text-stone-500">Leitura baseada nas OPs identificadas no histórico disponível</p></div><Badge tone="neutral">Período atual</Badge></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {productionByLine.map((line) => { const share = classifiedProduction ? line.producedKg / classifiedProduction * 100 : 0; return <Link href="/producao" key={line.name} className="rounded-xl border border-[#E7E7E3] bg-white p-4 transition hover:bg-[#F7F9F8]"><div className="flex items-center justify-between"><p className="text-sm font-bold">{line.name}</p><span className="text-[10px] font-semibold text-stone-500">{share.toLocaleString("pt-BR",{maximumFractionDigits:1})}%</span></div><p className="mt-3 text-lg font-bold">{kg.format(line.producedKg)} kg</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#E7E7E3]"><div className="h-full rounded-full bg-forest-800" style={{width:`${Math.min(share,100)}%`}}/></div><div className="mt-3 flex justify-between text-[10px] text-stone-500"><span>Rendimento {line.yieldPercent ? `${line.yieldPercent.toLocaleString("pt-BR",{maximumFractionDigits:1})}%` : "sem dados"}</span><span>{line.averageCost ? `${currency.format(line.averageCost)}/kg` : "Custo pendente"}</span></div></Link> })}
          </div>
        </Card>
        <Link href="/custos" className="group"><Card className="h-full p-6 transition hover:-translate-y-0.5 hover:shadow-lg"><div className="flex items-start justify-between"><div><h2 className="font-[var(--font-manrope)] text-base font-bold">Cost Engine</h2><p className="mt-1 text-xs text-stone-500">Resumo industrial — leitura, sem duplicar o módulo</p></div><CircleDollarSign size={18} className="text-forest-700"/></div><div className="mt-5 space-y-4">{[["Energia",costSummary?.metrics.energy??0],["Gás",costSummary?.metrics.gas??0],["Máquina",0],["Manutenção",costSummary?.metrics.maintenance??0]].map(([label,value])=><div key={String(label)} className="flex items-center justify-between border-t border-[#E7E7E3] pt-3 first:border-0 first:pt-0"><span className="text-xs text-stone-600">{label}</span><strong className="text-sm">{currency.format(Number(value))}</strong></div>)}<div className="flex items-center justify-between border-t border-[#E7E7E3] pt-3"><span className="text-xs text-stone-600">Perdas</span><strong className="text-sm">{data.metrics[2]?.value}</strong></div></div><p className="mt-5 inline-flex items-center gap-1 text-[11px] font-bold text-forest-700">Abrir Custos <ChevronRight size={12}/></p></Card></Link>
      </section>

      <section className="mt-6">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-[var(--font-manrope)] text-lg font-bold">
              Metas de produção
            </h2>
            <p className="mt-1 text-xs text-stone-500">
              Planejado x realizado por período
            </p>
          </div>
          <p className="hidden text-xs text-stone-400 sm:block">
            Clique em um período para atualizar o destaque
          </p>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {data.goals.map((goal) => (
            <GoalCard
              key={goal.period}
              goal={goal}
              active={period === goal.period}
              onClick={() => setPeriod(goal.period)}
            />
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.metrics.map((item, index) => (
          <MetricCard key={item.id} item={item} index={index} />
        ))}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-stone-500">
              Ordens de produção
            </p>
            <span className="grid size-8 place-items-center rounded-lg bg-forest-50 text-forest-700">
              <Boxes size={16} />
            </span>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-2xl font-bold">{data.orders.open}</p>
              <p className="mt-1 text-[10px] text-stone-400">Abertas</p>
            </div>
            <div className="border-x">
              <p className="text-2xl font-bold text-amber-700">
                {data.orders.inProgress}
              </p>
              <p className="mt-1 text-[10px] text-stone-400">Em curso</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-700">
                {data.orders.completed}
              </p>
              <p className="mt-1 text-[10px] text-stone-400">Concluídas</p>
            </div>
          </div>
        </Card>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.65fr_1fr]">
        <ProductionChart />
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-[var(--font-manrope)] text-base font-bold">
                Alertas de suprimentos
              </h2>
              <p className="mt-1 text-xs text-stone-500">
                Matéria-prima, insumos e embalagens
              </p>
            </div>
            <AlertTriangle size={18} className="text-amber-600" />
          </div>
          <div className="mt-5 divide-y">
            {data.alerts.map((alert) => {
              const style = statuses[alert.status];
              const Icon =
                alert.category === "raw-material"
                  ? Leaf
                  : alert.category === "packaging"
                    ? PackageOpen
                    : Settings2;
              return (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 py-4 first:pt-1"
                >
                  <span
                    className={`grid size-9 shrink-0 place-items-center rounded-xl ${style.bg} ${style.text}`}
                  >
                    <Icon size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold">{alert.item}</p>
                      <Status status={alert.status} compact />
                    </div>
                    <p className="mt-1 text-xs text-stone-500">
                      {alert.message}
                    </p>
                    <p className="mt-2 text-[11px] text-stone-400">
                      {alert.currentStock} • {alert.coverage}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      <section className="mt-6">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between p-6">
            <div>
              <h2 className="font-[var(--font-manrope)] text-base font-bold">
                Histórico de produção
              </h2>
              <p className="mt-1 text-xs text-stone-500">
                Ordens recentes e seus resultados industriais
              </p>
            </div>
            <button className="flex items-center gap-1 text-xs font-semibold text-forest-700">
              Ver histórico completo <ChevronRight size={14} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] border-t border-[#E7E7E3] text-left">
              <thead className="bg-[#F7F9F8] text-[11px] uppercase tracking-wider text-stone-500">
                <tr>
                  <th className="px-6 py-3 font-semibold">Ordem</th>
                  <th className="px-4 py-3 font-semibold">Linha</th>
                  <th className="px-4 py-3 font-semibold">Produto</th>
                  <th className="px-4 py-3 font-semibold">SKU</th>
                  <th className="px-4 py-3 font-semibold">Planejado</th>
                  <th className="px-4 py-3 font-semibold">Produzido</th>
                  <th className="px-4 py-3 font-semibold">Rendimento</th>
                  <th className="px-4 py-3 font-semibold">Custo/kg</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold">Conclusão</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.history.map((item) => { const catalog = historyCatalog(item); return (
                  <tr key={item.id} className="text-sm hover:bg-[#F7F9F8]">
                    <td className="px-6 py-4 font-semibold"><Link href="/producao" className="hover:text-forest-700">{item.code}</Link></td>
                    <td className="px-4 py-4 text-stone-600">{catalog.line}</td>
                    <td className="px-4 py-4 text-stone-600">{catalog.product}</td>
                    <td className="px-4 py-4 text-stone-600">{catalog.sku}</td>
                    <td className="px-4 py-4 text-stone-600">
                      {kg.format(item.plannedKg)} kg
                    </td>
                    <td className="px-4 py-4 font-medium">
                      {item.producedKg
                        ? `${kg.format(item.producedKg)} kg`
                        : "—"}
                    </td>
                    <td className="px-4 py-4 text-stone-600">
                      {item.yieldPercent
                        ? `${item.yieldPercent.toLocaleString("pt-BR")}%`
                        : "—"}
                    </td>
                    <td className="px-4 py-4 text-stone-600">
                      {item.costPerKg ? currency.format(item.costPerKg) : "—"}
                    </td>
                    <td className="px-4 py-4">
                      <HistoryStatus status={item.status} />
                    </td>
                    <td className="px-6 py-4 text-xs text-stone-400">
                      {item.completedAt ?? "—"}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
}
