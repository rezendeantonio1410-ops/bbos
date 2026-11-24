"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { IndustrialDashboard } from "@bbos/shared";
import { ExportButton, KpiStrip, Panel, PendingDataNote, PERIOD_OPTIONS, Segmented, downloadCsv, periodNoun, type PanelPeriod } from "@/components/analytics-ui";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const kilos = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** Typical roast loss band used to flag a batch (shown on the chart). */
const LOSS_BAND = { min: 12, max: 20 };

/** Industrial panel (roast): plan × actual, losses and today's queue. Real data only. */
export default function IndustrialDashboardPage() {
  const [period, setPeriod] = useState<PanelPeriod>("month");
  const [data, setData] = useState<IndustrialDashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setData(null);
    void fetch(`/api/dashboard/industrial?period=${period}`, { credentials: "include", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return (await response.json()) as IndustrialDashboard;
      })
      .then((payload) => !controller.signal.aborted && setData(payload))
      .catch(() => !controller.signal.aborted && setError("Não foi possível carregar o painel industrial agora."));
    return () => controller.abort();
  }, [period]);

  const numbers = data?.numbers;
  const planned = numbers?.plannedKg ?? data?.goals?.[0]?.targetKg ?? 0;
  const actual = numbers?.actualKg ?? data?.goals?.[0]?.actualKg ?? 0;
  const attainment = planned > 0 ? (actual / planned) * 100 : null;
  const sacks = (data?.inventory.greenAvailableKg ?? 0) / 60;
  const queue = (data?.history ?? []).filter((item) => item.status !== "completed").slice(0, 6);

  const exportAll = () => {
    if (!data) return;
    downloadCsv(`painel-industrial-${period}.csv`, [
      ["Indicador", "Valor"],
      ["Planejado (kg)", planned],
      ["Realizado (kg)", actual],
      ["Rendimento (%)", numbers?.yieldPercent ?? ""],
      ["Perda de torra (%)", numbers?.lossPercent ?? ""],
      ["Café verde disponível (kg)", data.inventory.greenAvailableKg],
      [],
      ["Ordem", "Produto", "Planejado (kg)", "Produzido (kg)", "Situação"],
      ...data.history.map((item) => [item.code, item.blend, item.plannedKg, item.producedKg, item.status]),
    ]);
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-4 pb-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[var(--bbos-coffee-green)]">Análises</p>
          <h1 className="text-2xl font-semibold tracking-tight">Painel industrial</h1>
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
            label: `Torrado ${periodNoun[period]}`,
            value: data ? `${kilos.format(actual)} kg` : "…",
            note: attainment == null ? "sem plano no período" : `${pct.format(attainment)}% de ${kilos.format(planned)} kg`,
            tone: attainment != null && attainment < 50 ? "attention" : "neutral",
            href: "/producao",
          },
          { label: "Rendimento", value: numbers?.yieldPercent != null ? `${pct.format(numbers.yieldPercent)}%` : "—", note: "torrado ÷ verde" },
          {
            label: "Perda de torra",
            value: numbers?.lossPercent != null ? `${pct.format(numbers.lossPercent)}%` : "—",
            note: numbers?.lossPercent == null ? "sem lotes concluídos" : numbers.lossPercent > LOSS_BAND.max ? "acima da faixa" : "dentro da faixa",
            tone: numbers?.lossPercent != null && numbers.lossPercent > LOSS_BAND.max ? "attention" : "ok",
          },
          { label: "Ordens abertas", value: data ? String(data.orders.open) : "…", note: data ? `${data.orders.inProgress} em andamento` : undefined, href: "/producao" },
          { label: "Café verde", value: data ? `${kilos.format(data.inventory.greenAvailableKg)} kg` : "…", note: sacks >= 1 ? `≈ ${pct.format(sacks)} sacas de 60 kg` : "menos de 1 saca", href: "/estoque" },
          { label: "Valor do café verde", value: data ? money.format(data.inventory.greenStockValue) : "…", note: "lotes disponíveis" },
        ]}
      />

      <PendingDataNote href="/custos" cta="Fazer o fechamento">
        O custo por kg aparece aqui assim que o primeiro fechamento de custos for concluído.
      </PendingDataNote>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Plano × realizado por semana" action={<span className="text-xs text-[var(--bbos-text-secondary)]">kg torrados</span>}>
          {data ? <WeeklyBars weeks={data.weekly ?? []} /> : <div className="h-[210px] animate-pulse rounded-xl bg-[var(--bbos-surface-subtle)]" aria-hidden />}
        </Panel>
        <Panel title="Fila de torra" action={<Link href="/producao" className="text-xs font-semibold text-[var(--bbos-coffee-green)]">Abrir ordens →</Link>}>
          {queue.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--bbos-text-secondary)]">{data ? "Nenhuma ordem aberta." : "Carregando…"}</p>
          ) : (
            <ul className="divide-y divide-[#eef1ed]">
              {queue.map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-2.5">
                  <span aria-hidden className={`grid size-9 shrink-0 place-items-center rounded-xl ${item.status === "in-progress" ? "bg-[var(--bbos-warning-soft)]" : "bg-[var(--bbos-surface-subtle)]"}`}>
                    {item.status === "in-progress" ? "🔥" : "☕"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{item.status === "in-progress" ? "Torrando · " : ""}{item.blend}</p>
                    <p className="text-xs text-[var(--bbos-text-secondary)]">{item.code} · {kilos.format(item.plannedKg)} kg planejados</p>
                  </div>
                  <Link href="/producao" className="rounded-lg border border-[var(--bbos-border)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--bbos-surface-subtle)]">
                    {item.status === "in-progress" ? "Concluir" : "Iniciar"}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Perda de torra por lote" action={<span className="text-xs text-[var(--bbos-text-secondary)]">faixa {LOSS_BAND.min}–{LOSS_BAND.max}% sombreada</span>}>
          {data ? <LossDots batches={data.batchLosses ?? []} /> : <div className="h-[170px] animate-pulse rounded-xl bg-[var(--bbos-surface-subtle)]" aria-hidden />}
        </Panel>
        <Panel title="Capacidade usada">
          {data ? (
            <div className="flex items-center gap-4">
              <Ring value={data.capacity.utilization} />
              <div>
                <p className="text-2xl font-semibold tabular-nums">{pct.format(data.capacity.utilization)}%</p>
                <p className="text-xs text-[var(--bbos-text-secondary)]">{kilos.format(data.capacity.usedKg)} kg de {kilos.format(data.capacity.totalKg)} kg disponíveis</p>
                <p className="text-xs text-[var(--bbos-text-secondary)]">{kilos.format(Math.max(0, data.capacity.totalKg - data.capacity.usedKg))} kg livres para novos pedidos</p>
              </div>
            </div>
          ) : (
            <div className="h-[100px] animate-pulse rounded-xl bg-[var(--bbos-surface-subtle)]" aria-hidden />
          )}
        </Panel>
      </div>
    </div>
  );
}

function WeeklyBars({ weeks }: { weeks: Array<{ label: string; plannedKg: number; actualKg: number }> }) {
  if (!weeks.length) return <p className="py-8 text-center text-sm text-[var(--bbos-text-secondary)]">Nenhuma ordem de torra no período.</p>;
  const width = 620;
  const height = 210;
  const max = Math.max(1, ...weeks.map((week) => Math.max(week.plannedKg, week.actualKg)));
  const slot = (width - 20) / weeks.length;
  const barW = Math.min(30, slot / 3);
  const y = (value: number) => 170 - (value / max) * 150;
  return (
    <figure>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Plano e realizado por semana" className="h-auto w-full">
        <line x1={10} x2={width - 10} y1={170} y2={170} stroke="#DDE2DC" />
        {weeks.map((week, index) => {
          const x = 10 + index * slot + slot / 2;
          const behind = week.plannedKg > 0 && week.actualKg < week.plannedKg * 0.8;
          return (
            <g key={week.label}>
              <rect x={x - barW - 2} y={y(week.plannedKg)} width={barW} height={170 - y(week.plannedKg)} rx={4} fill="#E3E8E2" />
              <rect x={x + 2} y={y(week.actualKg)} width={barW} height={Math.max(0, 170 - y(week.actualKg))} rx={4} fill={behind ? "#9A5B06" : "#2F6B57"} />
              <text x={x} y={190} textAnchor="middle" fontSize={11} fill="#56615C">sem. {week.label}</text>
            </g>
          );
        })}
      </svg>
      <figcaption className="flex gap-4 text-xs text-[var(--bbos-text-secondary)]">
        <span><i className="mr-1 inline-block size-2.5 rounded-sm bg-[#E3E8E2] align-middle" />planejado</span>
        <span><i className="mr-1 inline-block size-2.5 rounded-sm bg-[#2F6B57] align-middle" />realizado</span>
        <span><i className="mr-1 inline-block size-2.5 rounded-sm bg-[#9A5B06] align-middle" />abaixo de 80% do plano</span>
      </figcaption>
    </figure>
  );
}

function LossDots({ batches }: { batches: Array<{ id: string; code: string; completedAt: string; lossPercent: number }> }) {
  if (!batches.length) return <p className="py-8 text-center text-sm text-[var(--bbos-text-secondary)]">Nenhum lote concluído no período.</p>;
  const width = 620;
  const height = 170;
  const top = 30;
  const max = Math.max(LOSS_BAND.max + 5, ...batches.map((batch) => batch.lossPercent));
  const y = (value: number) => 150 - (value / max) * (150 - top);
  const x = (index: number) => 20 + (batches.length === 1 ? (width - 40) / 2 : (index / (batches.length - 1)) * (width - 40));
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Perda de torra de cada lote" className="h-auto w-full">
      <rect x={10} y={y(LOSS_BAND.max)} width={width - 20} height={y(LOSS_BAND.min) - y(LOSS_BAND.max)} fill="#E9F5EE" />
      <line x1={10} x2={width - 10} y1={150} y2={150} stroke="#DDE2DC" />
      {batches.map((batch, index) => {
        const out = batch.lossPercent < LOSS_BAND.min || batch.lossPercent > LOSS_BAND.max;
        return (
          <circle key={batch.id} cx={x(index)} cy={y(batch.lossPercent)} r={out ? 7 : 5.5} fill={out ? "#9A5B06" : "#2F6B57"}>
            <title>{`${batch.code}: ${pct.format(batch.lossPercent)}% em ${new Date(batch.completedAt).toLocaleDateString("pt-BR")}`}</title>
          </circle>
        );
      })}
    </svg>
  );
}

function Ring({ value }: { value: number }) {
  const circumference = 2 * Math.PI * 34;
  return (
    <svg aria-hidden width={84} height={84} viewBox="0 0 84 84" className="shrink-0">
      <circle cx={42} cy={42} r={34} fill="none" stroke="#E3E8E2" strokeWidth={10} />
      <circle cx={42} cy={42} r={34} fill="none" stroke="#2F6B57" strokeWidth={10} strokeLinecap="round" strokeDasharray={`${(Math.max(0, Math.min(100, value)) / 100) * circumference} ${circumference}`} transform="rotate(-90 42 42)" />
    </svg>
  );
}
