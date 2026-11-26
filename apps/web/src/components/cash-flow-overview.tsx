"use client";

import * as React from "react";
import Link from "next/link";
import type { CashFlowLine, CashFlowTransaction } from "@/lib/finance-cashflow";
import { cashBridge, inflowAging, nextCashDays, niceScale, realizedMonths, type CashPeriod } from "@/lib/cash-flow-view";

/**
 * The approved "Fluxo de caixa" layout: weekly (or daily) chart first, then
 * the four numbers, the bridge to the end of the horizon, the realized months
 * and the next days. Colors follow the BBOS tokens; red is only money going
 * out, amber is money that should already have come in.
 */

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const compact = (value: number) =>
  Math.abs(value) >= 1000 ? `${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : value.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const signed = (value: number) => `${value >= 0 ? "+" : "−"}${money.format(Math.abs(value))}`;

const IN = "var(--bbos-success, #1e7a4f)";
const LATE = "var(--bbos-warning, #9a5b06)";
const OUT = "var(--bbos-danger, #b42318)";
const INK = "var(--bbos-text-primary, #1c2421)";
const card = "rounded-[var(--bbos-radius-card,14px)] border border-[var(--bbos-border)] bg-white";

export function SegmentedControl<T extends string | number>({ options, value, onChange, label }: { options: Array<[T, string]>; value: T; onChange: (value: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex gap-0.5 rounded-xl border border-[var(--bbos-border)] bg-white p-1">
      {options.map(([key, text]) => (
        <button key={String(key)} type="button" aria-pressed={value === key} onClick={() => onChange(key)}
          className={`min-h-9 rounded-lg px-3 text-[13px] font-semibold ${value === key ? "bg-[var(--bbos-nav-active)] text-[var(--bbos-nav-active-text)]" : "text-[var(--bbos-text-secondary)] hover:bg-[var(--bbos-surface-subtle)]"}`}>
          {text}
        </button>
      ))}
    </div>
  );
}

export function CashChart({ periods, minimum, startKnown, daily }: { periods: CashPeriod[]; minimum: number; startKnown: boolean; daily: boolean }) {
  const width = 900;
  const height = 300;
  const left = 64;
  const right = 20;
  const top = 34;
  const plotBottom = 230;
  const values = periods.flatMap((p) => [p.inflow, p.closing, -p.outflow, minimum]);
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const scale = niceScale(Math.max(max, -min));
  // Small outflows only need a short strip below zero, not a whole step.
  const quarter = scale.step / 4;
  const lower = min < 0 ? -Math.ceil(-min / quarter) * quarter : 0;
  const upper = Math.max(scale.step, Math.ceil(max / scale.step) * scale.step);
  const y = (value: number) => top + ((upper - value) / (upper - lower)) * (plotBottom - top);
  const slot = (width - left - right) / Math.max(periods.length, 1);
  const x = (index: number) => left + slot * index + slot / 2;
  const bar = Math.min(44, slot * (daily ? 0.6 : 0.34));
  const ticks: number[] = [];
  for (let value = Math.ceil(lower / scale.step) * scale.step || 0; value <= upper + 0.001; value += scale.step) ticks.push(value);
  const showLabel = (index: number) => !daily || index === periods.length - 1 || periods[index]!.closing === Math.min(...periods.map((p) => p.closing));
  const labelEvery = daily ? Math.ceil(periods.length / 10) : 1;

  return (
    <section className={`${card} p-4 sm:p-5`}>
      <h2 className="flex flex-wrap items-baseline gap-x-2 text-[16.5px] font-semibold">
        Entradas, saídas e saldo {daily ? "por dia" : "por semana"}
        {!startKnown && <span className="text-xs font-normal text-[var(--bbos-text-secondary)]">saldo a partir de R$ 0 até informar o Itaú</span>}
      </h2>
      <div className="mt-2 overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full min-w-[620px]" role="img" aria-label="Entradas e saídas previstas por período e saldo acumulado">
          {ticks.map((value) => (
            <g key={value}>
              <line x1={left} x2={width - right} y1={y(value)} y2={y(value)} stroke={value === 0 ? "#c9d1cb" : "#eef1ed"} strokeWidth={value === 0 ? 1.2 : 1} />
              <text x={left - 8} y={y(value) + 4} textAnchor="end" fontSize="12" fill="var(--bbos-text-secondary)">{compact(value)}</text>
            </g>
          ))}
          {minimum > 0 && (
            <g>
              <line x1={left} x2={width - right} y1={y(minimum)} y2={y(minimum)} stroke={LATE} strokeWidth="1.5" strokeDasharray="5 4" />
              <text x={width - right} y={y(minimum) - 5} textAnchor="end" fontSize="11" fill={LATE}>mínimo {compact(minimum)}</text>
            </g>
          )}
          {periods.map((p, index) => (
            <g key={p.key}>
              {p.inflow > 0 && <rect x={x(index) - bar - 1} y={y(p.inflow)} width={bar} height={y(0) - y(p.inflow)} rx="3" fill={p.overdue ? LATE : IN} />}
              {p.outflow > 0 && <rect x={x(index) + 1} y={y(0)} width={Math.max(bar * 0.5, 6)} height={Math.max(y(-p.outflow) - y(0), 2)} rx="2" fill={OUT} />}
              {index % labelEvery === 0 && <text x={x(index)} y={plotBottom + 22} textAnchor="middle" fontSize={daily ? 11 : 12.5} fontWeight="600" fill={INK}>{p.label}</text>}
              {!daily && (
                <text x={x(index)} y={plotBottom + 40} textAnchor="middle" fontSize="11" fill="var(--bbos-text-secondary)">
                  {[p.inflow ? `+${p.inflow.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}` : "", p.outflow ? `−${p.outflow.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}` : ""].filter(Boolean).join(" · ") || "—"}
                </text>
              )}
            </g>
          ))}
          <polyline fill="none" stroke={INK} strokeWidth="2.2" points={periods.map((p, index) => `${x(index)},${y(p.closing)}`).join(" ")} />
          {periods.map((p, index) => (
            <g key={`dot-${p.key}`}>
              <circle cx={x(index)} cy={y(p.closing)} r={index === periods.length - 1 ? 5 : daily ? 2.5 : 4} fill={index === periods.length - 1 ? INK : "#fff"} stroke={INK} strokeWidth="2" />
              {showLabel(index) && <text x={x(index)} y={y(p.closing) - 10} textAnchor="middle" fontSize={index === periods.length - 1 ? 13 : 11.5} fontWeight="700" fill={p.closing < minimum ? OUT : INK}>{compact(p.closing)}</text>}
            </g>
          ))}
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-[var(--bbos-text-secondary)]">
        <Legend color={IN}>entradas previstas</Legend>
        <Legend color={LATE}>entradas atrasadas</Legend>
        <Legend color={OUT}>saídas previstas</Legend>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-[3px] w-4 rounded" style={{ background: INK }} />saldo acumulado</span>
        {minimum <= 0 && <span>saldo mínimo: defina em Parâmetros</span>}
      </div>
    </section>
  );
}

function Legend({ color, children }: { color: string; children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-sm" style={{ background: color }} />{children}</span>;
}

export function CashNumbers({ lines, cash, startKnown, days, minimum }: { lines: CashFlowLine[]; cash: number; startKnown: boolean; days: number; minimum: number }) {
  const aging = inflowAging(lines);
  const totalIn = Object.values(aging).reduce((sum, value) => sum + value, 0);
  const outLines = lines.filter((line) => line.signedAmount < 0);
  const totalOut = outLines.reduce((sum, line) => sum + line.amount, 0);
  const overdueOut = outLines.filter((line) => line.status === "Vencido").reduce((sum, line) => sum + line.amount, 0);
  const net = totalIn - totalOut;
  const end = cash + net;
  const segments: Array<[keyof typeof aging, string, string]> = [
    ["overdue", LATE, "atrasado"], ["week", IN, "7 dias"], ["fortnight", "#5f9c7f", "8–15"], ["month", "#a9c7b7", "16–30"], ["later", "#d3ddd6", "depois"],
  ];
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
      <Kpi label="Saldo hoje" value={startKnown ? money.format(cash) : "R$ —"} muted={!startKnown}
        detail={startKnown ? (minimum > 0 ? (cash >= minimum ? "acima do saldo mínimo" : `${money.format(minimum - cash)} abaixo do mínimo`) : "saldo realizado no banco") : "Itaú · aguardando saldo inicial"}
        action={startKnown ? undefined : { href: "/financeiro/parametros", text: "Informar saldo →" }} />
      <div className={`${card} p-4`}>
        <p className="text-xs font-semibold uppercase tracking-[.08em] text-[var(--bbos-text-secondary)]">Entradas · {days} dias</p>
        <p className="mt-1.5 text-[26px] font-bold tabular-nums" style={{ color: IN }}>{signed(totalIn)}</p>
        {totalIn > 0 && (
          <>
            <div className="mt-3 flex h-3 overflow-hidden rounded bg-[var(--bbos-surface-subtle)]">
              {segments.map(([key, color]) => aging[key] > 0 && <i key={key} style={{ width: `${(aging[key] / totalIn) * 100}%`, background: color }} />)}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-[var(--bbos-text-secondary)]">
              {segments.map(([key, color, text]) => aging[key] > 0 && <Legend key={key} color={color}>{text} {aging[key].toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</Legend>)}
            </div>
          </>
        )}
      </div>
      <Kpi label={`Saídas · ${days} dias`} value={totalOut ? `−${money.format(totalOut)}` : money.format(0)} color={totalOut ? OUT : undefined}
        badge={overdueOut > 0 ? (overdueOut >= totalOut - 0.005 ? "tudo atrasado" : `${money.format(overdueOut)} atrasado`) : undefined}
        detail={`${outLines.length} lançamento(s)${outLines.some((l) => l.kind === "TAX") ? " · inclui impostos estimados" : ""}`}
        action={overdueOut > 0 ? { href: "/financeiro/pagar", text: "Pagar ou baixar →" } : undefined} />
      <Kpi label={`Saldo em ${days} dias`} value={startKnown ? money.format(end) : signed(net)} color={startKnown && end < minimum ? OUT : undefined}
        detail={startKnown ? `${signed(net)} no período` : "+ o saldo de hoje, quando informado"} />
    </section>
  );
}

function Kpi({ label, value, detail, color, muted, badge, action }: { label: string; value: string; detail: string; color?: string; muted?: boolean; badge?: string; action?: { href: string; text: string } }) {
  return (
    <div className={`${card} p-4`}>
      <p className="text-xs font-semibold uppercase tracking-[.08em] text-[var(--bbos-text-secondary)]">{label}</p>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
        <p className={`text-[26px] font-bold tabular-nums ${muted ? "text-[#9aa3a0]" : ""}`} style={color ? { color } : undefined}>{value}</p>
        {badge && <span className="rounded-full bg-[#fdecea] px-2 py-0.5 text-xs font-bold text-[var(--bbos-danger)]">{badge}</span>}
      </div>
      <p className="mt-2 text-[12.5px] text-[var(--bbos-text-secondary)]">{detail}</p>
      {action && <Link href={action.href} className="mt-2 inline-block text-[13px] font-bold text-[var(--bbos-coffee-green)]">{action.text}</Link>}
    </div>
  );
}

export function CashBridge({ lines, startKnown, cash, days, taxesConfigured }: { lines: CashFlowLine[]; startKnown: boolean; cash: number; days: number; taxesConfigured: boolean }) {
  const b = cashBridge(lines);
  const scale = Math.max(b.lateIn + b.onTimeIn, b.payables + b.purchases + b.taxes, 1);
  const rows: Array<{ label: string; value: number; color: string; start: number; note?: string }> = [
    { label: "A receber atrasado", value: b.lateIn, color: LATE, start: 0 },
    { label: "A receber no prazo", value: b.onTimeIn, color: IN, start: b.lateIn },
    { label: "Contas a pagar", value: -b.payables, color: OUT, start: b.lateIn + b.onTimeIn - b.payables },
    { label: "Compras de café previstas", value: -b.purchases, color: OUT, start: b.lateIn + b.onTimeIn - b.payables - b.purchases, note: b.purchases ? undefined : "nenhuma" },
    { label: "Impostos estimados", value: -b.taxes, color: OUT, start: b.net, note: b.taxes ? undefined : taxesConfigured ? "nenhum" : "configurar" },
  ];
  return (
    <section className={`${card} p-4 sm:p-5`}>
      <h2 className="text-[16.5px] font-semibold">Do saldo de hoje ao saldo em {days} dias</h2>
      <div className="mt-3 grid gap-2.5 text-[13.5px]">
        <BridgeRow label="Saldo hoje (Itaú)" text={startKnown ? money.format(cash) : "a informar"} muted={!startKnown} />
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[minmax(0,150px)_1fr_auto] items-center gap-2.5 sm:grid-cols-[170px_1fr_84px]">
            <span>{row.label}</span>
            <div className="relative h-3.5 rounded bg-[var(--bbos-surface-subtle)]">
              {row.value !== 0 && <i className="absolute inset-y-0 rounded" style={{ left: `${(Math.max(0, row.start) / scale) * 100}%`, width: `${Math.max((Math.abs(row.value) / scale) * 100, 1)}%`, background: row.color }} />}
            </div>
            <b className={`text-right tabular-nums ${row.note ? "text-[12.5px] font-normal text-[var(--bbos-text-secondary)]" : ""}`} style={row.note ? undefined : { color: row.value >= 0 ? IN : OUT }}>
              {row.note ?? `${row.value >= 0 ? "+" : "−"}${Math.abs(row.value).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`}
            </b>
          </div>
        ))}
        <div className="grid grid-cols-[minmax(0,150px)_1fr_auto] items-center gap-2.5 border-t border-[var(--bbos-border)] pt-2.5 font-bold sm:grid-cols-[170px_1fr_84px]">
          <span>{startKnown ? `Saldo em ${days} dias` : `Sobra em ${days} dias`}</span>
          <div className="relative h-3.5 rounded bg-[var(--bbos-surface-subtle)]"><i className="absolute inset-y-0 left-0 rounded" style={{ width: `${Math.max(0, Math.min(100, (b.net / scale) * 100))}%`, background: INK }} /></div>
          <b className="text-right tabular-nums">{startKnown ? money.format(cash + b.net) : `${b.net >= 0 ? "+" : "−"}${Math.abs(b.net).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`}</b>
        </div>
      </div>
    </section>
  );
}

function BridgeRow({ label, text, muted }: { label: string; text: string; muted?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,150px)_1fr_auto] items-center gap-2.5 sm:grid-cols-[170px_1fr_84px]">
      <span>{label}</span><div className="h-3.5 rounded bg-[var(--bbos-surface-subtle)]" />
      <b className={`text-right ${muted ? "text-[12.5px] font-normal text-[var(--bbos-text-secondary)]" : "tabular-nums"}`}>{text}</b>
    </div>
  );
}

export function RealizedMonths({ transactions }: { transactions: CashFlowTransaction[] }) {
  const months = realizedMonths(transactions);
  const max = Math.max(1, ...months.flatMap((m) => [m.inflow, m.outflow]));
  const first = months.find((m) => m.inflow > 0);
  const last = months.at(-1)!;
  const growth = first && first !== last && last.inflow > first.inflow ? last.inflow / first.inflow : null;
  const outShare = months.reduce((s, m) => s + m.outflow, 0) / Math.max(1, months.reduce((s, m) => s + m.inflow, 0));
  return (
    <section className={`${card} p-4 sm:p-5`}>
      <h2 className="flex items-center text-[16.5px] font-semibold">Realizado nos últimos 3 meses
        <Link href="/financeiro/conciliacao" className="ml-auto text-[13px] font-semibold text-[var(--bbos-coffee-green)]">Extrato →</Link></h2>
      <div className="mt-3 grid gap-3">
        {months.map((m) => (
          <div key={m.key} className="grid grid-cols-[84px_1fr_auto] items-center gap-2.5">
            <span className="text-[13.5px] font-semibold">{m.label}</span>
            <div className="grid gap-1">
              <div className="h-2.5 rounded bg-[var(--bbos-surface-subtle)]"><i className="block h-full rounded" style={{ width: `${(m.inflow / max) * 100}%`, background: IN }} /></div>
              <div className="h-2.5 rounded bg-[var(--bbos-surface-subtle)]"><i className="block h-full rounded" style={{ width: `${Math.max((m.outflow / max) * 100, m.outflow ? 0.6 : 0)}%`, background: OUT }} /></div>
            </div>
            <span className="text-right text-[13.5px] tabular-nums"><b style={{ color: IN }}>+{m.inflow.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</b>
              <small className="block text-[11.5px] text-[var(--bbos-text-secondary)]">−{m.outflow.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</small></span>
          </div>
        ))}
      </div>
      {(growth || outShare < 0.05) && (
        <p className="mt-3 rounded-xl bg-[var(--bbos-surface-subtle)] px-3 py-2 text-[12.5px] text-[var(--bbos-text-secondary)]">
          {growth ? <>Recebimentos cresceram <b>{growth.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}×</b> desde {first!.label.toLowerCase()}. </> : null}
          {outShare < 0.05 ? "As saídas aparecem quase zeradas porque as despesas ainda não são lançadas no BBOS." : null}
        </p>
      )}
    </section>
  );
}

export function NextCashDays({ lines }: { lines: CashFlowLine[] }) {
  const days = nextCashDays(lines, 7);
  return (
    <section className={`${card} p-4 sm:p-5`}>
      <h2 className="flex items-center text-[16.5px] font-semibold">Próximos 7 dias, dia a dia
        <Link href="/financeiro/receber" className="ml-auto text-[13px] font-semibold text-[var(--bbos-coffee-green)]">Agenda completa →</Link></h2>
      {!days.length ? <p className="mt-3 text-sm text-[var(--bbos-text-secondary)]">Nada vence nos próximos 7 dias.</p> : (
        <div className="mt-3 grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
          {days.map((day) => (
            <div key={day.key} className={`rounded-xl border p-3 ${day.key === "overdue" ? "border-[#f1c9c4] bg-[#fffafa]" : "border-[var(--bbos-border)]"}`}>
              <div className="mb-1.5 flex justify-between gap-2 text-[13px]">
                <b className={day.key === "overdue" ? "text-[var(--bbos-danger)]" : ""}>{day.label}</b>
                <span className="font-semibold text-[var(--bbos-text-secondary)]">{[day.inflow ? `+${money.format(day.inflow)}` : "", day.outflow ? `−${money.format(day.outflow)}` : ""].filter(Boolean).join(" · ")}</span>
              </div>
              {day.lines.slice(0, 5).map((line) => (
                <div key={line.id} className="flex justify-between gap-2 border-t border-dashed border-[#eef1ed] py-1 text-[12.5px] text-[var(--bbos-text-secondary)]">
                  <span className="min-w-0 truncate">{line.counterparty}</span>
                  <b className="tabular-nums" style={{ color: line.signedAmount >= 0 ? IN : OUT }}>{line.signedAmount >= 0 ? "+" : "−"}{line.amount.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</b>
                </div>
              ))}
              {day.lines.length > 5 && <p className="pt-1 text-[11.5px] text-[var(--bbos-text-secondary)]">e mais {day.lines.length - 5}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
