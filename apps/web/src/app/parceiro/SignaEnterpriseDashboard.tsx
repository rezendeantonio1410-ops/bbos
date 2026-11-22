"use client";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, CreditCard, FileText, LayoutDashboard, MapPinned, Package, Plus, Search, ShoppingCart, Users } from "lucide-react";

export type SignaOrderSummary = {
  id: string; code: string; status: string; totalAmount: number | string; orderedAt: string;
  customerName: string; billingRecipientName?: string | null; endCustomerName?: string | null; volumeKg?: number | string | null; paymentDate?: string | null; openAmount?: number | string | null; receivableStatus?: string | null; invoiceStatus?: string | null;
  invoicePdfAvailable?: boolean; invoiceNumber?: string | null; billingAvailable?: boolean;
};
type CommercialReport = {
  monthly: Array<{month:string;orders:number;kilograms:number;orderValue:number}>;
  products: Array<{sku:string;product:string;units:number;kilograms:number;orderValue:number}>;
  regions: Array<{state:string|null;city:string|null;orders:number;kilograms:number;orderValue:number}>;
  notice:string;
  availableYears:string[];
  selectedYear:number|null;
};
function SignaReports() {
  const [data,setData] = useState<CommercialReport|null>(null);
  const [error,setError] = useState("");
  const [period,setPeriod] = useState("all");
  useEffect(()=>{
    const controller = new AbortController();
    setError("");
    setData(null);
    const path = period==="all"
      ? "/api/partner-portal/commercial-reports"
      : `/api/partner-portal/commercial-reports?year=${encodeURIComponent(period)}`;
    void fetch(path,{credentials:"include",cache:"no-store",signal:controller.signal})
      .then(async response=>{if(!response.ok)throw new Error("Não foi possível carregar os relatórios.");return response.json() as Promise<CommercialReport>;})
      .then(result=>{if(!controller.signal.aborted)setData(result);})
      .catch(cause=>{if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:"Erro ao carregar relatórios.");});
    return ()=>controller.abort();
  },[period]);
  const months = data?.monthly??[];
  const years = data?.availableYears??[];
  const kg=months.reduce((sum,m)=>sum+Number(m.kilograms),0);
  const amount=months.reduce((sum,m)=>sum+Number(m.orderValue),0);
  const downloadCsv=()=>{
    if(!data)return;
    const lines=[["Período","Pedidos","Quilos","Valor de pedidos (BRL)"],...months.map(m=>[m.month,m.orders,m.kilograms,m.orderValue])];
    const csv="\uFEFF"+lines.map(line=>line.map(value=>`"${String(value).replace(/"/g,'""')}"`).join(";")).join("\r\n");
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
    const link=document.createElement("a");link.href=url;link.download=`signa-relatorio-mensal-${period}.csv`;link.click();URL.revokeObjectURL(url);
  };
  return <section id="relatorios-signa" className="rounded-xl border border-slate-200 bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-semibold text-[#0E191D]">Inteligência comercial</h3><p className="text-xs text-slate-500">Pedidos, produtos e regiões · valores de pedidos, não pagamentos</p></div>
      <div className="flex items-center gap-2"><label htmlFor="signa-report-period" className="text-xs font-medium">Ano</label><select id="signa-report-period" value={period} onChange={e=>setPeriod(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-2 text-sm"><option value="all">Todos</option>{years.map(year=><option key={year} value={year}>{year}</option>)}</select><button type="button" disabled={!data} onClick={downloadCsv} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-40">Exportar CSV mensal</button></div>
    </div>
    {error&&<p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    {!data&&!error&&<p className="mt-4 text-sm text-slate-500">Carregando dados comerciais...</p>}
    {data&&<div className="mt-4 space-y-5">
      {!months.length&&<p role="status" className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">Nenhum pedido encontrado neste período.</p>}
      <div className="grid gap-3 sm:grid-cols-3">{[["Volume",`${kg.toLocaleString("pt-BR",{maximumFractionDigits:2})} kg`],["Valor de pedidos",currency.format(amount)],["Pedidos",String(months.reduce((s,m)=>s+Number(m.orders),0))]].map(([label,value])=><div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>)}</div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h4 className="text-sm font-semibold text-[#0E191D]">Evolução de compras</h4>
        <p className="mb-4 text-xs text-slate-500">Volume mensal (kg) · pedidos reais</p>
        {months.length ? <div className="flex h-44 items-end gap-2 overflow-x-auto border-b border-slate-200 pb-2" role="img" aria-label="Gráfico de volume mensal de compras em quilogramas">
          {months.map(m=>{const maximum=Math.max(1,...months.map(entry=>Number(entry.kilograms)));return <div key={m.month} className="flex h-full min-w-12 flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[10px] tabular-nums text-slate-600">{Number(m.kilograms).toLocaleString("pt-BR",{maximumFractionDigits:0})}</span>
            <div title={`${m.month}: ${m.kilograms} kg`} className="w-full max-w-14 rounded-t-md bg-[#25734c]" style={{height:`${Math.max(2,Number(m.kilograms)/maximum*112)}px`}}/>
            <span className="text-[10px] text-slate-600">{m.month.slice(5)}</span>
          </div>})}
        </div>:<p className="text-sm text-slate-500">Sem compras registradas no período.</p>}
      </div>
      <div className="overflow-x-auto"><h4 className="mb-2 text-sm font-semibold">Evolução mensal · dados detalhados</h4><table className="w-full min-w-[440px] text-left text-sm"><thead><tr className="border-b"><th className="py-2">Mês</th><th>Pedidos</th><th>Kg</th><th>Valor</th></tr></thead><tbody>{months.map(m=><tr key={m.month} className="border-b"><td className="py-2">{m.month}</td><td>{m.orders}</td><td>{Number(m.kilograms).toLocaleString("pt-BR",{maximumFractionDigits:2})}</td><td>{currency.format(m.orderValue)}</td></tr>)}</tbody></table></div>
      <div className="overflow-x-auto"><h4 className="mb-2 text-sm font-semibold">Produtos · histórico completo</h4><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b"><th className="py-2">Produto</th><th>SKU</th><th>Unidades</th><th>Kg</th><th>Valor</th></tr></thead><tbody>{data.products.map(p=><tr key={p.sku} className="border-b"><td className="py-2">{p.product}</td><td>{p.sku}</td><td>{p.units}</td><td>{Number(p.kilograms).toLocaleString("pt-BR",{maximumFractionDigits:2})}</td><td>{currency.format(p.orderValue)}</td></tr>)}</tbody></table></div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h4 className="text-sm font-semibold text-[#0E191D]">Compras por região</h4>
        <p className="mb-4 text-xs text-slate-500">Volume (kg) por UF · apenas clientes com região informada</p>
        {data.regions.length ? <div className="space-y-3">{data.regions.slice(0,10).map((region,index)=>{
          const maximum=Math.max(1,...data.regions.map(item=>Number(item.kilograms)));
          return <div key={index} className="grid grid-cols-[42px_1fr_78px] items-center gap-3 text-xs">
            <span className="font-semibold">{region.state||"—"}</span>
            <div className="h-3 overflow-hidden rounded-full bg-[#EBEBEB]"><div className="h-full rounded-full bg-[#25734c]" style={{width:`${Math.min(100,Number(region.kilograms)/maximum*100)}%`}}/></div>
            <span className="text-right tabular-nums">{Number(region.kilograms).toLocaleString("pt-BR",{maximumFractionDigits:1})} kg</span>
          </div>;
        })}</div>:<p className="text-sm text-slate-500">Ainda não há clientes com compras e localização registrada.</p>}
      </div>
      <div className="overflow-x-auto"><h4 className="mb-2 text-sm font-semibold">Regiões · clientes finais informados</h4><table className="w-full min-w-[440px] text-left text-sm"><thead><tr className="border-b"><th className="py-2">UF</th><th>Cidade</th><th>Kg</th><th>Valor</th></tr></thead><tbody>{data.regions.map((p,i)=><tr key={i} className="border-b"><td className="py-2">{p.state||"—"}</td><td>{p.city||"Não informada"}</td><td>{Number(p.kilograms).toLocaleString("pt-BR",{maximumFractionDigits:2})}</td><td>{currency.format(p.orderValue)}</td></tr>)}</tbody></table></div>
      <p className="text-xs text-slate-500">{data.notice}</p>
    </div>}
  </section>;
}
function SignaCustomerHistory() {
  type CustomerRow = {id:string;name:string;city:string|null;state:string|null;orderCount:number;totalOrders:number;lastOrderAt:string|null};
  const [rows,setRows] = useState<CustomerRow[]>([]);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [search,setSearch] = useState("");
  const [expanded,setExpanded] = useState(false);
  const [saving,setSaving] = useState(false);
  const [name,setName] = useState("");
  const [city,setCity] = useState("");
  const [state,setState] = useState("");
  const [phone,setPhone] = useState("");
  const [email,setEmail] = useState("");
  const [notes,setNotes] = useState("");
  const [refresh,setRefresh] = useState(0);
  useEffect(()=>{
    const controller = new AbortController();
    void fetch("/api/partner-portal/end-customer-history",{credentials:"include",cache:"no-store",signal:controller.signal})
      .then(async response=>{if(!response.ok)throw new Error("Histórico indisponível.");return response.json();})
      .then(result=>{if(!controller.signal.aborted)setRows(result.customers);})
      .catch(()=>{if(!controller.signal.aborted)setError("Não foi possível carregar o histórico.");});
    return ()=>controller.abort();
  },[refresh]);
  const visible=rows.filter(row=>(row.name+" "+(row.city??"")).toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));
  const saveCustomer=async (event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    if(saving)return;
    setSaving(true);setError("");setNotice("");
    try{
      const response=await fetch("/api/partner-portal/end-customers",{
        method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({name:name.trim(),city:city.trim(),state:state.trim().toUpperCase(),phone:phone.trim(),email:email.trim(),notes:notes.trim()}),
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.message||"Não foi possível cadastrar o cliente.");
      setName("");setCity("");setState("");setPhone("");setEmail("");setNotes("");
      setExpanded(false);setNotice("Cliente comercial cadastrado com sucesso.");setRefresh(value=>value+1);
      window.dispatchEvent(new Event("bbos:signa-customers:updated"));
    }catch(cause){setError(cause instanceof Error?cause.message:"Erro ao cadastrar cliente.");}
    finally{setSaving(false);}
  };
  return <section id="clientes-signa" className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-lg font-semibold text-[#0E191D]">Clientes da Signa</h3><p className="text-xs text-slate-500">Carteira comercial independente dos destinatários fiscais Signa e Rodrigo</p></div>
      <button type="button" onClick={()=>setExpanded(value=>!value)} aria-expanded={expanded} className="rounded-lg bg-[#0E191D] px-4 py-2.5 text-sm font-semibold text-white">{expanded?"Fechar cadastro":"+ Cadastrar cliente"}</button>
    </div>
    {expanded&&<form onSubmit={saveCustomer} className="mt-4 space-y-3 rounded-xl border border-[#c7d8d3] bg-[#E0EAE9]/40 p-4">
      <p className="text-sm font-semibold text-[#0E191D]">Novo cliente atendido pela Signa</p>
      <p className="text-xs text-slate-600">Cadastro somente comercial. Não altera o cliente fiscal, a NF-e nem os preços dos pedidos.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold">Nome do cliente *<input required minLength={2} maxLength={180} value={name} onChange={e=>setName(e.target.value)} placeholder="Nome ou razão social" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal"/></label>
        <label className="text-xs font-semibold">Cidade<input maxLength={120} value={city} onChange={e=>setCity(e.target.value)} placeholder="Cidade" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal"/></label>
        <label className="text-xs font-semibold">UF<input maxLength={2} pattern="[A-Za-z]{2}" value={state} onChange={e=>setState(e.target.value.toUpperCase())} placeholder="PR" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal"/></label>
        <label className="text-xs font-semibold">Telefone<input maxLength={40} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Telefone de contato" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal"/></label>
        <label className="text-xs font-semibold sm:col-span-2">E-mail<input type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder="E-mail do cliente" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal"/></label>
        <label className="text-xs font-semibold sm:col-span-2">Observações<textarea maxLength={1000} rows={2} value={notes} onChange={e=>setNotes(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal"/></label>
      </div>
      <button type="submit" disabled={saving||!name.trim()} className="rounded-lg bg-[#0E191D] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving?"Salvando...":"Salvar cliente comercial"}</button>
    </form>}
    {error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {notice&&<p role="status" className="mt-3 text-sm font-semibold text-emerald-800">{notice}</p>}
    <div className="mt-5 flex items-center justify-between gap-3"><h4 className="text-sm font-semibold">Carteira e histórico de clientes</h4><input type="search" aria-label="Pesquisar clientes" placeholder="Buscar cliente" value={search} onChange={e=>setSearch(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm"/></div>
    <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead className="bg-[#EBEBEB]"><tr><th className="p-3">Cliente</th><th>Localidade</th><th>Pedidos</th><th>Valor dos pedidos</th><th>Último pedido</th></tr></thead><tbody className="divide-y">{visible.map(row=><tr key={row.id}><td className="p-3 font-semibold">{row.name}</td><td>{[row.city,row.state].filter(Boolean).join(" / ")||"—"}</td><td>{row.orderCount}</td><td>{currency.format(Number(row.totalOrders))}</td><td>{row.lastOrderAt?new Date(row.lastOrderAt).toLocaleDateString("pt-BR"):"—"}</td></tr>)}</tbody></table>{!visible.length&&!error&&<p className="p-3 text-sm text-slate-500">Nenhum cliente registrado neste filtro.</p>}</div>
    <p className="mt-3 text-xs text-slate-500">Valores de pedidos, não de notas fiscais ou pagamentos recebidos.</p>
  </section>;
}
const currency = new Intl.NumberFormat("pt-BR", {style:"currency",currency:"BRL"});
const stages: Record<string,string> = {DRAFT:"Em análise",CONFIRMED:"Aprovado",RESERVED:"Estoque reservado",IN_PRODUCTION:"Em produção",PICKING:"Em preparação",READY_TO_SHIP:"Pronto",INVOICED:"Faturado",SHIPPED:"Expedido",DELIVERED:"Concluído",CANCELLED:"Cancelado"};
const menu = [
  {label:"Início",href:"#inicio",icon:LayoutDashboard},
  {label:"Pedidos",href:"#pedidos-em-andamento",icon:ShoppingCart},
  {label:"Produtos",href:"#catalogo-signa",icon:Package},
  {label:"Clientes",href:"#clientes-signa",icon:Users},
  {label:"Faturamento",href:"#historico-pedidos",icon:FileText},
  {label:"Pagamentos",href:null,icon:CreditCard},
  {label:"Relatórios",href:"#relatorios-signa",icon:BarChart3},
  {label:"Mapas",href:null,icon:MapPinned},
];
type OrderTimelineEvent = {id:string;orderId:string;title:string;detail:string;occurredAt:string};
export function SignaEnterpriseDashboard({orders,partnerName,events=[]}:{orders:SignaOrderSummary[];partnerName:string;events?:OrderTimelineEvent[]}) {
  const [search,setSearch] = useState("");
  const [filter,setFilter] = useState("Todos");
  const [menuOpen,setMenuOpen] = useState(false);
  const [expandedOrder,setExpandedOrder] = useState<string | null>(null);
  useEffect(()=>{if(expandedOrder)document.getElementById("signa-order-timeline")?.scrollIntoView({behavior:"smooth",block:"start"});},[expandedOrder]);
  const filtered = useMemo(()=>orders.filter(o=>{
    const text = (o.code+" "+o.customerName).toLocaleLowerCase("pt-BR");
    const matches = !search || text.includes(search.toLocaleLowerCase("pt-BR"));
    return matches && (filter==="Todos" || (filter==="Em produção" ? o.status==="IN_PRODUCTION" : filter==="Faturado" ? o.status==="INVOICED" : filter==="Concluído" ? o.status==="DELIVERED" : !["INVOICED","DELIVERED","CANCELLED"].includes(o.status)));
  }),[orders,search,filter]);
  const activeOrders = useMemo(()=>orders.filter(o=>!["DELIVERED","CANCELLED"].includes(o.status)),[orders]);
  const orderProgress: Record<string,number> = {DRAFT:1,CONFIRMED:2,RESERVED:2,IN_PRODUCTION:3,PICKING:4,READY_TO_SHIP:4,INVOICED:5,SHIPPED:5,DELIVERED:6};
  const sum=orders.reduce((s,o)=>s+Number(o.totalAmount||0),0);
  const invoiced = orders.filter(o=>o.invoiceStatus==="AUTHORIZED").reduce((s,o)=>s+Number(o.totalAmount||0),0);
  return (
    <section id="inicio" className="relative space-y-4" aria-label="Painel comercial Signa">
      <button type="button" onClick={()=>setMenuOpen(v=>!v)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold lg:hidden" aria-expanded={menuOpen}>Menu do portal</button>
      <aside className={`${menuOpen?"block":"hidden"} rounded-xl bg-[#0E191D] p-4 text-white lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block lg:w-52 lg:rounded-none lg:pt-28`}>
        <p className="mb-5 border-b border-white/20 pb-4 text-xs font-semibold uppercase tracking-[.14em] text-slate-300">Portal do parceiro</p>
        <nav aria-label="Módulos Signa" className="space-y-1">
          {menu.map(({label,href,icon:Icon})=>href ? (
            <a key={label} href={href} onClick={()=>setMenuOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-100 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"><Icon size={17}/>{label}</a>
          ) : (
            <span key={label} aria-disabled="true" title="Módulo em implementação" className="flex items-center justify-between gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-slate-400">
              <span className="flex items-center gap-3"><Icon size={17}/>{label}</span>
              <span className="text-[9px] font-normal uppercase tracking-wide text-slate-400">Em breve</span>
            </span>
          ))}
        </nav>
        <p className="mt-8 border-t border-white/20 pt-4 text-xs text-slate-300">{partnerName} · Bispo Coffees</p>
      </aside>
      <div className="overflow-hidden rounded-xl border border-[#21384b] text-white shadow-sm" style={{background:"linear-gradient(110deg,#0E191D 0%,#152e36 55%,#244934 100%)"}}>
        <div className="flex min-h-36 items-center gap-5 px-5 py-7 sm:px-8">
          <div aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-full border border-[#cbb78d] bg-black/20 font-serif text-2xl text-[#e9dec8]">SC</div>
          <div><p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#cbdcd7]">Bispo Coffees · Portal do parceiro</p>
          <h2 className="mt-1 font-serif text-3xl font-semibold tracking-tight">{partnerName}</h2>
          <p className="mt-2 max-w-2xl text-sm text-[#e0eae9]">Bem-vindo ao seu portal comercial. Faça pedidos, acompanhe a produção e analise seus resultados.</p></div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={()=>window.dispatchEvent(new Event("bbos:partner-order:new"))} className="inline-flex items-center gap-2 rounded-lg bg-[#0E191D] px-5 py-3 text-sm font-semibold text-white"><Plus size={16}/> Novo pedido</button>
        {[["Meus pedidos","#pedidos-em-andamento"],["Notas fiscais","#historico-pedidos"],["Produtos","#catalogo-signa"],["Relatórios","#relatorios-signa"]].map(([label,href])=><a key={label} href={href} className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50">{label}</a>)}
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5" aria-label="Indicadores de pedidos">
        {[
          ["Pedidos",String(orders.length),"Histórico completo"],
          ["Volume comprado",`${orders.reduce((s,o)=>s+Number(o.volumeKg||0),0).toLocaleString("pt-BR",{maximumFractionDigits:1})} kg`,"Peso dos pedidos"],
          ["Valor dos pedidos",currency.format(sum),"Pedidos registrados"],
          ["NF autorizada",currency.format(invoiced),"Pedidos com NF autorizada"],
          ["Concluídos",String(orders.filter(o=>o.status==="DELIVERED").length),"Pedidos entregues"]
        ].map(([label,value,detail])=><article key={label} className="min-w-0 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-600">{label}</p>
          <p className="mt-1 truncate text-xl font-semibold tracking-tight text-[#0E191D]" title={value}>{value}</p>
          <p className="mt-1 text-[10px] text-slate-500">{detail}</p>
        </article>)}
      </div>
      <section id="pedidos-em-andamento" className="rounded-lg border border-slate-200 bg-white shadow-sm" aria-label="Tabela de pedidos">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
          <div><h3 className="text-lg font-semibold text-[#0E191D]">Meus pedidos</h3><p className="text-xs text-slate-500">Acompanhamento operacional e financeiro</p></div>
          <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2"><Search size={16}/><span className="sr-only">Buscar pedido</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar pedido ou cliente" className="w-48 bg-transparent text-sm outline-none"/></label>
        </div>
        <div className="flex gap-2 overflow-x-auto px-5 py-3">{["Todos","Em análise","Em produção","Faturado","Concluído"].map(label=><button key={label} type="button" onClick={()=>setFilter(label)} aria-pressed={filter===label} className={`shrink-0 rounded-md px-3 py-2 text-xs font-semibold ${filter===label?"bg-[#0E191D] text-white":"border border-slate-200 text-slate-600"}`}>{label}</button>)}</div>
        <div className="divide-y divide-slate-100 md:hidden">
          {filtered.map(o=><article key={o.id} className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-[#0E191D]">{o.code}</p><p className="mt-1 text-xs text-slate-500">{new Date(o.orderedAt).toLocaleDateString("pt-BR")}</p></div><span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium">{stages[o.status]||o.status}</span></div>
            <div className="text-xs text-slate-600">Pagamento: <strong>{o.receivableStatus==="PAID"?"Pago":o.receivableStatus==="PARTIALLY_PAID"?"Parcialmente pago":o.receivableStatus==="OVERDUE"?"Vencido":o.receivableStatus==="OPEN"?"Pendente":"Não confirmado"}</strong>{o.receivableStatus==="PAID"&&o.paymentDate?` · ${new Date(o.paymentDate).toLocaleDateString("pt-BR")}`:""}</div><div><p className="text-xs text-slate-500">Faturar para</p><p className="text-sm font-medium">{o.billingRecipientName||o.customerName}</p><p className="mt-1 text-xs text-slate-500">Cliente atendido: {o.endCustomerName||"Não informado"} · {Number(o.volumeKg||0).toLocaleString("pt-BR",{maximumFractionDigits:2})} kg</p></div>
            <div className="flex items-center justify-between gap-2"><strong className="text-base text-[#0E191D]">{currency.format(Number(o.totalAmount))}</strong>{o.invoiceStatus==="AUTHORIZED"&&o.invoicePdfAvailable?<a href={`/api/partner-portal/orders/${o.id}/invoice/pdf`} target="_blank" rel="noreferrer" className="rounded-lg bg-[#0E191D] px-3 py-2 text-xs font-semibold text-white">Ver nota fiscal</a>:o.billingAvailable?<a href={`/api/partner-portal/orders/${o.id}/billing/pdf`} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold">Ver cobrança</a>:<span className="text-xs text-slate-500">Documentos pendentes</span>}</div>
          </article>)}
          {!filtered.length&&<p className="p-5 text-center text-sm text-slate-500">Nenhum pedido encontrado.</p>}
        </div>
        <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[900px] text-left text-xs"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{["Pedido","Data","Faturar para","Cliente (registro)","Volume (kg)","Valor","Situação","Pagamento","Pago em","Documentos"].map(x=><th key={x} scope="col" className="px-5 py-3 font-semibold">{x}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{filtered.map(o=><tr key={o.id} className="hover:bg-slate-50"><td className="px-3 py-3 font-semibold"><button type="button" aria-expanded={expandedOrder===o.id} onClick={()=>setExpandedOrder(value=>value===o.id?null:o.id)} className="text-left font-semibold text-[#0E191D] underline decoration-slate-300 underline-offset-4 hover:decoration-[#0E191D]">{o.code}</button></td><td className="px-3 py-3">{new Date(o.orderedAt).toLocaleDateString("pt-BR")}</td><td className="px-5 py-4">{o.billingRecipientName||o.customerName}</td><td className="px-5 py-4">{o.endCustomerName||"Não informado"}</td><td className="px-5 py-4">{Number(o.volumeKg||0).toLocaleString("pt-BR",{maximumFractionDigits:2})}</td><td className="px-5 py-4">{currency.format(Number(o.totalAmount))}</td><td className="px-5 py-4"><span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium">{stages[o.status]||o.status}</span></td><td className="px-5 py-4"><span className={`rounded-md px-2 py-1 text-xs font-semibold ${o.receivableStatus==="PAID"?"bg-emerald-100 text-emerald-800":o.receivableStatus==="PARTIALLY_PAID"?"bg-amber-100 text-amber-800":"bg-slate-100 text-slate-700"}`}>{o.receivableStatus==="PAID"?"Pago":o.receivableStatus==="PARTIALLY_PAID"?"Parcialmente pago":o.receivableStatus==="OVERDUE"?"Vencido":o.receivableStatus==="OPEN"?"Pendente":"Não confirmado"}</span></td><td className="px-5 py-4">{o.receivableStatus==="PAID"&&o.paymentDate?new Date(o.paymentDate).toLocaleDateString("pt-BR"):"—"}</td><td className="px-5 py-4">{o.invoiceStatus==="AUTHORIZED"&&o.invoicePdfAvailable?<a className="font-semibold text-emerald-800 underline" href={`/api/partner-portal/orders/${o.id}/invoice/pdf`} target="_blank" rel="noreferrer">Ver NF</a>:o.billingAvailable?<a className="font-semibold text-emerald-800 underline" href={`/api/partner-portal/orders/${o.id}/billing/pdf`} target="_blank" rel="noreferrer">Ver cobrança</a>:<span className="text-xs text-slate-500">Aguardando</span>}</td></tr>)}</tbody></table>{!filtered.length&&<p className="p-6 text-center text-sm text-slate-500">Nenhum pedido encontrado.</p>}</div>
      </section>
      <section aria-label="Pedidos em andamento" className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-base font-semibold text-[#0E191D]">Pedidos em andamento</h3><span className="text-xs text-slate-500">{activeOrders.length} pedido(s)</span></div>
        {activeOrders.length===0?<p className="text-sm text-slate-500">Nenhum pedido em andamento.</p>:
        <div className="flex snap-x gap-3 overflow-x-auto pb-2">
          {activeOrders.map(o=><article key={o.id} className="w-64 shrink-0 snap-start rounded-lg border border-slate-200 bg-slate-50 p-3 sm:w-72">
            <div className="flex items-center justify-between gap-2"><strong className="text-sm text-[#0E191D]">{o.code}</strong><span className="rounded bg-white px-2 py-1 text-[11px] font-medium text-slate-700">{stages[o.status]||o.status}</span></div>
            <p className="mt-2 truncate text-xs text-slate-500">{o.customerName}</p>
            <div className="mt-3 flex gap-1" role="img" aria-label={`Etapa ${orderProgress[o.status]??1} de 6: ${stages[o.status]||o.status}`}>
              {[1,2,3,4,5,6].map(n=><span key={n} className={`h-1.5 flex-1 rounded-full ${n<=(orderProgress[o.status]??1)?"bg-[#0E191D]":"bg-slate-200"}`}/>)}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2"><span className="text-xs font-semibold">{currency.format(Number(o.totalAmount||0))}</span><button type="button" aria-expanded={expandedOrder===o.id} aria-controls="signa-order-timeline" onClick={()=>setExpandedOrder(value=>value===o.id?null:o.id)} className="text-xs font-semibold text-[#0E191D] underline">Ver detalhes</button></div>
          </article>)}
        </div>}
      </section>
      {expandedOrder&&<section id="signa-order-timeline" className="scroll-mt-28 rounded-xl border border-[#b4c6c1] bg-white p-5" aria-label="Linha do tempo do pedido">
        <div className="flex items-center justify-between gap-3"><h3 className="text-base font-semibold text-[#0E191D]">Linha do tempo · {orders.find(o=>o.id===expandedOrder)?.code}</h3><button type="button" onClick={()=>setExpandedOrder(null)} className="text-sm font-semibold underline">Fechar</button></div>
        <p className="mt-1 text-xs text-slate-500">Datas e horários registrados pelo BBOS; etapas sem registro não são estimadas.</p>
        <ol className="mt-4 space-y-3 border-l-2 border-[#25734c] pl-5">
          <li className="relative text-sm"><span className="font-semibold">Pedido registrado</span><time className="ml-2 text-slate-600">{orders.find(o=>o.id===expandedOrder)?.orderedAt?new Date(orders.find(o=>o.id===expandedOrder)!.orderedAt).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"}):"Data indisponível"}</time></li>
          {events.filter(e=>e.orderId===expandedOrder).sort((a,b)=>new Date(a.occurredAt).getTime()-new Date(b.occurredAt).getTime()).map(e=><li key={e.id} className="text-sm"><span className="font-semibold">{e.title}</span><time className="ml-2 text-slate-600">{new Date(e.occurredAt).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"})}</time><p className="text-xs text-slate-500">{e.detail}</p></li>)}
          {!events.some(e=>e.orderId===expandedOrder)&&<li className="text-sm text-slate-500">Sem eventos adicionais registrados para este pedido.</li>}
        </ol>
      </section>}
      <div className="sticky bottom-3 z-20 mx-auto w-fit rounded-xl border border-slate-200 bg-white/95 p-1.5 shadow-lg backdrop-blur md:hidden">
        <button type="button" onClick={()=>window.dispatchEvent(new Event("bbos:partner-order:new"))} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#0E191D] px-6 text-sm font-semibold text-white"><Plus size={18}/> Novo pedido</button>
      </div>
      <SignaCustomerHistory/>
      <SignaReports/>
    </section>
  );
}
