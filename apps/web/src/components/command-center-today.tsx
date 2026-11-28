"use client";

import Link from "next/link";
import * as React from "react";
import { ArrowRight, CheckCircle2, MessageCircle } from "lucide-react";
import type { CenterTask, TimelineItem } from "@/components/command-center-v4";
import type { SnoozeAction } from "@/lib/command-center-v6";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const short = (v: number) => (Math.abs(v) >= 1000 ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : brl.format(v));
const weekday = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${d.toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" }).replace(".", "").replace(/^\w/, (c) => c.toUpperCase())} ${iso.slice(8, 10)}`;
};

export type Vital = { key: string; label: string; value: string; note?: string; tone?: "warn" | "bad" };
export type Glance = { revenue: number; projection: number; previousRevenue: number; marginPercent: number | null };

/**
 * Central de comando focada no que fazer hoje: sinais vitais pequenos,
 * até 5 tarefas com um botão que resolve, a semana e um resumo que leva à
 * Inteligência. Gráficos e detalhes ficam na Inteligência (Leitura).
 */
export function CommandCenterToday({
  greeting, firstName, dateLabel, tasks, vitals, timeline, glance, freshness, newMenu, onSnooze,
}: {
  greeting: string;
  firstName: string;
  dateLabel: string;
  tasks: CenterTask[];
  vitals: Vital[];
  timeline: TimelineItem[];
  glance: Glance | null;
  freshness: string;
  newMenu: React.ReactNode;
  onSnooze?: (task: CenterTask, action: SnoozeAction | "DISMISS") => Promise<boolean>;
}) {
  const [showAll, setShowAll] = React.useState(false);
  const [hidden, setHidden] = React.useState<Set<string>>(new Set());
  const list = tasks.filter((t) => !hidden.has(`${t.key}|${t.title}`));
  const visible = showAll ? list : list.slice(0, 5);
  const rest = list.length - visible.length;

  const act = async (task: CenterTask, action: SnoozeAction | "DISMISS") => {
    const id = `${task.key}|${task.title}`;
    setHidden((h) => new Set(h).add(id));
    const ok = onSnooze ? await onSnooze(task, action) : true;
    if (!ok) setHidden((h) => { const next = new Set(h); next.delete(id); return next; });
  };

  const change = glance && glance.previousRevenue > 0 ? glance.revenue / glance.previousRevenue : null;

  return (
    <div className="mx-auto max-w-[1080px] pb-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{greeting}{firstName ? `, ${firstName}` : ""}</h1>
          <p className="mt-1 text-[15px] text-stone-500">
            {dateLabel} · <strong className="text-stone-900">{list.length ? `${list.length} ${list.length === 1 ? "coisa pede" : "coisas pedem"} você hoje` : "Tudo em dia"}</strong>
          </p>
          <p className="mt-1 text-xs text-stone-400">{freshness}</p>
        </div>
        {newMenu}
      </header>

      <div className="mt-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {vitals.map((v) => (
          <div key={v.key} className={`rounded-2xl border px-4 py-3 ${v.tone === "bad" ? "border-red-200 bg-red-50" : v.tone === "warn" ? "border-amber-200 bg-amber-50" : "border-stone-200 bg-white"}`}>
            <p className="text-xs text-stone-500">{v.label}</p>
            <p className={`mt-0.5 text-2xl font-extrabold ${v.tone === "bad" ? "text-red-700" : v.tone === "warn" ? "text-amber-700" : ""}`}>{v.value}</p>
            {v.note && <p className="text-xs text-stone-500">{v.note}</p>}
          </div>
        ))}
      </div>

      <section className="mt-4 rounded-[20px] border border-stone-200 bg-white px-5 py-5 sm:px-6" aria-labelledby="fazer-hoje">
        <h2 id="fazer-hoje" className="flex items-center gap-2.5 text-xl font-bold">
          Fazer hoje {list.length > 0 && <span className="rounded-full bg-stone-900 px-2.5 py-0.5 text-xs text-white">{list.length}</span>}
        </h2>
        {list.length === 0 ? (
          <p className="mt-4 flex items-center gap-2 text-[15px] font-semibold text-emerald-800"><CheckCircle2 size={20} /> Tudo em dia. Nada pede você agora.</p>
        ) : (
          <>
            <p className="text-sm text-stone-500">por urgência e valor · toque no botão para resolver</p>
            <ul className="mt-2 divide-y divide-stone-100">
              {visible.map((task) => {
                const wa = task.href.startsWith("https://wa.me");
                return (
                  <li key={`${task.key}|${task.title}`} className="grid grid-cols-[6px_1fr] gap-x-4 gap-y-2 py-3.5 sm:grid-cols-[6px_1fr_auto_auto] sm:items-center">
                    <span className={`row-span-2 h-full min-h-[46px] w-1.5 rounded sm:row-span-1 ${task.tone === "critical" ? "bg-red-600" : task.tone === "attention" ? "bg-amber-600" : "bg-sky-600"}`} />
                    <div className="min-w-0">
                      <p className="text-base font-bold">{task.title}</p>
                      <p className="text-sm text-stone-500">{task.detail}{task.why ? ` · ${task.why}` : ""}</p>
                    </div>
                    <div className="col-start-2 flex flex-wrap items-center gap-2 sm:col-start-auto sm:contents">
                      {wa ? (
                        <a href={task.href} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#075E54] px-4 text-sm font-bold text-white"><MessageCircle size={15} /> {task.action}</a>
                      ) : (
                        <Link href={task.href} className="inline-flex min-h-[44px] items-center whitespace-nowrap rounded-xl bg-stone-900 px-4 text-sm font-bold text-white">{task.action}</Link>
                      )}
                      {onSnooze && (
                        <span className="flex gap-1.5">
                          <button type="button" onClick={() => void act(task, "DONE")} className="min-h-[40px] rounded-xl border border-stone-200 px-3 text-xs font-bold text-stone-600">feito</button>
                          <button type="button" onClick={() => void act(task, "TOMORROW")} className="min-h-[40px] rounded-xl border border-stone-200 px-3 text-xs font-bold text-stone-600">amanhã</button>
                          <button type="button" onClick={() => void act(task, "DISMISS")} className="min-h-[40px] rounded-xl border border-stone-200 px-3 text-xs font-bold text-stone-400">não se aplica</button>
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {(rest > 0 || showAll) && list.length > 5 && (
              <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 text-sm text-stone-500">
                {showAll ? "Mostrar só as 5 mais importantes" : <>+ {rest} {rest === 1 ? "item" : "itens"} de menor prioridade · <b className="text-teal-800">ver todos</b></>}
              </button>
            )}
          </>
        )}
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-[20px] border border-stone-200 bg-white px-5 py-5 sm:px-6">
          <h2 className="text-xl font-bold">Esta semana</h2>
          <p className="text-sm text-stone-500">o que entra, o que sai e os prazos</p>
          {timeline.length === 0 ? <p className="mt-3 text-sm text-stone-500">Nada previsto para os próximos 7 dias.</p> : (
            <ul className="mt-2 divide-y divide-stone-100">
              {timeline.map((item) => (
                <li key={item.key} className="grid grid-cols-[64px_1fr_auto] gap-3 py-2.5 text-sm">
                  <b>{weekday(item.date)}</b>
                  <span className={item.alert ? "font-semibold text-red-700" : ""}>
                    {item.label}
                    {item.note ? <span className={item.warn ? " font-semibold text-amber-700" : " text-stone-500"}> · {item.note}</span> : null}
                  </span>
                  <span className={`font-bold ${item.amount === null ? "" : item.amount >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {item.amount === null ? "" : `${item.amount >= 0 ? "+" : "−"}${brl.format(Math.abs(item.amount))}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="flex flex-col justify-between rounded-[20px] border border-stone-200 bg-gradient-to-br from-teal-50 to-white px-5 py-5 sm:px-6">
          <div>
            <h2 className="text-xl font-bold">Como estamos indo</h2>
            {glance ? (
              <>
                <p className="mt-2 text-3xl font-extrabold">{short(glance.revenue)} <span className="text-base font-semibold text-stone-500">no mês</span></p>
                <p className="mt-1 text-sm text-stone-600">
                  {[
                    change ? `${change >= 1 ? "" : "▼ "}${change.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}× o mês anterior` : null,
                    glance.marginPercent !== null ? `margem ${Math.round(glance.marginPercent)}%` : null,
                    glance.projection > glance.revenue ? `projeção ${short(glance.projection)}` : null,
                  ].filter(Boolean).join(" · ")}
                </p>
              </>
            ) : <p className="mt-2 text-sm text-stone-500">Reunindo os números…</p>}
          </div>
          <div className="mt-4">
            <p className="text-sm text-stone-500">Gráficos, lucro, clientes, caixa e o plano de ação ficam na Inteligência.</p>
            <Link href="/bi" className="mt-2 inline-flex items-center gap-1.5 text-[15px] font-extrabold text-teal-800">Ver como estamos indo <ArrowRight size={16} /></Link>
          </div>
        </section>
      </div>
    </div>
  );
}
