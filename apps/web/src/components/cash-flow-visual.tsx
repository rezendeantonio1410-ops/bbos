"use client";

import { useMemo, useState } from "react";
import { bucketCashFlow, groupTotals, type CashFlowLine } from "@/lib/finance-cashflow";

/* Colors validated for color-blind separation (dataviz validator): blue = money in,
   red-orange = money out; balance in ink; minimum in critical red, always labeled. */
const IN = "#2a78d6";
const OUT = "#c9452b";
const INK = "#1c2420";
const CRITICAL = "#b42318";
const GRID = "#e7e9e4";
const MUTED = "#6b7570";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const compact = (value: number) => {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1_000) return `${sign}R$ ${(abs / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: abs >= 10_000 ? 0 : 1 })} mil`;
  return `${sign}R$ ${abs.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
};
const dayMonth = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

/** Round axis step (1, 2, 2.5, 5 × 10^n). */
function niceStep(range: number, ticks: number) {
  const raw = range / ticks;
  const power = 10 ** Math.floor(Math.log10(raw || 1));
  const unit = [1, 2, 2.5, 5, 10].find((n) => n * power >= raw) ?? 10;
  return unit * power;
}

export function CashFlowVisual({ lines, cash, minimum }: { lines: CashFlowLine[]; cash: number; minimum: number }) {
  const [granularity, setGranularity] = useState<"week" | "month">("week");
  const [hover, setHover] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const buckets = useMemo(
    () => bucketCashFlow(lines, { cash, granularity, periods: granularity === "week" ? 13 : 6 }),
    [lines, cash, granularity],
  );

  const W = 900, LEFT = 74, RIGHT = 16;
  const TOP = 26, BAL_H = 170, GAP = 52, FLOW_H = 130, AXIS = 26;
  const H = TOP + BAL_H + GAP + FLOW_H + AXIS;
  const col = (W - LEFT - RIGHT) / buckets.length;
  const cx = (i: number) => LEFT + col * i + col / 2;

  const balances = [cash, ...buckets.map((b) => b.closing)];
  const lowest = Math.min(...balances);
  const highest = Math.max(...balances, minimum);
  const floor = Math.min(0, lowest, minimum > 0 ? minimum * 0.8 : 0);
  const balStep = niceStep(highest - floor || 1, 4);
  const balMin = Math.floor(floor / balStep) * balStep;
  const balMax = Math.ceil((highest * 1.05) / balStep) * balStep || balStep;
  const yBal = (v: number) => TOP + ((balMax - v) * BAL_H) / (balMax - balMin);
  const balTicks: number[] = [];
  for (let v = balMin; v <= balMax + 0.01; v += balStep) balTicks.push(v);

  const flowMax = Math.max(1, ...buckets.map((b) => Math.max(b.inflow, b.outflow)));
  const flowStep = niceStep(flowMax, 4);
  const flowLim = Math.ceil(flowMax / flowStep) * flowStep;
  const flowTop = TOP + BAL_H + GAP;
  const zero = flowTop + FLOW_H / 2;
  const yFlow = (v: number) => zero - (v * (FLOW_H / 2)) / flowLim;
  const barW = Math.min(26, col * 0.46);

  const lowestIndex = buckets.reduce((best, b, i) => (b.closing < buckets[best]!.closing ? i : best), 0);
  const points = [[LEFT, yBal(cash)] as const, ...buckets.map((b, i) => [cx(i), yBal(b.closing)] as const)];
  const shown = selected ?? hover;
  const active = shown !== null ? buckets[shown] : null;
  const detail = selected !== null ? buckets[selected] : null;
  const totalIn = buckets.reduce((sum, b) => sum + b.inflow, 0);
  const totalOut = buckets.reduce((sum, b) => sum + b.outflow, 0);

  const bar = (x: number, y0: number, y1: number, fill: string, up: boolean) => {
    const h = Math.abs(y1 - y0);
    if (h < 0.5) return null;
    const r = Math.min(4, h);
    const top = Math.min(y0, y1);
    // Rounded at the data end only (4 px), square at the baseline.
    const d = up
      ? `M${x},${y0} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${y0} Z`
      : `M${x},${y0} V${y1 - r} Q${x},${y1} ${x + r},${y1} H${x + barW - r} Q${x + barW},${y1} ${x + barW},${y1 - r} V${y0} Z`;
    return <path d={d} fill={fill} />;
  };

  return (
    <section className="rounded-2xl border border-stone-200 bg-white shadow-sm" aria-labelledby="cash-line-title">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 p-4">
        <div>
          <h2 id="cash-line-title" className="text-base font-semibold">Linha do caixa</h2>
          <p className="mt-0.5 text-sm text-stone-500">
            Saldo previsto ao fim de cada {granularity === "week" ? "semana" : "mês"} e o que entra e sai em cada período. Toque num período para ver os lançamentos.
          </p>
        </div>
        <div role="group" aria-label="Período" className="inline-flex rounded-xl border border-stone-200 p-1">
          {(["week", "month"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={granularity === value}
              onClick={() => { setGranularity(value); setSelected(null); setHover(null); }}
              className={`min-h-9 rounded-lg px-3 text-sm font-semibold ${granularity === value ? "bg-stone-950 text-white" : "text-stone-600"}`}
            >
              {value === "week" ? "13 semanas" : "6 meses"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 px-4 pt-3 text-xs text-stone-600">
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-0.5 w-4 rounded" style={{ background: INK }} />Saldo previsto</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-0 w-4 border-t-2 border-dashed" style={{ borderColor: CRITICAL }} />Saldo mínimo</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-sm" style={{ background: IN }} />Entradas {compact(totalIn)}</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-sm" style={{ background: OUT }} />Saídas {compact(totalOut)}</span>
      </div>

      <div className="relative overflow-x-auto px-2 pb-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full min-w-[640px]" role="img" aria-label="Saldo previsto por período e entradas e saídas">
          {/* balance panel */}
          <text x={LEFT} y={12} fontSize="12" fontWeight="600" fill={INK}>Saldo no fim do período</text>
          {balTicks.map((v) => (
            <g key={`b${v}`}>
              <line x1={LEFT} x2={W - RIGHT} y1={yBal(v)} y2={yBal(v)} stroke={GRID} />
              <text x={LEFT - 8} y={yBal(v) + 4} textAnchor="end" fontSize="11" fill={MUTED}>{compact(v)}</text>
            </g>
          ))}
          {shown !== null && <rect x={LEFT + col * shown} y={TOP - 6} width={col} height={H - TOP - AXIS + 6} fill="#f2f4f1" />}
          {minimum > 0 && minimum >= balMin && minimum <= balMax && (
            <g>
              <line x1={LEFT} x2={W - RIGHT} y1={yBal(minimum)} y2={yBal(minimum)} stroke={CRITICAL} strokeWidth="1.5" strokeDasharray="6 5" />
              <text x={W - RIGHT} y={yBal(minimum) - 6} textAnchor="end" fontSize="11" fill={CRITICAL}>mínimo {compact(minimum)}</text>
            </g>
          )}
          <path d={"M" + points.map(([x, y]) => `${x},${y}`).join("L")} fill="none" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <circle cx={LEFT} cy={yBal(cash)} r="4.5" fill={INK} stroke="#fff" strokeWidth="2" />
          <text x={LEFT + 8} y={yBal(cash) - 9} fontSize="11" fontWeight="600" fill={INK}>hoje {compact(cash)}</text>
          {buckets.map((b, i) => (
            <circle key={`p${b.key}`} cx={cx(i)} cy={yBal(b.closing)} r={i === lowestIndex ? 5 : 3.5} fill={b.closing < minimum ? CRITICAL : INK} stroke="#fff" strokeWidth="2" />
          ))}
          {lowestIndex >= 0 && buckets[lowestIndex] && (
            <text
              x={Math.min(Math.max(cx(lowestIndex), LEFT + 40), W - RIGHT - 40)}
              y={Math.min(yBal(buckets[lowestIndex]!.closing) + 20, TOP + BAL_H)}
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill={buckets[lowestIndex]!.closing < minimum ? CRITICAL : INK}
            >
              menor {compact(buckets[lowestIndex]!.closing)}
            </text>
          )}

          {/* flow panel */}
          <text x={LEFT} y={flowTop - 14} fontSize="12" fontWeight="600" fill={INK}>Entradas (para cima) e saídas (para baixo)</text>
          <text x={LEFT - 8} y={yFlow(flowLim) + 4} textAnchor="end" fontSize="11" fill={MUTED}>{compact(flowLim)}</text>
          <text x={LEFT - 8} y={yFlow(-flowLim) + 4} textAnchor="end" fontSize="11" fill={MUTED}>{compact(-flowLim)}</text>
          <line x1={LEFT} x2={W - RIGHT} y1={yFlow(flowLim)} y2={yFlow(flowLim)} stroke={GRID} />
          <line x1={LEFT} x2={W - RIGHT} y1={yFlow(-flowLim)} y2={yFlow(-flowLim)} stroke={GRID} />
          {buckets.map((b, i) => (
            <g key={`f${b.key}`}>
              {bar(cx(i) - barW / 2, zero, yFlow(b.inflow), IN, true)}
              {bar(cx(i) - barW / 2, zero, yFlow(-b.outflow), OUT, false)}
            </g>
          ))}
          <line x1={LEFT} x2={W - RIGHT} y1={zero} y2={zero} stroke="#9aa39e" />
          {buckets.map((b, i) => (
            <text key={`x${b.key}`} x={cx(i)} y={H - 8} textAnchor="middle" fontSize="11" fill={selected === i ? INK : MUTED} fontWeight={selected === i ? 700 : 400}>
              {b.label}
            </text>
          ))}

          {/* hit targets, larger than the marks */}
          {buckets.map((b, i) => (
            <rect
              key={`h${b.key}`}
              x={LEFT + col * i}
              y={0}
              width={col}
              height={H}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={() => setSelected(selected === i ? null : i)}
            >
              <title>{`${b.label}: entradas ${money.format(b.inflow)}, saídas ${money.format(b.outflow)}, saldo ${money.format(b.closing)}`}</title>
            </rect>
          ))}
        </svg>

        {active && shown !== null && (
          <div
            className="pointer-events-none absolute top-3 z-10 w-56 rounded-xl border border-stone-200 bg-white p-3 text-sm shadow-lg"
            style={{ left: `clamp(8px, calc(${((cx(shown) / W) * 100).toFixed(2)}% - 112px), calc(100% - 232px))` }}
          >
            <p className="font-semibold">
              {granularity === "week" ? `Semana de ${dayMonth(active.start)} a ${dayMonth(active.end)}` : active.label}
            </p>
            {active.includesOverdue && <p className="text-xs text-amber-700">Inclui valores já vencidos</p>}
            <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 tabular-nums">
              <dt className="flex items-center gap-1.5 text-stone-600"><i className="size-2 rounded-sm" style={{ background: IN }} />Entradas</dt><dd className="text-right">{money.format(active.inflow)}</dd>
              <dt className="flex items-center gap-1.5 text-stone-600"><i className="size-2 rounded-sm" style={{ background: OUT }} />Saídas</dt><dd className="text-right">{money.format(active.outflow)}</dd>
              <dt className="font-semibold">Saldo no fim</dt><dd className={`text-right font-semibold ${active.closing < minimum ? "text-red-700" : ""}`}>{money.format(active.closing)}</dd>
            </dl>
          </div>
        )}
      </div>

      {detail && (
        <div className="border-t border-stone-100 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">
              {granularity === "week" ? `Semana de ${dayMonth(detail.start)} a ${dayMonth(detail.end)}` : `Mês ${detail.label}`} · {detail.lines.length} lançamento(s)
            </h3>
            <button type="button" onClick={() => setSelected(null)} className="min-h-9 rounded-lg px-3 text-sm font-semibold text-stone-600 hover:bg-stone-50">Fechar</button>
          </div>
          {detail.lines.length === 0 ? (
            <p className="mt-2 text-sm text-stone-500">Nada previsto neste período.</p>
          ) : (
            <ul className="mt-2 divide-y divide-stone-100 text-sm">
              {detail.lines.map((line) => (
                <li key={line.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-2">
                  <span className="w-12 tabular-nums text-stone-500">{dayMonth(line.dueDate.slice(0, 10))}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{line.counterparty}</span>
                    <span className="block truncate text-xs text-stone-500">{line.document} · {line.status}</span>
                  </span>
                  <span className="tabular-nums font-semibold" style={{ color: line.signedAmount >= 0 ? IN : OUT }}>
                    {line.signedAmount >= 0 ? "+" : "−"}{money.format(line.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

/** "De onde vem" and "Para onde vai": horizontal bars by source and destination. */
export function CashFlowBreakdown({ lines }: { lines: CashFlowLine[] }) {
  const inflows = useMemo(() => groupTotals(lines, "in"), [lines]);
  const outflows = useMemo(() => groupTotals(lines, "out"), [lines]);
  const Panel = ({ title, items, color, empty }: { title: string; items: Array<{ group: string; amount: number }>; color: string; empty: string }) => {
    const max = Math.max(1, ...items.map((item) => item.amount));
    const total = items.reduce((sum, item) => sum + item.amount, 0);
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-semibold">{title}</h3>
          <span className="text-sm tabular-nums text-stone-600">{money.format(total)}</span>
        </div>
        {items.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">{empty}</p>
        ) : (
          <ul className="mt-3 grid gap-2.5">
            {items.map((item) => (
              <li key={item.group} className="grid gap-1" title={`${item.group}: ${money.format(item.amount)}`}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">{item.group}</span>
                  <span className="shrink-0 tabular-nums text-stone-700">
                    {compact(item.amount)} <span className="text-xs text-stone-500">{Math.round((item.amount / total) * 100)}%</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-stone-100">
                  <div className="h-2 rounded-r" style={{ width: `${Math.max(2, (item.amount / max) * 100)}%`, background: color }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Panel title="De onde vem o dinheiro" items={inflows} color={IN} empty="Nenhuma entrada prevista." />
      <Panel title="Para onde vai o dinheiro" items={outflows} color={OUT} empty="Nenhuma saída prevista." />
    </div>
  );
}
