"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ExecutiveDashboard } from "@bbos/shared";
import { ExportButton, KpiStrip, Panel, PendingDataNote, PERIOD_OPTIONS, Segmented, downloadCsv, periodNoun, type PanelPeriod } from "@/components/analytics-ui";
import { SalesGeoMap } from "@/components/sales-geo-map";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const kilos = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

type HomeFigures = {
  productionActualKg: number;
  productionPlannedKg: number;
  overdueOrders: number;
  pendingLab: number;
  roastedStock?: { physicalKg: number };
};

/**
 * Executive panel (decide): real figures only. Indicators without a data source
 * become one line saying what is missing instead of an empty card.
 */
export default function ExecutiveDashboardPage() {
  const [period, setPeriod] = useState<PanelPeriod>("month");
  const [data, setData] = useState<ExecutiveDashboard | null>(null);
  const [home, setHome] = useState<HomeFigures | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setData(null);
    void fetch(`/api/dashboard/executive?period=${period}`, { credentials: "include", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return (await response.json()) as ExecutiveDashboard;
      })
      .then((payload) => !controller.signal.aborted && setData(payload))
      .catch(() => !controller.signal.aborted && setError("Não foi possível carregar o painel agora."));
    return () => controller.abort();
  }, [period]);

  useEffect(() => {
    void fetch("/api/dashboard/home", { credentials: "include", cache: "no-store" })
      .then(async (response) => (response.ok ? ((await response.json()) as HomeFigures) : null))
      .then(setHome)
      .catch(() => setHome(null));
  }, []);

  const summary = data?.summary;
  const numbers = data?.numbers;
  const overdueShare = numbers && numbers.openReceivables > 0 ? (numbers.overdueReceivables / numbers.openReceivables) * 100 : 0;
  const roastShare = home && home.productionPlannedKg > 0 ? (home.productionActualKg / home.productionPlannedKg) * 100 : null;
  const coffeeStock = (numbers?.greenCoffeeKg ?? 0) + (home?.roastedStock?.physicalKg ?? 0);
  const hasMargin = Boolean(data?.salesMap?.hasMargin);

  const exportAll = () => {
    if (!summary || !numbers) return;
    downloadCsv(`painel-executivo-${period}.csv`, [
      ["Indicador", "Valor"],
      ["Receita (R$)", summary.revenue],
      ["Receita do período anterior (R$)", summary.previousRevenue],
      ["Pedidos", summary.orders],
      ["Ticket médio (R$)", summary.averageTicket],
      ["A receber (R$)", numbers.openReceivables],
      ["A receber vencido (R$)", numbers.overdueReceivables],
      ["A pagar (R$)", numbers.openPayables],
      ["Café verde (kg)", numbers.greenCoffeeKg],
      [],
      ["Cliente", "Receita (R$)", "Pedidos"],
      ...summary.topCustomers.map((customer) => [customer.name, customer.revenue, customer.orders]),
    ]);
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-4 pb-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[var(--bbos-coffee-green)]">Análises</p>
          <h1 className="text-2xl font-semibold tracking-tight">Painel executivo</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="Período" options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
          <ExportButton onClick={exportAll} />
        </div>
      </header>

      {error && <p role="alert" className="rounded-xl bg-[#fdecea] px-3 py-2 text-sm text-[var(--bbos-danger)]">{error}</p>}

      <KpiStrip
        items={[
          {
            label: "Receita",
            value: summary ? money.format(summary.revenue) : "…",
            spark: summary?.cumulative.map((point) => point.current),
            note: summary?.growthPercent != null ? `${summary.growthPercent >= 0 ? "+" : ""}${pct.format(summary.growthPercent)}% vs período anterior` : undefined,
            tone: summary?.growthPercent != null ? (summary.growthPercent >= 0 ? "ok" : "attention") : "neutral",
            href: "/vendas",
          },
          { label: "Pedidos", value: summary ? String(summary.orders) : "…", note: summary ? `ticket ${money.format(summary.averageTicket)}` : undefined, href: "/pedidos" },
          {
            label: "A receber",
            value: numbers ? money.format(numbers.openReceivables) : "…",
            note: numbers ? (numbers.overdueReceivables > 0 ? `${money.format(numbers.overdueReceivables)} vencidos` : "nada vencido") : undefined,
            tone: numbers && numbers.overdueReceivables > 0 ? "critical" : "ok",
            href: "/financeiro/receber",
          },
          { label: "A pagar", value: numbers ? money.format(numbers.openPayables) : "…", note: "em aberto", href: "/financeiro/pagar" },
          { label: "Estoque de café", value: numbers ? `${kilos.format(coffeeStock)} kg` : "…", note: "verde + torrado", href: "/estoque" },
          {
            label: "Torra do mês",
            value: home ? `${kilos.format(home.productionActualKg)} kg` : "…",
            note: home && home.productionPlannedKg > 0 ? `de ${kilos.format(home.productionPlannedKg)} kg planejados` : "sem plano no mês",
            tone: roastShare != null && roastShare < 50 ? "attention" : "neutral",
            href: "/dashboard-industrial",
          },
        ]}
      />

      {!hasMargin && (
        <PendingDataNote href="/custos" cta="Fazer o fechamento">
          Lucro, margem e ROI aparecem aqui assim que o primeiro fechamento de custos for concluído.
        </PendingDataNote>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Receita acumulada × período anterior" action={<span className="text-xs text-[var(--bbos-text-secondary)]">{periodNoun[period]}</span>}>
          {summary ? <CumulativeChart points={summary.cumulative} /> : <div className="h-[200px] animate-pulse rounded-xl bg-[var(--bbos-surface-subtle)]" aria-hidden />}
        </Panel>
        <Panel title="Quem mais comprou" action={<Link href="/vendas" className="text-xs font-semibold text-[var(--bbos-coffee-green)]">Vendas →</Link>}>
          {summary?.topCustomers.length ? (
            <ol className="space-y-2.5">
              {summary.topCustomers.map((customer) => (
                <li key={customer.id} className="grid grid-cols-[minmax(0,140px)_1fr_auto] items-center gap-3 text-sm">
                  <span className="truncate">{customer.name}</span>
                  <span className="h-2.5 rounded-full bg-[#eef1ed]">
                    <span className="block h-full rounded-full bg-[var(--bbos-coffee-green)]" style={{ width: `${(customer.revenue / (summary.topCustomers[0]?.revenue || 1)) * 100}%` }} />
                  </span>
                  <b className="text-right text-xs tabular-nums">{money.format(customer.revenue)}</b>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-[var(--bbos-text-secondary)]">{summary ? `Sem vendas ${periodNoun[period]}.` : "Carregando…"}</p>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Onde vendemos" action={<Link href="/vendas" className="text-xs font-semibold text-[var(--bbos-coffee-green)]">Mapa completo →</Link>}>
          {summary ? <SalesGeoMap summary={summary} metric="revenue" compact /> : <div className="h-[300px] animate-pulse rounded-xl bg-[var(--bbos-surface-subtle)]" aria-hidden />}
        </Panel>
        <Panel title="Saúde da operação">
          <div className="grid grid-cols-2 gap-3">
            <HealthTile href="/financeiro/receber" label="Inadimplência" value={numbers ? `${pct.format(overdueShare)}%` : "…"} note="do a receber está vencido" tone={overdueShare > 20 ? "attention" : "ok"} />
            <HealthTile href="/producao" label="Torra × plano" value={roastShare == null ? "—" : `${pct.format(roastShare)}%`} note="no mês" tone={roastShare != null && roastShare < 50 ? "attention" : "ok"} />
            <HealthTile href="/pedidos?filtro=atrasados" label="Expedição" value={home ? String(home.overdueOrders) : "…"} note="pedidos com prazo vencido" tone={home?.overdueOrders ? "critical" : "ok"} />
            <HealthTile href="/laboratorio" label="Qualidade" value={home ? String(home.pendingLab) : "…"} note="lotes aguardando análise" tone={home?.pendingLab ? "attention" : "ok"} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function HealthTile({ href, label, value, note, tone }: { href: string; label: string; value: string; note: string; tone: "ok" | "attention" | "critical" }) {
  const color = tone === "critical" ? "text-[var(--bbos-danger)]" : tone === "attention" ? "text-[var(--bbos-warning)]" : "text-[var(--bbos-success)]";
  return (
    <Link href={href} className="rounded-xl bg-[var(--bbos-surface-subtle)] p-3 text-center transition hover:bg-[#eef3ee]">
      <span className="block text-xs text-[var(--bbos-text-secondary)]">{label}</span>
      <span className={`mt-1 block text-2xl font-semibold tabular-nums ${color}`}>{value}</span>
      <span className="block text-[11px] text-[var(--bbos-text-secondary)]">{note}</span>
    </Link>
  );
}

/** Cumulative revenue now (solid) against the previous period (dashed). */
function CumulativeChart({ points }: { points: Array<{ day: number; current: number; previous: number }> }) {
  const width = 620;
  const height = 210;
  const pad = { left: 8, right: 12, top: 16, bottom: 26 };
  const max = Math.max(1, ...points.map((point) => Math.max(point.current, point.previous)));
  const x = (index: number) => pad.left + (points.length <= 1 ? 0 : (index / (points.length - 1)) * (width - pad.left - pad.right));
  const y = (value: number) => height - pad.bottom - (value / max) * (height - pad.top - pad.bottom);
  const line = (key: "current" | "previous") => points.map((point, index) => `${x(index).toFixed(1)},${y(point[key]).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  if (!last) return <p className="text-sm text-[var(--bbos-text-secondary)]">Sem dados no período.</p>;
  return (
    <figure>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Receita acumulada ${money.format(last.current)}; no mesmo ponto do período anterior ${money.format(last.previous)}`} className="h-auto w-full">
        <line x1={pad.left} x2={width - pad.right} y1={height - pad.bottom} y2={height - pad.bottom} stroke="#DDE2DC" />
        <polyline points={line("previous")} fill="none" stroke="#9CC8B1" strokeWidth={2} strokeDasharray="6 5" />
        <polyline points={line("current")} fill="none" stroke="#2F6B57" strokeWidth={3} strokeLinejoin="round" />
        <circle cx={x(points.length - 1)} cy={y(last.current)} r={5} fill="#2F6B57" />
        <text x={x(0)} y={height - 8} fontSize={11} fill="#56615C">dia 1</text>
        <text x={width - pad.right} y={height - 8} fontSize={11} fill="#56615C" textAnchor="end">dia {last.day}</text>
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-4 text-xs text-[var(--bbos-text-secondary)]">
        <span><i className="mr-1 inline-block h-0.5 w-5 bg-[#2F6B57] align-middle" />Agora: <b className="text-[var(--bbos-text-primary)]">{money.format(last.current)}</b></span>
        <span><i className="mr-1 inline-block h-0.5 w-5 border-t-2 border-dashed border-[#9CC8B1] align-middle" />Período anterior até o mesmo dia: <b className="text-[var(--bbos-text-primary)]">{money.format(last.previous)}</b></span>
      </figcaption>
    </figure>
  );
}
