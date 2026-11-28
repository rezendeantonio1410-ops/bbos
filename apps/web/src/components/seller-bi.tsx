"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-url";
import { WhatsButton } from "@/components/whatsapp-sheet";
import { Kick, Section, brl, useSellerHome } from "@/components/seller-today";

type Bi = {
  span: number;
  revenue: number; orders: number; kg: number; reading: string;
  time: { days: number; total: number; customer: number; driving: number; stopped: number; pause: number; km: number } | null;
  customers: Array<{ id: string; name: string; city: string | null; phone: string; revenue: number; orders: number; kg: number; share: number; minutes: number | null; fieldVisits: number; perHour: number | null; daysSinceOrder: number | null; openAmount: number }>;
};

const COLORS = ["#047857", "#10b981", "#34d399", "#93c5fd", "#c4b5fd", "#fcd34d", "#fca5a5", "#a8a29e"];
const hm = (min: number) => `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, "0")}`;

/** Minha BI: o vendedor vê onde o esforço dele vira venda. Só ele vê. */
export function SellerBi() {
  const [span, setSpan] = useState(30);
  const [bi, setBi] = useState<Bi | null>(null);
  const [error, setError] = useState("");
  const [metric, setMetric] = useState<"revenue" | "kg" | "orders">("revenue");
  const [sel, setSel] = useState<string | null>(null);
  const { home } = useSellerHome();

  useEffect(() => {
    setBi(null);
    fetch(`${getApiBaseUrl()}/field/bi?days=${span}`, { credentials: "include", cache: "no-store" })
      .then(async (r) => (r.ok ? setBi((await r.json()) as Bi) : setError("Não foi possível carregar a sua BI agora.")))
      .catch(() => setError("Sem conexão com o BBOS."));
  }, [span]);

  const total = useMemo(() => (bi ? bi.customers.reduce((t, c) => t + c[metric], 0) : 0), [bi, metric]);
  if (!bi) return <p className="flex items-center gap-2 p-6 text-sm text-stone-500">{error || <><RefreshCw size={15} className="animate-spin" /> Calculando a sua BI…</>}</p>;

  const t = bi.time;
  const parts = t ? [["Com clientes", t.customer, "#10b981"], ["Dirigindo", t.driving, "#60a5fa"], ["Parado fora de cliente", t.stopped, "#f59e0b"], ["Pausa", t.pause, "#6b7280"]] as const : null;
  const totalTime = parts ? parts.reduce((s, p) => s + p[1], 0) : 0;
  let offset = 0;
  const selected = bi.customers.find((c) => c.id === sel) ?? null;
  const withTime = bi.customers.filter((c) => c.minutes);
  const maxMin = Math.max(1, ...withTime.map((c) => c.minutes ?? 0));
  const maxRev = Math.max(1, ...withTime.map((c) => c.revenue));

  return (
    <div className="mx-auto max-w-[820px] px-3 pb-28 pt-2 sm:px-5">
      <header className="mb-3 mt-1 flex items-end justify-between gap-3 px-1">
        <div><h1 className="text-[22px] font-bold tracking-tight">Minha BI</h1><p className="text-[13px] text-stone-500">só você vê · últimos {bi.span} dias</p></div>
        <div className="flex rounded-xl bg-stone-100 p-1" role="group" aria-label="Período">
          {[7, 30, 90].map((d) => <button key={d} type="button" onClick={() => setSpan(d)} aria-pressed={span === d} className={`rounded-lg px-2.5 py-1.5 text-xs font-extrabold ${span === d ? "bg-white shadow-sm" : "text-stone-500"}`}>{d}d</button>)}
        </div>
      </header>

      <section className="rounded-[22px] bg-[linear-gradient(135deg,#032d60,#0b5cab)] p-4 text-white">
        <p className="text-[11px] font-extrabold uppercase tracking-[.1em] text-sky-200">✦ BBOS · leitura do seu período</p>
        <p className="mt-1.5 text-[17px] font-bold leading-snug">{bi.reading}</p>
      </section>

      <section className="mt-2.5 rounded-[22px] border border-stone-200 bg-white p-4">
        <Kick>Vendido</Kick>
        <p className="mt-1 text-[44px] font-extrabold leading-none tracking-[-.04em]">{metric === "revenue" ? brl(bi.revenue) : metric === "kg" ? `${bi.kg.toLocaleString("pt-BR")} kg` : `${bi.orders} pedidos`}</p>
        <span className="mt-2 inline-block rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-700">{bi.orders} pedidos · {bi.kg.toLocaleString("pt-BR")} kg · {bi.customers.filter((c) => c.orders).length} clientes</span>
        <div className="mt-3 flex gap-1 rounded-xl bg-stone-100 p-1">
          {([["revenue", "R$"], ["kg", "Kg"], ["orders", "Pedidos"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setMetric(k)} aria-pressed={metric === k} className={`flex-1 rounded-lg py-2 text-[13px] font-extrabold ${metric === k ? "bg-white shadow-sm" : "text-stone-500"}`}>{l}</button>)}
        </div>
        <div className="mt-3 flex h-4 overflow-hidden rounded-full bg-stone-100">
          {bi.customers.map((c, i) => total > 0 && c[metric] > 0 && <i key={c.id} title={c.name} style={{ width: `${(c[metric] / total) * 100}%`, background: COLORS[i % COLORS.length] }} />)}
        </div>
        <p className="mt-1.5 flex justify-between text-[11px] text-stone-500"><span>concentração por cliente</span><span>{bi.customers[0] && total > 0 ? `${bi.customers[0].name} ${Math.round((bi.customers[0][metric] / total) * 100)}%` : ""}</span></p>
      </section>

      <section className="mt-2.5 rounded-[22px] bg-black p-4 text-white">
        <Kick dark>Seu tempo em campo</Kick>
        <div className="mt-2 flex items-center gap-4">
          <svg viewBox="0 0 120 120" className="size-[108px] shrink-0">
            <circle cx="60" cy="60" r="48" fill="none" stroke="#1b2522" strokeWidth="14" />
            {parts && totalTime > 0 && parts.map(([label, v, color]) => {
              const len = (v / totalTime) * 301.6;
              const el = <circle key={label} cx="60" cy="60" r="48" fill="none" stroke={color} strokeWidth="14" strokeDasharray={`${len} 301.6`} strokeDashoffset={-offset} transform="rotate(-90 60 60)" />;
              offset += len;
              return el;
            })}
            <text x="60" y="58" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="300">{t ? hm(t.total) : "— h"}</text>
            <text x="60" y="75" textAnchor="middle" fill="#7c8481" fontSize="10">{t ? `${t.days} ${t.days === 1 ? "dia" : "dias"} · ${t.km.toLocaleString("pt-BR")} km` : "em campo"}</text>
          </svg>
          <div className="flex-1 space-y-1.5 text-[13px] text-stone-300">
            {(parts ?? [["Com clientes", 0, "#10b981"], ["Dirigindo", 0, "#60a5fa"], ["Parado fora de cliente", 0, "#f59e0b"], ["Pausa", 0, "#6b7280"]] as const).map(([label, v, color]) => (
              <p key={label} className="flex items-center gap-2"><i className="size-2.5 rounded-sm" style={{ background: color }} />{label}<b className="ml-auto font-semibold text-white">{t ? hm(v) : "—"}</b></p>
            ))}
          </div>
        </div>
        {!t && <p className="mt-3 rounded-xl border border-dashed border-stone-700 p-2.5 text-[12.5px] text-stone-400">Começa a preencher no seu 1º dia com <b className="text-white">Iniciar dia</b>. A partir daí, o BBOS mostra quanto tempo você investe em cada cliente e quanto cada hora rende.</p>}
      </section>

      <Section title="Onde seu esforço vira venda" aside="toque num cliente" />
      <section className="rounded-[22px] border border-stone-200 bg-white px-3 py-2">
        <table className="w-full text-[12.5px]">
          <thead><tr className="text-[10.5px] uppercase tracking-wide text-stone-500"><th className="py-1.5 text-left">Cliente</th><th className="text-right">Venda</th><th className="text-right">Kg</th><th className="text-right">Tempo</th><th className="text-right">R$/hora</th></tr></thead>
          <tbody>
            {bi.customers.map((c, i) => (
              <tr key={c.id} onClick={() => setSel(sel === c.id ? null : c.id)} className={`cursor-pointer border-t border-stone-100 ${sel === c.id ? "bg-emerald-50" : ""}`}>
                <td className="py-2 pr-1"><span className="mr-1.5 inline-block size-2 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} /><b>{c.name}</b>
                  <small className="block text-[11px] text-stone-500">{[c.city, `${c.orders} ${c.orders === 1 ? "pedido" : "pedidos"}`, `${c.share}%`].filter(Boolean).join(" · ")}</small></td>
                <td className="whitespace-nowrap text-right">{brl(c.revenue)}</td>
                <td className="text-right">{c.kg.toLocaleString("pt-BR")}</td>
                <td className={`text-right ${c.minutes ? "" : "text-stone-300"}`}>{c.minutes ? hm(c.minutes) : "—"}</td>
                <td className={`whitespace-nowrap text-right ${c.perHour ? "font-bold" : "text-stone-300"}`}>{c.perHour ? brl(c.perHour) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {selected ? (
          <div className="mt-2 rounded-xl bg-stone-50 p-3 text-[13px]">
            <b>{selected.name}</b>: {brl(selected.revenue)} em {selected.orders} {selected.orders === 1 ? "pedido" : "pedidos"}
            {selected.orders ? `, ticket de ${brl(selected.revenue / selected.orders)}` : ""}.
            {selected.daysSinceOrder !== null && ` Último pedido há ${selected.daysSinceOrder} ${selected.daysSinceOrder === 1 ? "dia" : "dias"}.`}
            {selected.openAmount > 0 && ` ${brl(selected.openAmount)} a receber.`}
            {selected.minutes ? ` ${hm(selected.minutes)} investidas em ${selected.fieldVisits} ${selected.fieldVisits === 1 ? "parada" : "paradas"}.` : " Tempo investido aparece após os dias com o app."}
            <div className="mt-2"><WhatsButton target={{ customerId: selected.id, customerName: selected.name, phone: selected.phone, kinds: ["RESTOCK", "VISIT", "FREE"] }} label="WhatsApp" /></div>
          </div>
        ) : <p className="mt-1 text-[11.5px] text-stone-500">Tempo e R$/hora aparecem depois dos primeiros dias com o app.</p>}
      </section>

      <Section title="Esforço × retorno" aside="tempo investido × venda" />
      <section className="rounded-[22px] border border-stone-200 bg-white p-3">
        <div className="relative h-[210px] overflow-hidden rounded-2xl border border-stone-100">
          {[["left-0 top-0 bg-emerald-50 text-emerald-700", "⭐ Pouco tempo, muita venda"], ["right-0 top-0 bg-blue-50 text-blue-700", "💪 Muito tempo, muita venda"], ["bottom-0 left-0 bg-slate-50 text-slate-400", "🌱 Pouco tempo, pouca venda"], ["bottom-0 right-0 bg-orange-50 text-orange-700", "⚠ Muito tempo, pouca venda"]].map(([cls, label]) => (
            <div key={label} className={`absolute grid h-1/2 w-1/2 place-items-center p-2 text-center text-[11px] font-extrabold ${cls}`}>{label}</div>
          ))}
          {withTime.map((c) => (
            <span key={c.id} title={c.name} className="absolute grid size-7 -translate-x-1/2 translate-y-1/2 place-items-center rounded-full bg-stone-900 text-[10px] font-extrabold text-white ring-2 ring-white"
              style={{ left: `${8 + ((c.minutes ?? 0) / maxMin) * 84}%`, bottom: `${8 + (c.revenue / maxRev) * 84}%` }}>{c.name.charAt(0)}</span>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-stone-500">{withTime.length ? "Cada bolinha é um cliente. Quem está em ⚠ pede menos visitas ou uma oferta diferente." : "Cada cliente vira um ponto aqui quando houver tempo registrado em campo."}</p>
      </section>

      {home && (<>
        <Section title="Seus hábitos" aside="últimos 90 dias" />
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-[22px] border border-stone-200 bg-white p-4"><Kick>Melhor dia</Kick>
            <b className="mt-2 block text-[22px] capitalize tracking-tight">{[...home.weekdays].sort((a, b) => b.orders - a.orders)[0]?.day ?? "—"}</b>
            <p className="text-[12px] text-stone-500">dia com mais pedidos</p></div>
          <div className="rounded-[22px] border border-stone-200 bg-white p-4"><Kick>Ticket médio</Kick>
            <b className="mt-2 block text-[22px] tracking-tight">{home.month.ticket !== null ? brl(home.month.ticket) : "—"}</b>
            <p className="text-[12px] text-stone-500">{home.month.perKg !== null ? `${brl(home.month.perKg)} por kg no mês` : "no mês"}</p></div>
        </div>
      </>)}
    </div>
  );
}
