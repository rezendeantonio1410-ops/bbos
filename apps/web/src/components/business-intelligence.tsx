"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Flame, MessageCircle, Pencil, RefreshCw, Users, Wheat } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-url";

type Source = "MANUAL" | "ROASTS" | "LINE" | "AVERAGE" | "NONE";
type Bucket = { name: string; revenue: number; kg: number; orders: number; cost: number; margin: number | null; marginPercent: number | null; pricePerKg: number | null; estimatedShare: number };
type Material = {
  coffeeId: string; coffeeName: string; source: Source; line: string | null; costPerRoastedKg: number | null; roasts: number;
  realCostPerRoastedKg: number | null; revenue: number;
  manual: { greenCostPerKg: number; roastLossPercent: number; updatedByName: string | null; updatedAt: string | null } | null;
};
type CallItem = { id: string; name: string; phone: string | null; orders: number; total: number; avgTicket: number; rhythm: number | null; daysSince: number; segment: string; riskValue: number };
type Overview = {
  period: { days: number; since: string };
  averageCostPerRoastedKg: number | null;
  roastLossPercent: number;
  lines: Array<{ line: string; costPerRoastedKg: number }>;
  packagingPerUnit: number;
  sources: Record<Source, number>;
  margin: { total: Bucket; byCoffee: Bucket[]; byChannel: Bucket[] };
  materials: Material[];
  customers: {
    customers: number; orders: number; revenue: number; ticket: number; repeatRate: number; repeatCustomers: number;
    segments: Array<{ key: string; count: number; names: string[] }>;
    callList: CallItem[];
    concentration: { top: Array<{ name: string; share: number }>; topShare: number; others: number };
  };
  canEditCosts: boolean;
};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const brl2 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (v: number, d = 0) => v.toLocaleString("pt-BR", { maximumFractionDigits: d });
const short = (v: number) => (Math.abs(v) >= 1000 ? `R$ ${num(v / 1000, 1)} mil` : brl.format(v));

const LINE_LABEL: Record<string, string> = { RAROS: "Raros", EPICOS: "Épicos", CLASSICOS: "Clássicos", GOURMET: "Gourmet" };
const SOURCE: Record<Source, { label: string; tone: string; help: string }> = {
  MANUAL: { label: "Ajuste manual", tone: "bg-violet-100 text-violet-800", help: "valor informado por José ou Suzi" },
  ROASTS: { label: "Torras reais", tone: "bg-emerald-100 text-emerald-800", help: "lotes usados nas torras ÷ kg torrado" },
  LINE: { label: "Média da linha", tone: "bg-sky-100 text-sky-800", help: "lotes de café verde marcados para a linha" },
  AVERAGE: { label: "Média geral", tone: "bg-amber-100 text-amber-800", help: "média de todas as torras" },
  NONE: { label: "Sem custo", tone: "bg-red-100 text-red-800", help: "sem dado para calcular" },
};
const SEGMENTS: Record<string, { title: string; tone: string }> = {
  NO_RITMO: { title: "Compram no ritmo", tone: "border-emerald-200 bg-emerald-50" },
  ATRASADO: { title: "Atrasados no ritmo", tone: "border-amber-200 bg-amber-50" },
  GRANDE_PARADO: { title: "Grande e parado", tone: "border-red-200 bg-red-50" },
  UMA_VEZ: { title: "Compraram 1 vez", tone: "border-stone-200 bg-stone-50" },
  PARADO: { title: "Pararam de comprar", tone: "border-stone-300 bg-stone-100" },
};

function whatsapp(phone: string | null, name: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  const full = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${full}?text=${encodeURIComponent(`Olá, ${name.split(" ")[0]}! Tudo bem? Passando para ver se posso preparar o próximo pedido de café.`)}`;
}

function Bar({ value, warn }: { value: number | null; warn?: boolean }) {
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-stone-100">
      <div className={`h-full rounded-full ${warn ? "bg-amber-600" : "bg-teal-700"}`} style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%` }} />
    </div>
  );
}

function Kpi({ label, value, note, tone }: { label: string; value: string; note?: ReactNode; tone?: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <p className="text-[11px] font-bold uppercase tracking-[.12em] text-stone-500">{label}</p>
      <p className={`mt-1.5 text-3xl font-extrabold ${tone ?? ""}`}>{value}</p>
      {note && <p className="mt-1 text-xs text-stone-500">{note}</p>}
    </div>
  );
}

function CostEditor({ material, onSaved }: { material: Material; onSaved: () => Promise<void> }) {
  const [green, setGreen] = useState(material.manual ? String(material.manual.greenCostPerKg).replace(".", ",") : "");
  const [loss, setLoss] = useState(material.manual ? String(material.manual.roastLossPercent).replace(".", ",") : "14");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async (clear = false) => {
    setBusy(true);
    setError("");
    const response = await fetch(`${getApiBaseUrl()}/bi/coffee-costs`, {
      method: "PUT", credentials: "include", headers: { "content-type": "application/json" },
      body: JSON.stringify({ coffeeId: material.coffeeId, greenCostPerKg: clear ? "" : green, roastLossPercent: loss }),
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      const body = response ? ((await response.json().catch(() => ({}))) as { message?: string }) : {};
      setError(body.message ?? "Não foi possível salvar.");
      return;
    }
    await onSaved();
  };
  return (
    <div className="mt-2 flex flex-wrap items-end gap-2 rounded-xl bg-violet-50/60 p-3">
      <label className="text-[11px] font-semibold text-stone-600">Café verde (R$/kg)
        <input inputMode="decimal" value={green} onChange={(e) => setGreen(e.target.value)} placeholder="Ex.: 31,50" className="mt-1 block w-28 rounded-lg border border-stone-200 bg-white px-2 py-2 text-sm" />
      </label>
      <label className="text-[11px] font-semibold text-stone-600">Perda na torra (%)
        <input inputMode="decimal" value={loss} onChange={(e) => setLoss(e.target.value)} className="mt-1 block w-24 rounded-lg border border-stone-200 bg-white px-2 py-2 text-sm" />
      </label>
      <button type="button" disabled={busy || !green.trim()} onClick={() => void save()} className="rounded-lg bg-violet-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Salvar</button>
      {material.manual && <button type="button" disabled={busy} onClick={() => void save(true)} className="rounded-lg border bg-white px-3 py-2 text-xs font-bold text-stone-600">Voltar ao automático</button>}
      {error && <p role="alert" className="w-full text-xs text-red-700">{error}</p>}
    </div>
  );
}

export function BusinessIntelligence() {
  const [days, setDays] = useState(90);
  const [tab, setTab] = useState<"margem" | "clientes" | "materia">("margem");
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const response = await fetch(`${getApiBaseUrl()}/bi/overview?days=${days}`, { credentials: "include", cache: "no-store" }).catch(() => null);
    setLoading(false);
    if (!response?.ok) return setError("Não foi possível carregar a Inteligência agora.");
    setData((await response.json()) as Overview);
  }, [days]);

  useEffect(() => { void load(); }, [load]);

  const trust = useMemo(() => {
    if (!data) return null;
    const total = data.materials.filter((m) => m.revenue > 0);
    const exact = total.filter((m) => m.source === "ROASTS" || m.source === "MANUAL");
    const exactRevenue = exact.reduce((s, m) => s + m.revenue, 0);
    const all = total.reduce((s, m) => s + m.revenue, 0);
    return { percent: all ? Math.round((exactRevenue / all) * 100) : 0, missing: total.filter((m) => m.source !== "ROASTS" && m.source !== "MANUAL") };
  }, [data]);

  const m = data?.margin.total;
  const c = data?.customers;

  return (
    <div className="mx-auto max-w-[1280px]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs text-stone-500">Análises › <strong className="text-stone-800">Inteligência</strong></p>
          <h1 className="mt-2 text-3xl font-bold">Inteligência</h1>
          <p className="mt-1 text-sm text-stone-500">Onde ganhamos dinheiro e quem sustenta a operação. Cada número mostra de onde vem.</p>
        </div>
        <div className="flex gap-1 rounded-xl border border-stone-200 bg-white p-1" role="group" aria-label="Período">
          {[30, 90, 365].map((d) => (
            <button key={d} type="button" onClick={() => setDays(d)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${days === d ? "bg-stone-100 text-stone-900" : "text-stone-500"}`}>{d === 365 ? "Ano" : `${d} dias`}</button>
          ))}
        </div>
      </header>

      <nav className="mt-5 flex flex-wrap gap-2" aria-label="Painéis">
        {([["margem", "Margem"], ["clientes", "Clientes"], ["materia", "Matéria-prima"]] as const).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={`rounded-xl border px-4 py-2.5 text-sm font-bold ${tab === key ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 bg-white text-stone-600"}`}>{label}</button>
        ))}
        {["Vendas", "Caixa", "Operação"].map((label) => (
          <span key={label} className="rounded-xl border border-dashed border-stone-200 px-4 py-2.5 text-sm font-semibold text-stone-400">{label} · em breve</span>
        ))}
      </nav>

      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {loading && !data && <p className="mt-6 flex items-center gap-2 text-sm text-stone-500"><RefreshCw size={15} className="animate-spin" /> Calculando…</p>}

      {data && trust && m && (tab === "margem" || tab === "materia") && trust.percent < 100 && (
        <div className="mt-5 flex flex-wrap items-center gap-4 rounded-2xl border border-l-4 border-stone-200 border-l-amber-600 bg-white p-4">
          <div><p className="text-2xl font-extrabold text-amber-700">{trust.percent}%</p><p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">custo exato</p></div>
          <p className="min-w-0 flex-1 text-sm text-stone-700">
            {trust.percent}% da receita usa custo de <strong>torras reais</strong> ou <strong>ajuste manual</strong>. Os outros cafés usam a média da linha ou a média geral
            ({data.averageCostPerRoastedKg ? brl2.format(data.averageCostPerRoastedKg) : "—"}/kg torrado, perda de torra {num(data.roastLossPercent, 1)}%). Embalagem: {brl2.format(data.packagingPerUnit)} por pacote.
          </p>
          {tab === "margem" && <button type="button" onClick={() => setTab("materia")} className="text-sm font-bold text-teal-800">Ajustar matéria-prima →</button>}
        </div>
      )}

      {data && m && tab === "margem" && (
        <section className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Receita" value={short(m.revenue)} note={`${m.orders} pedidos · ${num(m.kg)} kg`} />
            <Kpi label="Custo do café e embalagem" value={short(m.cost)} note={data.averageCostPerRoastedKg ? `média ${brl2.format(data.averageCostPerRoastedKg)} por kg torrado` : undefined} />
            <Kpi label="Margem bruta" value={m.marginPercent === null ? "—" : `${num(m.marginPercent, 1)}%`} tone="text-teal-800" note={m.margin !== null ? `${short(m.margin)} · antes de frete, comissão e impostos` : "sem custo para calcular"} />
            <Kpi label="Preço médio por kg" value={m.pricePerKg ? brl2.format(m.pricePerKg) : "—"} note={m.pricePerKg && data.averageCostPerRoastedKg ? `sobra cerca de ${brl2.format(m.pricePerKg - data.averageCostPerRoastedKg)}/kg` : undefined} />
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
            <div className="rounded-2xl border border-stone-200 bg-white p-5">
              <h2 className="font-bold">Margem por café</h2>
              <p className="text-xs text-stone-500">quanto sobra de cada R$ 100 vendidos, e o preço médio por kg</p>
              <div className="mt-3 divide-y divide-stone-100">
                {data.margin.byCoffee.map((b) => (
                  <div key={b.name} className="grid grid-cols-[minmax(0,150px)_1fr_56px_86px] items-center gap-3 py-2.5 text-sm">
                    <span className="truncate font-semibold">{b.name}</span>
                    <Bar value={b.marginPercent} warn={(b.marginPercent ?? 100) < 50} />
                    <span className={`text-right font-bold ${(b.marginPercent ?? 100) < 50 ? "text-amber-700" : ""}`}>{b.marginPercent === null ? "—" : `${num(b.marginPercent)}%`}</span>
                    <span className="text-right text-xs text-stone-500">{b.pricePerKg ? `${brl.format(b.pricePerKg)}/kg` : "—"}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white p-5">
              <h2 className="font-bold">Margem por canal</h2>
              <p className="text-xs text-stone-500">quanto cada canal vende e quanto sobra</p>
              <div className="mt-3 space-y-3">
                {data.margin.byChannel.map((b) => (
                  <div key={b.name}>
                    <div className="grid grid-cols-[minmax(0,130px)_1fr_52px] items-center gap-3 text-sm">
                      <span className="truncate font-semibold">{b.name}</span>
                      <Bar value={b.marginPercent} warn={(b.marginPercent ?? 100) < 55} />
                      <span className={`text-right font-bold ${(b.marginPercent ?? 100) < 55 ? "text-amber-700" : ""}`}>{b.marginPercent === null ? "—" : `${num(b.marginPercent)}%`}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-stone-500">{short(b.revenue)} · {num(b.kg)} kg{b.pricePerKg ? ` · ${brl.format(b.pricePerKg)}/kg` : ""}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {data && c && tab === "clientes" && (
        <section className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {c.segments.filter((s) => s.count > 0 || s.key !== "PARADO").map((s) => (
              <div key={s.key} className={`rounded-2xl border p-4 ${SEGMENTS[s.key]?.tone ?? ""}`}>
                <p className="text-2xl font-extrabold">{s.count}</p>
                <p className="font-bold">{SEGMENTS[s.key]?.title ?? s.key}</p>
                <p className="mt-1 text-xs text-stone-600">{s.names.join(", ") || "—"}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
            <div className="rounded-2xl border border-stone-200 bg-white p-5">
              <h2 className="font-bold">Quem chamar esta semana</h2>
              <p className="text-xs text-stone-500">ordem: valor do pedido médio × atraso no ritmo do cliente</p>
              {c.callList.length === 0 ? <p className="mt-4 flex items-center gap-2 text-sm text-emerald-800"><CheckCircle2 size={16} /> Todos os clientes estão no ritmo.</p> : (
                <table className="mt-3 w-full text-sm">
                  <thead><tr className="text-left text-[11px] uppercase tracking-wider text-stone-500"><th className="py-2">Cliente</th><th>Ritmo</th><th>Sem comprar</th><th className="text-right">Pedido médio</th><th /></tr></thead>
                  <tbody className="divide-y divide-stone-100">
                    {c.callList.map((item) => {
                      const link = whatsapp(item.phone, item.name);
                      return (
                        <tr key={item.id}>
                          <td className="py-2.5 font-semibold">{item.name}</td>
                          <td>{item.rhythm ? `a cada ${item.rhythm} dias` : "1 compra"}</td>
                          <td><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${item.daysSince >= 30 ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{item.daysSince} dias</span></td>
                          <td className="text-right font-bold">{brl.format(item.riskValue)}</td>
                          <td className="pl-3 text-right">{link ? <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-teal-800"><MessageCircle size={13} /> WhatsApp</a> : <Link href="/clientes" className="text-xs font-bold text-stone-500">Ver cliente</Link>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white p-5">
              <h2 className="font-bold">De quem depende a receita</h2>
              <p className="text-xs text-stone-500">últimos 12 meses · contas internas fora</p>
              <div className="mt-3 flex h-3.5 overflow-hidden rounded-full bg-stone-200">
                {c.concentration.top.map((t, i) => <span key={t.name} className={["bg-teal-700", "bg-teal-500", "bg-teal-300"][i]} style={{ width: `${t.share}%` }} />)}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
                {c.concentration.top.map((t, i) => <span key={t.name}><b className={`mr-1 inline-block size-2.5 rounded-sm ${["bg-teal-700", "bg-teal-500", "bg-teal-300"][i]}`} />{t.name} {t.share}%</span>)}
                <span><b className="mr-1 inline-block size-2.5 rounded-sm bg-stone-200" />outros {c.concentration.others} · {Math.max(0, 100 - c.concentration.topShare)}%</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-stone-50 p-3"><p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Voltam a comprar</p><p className="text-2xl font-extrabold">{c.repeatRate}%</p><p className="text-xs text-stone-500">{c.repeatCustomers} de {c.customers} clientes</p></div>
                <div className="rounded-xl bg-stone-50 p-3"><p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Pedido médio</p><p className="text-2xl font-extrabold">{brl.format(c.ticket)}</p><p className="text-xs text-stone-500">{c.orders} pedidos</p></div>
              </div>
              {c.concentration.topShare >= 40 && (
                <p className="mt-4 rounded-xl border border-teal-100 bg-teal-50 p-3 text-sm"><Users size={14} className="mr-1 inline text-teal-800" /> Três clientes fazem <b className="text-teal-800">{c.concentration.topShare}% da receita</b>. Levar quem comprou uma vez à 2ª compra dilui esse risco.</p>
              )}
            </div>
          </div>
        </section>
      )}

      {data && tab === "materia" && (
        <section className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Torras reais" value={String(data.sources.ROASTS)} note="cafés com custo pelas torras" tone="text-emerald-800" />
            <Kpi label="Média da linha" value={String(data.sources.LINE)} note="lotes marcados para a linha" tone="text-sky-800" />
            <Kpi label="Média geral" value={String(data.sources.AVERAGE)} note="sem torra nem lote da linha" tone="text-amber-700" />
            <Kpi label="Ajuste manual" value={String(data.sources.MANUAL)} note="definido por José ou Suzi" tone="text-violet-800" />
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <h2 className="flex items-center gap-2 font-bold"><Wheat size={16} /> Custo da matéria-prima por café</h2>
            <p className="text-xs text-stone-500">custo por kg torrado. Ordem: ajuste manual → torras reais → média dos lotes da linha → média geral.</p>
            <div className="mt-3 divide-y divide-stone-100">
              {data.materials.map((mat) => (
                <div key={mat.coffeeId} className="py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{mat.coffeeName} <span className="text-xs font-normal text-stone-400">{mat.line ? LINE_LABEL[mat.line] ?? mat.line : ""}</span></p>
                      <p className="text-xs text-stone-500">
                        {SOURCE[mat.source].help}
                        {mat.roasts > 0 ? ` · ${mat.roasts} torra(s)` : ""}
                        {mat.revenue > 0 ? ` · vendeu ${short(mat.revenue)} no período` : ""}
                        {mat.manual?.updatedByName ? ` · ajuste de ${mat.manual.updatedByName}` : ""}
                        {mat.manual && mat.realCostPerRoastedKg ? ` · torras dariam ${brl2.format(mat.realCostPerRoastedKg)}` : ""}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${SOURCE[mat.source].tone}`}>{SOURCE[mat.source].label}</span>
                    <span className="w-28 text-right text-lg font-extrabold">{mat.costPerRoastedKg ? brl2.format(mat.costPerRoastedKg) : "—"}<span className="block text-[10px] font-semibold text-stone-400">por kg torrado</span></span>
                    {data.canEditCosts && (
                      <button type="button" aria-label={`Ajustar custo de ${mat.coffeeName}`} onClick={() => setEditing(editing === mat.coffeeId ? "" : mat.coffeeId)} className="rounded-lg border p-2 text-stone-600"><Pencil size={14} /></button>
                    )}
                  </div>
                  {editing === mat.coffeeId && <CostEditor material={mat} onSaved={async () => { setEditing(""); await load(); }} />}
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-stone-200 bg-white p-5">
              <h2 className="font-bold">Custo por linha</h2>
              <p className="text-xs text-stone-500">média dos lotes de café verde marcados para cada linha, com perda de {num(data.roastLossPercent, 1)}%</p>
              {data.lines.length ? (
                <ul className="mt-3 space-y-2 text-sm">{data.lines.map((l) => <li key={l.line} className="flex justify-between"><span className="font-semibold">{LINE_LABEL[l.line] ?? l.line}</span><span className="font-bold">{brl2.format(l.costPerRoastedKg)}/kg torrado</span></li>)}</ul>
              ) : <p className="mt-3 flex items-start gap-2 text-sm text-stone-600"><AlertTriangle size={15} className="mt-0.5 text-amber-600" /> Nenhum lote tem linha marcada ainda.</p>}
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white p-5">
              <h2 className="font-bold">Como deixar o custo exato</h2>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-stone-700">
                <li>Na entrada do café verde, marque em quais linhas ele será usado (até 3).</li>
                <li>Nos lotes que já estão no estoque, abra o lote em <Link href="/estoque" className="font-bold text-teal-800">Estoque</Link> e marque as linhas.</li>
                <li>Registre as torras em <Link href="/producao" className="inline-flex items-center gap-1 font-bold text-teal-800"><Flame size={13} />Produção</Link>: cada torra traz o custo real do café.</li>
                <li>Se o preço do café verde mudou, ajuste o custo aqui (José ou Suzi).</li>
              </ol>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
