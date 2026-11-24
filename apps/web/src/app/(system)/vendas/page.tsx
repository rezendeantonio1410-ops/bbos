"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SalesSummaryData } from "@bbos/shared";
import { ExportButton, KpiStrip, Panel, PERIOD_OPTIONS, Segmented, downloadCsv, periodNoun, type PanelPeriod } from "@/components/analytics-ui";
import { SalesGeoMap, formatMetric, metricLabel, type SalesMetric } from "@/components/sales-geo-map";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const kilos = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const pct = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, signDisplay: "always" });

const METRIC_OPTIONS = (["revenue", "volumeKg", "orders", "customers"] as SalesMetric[]).map((value) => ({ value, label: metricLabel[value] }));

/** Sales performance with the interactive map (real IBGE outlines). */
export default function VendasPage() {
  const [period, setPeriod] = useState<PanelPeriod>("year");
  const [metric, setMetric] = useState<SalesMetric>("revenue");
  const [summary, setSummary] = useState<SalesSummaryData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setSummary(null);
    void fetch(`/api/dashboard/sales-geography?period=${period}`, { credentials: "include", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return (await response.json()) as SalesSummaryData;
      })
      .then((data) => !controller.signal.aborted && setSummary(data))
      .catch(() => !controller.signal.aborted && setError("Não foi possível carregar as vendas agora."));
    return () => controller.abort();
  }, [period]);

  const exportRows = () => {
    if (!summary) return;
    downloadCsv(`vendas-por-cidade-${period}.csv`, [
      ["Estado", "Cidade", "Valor (R$)", "Pedidos", "Clientes", "Volume (kg)"],
      ...summary.byCity.map((city) => [city.state, city.city, city.revenue, city.orders, city.customers, city.volumeKg]),
      ...(summary.unlocated.orders ? [["—", "Sem cidade no cadastro", summary.unlocated.revenue, summary.unlocated.orders, "", ""]] : []),
    ]);
  };

  const growth = summary?.growthPercent;
  const ranking = summary ? [...summary.byCity].sort((a, b) => b[metric] - a[metric]).slice(0, 8) : [];
  const rankingMax = Math.max(1, ...ranking.map((city) => city[metric]));

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-4 pb-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[var(--bbos-coffee-green)]">Análises</p>
          <h1 className="text-2xl font-semibold tracking-tight">Vendas</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="Período" options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
          <ExportButton onClick={exportRows} />
        </div>
      </header>

      {error && <p role="alert" className="rounded-xl bg-[#fdecea] px-3 py-2 text-sm text-[var(--bbos-danger)]">{error}</p>}

      <KpiStrip
        items={[
          { label: "Receita", value: summary ? money.format(summary.revenue) : "…", spark: summary?.cumulative.map((point) => point.current) },
          {
            label: "Comparado ao período anterior",
            value: growth == null ? "—" : `${pct.format(growth)}%`,
            note: summary ? (growth == null ? "sem vendas no período anterior" : `antes: ${money.format(summary.previousRevenue)}`) : undefined,
            tone: growth == null ? "neutral" : growth >= 0 ? "ok" : "attention",
          },
          { label: "Pedidos", value: summary ? String(summary.orders) : "…", href: "/pedidos" },
          { label: "Ticket médio", value: summary ? money.format(summary.averageTicket) : "…" },
          { label: "Volume", value: summary ? `${kilos.format(summary.volumeKg)} kg` : "…" },
          { label: "Cidades atendidas", value: summary ? String(summary.byCity.length) : "…", note: summary ? `${summary.byState.length} estado(s)` : undefined },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <Panel title="Onde vendemos" action={<Segmented label="O que o mapa mostra" options={METRIC_OPTIONS} value={metric} onChange={setMetric} />}>
          {summary ? (
            <SalesGeoMap summary={summary} metric={metric} />
          ) : (
            <div className="h-[360px] animate-pulse rounded-xl bg-[var(--bbos-surface-subtle)]" aria-hidden />
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="Cidades que mais compram">
            {ranking.length === 0 ? (
              <p className="text-sm text-[var(--bbos-text-secondary)]">{summary ? `Nenhuma venda com cidade ${periodNoun[period]}.` : "Carregando…"}</p>
            ) : (
              <ol className="space-y-2.5">
                {ranking.map((city, index) => (
                  <li key={`${city.state}-${city.city}`} className="grid grid-cols-[18px_1fr_auto] items-center gap-2 text-sm">
                    <span className="text-xs text-[var(--bbos-text-secondary)]">{index + 1}</span>
                    <span className="min-w-0">
                      <span className="block truncate">{city.city} <span className="text-[11px] text-[var(--bbos-text-secondary)]">{city.state}</span></span>
                      <span className="mt-1 block h-1.5 rounded-full bg-[#eef1ed]">
                        <span className="block h-full rounded-full bg-[var(--bbos-coffee-green)]" style={{ width: `${(city[metric] / rankingMax) * 100}%` }} />
                      </span>
                    </span>
                    <b className="text-right text-xs tabular-nums">{formatMetric(metric, city[metric])}</b>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
          <Panel title="Quem mais comprou" action={<Link href="/clientes" className="text-xs font-semibold text-[var(--bbos-coffee-green)]">Clientes →</Link>}>
            {summary?.topCustomers.length ? (
              <ul className="space-y-2 text-sm">
                {summary.topCustomers.map((customer) => (
                  <li key={customer.id} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate">{customer.name}</span>
                    <span className="shrink-0 text-xs tabular-nums text-[var(--bbos-text-secondary)]">
                      {customer.orders} ped. · <b className="text-[var(--bbos-text-primary)]">{money.format(customer.revenue)}</b>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--bbos-text-secondary)]">{summary ? `Sem vendas ${periodNoun[period]}.` : "Carregando…"}</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
