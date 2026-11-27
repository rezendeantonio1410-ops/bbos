"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, ClipboardCheck, MessageCircle, Plus, Sparkles, Target, UsersRound } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-url";

type Status = "COBRANCA" | "NOVO" | "ESFRIANDO" | "RECOMPRA" | "EM_DIA";
type PortfolioCustomer = {
  id: string; name: string; phone: string | null; status: Status; orders: number; daysSince: number | null;
  rhythm: number; thermometer: number; lastOrderAt: string | null; revenue90: number; overdueAmount: number;
  lastVisitAt: string | null; daysSinceVisit: number | null; avgTicket: number | null; pendingAmount: number;
  nextOrderInDays: number | null; nextStep: string;
};
type Track = { done: number; target: number | null; percent: number | null; projection: number; missing: number | null; perDay: number | null; onTrack: boolean | null };
type Opportunity = { customerId: string; name: string; phone: string | null; kind: "CONFIRMAR" | "RECOMPRA" | "ANTECIPAR" | "REATIVAR" | "PRIMEIRO"; value: number; reason: string };
type Portfolio = {
  generatedAt: string;
  month: { month: string; daysLeft: number; orders: number; revenue: Track; kg: Track };
  path: { gap: number | null; total: number; covers: boolean | null; opportunities: Opportunity[] };
  coach: string[];
  tasks: Array<{ customerId: string; status: Status; phone: string | null; title: string; detail: string; why: string }>;
  customers: PortfolioCustomer[];
};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const kgFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const STATUS: Record<Status, { label: string; pill: string; bar: string; order: number }> = {
  COBRANCA: { label: "Cobrança", pill: "bg-red-50 text-red-700", bar: "bg-amber-500", order: 0 },
  NOVO: { label: "Novo", pill: "bg-sky-50 text-sky-800", bar: "bg-sky-500", order: 1 },
  ESFRIANDO: { label: "Esfriando", pill: "bg-amber-50 text-amber-800", bar: "bg-red-500", order: 2 },
  RECOMPRA: { label: "Recompra chegando", pill: "bg-amber-50 text-amber-800", bar: "bg-amber-500", order: 3 },
  EM_DIA: { label: "Em dia", pill: "bg-emerald-50 text-emerald-800", bar: "bg-emerald-600", order: 4 },
};
const KIND: Record<Opportunity["kind"], { label: string; color: string }> = {
  CONFIRMAR: { label: "Confirmar pedido", color: "#2f80b8" },
  RECOMPRA: { label: "Recompra", color: "#1f6b4f" },
  ANTECIPAR: { label: "Antecipar", color: "#7fb89d" },
  REATIVAR: { label: "Reativar", color: "#b86b00" },
  PRIMEIRO: { label: "1º pedido", color: "#2f80b8" },
};

function whatsapp(phone: string | null, text: string) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  const number = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits.startsWith("55") && digits.length >= 12 ? digits : null;
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : null;
}

function waText(kind: Status | Opportunity["kind"], name: string) {
  const first = name.split(" ")[0];
  if (kind === "COBRANCA") return "Olá! Aqui é da Bispo Coffees. Tudo bem? Consta um pagamento em aberto. Posso te enviar o Pix ou o boleto?";
  if (kind === "NOVO" || kind === "PRIMEIRO") return "Olá! Aqui é da Bispo Coffees. Seu cadastro está pronto. Vamos fazer o primeiro pedido de café?";
  if (kind === "CONFIRMAR") return "Olá! Aqui é da Bispo Coffees. Enviei o seu pedido para aprovação. Conseguiu ver o link?";
  if (kind === "RECOMPRA" || kind === "ANTECIPAR") return `Olá! Aqui é da Bispo Coffees. Como está o estoque de café aí no ${first}? Posso já separar a reposição?`;
  return "Olá! Aqui é da Bispo Coffees. Tudo bem por aí? Faz um tempo que não falamos. Posso te ajudar com café esta semana?";
}

/** Tela do vendedor: meta (R$ e kg), conversa do BBOS, caminho para a meta, uma ação agora e a carteira. */
export function SellerHome({ greeting, firstName }: { greeting: string; firstName: string }) {
  const [data, setData] = React.useState<Portfolio | null>(null);
  const [error, setError] = React.useState("");
  const [hidden, setHidden] = React.useState<Set<string>>(new Set());
  const [openCustomer, setOpenCustomer] = React.useState<string | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    fetch(`${getApiBaseUrl()}/seller-portfolio`, { credentials: "include", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.message ?? "Não foi possível carregar a carteira.");
        setData(body as Portfolio);
      })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Não foi possível carregar a carteira."); });
    return () => controller.abort();
  }, []);

  const snooze = async (key: string, action: "TOMORROW" | "DONE") => {
    setHidden((current) => new Set(current).add(key));
    await fetch(`${getApiBaseUrl()}/command-center/tasks/snooze`, {
      method: "POST", credentials: "include", headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskKey: key, action }),
    }).catch(() => null);
  };

  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const header = (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[26px] font-semibold tracking-[-.02em]">{greeting}{firstName ? `, ${firstName}` : ""}</h1>
        <p className="text-sm text-stone-500 first-letter:uppercase">{today}</p>
      </div>
      {data && <span className="rounded-full bg-amber-50 px-3 py-1.5 text-[13px] font-bold text-amber-800">{data.month.daysLeft} {data.month.daysLeft === 1 ? "dia" : "dias"} para fechar o mês</span>}
    </header>
  );

  if (error) return <div className="mx-auto max-w-[900px] space-y-4 pb-28">{header}<p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</p></div>;
  if (!data) return <div className="mx-auto max-w-[900px] space-y-4 pb-28">{header}<div aria-hidden className="h-56 animate-pulse rounded-3xl bg-stone-100" /><div aria-hidden className="h-40 animate-pulse rounded-3xl bg-stone-100" /></div>;

  const tasks = data.tasks.filter((task) => !hidden.has(`seller:${task.customerId}:${task.status}`));
  const now = tasks[0];
  const customers = [...data.customers].sort((a, b) => STATUS[a.status].order - STATUS[b.status].order || b.revenue90 - a.revenue90);
  const card = "rounded-[24px] border border-stone-200 bg-white p-5";

  return (
    <div className="mx-auto max-w-[900px] space-y-4 pb-28">
      {header}

      <section id="meta" aria-label="Meta do mês" className={`${card} grid items-center gap-5 sm:grid-cols-[auto_1fr]`}>
        <Rings revenue={data.month.revenue} kg={data.month.kg} />
        <div className="space-y-3">
          <Line color="bg-emerald-700" value={brl.format(data.month.revenue.done)} target={data.month.revenue.target === null ? "meta a definir" : `de ${brl.format(data.month.revenue.target)}`} />
          <Line color="bg-sky-600" value={`${kgFmt.format(data.month.kg.done)} kg`} target={data.month.kg.target === null ? "meta a definir" : `de ${kgFmt.format(data.month.kg.target)} kg`} />
          <div className="rounded-2xl bg-emerald-50 p-3.5 text-[15px] leading-relaxed text-emerald-950" aria-live="polite">
            <p className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[.14em] text-emerald-800"><Sparkles size={13} /> BBOS</p>
            {data.coach.map((line) => <p key={line}>{line}</p>)}
          </div>
        </div>
      </section>

      {data.path.opportunities.length > 0 && (
        <section aria-labelledby="path-title" className={card}>
          <h2 id="path-title" className="text-[19px] font-bold">Como chegar lá</h2>
          <p className="text-sm text-stone-500">
            {data.path.gap !== null && data.path.gap > 0
              ? data.path.covers ? "Fechando estes, você bate a meta." : "Estes ajudam; vale buscar cliente novo também."
              : "Clientes com mais chance de comprar agora."}
          </p>
          {data.path.gap !== null && data.path.gap > 0 && (
            <div className="mt-3">
              <div className="flex h-3.5 overflow-hidden rounded-full bg-stone-100" aria-label={`Oportunidades somam ${brl.format(data.path.total)} para ${brl.format(data.path.gap)} que faltam`}>
                {data.path.opportunities.filter((o) => o.value > 0).map((o) => (
                  <i key={o.customerId} className="block h-full transition-[width] duration-700 ease-out" style={{ width: `${Math.min(100, (o.value / Math.max(data.path.gap!, data.path.total)) * 100)}%`, background: KIND[o.kind].color }} />
                ))}
              </div>
              <div className="mt-1 flex justify-between text-xs text-stone-500"><span>falta {brl.format(data.path.gap)}</span><span>oportunidades {brl.format(data.path.total)}</span></div>
            </div>
          )}
          <ul className="mt-2 divide-y divide-stone-100">
            {data.path.opportunities.map((o) => {
              const wa = whatsapp(o.phone, waText(o.kind, o.name));
              return (
                <li key={o.customerId} className="grid grid-cols-[1fr_auto] items-center gap-3 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-[16px] font-semibold"><span aria-hidden className="mr-2 inline-block size-2.5 rounded-full" style={{ background: KIND[o.kind].color }} />{o.name}</p>
                    <p className="text-sm text-stone-500">{KIND[o.kind].label} · {o.reason}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {o.value > 0 && <span className="text-[16px] font-bold tabular-nums">~{brl.format(o.value)}</span>}
                    {wa
                      ? <a href={wa} target="_blank" rel="noreferrer" aria-label={`WhatsApp para ${o.name}`} className="grid size-12 place-items-center rounded-2xl bg-emerald-700 text-white"><MessageCircle size={20} /></a>
                      : <Link href={o.kind === "CONFIRMAR" ? "/pedidos" : `/pedidos?novo=1&cliente=${encodeURIComponent(o.customerId)}`} aria-label={`Abrir ${o.name}`} className="grid size-12 place-items-center rounded-2xl bg-stone-900 text-white"><Plus size={20} /></Link>}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {now && (
        <section aria-label="Agora" className={`${card} border-l-[6px] ${now.status === "COBRANCA" ? "border-l-red-600" : now.status === "NOVO" ? "border-l-sky-600" : "border-l-amber-500"}`}>
          <p className="text-[11px] font-extrabold uppercase tracking-[.14em] text-stone-500">Agora</p>
          <h2 className="mt-1 text-[19px] font-bold">{now.title}</h2>
          <p className="text-sm text-stone-500">{now.detail} · {now.why}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(() => {
              const wa = whatsapp(now.phone, waText(now.status, now.title));
              return wa
                ? <a href={wa} target="_blank" rel="noreferrer" className="inline-flex min-h-[52px] items-center gap-2 rounded-2xl bg-stone-900 px-5 text-[15px] font-bold text-white"><MessageCircle size={18} /> WhatsApp</a>
                : <Link href={`/clientes?cliente=${encodeURIComponent(now.customerId)}`} className="inline-flex min-h-[52px] items-center rounded-2xl bg-stone-900 px-5 text-[15px] font-bold text-white">Abrir cliente</Link>;
            })()}
            <button type="button" onClick={() => void snooze(`seller:${now.customerId}:${now.status}`, "DONE")} className="min-h-[52px] rounded-2xl border border-stone-200 px-5 text-[15px] font-semibold">Feito</button>
            <button type="button" onClick={() => void snooze(`seller:${now.customerId}:${now.status}`, "TOMORROW")} className="min-h-[52px] rounded-2xl border border-stone-200 px-5 text-[15px] font-semibold text-stone-600">Amanhã</button>
          </div>
          {tasks[1] && <p className="mt-3 text-[13px] text-stone-500">Depois: {tasks[1].title}</p>}
        </section>
      )}

      <section id="carteira" aria-labelledby="carteira-title" className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2 px-1">
          <h2 id="carteira-title" className="text-[19px] font-bold">Minha carteira <span className="text-sm font-normal text-stone-500">· {customers.length} clientes · toque para ver mais</span></h2>
          <Link href="/clientes?novo=1" className="inline-flex min-h-11 items-center gap-1.5 rounded-2xl border border-stone-200 bg-white px-4 text-sm font-semibold"><Plus size={16} /> Novo cliente</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {customers.map((c) => {
            const open = openCustomer === c.id;
            const wa = whatsapp(c.phone, waText(c.status, c.name));
            return (
              <article key={c.id} className="rounded-[20px] border border-stone-200 bg-white">
                <button type="button" aria-expanded={open} onClick={() => setOpenCustomer(open ? null : c.id)} className="grid w-full gap-2 p-4 text-left">
                  <span className="flex items-center justify-between gap-2"><span className="truncate text-[16px] font-semibold">{c.name}</span><ChevronDown size={18} className={`shrink-0 text-stone-400 transition-transform ${open ? "rotate-180" : ""}`} /></span>
                  <span className={`justify-self-start rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS[c.status].pill}`}>{STATUS[c.status].label}</span>
                  <span aria-hidden className="h-2 overflow-hidden rounded-full bg-stone-100"><span className={`block h-full ${c.thermometer >= 1 ? "bg-red-500" : STATUS[c.status].bar}`} style={{ width: `${Math.round(c.thermometer * 100)}%` }} /></span>
                  <span className="text-[13px] text-stone-500">{c.overdueAmount > 0 ? `${brl.format(c.overdueAmount)} vencido · ` : ""}{c.lastOrderAt ? `última compra há ${c.daysSince} ${c.daysSince === 1 ? "dia" : "dias"}` : c.pendingAmount > 0 ? "1º pedido aguardando o cliente" : "sem pedido ainda"}</span>
                </button>
                {open && (
                  <div className="border-t border-stone-100 px-4 pb-4 pt-3">
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                      <div><dt className="text-xs text-stone-500">Compra a cada</dt><dd className="font-semibold">{c.orders >= 2 ? `~${c.rhythm} dias` : "ainda sem ritmo"}</dd></div>
                      <div><dt className="text-xs text-stone-500">Compra em média</dt><dd className="font-semibold">{c.avgTicket ? brl.format(c.avgTicket) : "—"}</dd></div>
                      <div><dt className="text-xs text-stone-500">Últimos 90 dias</dt><dd className="font-semibold">{c.revenue90 ? brl.format(c.revenue90) : "—"}</dd></div>
                      <div><dt className="text-xs text-stone-500">Última visita</dt><dd className={`font-semibold ${c.daysSinceVisit === null || c.daysSinceVisit > 30 ? "text-amber-700" : ""}`}>{c.daysSinceVisit === null ? "nenhuma registrada" : `há ${c.daysSinceVisit} dias`}</dd></div>
                      <div className="col-span-2"><dt className="text-xs text-stone-500">Próximo passo</dt><dd className="font-semibold">{c.nextStep === "—" ? c.nextOrderInDays !== null && c.nextOrderInDays > 0 ? `Próxima compra prevista em ~${c.nextOrderInDays} dias` : "Manter contato" : c.nextStep}</dd></div>
                    </dl>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href={`/pedidos?novo=1&cliente=${encodeURIComponent(c.id)}`} className="inline-flex min-h-12 items-center gap-1.5 rounded-2xl bg-stone-900 px-4 text-sm font-bold text-white"><Plus size={16} /> Pedido</Link>
                      {wa && <a href={wa} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center gap-1.5 rounded-2xl border border-stone-200 px-4 text-sm font-semibold"><MessageCircle size={16} /> WhatsApp</a>}
                      <Link href={`/atendimento?cliente=${encodeURIComponent(c.id)}`} className="inline-flex min-h-12 items-center gap-1.5 rounded-2xl border border-stone-200 px-4 text-sm font-semibold"><ClipboardCheck size={16} /> Visita</Link>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <nav aria-label="Atalhos do vendedor" className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 backdrop-blur lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="mx-auto grid max-w-[600px] grid-cols-4">
          <a href="#meta" className="grid place-items-center gap-0.5 py-2.5 text-xs font-semibold text-emerald-800"><Target size={22} />Meta</a>
          <a href="#carteira" className="grid place-items-center gap-0.5 py-2.5 text-xs font-semibold text-stone-600"><UsersRound size={22} />Carteira</a>
          <Link href="/pedidos?novo=1" className="grid place-items-center gap-0.5 py-2.5 text-xs font-semibold text-stone-600"><Plus size={22} />Novo pedido</Link>
          <Link href="/atendimento" className="grid place-items-center gap-0.5 py-2.5 text-xs font-semibold text-stone-600"><ClipboardCheck size={22} />Visitas</Link>
        </div>
      </nav>
    </div>
  );
}

function Line({ color, value, target }: { color: string; value: string; target: string }) {
  return (
    <p className="flex items-baseline gap-2.5"><i aria-hidden className={`inline-block size-3 shrink-0 rounded-full ${color}`} /><b className="text-[22px] font-extrabold tabular-nums">{value}</b><span className="text-sm text-stone-500">{target}</span></p>
  );
}

/** Dois anéis (R$ por fora, kg por dentro), como os anéis de atividade. */
function Rings({ revenue, kg }: { revenue: Track; kg: Track }) {
  const ring = (r: number, percent: number | null, color: string, soft: string) => {
    const length = 2 * Math.PI * r;
    const value = Math.min(100, Math.max(0, percent ?? 0));
    return (
      <>
        <circle cx="100" cy="100" r={r} fill="none" stroke={soft} strokeWidth="18" />
        <circle cx="100" cy="100" r={r} fill="none" stroke={color} strokeWidth="18" strokeLinecap="round" strokeDasharray={length} strokeDashoffset={length * (1 - value / 100)} className="transition-[stroke-dashoffset] duration-1000 ease-out" />
      </>
    );
  };
  const main = revenue.percent ?? kg.percent;
  return (
    <div className="relative mx-auto size-[180px]">
      <svg viewBox="0 0 200 200" className="size-full -rotate-90" aria-hidden>
        {ring(86, revenue.percent, "#1f6b4f", "#e3f0e9")}
        {ring(62, kg.percent, "#2f80b8", "#e2eef7")}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        {main === null
          ? <div><b className="block text-2xl font-extrabold">sem meta</b><span className="text-xs text-stone-500">a definir</span></div>
          : <div><b className="block text-[38px] font-extrabold leading-none tracking-[-.03em]">{main}%</b><span className="text-xs text-stone-500">da meta</span></div>}
      </div>
    </div>
  );
}
