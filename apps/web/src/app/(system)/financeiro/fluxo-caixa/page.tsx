"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Check, ChevronDown, Info, Landmark, Plus, X } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-url";
import {
  buildCashFlowLines,
  type CashFlowProjectionSource,
  type CashFlowTransaction,
  type GreenCoffeeProjectionSource,
  type TaxProjectionSource,
} from "@/lib/finance-cashflow";
import { buildForecast, cashBufferDays, paidLast30Days, type ForecastDay, type RecurringExpense } from "@/lib/cash-forecast";

/**
 * Fluxo de caixa (rascunho aprovado em 26/11): quanto tem no banco hoje, o que
 * entra e sai, e onde o caixa aperta. Saldo do extrato + títulos do BBOS +
 * despesas fixas previstas. Interativo: o gráfico mostra cada dia ao passar o
 * dedo/mouse, as semanas abrem e as despesas fixas são corrigidas aqui mesmo.
 */

type Summary = {
  cash: number;
  transactions?: CashFlowTransaction[];
  paidLast30Days?: number | null;
  receivableProjection?: CashFlowProjectionSource[];
  payableProjection?: CashFlowProjectionSource[];
  greenCoffeePurchaseProjection?: GreenCoffeeProjectionSource[];
  taxProjection?: TaxProjectionSource[];
  settings?: { minimumCashBalance?: number; cashStartDate?: string | null; cashStartBalance?: number | null };
};

const API = `${getApiBaseUrl()}/finance`;
const SUGGESTED_MINIMUM = 5000;
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const brl2 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const num = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const weekday = (iso: string) => WEEKDAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()]!;
const COLORS = { green: "#1f6b4f", greenSoft: "#e6f1ec", red: "#b42318", redSoft: "#fdecea", amber: "#9a5b00", amberSoft: "#fdf3e1", line: "#e3e8e4", muted: "#5d6b67" };
const card = "rounded-[14px] border border-[var(--bbos-border,#e3e8e4)] bg-white";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", cache: "no-store", ...init });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message ?? "Não foi possível carregar.");
  return body as T;
}

export default function CashFlowPage() {
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [recurring, setRecurring] = React.useState<RecurringExpense[]>([]);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [horizon, setHorizon] = React.useState<30 | 60 | 90>(30);
  const [openWeek, setOpenWeek] = React.useState<string | null>(null);
  const [showAll, setShowAll] = React.useState(false);
  const [editing, setEditing] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const [s, r] = await Promise.all([
        request<Summary>(`${API}/summary`),
        request<RecurringExpense[]>(`${API}/recurring-expenses`).catch(() => []),
      ]);
      setSummary(s);
      setRecurring(r.map((x) => ({ ...x, amount: Number(x.amount) })));
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  const cashKnown = Boolean(summary?.settings?.cashStartDate);
  const minimum = summary?.settings?.minimumCashBalance || SUGGESTED_MINIMUM;
  const minimumSuggested = !summary?.settings?.minimumCashBalance;
  const forecast = React.useMemo(() => {
    if (!summary) return null;
    const lines = buildCashFlowLines({
      cash: summary.cash,
      receivables: summary.receivableProjection,
      payables: summary.payableProjection,
      purchases: summary.greenCoffeePurchaseProjection,
      taxes: summary.taxProjection,
    });
    return buildForecast({ startBalance: cashKnown ? summary.cash : 0, lines, recurring, horizonDays: horizon, minimum });
  }, [summary, recurring, horizon, minimum, cashKnown]);

  // Dias de caixa: saldo ÷ média de saídas pagas nos últimos 30 dias.
  const bufferDays = React.useMemo(() => {
    if (!summary || !cashKnown) return null;
    const paid = paidLast30Days(summary);
    return cashBufferDays(summary.cash, paid);
  }, [summary, cashKnown]);

  if (status === "loading") return <div className="mx-auto max-w-[1180px] animate-pulse space-y-4 pt-6"><div className="h-10 w-64 rounded bg-stone-200" /><div className="grid gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-28 rounded-[14px] bg-stone-200/70" />)}</div><div className="h-72 rounded-[14px] bg-stone-200/70" /></div>;
  if (status === "error" || !forecast || !summary) return <p className="mx-auto mt-10 max-w-[1180px] rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Não foi possível carregar o fluxo de caixa. Nenhum valor substituto foi exibido.</p>;

  const finalTone = forecast.final < minimum ? COLORS.amber : COLORS.green;

  return (
    <div className="mx-auto max-w-[1180px] pb-24 sm:pb-20">
      <Link href="/financeiro" className="inline-flex min-h-11 items-center gap-2 text-xs font-bold text-forest-700"><ArrowLeft size={14} /> Financeiro</Link>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Fluxo de caixa</h1>
          <p className="mt-1 text-sm text-[var(--bbos-text-secondary)]">Quanto tem no banco hoje, o que entra e sai, e onde o caixa aperta.</p>
        </div>
        <Segmented value={horizon} options={[[30, "30 dias"], [60, "60"], [90, "90"]]} onChange={(v) => setHorizon(v as 30 | 60 | 90)} />
      </div>

      {!cashKnown && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <span><b>Falta o saldo do banco.</b> Importe o extrato do Itaú: o saldo dele vira o ponto de partida e as despesas fixas entram na previsão. Até lá, a linha começa em zero.</span>
          <Link href="/financeiro/conciliacao/importar" className="inline-flex min-h-10 items-center rounded-xl bg-[var(--bbos-text-primary,#0E191D)] px-4 font-bold text-white">Importar extrato</Link>
        </div>
      )}

      {/* 4 números */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="No banco hoje" value={cashKnown ? brl2.format(summary.cash) : "—"}
          note={cashKnown ? <>saldo de {dm(summary.settings!.cashStartDate!)} + movimentos{bufferDays !== null && <> · <b style={{ color: bufferDays < 15 ? COLORS.amber : COLORS.green }}>~{bufferDays} dias de caixa</b></>}</> : "importe o extrato"}
          icon={<Landmark size={15} />} />
        <Kpi label={`Entra em ${horizon} dias`} value={`+${brl.format(forecast.inflow)}`} tone={COLORS.green}
          note={forecast.overdueReceivable > 0 ? <>+{brl.format(forecast.overdueReceivable)} vencidos à parte</> : "títulos a receber no prazo"} />
        <Kpi label={`Sai em ${horizon} dias`} value={`−${brl.format(forecast.outflow)}`} tone={COLORS.red}
          note={forecast.outflowRecurring > 0 ? <>{brl.format(forecast.outflowRecurring)} em despesas fixas <b>previstas</b></> : "contas a pagar lançadas"} />
        <Kpi label={`Em ${dm(forecast.end)}`} value={brl.format(forecast.final)} tone={finalTone}
          note={<>pior dia: <b style={{ color: forecast.worst.balance < minimum ? COLORS.red : COLORS.green }}>{brl.format(forecast.worst.balance)} em {dm(forecast.worst.date)}</b></>} />
      </div>

      {/* Alertas: no máximo 3, em ordem de urgência */}
      {forecast.alerts.length > 0 && (
        <div className="mt-3 grid gap-2">
          {forecast.alerts.map((alert) => {
            const color = alert.tone === "red" ? COLORS.red : alert.tone === "amber" ? COLORS.amber : "#9fb2ab";
            const Icon = alert.tone === "info" ? Info : AlertTriangle;
            const onClick = alert.href === "#previstas" ? () => setEditing(true) : alert.href.startsWith("#dia-") ? () => focusDay(alert.href.slice(5)) : undefined;
            return (
              <div key={alert.key} className={`${card} grid grid-cols-[5px_1fr] items-center gap-x-3 gap-y-2 p-3 transition hover:shadow-sm sm:grid-cols-[5px_auto_1fr_auto]`}>
                <span className="self-stretch rounded" style={{ background: color }} />
                <Icon size={17} className="hidden sm:block" style={{ color }} />
                <div className="min-w-0"><p className="font-bold">{alert.title}</p><p className="text-[12.5px] text-[var(--bbos-text-secondary)]">{alert.detail}</p></div>
                {onClick
                  ? <button type="button" onClick={onClick} className="col-start-2 inline-flex min-h-10 items-center justify-self-start rounded-xl border px-3.5 text-[13px] font-bold transition hover:bg-stone-50 sm:col-start-4">{alert.action}</button>
                  : <Link href={alert.href} className={`col-start-2 inline-flex min-h-10 items-center justify-self-start rounded-xl px-3.5 text-[13px] font-bold transition sm:col-start-4 ${alert.tone === "red" ? "bg-[var(--bbos-text-primary,#0E191D)] text-white hover:opacity-90" : "border hover:bg-stone-50"}`}>{alert.action}</Link>}
              </div>
            );
          })}
        </div>
      )}

      {/* Saldo dia a dia */}
      <section className={`${card} mt-3 p-4 sm:p-5`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[16px] font-semibold">Saldo dia a dia</h2>
          <span className="text-xs text-[var(--bbos-text-secondary)]">passe o dedo ou o mouse para ver cada dia</span>
        </div>
        <BalanceChart days={forecast.days} minimum={minimum} minimumSuggested={minimumSuggested} onPick={focusDay} />
      </section>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.25fr_1fr]">
        {/* Semana a semana */}
        <section className={`${card} p-4 sm:p-5`}>
          <div className="flex items-baseline justify-between gap-2"><h2 className="text-[16px] font-semibold">Semana a semana</h2><span className="text-xs text-[var(--bbos-text-secondary)]">toque para abrir</span></div>
          <div className="mt-2 grid grid-cols-[1.3fr_1fr_1fr_1fr_1.1fr] gap-x-2 px-2 pb-1 text-right text-[11px] font-bold uppercase tracking-wide text-[var(--bbos-text-secondary)]"><span className="text-left">Semana</span><span>Começa</span><span>Entra</span><span>Sai</span><span>Termina</span></div>
          {forecast.weeks.map((week) => {
            const open = openWeek === week.from;
            return (
              <div key={week.from} className={`rounded-xl transition-colors ${week.low ? "bg-[#fdf3e1]" : ""} ${open ? "ring-1 ring-stone-300" : ""}`}>
                <button type="button" aria-expanded={open} onClick={() => setOpenWeek(open ? null : week.from)} className="grid w-full grid-cols-[1.3fr_1fr_1fr_1fr_1.1fr] items-center gap-x-2 border-t border-stone-100 px-2 py-2.5 text-right text-[13px] tabular-nums hover:bg-stone-50/70">
                  <span className="flex items-center gap-1 text-left font-semibold"><ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />{dm(week.from)}–{dm(week.to)}</span>
                  <span>{num.format(week.start)}</span>
                  <span style={{ color: week.inflow ? COLORS.green : undefined }}>{week.inflow ? `+${num.format(week.inflow)}` : "—"}</span>
                  <span style={{ color: week.outflow ? COLORS.red : undefined }}>{week.outflow ? `−${num.format(week.outflow)}` : "—"}</span>
                  <span className="font-bold">{num.format(week.end)}{week.low && <AlertTriangle size={12} className="ml-1 inline" style={{ color: COLORS.amber }} />}</span>
                </button>
                <div className={`grid transition-all duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                  <div className="overflow-hidden">
                    <ul className="px-3 pb-2 text-[13px]">
                      {week.events.length ? week.events.map((e) => (
                        <li key={e.id} className="flex justify-between gap-2 py-1"><span>{dm(e.date)} · {e.label}{e.kind === "previsto" && <Chip tone="amber">previsto</Chip>}</span><span className="tabular-nums font-semibold" style={{ color: e.amount > 0 ? COLORS.green : COLORS.red }}>{e.amount > 0 ? "+" : "−"}{brl2.format(Math.abs(e.amount))}</span></li>
                      )) : <li className="py-1 text-[var(--bbos-text-secondary)]">Nada previsto nesta semana.</li>}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* Como se chega ao saldo final */}
        <section className={`${card} p-4 sm:p-5`}>
          <h2 className="text-[16px] font-semibold">Como se chega a {brl.format(forecast.final)}</h2>
          <Bridge rows={[
            ["No banco hoje", cashKnown ? summary.cash : 0, cashKnown ? "" : "falta o extrato"],
            ["+ Clientes a receber no prazo", forecast.inflow, ""],
            ["− Despesas fixas previstas", -forecast.outflowRecurring, ""],
            ["− Contas a pagar e compras", -forecast.outflowLaunched, ""],
          ]} total={forecast.final} />
          <p className="mt-3 text-xs text-[var(--bbos-text-secondary)]">Fora da conta: vencidos a receber {brl.format(forecast.overdueReceivable)} · vencidos a pagar {brl.format(forecast.overduePayable)}</p>
        </section>
      </div>

      {/* Próximos movimentos */}
      <section className={`${card} mt-3 p-4 sm:p-5`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[16px] font-semibold">Próximos movimentos</h2>
          <span className="text-xs text-[var(--bbos-text-secondary)]"><Chip tone="gray">lançado</Chip> título no BBOS · <Chip tone="amber">previsto</Chip> repete todo mês ou estimado</span>
        </div>
        <ul className="mt-1">
          {forecast.days.filter((d) => d.events.length).slice(0, showAll ? undefined : 6).map((day) => (
            <li key={day.date} id={`dia-${day.date}`} className={`scroll-mt-24 rounded-xl border-t border-stone-100 px-2 py-2.5 transition-colors first:border-0 ${day.balance < minimum ? "bg-[#fdf3e1]/60" : ""}`}>
              <div className="flex items-baseline justify-between gap-2">
                <b className="text-[14px]">{day.date === forecast.today ? "Hoje" : `${weekday(day.date)}, ${dm(day.date)}`}</b>
                <span className="text-xs text-[var(--bbos-text-secondary)]">saldo no fim do dia <b style={{ color: day.balance < minimum ? COLORS.red : undefined }}>{brl.format(day.balance)}</b></span>
              </div>
              {day.events.map((e) => (
                <div key={e.id} className="flex justify-between gap-2 py-0.5 text-[13px]">
                  <span className="min-w-0 truncate">{e.label}{e.kind === "previsto" ? <Chip tone="amber">previsto</Chip> : <Chip tone="gray">lançado</Chip>}</span>
                  <span className="tabular-nums font-semibold" style={{ color: e.amount > 0 ? COLORS.green : COLORS.red }}>{e.amount > 0 ? "+" : "−"}{brl2.format(Math.abs(e.amount))}</span>
                </div>
              ))}
            </li>
          ))}
        </ul>
        {forecast.days.filter((d) => d.events.length).length > 6 && (
          <button type="button" onClick={() => setShowAll(!showAll)} className="mt-2 text-[13px] font-bold text-forest-700">{showAll ? "Mostrar menos" : "Ver todos os dias"}</button>
        )}
      </section>

      <p className="mt-3 text-xs text-[var(--bbos-text-secondary)]">
        Mínimo de caixa: {brl.format(minimum)}{minimumSuggested && <> (sugerido · <Link href="/financeiro/parametros" className="font-bold text-forest-700 underline">definir em Parâmetros</Link>)</>}. Despesas fixas: <button type="button" onClick={() => setEditing(true)} className="font-bold text-forest-700 underline">revisar previstas</button>.
      </p>

      {editing && <RecurringEditor items={recurring} onClose={() => setEditing(false)} onSaved={(next) => setRecurring(next)} />}
    </div>
  );

  function focusDay(date: string) {
    setShowAll(true);
    window.setTimeout(() => {
      const target = document.getElementById(`dia-${date}`) ?? [...document.querySelectorAll<HTMLElement>("[id^='dia-']")].find((el) => el.id.slice(4) >= date);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.animate?.([{ backgroundColor: "#e6f1ec" }, { backgroundColor: "transparent" }], { duration: 1400 });
    }, 60);
  }
}

function Segmented<T extends number | string>({ value, options, onChange }: { value: T; options: Array<[T, string]>; onChange: (value: T) => void }) {
  return (
    <div className="inline-flex rounded-xl border border-[var(--bbos-border,#e3e8e4)] bg-white p-0.5">
      {options.map(([key, label]) => (
        <button key={String(key)} type="button" aria-pressed={value === key} onClick={() => onChange(key)}
          className={`min-h-9 rounded-[10px] px-3 text-xs font-bold transition-all duration-200 ${value === key ? "bg-[var(--bbos-text-primary,#0E191D)] text-white shadow-sm" : "text-[var(--bbos-text-secondary)] hover:text-[var(--bbos-text-primary)]"}`}>{label}</button>
      ))}
    </div>
  );
}

function Kpi({ label, value, note, tone, icon }: { label: string; value: string; note: React.ReactNode; tone?: string; icon?: React.ReactNode }) {
  return (
    <div className={`${card} p-4 transition hover:-translate-y-0.5 hover:shadow-sm`}>
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[.08em] text-[var(--bbos-text-secondary)]">{icon}{label}</p>
      <p className="mt-1 whitespace-nowrap text-[clamp(20px,2.4vw,26px)] font-bold tabular-nums" style={{ color: tone }}>{value}</p>
      <p className="mt-0.5 text-xs text-[var(--bbos-text-secondary)]">{note}</p>
    </div>
  );
}

function Chip({ tone, children }: { tone: "amber" | "gray"; children: React.ReactNode }) {
  return <span className={`ml-1.5 inline-block rounded-md px-1.5 align-[1px] text-[10.5px] font-bold ${tone === "amber" ? "bg-[#fdf3e1] text-[#9a5b00]" : "bg-stone-100 text-stone-600"}`}>{children}</span>;
}

function Bridge({ rows, total }: { rows: Array<[string, number, string]>; total: number }) {
  const max = Math.max(1, ...rows.map(([, v]) => Math.abs(v)), Math.abs(total));
  return (
    <div className="mt-2 space-y-1.5">
      {rows.map(([label, value, note]) => (
        <div key={label} className="grid grid-cols-[1fr_90px] items-center gap-2 text-[13px]">
          <div><span>{label}</span><div className="mt-1 h-2 rounded bg-stone-100"><div className="h-2 rounded transition-[width] duration-700 ease-out" style={{ width: `${(Math.abs(value) / max) * 100}%`, background: value >= 0 ? COLORS.green : COLORS.red, opacity: label.startsWith("No banco") ? 0.55 : 0.85 }} /></div></div>
          <span className="text-right font-bold tabular-nums" style={{ color: value > 0 && !label.startsWith("No banco") ? COLORS.green : value < 0 ? COLORS.red : undefined }}>{note || (value ? `${value > 0 && !label.startsWith("No banco") ? "+" : value < 0 ? "−" : ""}${num.format(Math.abs(value))}` : "—")}</span>
        </div>
      ))}
      <div className="grid grid-cols-[1fr_90px] border-t-2 border-[var(--bbos-text-primary,#0E191D)] pt-1.5 text-[14px] font-bold"><span>Saldo final</span><span className="text-right tabular-nums">{num.format(total)}</span></div>
    </div>
  );
}

/** Gráfico em degraus do saldo no fim de cada dia, com linha do mínimo e leitura ao passar o dedo. */
function BalanceChart({ days, minimum, minimumSuggested, onPick }: { days: ForecastDay[]; minimum: number; minimumSuggested: boolean; onPick: (date: string) => void }) {
  const [hover, setHover] = React.useState<number | null>(null);
  const [drawn, setDrawn] = React.useState(false);
  React.useEffect(() => { const t = window.setTimeout(() => setDrawn(true), 30); return () => window.clearTimeout(t); }, [days]);
  // Mede a largura real para o texto do gráfico não esticar no celular.
  const box = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(1000);
  React.useEffect(() => {
    const el = box.current;
    if (!el) return;
    const update = () => setWidth(Math.max(300, Math.round(el.clientWidth)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const W = width, H = width < 640 ? 230 : 300, L = 52, R = 12, T = 18, B = 34;
  const values = days.map((d) => d.balance);
  const top = Math.max(minimum * 1.3, ...values) * 1.08;
  const bottom = Math.min(0, ...values) * 1.1;
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(1, days.length - 1);
  const y = (v: number) => T + ((top - v) * (H - T - B)) / (top - bottom || 1);
  let step = `M${x(0)},${y(values[0]!)}`;
  for (let i = 1; i < days.length; i++) step += ` L${x(i)},${y(values[i - 1]!)} L${x(i)},${y(values[i]!)}`;
  const area = `${step} L${x(days.length - 1)},${y(bottom)} L${x(0)},${y(bottom)} Z`;
  // Faixa vermelha só entre a linha do mínimo e o saldo, nos dias abaixo dele.
  const clamp = (v: number) => Math.min(v, minimum);
  let below = `M${x(0)},${y(minimum)} L${x(0)},${y(clamp(values[0]!))}`;
  for (let i = 1; i < days.length; i++) below += ` L${x(i)},${y(clamp(values[i - 1]!))} L${x(i)},${y(clamp(values[i]!))}`;
  below += ` L${x(days.length - 1)},${y(minimum)} Z`;
  const ticks = niceTicks(bottom, top);
  const labelEvery = Math.ceil(days.length / (W < 640 ? 4 : 6));
  const worst = days.reduce((m, d, i) => (d.balance < days[m]!.balance ? i : m), 0);
  const pick = (clientX: number, rect: DOMRect) => {
    const px = ((clientX - rect.left) / rect.width) * W;
    return Math.max(0, Math.min(days.length - 1, Math.round(((px - L) / (W - L - R)) * (days.length - 1))));
  };
  const h = hover !== null ? days[hover]! : null;
  return (
    <div ref={box} className="relative mt-2 select-none">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block w-full touch-pan-y" role="img" aria-label="Saldo previsto dia a dia"
        onMouseMove={(e) => setHover(pick(e.clientX, e.currentTarget.getBoundingClientRect()))}
        onMouseLeave={() => setHover(null)}
        onTouchMove={(e) => setHover(pick(e.touches[0]!.clientX, e.currentTarget.getBoundingClientRect()))}
        onClick={(e) => onPick(days[pick(e.clientX, e.currentTarget.getBoundingClientRect())]!.date)}>
        <defs>
          <linearGradient id="cf-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={COLORS.green} stopOpacity=".16" /><stop offset="1" stopColor={COLORS.green} stopOpacity="0" /></linearGradient>
        </defs>
        {ticks.map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={COLORS.line} vectorEffect="non-scaling-stroke" /><text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill={COLORS.muted}>{num.format(t / 1000)} mil</text></g>)}
        <path d={area} fill="url(#cf-area)" className="transition-opacity duration-500" style={{ opacity: drawn ? 1 : 0 }} />
        <path d={below} fill={COLORS.red} opacity={0.12} />
        <line x1={L} x2={W - R} y1={y(minimum)} y2={y(minimum)} stroke={COLORS.red} strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />
        <text x={W - R - 2} y={y(minimum) - 6} textAnchor="end" fontSize="11" fill={COLORS.red}>mínimo {brl.format(minimum)}{minimumSuggested ? " (sugerido)" : ""}</text>
        <path d={step} fill="none" stroke={COLORS.green} strokeWidth="2.6" vectorEffect="non-scaling-stroke" pathLength={1} strokeDasharray="1" strokeDashoffset={drawn ? 0 : 1} style={{ transition: "stroke-dashoffset 900ms ease-out" }} />
        {days.map((d, i) => d.events.length ? <circle key={d.date} cx={x(i)} cy={y(d.balance)} r={hover === i ? 6 : 4} fill={d.inflow >= d.outflow ? COLORS.green : COLORS.red} className="transition-all" /> : null)}
        {days.map((d, i) => i % labelEvery === 0 || i === days.length - 1 ? <text key={`l${d.date}`} x={x(i)} y={H - 10} textAnchor="middle" fontSize="11" fill={COLORS.muted}>{dm(d.date)}</text> : null)}
        {days[worst]!.balance < minimum && <text x={Math.min(x(worst) + 8, W - 200)} y={Math.min(y(days[worst]!.balance) + 18, H - B - 4)} fontSize="12" fontWeight="700" fill={COLORS.red}>pior dia {dm(days[worst]!.date)} · {brl.format(days[worst]!.balance)}</text>}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="#0E191D" strokeOpacity=".25" vectorEffect="non-scaling-stroke" />}
      </svg>
      {h && (
        <div className="pointer-events-none absolute top-2 z-10 w-[230px] rounded-xl border border-stone-200 bg-white/95 p-3 text-[12.5px] shadow-lg backdrop-blur transition-all duration-150"
          style={{ left: `clamp(0px, calc(${(x(hover!) / W) * 100}% - 115px), calc(100% - 230px))` }}>
          <p className="font-bold">{weekday(h.date)}, {dm(h.date)}</p>
          <p>Saldo no fim do dia: <b style={{ color: h.balance < minimum ? COLORS.red : COLORS.green }}>{brl2.format(h.balance)}</b></p>
          {h.events.slice(0, 4).map((e) => <p key={e.id} className="flex justify-between gap-2 text-[12px]"><span className="truncate">{e.label}</span><span style={{ color: e.amount > 0 ? COLORS.green : COLORS.red }}>{e.amount > 0 ? "+" : "−"}{num.format(Math.abs(e.amount))}</span></p>)}
          {!h.events.length && <p className="text-[var(--bbos-text-secondary)]">Sem movimento.</p>}
        </div>
      )}
      <div className="mt-1 flex flex-wrap gap-4 text-xs text-[var(--bbos-text-secondary)]">
        <span className="inline-flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-full" style={{ background: COLORS.green }} />entrada</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-full" style={{ background: COLORS.red }} />saída</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-0 w-4 border-t-2 border-dashed" style={{ borderColor: COLORS.red }} />mínimo</span>
        <span>toque num dia para ver os lançamentos</span>
      </div>
    </div>
  );
}

function niceTicks(min: number, max: number) {
  const span = max - min || 1;
  const raw = span / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) out.push(Math.round(v));
  return out;
}

/** Despesas fixas: corrigir valor e dia (ex.: aluguel vence dia 10), desligar ou cadastrar. */
function RecurringEditor({ items, onClose, onSaved }: { items: RecurringExpense[]; onClose: () => void; onSaved: (items: RecurringExpense[]) => void }) {
  const [rows, setRows] = React.useState(items.map((i) => ({ ...i, amountText: i.amount.toFixed(2).replace(".", ","), dayText: String(i.dayOfMonth) })));
  const [adding, setAdding] = React.useState({ label: "", category: "Aluguel", amountText: "", dayText: "10" });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const parse = (text: string) => Number(text.replace(/\./g, "").replace(",", "."));
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const saved: RecurringExpense[] = [];
      for (const row of rows) {
        const original = items.find((i) => i.id === row.id)!;
        const amount = parse(row.amountText);
        const day = Number(row.dayText);
        if (amount !== original.amount || day !== original.dayOfMonth || row.active !== original.active) {
          const updated = await request<RecurringExpense>(`${API}/recurring-expenses/${row.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount, dayOfMonth: day, active: row.active }) });
          saved.push({ ...updated, amount: Number(updated.amount) });
        } else saved.push(original);
      }
      if (adding.label.trim()) {
        const created = await request<RecurringExpense>(`${API}/recurring-expenses`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: adding.label, category: adding.category, amount: parse(adding.amountText), dayOfMonth: Number(adding.dayText) }) });
        saved.push({ ...created, amount: Number(created.amount) });
      }
      onSaved(saved);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };
  const input = "min-h-10 rounded-lg border border-stone-200 px-2 text-sm tabular-nums";
  if (typeof document === "undefined") return null;
  // Portal: a página fica numa camada abaixo da barra do celular.
  return createPortal(
    <div className="fixed inset-0 z-[90] grid place-items-end bg-stone-950/40 sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Despesas fixas previstas" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()} style={{ animation: "cf-rise .22s ease-out" }}>
        <style>{"@keyframes cf-rise{from{transform:translateY(12px);opacity:0}to{transform:none;opacity:1}}"}</style>
        <div className="flex items-start justify-between gap-3">
          <div><h2 className="text-lg font-bold">Despesas fixas previstas</h2><p className="text-sm text-[var(--bbos-text-secondary)]">Aprendidas pelo extrato. Corrija o valor e o dia do vencimento; o BBOS não troca o que você corrigiu.</p></div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="grid size-10 place-items-center rounded-xl border"><X size={16} /></button>
        </div>
        {rows.length === 0 && <p className="mt-4 rounded-xl bg-stone-50 p-3 text-sm">Nenhuma ainda. Importe o extrato do Itaú ou cadastre abaixo.</p>}
        <ul className="mt-3 divide-y divide-stone-100">
          {rows.map((row, index) => (
            <li key={row.id} className={`grid grid-cols-[1fr_auto] items-center gap-2 py-2.5 transition-opacity sm:grid-cols-[1fr_120px_90px_auto] ${row.active ? "" : "opacity-50"}`}>
              <div className="min-w-0"><p className="truncate text-sm font-semibold">{row.label}</p><p className="text-xs text-[var(--bbos-text-secondary)]">{row.category}</p></div>
              <label className="col-span-2 flex items-center gap-1 text-xs sm:col-span-1">R$<input className={`${input} w-full`} inputMode="decimal" value={row.amountText} onChange={(e) => setRows(rows.map((r, i) => (i === index ? { ...r, amountText: e.target.value } : r)))} /></label>
              <label className="flex items-center gap-1 text-xs">dia<input className={`${input} w-14`} inputMode="numeric" value={row.dayText} onChange={(e) => setRows(rows.map((r, i) => (i === index ? { ...r, dayText: e.target.value } : r)))} /></label>
              <button type="button" onClick={() => setRows(rows.map((r, i) => (i === index ? { ...r, active: !r.active } : r)))} className={`min-h-10 rounded-lg border px-3 text-xs font-bold ${row.active ? "border-emerald-200 bg-emerald-50 text-emerald-800" : ""}`}>{row.active ? <><Check size={12} className="inline" /> prevista</> : "desligada"}</button>
            </li>
          ))}
        </ul>
        <div className="mt-3 rounded-xl bg-stone-50 p-3">
          <p className="flex items-center gap-1 text-xs font-bold text-[var(--bbos-text-secondary)]"><Plus size={12} /> Nova despesa fixa</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_150px_110px_70px]">
            <input className={input} placeholder="Ex.: Contador" value={adding.label} onChange={(e) => setAdding({ ...adding, label: e.target.value })} />
            <select className={input} value={adding.category} onChange={(e) => setAdding({ ...adding, category: e.target.value })}>{["Aluguel", "Água", "Energia elétrica", "Internet / telefonia", "Seguros", "Site / sistemas", "Contabilidade", "Funcionários / salários", "Encargos trabalhistas", "Outras despesas"].map((c) => <option key={c}>{c}</option>)}</select>
            <input className={input} placeholder="R$" inputMode="decimal" value={adding.amountText} onChange={(e) => setAdding({ ...adding, amountText: e.target.value })} />
            <input className={input} placeholder="dia" inputMode="numeric" value={adding.dayText} onChange={(e) => setAdding({ ...adding, dayText: e.target.value })} />
          </div>
        </div>
        {error && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl border px-4 text-sm font-bold">Cancelar</button>
          <button type="button" data-bbos-write-action disabled={busy} onClick={save} className="min-h-11 rounded-xl bg-[var(--bbos-text-primary,#0E191D)] px-5 text-sm font-bold text-white disabled:opacity-50">{busy ? "Salvando…" : "Salvar"}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
