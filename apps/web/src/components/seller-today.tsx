"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Navigation, Play, Plus, RefreshCw } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-url";
import { WhatsButton, type WhatsTarget } from "@/components/whatsapp-sheet";
import type { WhatsKind } from "@/lib/whatsapp";

export type SellerHomeData = {
  weeks: Array<{ start: string; revenue: number; kg: number; orders: number }>;
  weekDeltaPct: number | null;
  month: { revenue: number; orders: number; kg: number; ticket: number | null; perKg: number | null; activeCustomers: number; portfolio: number; dayOfMonth: number; daysInMonth: number; daysLeft: number; projection: number | null };
  products: Array<{ name: string; revenue: number; kg: number; share: number }>;
  weekdays: Array<{ day: string; orders: number }>;
  streak: number;
  needs: Array<{ kind: "DELIVERY_LATE" | "DELIVERY_SOON" | "DUE_OVERDUE" | "DUE_SOON"; customerId: string; customerName: string; phone: string; orderNumber: string | null; amount: number; date: string; daysLate: number }>;
  receivable: { open: number; overdue: number; next7: number };
  insights: Array<{ tone: "green" | "blue" | "orange" | "dark"; big: string; text: string }>;
};
type Track = { done: number; target: number | null; percent: number | null };
type Portfolio = {
  month: { revenue: Track };
  path: { opportunities: Array<{ customerId: string; name: string; phone: string | null; kind: string; value: number; reason: string }> };
  coach: string[];
  customers: Array<{ id: string; name: string; phone: string | null; status: string; daysSince: number | null; rhythm: number }>;
};
type Today = {
  day: { status: "ACTIVE" | "PAUSED" | "ENDED" } | null;
  route: Array<{ customerId: string; name: string; reason: string; value: number | null; distanceKm: number | null; visited: boolean }>;
};

export const brl = (v: number) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
const kgf = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg`;
const pct = (v: number) => `${v > 0 ? "▲" : v < 0 ? "▼" : ""} ${Math.abs(v)}%`;
const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
export const TONE: Record<string, string> = {
  green: "bg-[linear-gradient(135deg,#047857,#10b981)]",
  blue: "bg-[linear-gradient(135deg,#1e3a8a,#3b82f6)]",
  orange: "bg-[linear-gradient(135deg,#7c2d12,#ea580c)]",
  dark: "bg-[linear-gradient(135deg,#111827,#374151)]",
};
const NEED: Record<SellerHomeData["needs"][number]["kind"], { label: (n: SellerHomeData["needs"][number]) => string; pill: string; whats: WhatsKind; cta: string }> = {
  DELIVERY_LATE: { label: (n) => `pronto · atrasado ${n.daysLate} ${n.daysLate === 1 ? "dia" : "dias"}`, pill: "bg-red-50 text-red-700", whats: "DELIVERY_LATE", cta: "Avisar que está a caminho" },
  DUE_OVERDUE: { label: (n) => `venceu há ${n.daysLate} ${n.daysLate === 1 ? "dia" : "dias"}`, pill: "bg-red-50 text-red-700", whats: "DUE_OVERDUE", cta: "Cobrar com gentileza" },
  DUE_SOON: { label: (n) => `vence ${shortDate(n.date)}`, pill: "bg-amber-50 text-amber-800", whats: "DUE_SOON", cta: "Lembrar pelo WhatsApp" },
  DELIVERY_SOON: { label: (n) => `entrega ${shortDate(n.date)}`, pill: "bg-sky-50 text-sky-800", whats: "DELIVERY_SOON", cta: "Avisar a entrega" },
};

export function Kick({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return <p className={`text-[11px] font-extrabold uppercase tracking-[.1em] ${dark ? "text-stone-400" : "text-stone-500"}`}>{children}</p>;
}
export function Section({ title, aside }: { title: string; aside?: string }) {
  return <div className="mx-1 mb-2 mt-5 flex items-baseline justify-between"><h2 className="text-base font-bold">{title}</h2>{aside && <span className="text-xs text-stone-500">{aside}</span>}</div>;
}

/** Gráfico de linha simples com pontos tocáveis. */
export function TapLine({ points, format }: { points: Array<[string, number]>; format: (v: number) => string }) {
  const [sel, setSel] = useState(points.length - 1);
  useEffect(() => setSel(points.length - 1), [points]);
  const max = Math.max(1, ...points.map((p) => p[1]));
  const xy = points.map((p, i) => [16 + (i * 368) / Math.max(1, points.length - 1), 80 - (p[1] / max) * 66] as const);
  const line = xy.map((p) => p.join(",")).join(" ");
  const chosen = points[sel];
  return (
    <div className="mt-3">
      <p className="text-right text-xs font-bold text-stone-500">{chosen ? `Semana ${chosen[0]}: ${format(chosen[1])}` : ""}</p>
      <svg viewBox="0 0 400 92" className="h-24 w-full" preserveAspectRatio="none" role="img" aria-label="Evolução por semana">
        <polygon points={`16,92 ${line} 384,92`} fill="rgba(16,185,129,.12)" />
        <polyline points={line} fill="none" stroke="#10b981" strokeWidth="3" strokeLinejoin="round" />
        {xy.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r={i === sel ? 7 : 5} fill={i === sel ? "#10b981" : "#fff"} stroke="#10b981" strokeWidth="2.5" className="cursor-pointer" onClick={() => setSel(i)} />
        ))}
      </svg>
      <div className="flex justify-between px-1 text-[11px] text-stone-400">{points.map((p) => <span key={p[0]}>{p[0]}</span>)}</div>
    </div>
  );
}

export function useSellerHome() {
  const [home, setHome] = useState<SellerHomeData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch(`${getApiBaseUrl()}/field/home`, { credentials: "include", cache: "no-store" })
      .then(async (r) => (r.ok ? setHome((await r.json()) as SellerHomeData) : setError("Não foi possível carregar seus números agora.")))
      .catch(() => setError("Sem conexão com o BBOS."));
  }, []);
  return { home, error };
}

/** Tela Hoje do vendedor: o "quanto" (Square), o ritmo e a ação (Tesla), a agenda e a leitura (Salesforce) e a BI. */
export function SellerToday({ greeting, firstName }: { greeting: string; firstName: string }) {
  const { home, error } = useSellerHome();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [today, setToday] = useState<Today | null>(null);
  const [tab, setTab] = useState<"week" | "month" | "kg">("week");

  useEffect(() => {
    const api = getApiBaseUrl();
    void fetch(`${api}/seller-portfolio`, { credentials: "include", cache: "no-store" }).then(async (r) => r.ok && setPortfolio((await r.json()) as Portfolio)).catch(() => undefined);
    void fetch(`${api}/field/today`, { credentials: "include", cache: "no-store" }).then(async (r) => r.ok && setToday((await r.json()) as Today)).catch(() => undefined);
  }, []);

  const chart = useMemo(() => {
    if (!home) return { value: "", sub: "", points: [] as Array<[string, number]>, format: brl };
    if (tab === "kg") {
      const cur = home.weeks.at(-1)?.kg ?? 0;
      return { value: kgf(home.month.kg), sub: `${kgf(cur)} nesta semana`, points: home.weeks.map((w) => [w.start, w.kg] as [string, number]), format: kgf };
    }
    if (tab === "month") {
      let acc = 0;
      return { value: brl(home.month.revenue), sub: `${home.month.orders} ${home.month.orders === 1 ? "pedido" : "pedidos"} no mês`, points: home.weeks.map((w) => [w.start, (acc += w.revenue)] as [string, number]), format: (v: number) => `${brl(v)} acumulado` };
    }
    const cur = home.weeks.at(-1)?.revenue ?? 0;
    return { value: brl(cur), sub: home.weekDeltaPct !== null ? `${pct(home.weekDeltaPct)} vs semana passada` : "nesta semana", points: home.weeks.map((w) => [w.start, w.revenue] as [string, number]), format: brl };
  }, [home, tab]);

  if (!home) return <p className="flex items-center gap-2 p-6 text-sm text-stone-500">{error || <><RefreshCw size={15} className="animate-spin" /> Montando o seu dia…</>}</p>;

  const m = home.month;
  const goal = portfolio?.month.revenue;
  const ring = goal?.target ? Math.min(100, goal.percent ?? 0) : Math.round((m.dayOfMonth / m.daysInMonth) * 100);
  const route = (today?.route ?? []).filter((r) => !r.visited);
  const atStake = route.reduce((t, r) => t + (r.value ?? 0), 0);
  const dayStatus = today?.day?.status ?? null;
  const phoneOf = (id: string) => portfolio?.customers.find((c) => c.id === id)?.phone ?? null;
  const target = (n: { customerId: string; customerName: string; phone: string | null }, kinds: WhatsKind[], extra: Partial<WhatsTarget> = {}): WhatsTarget => ({ ...n, kinds, ...extra });
  const brief = portfolio?.coach?.[0] ?? (home.needs[0] ? `${home.needs.length} ${home.needs.length === 1 ? "coisa pede" : "coisas pedem"} uma mensagem ao cliente hoje.` : "Tudo em dia na sua carteira.");
  const maxProduct = Math.max(1, ...home.products.map((p) => p.revenue));
  const maxKg = Math.max(1, ...home.weeks.map((w) => w.kg));
  const maxDay = Math.max(1, ...home.weekdays.map((d) => d.orders));

  return (
    <div className="mx-auto max-w-[820px] px-3 pb-28 pt-2 sm:px-5">
      <header className="mb-3 mt-1 flex items-end justify-between gap-3 px-1">
        <div><h1 className="text-[22px] font-bold tracking-tight">{greeting}{firstName ? `, ${firstName}` : ""}</h1>
          <p className="text-[13px] text-stone-500">{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" })} · {m.daysLeft === 0 ? "último dia do mês" : `${m.daysLeft} ${m.daysLeft === 1 ? "dia" : "dias"} para fechar o mês`}</p></div>
        {dayStatus === "ACTIVE" && <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-extrabold text-emerald-700">● em campo</span>}
      </header>

      {/* Vendido (Square) */}
      <section className="rounded-[22px] border border-stone-200 bg-white p-4">
        <Kick>Vendido</Kick>
        <p className="mt-1 text-[44px] font-extrabold leading-none tracking-[-.04em]">{chart.value}</p>
        <span className="mt-2 inline-block rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-700">{chart.sub}</span>
        <div className="mt-3 flex gap-1 rounded-xl bg-stone-100 p-1" role="tablist">
          {([["week", "Semana"], ["month", "Mês"], ["kg", "Kg"]] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)} className={`flex-1 rounded-lg py-2 text-[13px] font-extrabold ${tab === k ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"}`}>{l}</button>
          ))}
        </div>
        <TapLine points={chart.points} format={chart.format} />
        <div className="mt-3 grid grid-cols-4 gap-2 border-t border-stone-100 pt-3">
          {[[m.ticket !== null ? brl(m.ticket) : "—", "ticket médio"], [kgf(m.kg), "no mês"], [m.perKg !== null ? brl(m.perKg) : "—", "por kg"], [`${m.activeCustomers}/${m.portfolio}`, "carteira ativa"]].map(([v, l]) => (
            <div key={l}><b className="block text-[15px] tracking-tight">{v}</b><span className="text-[11px] text-stone-500">{l}</span></div>
          ))}
        </div>
      </section>

      {/* Ritmo + ação (Tesla) */}
      <section className="mt-2.5 rounded-[22px] bg-black p-4 text-white">
        <Kick dark>{goal?.target ? "Meta do mês" : "Ritmo do mês"}</Kick>
        <div className="mt-2 flex items-center gap-4">
          <svg viewBox="0 0 120 120" className="size-[108px] shrink-0" role="img" aria-label={`${ring}%`}>
            <circle cx="60" cy="60" r="50" fill="none" stroke="#1b2522" strokeWidth="10" />
            <circle cx="60" cy="60" r="50" fill="none" stroke="#10b981" strokeWidth="10" strokeLinecap="round" strokeDasharray="314" strokeDashoffset={314 - (314 * ring) / 100} transform="rotate(-90 60 60)" />
            <text x="60" y="58" textAnchor="middle" fill="#fff" fontSize="22" fontWeight="300">{ring}%</text>
            <text x="60" y="75" textAnchor="middle" fill="#7c8481" fontSize="10">{goal?.target ? "da meta" : "do mês"}</text>
          </svg>
          <div className="text-[13px] text-stone-400">Vendido<b className="block text-[26px] font-light tracking-tight text-white">{brl(m.revenue)}</b>
            {goal?.target ? <>Meta {brl(goal.target)}</> : m.projection ? <>No ritmo atual, fecha perto de <b className="block text-lg font-light text-white">~{brl(m.projection)}</b></> : "Meta ainda não definida."}</div>
        </div>
        <Link href="/campo" className="mt-3 flex items-center gap-3 rounded-2xl bg-[#0d1a17] p-2.5">
          <span className={`grid size-[52px] place-items-center rounded-full ${dayStatus === "ACTIVE" ? "bg-emerald-500 text-black" : "bg-white text-black"}`}><Play size={20} fill="currentColor" /></span>
          <span><b className="block">{dayStatus === "ACTIVE" ? "Dia em andamento" : dayStatus === "PAUSED" ? "Dia pausado" : "Iniciar dia"}</b>
            <span className="text-xs text-stone-400">{route.length ? `${route.length} ${route.length === 1 ? "parada" : "paradas"}${atStake ? ` · ~${brl(atStake)} em jogo` : ""}` : "abrir o Meu dia"}</span></span>
        </Link>
      </section>

      {/* Leitura + agenda (Salesforce) */}
      <section className="mt-2.5 rounded-[22px] bg-[linear-gradient(135deg,#032d60,#0b5cab)] p-4 text-white">
        <p className="text-[11px] font-extrabold uppercase tracking-[.1em] text-sky-200">✦ BBOS · seu resumo</p>
        <p className="mt-1.5 text-[17px] font-bold leading-snug">{brief}</p>
      </section>
      {(home.needs.length > 0 || route.length > 0) && (
        <ol className="relative mt-2 space-y-2 pl-6 before:absolute before:bottom-3 before:left-2 before:top-3 before:w-0.5 before:bg-slate-200">
          {home.needs.map((n, i) => {
            const meta = NEED[n.kind];
            return (
              <li key={`n${i}`} className="relative rounded-2xl border border-slate-200 bg-white p-3 before:absolute before:-left-[21px] before:top-4 before:size-3 before:rounded-full before:border-[2.5px] before:border-[#0b5cab] before:bg-white">
                <div className="flex items-start justify-between gap-2"><div><b className="text-[14.5px]">{n.customerName} · {brl(n.amount)}</b><p className="text-xs text-slate-500">{n.orderNumber ?? ""}</p></div><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ${meta.pill}`}>{meta.label(n)}</span></div>
                <div className="mt-2"><WhatsButton target={target(n, [meta.whats, "FREE"], { orderNumber: n.orderNumber, amount: n.amount, date: n.date })} label={meta.cta} /></div>
              </li>
            );
          })}
          {route.map((r, i) => (
            <li key={r.customerId} className={`relative rounded-2xl border bg-white p-3 before:absolute before:-left-[21px] before:top-4 before:size-3 before:rounded-full before:border-[2.5px] before:border-[#0b5cab] ${i === 0 ? "border-sky-300 shadow-[0_0_0_3px_#dbeafe] before:bg-[#0b5cab]" : "border-slate-200 before:bg-white"}`}>
              <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#0b5cab]">{i + 1}ª parada{r.distanceKm !== null ? ` · a ${r.distanceKm.toLocaleString("pt-BR")} km` : ""}</p>
              <b className="text-[14.5px]">{r.name}{r.value ? ` · ~${brl(r.value)}` : ""}</b>
              <p className="text-xs text-slate-500">{r.reason}</p>
              <div className="mt-2 flex gap-1.5">
                <WhatsButton compact target={target({ customerId: r.customerId, customerName: r.name, phone: phoneOf(r.customerId) }, ["RESTOCK", "VISIT", "FREE"])} />
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(r.name)}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl border border-slate-200 text-[13px] font-extrabold"><Navigation size={15} /> Ir</a>
                <Link href={`/pedidos?novo=1&cliente=${encodeURIComponent(r.customerId)}`} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-[#0b5cab] text-[13px] font-extrabold text-white"><Plus size={15} /> Pedido</Link>
              </div>
            </li>
          ))}
        </ol>
      )}

      {/* Leituras */}
      {home.insights.length > 0 && (<>
        <Section title="O que os números dizem" aside="deslize →" />
        <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1">
          {home.insights.map((ins) => (
            <div key={ins.big + ins.text} className={`flex min-h-[118px] w-[78%] shrink-0 snap-start flex-col justify-between rounded-[18px] p-3.5 text-white ${TONE[ins.tone]}`}>
              <b className="text-[26px] leading-none tracking-tight">{ins.big}</b><p className="mt-2 text-[13px] opacity-95">{ins.text}</p>
            </div>
          ))}
        </div>
      </>)}

      {/* Cafés */}
      {home.products.length > 0 && (<>
        <Section title="Seus cafés no mês" aside="receita · kg" />
        <div className="rounded-[22px] border border-stone-200 bg-white px-4 py-2">
          {home.products.map((p) => (
            <div key={p.name} className="grid grid-cols-[1fr_52px] items-center gap-2 py-1.5">
              <div><div className="flex justify-between text-[12.5px] font-bold"><span className="truncate pr-2">{p.name}</span><span className="font-semibold text-stone-500">{kgf(p.kg)}</span></div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-100"><i className="block h-full rounded-full bg-[linear-gradient(90deg,#047857,#10b981)]" style={{ width: `${(p.revenue / maxProduct) * 100}%` }} /></div></div>
              <b className="text-right text-[13px]">{p.share}%</b>
            </div>
          ))}
        </div>
      </>)}

      {/* Hábitos */}
      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        <div className="rounded-[22px] border border-stone-200 bg-white p-4"><Kick>Kg por semana</Kick>
          <div className="mt-2 flex h-[72px] items-end gap-1.5">{home.weeks.map((w, i) => (
            <div key={w.start} className="flex-1 text-center text-[10px] text-stone-500"><i className={`mb-1 block rounded-t-md ${i === home.weeks.length - 1 ? "bg-emerald-500" : "bg-emerald-100"}`} style={{ height: `${Math.max(4, (w.kg / maxKg) * 52)}px` }} />{w.start}</div>
          ))}</div></div>
        <div className="rounded-[22px] border border-stone-200 bg-white p-4"><Kick>Pedidos por dia</Kick>
          <div className="mt-3 flex gap-1">{home.weekdays.slice(0, 6).map((d) => (
            <div key={d.day} className="flex-1 text-center text-[10px] text-stone-500"><i className="mb-1 block h-9 rounded-lg" style={{ background: `rgba(16,185,129,${0.1 + (d.orders / maxDay) * 0.9})` }} />{d.day.slice(0, 3)}</div>
          ))}</div><p className="mt-1.5 text-[11px] text-stone-500">últimos 90 dias</p></div>
      </div>

      {/* Próximo melhor passo */}
      {(portfolio?.path.opportunities.length ?? 0) > 0 && (<>
        <Section title="Próximo melhor passo" aside="deslize →" />
        <div className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1">
          {portfolio!.path.opportunities.slice(0, 6).map((o) => (
            <div key={o.customerId + o.kind} className="w-[86%] shrink-0 snap-start rounded-[22px] border border-stone-200 bg-white p-4">
              <b className="text-lg">{o.name}</b><p className="text-[13px] text-stone-500">{o.reason}</p>
              {o.value > 0 && <p className="mt-2 rounded-xl bg-emerald-50 p-2.5 text-[13px] text-emerald-900">Potencial de <b>~{brl(o.value)}</b></p>}
              <div className="mt-2.5 flex gap-1.5">
                <WhatsButton target={{ customerId: o.customerId, customerName: o.name, phone: o.phone, kinds: ["RESTOCK", "VISIT", "FREE"] }} label="WhatsApp" />
                <Link href={`/pedidos?novo=1&cliente=${encodeURIComponent(o.customerId)}`} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-stone-900 text-[13px] font-extrabold text-white"><Plus size={15} /> Pedido</Link>
              </div>
            </div>
          ))}
        </div>
      </>)}

      {/* Carteira */}
      {(portfolio?.customers.length ?? 0) > 0 && (<>
        <Section title="Sua carteira" aside={`${portfolio!.customers.length} clientes`} />
        <div className="grid grid-cols-3 gap-2">
          {portfolio!.customers.slice(0, 9).map((c) => {
            const d = c.daysSince;
            const color = d === null ? "#d6d3d1" : d >= 20 ? "#dc2626" : d >= 8 ? "#d97706" : "#10b981";
            return (
              <Link key={c.id} href={`/clientes?cliente=${encodeURIComponent(c.id)}`} className="rounded-[18px] border border-stone-200 bg-white p-2.5 text-center">
                <span className="mx-auto mb-1.5 grid size-[50px] place-items-center rounded-full" style={{ background: `conic-gradient(${color} ${Math.min(100, (d ?? 0) * 4)}%, #eef0ec 0)` }}>
                  <span className="grid size-10 place-items-center rounded-full bg-white text-[13px] font-extrabold">{d === null ? "—" : `${d}d`}</span>
                </span>
                <b className="block truncate text-xs">{c.name}</b>
              </Link>
            );
          })}
        </div>
        <p className="mx-1 mt-1.5 text-[11px] text-stone-500">dias desde o último pedido · verde até 7, laranja até 19, vermelho 20+</p>
      </>)}

      {/* Sequência e meta */}
      {home.streak > 1 && (
        <div className="mt-3 flex items-center gap-3 rounded-[18px] border border-stone-200 bg-white p-3"><span className="text-2xl">🔥</span><div><b className="block">{home.streak} semanas seguidas vendendo</b><span className="text-xs text-stone-500">Mantenha a sequência: 1 pedido até sexta.</span></div></div>
      )}
      {!goal?.target && <div className="mt-2 rounded-[18px] border-[1.5px] border-dashed border-stone-300 p-3 text-[13px] text-stone-500">🎯 Sua meta do mês ainda não foi definida. Quando José ou Suzi definirem, ela aparece no anel com o seu progresso.</div>}
    </div>
  );
}
