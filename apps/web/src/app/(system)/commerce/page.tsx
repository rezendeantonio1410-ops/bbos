"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, Globe2, LockKeyhole, Save, ShoppingBag, TriangleAlert } from "lucide-react";
import { Badge, Card } from "@bbos/ui";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

type Product = { id: string; product: string; presentation: string; units: number; revenue: number };
type Dashboard = { vendasOnline: number; pedidosOnline: number; ticketMedio: number; clientes: number; pedidosPendentes: number; vendasUltimos30Dias: number; vendasPeriodoAnterior: number; pedidosUltimos30Dias: number; ticketMedio30Dias: number; historicoVendas: Array<{ label: string; value: number }>; produtosMaisVendidos: Product[]; atencao: Array<{ key: string; label: string; count: number; href: string }>; currency: string; isDemo: boolean };
type Channel = { id: string; code: string; name: string; type: string; currency?: string | null; active: boolean };
type PriceRow = { id: string; productVariantId: string; salesChannelId: string; currency: string; price: string | number; active: boolean; validFrom?: string | null; validUntil?: string | null; maxRequestDiscountPercent: string | number; maxApprovalDiscountPercent: string | number; minimumPrice?: string | number | null; minimumMarginPercent?: string | number | null; minimumRoiPercent?: string | number | null; channelCode: string; channelName: string; channelType: string; sku: string; netWeightGrams: number; productName: string; lineName: string };
type PriceDraft = { price: string; maxRequestDiscountPercent: string; maxApprovalDiscountPercent: string; minimumPrice: string; minimumMarginPercent: string; minimumRoiPercent: string };

const emptyDashboard: Dashboard = { vendasOnline: 0, pedidosOnline: 0, ticketMedio: 0, clientes: 0, pedidosPendentes: 0, vendasUltimos30Dias: 0, vendasPeriodoAnterior: 0, pedidosUltimos30Dias: 0, ticketMedio30Dias: 0, historicoVendas: [], produtosMaisVendidos: [], atencao: [], currency: "BRL", isDemo: true };
const emptyDraft = (): PriceDraft => ({ price: "", maxRequestDiscountPercent: "0", maxApprovalDiscountPercent: "0", minimumPrice: "", minimumMarginPercent: "", minimumRoiPercent: "" });

export default function CommercePage() {
  const [data, setData] = React.useState<Dashboard | null>(null);
  const [channels, setChannels] = React.useState<Channel[]>([]);
  const [prices, setPrices] = React.useState<PriceRow[]>([]);
  const [drafts, setDrafts] = React.useState<Record<string, PriceDraft>>({});
  const [channelFilter, setChannelFilter] = React.useState("ALL");
  const [saving, setSaving] = React.useState("");
  const [message, setMessage] = React.useState("");

  const load = React.useCallback(async () => {
    const [dashboardResponse, channelsResponse, pricesResponse] = await Promise.all([
      fetch(`${API}/commerce/dashboard`, { credentials: "include", cache: "no-store" }),
      fetch(`${API}/commerce/channels`, { credentials: "include", cache: "no-store" }),
      fetch(`${API}/commerce/prices`, { credentials: "include", cache: "no-store" }),
    ]);
    if (dashboardResponse.ok) setData(await dashboardResponse.json());
    if (channelsResponse.ok) setChannels(await channelsResponse.json());
    if (pricesResponse.ok) {
      const rows: PriceRow[] = await pricesResponse.json();
      setPrices(rows);
      setDrafts(Object.fromEntries(rows.map((row) => [row.id, toDraft(row)])));
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  const value = data ?? emptyDashboard;
  const variation = value.vendasPeriodoAnterior ? ((value.vendasUltimos30Dias - value.vendasPeriodoAnterior) / value.vendasPeriodoAnterior) * 100 : null;
  const visiblePrices = channelFilter === "ALL" ? prices : prices.filter((row) => row.salesChannelId === channelFilter);

  const updateDraft = (id: string, field: keyof PriceDraft, value: string) => {
    setDrafts((current) => {
      const base: PriceDraft = current[id] ?? emptyDraft();
      return { ...current, [id]: { ...base, [field]: value } };
    });
  };

  const savePrice = async (row: PriceRow) => {
    const draft = drafts[row.id];
    if (!draft) return;
    setSaving(row.id);
    setMessage("");
    const response = await fetch(`${API}/commerce/prices/${row.id}`, { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ price: numberOrZero(draft.price), maxRequestDiscountPercent: numberOrZero(draft.maxRequestDiscountPercent), maxApprovalDiscountPercent: numberOrZero(draft.maxApprovalDiscountPercent), minimumPrice: nullableNumber(draft.minimumPrice), minimumMarginPercent: nullableNumber(draft.minimumMarginPercent), minimumRoiPercent: nullableNumber(draft.minimumRoiPercent) }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) setMessage(payload.message ?? "Não foi possível atualizar a política comercial.");
    else { setMessage(`${row.productName} · ${presentation(row.netWeightGrams)} atualizado.`); await load(); }
    setSaving("");
  };

  return <div className="mx-auto max-w-[1500px]">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-[#087568]"><Globe2 size={14}/> BBOS Commerce</p><h1 className="mt-2 text-3xl font-bold">Commerce</h1><p className="mt-2 text-sm text-[#626B69]">Canais, desempenho e política comercial conectados ao mesmo núcleo de preços.</p></div><Badge tone={value.isDemo ? "warning" : "success"}>{value.isDemo ? "Sem canal e-commerce" : "Dados reais do canal"}</Badge></header>
    {message && <div className="mt-5 rounded-xl border border-[#DDE7E4] bg-[#F4F8F7] px-4 py-3 text-xs font-semibold text-[#205C53]">{message}</div>}
    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Metric label="Vendas online" value={brl.format(value.vendasOnline)}/><Metric label="Pedidos online" value={String(value.pedidosOnline)}/><Metric label="Ticket médio" value={brl.format(value.ticketMedio)}/><Metric label="Clientes" value={String(value.clientes)}/><Metric label="Pedidos pendentes" value={String(value.pedidosPendentes)}/></div>

    <section className="mt-6 rounded-2xl border border-[#E7E7E3] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-violet-700"><LockKeyhole size={13}/> Uso interno</p><h2 className="mt-1 text-lg font-bold">Tabela de preços e governança comercial</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-[#626B69]">Esta é a fonte de verdade usada nos pedidos. O cliente vê apenas o preço final aprovado; limites, margem, ROI e aprovações permanecem internos.</p></div><select value={channelFilter} onChange={(event) => setChannelFilter(event.target.value)} className="rounded-xl border border-[#E7E7E3] bg-white px-3 py-2 text-xs font-semibold"><option value="ALL">Todos os canais</option>{channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}</select></div>
      <div className="mt-5 overflow-x-auto"><div className="min-w-[1180px]"><div className="grid grid-cols-[230px_110px_120px_120px_120px_120px_110px_80px] gap-2 border-b border-[#E7E7E3] px-2 pb-2 text-[9px] font-bold uppercase tracking-wider text-[#7A8381]"><span>Produto / canal</span><span>Preço oficial</span><span>Máx. solicitar</span><span>Máx. aprovar</span><span>Preço mínimo</span><span>Margem mínima</span><span>ROI mínimo</span><span/></div><div className="divide-y divide-[#EFEFEB]">{visiblePrices.map((row) => { const draft = drafts[row.id] ?? toDraft(row); return <div key={row.id} className="grid grid-cols-[230px_110px_120px_120px_120px_120px_110px_80px] items-center gap-2 px-2 py-3"><div className="min-w-0"><p className="truncate text-xs font-bold text-[#202523]">{row.productName} · {presentation(row.netWeightGrams)}</p><p className="mt-1 truncate text-[10px] text-[#7A8381]">{row.lineName} · {row.channelName} · {row.sku}</p></div><PriceInput value={draft.price} onChange={(v) => updateDraft(row.id,"price",v)} prefix="R$"/><PriceInput value={draft.maxRequestDiscountPercent} onChange={(v) => updateDraft(row.id,"maxRequestDiscountPercent",v)} suffix="%"/><PriceInput value={draft.maxApprovalDiscountPercent} onChange={(v) => updateDraft(row.id,"maxApprovalDiscountPercent",v)} suffix="%"/><PriceInput value={draft.minimumPrice} onChange={(v) => updateDraft(row.id,"minimumPrice",v)} prefix="R$" placeholder="—"/><PriceInput value={draft.minimumMarginPercent} onChange={(v) => updateDraft(row.id,"minimumMarginPercent",v)} suffix="%" placeholder="—"/><PriceInput value={draft.minimumRoiPercent} onChange={(v) => updateDraft(row.id,"minimumRoiPercent",v)} suffix="%" placeholder="—"/><button disabled={saving===row.id} onClick={() => void savePrice(row)} className="inline-flex items-center justify-center gap-1 rounded-xl bg-[#14201D] px-3 py-2.5 text-[10px] font-bold text-white disabled:opacity-50"><Save size={12}/>{saving===row.id?"...":"Salvar"}</button></div>})}{!visiblePrices.length && <div className="py-10 text-center text-xs text-[#7A8381]">Nenhuma linha de preço cadastrada para este filtro.</div>}</div></div></div>
      <div className="mt-4 rounded-xl bg-[#F7F8F6] px-4 py-3 text-[10px] leading-5 text-[#626B69]"><strong>Regra:</strong> o máximo aprovável nunca pode ser maior que o máximo solicitável. O pedido também respeita preço mínimo, margem mínima e ROI mínimo antes de permitir qualquer solicitação de desconto.</div>
    </section>

    <section className="mt-6 grid gap-4 xl:grid-cols-[1.35fr_.65fr]"><Card className="p-5"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#087568]">Desempenho da loja</p><h2 className="mt-1 text-lg font-bold">Vendas nos últimos 30 dias</h2></div><Badge tone="neutral">{value.pedidosUltimos30Dias} pedidos</Badge></div><div className="mt-4 flex flex-wrap gap-6"><Metric label="Vendas" value={brl.format(value.vendasUltimos30Dias)}/><Metric label="Ticket médio" value={brl.format(value.ticketMedio30Dias)}/><Metric label="Período anterior" value={variation === null ? "Sem histórico" : `${variation >= 0 ? "+" : ""}${variation.toFixed(1)}%`}/></div>{value.historicoVendas.some((point) => point.value > 0) ? <SalesChart points={value.historicoVendas}/> : <EmptyState text="Ainda não há histórico suficiente de vendas online para exibir evolução."/>}</Card><Attention items={value.atencao}/></section>
    <section className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_.8fr]"><Card className="p-5"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#087568]">Catálogo</p><h2 className="mt-1 text-lg font-bold">Produtos mais vendidos</h2></div><Link href="/produtos" className="text-xs font-bold text-[#087568]">Catálogo <ArrowRight className="inline" size={13}/></Link></div>{value.produtosMaisVendidos.length ? <div className="mt-4 space-y-3">{value.produtosMaisVendidos.map((item,index)=><Link href={`/vendas/produtos/${item.id}`} key={item.id} className="flex items-center gap-3 rounded-xl border border-[#E7E7E3] p-3 transition hover:bg-[#F7F9F8]"><span className="grid size-7 place-items-center rounded-lg bg-[#F0F0ED] text-xs font-bold text-[#087568]">{index+1}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{item.product} <span className="font-medium text-[#626B69]">{item.presentation}</span></p><div className="mt-1 h-1 rounded-full bg-[#E7E7E3]"><div className="h-full rounded-full bg-[#087568]" style={{width:`${Math.min((item.revenue/Math.max(value.vendasUltimos30Dias,1))*100,100)}%`}}/></div></div><div className="text-right"><p className="text-xs font-bold">{brl.format(item.revenue)}</p><p className="text-[10px] text-[#7A8381]">{item.units} un.</p></div></Link>)}</div> : <EmptyState text="Os produtos aparecerão aqui quando houver pedidos online faturados."/>}</Card><Card className="p-5"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#087568]">Estoque único BBOS</p><h2 className="mt-1 text-lg font-bold">Estoque que merece atenção</h2></div><Link href="/estoque" className="text-xs font-bold text-[#087568]">Ver estoque <ArrowRight className="inline" size={13}/></Link></div><div className="mt-4 rounded-xl border border-dashed border-[#E7E7E3] p-5 text-center"><TriangleAlert className="mx-auto text-[#E99A35]" size={20}/><p className="mt-2 text-xs font-semibold">A análise por canal será ativada com o histórico de pedidos online.</p><p className="mt-1 text-[10px] text-[#7A8381]">O saldo continua sendo o mesmo estoque físico, reservado e disponível do BBOS.</p></div></Card></section>
    <section className="mt-5"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#087568]">Canais</p><h2 className="mt-1 text-lg font-bold">Canais de venda</h2></div><Link href="/pedidos" className="text-xs font-bold text-[#087568]">Ver pedidos <ArrowRight className="inline" size={13}/></Link></div><div className="mt-3 grid gap-3 md:grid-cols-3">{channels.length ? channels.map((channel)=><Link href="/pedidos" key={channel.id}><Card className="flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-md"><span className="grid size-9 place-items-center rounded-full bg-[#F0F0ED] text-[#087568]"><ShoppingBag size={16}/></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{channel.name}</p><p className="text-[10px] text-[#7A8381]">{channel.type} · {channel.currency ?? "moeda da conta"}</p></div><ArrowRight size={13} className="text-[#7A8381]"/></Card></Link>) : <Card className="p-4 text-xs text-[#7A8381]">Nenhum canal ativo cadastrado.</Card>}</div></section>
  </div>;
}

function toDraft(row: PriceRow): PriceDraft { return { price: String(row.price ?? ""), maxRequestDiscountPercent: String(row.maxRequestDiscountPercent ?? 0), maxApprovalDiscountPercent: String(row.maxApprovalDiscountPercent ?? 0), minimumPrice: row.minimumPrice == null ? "" : String(row.minimumPrice), minimumMarginPercent: row.minimumMarginPercent == null ? "" : String(row.minimumMarginPercent), minimumRoiPercent: row.minimumRoiPercent == null ? "" : String(row.minimumRoiPercent) }; }
function numberOrZero(value:string){const number=Number(value.replace(",","."));return Number.isFinite(number)?number:0}
function nullableNumber(value:string){if(!value.trim())return null;const number=Number(value.replace(",","."));return Number.isFinite(number)?number:null}
function presentation(grams:number){return grams>=1000?`${grams/1000} kg`:`${grams} g`}
function PriceInput({value,onChange,prefix,suffix,placeholder}:{value:string;onChange:(value:string)=>void;prefix?:string;suffix?:string;placeholder?:string}){return <label className="flex items-center rounded-xl border border-[#E7E7E3] bg-white px-2.5 py-2"><span className="mr-1 text-[9px] font-semibold text-[#7A8381]">{prefix}</span><input value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder} inputMode="decimal" className="min-w-0 flex-1 bg-transparent text-xs font-semibold outline-none"/><span className="ml-1 text-[9px] font-semibold text-[#7A8381]">{suffix}</span></label>}
function Attention({items}:{items:Dashboard["atencao"]}){return <Card className="p-5"><div className="flex items-center gap-2"><TriangleAlert size={16} className="text-[#E99A35]"/><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#E99A35]">Operação comercial</p><h2 className="mt-1 text-lg font-bold">Pedidos que precisam de atenção</h2></div></div>{items.length?<div className="mt-4 divide-y divide-[#E7E7E3]">{items.map((item)=><Link href={item.href} key={item.key} className="flex items-center justify-between gap-3 py-3 first:pt-0"><span><p className="text-xs font-semibold">{item.label}</p><p className="text-[10px] text-[#7A8381]">Ação operacional necessária</p></span><span className="flex items-center gap-2"><Badge tone="warning">{item.count}</Badge><ArrowRight size={13} className="text-[#7A8381]"/></span></Link>)}</div>:<EmptyState text="Nenhum pedido exige atenção neste momento."/>}</Card>}
function SalesChart({points}:{points:Array<{label:string;value:number}>}){const max=Math.max(...points.map((p)=>p.value),1);const path=points.map((p,i)=>`${i*(280/Math.max(points.length-1,1))+20},${112-(p.value/max)*85}`).join(" ");return <div className="mt-5"><svg viewBox="0 0 320 140" className="h-36 w-full" role="img" aria-label="Evolução das vendas online"><line x1="20" x2="300" y1="112" y2="112" stroke="#E7E7E3"/><polyline points={path} fill="none" stroke="#087568" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>{points.map((p,i)=><text key={p.label} x={i*(280/Math.max(points.length-1,1))+20} y="132" textAnchor="middle" fontSize="9" fill="#7A8381">{p.label}</text>)}</svg></div>}
function EmptyState({text}:{text:string}){return <div className="mt-5 rounded-xl border border-dashed border-[#E7E7E3] p-6 text-center text-xs text-[#7A8381]"><BarChart3 className="mx-auto mb-2 text-[#B5C1BD]" size={19}/>{text}</div>}
function Metric({label,value}:{label:string;value:string}){return <div><p className="text-[10px] font-semibold text-[#626B69]">{label}</p><p className="mt-1 text-lg font-bold">{value}</p></div>}
