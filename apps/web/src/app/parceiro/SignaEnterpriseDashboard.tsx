"use client";
import { useMemo, useState } from "react";
import { BarChart3, CreditCard, FileText, LayoutDashboard, MapPinned, Package, Plus, Search, ShoppingCart, Users } from "lucide-react";

export type SignaOrderSummary = {
  id: string; code: string; status: string; totalAmount: number | string; orderedAt: string;
  customerName: string; receivableStatus?: string | null; invoiceStatus?: string | null;
  invoicePdfAvailable?: boolean; invoiceNumber?: string | null; billingAvailable?: boolean;
};
const currency = new Intl.NumberFormat("pt-BR", {style:"currency",currency:"BRL"});
const stages: Record<string,string> = {DRAFT:"Em análise",CONFIRMED:"Aprovado",RESERVED:"Estoque reservado",IN_PRODUCTION:"Em produção",PICKING:"Em preparação",READY_TO_SHIP:"Pronto",INVOICED:"Faturado",SHIPPED:"Expedido",DELIVERED:"Concluído",CANCELLED:"Cancelado"};
const menu = [
  {label:"Início",href:"#inicio",icon:LayoutDashboard},
  {label:"Pedidos",href:"#pedidos-em-andamento",icon:ShoppingCart},
  {label:"Produtos",href:"#catalogo-signa",icon:Package},
  {label:"Clientes",href:"#historico-pedidos",icon:Users},
  {label:"Faturamento",href:"#historico-pedidos",icon:FileText},
  {label:"Pagamentos",href:"#historico-pedidos",icon:CreditCard},
  {label:"Relatórios",href:"#relatorios-signa",icon:BarChart3},
  {label:"Mapas",href:"#relatorios-signa",icon:MapPinned},
];
export function SignaEnterpriseDashboard({orders,partnerName}:{orders:SignaOrderSummary[];partnerName:string}) {
  const [search,setSearch] = useState("");
  const [filter,setFilter] = useState("Todos");
  const [menuOpen,setMenuOpen] = useState(false);
  const filtered = useMemo(()=>orders.filter(o=>{
    const text = (o.code+" "+o.customerName).toLocaleLowerCase("pt-BR");
    const matches = !search || text.includes(search.toLocaleLowerCase("pt-BR"));
    return matches && (filter==="Todos" || (filter==="Em produção" ? o.status==="IN_PRODUCTION" : filter==="Faturado" ? o.status==="INVOICED" : filter==="Concluído" ? o.status==="DELIVERED" : !["INVOICED","DELIVERED","CANCELLED"].includes(o.status)));
  }),[orders,search,filter]);
  const sum=orders.reduce((s,o)=>s+Number(o.totalAmount||0),0);
  const invoiced = orders.filter(o=>o.invoiceStatus==="AUTHORIZED").reduce((s,o)=>s+Number(o.totalAmount||0),0);
  return (
    <section id="inicio" className="relative space-y-4" aria-label="Painel comercial Signa">
      <button type="button" onClick={()=>setMenuOpen(v=>!v)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold lg:hidden" aria-expanded={menuOpen}>Menu do portal</button>
      <aside className={`${menuOpen?"block":"hidden"} rounded-xl bg-[#0E191D] p-4 text-white lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block lg:w-52 lg:rounded-none lg:pt-28`}>
        <p className="mb-5 border-b border-white/20 pb-4 text-xs font-semibold uppercase tracking-[.14em] text-slate-300">Portal do parceiro</p>
        <nav aria-label="Módulos Signa" className="space-y-1">
          {menu.map(({label,href,icon:Icon})=><a key={label} href={href} onClick={()=>setMenuOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-100 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"><Icon size={17}/>{label}</a>)}
        </nav>
        <p className="mt-8 border-t border-white/20 pt-4 text-xs text-slate-300">{partnerName} · Bispo Coffees</p>
      </aside>
      <div className="overflow-hidden rounded-lg border border-[#d5dedc] bg-white text-[#0E191D] shadow-sm">
        <div className="border-l-4 border-l-[#0A0A0A] px-5 py-5 sm:px-7">
          <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-teal-800">Bispo Coffees · Portal comercial</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">{partnerName}</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">Pedidos, produção, documentos fiscais e pagamentos em um único ambiente.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={()=>window.dispatchEvent(new Event("bbos:partner-order:new"))} className="inline-flex items-center gap-2 rounded-lg bg-[#0E191D] px-5 py-3 text-sm font-semibold text-white"><Plus size={16}/> Novo pedido</button>
        {[["Meus pedidos","#pedidos-em-andamento"],["Notas fiscais","#historico-pedidos"],["Produtos","#catalogo-signa"],["Relatórios","#relatorios-signa"]].map(([label,href])=><a key={label} href={href} className="rounded-lg border border-[#d5dedc] bg-white px-5 py-3 text-sm font-medium text-slate-800 hover:bg-[#EBEBEB]">{label}</a>)}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Pedidos",String(orders.length),"Histórico disponível"],
          ["Total em pedidos",currency.format(sum),"Valor dos pedidos"],
          ["Pedidos com NF autorizada",currency.format(invoiced),"Valor dos pedidos com NF autorizada"],
          ["Concluídos",String(orders.filter(o=>o.status==="DELIVERED").length),"Pedidos entregues"]
        ].map(([label,value,detail])=><article key={label} className="rounded-lg border border-[#d5dedc] bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-3 text-2xl font-semibold tracking-tight text-[#0E191D]">{value}</p><p className="mt-2 text-xs text-slate-500">{detail}</p></article>)}
      </div>
      <section id="pedidos-em-andamento" className="rounded-lg border border-[#d5dedc] bg-white shadow-sm" aria-label="Tabela de pedidos">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d5dedc] p-5">
          <div><h3 className="text-lg font-semibold text-[#0E191D]">Meus pedidos</h3><p className="text-xs text-slate-500">Acompanhamento operacional e financeiro</p></div>
          <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2"><Search size={16}/><span className="sr-only">Buscar pedido</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar pedido ou cliente" className="w-48 bg-transparent text-sm outline-none"/></label>
        </div>
        <div className="flex gap-2 overflow-x-auto px-5 py-3">{["Todos","Em análise","Em produção","Faturado","Concluído"].map(label=><button key={label} type="button" onClick={()=>setFilter(label)} aria-pressed={filter===label} className={`shrink-0 rounded-md px-3 py-2 text-xs font-semibold ${filter===label?"bg-[#0E191D] text-white":"border border-[#d5dedc] text-slate-600"}`}>{label}</button>)}</div>
        <div className="divide-y divide-slate-100 md:hidden">
          {filtered.map(o=><article key={o.id} className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-[#0E191D]">{o.code}</p><p className="mt-1 text-xs text-slate-500">{new Date(o.orderedAt).toLocaleDateString("pt-BR")}</p></div><span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium">{stages[o.status]||o.status}</span></div>
            <div><p className="text-xs text-slate-500">Cliente</p><p className="text-sm font-medium">{o.customerName}</p></div>
            <div className="flex items-center justify-between gap-2"><strong className="text-base text-[#0E191D]">{currency.format(Number(o.totalAmount))}</strong>{o.invoiceStatus==="AUTHORIZED"&&o.invoicePdfAvailable?<a href={`/api/partner-portal/orders/${o.id}/invoice/pdf`} target="_blank" rel="noreferrer" className="rounded-lg bg-[#0E191D] px-3 py-2 text-xs font-semibold text-white">Ver nota fiscal</a>:o.billingAvailable?<a href={`/api/partner-portal/orders/${o.id}/billing/pdf`} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold">Ver cobrança</a>:<span className="text-xs text-slate-500">Documentos pendentes</span>}</div>
          </article>)}
          {!filtered.length&&<p className="p-5 text-center text-sm text-slate-500">Nenhum pedido encontrado.</p>}
        </div>
        <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-[#EBEBEB] text-xs text-slate-500"><tr>{["Pedido","Data","Cliente","Valor","Situação","Documentos"].map(x=><th key={x} scope="col" className="px-5 py-3 font-semibold">{x}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{filtered.map(o=><tr key={o.id} className="hover:bg-[#EBEBEB]"><td className="px-5 py-4 font-semibold">{o.code}</td><td className="px-5 py-4">{new Date(o.orderedAt).toLocaleDateString("pt-BR")}</td><td className="px-5 py-4">{o.customerName}</td><td className="px-5 py-4">{currency.format(Number(o.totalAmount))}</td><td className="px-5 py-4"><span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium">{stages[o.status]||o.status}</span></td><td className="px-5 py-4">{o.invoiceStatus==="AUTHORIZED"&&o.invoicePdfAvailable?<a className="font-semibold text-emerald-800 underline" href={`/api/partner-portal/orders/${o.id}/invoice/pdf`} target="_blank" rel="noreferrer">Ver NF</a>:o.billingAvailable?<a className="font-semibold text-emerald-800 underline" href={`/api/partner-portal/orders/${o.id}/billing/pdf`} target="_blank" rel="noreferrer">Ver cobrança</a>:<span className="text-xs text-slate-500">Aguardando</span>}</td></tr>)}</tbody></table>{!filtered.length&&<p className="p-6 text-center text-sm text-slate-500">Nenhum pedido encontrado.</p>}</div>
      </section>
      <div className="sticky bottom-3 z-20 mx-auto w-fit rounded-xl border border-[#d5dedc] bg-white/95 p-1.5 shadow-lg backdrop-blur md:hidden">
        <button type="button" onClick={()=>window.dispatchEvent(new Event("bbos:partner-order:new"))} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#0E191D] px-6 text-sm font-semibold text-white"><Plus size={18}/> Novo pedido</button>
      </div>
      <section id="relatorios-signa" className="rounded-xl border border-[#d5dedc] bg-white p-5"><h3 className="text-lg font-semibold text-[#0E191D]">Inteligência comercial</h3><p className="mt-2 text-sm text-slate-600">Os relatórios de kg, clientes e mapa serão habilitados após a integração dos dados de itens e localização. Nenhum volume geográfico é estimado.</p></section>
    </section>
  );
}
