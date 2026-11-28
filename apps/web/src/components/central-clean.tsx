"use client";

import * as React from "react";
import Link from "next/link";
import { getApiBaseUrl } from "@/lib/api-url";
import { saleTime, type SnoozeAction } from "@/lib/command-center-v6";
import {
  GROUP_COLOR,
  GROUP_ORDER,
  GROUP_SHORT,
  SHIP_LABEL,
  compact,
  founderPhotos,
  goalProgress,
  groupBars,
  journeyStations,
  monthReading,
  productPhoto,
  stuckStation,
  type Bar,
  type DayGroups,
  type ShipState,
  type Station,
} from "@/lib/central-clean";
import type { CenterTask } from "./command-center-v4";
import type { TodayTask } from "./command-center-today";

export type CleanSale = { id: string; code: string; at: string; amount: number; channel: string; item?: string | null; ship?: ShipState | null };
export type CleanToday = { total: number; orders: number; feed: CleanSale[]; shipping?: { toShip: number; late: number } };
type GroupsResponse = { since: string; days: DayGroups[]; month: { key: string; total: number; orders: number; previousTotal: number; groups: Array<{ name: string; revenue: number; orders: number }> } };

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const brl2 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const card = "rounded-[22px] border border-stone-200 bg-white";
const label = "text-[12px] font-extrabold uppercase tracking-[.07em] text-stone-500";
const DONE_KEY = "bbos.center.doneToday";
const todayKey = () => new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);

/**
 * Central de comando limpa: três números no topo (hoje, mês contra a meta,
 * caixa), uma decisão de cada vez, as vendas de hoje com a situação do envio,
 * a jornada do café e um gráfico só das vendas por grupo. Cada número aparece
 * uma vez; o lucro fica em Análises.
 */
export function CentralClean({
  greeting, firstName, dateLabel, tasks, onAct, today, month, cash, journey, canSeeBi, canSetGoal, onSaveGoal, newMenu, freshness,
}: {
  greeting: string;
  firstName: string;
  dateLabel: string;
  tasks: TodayTask[];
  onAct: (task: CenterTask, action: SnoozeAction | "DISMISS") => Promise<boolean>;
  today: CleanToday | null;
  month: { key: string; revenue: number; previousRevenue: number; goal: number | null; dayOfMonth: number; daysInMonth: number };
  cash: { value: string; note?: string; href: string; tone?: "warn" | "bad" };
  journey: { greenDays: number | null | undefined; roastBehindKg: number; late: number };
  canSeeBi: boolean;
  canSetGoal: boolean;
  onSaveGoal: (month: string, value: number | null) => Promise<string | null>;
  newMenu: React.ReactNode;
  freshness: string;
}) {
  const photos = founderPhotos(firstName);
  // Vendas por grupo: a mesma conta alimenta o faturamento do mês, a comparação e o gráfico.
  const [groups, setGroups] = React.useState<GroupsResponse | null>(null);
  React.useEffect(() => {
    if (!canSeeBi) return;
    void fetch(`${getApiBaseUrl()}/command-center/sales-groups`, { credentials: "include", cache: "no-store" })
      .then(async (r) => (r.ok ? ((await r.json()) as GroupsResponse) : null))
      .then(setGroups)
      .catch(() => setGroups(null));
  }, [canSeeBi]);
  const monthView = groups && groups.month.key === month.key
    ? { ...month, revenue: groups.month.total, previousRevenue: groups.month.previousTotal }
    : month;
  const stations = journeyStations({ ...journey, toShip: today?.shipping?.toShip ?? 0 });
  return (
    <div className="mx-auto max-w-[1260px] px-1 pb-10 text-stone-900">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          {photos.me && <img src={photos.me.src} alt="" className="size-[52px] rounded-full object-cover object-[50%_25%]" />}
          <div>
            <h1 className="text-[24px] font-bold tracking-tight">{greeting}{firstName ? `, ${firstName}` : ""}</h1>
            <p className="text-[13.5px] text-stone-500">{dateLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <DayRing tasks={tasks} />
          {newMenu}
        </div>
      </header>

      <section className="mt-[18px] grid grid-cols-2 gap-3 md:grid-cols-[1fr_2.1fr_1fr] md:gap-3.5">
        <div className={`${card} p-4`}>
          <p className={label}>Vendido hoje</p>
          <p className="mt-1 text-[32px] font-extrabold leading-tight tracking-tight">{today ? brl.format(today.total) : "—"}</p>
          <p className="text-[13px] text-stone-500">{today ? `em ${today.orders} ${today.orders === 1 ? "pedido" : "pedidos"}` : "carregando…"}</p>
        </div>
        <MonthTile month={monthView} canSetGoal={canSetGoal} onSaveGoal={onSaveGoal} />
        <Link href={cash.href} className={`${card} block p-4 hover:border-stone-300`}>
          <p className={label}>Caixa</p>
          <p className={`mt-1 text-[32px] font-extrabold leading-tight tracking-tight ${cash.tone === "bad" ? "text-red-700" : ""}`}>{cash.value}</p>
          {cash.note && <p className={`text-[13px] ${cash.tone ? "text-amber-700" : "text-stone-500"}`}>{cash.note}</p>}
        </Link>
      </section>

      <section className="mt-3.5 grid items-stretch gap-3.5 lg:grid-cols-[1.2fr_1fr]">
        <Decisions tasks={tasks} onAct={onAct} />
        <TodaySales today={today} partner={photos.partner} />
      </section>

      <Journey stations={stations} />

      {groups && <SalesByGroup data={groups} />}

      <p className="mt-4 text-[12px] text-stone-400">{freshness}</p>
    </div>
  );
}

function readDone(): string[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(DONE_KEY) || "{}") as { day?: string; items?: Array<{ id: string }> };
    return raw.day === todayKey() ? (raw.items ?? []).map((i) => i.id) : [];
  } catch {
    return [];
  }
}

function DayRing({ tasks }: { tasks: TodayTask[] }) {
  const [done, setDone] = React.useState<string[]>([]);
  React.useEffect(() => {
    setDone(readDone());
    const on = () => setDone(readDone());
    window.addEventListener("bbos:center-done", on);
    return () => window.removeEventListener("bbos:center-done", on);
  }, []);
  const total = tasks.length + done.length;
  const ratio = total ? done.length / total : 0;
  return (
    <div className="flex items-center gap-2.5" aria-label={`Seu dia: ${done.length} de ${total} resolvidas`}>
      <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden>
        <circle cx="26" cy="26" r="21" fill="none" stroke="#e6e8e7" strokeWidth="6" />
        <circle cx="26" cy="26" r="21" fill="none" stroke="#1f6b4f" strokeWidth="6" strokeLinecap="round" strokeDasharray="132" strokeDashoffset={132 - 132 * ratio} transform="rotate(-90 26 26)" style={{ transition: "stroke-dashoffset .5s" }} />
        <text x="26" y="31" textAnchor="middle" fontSize="13" fontWeight="800" fill="#111413">{done.length}/{total}</text>
      </svg>
      <div className="leading-tight">
        <b className="block text-[14px]">Seu dia</b>
        <span className="text-[12.5px] text-stone-500">{tasks.length ? `${tasks.length} ${tasks.length === 1 ? "decisão" : "decisões"}` : "tudo resolvido"}</span>
      </div>
    </div>
  );
}

function MonthTile({ month, canSetGoal, onSaveGoal }: {
  month: { key: string; revenue: number; previousRevenue: number; goal: number | null; dayOfMonth: number; daysInMonth: number };
  canSetGoal: boolean;
  onSaveGoal: (month: string, value: number | null) => Promise<string | null>;
}) {
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const goal = goalProgress(month.revenue, month.goal, month.dayOfMonth, month.daysInMonth);
  const monthName = new Date(`${month.key}-15T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long" });
  const ratio = month.previousRevenue > 0 ? month.revenue / month.previousRevenue : null;
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(value.replace(/\D/g, ""));
    if (!n) return setError("Digite um valor, por exemplo 35000.");
    setBusy(true);
    const problem = await onSaveGoal(month.key, n);
    setBusy(false);
    if (problem) return setError(problem);
    setEditing(false);
    setError("");
  };
  return (
    <div className={`${card} order-3 col-span-2 grid items-end gap-5 p-4 sm:grid-cols-[auto_1fr] md:order-none md:col-span-1`}>
      <div>
        <p className={label}>Faturamento de {monthName}</p>
        <p className="mt-1 text-[32px] font-extrabold leading-tight tracking-tight">{compact(month.revenue)}</p>
        <p className="text-[13px] text-stone-500">
          {ratio === null ? "sem o mês anterior para comparar" : ratio >= 1.95
            ? <><b className="text-[#1f6b4f]">{ratio.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}×</b> o mês passado no mesmo período ({compact(month.previousRevenue)})</>
            : <><b className={ratio >= 1 ? "text-[#1f6b4f]" : "text-amber-700"}>{ratio >= 1 ? "▲" : "▼"} {Math.abs(Math.round((ratio - 1) * 100))}%</b> contra o mês passado no mesmo período</>}
        </p>
      </div>
      <div className="pb-1">
        {goal ? (
          <>
            <div className="flex justify-between text-[13px] text-stone-700">
              <span>Meta <b>{brl.format(month.goal!)}</b></span>
              <b className={goal.onTrack ? "text-[#1f6b4f]" : "text-amber-700"}>{goal.percent}%</b>
            </div>
            <div className="relative mt-1.5 h-2.5 rounded-full bg-stone-100" role="img" aria-label={`${goal.percent}% da meta; hoje deveria estar em ${goal.expected}%`}>
              <i className="block h-full rounded-full bg-[#1f6b4f] transition-[width] duration-500" style={{ width: `${Math.min(100, goal.percent)}%` }} />
              <u className="absolute -bottom-[3px] -top-[3px] w-0.5 bg-stone-900" style={{ left: `${goal.expected}%` }} title="onde deveria estar hoje" />
            </div>
            <p className="mt-1.5 text-[12.5px] text-stone-500">
              {goal.missing ? `faltam ${brl.format(goal.missing)} em ${goal.daysLeft} ${goal.daysLeft === 1 ? "dia" : "dias"}` : "meta batida"} · a linha preta é onde deveria estar hoje
              {canSetGoal && <> · <button type="button" onClick={() => { setValue(String(month.goal)); setEditing(true); }} className="font-bold text-[#1f6b4f]">mudar</button></>}
            </p>
          </>
        ) : (
          <>
            <div className="flex justify-between text-[13px] text-stone-700"><span>Meta de {monthName}</span><span className="text-stone-500">não definida</span></div>
            <div className="mt-1.5 h-2.5 rounded-full bg-stone-100" />
            {canSetGoal && !editing && <button type="button" onClick={() => setEditing(true)} className="mt-1.5 text-[13px] font-extrabold text-[#1f6b4f]">Definir meta</button>}
          </>
        )}
        {editing && (
          <form onSubmit={save} className="mt-2 flex flex-wrap items-center gap-1.5">
            <input autoFocus inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} placeholder="ex.: 35000" aria-label="Meta do mês em reais" className="h-9 w-32 rounded-lg border border-stone-300 px-2.5 text-sm" />
            <button disabled={busy} className="h-9 rounded-lg bg-stone-900 px-3 text-sm font-bold text-white disabled:opacity-50">Salvar</button>
            <button type="button" onClick={() => { setEditing(false); setError(""); }} className="h-9 px-2 text-sm font-bold text-stone-500">Cancelar</button>
            {error && <span role="alert" className="w-full text-[12.5px] text-red-700">{error}</span>}
          </form>
        )}
      </div>
    </div>
  );
}

const TONE_TAG = { critical: "bg-red-50 text-red-700", attention: "bg-amber-50 text-amber-800", ok: "bg-stone-100 text-stone-600" };

function Decisions({ tasks, onAct }: { tasks: TodayTask[]; onAct: (task: CenterTask, action: SnoozeAction | "DISMISS") => Promise<boolean> }) {
  const [gone, setGone] = React.useState<Set<string>>(new Set());
  const [first, setFirst] = React.useState<string | null>(null);
  const [leaving, setLeaving] = React.useState<"out" | "later" | null>(null);
  const idOf = (t: CenterTask) => `${t.key}|${t.title}`;
  const open = tasks.filter((t) => !gone.has(idOf(t)));
  const pinned = first ? open.find((t) => idOf(t) === first) : undefined;
  const ordered = pinned ? [pinned, ...open.filter((t) => t !== pinned)] : open;
  const [top, ...rest] = ordered;

  const act = async (task: TodayTask, action: SnoozeAction) => {
    const id = idOf(task);
    setLeaving(action === "DONE" ? "out" : "later");
    if (action === "DONE") {
      try {
        const raw = JSON.parse(window.localStorage.getItem(DONE_KEY) || "{}") as { day?: string; items?: Array<{ id: string; title: string; at: string }> };
        const items = raw.day === todayKey() ? raw.items ?? [] : [];
        window.localStorage.setItem(DONE_KEY, JSON.stringify({ day: todayKey(), items: [...items.filter((i) => i.id !== id), { id, title: task.title, at: new Date().toISOString() }] }));
        window.dispatchEvent(new Event("bbos:center-done"));
      } catch { /* opcional */ }
    }
    window.setTimeout(() => { setGone((g) => new Set(g).add(id)); setLeaving(null); setFirst(null); }, 320);
    const ok = await onAct(task, action);
    if (!ok) setGone((g) => { const n = new Set(g); n.delete(id); return n; });
  };

  return (
    <div className={`${card} p-4`}>
      <p className={label}>Pede você · uma de cada vez</p>
      <div className="relative mt-2.5 min-h-[150px]">
        {top ? (
          <div className={`flex min-h-[150px] flex-col rounded-[18px] border border-stone-200 p-4 transition duration-300 ${leaving === "out" ? "translate-x-[110%] opacity-0" : leaving === "later" ? "translate-y-6 scale-95 opacity-0" : ""}`}>
            <span className={`self-start rounded-full px-2.5 py-0.5 text-[12px] font-extrabold ${TONE_TAG[top.tone]}`}>{top.tone === "critical" ? "urgente" : top.due ?? top.area}</span>
            <h2 className="mt-1.5 text-[19px] font-bold tracking-tight">{top.title}</h2>
            <p className="mt-0.5 text-[14px] text-stone-600">{top.detail}</p>
            {top.why && <p className="mt-0.5 text-[13px] text-stone-500">{top.why}</p>}
            <div className="mt-auto flex flex-wrap gap-2 pt-3">
              {top.href.startsWith("https://wa.me")
                ? <a href={top.href} target="_blank" rel="noreferrer" className="inline-flex min-h-[42px] items-center rounded-xl bg-[#25d366] px-4 text-[13.5px] font-extrabold text-white">{top.action}</a>
                : <Link href={top.href} className="inline-flex min-h-[42px] items-center rounded-xl bg-stone-900 px-4 text-[13.5px] font-extrabold text-white">{top.action}</Link>}
              <button type="button" onClick={() => void act(top, "DONE")} className="min-h-[42px] rounded-xl border border-stone-200 px-4 text-[13.5px] font-extrabold text-stone-700">Feito</button>
              <button type="button" onClick={() => void act(top, "TOMORROW")} className="min-h-[42px] rounded-xl bg-stone-100 px-4 text-[13.5px] font-extrabold text-stone-600">Depois</button>
            </div>
          </div>
        ) : (
          <div className="grid min-h-[150px] place-items-center rounded-[18px] bg-[#e5f2eb] text-center font-extrabold text-[#1f6b4f]">
            <div>Tudo em dia.<br /><span className="text-[14px] font-semibold">nada mais pede você hoje</span></div>
          </div>
        )}
      </div>
      {rest.length > 0 && (
        <ul className="mt-2.5">
          {rest.map((t) => (
            <li key={idOf(t)}>
              <button type="button" onClick={() => setFirst(idOf(t))} className="grid w-full grid-cols-[10px_1fr_auto] items-center gap-2.5 border-t border-stone-100 px-0.5 py-2 text-left text-[14px] hover:bg-stone-50">
                <span className={`size-2 rounded-full ${t.tone === "critical" ? "bg-red-600" : t.tone === "attention" ? "bg-amber-500" : "bg-stone-300"}`} aria-hidden />
                <b className="truncate font-semibold">{t.title}</b>
                <span className="text-[12.5px] text-stone-500">abrir ›</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const SHIP_TONE = { amber: "bg-amber-50 text-amber-800", gray: "bg-stone-100 text-stone-600", green: "bg-[#e5f2eb] text-[#1f6b4f]" };

function TodaySales({ today, partner }: { today: CleanToday | null; partner: { name: string; src: string } | null }) {
  return (
    <div className={`${card} flex flex-col p-4`}>
      <p className={label}><span className="mr-1.5 inline-block size-2 animate-pulse rounded-full bg-green-600 align-middle" aria-hidden />Vendas de hoje</p>
      <div className="mt-2">
        {!today && <p className="py-6 text-center text-[13px] text-stone-400">carregando…</p>}
        {today && today.feed.length === 0 && <p className="py-6 text-center text-[13px] text-stone-500">Nenhuma venda ainda hoje.</p>}
        {today?.feed.map((sale, i) => {
          const photo = productPhoto(sale.item);
          const ship = sale.ship ? SHIP_LABEL[sale.ship] : null;
          return (
            <div key={sale.id} className={`grid grid-cols-[38px_1fr_auto] items-center gap-2.5 py-[7px] ${i ? "border-t border-stone-100" : ""}`}>
              {photo ? <img src={photo} alt="" className="size-[38px] rounded-[9px] object-cover object-[50%_40%]" /> : <span className="grid size-[38px] place-items-center rounded-[9px] bg-stone-100 text-[13px] font-bold text-stone-500" aria-hidden>{sale.channel.slice(0, 1)}</span>}
              <div className="min-w-0">
                <b className="text-[14px]">{sale.channel} · {brl2.format(sale.amount)}</b>
                <div className="truncate text-[12.5px] text-stone-500">{[sale.item, saleTime(sale.at)].filter(Boolean).join(" · ")}</div>
              </div>
              {ship && <em className={`whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11.5px] font-extrabold not-italic ${SHIP_TONE[ship.tone]}`}>{ship.text}</em>}
            </div>
          );
        })}
      </div>
      {partner && (
        <div className="mt-auto flex items-center gap-2 pt-2.5 text-[12.5px] text-stone-500">
          <img src={partner.src} alt="" className="size-[26px] rounded-full object-cover object-[50%_25%]" />
          {partner.name} também acompanha o dia
        </div>
      )}
    </div>
  );
}

const TONE_STROKE = { ok: "#c9cecb", warn: "#d9a91a", bad: "#c62828" };

function bean(cx: number, cy: number, rot: number, fill: string, crease: string, scale = 1) {
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${rot}) scale(${scale})`}>
      <ellipse rx="11" ry="7.5" fill={fill} />
      <path d="M-9 0 C-4 -3.5 4 3.5 9 0" stroke={crease} strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </g>
  );
}

function Journey({ stations }: { stations: Station[] }) {
  const [motion, setMotion] = React.useState(false);
  React.useEffect(() => { setMotion(!window.matchMedia("(prefers-reduced-motion: reduce)").matches); }, []);
  const xs = [130, 463, 796, 1070];
  const y = 42;
  const G = "#9cb86a", GC = "#6f8a42", B = "#6b4226", BC = "#3d2414";
  const stuck = stuckStation(stations);
  const pile = stations[2]!.tone === "ok" ? 0 : 6;
  const flowing = (from: number, to: number, fill: string, crease: string, n: number, dur: number) =>
    motion ? Array.from({ length: n }, (_, i) => (
      <g key={`${from}-${i}`}>
        {bean(0, 0, 0, fill, crease, 0.6)}
        <animateMotion dur={`${dur}s`} begin={`${-i * (dur / n)}s`} repeatCount="indefinite" path={`M${from} ${y} L${to} ${y}`} />
      </g>
    )) : null;
  return (
    <section className={`${card} mt-3.5 px-4 pb-1.5 pt-3.5`}>
      <div className="flex flex-wrap justify-between gap-2">
        <p className={label}>A jornada do café</p>
        <span className="text-[12.5px] text-stone-500">{stuck >= 0 ? "a cor mostra onde o café parou" : "o café está andando em todas as etapas"}</span>
      </div>
      <ul className="mt-2 sm:hidden">
        {stations.map((s, i) => (
          <li key={s.key}><a href={s.href} className={`flex items-center justify-between py-2 text-[14px] ${i ? "border-t border-stone-100" : ""}`}><span className="flex items-center gap-2"><i className="size-2.5 rounded-full" style={{ background: TONE_STROKE[s.tone] }} /><b>{s.label}</b></span><span className={s.tone === "bad" ? "font-bold text-red-700" : s.tone === "warn" ? "text-amber-800" : "text-stone-500"}>{s.status}</span></a></li>
        ))}
      </ul>
      <svg viewBox="0 0 1200 120" className="hidden h-auto w-full sm:block" role="img" aria-label={stations.map((s) => `${s.label}: ${s.status}`).join("; ")}>
        <path d={`M60 ${y} L1140 ${y}`} stroke="#eceeed" strokeWidth="8" strokeLinecap="round" />
        {flowing(xs[0]! + 34, xs[1]! - 34, G, GC, 4, 3.2)}
        {flowing(xs[1]! + 34, xs[2]! - (pile ? 52 : 34), B, BC, 4, 3.2)}
        {Array.from({ length: pile }, (_, i) => <React.Fragment key={`p${i}`}>{bean(xs[2]! - 48 - i * 11, y + (i % 2 ? 4 : -4), ((i * 37) % 60) - 30, "#7a4a2a", BC, 0.58)}</React.Fragment>)}
        {stations[2]!.tone === "ok" && flowing(xs[2]! + 34, xs[3]! - 34, B, BC, 2, 4)}
        {stations.map((s, i) => {
          const hot = i === stuck;
          const x = xs[i]!;
          return (
            <a key={s.key} href={s.href} aria-label={`${s.label}: ${s.status}`}>
              <circle cx={x} cy={y} r="28" fill="#fff" stroke={TONE_STROKE[s.tone]} strokeWidth={hot ? 4 : 3}>
                {hot && motion && <animate attributeName="r" values="28;31;28" dur="1.6s" repeatCount="indefinite" />}
              </circle>
              {i === 0 && <>{bean(x - 7, y - 4, -25, G, GC, 0.85)}{bean(x + 7, y + 5, 20, "#a9c47a", GC, 0.85)}</>}
              {(i === 1 || i === 2) && bean(x, y, 0, B, BC, 0.95)}
              {i === 3 && <><path d={`M${x - 10} ${y + 10} a10 10 0 0 1 20 0`} fill="none" stroke="#3d4441" strokeWidth="2.4" /><circle cx={x} cy={y - 5} r="6" fill="none" stroke="#3d4441" strokeWidth="2.4" /></>}
              <text x={x} y={y + 50} textAnchor="middle" fontSize="15" fontWeight="800" fill="#111413">{s.label}</text>
              <text x={x} y={y + 69} textAnchor="middle" fontSize="13" fontWeight={s.tone === "bad" ? 800 : 500} fill={s.tone === "bad" ? "#c62828" : s.tone === "warn" ? "#92400e" : "#6b716e"}>{s.status}</text>
            </a>
          );
        })}
      </svg>
    </section>
  );
}

function SalesByGroup({ data }: { data: GroupsResponse }) {
  const [mode, setMode] = React.useState<"weeks" | "days">("weeks");
  const [table, setTable] = React.useState(false);
  const [hover, setHover] = React.useState<{ i: number; x: number; y: number } | null>(null);
  const box = React.useRef<HTMLDivElement>(null);
  const today = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);
  const bars = groupBars(data.days, mode, data.since, today);
  const present = GROUP_ORDER.filter((g) => data.days.some((d) => (d.groups[g] ?? 0) > 0));
  const monthTotal = data.month.total;
  const monthOrders = data.month.orders;
  const reading = monthReading(data.month.groups);
  const monthName = new Date(`${data.month.key}-15T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long" });
  return (
    <section className="mt-3.5 grid gap-3.5 lg:grid-cols-[1.5fr_1fr]">
      <div ref={box} className={`${card} relative p-4`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-[16px] font-bold">Vendas por grupo</h3>
            <p className="text-[13px] text-stone-500">{mode === "weeks" ? "as últimas 8 semanas · passe o mouse nas barras" : "os últimos 14 dias · passe o mouse nas barras"}</p>
          </div>
          <div className="inline-flex rounded-[10px] bg-stone-100 p-[3px]" role="tablist">
            {(["weeks", "days"] as const).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`rounded-lg px-2.5 py-1 text-[12.5px] font-bold ${mode === m ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"}`}>{m === "weeks" ? "8 semanas" : "14 dias"}</button>
            ))}
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1 text-[12.5px] text-stone-700">
          {present.map((g) => <span key={g}><i className="mr-1.5 inline-block size-2.5 rounded-[3px] align-[-1px]" style={{ background: GROUP_COLOR[g] }} />{GROUP_SHORT[g] ?? g}</span>)}
        </div>
        <BarsSvg bars={bars} groups={present} onHover={(i, e) => {
          if (i === null || !e || !box.current) return setHover(null);
          const r = box.current.getBoundingClientRect();
          setHover({ i, x: e.clientX - r.left, y: e.clientY - r.top });
        }} />
        {hover && bars[hover.i] && (
          <div className="pointer-events-none absolute z-10 rounded-[10px] bg-stone-900 px-2.5 py-2 text-[12.5px] text-white" style={{ left: hover.x > (box.current?.clientWidth ?? 600) - 240 ? hover.x - 240 : hover.x + 14, top: hover.y - 20 }}>
            <b className="block">{bars[hover.i]!.title}</b>
            {present.filter((g) => (bars[hover.i]!.values[g] ?? 0) > 0).map((g) => (
              <div key={g} className="flex justify-between gap-3.5"><span><i className="mr-1.5 inline-block size-2 rounded-[2px]" style={{ background: GROUP_COLOR[g] }} />{GROUP_SHORT[g] ?? g}</span><span>{brl2.format(bars[hover.i]!.values[g]!)}</span></div>
            ))}
            <div className="mt-1 flex justify-between border-t border-stone-700 pt-1 font-bold"><span>Total</span><span>{brl2.format(bars[hover.i]!.total)}</span></div>
          </div>
        )}
        <button type="button" onClick={() => setTable((t) => !t)} className="mt-1.5 text-[12.5px] font-bold text-stone-500">{table ? "esconder tabela" : "ver tabela"}</button>
        {table && (
          <div className="overflow-x-auto">
            <table className="mt-2 w-full border-collapse text-[12px]">
              <thead><tr><th className="border-b border-stone-200 p-1 text-left">{mode === "weeks" ? "Semana" : "Dia"}</th>{present.map((g) => <th key={g} className="border-b border-stone-200 p-1 text-right">{(GROUP_SHORT[g] ?? g).replace(" (parceira B2B)", "")}</th>)}</tr></thead>
              <tbody>{bars.map((b) => <tr key={b.label}><td className="border-b border-stone-100 p-1">{b.label}</td>{present.map((g) => <td key={g} className="border-b border-stone-100 p-1 text-right">{b.values[g] ? Math.round(b.values[g]!).toLocaleString("pt-BR") : "–"}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
      <div className={`${card} p-4`}>
        <h3 className="text-[16px] font-bold">De onde veio {monthName}</h3>
        <p className="text-[13px] text-stone-500">{compact(monthTotal)} em {monthOrders} {monthOrders === 1 ? "pedido" : "pedidos"}</p>
        <div className="mt-3">
          {[...data.month.groups].sort((a, b) => b.revenue - a.revenue).map((g, i) => {
            const pct = monthTotal ? (g.revenue / monthTotal) * 100 : 0;
            return (
              <div key={g.name} className={`grid grid-cols-[1fr_auto] gap-x-2.5 gap-y-0.5 py-[7px] text-[13.5px] ${i ? "border-t border-stone-100" : ""}`}>
                <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-[3px]" style={{ background: GROUP_COLOR[g.name] ?? "#9aa09d" }} />{GROUP_SHORT[g.name] ?? g.name}<span className="hidden text-[12px] text-stone-500 sm:inline">· {g.orders} {g.orders === 1 ? "pedido" : "pedidos"}</span></span>
                <span className="text-right font-bold">{brl.format(g.revenue)}<small className="ml-1.5 font-medium text-stone-500">{pct < 1 ? pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : Math.round(pct)}%</small></span>
                <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-stone-100"><i className="block h-full rounded-full" style={{ width: `${pct}%`, background: GROUP_COLOR[g.name] ?? "#9aa09d" }} /></span>
              </div>
            );
          })}
        </div>
        {reading && <p className="mt-2.5 rounded-xl bg-stone-50 px-3 py-2 text-[13px] text-stone-700"><b>Leitura:</b> {reading}</p>}
      </div>
    </section>
  );
}

function BarsSvg({ bars, groups, onHover }: { bars: Bar[]; groups: readonly string[]; onHover: (i: number | null, e?: React.MouseEvent) => void }) {
  const W = 720, H = 270, L = 36, B = 22, T = 18;
  const n = bars.length;
  const bw = (W - L - 8) / n;
  const max = Math.max(1, ...bars.map((b) => b.total)) * 1.08;
  const yy = (v: number) => H - B - (v / max) * (H - B - T);
  const step = max > 12000 ? 5000 : max > 6000 ? 2000 : max > 2500 ? 1000 : 500;
  const k = (v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k` : String(Math.round(v)));
  const ticks: number[] = [];
  for (let t = 0; t <= max; t += step) ticks.push(t);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-1.5 block h-auto w-full" onMouseLeave={() => onHover(null)} role="img" aria-label="Vendas por grupo; use ver tabela para os valores">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W} y1={yy(t)} y2={yy(t)} stroke="#eceeed" />
          <text x={L - 6} y={yy(t) + 4} textAnchor="end" fontSize="11" fill="#8a908d">{k(t)}</text>
        </g>
      ))}
      {bars.map((bar, i) => {
        const x = L + i * bw + bw * 0.18, w = bw * 0.64;
        const segs = groups.filter((g) => (bar.values[g] ?? 0) > 0);
        let base = 0;
        return (
          <g key={bar.label}>
            {segs.map((g, j) => {
              const v = bar.values[g]!;
              const gap = j ? 2 : 0;
              const y0 = yy(base) - gap, h = Math.max(1, yy(base) - yy(base + v) - gap);
              base += v;
              const topSeg = j === segs.length - 1;
              return topSeg && h > 4
                ? <path key={g} d={`M${x} ${y0} V${y0 - h + 4} q0 -4 4 -4 H${x + w - 4} q4 0 4 4 V${y0} Z`} fill={GROUP_COLOR[g]} />
                : <rect key={g} x={x} y={y0 - h} width={w} height={h} fill={GROUP_COLOR[g]} />;
            })}
            {bar.total > 0 && <text x={x + w / 2} y={yy(bar.total) - 5} textAnchor="middle" fontSize="11" fontWeight="700" fill="#3d4441">{k(bar.total)}</text>}
            <text x={x + w / 2} y={H - 6} textAnchor="middle" fontSize="10.5" fill="#8a908d">{bar.label}</text>
            <rect x={L + i * bw} y={T} width={bw} height={H - B - T} fill="transparent" onMouseMove={(e) => onHover(i, e)} />
          </g>
        );
      })}
    </svg>
  );
}
