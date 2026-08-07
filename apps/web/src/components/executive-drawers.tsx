"use client";

import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  CircleAlert,
  Gauge,
  Lightbulb,
  MapPinned,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import { Badge } from "@bbos/ui";
import type {
  ExecutiveMetric,
  GoalComparison,
  PerformanceDiagnostic,
  PerformanceStatus,
  ResultProjection,
  SalesMapNode,
} from "@bbos/shared";
import { useState } from "react";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const statusStyle: Record<
  PerformanceStatus,
  { label: string; bg: string; text: string }
> = {
  "on-track": {
    label: "Na meta",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
  },
  attention: { label: "Atenção", bg: "bg-amber-50", text: "text-amber-700" },
  "off-track": {
    label: "Abaixo da meta",
    bg: "bg-red-50",
    text: "text-red-700",
  },
};
const levelLabels: Record<SalesMapNode["level"], string> = {
  world: "Mundo",
  country: "País",
  region: "Região",
  state: "Estado",
  city: "Cidade",
  customer: "Cliente",
  product: "Produto",
  order: "Pedido",
};

function DrawerFrame({
  title,
  eyebrow,
  onClose,
  children,
}: {
  title: string;
  eyebrow: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="Fechar painel"
        className="absolute inset-0 bg-forest-950/25 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        className="relative h-full w-full max-w-2xl overflow-y-auto border-l bg-white shadow-2xl"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between border-b bg-white/95 px-6 py-5 backdrop-blur">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.16em] text-forest-700">
              {eyebrow}
            </p>
            <h2 className="mt-1 font-[var(--font-manrope)] text-xl font-bold">
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-xl border p-2 text-stone-500 hover:bg-stone-50"
          >
            <X size={18} />
          </button>
        </header>
        {children}
      </aside>
    </div>
  );
}

export function DiagnosticDrawer({
  diagnostic,
  onClose,
}: {
  diagnostic: PerformanceDiagnostic;
  onClose: () => void;
}) {
  return (
    <DrawerFrame
      title={diagnostic.title}
      eyebrow="Diagnóstico executivo"
      onClose={onClose}
    >
      <div className="p-6">
        <div className="rounded-2xl bg-stone-50 p-5">
          <p className="text-sm leading-6 text-stone-600">
            {diagnostic.summary}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-stone-400">Impacto estimado</p>
              <p className="mt-1 text-xl font-bold text-red-700">
                {currency.format(diagnostic.totalImpactAmount)}
              </p>
            </div>
            <div>
              <p className="text-xs text-stone-400">Impacto percentual</p>
              <p className="mt-1 text-xl font-bold text-red-700">
                {number.format(diagnostic.totalImpactPercent)}%
              </p>
            </div>
          </div>
        </div>
        <section className="mt-7">
          <div className="flex items-center gap-2">
            <CircleAlert size={17} className="text-red-600" />
            <h3 className="text-sm font-bold">Principais fatores</h3>
          </div>
          <div className="mt-4 space-y-3">
            {diagnostic.factors.map((factor) => (
              <div key={factor.id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Badge tone="neutral">{factor.dimension}</Badge>
                    <p className="mt-2 text-sm font-semibold">{factor.label}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      Responsável: {factor.entity}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-700">
                      {currency.format(factor.impactAmount)}
                    </p>
                    <p className="mt-1 text-xs text-red-600">
                      {number.format(factor.impactPercent)}%
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="mt-8">
          <div className="flex items-center gap-2">
            <Lightbulb size={17} className="text-amber-600" />
            <h3 className="text-sm font-bold">Ações recomendadas</h3>
          </div>
          <div className="mt-4 space-y-3">
            {diagnostic.suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className="rounded-xl border border-forest-100 bg-forest-50/50 p-4"
              >
                <p className="text-sm font-semibold">{suggestion.title}</p>
                <p className="mt-1 text-xs leading-5 text-stone-500">
                  {suggestion.description}
                </p>
                <Link
                  href={suggestion.href}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-forest-700"
                >
                  {suggestion.linkLabel}
                  <ArrowRight size={13} />
                </Link>
              </div>
            ))}
          </div>
        </section>
      </div>
    </DrawerFrame>
  );
}

type RoiDetail = {
  current: number;
  target: number;
  difference: number;
  trend: number;
  status: PerformanceStatus;
};

export function RoiDrawer({
  roi,
  metrics,
  diagnostic,
  onClose,
}: {
  roi: RoiDetail;
  metrics: ExecutiveMetric[];
  diagnostic: PerformanceDiagnostic;
  onClose: () => void;
}) {
  const history = [15.2, 15.8, 16.1, 16.9, 17.4, 16.9, roi.current];
  const max = Math.max(...history, roi.target) + 1;
  const min = Math.min(...history) - 1;
  const points = history
    .map(
      (value, index) =>
        `${(index / (history.length - 1)) * 100},${48 - ((value - min) / (max - min)) * 42}`,
    )
    .join(" ");
  const style = statusStyle[roi.status];
  return (
    <DrawerFrame
      title="ROI Industrial"
      eyebrow="Retorno sobre investimento"
      onClose={onClose}
    >
      <div className="p-6">
        <section className="rounded-2xl bg-forest-950 p-6 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-white/55">ROI atual</p>
              <p className="mt-1 text-4xl font-bold">
                {number.format(roi.current)}%
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${style.bg} ${style.text}`}
            >
              {style.label}
            </span>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-4 border-t border-white/10 pt-5">
            <div>
              <p className="text-[10px] uppercase text-white/45">Meta</p>
              <p className="mt-1 text-sm font-bold">
                {number.format(roi.target)}%
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-white/45">Diferença</p>
              <p className="mt-1 text-sm font-bold">
                {roi.difference > 0 ? "+" : ""}
                {number.format(roi.difference)} p.p.
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-white/45">Tendência</p>
              <p className="mt-1 flex items-center text-sm font-bold text-emerald-300">
                <ArrowUpRight size={14} />+{number.format(roi.trend)} p.p.
              </p>
            </div>
          </div>
        </section>
        <section className="mt-7">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-forest-700" />
              <h3 className="text-sm font-bold">Evolução do ROI</h3>
            </div>
            <span className="text-[11px] text-stone-400">Últimos 7 meses</span>
          </div>
          <div className="mt-4 rounded-2xl bg-stone-50 p-4">
            <svg
              viewBox="0 0 100 52"
              className="h-32 w-full overflow-visible"
              role="img"
              aria-label="Evolução do ROI nos últimos sete meses"
            >
              <defs>
                <linearGradient
                  id="roi-detail-fill"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0"
                    stopColor="var(--brand-primary, #1c1b1a)"
                    stopOpacity=".18"
                  />
                  <stop
                    offset="1"
                    stopColor="var(--brand-primary, #1c1b1a)"
                    stopOpacity="0"
                  />
                </linearGradient>
              </defs>
              <line
                x1="0"
                x2="100"
                y1={48 - ((roi.target - min) / (max - min)) * 42}
                y2={48 - ((roi.target - min) / (max - min)) * 42}
                stroke="#d6d3d1"
                strokeDasharray="2 2"
              />
              <polygon
                points={`0,48 ${points} 100,48`}
                fill="url(#roi-detail-fill)"
              />
              <polyline
                points={points}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-forest-800"
              />
              {history.map((value, index) => (
                <circle
                  key={index}
                  cx={(index / (history.length - 1)) * 100}
                  cy={48 - ((value - min) / (max - min)) * 42}
                  r="1.5"
                  fill="white"
                  stroke="currentColor"
                  strokeWidth="1"
                  className="text-forest-800"
                />
              ))}
            </svg>
            <div className="flex justify-between text-[10px] text-stone-400">
              <span>Fev</span>
              <span>Mar</span>
              <span>Abr</span>
              <span>Mai</span>
              <span>Jun</span>
              <span>Jul</span>
              <span>Ago</span>
            </div>
          </div>
        </section>
        <section className="mt-7">
          <div className="flex items-center gap-2">
            <Gauge size={16} className="text-forest-700" />
            <h3 className="text-sm font-bold">Indicadores relacionados</h3>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {metrics.slice(0, 4).map((metric) => (
              <div key={metric.label} className="rounded-xl bg-stone-50 p-4">
                <p className="text-[11px] text-stone-400">{metric.label}</p>
                <p className="mt-1 text-base font-bold">{metric.value}</p>
                <p
                  className={`mt-1 flex items-center text-[10px] font-semibold ${metric.change >= 0 ? "text-emerald-700" : "text-amber-700"}`}
                >
                  {metric.change >= 0 ? (
                    <ArrowUpRight size={11} />
                  ) : (
                    <ArrowDownRight size={11} />
                  )}{" "}
                  {number.format(Math.abs(metric.change))}%
                </p>
              </div>
            ))}
          </div>
        </section>
        <section className="mt-7">
          <div className="flex items-center gap-2">
            <Target size={16} className="text-forest-700" />
            <h3 className="text-sm font-bold">
              Composição e fatores de impacto
            </h3>
          </div>
          <p className="mt-2 text-xs leading-5 text-stone-500">
            {diagnostic.summary}
          </p>
          <div className="mt-4 space-y-3">
            {diagnostic.factors.map((factor) => (
              <div key={factor.id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Badge tone="neutral">{factor.dimension}</Badge>
                    <p className="mt-2 text-sm font-semibold">{factor.label}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      {factor.entity}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-700">
                      {currency.format(factor.impactAmount)}
                    </p>
                    <p className="mt-1 text-xs text-red-600">
                      {number.format(factor.impactPercent)}%
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
          <div className="flex items-center gap-2">
            <CircleAlert size={17} className="text-amber-700" />
            <h3 className="text-sm font-bold">Diagnóstico</h3>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-stone-500">Impacto estimado</p>
              <p className="mt-1 text-lg font-bold text-red-700">
                {currency.format(diagnostic.totalImpactAmount)}
              </p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Impacto percentual</p>
              <p className="mt-1 text-lg font-bold text-red-700">
                {number.format(diagnostic.totalImpactPercent)}%
              </p>
            </div>
          </div>
        </section>
        <section className="mt-8">
          <div className="flex items-center gap-2">
            <Lightbulb size={17} className="text-amber-600" />
            <h3 className="text-sm font-bold">Ver causas e ações</h3>
          </div>
          <div className="mt-4 space-y-3">
            {diagnostic.suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className="rounded-xl border border-forest-100 bg-forest-50/50 p-4"
              >
                <p className="text-sm font-semibold">{suggestion.title}</p>
                <p className="mt-1 text-xs leading-5 text-stone-500">
                  {suggestion.description}
                </p>
                <Link
                  href={suggestion.href}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-forest-700"
                >
                  {suggestion.linkLabel}
                  <ArrowRight size={13} />
                </Link>
              </div>
            ))}
          </div>
        </section>
      </div>
    </DrawerFrame>
  );
}

export function CommercialDetailDrawer({
  goals,
  projections,
  onDiagnose,
  onClose,
}: {
  goals: GoalComparison[];
  projections: ResultProjection[];
  onDiagnose: (sourceId: string) => void;
  onClose: () => void;
}) {
  return (
    <DrawerFrame
      title="Receita x Meta"
      eyebrow="Desempenho comercial"
      onClose={onClose}
    >
      <div className="p-6">
        <section>
          <h3 className="text-sm font-bold">Meta comercial da indústria</h3>
          <p className="mt-1 text-xs text-stone-500">
            Realizado, atingimento e projeção por período.
          </p>
          <div className="mt-4 space-y-3">
            {goals.map((goal) => {
              const style = statusStyle[goal.status];
              const period =
                goal.period === "day"
                  ? "Dia"
                  : goal.period === "week"
                    ? "Semana"
                    : goal.period === "month"
                      ? "Mês"
                      : "Ano";
              return (
                <div key={goal.period} className="rounded-2xl border p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                        {period}
                      </p>
                      <p className="mt-1 text-lg font-bold">
                        {currency.format(goal.actual)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${style.bg} ${style.text}`}
                    >
                      {number.format(goal.attainment)}%
                    </span>
                  </div>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-stone-100">
                    <div
                      className={`h-full rounded-full ${goal.status === "on-track" ? "bg-emerald-600" : goal.status === "attention" ? "bg-amber-500" : "bg-red-600"}`}
                      style={{ width: `${Math.min(goal.attainment, 100)}%` }}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                    <span className="text-stone-500">
                      Meta
                      <br />
                      <strong className="text-stone-800">
                        {currency.format(goal.target)}
                      </strong>
                    </span>
                    <span className="text-stone-500">
                      Diferença
                      <br />
                      <strong className={style.text}>
                        {currency.format(goal.difference)}
                      </strong>
                    </span>
                    <span className="text-stone-500">
                      Projeção
                      <br />
                      <strong className="text-stone-800">
                        {currency.format(goal.closingProjection)}
                      </strong>
                    </span>
                  </div>
                  {goal.status !== "on-track" && (
                    <button
                      onClick={() => onDiagnose(`goal-${goal.period}`)}
                      className="mt-4 flex w-full items-center justify-between border-t pt-3 text-xs font-bold text-forest-700"
                    >
                      Ver causas e ações <ChevronRight size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
        <section className="mt-8">
          <h3 className="text-sm font-bold">Resultado projetado x atual</h3>
          <div className="mt-4 space-y-3">
            {projections.map((item) => {
              const style = statusStyle[item.status];
              return (
                <div key={item.period} className="rounded-2xl bg-stone-50 p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold">
                      {item.period === "month" ? "Mês" : "Ano"}
                    </p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${style.bg} ${style.text}`}
                    >
                      {style.label}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
                    <span className="text-stone-500">
                      Esperado até hoje
                      <br />
                      <strong className="text-sm text-stone-900">
                        {currency.format(item.expectedToDate)}
                      </strong>
                    </span>
                    <span className="text-stone-500">
                      Realizado até hoje
                      <br />
                      <strong className="text-sm text-stone-900">
                        {currency.format(item.actualToDate)}
                      </strong>
                    </span>
                    <span className="text-stone-500">
                      Diferença
                      <br />
                      <strong className={style.text}>
                        {currency.format(item.differenceAmount)} •{" "}
                        {number.format(item.differencePercent)}%
                      </strong>
                    </span>
                    <span className="text-stone-500">
                      Fechamento / meta
                      <br />
                      <strong className="text-stone-900">
                        {currency.format(item.closingProjection)} /{" "}
                        {currency.format(item.target)}
                      </strong>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </DrawerFrame>
  );
}

function StatusPill({ status }: { status: PerformanceStatus }) {
  const style = statusStyle[status];
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  );
}

export function SalesMapDrawer({
  root,
  onClose,
}: {
  root: SalesMapNode;
  onClose: () => void;
}) {
  const [trail, setTrail] = useState<SalesMapNode[]>([root]);
  const current = trail[trail.length - 1]!;
  const openNode = (node: SalesMapNode) =>
    setTrail((previous) => [...previous, node]);
  const goTo = (index: number) =>
    setTrail((previous) => previous.slice(0, index + 1));
  return (
    <DrawerFrame
      title="Mapa de Vendas"
      eyebrow="Análise geográfica"
      onClose={onClose}
    >
      <div className="p-6">
        <div className="flex flex-wrap items-center gap-1 text-xs text-stone-500">
          {trail.map((node, index) => (
            <span key={node.id} className="flex items-center">
              <button
                onClick={() => goTo(index)}
                className={
                  index === trail.length - 1
                    ? "font-bold text-forest-800"
                    : "hover:text-forest-700"
                }
              >
                {node.name}
              </button>
              {index < trail.length - 1 && (
                <ChevronRight size={13} className="mx-1 text-stone-300" />
              )}
            </span>
          ))}
        </div>
        <div
          className={`mt-5 rounded-2xl border p-5 ${current.status === "off-track" ? "border-red-200 bg-red-50/40" : "bg-stone-50"}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-forest-700">
                <MapPinned size={14} />
                {levelLabels[current.level]}
              </div>
              <h3 className="mt-2 text-xl font-bold">{current.name}</h3>
            </div>
            <StatusPill status={current.status} />
          </div>
          {current.status !== "on-track" && (
            <div className="mt-4 rounded-xl bg-white p-3 text-xs text-red-700">
              <strong>Impacto geográfico:</strong>{" "}
              {currency.format(current.revenue - current.target)} abaixo da meta
              deste nível.
            </div>
          )}
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-[10px] uppercase text-stone-400">
                Faturamento
              </p>
              <p className="mt-1 text-sm font-bold">
                {currency.format(current.revenue)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-stone-400">Volume</p>
              <p className="mt-1 text-sm font-bold">
                {number.format(current.volumeKg)} kg
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-stone-400">Margem</p>
              <p className="mt-1 text-sm font-bold">
                {number.format(current.marginPercent)}%
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-stone-400">
                Participação
              </p>
              <p className="mt-1 text-sm font-bold">
                {number.format(current.salesShare)}%
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-stone-400">
                Crescimento
              </p>
              <p
                className={`mt-1 flex items-center text-sm font-bold ${current.growthPercent >= 0 ? "text-emerald-700" : "text-red-700"}`}
              >
                {current.growthPercent >= 0 ? (
                  <ArrowUpRight size={14} />
                ) : (
                  <ArrowDownRight size={14} />
                )}
                {number.format(Math.abs(current.growthPercent))}%
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-stone-400">Meta</p>
              <p className="mt-1 text-sm font-bold">
                {currency.format(current.target)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-stone-400">
                Atingimento
              </p>
              <p
                className={`mt-1 text-sm font-bold ${statusStyle[current.status].text}`}
              >
                {number.format(current.attainment)}%
              </p>
            </div>
          </div>
        </div>
        <section className="mt-7">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">
              {current.children?.length
                ? `Detalhar por ${levelLabels[current.children[0]!.level].toLowerCase()}`
                : "Fim do detalhamento"}
            </h3>
            {current.children?.length && (
              <span className="text-[11px] text-stone-400">
                Clique para aprofundar
              </span>
            )}
          </div>
          {current.children?.length ? (
            <div className="mt-3 space-y-2">
              {current.children.map((node) => (
                <button
                  key={node.id}
                  onClick={() => openNode(node)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition hover:bg-stone-50 ${node.status === "off-track" ? "border-red-200" : ""}`}
                >
                  <span
                    className={`grid size-9 shrink-0 place-items-center rounded-xl ${statusStyle[node.status].bg} ${statusStyle[node.status].text}`}
                  >
                    <MapPinned size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">
                        {node.name}
                      </p>
                      <StatusPill status={node.status} />
                    </div>
                    <p className="mt-1 text-xs text-stone-400">
                      {currency.format(node.revenue)} •{" "}
                      {number.format(node.attainment)}% da meta • margem{" "}
                      {number.format(node.marginPercent)}%
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-stone-300" />
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-dashed bg-stone-50 py-8 text-center">
              <p className="text-sm font-semibold">
                Nível {levelLabels[current.level]} selecionado
              </p>
              <p className="mt-1 text-xs text-stone-400">
                Não há registros subordinados neste dado demonstrativo.
              </p>
            </div>
          )}
        </section>
      </div>
    </DrawerFrame>
  );
}
