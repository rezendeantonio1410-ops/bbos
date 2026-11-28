"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-url";

type Panels = {
  period: { days: number };
  sales: {
    months: Array<{ month: string; direct: number; marketplace: number; orders: number; clients: number }>;
    channels: Array<{ name: string; revenue: number; orders: number }>;
    cities: Array<{ name: string; revenue: number; clients: number }>;
    weekdays: Array<{ label: string; amount: number; orders: number }>;
    sellers: Array<{ name: string; revenue: number; orders: number }>;
  };
  cash: {
    open: number; titles: number; overdue: number; daysToCash: number | null; onTimeShare: number | null;
    aging: Array<{ bucket: string; amount: number; titles: number }>;
    weeks: Array<{ week: string; amount: number; titles: number }>;
    received: Array<{ month: string; amount: number }>;
    payers: Array<{ id: string; name: string; days: number; titles: number; total: number }>;
  };
  operations: {
    roasts: Array<{ month: string; batches: number; green: number; roasted: number; lossPercent: number | null }>;
    green: { days: number | null; runOutAt: string | null; buyBy: string | null; availableKg: number; lots: number; consumed30: number };
    leadTimeDays: number | null;
    delivered: number;
    onTime: { total: number; onTime: number; batchedShare: number };
    open: Array<{ status: string; orders: number; late: number }>;
    finished: { units: number; reserved: number };
  };
};

const brl = (v: number) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
const short = (v: number) => (Math.abs(v) >= 1000 ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : brl(v));
const num = (v: number | null, d = 1) => (v === null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: d }));
const monthLabel = (key: string) => new Date(`${key}-15T12:00:00Z`).toLocaleDateString("pt-BR", { month: "short", timeZone: "UTC" }).replace(".", "");
const ddmm = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");
const STATUS_LABEL: Record<string, string> = { CONFIRMED: "Confirmado", RESERVED: "Estoque reservado", IN_PRODUCTION: "Aguardando embalagem", PICKING: "Em separação", READY_TO_SHIP: "Pronto para enviar", INVOICED: "Faturado", SHIPPED: "A caminho" };

function Kpi({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <p className="text-[11px] font-bold uppercase tracking-[.12em] text-stone-500">{label}</p>
      <p className={`mt-1.5 text-3xl font-extrabold ${tone ?? ""}`}>{value}</p>
      {note && <p className="mt-1 text-xs text-stone-500">{note}</p>}
    </div>
  );
}

function Card({ title, help, children }: { title: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <h2 className="font-bold">{title}</h2>
      {help && <p className="text-xs text-stone-500">{help}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Bars({ rows, format = short }: { rows: Array<{ label: string; value: number; note?: string; warn?: boolean }>; format?: (v: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,140px)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate font-semibold">{r.label}</span>
          <span className="h-3 overflow-hidden rounded-full bg-stone-100"><span className={`block h-full rounded-full ${r.warn ? "bg-amber-500" : "bg-teal-700"}`} style={{ width: `${(r.value / max) * 100}%` }} /></span>
          <span className="text-right text-xs"><b>{format(r.value)}</b>{r.note ? <span className="text-stone-500"> · {r.note}</span> : null}</span>
        </li>
      ))}
    </ul>
  );
}

export function BiPanels({ tab, days }: { tab: "vendas" | "caixa" | "operacao"; days: number }) {
  const [data, setData] = useState<Panels | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setError("");
    void fetch(`${getApiBaseUrl()}/bi/panels?days=${days}`, { credentials: "include", cache: "no-store" })
      .then(async (r) => (r.ok ? ((await r.json()) as Panels) : Promise.reject()))
      .then((d) => { if (active) setData(d); })
      .catch(() => { if (active) setError("Não foi possível carregar este painel agora."); });
    return () => { active = false; };
  }, [days]);

  if (error) return <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>;
  if (!data) return <p className="mt-6 flex items-center gap-2 text-sm text-stone-500"><RefreshCw size={15} className="animate-spin" /> Calculando…</p>;

  if (tab === "vendas") {
    const s = data.sales;
    const last = s.months[s.months.length - 1];
    const before = s.months[s.months.length - 2];
    const total = (m?: { direct: number; marketplace: number }) => (m ? m.direct + m.marketplace : 0);
    const growth = before && total(before) > 0 ? total(last) / total(before) : null;
    const maxMonth = Math.max(1, ...s.months.map(total));
    const best = [...s.weekdays].sort((a, b) => b.amount - a.amount)[0];
    const weak = [...s.weekdays].filter((w) => !["Sábado", "Domingo"].includes(w.label)).sort((a, b) => a.amount - b.amount)[0];
    const channelTotal = s.channels.reduce((sum, c) => sum + c.revenue, 0);
    return (
      <section className="mt-5 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label={last ? `Mês de ${monthLabel(last.month)}` : "Mês"} value={short(total(last))} note={growth ? `${growth >= 1 ? "▲" : "▼"} ${num(growth)}× o mês anterior · ${last?.orders ?? 0} pedidos` : undefined} />
          <Kpi label="Pedido médio" value={last && last.orders ? brl(total(last) / last.orders) : "—"} note="inclui marketplace" />
          <Kpi label="Clientes no mês" value={String(last?.clients ?? 0)} note={before ? `${before.clients} no mês anterior` : undefined} />
          <Kpi label="Melhor dia" value={best?.amount ? best.label : "—"} note={weak && best?.amount ? `${short(best.amount)} · ${weak.label} é o mais fraco` : undefined} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Mês a mês" help="verde: vendas diretas · laranja: marketplace">
            <div className="flex h-[180px] items-end gap-3">
              {s.months.map((m) => (
                <div key={m.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1 text-[11px]">
                  <b className="text-xs">{short(total(m))}</b>
                  <span className="flex w-full flex-col-reverse overflow-hidden rounded-t-md" style={{ height: `${(total(m) / maxMonth) * 140}px` }}>
                    <span className="bg-teal-700" style={{ height: `${total(m) ? (m.direct / total(m)) * 100 : 0}%` }} />
                    <span className="bg-amber-500" style={{ height: `${total(m) ? (m.marketplace / total(m)) * 100 : 0}%` }} />
                  </span>
                  <span className="capitalize text-stone-500">{monthLabel(m.month)}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Por canal" help={`participação nos últimos ${data.period.days === 365 ? "12 meses" : `${data.period.days} dias`}`}>
            <Bars rows={s.channels.map((c) => ({ label: c.name, value: c.revenue, note: `${channelTotal ? Math.round((c.revenue / channelTotal) * 100) : 0}% · ${c.orders} ped.` }))} />
          </Card>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Por cidade" help="nomes iguais com grafias diferentes contam juntos">
            <ul className="divide-y divide-stone-100 text-sm">{s.cities.map((c) => <li key={c.name} className="flex justify-between gap-2 py-2"><b>{c.name}</b><span>{short(c.revenue)} · {c.clients} cliente(s)</span></li>)}</ul>
          </Card>
          <Card title="Dia da semana" help="vendas no período, em R$ mil">
            <div className="grid grid-cols-7 gap-1.5 text-center text-[11px]">
              {[1, 2, 3, 4, 5, 6, 0].map((dow) => {
                const d = s.weekdays[dow]!;
                const max = Math.max(1, ...s.weekdays.map((w) => w.amount));
                const tone = d.amount >= max * 0.8 ? "bg-teal-300" : d.amount >= max * 0.4 ? "bg-teal-100" : d.amount >= max * 0.2 ? "bg-teal-50" : "bg-amber-100";
                return <div key={dow} className={`rounded-lg px-1 py-2 ${tone}`}><b className="block text-sm">{num(d.amount / 1000)}</b>{d.label.slice(0, 3).toLowerCase()}</div>;
              })}
            </div>
            {weak && best && best.amount > 0 && weak.amount < best.amount * 0.3 && <p className="mt-3 rounded-xl border border-teal-100 bg-teal-50 p-3 text-xs">{weak.label} vende muito menos que {best.label.toLowerCase()}. Bom dia para visitas e prospecção.</p>}
          </Card>
          <Card title="Quem vendeu" help="equipe, parceiros e vendedores">
            <ul className="divide-y divide-stone-100 text-sm">{s.sellers.map((p) => <li key={p.name} className="flex justify-between gap-2 py-2"><b>{p.name}</b><span>{short(p.revenue)} · {p.orders} ped.</span></li>)}</ul>
          </Card>
        </div>
      </section>
    );
  }

  if (tab === "caixa") {
    const c = data.cash;
    const maxWeek = Math.max(1, ...c.weeks.map((w) => w.amount));
    const lastReceived = c.received[c.received.length - 1];
    const prevReceived = c.received[c.received.length - 2];
    const emptyWeek = c.weeks.slice(1).find((w) => w.amount === 0);
    return (
      <section className="mt-5 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="A receber" value={short(c.open)} note={`${c.titles} título(s) · ${c.overdue > 0 ? `${short(c.overdue)} vencido` : "nada vencido"}`} tone={c.overdue > 0 ? "text-red-700" : undefined} />
          <Kpi label="Prazo médio de recebimento" value={c.daysToCash === null ? "—" : `${num(c.daysToCash)} dias`} note="da nota ao dinheiro na conta" />
          <Kpi label="Pagam no prazo" value={c.onTimeShare === null ? "—" : `${c.onTimeShare}%`} note="títulos pagos nos últimos 6 meses" tone="text-teal-800" />
          <Kpi label={lastReceived ? `Recebido em ${monthLabel(lastReceived.month)}` : "Recebido"} value={short(lastReceived?.amount ?? 0)} note={prevReceived ? `${short(prevReceived.amount)} no mês anterior` : undefined} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="O que entra nas próximas semanas" help="títulos em aberto por semana de vencimento">
            <ul className="space-y-2.5">
              {c.weeks.map((w) => (
                <li key={w.week} className="grid grid-cols-[130px_1fr_90px] items-center gap-3 text-sm">
                  <span className="font-semibold">semana de {ddmm(w.week)}</span>
                  <span className="h-3 overflow-hidden rounded-full bg-stone-100"><span className="block h-full rounded-full bg-teal-700" style={{ width: `${(w.amount / maxWeek) * 100}%` }} /></span>
                  <span className="text-right font-bold">{w.amount ? brl(w.amount) : "—"}</span>
                </li>
              ))}
            </ul>
            {emptyWeek && <p className="mt-3 rounded-xl border border-teal-100 bg-teal-50 p-3 text-xs">A semana de {ddmm(emptyWeek.week)} não tem nada a receber. Vale puxar vendas a prazo para vencer nela.</p>}
          </Card>
          <Card title="Como cada cliente paga" help="dias após o vencimento, em média (negativo = antecipa)">
            {c.payers.length ? (
              <ul className="divide-y divide-stone-100 text-sm">
                {c.payers.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2 py-2">
                    <b className="truncate">{p.name}</b>
                    <span><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${p.days >= 3 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{p.days < -0.5 ? `antecipa ${num(Math.abs(p.days), 0)} dias` : `${p.days > 0 ? "+" : ""}${num(p.days)} dia(s)`}</span> · {p.titles} título(s)</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-stone-500">Ainda sem títulos pagos no período.</p>}
          </Card>
        </div>
        <Card title="Títulos em aberto por atraso">
          <div className="grid gap-2 sm:grid-cols-4">
            {c.aging.map((a, i) => <div key={a.bucket} className={`rounded-xl p-3 ${i === 0 ? "bg-emerald-50" : a.amount > 0 ? "bg-red-50" : "bg-stone-50"}`}><p className="text-xs text-stone-500">{a.bucket}</p><p className="text-lg font-extrabold">{a.amount ? brl(a.amount) : "—"}</p><p className="text-[11px] text-stone-500">{a.titles} título(s)</p></div>)}
          </div>
        </Card>
      </section>
    );
  }

  const o = data.operations;
  const lastRoast = o.roasts[o.roasts.length - 1];
  const prevRoast = o.roasts[o.roasts.length - 2];
  const onTimeShare = o.onTime.total ? Math.round((o.onTime.onTime / o.onTime.total) * 100) : null;
  return (
    <section className="mt-5 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label={lastRoast ? `Torrado em ${monthLabel(lastRoast.month)}` : "Torrado no mês"} value={`${num(lastRoast?.roasted ?? 0, 0)} kg`} note={lastRoast ? `${lastRoast.batches} torra(s)${prevRoast ? ` · ${num(prevRoast.roasted, 0)} kg no mês anterior` : ""}` : undefined} />
        <Kpi label="Perda na torra" value={lastRoast?.lossPercent === null || !lastRoast ? "—" : `${num(lastRoast.lossPercent)}%`} note={prevRoast?.lossPercent != null ? `mês anterior ${num(prevRoast.lossPercent)}%` : undefined} tone={lastRoast?.lossPercent != null && prevRoast?.lossPercent != null && lastRoast.lossPercent - prevRoast.lossPercent >= 2 ? "text-amber-700" : undefined} />
        <Kpi label="Café verde dá para" value={o.green.days === null ? "—" : `~${o.green.days} dias`} note={`${num(o.green.availableKg, 0)} kg em ${o.green.lots} lote(s) · usa ${num(o.green.consumed30, 0)} kg/mês`} tone={o.green.days !== null && o.green.days < 30 ? "text-red-700" : undefined} />
        <Kpi label="Do pedido à entrega" value={o.leadTimeDays === null ? "—" : `${num(o.leadTimeDays)} dias`} note={`mediana de ${o.delivered} entrega(s)`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Entrega no prazo" help="pedidos entregues com data prevista">
          {o.onTime.total ? (
            <>
              <div className="flex h-4 overflow-hidden rounded-full bg-amber-300"><span className="bg-teal-700" style={{ width: `${onTimeShare}%` }} /></div>
              <p className="mt-2 text-xs text-stone-600">no prazo {o.onTime.onTime} · depois da data {o.onTime.total - o.onTime.onTime}</p>
              {o.onTime.batchedShare >= 30 && <p className="mt-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs"><AlertTriangle size={14} className="shrink-0 text-amber-700" /> {o.onTime.batchedShare}% das entregas foram confirmadas em lote, dias depois. O número fica real quando a entrega é confirmada no dia em que acontece.</p>}
            </>
          ) : <p className="text-sm text-stone-500">Ainda sem entregas com data prevista no período.</p>}
        </Card>
        <Card title="Pedidos em andamento agora">
          <ul className="divide-y divide-stone-100 text-sm">
            {o.open.map((s) => <li key={s.status} className="flex justify-between py-2"><b>{STATUS_LABEL[s.status] ?? s.status}</b><span>{s.orders}{s.late ? <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">{s.late} passou da data</span> : null}</span></li>)}
            <li className="flex justify-between py-2"><b>Pacotes prontos no estoque</b><span>{o.finished.units} · {o.finished.reserved} reservados</span></li>
          </ul>
        </Card>
      </div>
      <Card title="Torra mês a mês" help="kg de café verde, kg torrado e perda">
        <Bars rows={o.roasts.map((r) => ({ label: monthLabel(r.month), value: r.roasted, note: `${r.batches} torra(s) · perda ${num(r.lossPercent)}%`, warn: (r.lossPercent ?? 0) >= 15 }))} format={(v) => `${num(v, 0)} kg`} />
        {o.green.buyBy && <p className="mt-3 text-xs text-stone-600">No ritmo atual, o café verde acaba por volta de <b>{ddmm(o.green.runOutAt)}</b>. Para não parar, compre até <b>{ddmm(o.green.buyBy)}</b> (considerando 15 dias de entrega).</p>}
      </Card>
    </section>
  );
}
