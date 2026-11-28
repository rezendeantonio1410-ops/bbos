"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CheckCircle2, Circle, Loader2, RefreshCw, XCircle } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-url";

type Node = { current: number | null; previous: number | null; change: number | null; better: boolean | null };
type Action = { key: string; title: string; why: string; how: string; who: string; when: string; impact: number | null; impactLabel: string; link: string; status: string; statusBy: string | null };
type Reading = {
  window: { days: number };
  current: { totalRevenue: number; revenue: number; profit: number; marginPercent: number | null; newClients: number; newClientsRevenue: number; marketplaceRevenue: number; packagesPerKg: number };
  previous: { totalRevenue: number; profit: number; marginPercent: number | null };
  tree: Record<"revenue" | "clients" | "ordersPerClient" | "ticket" | "profit" | "kg" | "pricePerKg" | "costPerKg" | "lossPercent" | "marginPercent", Node>;
  bridge: { start: number; volume: number; price: number; cost: number; end: number };
  sentences: { pulled: string; held: string; watch: string };
  ahead: {
    forecast: { conservative: number; likely: number; growth: number; recurringActiveClients: number; newClientsAssumed: number };
    green: { days: number | null; runOutAt: string | null; buyBy: string | null; availableKg: number };
    overdue: number;
    whatIf: { priceIncrease: number; lossTarget: number; marginPercent: number } | null;
    goal: number | null;
    suggestedGoal: number;
  };
  actions: Action[];
  matrix: { groups: Record<"PROTEGER" | "AJUSTAR_PRECO" | "EMPURRAR" | "REVER", Array<{ name: string; kg: number; marginPercent: number }>> };
  abc: { A: string[]; B: string[]; C: string[]; share: { A: number; B: number; C: number } };
  swot: { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] };
  quality: { exactCostShare: number; batchConfirmShare: number };
};

const brl = (v: number) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
const short = (v: number) => `${v < 0 ? "−" : ""}${Math.abs(v) >= 1000 ? `R$ ${(Math.abs(v) / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : `R$ ${Math.round(Math.abs(v)).toLocaleString("pt-BR")}`}`;
const num = (v: number | null, d = 1) => (v === null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: d }));
const ddmm = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");

function Delta({ node, points = false }: { node: Node; points?: boolean }) {
  if (node.change === null || node.current === null || node.previous === null) return <span className="text-stone-400">sem base</span>;
  const tone = node.better === null ? "text-stone-500" : node.better ? "text-emerald-700" : "text-red-700";
  const diff = points ? node.current - node.previous : node.change;
  const Icon = diff >= 0 ? ArrowUpRight : ArrowDownRight;
  return <span className={`inline-flex items-center font-bold ${tone}`}><Icon size={13} />{points ? `${num(Math.abs(diff))} pts` : `${num(Math.abs(diff), 0)}%`}</span>;
}

function TreeNode({ label, node, format, points }: { label: string; node: Node; format: (v: number) => string; points?: boolean }) {
  const tone = node.better === null ? "border-stone-200 bg-white" : node.better ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50";
  return (
    <div className={`min-w-0 flex-1 rounded-xl border px-3 py-2 ${tone}`}>
      <p className="text-[11px] text-stone-500">{label}</p>
      <p className="text-sm font-bold">{node.previous === null ? "—" : format(node.previous)} → {node.current === null ? "—" : format(node.current)}</p>
      <p className="text-[11px]"><Delta node={node} points={points} /></p>
    </div>
  );
}

const Op = ({ children }: { children: string }) => <span className="self-center text-lg font-extrabold text-stone-400">{children}</span>;

const STATUS: Record<string, { label: string; icon: typeof Circle; tone: string }> = {
  TODO: { label: "a fazer", icon: Circle, tone: "bg-stone-100 text-stone-600" },
  DOING: { label: "fazendo", icon: Loader2, tone: "bg-sky-100 text-sky-800" },
  DONE: { label: "feita", icon: CheckCircle2, tone: "bg-emerald-100 text-emerald-800" },
  DISMISSED: { label: "descartada", icon: XCircle, tone: "bg-stone-100 text-stone-400" },
};
const NEXT: Record<string, string> = { TODO: "DOING", DOING: "DONE", DONE: "TODO", DISMISSED: "TODO" };

export function BiReading() {
  const [data, setData] = useState<Reading | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const response = await fetch(`${getApiBaseUrl()}/bi/reading`, { credentials: "include", cache: "no-store" }).catch(() => null);
    if (!response?.ok) return setError("Não foi possível montar a leitura agora.");
    setData((await response.json()) as Reading);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const setStatus = async (action: Action, status: string) => {
    setData((d) => (d ? { ...d, actions: d.actions.map((a) => (a.key === action.key ? { ...a, status } : a)) } : d));
    await fetch(`${getApiBaseUrl()}/bi/actions`, { method: "PUT", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ actionKey: action.key, status, title: action.title }) }).catch(() => null);
  };

  if (error) return <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>;
  if (!data) return <p className="mt-6 flex items-center gap-2 text-sm text-stone-500"><RefreshCw size={15} className="animate-spin" /> Lendo os números…</p>;

  const t = data.tree;
  const b = data.bridge;
  const max = Math.max(1, b.start, b.end, b.start + Math.max(0, b.volume));
  const h = (v: number) => `${Math.max(2, (Math.abs(v) / max) * 150)}px`;
  const totalDelta: Node = { current: data.current.totalRevenue, previous: data.previous.totalRevenue, change: data.previous.totalRevenue ? Math.round(((data.current.totalRevenue - data.previous.totalRevenue) / data.previous.totalRevenue) * 1000) / 10 : null, better: data.current.totalRevenue >= data.previous.totalRevenue };
  const f = data.ahead.forecast;
  const g = data.ahead.green;
  const groups = data.matrix.groups;

  return (
    <section className="mt-5 space-y-4">
      <p className="text-xs text-stone-500">Últimos {data.window.days} dias comparados com os {data.window.days} anteriores · recalculado a cada visita</p>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-stone-200 bg-white p-5"><p className="text-[11px] font-bold uppercase tracking-[.12em] text-stone-500">Receita</p><p className="mt-1 text-3xl font-extrabold">{short(data.current.totalRevenue)}</p><p className="text-xs text-stone-500"><Delta node={totalDelta} /> · inclui marketplace</p></div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5"><p className="text-[11px] font-bold uppercase tracking-[.12em] text-stone-500">Lucro bruto · vendas diretas</p><p className="mt-1 text-3xl font-extrabold">{short(data.current.profit)}</p><p className="text-xs text-stone-500"><Delta node={t.profit} /> · era {short(data.previous.profit)}</p></div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5"><p className="text-[11px] font-bold uppercase tracking-[.12em] text-stone-500">Margem bruta</p><p className="mt-1 text-3xl font-extrabold">{num(data.current.marginPercent, 0)}%</p><p className="text-xs text-stone-500"><Delta node={t.marginPercent} points /> · era {num(data.previous.marginPercent, 0)}%</p></div>
      </div>

      <div className="rounded-2xl border border-l-4 border-stone-200 border-l-teal-700 bg-white p-5 text-[15px] leading-7">
        <p className="text-[11px] font-bold uppercase tracking-[.12em] text-stone-500">Em 3 frases</p>
        <p><b>O que puxou:</b> {data.sentences.pulled}</p>
        <p><b>O que segurou:</b> {data.sentences.held}</p>
        <p><b>O que vigiar:</b> {data.sentences.watch}</p>
      </div>

      <div>
        <h2 className="text-lg font-bold">Árvore do resultado</h2>
        <p className="text-xs text-stone-500">de onde veio cada número · verde melhorou, vermelho piorou</p>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className="mb-3 rounded-xl border-2 border-stone-900 px-3 py-2"><p className="text-[11px] text-stone-500">Receita das vendas diretas</p><p className="text-lg font-extrabold">{short(t.revenue.previous ?? 0)} → {short(t.revenue.current ?? 0)}</p></div>
            <div className="flex flex-wrap gap-2">
              <TreeNode label="Clientes que compraram" node={t.clients} format={(v) => num(v, 0)} /><Op>×</Op>
              <TreeNode label="Pedidos por cliente" node={t.ordersPerClient} format={(v) => num(v)} /><Op>×</Op>
              <TreeNode label="Pedido médio" node={t.ticket} format={brl} />
            </div>
            {data.current.newClients > 0 && <p className="mt-2 text-xs text-stone-500">{data.current.newClients} cliente(s) novo(s) trouxeram {short(data.current.newClientsRevenue)}.</p>}
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className="mb-3 rounded-xl border-2 border-stone-900 px-3 py-2"><p className="text-[11px] text-stone-500">Lucro bruto</p><p className="text-lg font-extrabold">{short(t.profit.previous ?? 0)} → {short(t.profit.current ?? 0)}</p></div>
            <div className="flex flex-wrap gap-2">
              <TreeNode label="Kg vendidos" node={t.kg} format={(v) => `${num(v, 0)} kg`} /><Op>×</Op>
              <TreeNode label="Preço por kg" node={t.pricePerKg} format={brl} /><Op>−</Op>
              <TreeNode label="Custo por kg" node={t.costPerKg} format={(v) => `R$ ${num(v)}`} />
            </div>
            <div className="mt-2 flex flex-wrap gap-2 sm:pl-[34%]">
              <TreeNode label="Perda na torra" node={t.lossPercent} format={(v) => `${num(v)}%`} points />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="font-bold">Ponte do lucro</h2>
          <p className="text-xs text-stone-500">o que somou e o que tirou entre os dois períodos</p>
          <div className="mt-4 flex h-[200px] items-end gap-3">
            {[
              { label: "Antes", value: b.start, tone: "bg-stone-500" },
              { label: "mais volume", value: b.volume, tone: b.volume >= 0 ? "bg-emerald-500" : "bg-red-500" },
              { label: "preço", value: b.price, tone: b.price >= 0 ? "bg-emerald-500" : "bg-red-500" },
              { label: "custo", value: b.cost, tone: b.cost >= 0 ? "bg-emerald-500" : "bg-red-500" },
              { label: "Agora", value: b.end, tone: "bg-teal-700" },
            ].map((bar, i) => (
              <div key={bar.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1 text-center text-[11px]">
                <b className={`text-xs ${i > 0 && i < 4 ? (bar.value >= 0 ? "text-emerald-700" : "text-red-700") : ""}`}>{i > 0 && i < 4 && bar.value > 0 ? "+" : ""}{short(bar.value)}</b>
                <span className={`block w-full rounded-md ${bar.tone}`} style={{ height: h(bar.value) }} />
                <span className="text-stone-500">{bar.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="font-bold">Olhar para frente · próximos 30 dias</h2>
          <p className="text-xs text-stone-500">projeção pela árvore, com o ritmo atual</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-stone-200 p-3"><p className="text-xs text-stone-500">Conservador</p><p className="text-xl font-extrabold">{short(f.conservative)}</p><p className="text-[11px] text-stone-500">só os {f.recurringActiveClients} recorrentes</p></div>
            <div className="rounded-xl border-2 border-teal-700 bg-teal-50 p-3"><p className="text-xs text-stone-500">Provável</p><p className="text-xl font-extrabold">{short(f.likely)}</p><p className="text-[11px] text-stone-500">os clientes atuais repetem</p></div>
            <div className="rounded-xl border border-stone-200 p-3"><p className="text-xs text-stone-500">Crescimento</p><p className="text-xl font-extrabold">{short(f.growth)}</p><p className="text-[11px] text-stone-500">+ {f.newClientsAssumed} cliente(s) novo(s)</p></div>
          </div>
          <ul className="mt-3 divide-y divide-stone-100 text-sm">
            <li className="flex justify-between gap-3 py-2"><b>Café verde</b><span>{g.days === null ? "sem torra no período" : <>{num(g.availableKg, 0)} kg · acaba ~{ddmm(g.runOutAt)} · <b>comprar até {ddmm(g.buyBy)}</b></>}</span></li>
            <li className="flex justify-between gap-3 py-2"><b>Em atraso</b><span>{data.ahead.overdue > 0 ? <span className="font-bold text-red-700">{brl(data.ahead.overdue)}</span> : "nada vencido"}</span></li>
            {data.ahead.whatIf && <li className="flex justify-between gap-3 py-2"><b>Margem</b><span>{num(data.current.marginPercent, 0)}% → <b>{num(data.ahead.whatIf.marginPercent, 0)}%</b> com +R$ {data.ahead.whatIf.priceIncrease}/kg e perda de {num(data.ahead.whatIf.lossTarget)}%</span></li>}
            <li className="flex justify-between gap-3 py-2"><b>Meta do próximo mês</b><span>{data.ahead.goal ? brl(data.ahead.goal) : <>não definida · sugestão <b>{short(data.ahead.suggestedGoal)}</b></>}</span></li>
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="font-bold">Plano de ação (5W2H)</h2>
        <p className="text-xs text-stone-500">cada ação vem de um ramo que piorou ou de um risco à frente · toque no status para avançar</p>
        {data.actions.length === 0 ? <p className="mt-3 flex items-center gap-2 text-sm text-emerald-800"><CheckCircle2 size={16} /> Nenhuma ação urgente: os números estão no caminho.</p> : (
          <ol className="mt-2 divide-y divide-stone-100">
            {data.actions.map((a, i) => {
              const st = STATUS[a.status] ?? STATUS.TODO!;
              const Icon = st.icon;
              return (
                <li key={a.key} className={`grid gap-2 py-3 sm:grid-cols-[28px_1fr_150px_auto] sm:items-center ${a.status === "DONE" || a.status === "DISMISSED" ? "opacity-60" : ""}`}>
                  <span className="grid size-7 place-items-center rounded-full bg-stone-900 text-xs font-extrabold text-white">{i + 1}</span>
                  <div>
                    <p className="font-bold">{a.title}</p>
                    <p className="text-xs text-stone-600"><b>Por quê:</b> {a.why} <b>Como:</b> {a.how} <b>Quem:</b> {a.who}. <b>Quando:</b> {a.when}.</p>
                    <Link href={a.link} className="text-xs font-bold text-teal-800">Abrir →</Link>
                  </div>
                  <span className="text-sm font-bold sm:text-right">{a.impactLabel}</span>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => void setStatus(a, NEXT[a.status] ?? "DOING")} className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold ${st.tone}`}><Icon size={13} /> {st.label}</button>
                    {a.status !== "DISMISSED" && a.status !== "DONE" && <button type="button" aria-label={`Descartar ${a.title}`} onClick={() => void setStatus(a, "DISMISSED")} className="rounded-full px-2 text-xs text-stone-400">✕</button>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="font-bold">Onde agir · matriz de produtos</h2>
          <p className="text-xs text-stone-500">volume vendido × margem (90 dias)</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            {([["EMPURRAR", "Empurrar", "margem alta, pouco volume", "bg-sky-50"], ["PROTEGER", "Proteger", "margem alta e volume", "bg-emerald-50"], ["REVER", "Rever", "pouco volume, margem baixa", "bg-stone-100"], ["AJUSTAR_PRECO", "Ajustar preço", "muito volume, margem baixa", "bg-amber-50"]] as const).map(([key, title, help, tone]) => (
              <div key={key} className={`rounded-xl p-3 ${tone}`}>
                <p className="text-sm font-bold">{title}</p><p className="text-stone-500">{help}</p>
                <div className="mt-1 flex flex-wrap gap-1">{groups[key].length ? groups[key].map((c) => <span key={c.name} className="rounded-full border border-stone-200 bg-white px-2 py-0.5 font-semibold">{c.name} {num(c.marginPercent, 0)}%</span>) : <span className="text-stone-400">—</span>}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="font-bold">Curva ABC de clientes</h2>
          <p className="text-xs text-stone-500">quem faz 80% da receita (12 meses)</p>
          <div className="mt-3 flex h-4 overflow-hidden rounded-full bg-stone-200"><span className="bg-teal-700" style={{ width: `${data.abc.share.A}%` }} /><span className="bg-teal-300" style={{ width: `${data.abc.share.B}%` }} /></div>
          <ul className="mt-3 space-y-1.5 text-sm">
            <li><b>A · {data.abc.A.length} · {data.abc.share.A}%</b> <span className="text-stone-600">{data.abc.A.join(", ")}</span></li>
            <li><b>B · {data.abc.B.length} · {data.abc.share.B}%</b> <span className="text-stone-600">{data.abc.B.join(", ") || "—"}</span></li>
            <li><b>C · {data.abc.C.length} · {data.abc.share.C}%</b> <span className="text-stone-600">{data.abc.C.length} cliente(s)</span></li>
          </ul>
          <p className="mt-3 rounded-xl border border-teal-100 bg-teal-50 p-3 text-xs">Clientes A: visita mensal. Clientes C: oferta de segunda compra pelo WhatsApp.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="font-bold">Estratégia (FOFA)</h2>
        <p className="text-xs text-stone-500">gerada pelos números · para reunião e decisões maiores</p>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          {([["Forças", data.swot.strengths, "border-emerald-200 bg-emerald-50"], ["Fraquezas", data.swot.weaknesses, "border-orange-200 bg-orange-50"], ["Oportunidades", data.swot.opportunities, "border-sky-200 bg-sky-50"], ["Ameaças", data.swot.threats, "border-red-200 bg-red-50"]] as const).map(([title, list, tone]) => (
            <div key={title} className={`rounded-xl border p-3 ${tone}`}>
              <p className="text-sm font-bold">{title}</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-xs">{list.length ? list.map((item) => <li key={item}>{item}</li>) : <li className="text-stone-400">nada relevante agora</li>}</ul>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-stone-500">
        Qualidade dos dados: custo exato em {data.quality.exactCostShare}% da receita
        {data.quality.batchConfirmShare >= 30 ? ` · ${data.quality.batchConfirmShare}% das entregas confirmadas em lote` : ""}. A leitura usa regras fixas, mostra sempre o número de origem e fica mais precisa conforme os dados são completados.
      </p>
    </section>
  );
}
