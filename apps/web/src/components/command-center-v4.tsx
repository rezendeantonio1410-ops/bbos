"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  Banknote,
  Box,
  Flame,
  FlaskConical,
  MapPin,
  ReceiptText,
  Sprout,
  TrendingUp,
  Truck,
  type LucideIcon,
} from "lucide-react";
import type { CashFlowLine } from "@/lib/finance-cashflow";
import { buildHeadlines, cashNext14, greenCoverageDays, monthName, receivableSnapshot, salesPace, type SalesGeo } from "@/lib/command-center";
import { roastPace } from "@/lib/roast-pace";

/**
 * Central de comando (approved draft, 26/11): headlines of the day (Dynamics
 * 365), four numbers with comparison and target (SAP Fiori), tasks with one
 * action each (Oracle Redwood), free stock, the coffee path and who buys.
 * Color only for exceptions: red overdue, amber late, green next action.
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
};

export type CenterTask = { key: string; tone: "critical" | "attention" | "ok"; title: string; detail: string; href: string; action: string };

export function CommandCenterV4({
  home, greeting, firstName, summary, tasks, greenTotal, greenReserved, cashLines, cash, cashStarted, financeReady, geo, newMenu,
}: {
  home: CenterHome; greeting: string; firstName: string; summary: string; tasks: CenterTask[];
  greenTotal: number; greenReserved: number; cashLines: CashFlowLine[]; cash: number | null; cashStarted: boolean;
  financeReady: boolean; geo: SalesGeo | null; newMenu: React.ReactNode;
}) {
  const today = new Date();
  const greenFree = Math.max(0, greenTotal - greenReserved);
  const headlines = buildHeadlines({ geo, greenFreeKg: greenFree, plannedKg: home.productionPlannedKg, today });
  const pace = salesPace(home.salesMonth, today);
  const roast = roastPace(home.productionActualKg, home.productionPlannedKg);
  const receivable = receivableSnapshot(cashLines);
  const next14 = cashNext14(cashLines);
  const coverage = greenCoverageDays(greenFree, home.productionPlannedKg, today);
  const finishedFree = Math.max(0, home.finishedGoodsUnits - home.finishedGoodsReserved);
  const dateLabel = today.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 pb-24 sm:pb-6">
      <section className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-.01em]">{greeting}{firstName ? `, ${firstName}` : ""}</h1>
          <p className="mt-0.5 text-sm text-[var(--bbos-text-secondary)] first-letter:uppercase">
            {dateLabel} · {pace.daysLeft > 0 ? `${pace.daysLeft} ${pace.daysLeft === 1 ? "dia" : "dias"} para fechar o mês · ` : "último dia do mês · "}{summary}
          </p>
        </div>
        {newMenu}
      </section>

      {headlines.length > 0 && (
        <section aria-label="Destaques do dia" className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(250px,1fr))]">
          {headlines.map((headline) => {
            const Icon = { trend: TrendingUp, award: Award, sprout: Sprout, pin: MapPin }[headline.icon];
            const warn = headline.tone === "warn";
            return (
              <div key={headline.key} className={`${card} flex items-start gap-3 p-3.5`}>
                <span className={`grid size-9 shrink-0 place-items-center rounded-[10px] ${warn ? "bg-[#fdecea] text-[var(--bbos-danger)]" : "bg-[var(--bbos-surface-subtle)] text-[var(--bbos-coffee-green)]"}`}><Icon size={18} /></span>
                <div className="min-w-0">
                  <p className={`text-[14.5px] font-semibold leading-snug ${warn ? "text-[var(--bbos-danger)]" : ""}`}>{headline.title}</p>
                  <p className="text-[12.5px] text-[var(--bbos-text-secondary)]">{headline.detail}</p>
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section aria-label="Números do mês" className="grid grid-cols-1 gap-3 sm:grid-cols-2 min-[1360px]:grid-cols-4">
        <div className={`${card} p-4`}>
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
            {geo && geo.previousRevenue > 0 ? `vs. ${brl.format(geo.previousRevenue)} em ${monthName(today, -1).slice(0, 3)}. até o dia ${pace.day} · ` : `hoje ${brl.format(home.salesToday)} · `}
            ritmo {brl.format(pace.perDay)}/dia → <b className="text-[var(--bbos-text-primary)]">projeção {brl.format(pace.projection)}</b>
          </p>
          <Link href="/vendas" className="mt-2 inline-block text-[13px] font-bold text-[var(--bbos-coffee-green)]">Ver vendas →</Link>
        </div>

        <div className={`${card} p-4`}>
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
          <Link href="/financeiro/receber" className="mt-2 inline-block text-[13px] font-bold text-[var(--bbos-coffee-green)]">{receivable.overdue > 0 ? "Cobrar vencidos com Pix →" : "Ver a receber →"}</Link>
        </div>

        <div className={`${card} p-4`}>
          <p className={label}>Caixa · próximos 14 dias</p>
          <p className={`mt-1.5 whitespace-nowrap text-[26px] font-bold tabular-nums ${cashStarted && cash !== null ? "" : "text-[#9aa3a0]"}`}>
            {cashStarted && cash !== null ? brl.format(cash + next14.net) : "R$ —"}
          </p>
          <p className="mt-2 text-[12.5px] text-[var(--bbos-text-secondary)]">
            Entra <b style={{ color: GREEN }}>+{brl.format(next14.inflow)}</b> · sai <b className="text-[var(--bbos-text-primary)]">{brl.format(next14.outflow)}</b> em contas a pagar
            {cashStarted && cash !== null ? <><br />Saldo hoje {brl.format(cash)}</> : <><br />Falta o saldo inicial do Itaú para mostrar o saldo projetado.</>}
          </p>
          <Link href={cashStarted ? "/financeiro/fluxo-caixa" : "/financeiro/parametros"} className="mt-2 inline-block text-[13px] font-bold text-[var(--bbos-coffee-green)]">{cashStarted ? "Ver fluxo de caixa →" : "Informar saldo →"}</Link>
        </div>

        <div className={`${card} p-4`}>
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
          <Link href="/producao" className="mt-2 inline-block text-[13px] font-bold text-[var(--bbos-coffee-green)]">Programar torra →</Link>
        </div>
      </section>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(340px,1fr))]">
        <section aria-labelledby="tasks-title" className={`${card} p-4 sm:p-5`}>
          <h2 id="tasks-title" className="mb-1 flex items-center gap-2 text-[16.5px] font-semibold">
            Para resolver agora
            {tasks.length > 0 && <span className="rounded-full bg-[var(--bbos-text-primary)] px-2 text-xs font-semibold text-white">{tasks.length}</span>}
          </h2>
          {tasks.length === 0 ? <p className="py-4 text-sm text-[var(--bbos-text-secondary)]">Nada pendente. Bom trabalho.</p> : (
            <ul className="divide-y divide-[#eef1ed]">
              {tasks.map((task, index) => {
                const Icon = task.key === "roast" ? Flame : task.tone === "ok" ? ReceiptText : Banknote;
                const stripe = task.tone === "critical" ? RED : task.tone === "attention" ? AMBER : GREEN;
                return (
                  <li key={task.key} className="grid grid-cols-[5px_38px_1fr] items-center gap-x-3 gap-y-2 py-3 sm:grid-cols-[5px_38px_1fr_auto]">
                    <span aria-hidden className="self-stretch rounded" style={{ background: stripe }} />
                    <span aria-hidden className="grid size-[38px] place-items-center rounded-xl bg-[var(--bbos-surface-subtle)] text-[var(--bbos-text-secondary)]"><Icon size={18} /></span>
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold">{task.title}</p>
                      <p className="text-[12.5px] text-[var(--bbos-text-secondary)]">{task.detail}</p>
                    </div>
                    <Link href={task.href} className={`col-start-3 inline-flex min-h-10 items-center justify-center justify-self-start whitespace-nowrap rounded-xl px-3.5 text-[13px] font-bold sm:col-start-4 ${index === 0 ? "bg-[var(--bbos-action-primary)] text-white hover:bg-[var(--bbos-action-primary-hover)]" : "border border-[var(--bbos-border)] bg-white hover:bg-[var(--bbos-surface-subtle)]"}`}>
                      {task.action}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="stock-title" className={`${card} p-4 sm:p-5`}>
          <div className="mb-1 flex items-center justify-between">
            <h2 id="stock-title" className="text-[16.5px] font-semibold">Estoque livre</h2>
            <Link href="/estoque" className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--bbos-coffee-green)]">Ver estoque <ArrowRight size={13} /></Link>
          </div>
          <StockBar name="Café verde" value={`${num.format(greenFree)} kg`} free={greenFree} total={greenTotal}
            pill={coverage !== null && coverage < 10 ? `~${Math.max(0, Math.round(coverage))} dias de torra` : undefined}
            note={`${num.format(greenTotal)} kg no total · ${num.format(greenReserved)} kg reservados para pedidos`} />
          <StockBar name="Café torrado" value={`${num.format(home.roastedStock.availableKg)} kg`} free={home.roastedStock.availableKg} total={home.roastedStock.physicalKg}
            note={home.roastedStock.reservedKg > 0 ? `${num.format(home.roastedStock.reservedKg)} kg reservados` : "nada reservado · todo livre para vender"} />
          <StockBar name="Produto embalado" value={`${num.format(finishedFree)} un.`} free={finishedFree} total={home.finishedGoodsUnits}
            note={`${num.format(home.finishedGoodsUnits)} un. no total · ${num.format(home.finishedGoodsReserved)} reservadas`} />
          <div className="mt-1 flex gap-4 text-[11.5px] text-[var(--bbos-text-secondary)]"><Dot color={GREEN}>livre</Dot><Dot color="#c8d1cb">reservado</Dot></div>
        </section>
      </div>

      <CoffeePath home={home} finishedFree={finishedFree} behind={roast.behindKg > 0} />

      {geo && (geo.byCity.length > 0 || geo.topCustomers.length > 0) && (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(340px,1fr))]">
          <Ranking title="Cidades que mais compram" href="/vendas" link="Ver mapa →"
            rows={geo.byCity.slice(0, 5).map((city) => ({ key: `${city.state}-${city.city}`, name: city.city, tag: city.state, value: city.revenue }))} />
          <Ranking title="Quem mais comprou" href="/clientes" link="Clientes →"
            rows={geo.topCustomers.slice(0, 5).map((customer) => ({ key: customer.id, name: customer.name, value: customer.revenue, sub: `${customer.orders} ${customer.orders === 1 ? "pedido" : "pedidos"}` }))} />
        </div>
      )}
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
    { key: "purchase", name: "Compras", sub: "a receber", badge: num.format(home.openPurchases), href: "/cafe-verde", icon: Truck, state: home.openPurchases ? "plain" : "off" },
    { key: "lab", name: "Laboratório", sub: "em análise", badge: num.format(home.pendingLab), href: "/laboratorio", icon: FlaskConical, state: home.pendingLab ? "warn" : "off" },
    { key: "roast", name: "Torra", sub: home.productionPlannedKg > 0 ? `de ${num.format(home.productionPlannedKg)} kg` : "no mês", badge: `${num.format(home.productionActualKg)} kg`, href: "/producao", icon: Flame, state: behind ? "warn" : "plain", go: behind ? "atrasada" : undefined },
    { key: "packed", name: "Embalado", sub: "un. livres", badge: num.format(finishedFree), href: "/estoque", icon: Box, state: finishedFree ? "plain" : "off" },
    { key: "nfe", name: "NF-e", sub: "pronto", badge: num.format(home.orderFlow.fiscal), href: home.orderFlow.fiscal ? "/pedidos?filtro=emitir-nf" : "/pedidos", icon: ReceiptText, state: home.orderFlow.fiscal ? "next" : "off", go: home.orderFlow.fiscal ? "emitir →" : undefined },
    { key: "ship", name: "Expedição", sub: home.overdueOrders ? `${home.overdueOrders} sem entrega registrada` : "em andamento", badge: num.format(home.orderFlow.shipping), href: home.overdueOrders ? "/pedidos?filtro=atrasados" : "/pedidos", icon: Truck, state: home.overdueOrders ? "warn" : home.orderFlow.shipping ? "plain" : "off" },
  ];
  return (
    <section aria-labelledby="path-title" className={`${card} p-4 sm:p-5`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="path-title" className="text-[16.5px] font-semibold">O caminho do café</h2>
        <Link href="/pedidos" className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--bbos-coffee-green)]">Ver pedidos <ArrowRight size={13} /></Link>
      </div>
      <ol className="relative grid grid-cols-[repeat(6,104px)] overflow-x-auto pb-1 sm:grid-cols-6 sm:overflow-visible">
        <span aria-hidden className="absolute left-[8%] right-[8%] top-[28px] h-[3px] rounded bg-[#d6dcd6]" />
        {steps.map(({ key, name, sub, badge, href, icon: Icon, state, go }) => (
          <li key={key} className={`relative text-center ${state === "off" ? "opacity-50" : ""}`}>
            <Link href={href} className="block rounded-xl px-1 pb-1 hover:bg-[var(--bbos-surface-subtle)]">
              <span className={`relative mx-auto grid size-14 place-items-center rounded-full border-2 bg-white ${state === "warn" ? "border-[var(--bbos-warning)] text-[var(--bbos-warning)]" : state === "next" ? "border-[var(--bbos-coffee-green)] text-[var(--bbos-coffee-green)] shadow-[0_0_0_4px_rgba(46,138,100,.12)]" : "border-[#d6dcd6] text-[var(--bbos-text-secondary)]"}`}>
                <Icon size={22} />
                <span className={`absolute -right-2 -top-1.5 rounded-full px-1.5 text-xs font-bold text-white ${state === "warn" ? "bg-[var(--bbos-warning)]" : state === "next" ? "bg-[var(--bbos-coffee-green)]" : "bg-[#5d6b64]"}`}>{badge}</span>
              </span>
              <span className="mt-2 block text-[13.5px] font-semibold">{name}</span>
              <span className="block text-xs text-[var(--bbos-text-secondary)]">{sub}</span>
              {go && <span className="block text-[12.5px] font-bold" style={{ color: state === "warn" ? AMBER : "var(--bbos-coffee-green)" }}>{go}</span>}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Ranking({ title, href, link, rows }: { title: string; href: string; link: string; rows: Array<{ key: string; name: string; tag?: string; value: number; sub?: string }> }) {
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
    </section>
  );
}

