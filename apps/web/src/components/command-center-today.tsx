"use client";

import Link from "next/link";
import * as React from "react";
import { ArrowRight, Bell, CheckCircle2, Circle, MessageCircle, MoreHorizontal, X } from "lucide-react";
import type { CenterTask, TimelineItem } from "@/components/command-center-v4";
import type { SnoozeAction } from "@/lib/command-center-v6";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const short = (v: number) => (Math.abs(v) >= 1000 ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : brl.format(v));
const signed = (v: number) => `${v >= 0 ? "+" : "−"}${brl.format(Math.abs(v))}`;
const dayTitle = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${d.toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" }).replace(".", "")} ${iso.slice(8, 10)}`;
};

export type Area = "Operação" | "Vendas" | "Compras" | "Financeiro" | "Gestão";
export type TodayTask = CenterTask & { area: Area; due?: string; dueTone?: "red" | "amber" | "gray" };
export type Vital = { key: string; label: string; value: string; note?: string; badge?: string; badgeTone?: "up" | "down" | "warn"; tone?: "warn" | "bad"; href?: string };
export type Glance = { revenue: number; projection: number; previousRevenue: number; marginPercent: number | null; goal: number | null; daysLeft: number };
type DoneEntry = { id: string; title: string; at: string };

const AREA_TONE: Record<Area, string> = {
  Operação: "bg-cyan-50 text-cyan-800",
  Vendas: "bg-blue-50 text-blue-800",
  Compras: "bg-amber-50 text-amber-800",
  Financeiro: "bg-emerald-50 text-emerald-800",
  Gestão: "bg-violet-50 text-violet-800",
};
const DUE_TONE = { red: "bg-red-100 text-red-800", amber: "bg-amber-100 text-amber-800", gray: "bg-stone-100 text-stone-600" };
const DONE_KEY = "bbos.center.doneToday";
const todayKey = () => new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);

function readDone(): DoneEntry[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(DONE_KEY) || "{}") as { day?: string; items?: DoneEntry[] };
    return raw.day === todayKey() ? raw.items ?? [] : [];
  } catch {
    return [];
  }
}

function ActionButton({ task, large }: { task: TodayTask; large?: boolean }) {
  const cls = `inline-flex ${large ? "min-h-[46px] px-5" : "min-h-[44px] px-4"} items-center gap-1.5 whitespace-nowrap rounded-xl text-sm font-bold text-white`;
  if (task.href.startsWith("https://wa.me"))
    return <a href={task.href} target="_blank" rel="noreferrer" className={`${cls} bg-[#075E54]`}><MessageCircle size={15} /> {task.action}</a>;
  return <Link href={task.href} className={`${cls} bg-stone-900`}>{task.action}</Link>;
}

function Meta({ task }: { task: TodayTask }) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      <span className={`rounded-md px-1.5 py-0.5 text-[11.5px] font-bold ${AREA_TONE[task.area]}`}>{task.area}</span>
      {task.due && <span className={`rounded-md px-1.5 py-0.5 text-[11.5px] font-bold ${DUE_TONE[task.dueTone ?? "gray"]}`}>{task.due}</span>}
      <span className="text-[13px] text-stone-500">{task.detail}</span>
    </div>
  );
}

/**
 * Central de comando focada no que fazer hoje (padrões SAP Fiori, Oracle
 * Redwood, Salesforce e Microsoft 365): progresso do dia, cartões de número
 * com cor só fora do normal, filtros, próximo melhor passo, tarefas com área
 * e prazo, menu ⋯ para feito/lembrar/não se aplica, semana por dia e um
 * resumo que leva à Inteligência.
 */
export function CommandCenterToday({
  greeting, firstName, dateLabel, tasks, vitals, timeline, glance, freshness, newMenu, onSnooze, canSeeBi,
}: {
  greeting: string;
  firstName: string;
  dateLabel: string;
  tasks: TodayTask[];
  vitals: Vital[];
  timeline: TimelineItem[];
  glance: Glance | null;
  freshness: string;
  newMenu: React.ReactNode;
  onSnooze?: (task: CenterTask, action: SnoozeAction | "DISMISS") => Promise<boolean>;
  canSeeBi: boolean;
}) {
  const [filter, setFilter] = React.useState<string>("Todas");
  const [showAll, setShowAll] = React.useState(false);
  const [menu, setMenu] = React.useState<string | null>(null);
  const [hidden, setHidden] = React.useState<Set<string>>(new Set());
  const [done, setDone] = React.useState<DoneEntry[]>([]);
  const [showDone, setShowDone] = React.useState(false);
  React.useEffect(() => setDone(readDone()), []);
  React.useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menu]);

  const idOf = (t: CenterTask) => `${t.key}|${t.title}`;
  const open = tasks.filter((t) => !hidden.has(idOf(t)));
  const urgent = open.filter((t) => t.tone === "critical");
  const areas = (["Operação", "Vendas", "Compras", "Financeiro", "Gestão"] as Area[]).map((a) => [a, open.filter((t) => t.area === a).length] as const).filter(([, n]) => n > 0);
  const filtered = filter === "Todas" ? open : filter === "Urgentes" ? urgent : open.filter((t) => t.area === filter);
  const [next, ...rest] = filtered;
  const restVisible = showAll ? rest : rest.slice(0, 4);
  const hiddenCount = rest.length - restVisible.length;
  const total = open.length + done.length;
  const progress = total ? Math.round((done.length / total) * 100) : 0;

  const act = async (task: TodayTask, action: SnoozeAction | "DISMISS") => {
    setMenu(null);
    const id = idOf(task);
    setHidden((h) => new Set(h).add(id));
    if (action === "DONE") {
      const entry = { id, title: task.title, at: new Date().toISOString() };
      setDone((d) => {
        const nextDone = [...d.filter((x) => x.id !== id), entry];
        try { window.localStorage.setItem(DONE_KEY, JSON.stringify({ day: todayKey(), items: nextDone })); } catch { /* opcional */ }
        return nextDone;
      });
    }
    const ok = onSnooze ? await onSnooze(task, action) : true;
    if (!ok) setHidden((h) => { const n = new Set(h); n.delete(id); return n; });
  };

  const Row = ({ task }: { task: TodayTask }) => (
    <li className="relative grid grid-cols-[28px_1fr] gap-x-3 gap-y-2 border-t border-stone-100 py-3 sm:grid-cols-[28px_1fr_auto_36px] sm:items-center">
      <button type="button" aria-label={`Marcar como feito: ${task.title}`} onClick={() => void act(task, "DONE")} className="grid size-7 place-items-center text-stone-300 hover:text-teal-700"><Circle size={24} /></button>
      <div className="min-w-0"><p className="text-base font-bold">{task.title}</p><Meta task={task} /></div>
      <div className="col-start-2 flex items-center gap-2 sm:col-start-auto"><ActionButton task={task} /></div>
      <div className="absolute right-0 top-3 sm:static">
        <button type="button" aria-label={`Mais opções: ${task.title}`} onClick={(e) => { e.stopPropagation(); setMenu(menu === idOf(task) ? null : idOf(task)); }} className="grid size-9 place-items-center rounded-xl border border-stone-200 text-stone-500"><MoreHorizontal size={16} /></button>
        {menu === idOf(task) && (
          <div role="menu" onClick={(e) => e.stopPropagation()} className="absolute right-0 top-10 z-20 w-48 rounded-xl border border-stone-200 bg-white p-1.5 text-sm shadow-xl">
            <button type="button" role="menuitem" onClick={() => void act(task, "DONE")} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-stone-50"><CheckCircle2 size={15} /> Feito</button>
            <button type="button" role="menuitem" onClick={() => void act(task, "TOMORROW")} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-stone-50"><Bell size={15} /> Lembrar amanhã</button>
            <button type="button" role="menuitem" onClick={() => void act(task, "WEEK")} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-stone-50"><Bell size={15} /> Lembrar em 7 dias</button>
            <button type="button" role="menuitem" onClick={() => void act(task, "DISMISS")} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-stone-500 hover:bg-stone-50"><X size={15} /> Não se aplica</button>
          </div>
        )}
      </div>
    </li>
  );

  const days = React.useMemo(() => {
    const map = new Map<string, TimelineItem[]>();
    for (const item of timeline) map.set(item.date, [...(map.get(item.date) ?? []), item]);
    return [...map.entries()].map(([date, items]) => ({ date, items, net: items.reduce((s, i) => s + (i.amount ?? 0), 0) }));
  }, [timeline]);
  const change = glance && glance.previousRevenue > 0 ? glance.revenue / glance.previousRevenue : null;
  const target = glance ? glance.goal ?? glance.projection : 0;
  const pct = glance && target > 0 ? Math.min(100, Math.round((glance.revenue / target) * 100)) : 0;

  return (
    <div className="mx-auto max-w-[1080px] pb-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{greeting}{firstName ? `, ${firstName}` : ""}</h1>
          <p className="mt-1 text-[15px] text-stone-500">{dateLabel} · <strong className="text-stone-900">{open.length ? `${open.length} ${open.length === 1 ? "coisa pede" : "coisas pedem"} você hoje` : "Tudo em dia"}</strong></p>
          <p className="mt-0.5 text-xs text-stone-400">{freshness}</p>
        </div>
        <div className="flex items-center gap-2.5">
          {total > 0 && (
            <div className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-2.5" aria-label={`${done.length} de ${total} feitas hoje`}>
              <span className="grid size-11 place-items-center rounded-full" style={{ background: `conic-gradient(#0f766e ${progress}%, #e7e5e4 0)` }}>
                <span className="grid size-9 place-items-center rounded-full bg-white text-xs font-extrabold">{done.length}/{total}</span>
              </span>
              <span><b className="block text-sm">Feitas hoje</b><span className="text-xs text-stone-500">{done.length ? "bom ritmo" : "marque com ○ ao resolver"}</span></span>
            </div>
          )}
          {newMenu}
        </div>
      </header>

      <div className="mt-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {vitals.map((v) => {
          const body = (
            <>
              <p className="flex justify-between gap-2 text-[12.5px] text-stone-500">{v.label}{v.badge && <span className={`text-[11px] font-bold ${v.badgeTone === "up" ? "text-emerald-700" : v.badgeTone === "down" ? "text-red-700" : "text-amber-700"}`}>{v.badge}</span>}</p>
              <p className={`mt-0.5 text-2xl font-extrabold tracking-tight ${v.tone === "bad" ? "text-red-700" : v.tone === "warn" ? "text-amber-700" : ""}`}>{v.value}</p>
              {v.note && <p className="text-xs text-stone-500">{v.note}</p>}
            </>
          );
          const cls = `relative block rounded-2xl border px-4 py-3 ${v.tone === "bad" ? "border-red-300 bg-white before:absolute before:inset-y-3.5 before:left-0 before:w-[3px] before:rounded before:bg-red-600" : v.tone === "warn" ? "border-amber-300 bg-white before:absolute before:inset-y-3.5 before:left-0 before:w-[3px] before:rounded before:bg-amber-600" : "border-stone-200 bg-white"}`;
          return v.href ? <Link key={v.key} href={v.href} className={cls}>{body}</Link> : <div key={v.key} className={cls}>{body}</div>;
        })}
      </div>

      <section className="mt-4 rounded-[20px] border border-stone-200 bg-white px-5 py-5 sm:px-6" aria-labelledby="fazer-hoje">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="fazer-hoje" className="text-xl font-bold">Fazer hoje</h2>
          {open.length > 0 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar tarefas">
              {([["Todas", open.length], ...(urgent.length ? [["Urgentes", urgent.length] as const] : []), ...areas] as Array<readonly [string, number]>).map(([name, n]) => (
                <button key={name} type="button" aria-pressed={filter === name} onClick={() => { setFilter(name); setShowAll(false); }} className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold ${filter === name ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 text-stone-500"}`}>{name} · {n}</button>
              ))}
            </div>
          )}
        </div>
        {open.length === 0 ? (
          <p className="mt-4 flex items-center gap-2 text-[15px] font-semibold text-emerald-800"><CheckCircle2 size={20} /> Tudo em dia. Nada pede você agora.</p>
        ) : !next ? (
          <p className="mt-4 text-sm text-stone-500">Nada neste filtro.</p>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-[28px_1fr] gap-x-3 gap-y-2 rounded-2xl border border-teal-200 bg-teal-50/70 px-4 py-3.5 sm:grid-cols-[28px_1fr_auto] sm:items-center">
              <button type="button" aria-label={`Marcar como feito: ${next.title}`} onClick={() => void act(next, "DONE")} className="grid size-7 place-items-center text-teal-700"><Circle size={24} /></button>
              <div className="min-w-0">
                <p className="text-[11px] font-extrabold uppercase tracking-[.12em] text-teal-800">Próximo melhor passo</p>
                <p className="text-base font-bold">{next.title}</p>
                <Meta task={next} />
                {next.why && <p className="mt-1 text-[13px] text-teal-900">{next.why}</p>}
              </div>
              <div className="col-start-2 sm:col-start-auto"><ActionButton task={next} large /></div>
            </div>
            <ul className="mt-1">{restVisible.map((task) => <Row key={idOf(task)} task={task} />)}</ul>
          </>
        )}
        {(hiddenCount > 0 || showAll || done.length > 0) && (
          <div className="mt-2 flex flex-wrap justify-between gap-2 text-[13px] text-stone-500">
            {hiddenCount > 0 || showAll ? (
              <button type="button" onClick={() => setShowAll((v) => !v)}>{showAll ? "Mostrar menos" : <>+ {hiddenCount} de menor prioridade · <b className="text-teal-800">ver todas</b></>}</button>
            ) : <span />}
            {done.length > 0 && <button type="button" onClick={() => setShowDone((v) => !v)}>Feitas hoje ({done.length}) {showDone ? "▴" : "▾"}</button>}
          </div>
        )}
        {showDone && done.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm text-stone-400">{done.map((d) => <li key={d.id} className="flex items-center gap-2 line-through"><CheckCircle2 size={15} className="text-teal-700" /> {d.title}</li>)}</ul>
        )}
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-[20px] border border-stone-200 bg-white px-5 py-5 sm:px-6">
          <h2 className="text-xl font-bold">Esta semana</h2>
          {days.length === 0 ? <p className="mt-3 text-sm text-stone-500">Nada previsto para os próximos 7 dias.</p> : days.map((day) => (
            <div key={day.date} className="mt-3">
              <p className="flex justify-between border-b border-stone-100 pb-1 text-xs font-bold uppercase tracking-[.1em] text-stone-500">
                <span>{dayTitle(day.date)}</span>
                {day.net !== 0 && <span className={day.net > 0 ? "text-emerald-700" : "text-red-700"}>{signed(day.net)}</span>}
              </p>
              <ul>
                {day.items.map((item) => (
                  <li key={item.key} className="flex justify-between gap-3 border-b border-stone-50 py-2 text-sm">
                    <span className={item.alert ? "font-semibold text-red-700" : ""}>{item.label}{item.note ? <span className={item.warn ? " font-semibold text-amber-700" : " text-stone-500"}> · {item.note}</span> : null}</span>
                    {item.amount !== null && <span className={`font-bold ${item.amount >= 0 ? "text-emerald-700" : "text-red-700"}`}>{signed(item.amount)}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
        <section className="flex flex-col justify-between rounded-[20px] border border-stone-200 bg-white px-5 py-5 sm:px-6">
          <div>
            <h2 className="text-xl font-bold">Como estamos indo</h2>
            {glance ? (
              <>
                <p className="mt-2 text-3xl font-extrabold tracking-tight">{short(glance.revenue)} <span className="text-base font-semibold text-stone-500">no mês</span></p>
                <p className="mt-1 text-sm text-stone-600">
                  {[change ? `${change.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}× o mês anterior` : null, glance.marginPercent !== null ? `margem ${Math.round(glance.marginPercent)}%` : null, glance.projection > glance.revenue ? `projeção ${short(glance.projection)}` : null].filter(Boolean).join(" · ")}
                </p>
                {target > 0 && (
                  <>
                    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-stone-100"><span className="block h-full rounded-full bg-teal-700" style={{ width: `${pct}%` }} /></div>
                    <p className="mt-1 text-xs text-stone-500">{pct}% {glance.goal ? "da meta" : "da projeção"} · {glance.daysLeft} {glance.daysLeft === 1 ? "dia" : "dias"} para fechar{glance.goal ? "" : " · meta não definida"}</p>
                  </>
                )}
              </>
            ) : <p className="mt-2 text-sm text-stone-500">Reunindo os números…</p>}
          </div>
          {canSeeBi && <Link href="/bi" className="mt-4 inline-flex items-center gap-1.5 text-[15px] font-extrabold text-teal-800">Ver como estamos indo <ArrowRight size={16} /></Link>}
        </section>
      </div>
    </div>
  );
}
