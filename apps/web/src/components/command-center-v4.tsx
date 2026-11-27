"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  Box,
  Flame,
  FlaskConical,
  ReceiptText,
  Truck,
  Check,
  Clock3,
  Trophy,
  UsersRound,
  TrendingUp,
  Store,
  type LucideIcon,
} from "lucide-react";
import type { CashFlowLine } from "@/lib/finance-cashflow";
import { greenCoverageDays, monthName, receivableSnapshot, salesPace, type BriefPart, type SalesGeo } from "@/lib/command-center";
import { roastPace } from "@/lib/roast-pace";
import { goalProgress, parseGoalInput, saleTime, weekWins, type CommandInsights, type SnoozeAction, type TodaySales } from "@/lib/command-center-v6";

/**
 * Central de comando (proposta aprovada em 26/11), em três perguntas:
 * como estou (frase do dia + 4 números, com o caixa à esquerda), o que decido
 * hoje (até 5 itens com o porquê, por impacto em dinheiro) e o que vem nos
 * próximos dias (dinheiro e operação juntos). Estoque, caminho do café e quem
 * compra ficam abaixo. Referências: Endsley (perceber, entender, prever),
 * Cowan (3 a 5 itens), Few (uma tela), NN/g (topo e esquerda), SAP Fiori,
 * Dynamics 365 e Salesforce. Cor só para exceção.
 */

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const card = "rounded-[var(--bbos-radius-card,14px)] border border-[var(--bbos-border)] bg-white";
const label = "text-xs font-semibold uppercase tracking-[.08em] text-[var(--bbos-text-secondary)]";
const RED = "var(--bbos-danger)";
const AMBER = "var(--bbos-warning)";
const GREEN = "var(--bbos-success)";

export type CenterHome = {
  salesToday: number;
  salesMonth: number;
  overdueOrders: number;
  orderFlow: { fiscal: number; shipping: number };
  productionActualKg: number;
  productionPlannedKg: number;
  pendingLab: number;
  openPurchases: number;
  finishedGoodsUnits: number;
  finishedGoodsReserved: number;
  roastedStock: { physicalKg: number; reservedKg: number; availableKg: number };
  greenInboundKg?: number;
};

export type CenterTask = { key: string; tone: "critical" | "attention" | "ok"; title: string; detail: string; href: string; action: string; why?: string; repeatedDays?: number };
export type CashView = { known: boolean; balance: number; bufferDays: number | null; fixedBufferDays?: number | null; worst: { date: string; balance: number } | null; minimum: number };
export type TimelineItem = { key: string; date: string; label: string; amount: number | null; note?: string; alert?: boolean; warn?: boolean };

export function CommandCenterV4({
  home, greeting, firstName, summary, tasks, greenTotal, greenReserved, greenFree, cashLines, financeReady, geo, newMenu, brief, cashView, timeline,
  onSnooze, onUndoSnooze, insights, freshness, today: todaySales, freshIds,
}: {
  home: CenterHome; greeting: string; firstName: string; summary: string; tasks: CenterTask[];
  greenTotal: number; greenReserved: number; greenFree: number; cashLines: CashFlowLine[];
  financeReady: boolean; geo: SalesGeo | null; newMenu: React.ReactNode;
  brief: BriefPart[]; cashView: CashView | null; timeline: TimelineItem[];
  onSnooze?: (task: CenterTask, action: SnoozeAction) => Promise<boolean>;
  onUndoSnooze?: (task: CenterTask) => Promise<void>;
  insights?: CommandInsights | null;
  onSaveGoal?: (month: string, salesTarget: number | null) => Promise<string | null>;
  freshness?: string;
  today?: TodaySales | null;
  freshIds?: Set<string>;
}) {
  const [undo, setUndo] = React.useState<{ task: CenterTask; text: string } | null>(null);
  React.useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(null), 8000);
    return () => window.clearTimeout(timer);
  }, [undo]);
  const act = async (task: CenterTask, action: SnoozeAction) => {
    if (!onSnooze) return;
    const ok = await onSnooze(task, action);
    setUndo(ok
      ? { task, text: action === "DONE" ? "Marcada como feita" : action === "TOMORROW" ? "Volta amanhã às 6h" : "Volta em 7 dias" }
      : { task, text: "Não foi possível adiar. Tente de novo." });
  };
  const today = new Date();
  const pace = salesPace(home.salesMonth, today);
  const roast = roastPace(home.productionActualKg, home.productionPlannedKg);
  const receivable = receivableSnapshot(cashLines);
  const inboundKg = Math.max(0, home.greenInboundKg ?? 0);
  const coverage = greenCoverageDays(greenFree, home.productionPlannedKg, today);
  const finishedFree = Math.max(0, home.finishedGoodsUnits - home.finishedGoodsReserved);
  const dateLabel = today.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const goal = goalProgress(home.salesMonth, insights?.goal.salesTarget ?? null, pace.projection, pace.daysLeft);
  const wins = weekWins({
    insights: insights ?? null,
    growthPercent: geo?.growthPercent ?? null,
    previousMonthName: monthName(today, -1),
    goal,
    roastDone: home.productionPlannedKg > 0 && home.productionActualKg >= home.productionPlannedKg,
  });

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 pb-24 sm:pb-20">
      <section className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-.01em]">{greeting}{firstName ? `, ${firstName}` : ""}</h1>
          <p className="mt-0.5 text-sm text-[var(--bbos-text-secondary)] first-letter:uppercase">
            {dateLabel} · {pace.daysLeft > 0 ? `${pace.daysLeft} ${pace.daysLeft === 1 ? "dia" : "dias"} para fechar o mês · ` : "último dia do mês · "}{summary}
          </p>
          {freshness && <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-[var(--bbos-surface-subtle)] px-2 py-0.5 text-[11.5px] font-medium text-[var(--bbos-text-secondary)]" title="De quando são os números desta tela"><Clock3 size={12} aria-hidden /> {freshness}</p>}
        </div>
        {newMenu}
      </section>

      {brief.length > 0 && (
        <section aria-label="Resumo do dia" className={`${card} flex items-start gap-3 border-l-4 border-l-[var(--bbos-coffee-green,#1f6b4f)] p-4`}>
          <span className="mt-0.5 shrink-0 rounded-full bg-[var(--bbos-success-soft,#e6f1ec)] px-2.5 py-0.5 text-xs font-bold text-[var(--bbos-success,#1f6b4f)]">Hoje</span>
          <p className="text-[15px] leading-relaxed">
            {brief.map((part, index) => part.tone ? <b key={index} style={part.tone === "red" ? { color: RED } : undefined}>{part.text}</b> : <React.Fragment key={index}>{part.text}</React.Fragment>)}
          </p>
        </section>
      )}

      <section aria-label="Números do dia e do mês" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 min-[1360px]:grid-cols-5">
        <TodayCard sales={todaySales ?? null} freshIds={freshIds ?? new Set()} />
        <CashCard view={cashView} />
        <Link href="/vendas/metas" aria-label="Vendas no mês: abrir metas e margem" className={`${card} group block p-4 transition hover:border-[var(--bbos-coffee-green)] hover:shadow-sm`}>
          <p className={label}>Vendas no mês</p>
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
            <span className="whitespace-nowrap text-[26px] font-bold tabular-nums">{brl.format(home.salesMonth)}</span>
            {geo?.growthPercent != null && (
              <span className={`rounded-full px-2 py-0.5 text-[13px] font-bold ${geo.growthPercent >= 0 ? "bg-[var(--bbos-success-soft)] text-[var(--bbos-success)]" : "bg-[#fdecea] text-[var(--bbos-danger)]"}`}>
                {geo.growthPercent >= 0 ? "▲" : "▼"} {num.format(Math.abs(geo.growthPercent))}%
              </span>
            )}
          </div>
          <Sparkline points={(geo?.cumulative ?? []).map((point) => point.current)} />
          <p className="mt-2 text-[12.5px] text-[var(--bbos-text-secondary)]">
            <b className="text-[var(--bbos-text-primary)]">projeção {brl.format(pace.projection)}</b>
            {geo && geo.previousRevenue > 0 ? ` · ${monthName(today, -1).slice(0, 3)}. ${brl.format(geo.previousRevenue)}` : ""}
          </p>
          {todaySales && todaySales.marketplaceMonth.amount > 0 && (
            <p className="text-[12px] text-[var(--bbos-text-secondary)]">inclui {todaySales.marketplaceMonth.byChannel.map((row) => `${row.channel} ${brl.format(row.amount)}`).join(" · ")}</p>
          )}
          {goal && (
            <div className="mt-2" aria-label={`${goal.percent}% da meta de ${brl.format(goal.target)}`}>
              <div aria-hidden className="h-2 rounded bg-[var(--bbos-surface-subtle)]"><span className="block h-full rounded transition-[width] duration-700 ease-out" style={{ width: `${goal.percent}%`, background: goal.reached || goal.onTrack ? GREEN : AMBER }} /></div>
              <p className="mt-1 text-[11.5px] text-[var(--bbos-text-secondary)]">{goal.reached ? "meta batida" : `${goal.percent}% da meta · faltam ${brl.format(goal.missing)}`}</p>
            </div>
          )}
          <span className="mt-2 inline-block text-[13px] font-bold text-[var(--bbos-coffee-green)] group-hover:underline">{goal ? "Metas e margem →" : "Definir meta →"}</span>
        </Link>

        <Link href="/financeiro/receber" aria-label="A receber: abrir contas a receber" className={`${card} group block p-4 transition hover:border-[var(--bbos-coffee-green)] hover:shadow-sm`}>
          <p className={label}>A receber</p>
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
            <span className="whitespace-nowrap text-[26px] font-bold tabular-nums">{financeReady ? brl.format(receivable.total) : "—"}</span>
            {receivable.overdue > 0 && <span className="rounded-full bg-[#fdecea] px-2 py-0.5 text-[13px] font-bold text-[var(--bbos-danger)]">{brl.format(receivable.overdue)} vencido</span>}
          </div>
          {receivable.total > 0 && (
            <>
              <div className="mt-3 flex h-3 overflow-hidden rounded bg-[var(--bbos-surface-subtle)]">
                <i style={{ width: `${(receivable.overdue / receivable.total) * 100}%`, background: RED }} />
                <i style={{ width: `${(receivable.next14 / receivable.total) * 100}%`, background: GREEN }} />
                <i style={{ width: `${Math.max(0, receivable.total - receivable.overdue - receivable.next14) / receivable.total * 100}%`, background: "#9fb9ad" }} />
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-[var(--bbos-text-secondary)]">
                <Dot color={RED}>vencido ({receivable.overdueCount})</Dot>
                <Dot color={GREEN}>vence em 14 dias {brl.format(receivable.next14)}</Dot>
                <Dot color="#9fb9ad">depois</Dot>
              </div>
            </>
          )}
          <span className="mt-2 inline-block text-[13px] font-bold text-[var(--bbos-coffee-green)] group-hover:underline">{receivable.overdue > 0 ? "Cobrar vencidos →" : "Ver a receber →"}</span>
        </Link>

        <Link href="/producao" aria-label="Torra do mês: abrir produção" className={`${card} group block p-4 transition hover:border-[var(--bbos-coffee-green)] hover:shadow-sm`}>
          <p className={label}>Torra do mês</p>
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
            <span className="whitespace-nowrap text-[26px] font-bold tabular-nums" style={roast.behindKg > 0 ? { color: AMBER } : undefined}>
              {num.format(home.productionActualKg)}{home.productionPlannedKg > 0 && <span className="text-[15px] font-semibold text-[var(--bbos-text-secondary)]"> / {num.format(home.productionPlannedKg)} kg</span>}
            </span>
            {roast.behindKg > 0 && <span className="rounded-full bg-[var(--bbos-warning-soft)] px-2 py-0.5 text-[13px] font-bold text-[var(--bbos-warning)]">{num.format(roast.behindKg)} kg atrás</span>}
          </div>
          {home.productionPlannedKg > 0 ? (
            <>
              <div aria-hidden className="relative mt-3 h-3.5 rounded bg-[var(--bbos-surface-subtle)]">
                <span className="absolute inset-y-[3px] left-0 rounded-sm" style={{ width: `${Math.min(100, (home.productionActualKg / home.productionPlannedKg) * 100)}%`, background: roast.behindKg > 0 ? AMBER : GREEN }} />
                <span className="absolute -inset-y-1 w-[2.5px] rounded bg-[var(--bbos-text-primary)]" style={{ left: `${Math.min(100, (roast.expectedKg / home.productionPlannedKg) * 100)}%` }} />
              </div>
              <div className="mt-1 flex justify-between text-[11px] text-[var(--bbos-text-secondary)]"><span>0</span><span>▲ esperado hoje {num.format(roast.expectedKg)}</span><span>meta {num.format(home.productionPlannedKg)}</span></div>
            </>
          ) : <p className="mt-2 text-[12.5px] text-[var(--bbos-text-secondary)]">sem plano de torra no mês</p>}
          <span className="mt-2 inline-block text-[13px] font-bold text-[var(--bbos-coffee-green)] group-hover:underline">Programar torra →</span>
        </Link>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <section aria-labelledby="tasks-title" className={`${card} p-4 sm:p-5`}>
          <h2 id="tasks-title" className="mb-1 flex items-center gap-2 text-[16.5px] font-semibold">
            Decidir hoje
            {tasks.length > 0 && <span className="rounded-full bg-[var(--bbos-text-primary)] px-2 text-xs font-semibold text-white">{tasks.length}</span>}
            <span className="ml-auto text-xs font-normal text-[var(--bbos-text-secondary)]">por impacto no caixa e no cliente</span>
          </h2>
          {undo && (
            <p role="status" className="my-2 flex items-center justify-between gap-2 rounded-lg bg-[var(--bbos-surface-subtle)] px-3 py-2 text-[13px]">
              <span><b>{undo.task.title}</b> · {undo.text}</span>
              {onUndoSnooze && !undo.text.startsWith("Não") && <button type="button" onClick={() => { void onUndoSnooze(undo.task); setUndo(null); }} className="font-bold text-[var(--bbos-coffee-green)] underline underline-offset-2">Desfazer</button>}
            </p>
          )}
          {tasks.length === 0 ? <p className="py-4 text-sm text-[var(--bbos-text-secondary)]">Nada pendente. Bom trabalho.</p> : (
            <ul className="divide-y divide-[#eef1ed]">
              {tasks.map((task, index) => {
                const Icon = task.key === "roast" ? Flame : task.tone === "ok" ? ReceiptText : Banknote;
                const stripe = task.tone === "critical" ? RED : task.tone === "attention" ? AMBER : GREEN;
                return (
                  <li key={task.key} className="group grid grid-cols-[5px_38px_1fr] items-center gap-x-3 gap-y-2 py-3 transition-colors hover:bg-stone-50/60 sm:grid-cols-[5px_38px_1fr_auto]">
                    <span aria-hidden className="self-stretch rounded" style={{ background: stripe }} />
                    <span aria-hidden className="grid size-[38px] place-items-center rounded-xl bg-[var(--bbos-surface-subtle)] text-[var(--bbos-text-secondary)]"><Icon size={18} /></span>
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold">{task.title}</p>
                      <p className="text-[12.5px] text-[var(--bbos-text-secondary)]">{task.detail}</p>
                      {task.why && <p className="mt-0.5 text-[12px] font-semibold" style={{ color: task.tone === "critical" ? GREEN : "var(--bbos-text-secondary)" }}>{task.why}</p>}
                      {(task.repeatedDays ?? 0) >= 7 && <p className="mt-0.5 text-[11.5px] text-[var(--bbos-text-secondary)]">aparece há {task.repeatedDays} dias · resolva ou adie</p>}
                    </div>
                    <div className="col-start-3 flex flex-wrap items-center gap-1.5 justify-self-start sm:col-start-4 sm:flex-col sm:items-end sm:justify-self-end">
                      <Link href={task.href} className={`inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-xl px-3.5 text-[13px] font-bold ${index === 0 ? "bg-[var(--bbos-action-primary)] text-white hover:bg-[var(--bbos-action-primary-hover)]" : "border border-[var(--bbos-border)] bg-white hover:bg-[var(--bbos-surface-subtle)]"}`}>
                        {task.action}
                      </Link>
                      {onSnooze && (
                        <span className="inline-flex overflow-hidden rounded-xl border border-[var(--bbos-border)] text-[12px] font-semibold text-[var(--bbos-text-secondary)] transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                          <button type="button" onClick={() => act(task, "DONE")} title="Já resolvi: some por 30 dias (volta se a situação mudar)" className="inline-flex min-h-9 items-center gap-1 px-2.5 hover:bg-[var(--bbos-surface-subtle)]"><Check size={13} aria-hidden />Feito</button>
                          <button type="button" onClick={() => act(task, "TOMORROW")} title="Lembrar amanhã às 6h" className="min-h-9 border-l border-[var(--bbos-border)] px-2.5 hover:bg-[var(--bbos-surface-subtle)]">Amanhã</button>
                          <button type="button" onClick={() => act(task, "WEEK")} title="Adiar 7 dias" className="min-h-9 border-l border-[var(--bbos-border)] px-2.5 hover:bg-[var(--bbos-surface-subtle)]">7 dias</button>
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <Timeline items={timeline} />
      </div>

      {wins.length > 0 && (
        <section aria-label="Vitórias da semana" className={`${card} flex flex-wrap items-center gap-2 p-3.5`}>
          <span className="inline-flex items-center gap-1.5 pr-1 text-[13.5px] font-semibold"><Trophy size={16} className="text-[var(--bbos-coffee-green)]" aria-hidden />Vitórias da semana</span>
          {wins.map((win) => <span key={win} className="rounded-full bg-[var(--bbos-success-soft,#e6f1ec)] px-3 py-1 text-[12.5px] font-semibold text-[var(--bbos-success,#1f6b4f)] motion-safe:animate-[fadeIn_.4s_ease]">{win}</span>)}
        </section>
      )}

      {insights && <GrowthRow insights={insights} />}

      <div className="grid gap-4 lg:grid-cols-3">
        <section aria-labelledby="stock-title" className={`${card} p-4 sm:p-5`}>
          <div className="mb-1 flex items-center justify-between">
            <h2 id="stock-title" className="text-[16.5px] font-semibold">Estoque livre</h2>
            <Link href="/estoque" className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--bbos-coffee-green)]">Ver estoque <ArrowRight size={13} /></Link>
          </div>
          <StockBar name="Café verde" value={`${num.format(greenFree)} kg`} free={greenFree} total={greenTotal}
            pill={coverage !== null && coverage < 10 ? `~${Math.max(0, Math.round(coverage))} dias de torra` : undefined}
            note={`${num.format(greenTotal)} kg no total · ${num.format(greenReserved)} kg reservados${inboundKg > 0 ? ` · +${num.format(inboundKg)} kg a caminho` : ""}`} />
          <StockBar name="Café torrado" value={`${num.format(home.roastedStock.availableKg)} kg`} free={home.roastedStock.availableKg} total={home.roastedStock.physicalKg}
            note={home.roastedStock.reservedKg > 0 ? `${num.format(home.roastedStock.reservedKg)} kg reservados` : "nada reservado · todo livre para vender"} />
          <StockBar name="Produto embalado" value={`${num.format(finishedFree)} un.`} free={finishedFree} total={home.finishedGoodsUnits}
            note={`${num.format(home.finishedGoodsUnits)} un. no total · ${num.format(home.finishedGoodsReserved)} reservadas`} />
          <div className="mt-1 flex gap-4 text-[11.5px] text-[var(--bbos-text-secondary)]"><Dot color={GREEN}>livre</Dot><Dot color="#c8d1cb">reservado</Dot></div>
        </section>
        <CoffeePath home={home} finishedFree={finishedFree} behind={roast.behindKg > 0} />
        {geo && geo.topCustomers.length > 0 && (
          <Ranking title="Quem mais comprou" href="/clientes" link="Clientes →"
            rows={geo.topCustomers.slice(0, 3).map((customer) => ({ key: customer.id, name: customer.name, value: customer.revenue, sub: `${customer.orders} ${customer.orders === 1 ? "pedido" : "pedidos"}` }))}
            footer={geo.byCity[0] ? `Cidade líder: ${geo.byCity[0].city} ${brl.format(geo.byCity[0].revenue)}${geo.byState?.length ? ` · ${geo.byState.reduce((sum, st) => sum + st.customers, 0)} clientes compraram` : ""}` : undefined} />
        )}
      </div>
    </div>
  );
}

function Dot({ color, children }: { color: string; children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-sm" style={{ background: color }} />{children}</span>;
}

/** Cumulative sales of the month, day by day (Tufte sparkline). */
function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const max = Math.max(...points, 1);
  const width = 250;
  const xy = points.map((value, index) => `${((index / (points.length - 1)) * width).toFixed(1)},${(34 - (value / max) * 32).toFixed(1)}`);
  return (
    <svg aria-hidden viewBox={`0 0 ${width} 34`} preserveAspectRatio="none" className="mt-2 block h-[34px] w-full">
      <polyline fill="rgba(30,122,79,.12)" stroke="none" points={`0,34 ${xy.join(" ")} ${width},34`} />
      <polyline fill="none" stroke="var(--bbos-success)" strokeWidth="2.2" vectorEffect="non-scaling-stroke" points={xy.join(" ")} />
    </svg>
  );
}

function StockBar({ name, value, free, total, note, pill }: { name: string; value: string; free: number; total: number; note: string; pill?: string }) {
  const share = total > 0 ? Math.max(0, Math.min(1, free / total)) : 0;
  return (
    <div className="py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[14.5px] font-semibold">{name}{pill && <span className="ml-1.5 rounded-full bg-[#fdecea] px-2 py-0.5 text-[11px] font-bold text-[var(--bbos-danger)]">{pill}</span>}</span>
        <span className="text-lg font-bold tabular-nums">{value}</span>
      </div>
      <span aria-hidden className="mt-1.5 flex h-3.5 overflow-hidden rounded bg-[repeating-linear-gradient(45deg,#c8d1cb_0_5px,#dfe5e0_5px_10px)]">
        <span className="bg-[var(--bbos-success)]" style={{ width: `${share * 100}%` }} />
      </span>
      <span className="mt-1 block text-xs text-[var(--bbos-text-secondary)]">{note}</span>
    </div>
  );
}

function CoffeePath({ home, finishedFree, behind }: { home: CenterHome; finishedFree: number; behind: boolean }) {
  const steps: Array<{ key: string; name: string; sub: string; badge: string; href: string; icon: LucideIcon; state: "off" | "plain" | "warn" | "next"; go?: string }> = [
    { key: "purchase", name: "Compras", sub: "a receber", badge: (home.greenInboundKg ?? 0) > 0 ? `${num.format(home.greenInboundKg ?? 0)} kg` : num.format(home.openPurchases), href: "/cafe-verde", icon: Truck, state: (home.greenInboundKg ?? 0) > 0 || home.openPurchases ? "plain" : "off" },
    { key: "lab", name: "Laboratório", sub: "em análise", badge: num.format(home.pendingLab), href: "/laboratorio", icon: FlaskConical, state: home.pendingLab ? "warn" : "off" },
    { key: "roast", name: "Torra", sub: home.productionPlannedKg > 0 ? `de ${num.format(home.productionPlannedKg)} kg` : "no mês", badge: `${num.format(home.productionActualKg)} kg`, href: "/producao", icon: Flame, state: behind ? "warn" : "plain", go: behind ? "atrasada" : undefined },
    { key: "packed", name: "Embalado", sub: "un. livres", badge: num.format(finishedFree), href: "/estoque", icon: Box, state: finishedFree ? "plain" : "off" },
    { key: "nfe", name: "NF-e", sub: "pronto", badge: num.format(home.orderFlow.fiscal), href: home.orderFlow.fiscal ? "/pedidos?filtro=emitir-nf" : "/pedidos", icon: ReceiptText, state: home.orderFlow.fiscal ? "next" : "off", go: home.orderFlow.fiscal ? "emitir →" : undefined },
    { key: "ship", name: "Expedição", sub: home.overdueOrders ? `${home.overdueOrders} sem entrega registrada` : "em andamento", badge: num.format(home.orderFlow.shipping), href: home.overdueOrders ? "/pedidos?filtro=atrasados" : "/pedidos", icon: Truck, state: home.overdueOrders ? "warn" : home.orderFlow.shipping ? "plain" : "off" },
  ];
  return (
    <section aria-labelledby="path-title" className={`${card} p-4 sm:p-5`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="path-title" className="text-[16.5px] font-semibold">Caminho do café</h2>
        <Link href="/pedidos" className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--bbos-coffee-green)]">Ver pedidos <ArrowRight size={13} /></Link>
      </div>
      <ol className="grid grid-cols-3 gap-y-3">
        {steps.map(({ key, name, sub, badge, href, state, go }) => (
          <li key={key} className={`text-center transition-opacity ${state === "off" ? "opacity-50" : ""}`}>
            <Link href={href} className="block rounded-xl px-1 py-1.5 transition hover:bg-[var(--bbos-surface-subtle)]">
              <span className="block text-[19px] font-bold tabular-nums" style={{ color: state === "warn" ? AMBER : state === "next" ? "var(--bbos-coffee-green)" : undefined }}>{badge}</span>
              <span className="block text-[12.5px] font-semibold">{name}</span>
              <span className="block text-[11.5px] text-[var(--bbos-text-secondary)]">{go ?? sub}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Ranking({ title, href, link, rows, footer }: { title: string; href: string; link: string; rows: Array<{ key: string; name: string; tag?: string; value: number; sub?: string }>; footer?: string }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  const ring = ["border-[#c9a227] text-[#8a6d12]", "border-[#a7b0b5] text-[#5f696e]", "border-[#c08a5b] text-[#8a5a2e]"];
  return (
    <section className={`${card} p-4 sm:p-5`}>
      <h2 className="mb-1 flex items-center text-[16.5px] font-semibold">{title}<Link href={href} className="ml-auto text-[13px] font-semibold text-[var(--bbos-coffee-green)]">{link}</Link></h2>
      <ol>
        {rows.map((row, index) => (
          <li key={row.key} className="my-2.5 grid grid-cols-[24px_1fr_auto] items-center gap-2.5">
            <span className={`grid size-6 place-items-center rounded-full border-[1.5px] text-xs font-bold ${ring[index] ?? "border-[#dfe4df] text-[var(--bbos-text-secondary)]"}`}>{index + 1}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{row.name}{row.tag && <small className="ml-1 font-medium text-[var(--bbos-text-secondary)]">{row.tag}</small>}</p>
              <div className="mt-1 h-2.5 rounded-sm bg-[var(--bbos-surface-subtle)]"><i className="block h-full rounded-sm bg-[#7fa894]" style={{ width: `${(row.value / max) * 100}%` }} /></div>
            </div>
            <span className="text-right text-[13.5px] font-bold tabular-nums">{brl.format(row.value)}{row.sub && <small className="block text-[11.5px] font-medium text-[var(--bbos-text-secondary)]">{row.sub}</small>}</span>
          </li>
        ))}
      </ol>
      {footer && <p className="mt-1 text-xs text-[var(--bbos-text-secondary)]">{footer}</p>}
    </section>
  );
}


/** Caixa: saldo do banco, dias de caixa e o pior dia da previsão contra o mínimo. */
function CashCard({ view }: { view: CashView | null }) {
  if (!view) return (
    <div className={`${card} p-4`}>
      <p className={label}>Caixa · Itaú</p>
      <p className="mt-1.5 text-[26px] font-bold text-[#9aa3a0]">—</p>
      <p className="mt-2 text-[12.5px] text-[var(--bbos-text-secondary)]">Sem acesso ao financeiro.</p>
    </div>
  );
  const worst = view.worst;
  const share = (value: number) => `${Math.max(2, Math.min(100, (value / Math.max(view.minimum * 2, view.balance, 1)) * 100))}%`;
  const day = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  return (
    <Link href={view.known ? "/financeiro/fluxo-caixa" : "/financeiro/conciliacao/importar"} aria-label="Caixa: abrir fluxo de caixa" className={`${card} group block p-4 transition hover:border-[var(--bbos-coffee-green)] hover:shadow-sm`}>
      <p className={label}>Caixa · Itaú</p>
      {view.known ? (
        <>
          <p className="mt-1.5 whitespace-nowrap text-[26px] font-bold tabular-nums">{brl.format(view.balance)}</p>
          <p className="text-[12.5px] text-[var(--bbos-text-secondary)]">
            {view.bufferDays !== null && <><b style={{ color: view.bufferDays < 15 ? AMBER : GREEN }} title="Saldo ÷ média de tudo que saiu nos últimos 30 dias, incluindo compras de café">~{view.bufferDays} {view.bufferDays === 1 ? "dia" : "dias"} de caixa</b>{view.fixedBufferDays != null && <> (<b style={{ color: view.fixedBufferDays < 15 ? AMBER : GREEN }} title="Saldo ÷ despesas fixas previstas">~{view.fixedBufferDays} só com fixas</b>)</>} · </>}
            {worst ? <>pior dia: <b style={{ color: worst.balance < view.minimum ? RED : GREEN }}>{brl.format(worst.balance)} em {day(worst.date)}</b></> : "sem saídas previstas"}
          </p>
          <div aria-hidden className="relative mt-3 h-3 rounded bg-[var(--bbos-surface-subtle)]">
            <span className="absolute inset-y-0 left-0 rounded transition-[width] duration-700 ease-out" style={{ width: share(worst?.balance ?? view.balance), background: (worst?.balance ?? view.balance) < view.minimum ? AMBER : GREEN }} />
            <span className="absolute -inset-y-1 w-[2.5px] rounded" style={{ left: share(view.minimum), background: RED }} />
          </div>
          <p className="mt-1 text-[11px] text-[var(--bbos-text-secondary)]">pior dia × mínimo de {brl.format(view.minimum)}</p>
          <span className="mt-2 inline-block text-[13px] font-bold text-[var(--bbos-coffee-green)] group-hover:underline">Fluxo de caixa →</span>
        </>
      ) : (
        <>
          <p className="mt-1.5 text-[22px] font-bold text-[#9aa3a0]">Falta o extrato</p>
          <p className="mt-1 text-[12.5px] text-[var(--bbos-text-secondary)]">O saldo do banco e as despesas fixas vêm do extrato do Itaú.</p>
          <span className="mt-2 inline-block text-[13px] font-bold text-[var(--bbos-coffee-green)] group-hover:underline">Importar extrato →</span>
        </>
      )}
    </Link>
  );
}

/** Próximos dias: dinheiro e operação na mesma linha do tempo; o dia crítico em destaque. */
function Timeline({ items }: { items: TimelineItem[] }) {
  const day = (iso: string) => {
    const date = new Date(`${iso}T12:00:00Z`);
    return `${["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][date.getUTCDay()]} ${iso.slice(8, 10)}`;
  };
  return (
    <section aria-labelledby="timeline-title" className={`${card} p-4 sm:p-5`}>
      <h2 id="timeline-title" className="mb-1 flex items-center text-[16.5px] font-semibold">Próximos 7 dias<span className="ml-auto text-xs font-normal text-[var(--bbos-text-secondary)]">dinheiro e operação</span></h2>
      {items.length === 0 ? <p className="py-4 text-sm text-[var(--bbos-text-secondary)]">Nada previsto para os próximos dias.</p> : (
        <ul>
          {items.map((item) => (
            <li key={item.key} className={`grid grid-cols-[62px_1fr_auto] items-baseline gap-2 border-t border-[#eef1ed] px-1.5 py-2 text-[13px] first:border-0 ${item.alert ? "rounded-lg border-0 bg-[#fdecea]" : ""}`}>
              <span className="font-bold" style={item.alert ? { color: RED } : undefined}>{day(item.date)}</span>
              <span className="min-w-0">{item.label}{item.note && <span className={item.warn ? "font-semibold text-[var(--bbos-warning)]" : "text-[var(--bbos-text-secondary)]"}> · {item.note}</span>}</span>
              <span className="font-bold tabular-nums" style={{ color: item.amount === null ? "var(--bbos-text-secondary)" : item.amount > 0 ? GREEN : RED }}>
                {item.amount === null ? "" : `${item.amount > 0 ? "+" : "−"}${num.format(Math.abs(item.amount))}`}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link href="/financeiro/fluxo-caixa" className="mt-2 inline-block text-[13px] font-bold text-[var(--bbos-coffee-green)]">Ver fluxo de caixa →</Link>
    </section>
  );
}


/** Meta do mês e margem, dentro do card de vendas (Locke e Latham; efeito reta final). */
export function SalesGoal({ goal, insights, onSave }: { goal: ReturnType<typeof goalProgress>; insights: CommandInsights | null; onSave?: (month: string, salesTarget: number | null) => Promise<string | null> }) {
  const [editing, setEditing] = React.useState<string | null>(null);
  const [value, setValue] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  if (!insights) return null;
  const margin = insights.margin;
  const next = insights.nextGoal;
  const monthLabel = (key: string) => new Date(`${key}-15T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long" });
  const open = (month: string, current: number | null) => { setEditing(month); setValue(current ? String(current).replace(".", ",") : ""); setError(""); };
  const save = async () => {
    if (!onSave || !editing) return;
    setBusy(true);
    const message = await onSave(editing, parseGoalInput(value));
    setBusy(false);
    if (message) setError(message); else setEditing(null);
  };
  return (
    <div className="mt-2 space-y-1.5 border-t border-[#eef1ed] pt-2 text-[12.5px]">
      <p className="text-[var(--bbos-text-secondary)]">
        {margin.marginPercent !== null
          ? <>margem <b className="text-[var(--bbos-text-primary)]">{num.format(margin.marginPercent)}%</b>{margin.marginAmount !== null && <> · ~{brl.format(margin.marginAmount)}</>}{margin.coveragePercent < 95 && <> · custo de {margin.coveragePercent}% das vendas</>}</>
          : <>margem: <Link href="/custos" className="font-semibold text-[var(--bbos-coffee-green)] underline underline-offset-2">cadastre o custo dos produtos</Link></>}
      </p>
      {goal ? (
        <div>
          <div aria-label={`Meta: ${goal.percent}%`} className="relative h-2.5 rounded bg-[var(--bbos-surface-subtle)]">
            <span className="absolute inset-y-0 left-0 rounded transition-[width] duration-700 ease-out" style={{ width: `${goal.percent}%`, background: goal.reached || goal.onTrack ? GREEN : AMBER }} />
          </div>
          <p className="mt-1 text-[var(--bbos-text-secondary)]">
            {goal.reached ? <b style={{ color: GREEN }}>meta de {brl.format(goal.target)} batida</b> : <>{goal.percent}% da meta de {brl.format(goal.target)} · faltam <b className="text-[var(--bbos-text-primary)]">{brl.format(goal.missing)}</b>{goal.perDay > 0 && goal.missing > 0 ? ` (${brl.format(goal.perDay)}/dia)` : ""}</>}
            {" "}<button type="button" onClick={() => open(insights.goal.month, goal.target)} className="font-semibold text-[var(--bbos-coffee-green)] underline underline-offset-2">alterar</button>
          </p>
        </div>
      ) : (
        <p><button type="button" onClick={() => open(insights.goal.month, null)} className="font-semibold text-[var(--bbos-coffee-green)] underline underline-offset-2">Definir meta de {monthLabel(insights.goal.month)}</button></p>
      )}
      <p className="text-[var(--bbos-text-secondary)]">
        {next.salesTarget ? <>meta de {monthLabel(next.month)}: {brl.format(next.salesTarget)} · </> : null}
        <button type="button" onClick={() => open(next.month, next.salesTarget)} className="font-semibold text-[var(--bbos-coffee-green)] underline underline-offset-2">{next.salesTarget ? "alterar" : `Definir meta de ${monthLabel(next.month)}`}</button>
      </p>
      {editing && (
        <form className="flex flex-wrap items-center gap-1.5" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <label htmlFor="goal-input" className="sr-only">Meta de vendas de {monthLabel(editing)} em reais</label>
          <input id="goal-input" autoFocus inputMode="decimal" placeholder="Ex.: 30.000" value={value} onChange={(event) => setValue(event.target.value)} className="min-h-9 w-32 rounded-lg border border-[var(--bbos-border)] px-2 text-[13px]" />
          <button type="submit" disabled={busy} className="min-h-9 rounded-lg bg-[var(--bbos-action-primary)] px-3 text-[12.5px] font-bold text-white disabled:opacity-60">Salvar</button>
          <button type="button" onClick={() => setEditing(null)} className="min-h-9 rounded-lg border border-[var(--bbos-border)] px-3 text-[12.5px]">Cancelar</button>
          {error && <span role="alert" className="w-full text-[12px] text-[var(--bbos-danger)]">{error}</span>}
        </form>
      )}
    </div>
  );
}

/** Crescimento: funil de prospecção, saúde da carteira e vendas por canal (Balanced Scorecard, Salesforce). */
function GrowthRow({ insights }: { insights: CommandInsights }) {
  const { growth, customers, channels } = insights;
  const totalChannels = channels.reduce((sum, row) => sum + row.revenue, 0);
  const funnel = [
    { label: "Prospects ativos", value: growth.activeProspects },
    { label: "Em degustação ou proposta", value: growth.proposals },
    { label: "Visitas no mês", value: growth.visitsMonth },
    { label: "Clientes novos no mês", value: growth.newCustomersMonth },
  ];
  const max = Math.max(1, ...funnel.map((step) => step.value));
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section aria-labelledby="growth-title" className={`${card} p-4 sm:p-5`}>
        <h2 id="growth-title" className="mb-2 flex items-center gap-2 text-[16.5px] font-semibold"><TrendingUp size={17} className="text-[var(--bbos-coffee-green)]" aria-hidden />Crescimento<Link href="/prospeccao" className="ml-auto text-[13px] font-semibold text-[var(--bbos-coffee-green)]">Prospecção →</Link></h2>
        <ul className="space-y-1.5">
          {funnel.map((step) => (
            <li key={step.label} className="relative overflow-hidden rounded-lg bg-[var(--bbos-surface-subtle)] px-3 py-1.5 text-[13px]">
              <span aria-hidden className="absolute inset-y-0 left-0 bg-[var(--bbos-success-soft,#e6f1ec)] transition-[width] duration-700 ease-out" style={{ width: `${Math.max(step.value ? 8 : 0, (step.value / max) * 100)}%` }} />
              <span className="relative flex justify-between gap-2"><span>{step.label}</span><b className="tabular-nums">{num.format(step.value)}</b></span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[12px] text-[var(--bbos-text-secondary)]">
          {growth.newCustomerNames.length ? `Novos: ${growth.newCustomerNames.join(", ")}` : growth.activeProspects > 0 && growth.visitsMonth === 0 ? `${num.format(growth.activeProspects)} prospects esperando a primeira visita` : "Registre visitas para ver o funil andar"}
        </p>
      </section>

      <section aria-labelledby="customers-title" className={`${card} p-4 sm:p-5`}>
        <h2 id="customers-title" className="mb-2 flex items-center gap-2 text-[16.5px] font-semibold"><UsersRound size={17} className="text-[var(--bbos-coffee-green)]" aria-hidden />Clientes<Link href="/clientes" className="ml-auto text-[13px] font-semibold text-[var(--bbos-coffee-green)]">Clientes →</Link></h2>
        <dl className="space-y-1.5 text-[13.5px]">
          <div className="flex justify-between gap-2"><dt>Recompra no ritmo</dt><dd className="font-bold tabular-nums">{customers.onTimeRate === null ? "—" : `${customers.onTimeRate}%`}<span className="font-normal text-[var(--bbos-text-secondary)]"> de {customers.recurring} recorrentes</span></dd></div>
          <div className="flex justify-between gap-2"><dt>Passaram do ritmo</dt><dd className="font-bold tabular-nums" style={customers.lapsed.length ? { color: AMBER } : undefined}>{customers.lapsed.length}</dd></div>
          {customers.topCustomer && <div className="flex justify-between gap-2"><dt>Maior cliente do mês</dt><dd className="text-right"><b className="tabular-nums" style={customers.topCustomer.share >= 30 ? { color: AMBER } : undefined}>{customers.topCustomer.share}%</b> <span className="text-[var(--bbos-text-secondary)]">{customers.topCustomer.name}</span></dd></div>}
        </dl>
        <p className="mt-2 text-[12px] text-[var(--bbos-text-secondary)]">
          {customers.lapsed[0] ? `${customers.lapsed[0].name}: ${customers.lapsed[0].daysSince} dias sem pedido (costuma ${customers.lapsed[0].avgIntervalDays})` : customers.recurring ? "Todos os recorrentes comprando no ritmo" : "Recorrente = 3 ou mais pedidos no ano"}
          {customers.topCustomer && customers.topCustomer.share >= 30 ? " · venda concentrada num cliente" : ""}
        </p>
      </section>

      <section aria-labelledby="channels-title" className={`${card} p-4 sm:p-5`}>
        <h2 id="channels-title" className="mb-2 flex items-center gap-2 text-[16.5px] font-semibold"><Store size={17} className="text-[var(--bbos-coffee-green)]" aria-hidden />Vendas por canal<Link href="/vendas" className="ml-auto text-[13px] font-semibold text-[var(--bbos-coffee-green)]">Vendas →</Link></h2>
        {channels.length === 0 ? <p className="py-2 text-sm text-[var(--bbos-text-secondary)]">Sem vendas no mês.</p> : (
          <ul className="space-y-2">
            {channels.slice(0, 5).map((row) => (
              <li key={row.name} className="text-[13px]">
                <div className="flex justify-between gap-2"><span>{row.name}</span><b className="tabular-nums">{brl.format(row.revenue)}</b></div>
                <div aria-hidden className="mt-1 h-1.5 rounded bg-[var(--bbos-surface-subtle)]"><span className="block h-full rounded transition-[width] duration-700 ease-out" style={{ width: `${totalChannels ? (row.revenue / totalChannels) * 100 : 0}%`, background: GREEN }} /></div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}


/** Vendas de hoje, ao vivo e compacto: total, canais e os 3 últimos pedidos. */
function TodayCard({ sales, freshIds }: { sales: TodaySales | null; freshIds: Set<string> }) {
  return (
    <Link href="/pedidos" aria-label="Vendas de hoje: abrir pedidos" aria-live="polite" className={`${card} group block p-4 transition hover:border-[var(--bbos-coffee-green)] hover:shadow-sm`}>
      <p className={`${label} flex items-center gap-2`}>
        Vendas de hoje
        <span aria-hidden className="relative flex size-2"><span className="absolute inline-flex size-full rounded-full bg-[var(--bbos-success)] opacity-60 motion-safe:animate-ping" /><span className="relative inline-flex size-2 rounded-full bg-[var(--bbos-success)]" /></span>
      </p>
      {!sales ? <p className="mt-1.5 text-[26px] font-bold text-[#9aa3a0]">—</p> : (
        <>
          <p className="mt-1.5 whitespace-nowrap text-[26px] font-bold tabular-nums">{brl.format(sales.total)}<span className="ml-2 text-[13px] font-semibold text-[var(--bbos-text-secondary)]">{sales.orders} {sales.orders === 1 ? "pedido" : "pedidos"}</span></p>
          {sales.orders === 0 ? (
            <p className="mt-1 text-[12.5px] text-[var(--bbos-text-secondary)]">Nenhuma venda ainda hoje. Loja, BBOS e marketplaces aparecem aqui.</p>
          ) : (
            <>
              <p className="text-[12.5px] text-[var(--bbos-text-secondary)]">{sales.byChannel.slice(0, 2).map((row) => `${row.channel} ${brl.format(row.amount)}`).join(" · ")}{sales.byChannel.length > 2 ? ` · +${sales.byChannel.length - 2}` : ""}</p>
              <ul className="mt-2 space-y-1">
                {sales.feed.slice(0, 3).map((sale) => (
                  <li key={sale.id} className={`flex items-center gap-2 rounded-md px-1.5 py-0.5 text-[12px] ${freshIds.has(sale.id) ? "bg-[var(--bbos-success-soft,#e6f1ec)] motion-safe:animate-[fadeIn_.5s_ease]" : ""}`}>
                    <span className="font-bold tabular-nums">{saleTime(sale.at)}</span>
                    <span className="min-w-0 flex-1 truncate text-[var(--bbos-text-secondary)]">{sale.customer ?? sale.channel}</span>
                    <b className="tabular-nums">{brl.format(sale.amount)}</b>
                  </li>
                ))}
              </ul>
            </>
          )}
          <span className="mt-2 inline-block text-[13px] font-bold text-[var(--bbos-coffee-green)] group-hover:underline">Ver pedidos →</span>
        </>
      )}
    </Link>
  );
}
