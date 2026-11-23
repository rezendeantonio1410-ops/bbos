"use client";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, CreditCard, LayoutDashboard, MapPinned, Package, Plus, Search, ShoppingCart, Users } from "lucide-react";
import { brazilianCepDigits, formatBrazilianCep } from "@/lib/brazil-address";
import { SignaPurchasesMap } from "@/components/signa-purchases-map";
import { signaStatePurchases } from "@/lib/signa-region-map";
import { BispoSeal } from "@/components/bispo-seal";
import { SignaPixButton } from "@/components/signa-pix-dialog";
import { useCnpjRegistryAutofill } from "@/lib/use-cnpj-registry-autofill";
import { fillEmptyFromCnpj } from "@/lib/cnpj-registry";
import { useBrazilianCepAutofill } from "@/lib/use-brazilian-cep-autofill";
import { getSignaOrderTimelineEvents } from "@/lib/signa-order-timeline";
import { emptySignaEndCustomerForm, formatCnpj, validateSignaEndCustomerForm, type SignaEndCustomerForm } from "@/lib/signa-end-customer-form";

export type SignaOrderSummary = {
  id: string; code: string; status: string; totalAmount: number | string; orderedAt: string;
  customerName: string; billingRecipientName?: string | null; endCustomerName?: string | null; volumeKg?: number | string | null; paymentDate?: string | null; dueDate?: string | null; paymentType?: "CASH" | "TERM" | null; receivableAmount?: number | string | null; openAmount?: number | string | null; receivableStatus?: string | null; invoiceStatus?: string | null;
  invoicePdfAvailable?: boolean; invoiceNumber?: string | null; billingAvailable?: boolean; pixAvailable?: boolean;
};
type CommercialReport = {
  monthly: Array<{month:string;orders:number;kilograms:number;orderValue:number}>;
  products: Array<{sku:string;product:string;units:number;kilograms:number;orderValue:number}>;
  regions: Array<{state:string|null;city:string|null;orders:number;kilograms:number;orderValue:number;customers?:number}>;
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
      {period!=="all"&&<div className="grid gap-3 sm:grid-cols-3" aria-label={`Totais de ${period}`}>{[["Volume",`${kg.toLocaleString("pt-BR",{maximumFractionDigits:2})} kg`],["Valor de pedidos",currency.format(amount)],["Pedidos",String(months.reduce((s,m)=>s+Number(m.orders),0))]].map(([label,value])=><div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>)}</div>}
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
      <details className="rounded-xl border border-slate-200 bg-white"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Ver evolução mensal em tabela</summary><div className="overflow-x-auto px-4 pb-4"><table className="w-full min-w-[440px] text-left text-sm"><thead><tr className="border-b"><th className="py-2">Mês</th><th>Pedidos</th><th>Kg</th><th>Valor</th></tr></thead><tbody>{months.map(m=><tr key={m.month} className="border-b"><td className="py-2">{m.month}</td><td>{m.orders}</td><td>{Number(m.kilograms).toLocaleString("pt-BR",{maximumFractionDigits:2})}</td><td>{currency.format(m.orderValue)}</td></tr>)}</tbody></table></div></details>
      <div className="overflow-x-auto"><h4 className="mb-2 text-sm font-semibold">Produtos · histórico completo</h4><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b"><th className="py-2">Produto</th><th>SKU</th><th>Unidades</th><th>Kg</th><th>Valor</th></tr></thead><tbody>{data.products.map(p=><tr key={p.sku} className="border-b"><td className="py-2">{p.product}</td><td>{p.sku}</td><td>{p.units}</td><td>{Number(p.kilograms).toLocaleString("pt-BR",{maximumFractionDigits:2})}</td><td>{currency.format(p.orderValue)}</td></tr>)}</tbody></table></div>
      <div id="mapa-signa" className="scroll-mt-24">
        <SignaPurchasesMap states={signaStatePurchases(data.regions)}/>
      </div>
      <details className="rounded-xl border border-slate-200 bg-white"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Ver dados do mapa em tabela</summary><div className="overflow-x-auto px-4 pb-4"><table className="w-full min-w-[440px] text-left text-sm"><thead><tr className="border-b"><th className="py-2">UF</th><th>Cidade</th><th>Kg</th><th>Valor</th></tr></thead><tbody>{data.regions.map((p,i)=><tr key={i} className="border-b"><td className="py-2">{p.state||"—"}</td><td>{p.city||"Não informada"}</td><td>{Number(p.kilograms).toLocaleString("pt-BR",{maximumFractionDigits:2})}</td><td>{currency.format(p.orderValue)}</td></tr>)}</tbody></table></div></details>
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
  const [form,setForm] = useState<SignaEndCustomerForm>(emptySignaEndCustomerForm);
  const [phone,setPhone] = useState("");
  const [email,setEmail] = useState("");
  const [notes,setNotes] = useState("");
  const setField = (field: keyof SignaEndCustomerForm, value: string) => setForm(previous => ({...previous,[field]:value}));
  const cepLookup = useBrazilianCepAutofill({
    postalCode: form.postalCode,
    enabled: expanded,
    onResolved: result => setForm(previous => ({...previous, street: result.address, district: result.district, city: result.city, state: result.state})),
  });
  // Complete CNPJ → Receita Federal lookup; fills only EMPTY fields. IE stays manual.
  const cnpjLookup = useCnpjRegistryAutofill({
    cnpj: form.taxId,
    enabled: expanded,
    onResolved: record => {
      setForm(previous => fillEmptyFromCnpj(previous as unknown as Record<string,string>, record, {
        name: "legalName", postalCode: "postalCode", street: "street", number: "number",
        district: "district", complement: "complement", city: "city", state: "state",
        stateRegistration: r => r.suggestedStateRegistration ?? null,
      }) as unknown as SignaEndCustomerForm);
      setPhone(current => current.trim() ? current : record.phone ?? "");
      setEmail(current => current.trim() ? current : record.email ?? "");
    },
  });
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
    const validation=validateSignaEndCustomerForm(form);
    if(!validation.ok){setError(validation.error);setNotice("");return;}
    setSaving(true);setError("");setNotice("");
    try{
      const response=await fetch("/api/partner-portal/end-customers",{
        method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({...validation.payload,phone:phone.trim(),email:email.trim(),notes:notes.trim()}),
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(Array.isArray(payload.message)?payload.message.join(" "):payload.message||"Não foi possível cadastrar o cliente.");
      setForm(emptySignaEndCustomerForm);setPhone("");setEmail("");setNotes("");
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
      <div className="grid gap-3 sm:grid-cols-6">
        <label className="text-xs font-semibold sm:col-span-6">Nome / Razão social *<input required minLength={2} maxLength={180} autoComplete="organization" value={form.name} onChange={e=>setField("name",e.target.value)} placeholder="Nome ou razão social" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal"/></label>
        <label className="text-xs font-semibold sm:col-span-3">CNPJ *<input required inputMode="numeric" placeholder="00.000.000/0000-00" value={formatCnpj(form.taxId)} onChange={e=>setField("taxId",e.target.value.replace(/\D/g,"").slice(0,14))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal"/></label>
        <label className="text-xs font-semibold sm:col-span-3">CEP *<input required inputMode="numeric" placeholder="00000-000" value={formatBrazilianCep(form.postalCode)} onChange={e=>setField("postalCode",brazilianCepDigits(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal"/></label>
        {cnpjLookup.statusText&&<p role="status" className={`text-xs sm:col-span-6 ${cnpjLookup.warning?"font-semibold text-amber-800":"text-slate-600"}`}>{cnpjLookup.statusText}</p>}
        {cepLookup.statusText&&<p role="status" className="text-xs text-slate-600 sm:col-span-6">{cepLookup.statusText}</p>}
        <label className="text-xs font-semibold sm:col-span-4">Rua *<input required maxLength={180} value={form.street} onChange={e=>setField("street",e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal"/></label>
        <label className="text-xs font-semibold sm:col-span-2">Número *<input required maxLength={30} placeholder="S/N" value={form.number} onChange={e=>setField("number",e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal"/></label>
        <label className="text-xs font-semibold sm:col-span-3">Bairro *<input required maxLength={120} value={form.district} onChange={e=>setField("district",e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal"/></label>
        <label className="text-xs font-semibold sm:col-span-3">Complemento<input maxLength={120} value={form.complement} onChange={e=>setField("complement",e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal"/></label>
        <label className="text-xs font-semibold sm:col-span-4">Cidade *<input required maxLength={120} value={form.city} onChange={e=>setField("city",e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal"/></label>
        <label className="text-xs font-semibold sm:col-span-2">UF *<input required maxLength={2} pattern="[A-Za-z]{2}" value={form.state} onChange={e=>setField("state",e.target.value.replace(/[^a-z]/gi,"").toUpperCase().slice(0,2))} placeholder="PR" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal"/></label>
        <label className="text-xs font-semibold sm:col-span-3">Inscrição estadual<input maxLength={20} placeholder="Números ou ISENTO (opcional)" value={form.stateRegistration??""} onChange={e=>setField("stateRegistration",e.target.value.toUpperCase())} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal"/><span className="mt-1 block font-normal text-slate-500">Sugerida pelo cadastro público quando houver; confira.</span></label>
        <label className="text-xs font-semibold sm:col-span-3">Telefone<input maxLength={40} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Telefone de contato" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal"/></label>
        <label className="text-xs font-semibold sm:col-span-3">E-mail<input type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder="E-mail do cliente" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal"/></label>
        <label className="text-xs font-semibold sm:col-span-6">Observações<textarea maxLength={1000} rows={2} value={notes} onChange={e=>setNotes(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal"/></label>
      </div>
      <button type="submit" disabled={saving||!form.name.trim()} className="rounded-lg bg-[#0E191D] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving?"Salvando...":"Salvar cliente comercial"}</button>
    </form>}
    {error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {notice&&<p role="status" className="mt-3 text-sm font-semibold text-emerald-800">{notice}</p>}
    <div className="mt-5 flex items-center justify-between gap-3"><h4 className="text-sm font-semibold">Carteira e histórico de clientes</h4><input type="search" aria-label="Pesquisar clientes" placeholder="Buscar cliente" value={search} onChange={e=>setSearch(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm"/></div>
    <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead className="bg-[#EBEBEB]"><tr><th className="p-3">Cliente</th><th>Localidade</th><th>Pedidos</th><th>Valor dos pedidos</th><th>Último pedido</th></tr></thead><tbody className="divide-y">{visible.map(row=><tr key={row.id}><td className="p-3 font-semibold">{row.name}</td><td>{[row.city,row.state].filter(Boolean).join(" / ")||"—"}</td><td>{row.orderCount}</td><td>{currency.format(Number(row.totalOrders))}</td><td>{row.lastOrderAt?new Date(row.lastOrderAt).toLocaleDateString("pt-BR"):"—"}</td></tr>)}</tbody></table>{!visible.length&&!error&&<p className="p-3 text-sm text-slate-500">Nenhum cliente registrado neste filtro.</p>}</div>
    <p className="mt-3 text-xs text-slate-500">Valores de pedidos, não de notas fiscais ou pagamentos recebidos.</p>
  </section>;
}
function greeting(){const hour=new Date().getHours();return hour<12?"Bom dia":hour<18?"Boa tarde":"Boa noite";}
const currency = new Intl.NumberFormat("pt-BR", {style:"currency",currency:"BRL"});
const stages: Record<string,string> = {DRAFT:"Em análise",CONFIRMED:"Aprovado",RESERVED:"Estoque reservado",IN_PRODUCTION:"Em produção",PICKING:"Em preparação",READY_TO_SHIP:"Pronto",INVOICED:"Faturado",SHIPPED:"Expedido",DELIVERED:"Concluído",CANCELLED:"Cancelado"};
const menu = [
  {label:"Início",href:"#inicio",icon:LayoutDashboard},
  {label:"Pedidos",href:"#pedidos-signa",icon:ShoppingCart},
  {label:"Pagamentos",href:"#pagamentos-signa",icon:CreditCard},
  {label:"Clientes",href:"#clientes-signa",icon:Users},
  {label:"Relatórios",href:"#relatorios-signa",icon:BarChart3},
  {label:"Mapa",href:"#mapa-signa",icon:MapPinned},
  {label:"Catálogo",href:"#catalogo-signa",icon:Package},
];
type OrderTimelineEvent = {id:string;orderId:string;title:string;detail:string;occurredAt:string};
export function SignaEnterpriseDashboard({orders,partnerName,events=[]}:{orders:SignaOrderSummary[];partnerName:string;events?:OrderTimelineEvent[]}) {
  const [search,setSearch] = useState("");
  const [filter,setFilter] = useState("Todos");
  const [menuOpen,setMenuOpen] = useState(false);
  const [activeSection,setActiveSection] = useState("inicio");
  const [hello,setHello] = useState("Olá");
  const isSigna = partnerName.trim().toLowerCase() === "signa coffee";
  useEffect(()=>setHello(greeting()),[]);
  // Highlights the section in view (SAP Fiori / Microsoft 365 style navigation).
  useEffect(()=>{
    const ids=menu.map(item=>item.href.slice(1));
    const observer=new IntersectionObserver(entries=>{
      const visible=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top);
      if(visible[0])setActiveSection(visible[0].target.id);
    },{rootMargin:"-20% 0px -65% 0px"});
    const observe=()=>ids.forEach(id=>{const element=document.getElementById(id);if(element)observer.observe(element);});
    observe();
    const retry=window.setTimeout(observe,1500);
    return ()=>{window.clearTimeout(retry);observer.disconnect();};
  },[]);
  const [expandedOrder,setExpandedOrder] = useState<string | null>(null);
  const [showAllOrders,setShowAllOrders] = useState(false);
  useEffect(()=>{if(expandedOrder)document.getElementById("signa-order-timeline")?.scrollIntoView({behavior:"smooth",block:"start"});},[expandedOrder]);
  const timelineEvents = useMemo(()=>getSignaOrderTimelineEvents(events,expandedOrder),[events,expandedOrder]);
  const filtered = useMemo(()=>orders.filter(o=>{
    const text = (o.code+" "+o.customerName).toLocaleLowerCase("pt-BR");
    const matches = !search || text.includes(search.toLocaleLowerCase("pt-BR"));
    return matches && (filter==="Todos" || (filter==="Em produção" ? o.status==="IN_PRODUCTION" : filter==="Faturado" ? o.status==="INVOICED" : filter==="Concluído" ? o.status==="DELIVERED" : !["INVOICED","DELIVERED","CANCELLED"].includes(o.status)));
  }),[orders,search,filter]);
  const visibleOrders = showAllOrders||search ? filtered : filtered.slice(0,8);
  const activeOrders = useMemo(()=>orders.filter(o=>!["DELIVERED","CANCELLED"].includes(o.status)),[orders]);
  const receivableOrders = useMemo(()=>orders.filter(o=>Boolean(o.receivableStatus)),[orders]);
  const orderProgress: Record<string,number> = {DRAFT:1,CONFIRMED:2,RESERVED:2,IN_PRODUCTION:3,PICKING:4,READY_TO_SHIP:4,INVOICED:5,SHIPPED:5,DELIVERED:6};
  const sum=orders.reduce((s,o)=>s+Number(o.totalAmount||0),0);
  const invoiced = orders.filter(o=>o.invoiceStatus==="AUTHORIZED").reduce((s,o)=>s+Number(o.totalAmount||0),0);
  return (
    <section id="inicio" className="relative scroll-mt-24 space-y-5 [&_h1]:font-display [&_h2]:font-display [&_h3]:font-display [&_h4]:font-display" aria-label="Painel comercial">
      <button type="button" onClick={()=>setMenuOpen(v=>!v)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold lg:hidden" aria-expanded={menuOpen} aria-controls="signa-portal-nav">Menu do portal</button>
      <aside id="signa-portal-nav" className={`${menuOpen?"block":"hidden"} rounded-xl border border-[#e6e6e1] bg-white p-4 text-[#0A0A0A] lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block lg:w-52 lg:rounded-none lg:border-y-0 lg:border-l-0 lg:px-3 lg:pt-24`}>
        <p className="mb-4 border-b border-[#ececE7] px-3 pb-4 text-[11px] font-semibold uppercase tracking-[.16em] text-[#8a8a84]">Portal do parceiro</p>
        <nav aria-label="Seções do portal" className="space-y-0.5">
          {menu.map(({label,href,icon:Icon})=>{
            const current=activeSection===href.slice(1);
            return <a key={label} href={href} aria-current={current?"location":undefined} onClick={()=>setMenuOpen(false)} className={`relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0A0A0A] ${current?"bg-[#f4f4f1] font-semibold text-[#0A0A0A] before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-[#0A0A0A]":"font-medium text-[#55554f] hover:bg-[#f7f7f4] hover:text-[#0A0A0A]"}`}><Icon size={17} aria-hidden className={current?"text-[#0A0A0A]":"text-[#8a8a84]"}/>{label}</a>;
          })}
        </nav>
        <p className="mt-8 border-t border-[#ececE7] px-3 pt-4 text-xs text-[#8a8a84]">{partnerName} · Bispo Coffees</p>
      </aside>
      <header className="relative overflow-hidden rounded-2xl border border-[#e6e6e1] bg-white shadow-sm">
        <BispoSeal className="pointer-events-none absolute -right-8 -top-10 hidden size-52 text-[#0A0A0A]/[.05] sm:block" />
        <div className="relative flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-8 sm:py-7">
          <div className="flex min-w-0 items-center gap-5">
            {isSigna
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src="/brand/partners/signa-coffee-mark.svg" alt="" aria-hidden="true" className="hidden size-14 shrink-0 sm:block" />
              : <BispoSeal className="hidden size-14 shrink-0 text-[#0A0A0A] sm:block" />}
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[#6b6b66]">{hello} · Bispo Coffees</p>
              <h1 className="sr-only mt-1 truncate text-3xl font-semibold tracking-tight text-[#0A0A0A] sm:not-sr-only sm:block">{partnerName}</h1>
              <p className="mt-1 max-w-2xl text-sm text-[#55554f] sm:mt-2">Pedidos, produção, pagamentos e resultados em um só lugar.</p>
            </div>
          </div>
          <button type="button" onClick={()=>window.dispatchEvent(new Event("bbos:partner-order:new"))} className="hidden min-h-12 items-center gap-2 rounded-xl bg-[#0A0A0A] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#262626] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A0A0A] sm:inline-flex"><Plus size={16} aria-hidden/> Novo pedido</button>
        </div>
      </header>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5" aria-label="Indicadores de pedidos">
        {[
          ["Pedidos",String(orders.length),"Histórico completo"],
          ["Volume comprado",`${orders.reduce((s,o)=>s+Number(o.volumeKg||0),0).toLocaleString("pt-BR",{maximumFractionDigits:1})} kg`,"Peso dos pedidos"],
          ["Valor dos pedidos",currency.format(sum),"Pedidos registrados"],
          ["NF autorizada",currency.format(invoiced),"Pedidos com NF autorizada"],
          ["Concluídos",String(orders.filter(o=>o.status==="DELIVERED").length),"Pedidos entregues"]
        ].map(([label,value,detail])=><article key={label} className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm sm:px-4 sm:py-3">
          <p className="text-[11px] font-semibold text-slate-600">{label}</p>
          <p className="mt-1 truncate font-display text-xl font-semibold tracking-tight text-[#0A0A0A]" title={value}>{value}</p>
          <p className="mt-1 text-[10px] text-slate-500">{detail}</p>
        </article>)}
      </div>
      <section id="pedidos-em-andamento" aria-label="Pedidos em andamento" className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
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
      <section id="pedidos-signa" className="scroll-mt-24 rounded-lg border border-slate-200 bg-white shadow-sm" aria-label="Tabela de pedidos">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
          <div><h3 className="text-lg font-semibold text-[#0E191D]">Meus pedidos</h3><p className="text-xs text-slate-500">Acompanhamento operacional e financeiro</p></div>
          <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2"><Search size={16}/><span className="sr-only">Buscar pedido</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar pedido ou cliente" className="w-48 bg-transparent text-sm outline-none"/></label>
        </div>
        <div className="flex gap-2 overflow-x-auto px-5 py-3">{["Todos","Em análise","Em produção","Faturado","Concluído"].map(label=><button key={label} type="button" onClick={()=>setFilter(label)} aria-pressed={filter===label} className={`shrink-0 rounded-md px-3 py-2 text-xs font-semibold ${filter===label?"bg-[#0E191D] text-white":"border border-slate-200 text-slate-600"}`}>{label}</button>)}</div>
        <div className="divide-y divide-slate-100 md:hidden">
          {visibleOrders.map(o=><article key={o.id} className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-[#0E191D]">{o.code}</p><p className="mt-1 text-xs text-slate-500">{new Date(o.orderedAt).toLocaleDateString("pt-BR")}</p></div><span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium">{stages[o.status]||o.status}</span></div>
            <div className="text-xs text-slate-600">Pagamento: <strong>{o.receivableStatus==="PAID"?"Pago":o.receivableStatus==="PARTIALLY_PAID"?"Parcialmente pago":o.receivableStatus==="OVERDUE"?"Vencido":o.receivableStatus==="OPEN"?"Pendente":"Aguardando faturamento"}</strong>{o.receivableStatus==="PAID"&&o.paymentDate?` · ${new Date(o.paymentDate).toLocaleDateString("pt-BR")}`:""}</div><div><p className="text-xs text-slate-500">Faturar para</p><p className="text-sm font-medium">{o.billingRecipientName||o.customerName}</p><p className="mt-1 text-xs text-slate-500">Cliente atendido: {o.endCustomerName||"Não informado"} · {Number(o.volumeKg||0).toLocaleString("pt-BR",{maximumFractionDigits:2})} kg</p></div>
            <div className="flex items-center justify-between gap-2"><strong className="text-base text-[#0E191D]">{currency.format(Number(o.totalAmount))}</strong>{o.invoiceStatus==="AUTHORIZED"&&o.invoicePdfAvailable?<a href={`/api/partner-portal/orders/${o.id}/invoice/pdf`} target="_blank" rel="noreferrer" className="rounded-lg bg-[#0E191D] px-3 py-2 text-xs font-semibold text-white">Ver nota fiscal</a>:o.billingAvailable?<a href={`/api/partner-portal/orders/${o.id}/billing/pdf`} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold">Ver cobrança</a>:<span className="text-xs text-slate-500">Documentos pendentes</span>}</div>
          </article>)}
          {!filtered.length&&<p className="p-5 text-center text-sm text-slate-500">Nenhum pedido encontrado.</p>}
        </div>
        <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[900px] text-left text-xs"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{["Pedido","Data","Faturar para","Cliente (registro)","Volume (kg)","Valor","Situação","Pagamento","Pago em","Documentos"].map(x=><th key={x} scope="col" className={`px-5 py-3 font-semibold ${x==="Pedido"?"sticky left-0 z-20 min-w-[145px] bg-slate-50 shadow-[2px_0_4px_-3px_#64748b]":""}`}>{x}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{visibleOrders.map(o=><tr key={o.id} className="hover:bg-slate-50"><td className="sticky left-0 z-10 min-w-[145px] bg-white px-3 py-3 font-semibold shadow-[2px_0_4px_-3px_#64748b]"><button type="button" aria-expanded={expandedOrder===o.id} aria-controls="signa-order-timeline" aria-label={`Ver detalhes do pedido ${o.code}`} onClick={()=>setExpandedOrder(value=>value===o.id?null:o.id)} className="flex flex-col items-start gap-1 text-left font-semibold text-[#0E191D] hover:text-[#25734c] focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25734c]"><span className="underline decoration-slate-400 underline-offset-4">{o.code}</span><span className="text-[11px] font-medium underline underline-offset-2">Ver detalhes</span></button></td><td className="px-3 py-3">{new Date(o.orderedAt).toLocaleDateString("pt-BR")}</td><td className="px-5 py-4">{o.billingRecipientName||o.customerName}</td><td className="px-5 py-4">{o.endCustomerName||"Não informado"}</td><td className="px-5 py-4">{Number(o.volumeKg||0).toLocaleString("pt-BR",{maximumFractionDigits:2})}</td><td className="px-5 py-4">{currency.format(Number(o.totalAmount))}</td><td className="px-5 py-4"><span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium">{stages[o.status]||o.status}</span></td><td className="px-5 py-4"><span className={`rounded-md px-2 py-1 text-xs font-semibold ${o.receivableStatus==="PAID"?"bg-emerald-100 text-emerald-800":o.receivableStatus==="PARTIALLY_PAID"?"bg-amber-100 text-amber-800":"bg-slate-100 text-slate-700"}`}>{o.receivableStatus==="PAID"?"Pago":o.receivableStatus==="PARTIALLY_PAID"?"Parcialmente pago":o.receivableStatus==="OVERDUE"?"Vencido":o.receivableStatus==="OPEN"?"Pendente":"Aguardando faturamento"}</span></td><td className="px-5 py-4">{o.receivableStatus==="PAID"&&o.paymentDate?new Date(o.paymentDate).toLocaleDateString("pt-BR"):"—"}</td><td className="px-5 py-4">{o.invoiceStatus==="AUTHORIZED"&&o.invoicePdfAvailable?<a className="font-semibold text-emerald-800 underline" href={`/api/partner-portal/orders/${o.id}/invoice/pdf`} target="_blank" rel="noreferrer">Ver NF</a>:o.billingAvailable?<a className="font-semibold text-emerald-800 underline" href={`/api/partner-portal/orders/${o.id}/billing/pdf`} target="_blank" rel="noreferrer">Ver cobrança</a>:<span className="text-xs text-slate-500">Aguardando</span>}</td></tr>)}</tbody></table>{!filtered.length&&<p className="p-6 text-center text-sm text-slate-500">Nenhum pedido encontrado.</p>}</div>
        {filtered.length>visibleOrders.length&&<div className="border-t border-slate-100 p-3 text-center"><button type="button" onClick={()=>setShowAllOrders(true)} className="min-h-11 rounded-lg px-4 text-sm font-semibold text-[#0A0A0A] underline underline-offset-4 hover:bg-slate-50">Ver todos os {filtered.length} pedidos</button></div>}
      </section>
      {expandedOrder&&<section id="signa-order-timeline" className="scroll-mt-28 rounded-xl border border-[#b4c6c1] bg-white p-5" aria-label="Linha do tempo do pedido">
        <div className="flex items-center justify-between gap-3"><h3 className="text-base font-semibold text-[#0E191D]">Linha do tempo · {orders.find(o=>o.id===expandedOrder)?.code}</h3><button type="button" onClick={()=>setExpandedOrder(null)} className="text-sm font-semibold underline">Fechar</button></div>
        <p className="mt-1 text-xs text-slate-500">Datas e horários registrados pelo BBOS; etapas sem registro não são estimadas.</p>
        <ol className="mt-4 space-y-3 border-l-2 border-[#25734c] pl-5">
          <li className="relative text-sm"><span className="font-semibold">Pedido registrado</span><time className="ml-2 text-slate-600">{orders.find(o=>o.id===expandedOrder)?.orderedAt?new Date(orders.find(o=>o.id===expandedOrder)!.orderedAt).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"}):"Data indisponível"}</time></li>
          {timelineEvents.map(e=><li key={e.id} className="text-sm"><span className="font-semibold">{e.title}</span><time className="ml-2 text-slate-600">{new Date(e.occurredAt).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"})}</time><p className="text-xs text-slate-500">{e.detail}</p></li>)}
          {!timelineEvents.length&&<li className="text-sm text-slate-500">Sem eventos adicionais registrados para este pedido.</li>}
        </ol>
      </section>}
      <section id="pagamentos-signa" aria-label="Pagamentos vinculados aos pedidos" className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-[#0E191D]">Pagamentos</h3>
          <p className="mt-1 text-xs text-slate-600">Consulta dos títulos do Contas a Receber já vinculados aos seus pedidos no BBOS. Títulos em aberto podem ser pagos com um clique pelo Pix da Bispo Coffees. A confirmação do recebimento continua com o financeiro da Bispo; o parceiro não dá baixa em pagamentos.</p>
        </div>
        {receivableOrders.length===0 ? <p role="status" className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Nenhum título financeiro vinculado aos pedidos disponíveis. Isso não significa que algum pagamento tenha sido realizado.</p> :
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {receivableOrders.map(o=><article key={o.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="text-sm text-[#0E191D]">{o.code}</strong>
              <span className={`rounded-md px-2 py-1 text-xs font-semibold ${o.receivableStatus==="PAID"?"bg-emerald-100 text-emerald-800":o.receivableStatus==="OVERDUE"?"bg-red-100 text-red-800":o.receivableStatus==="PARTIALLY_PAID"?"bg-amber-100 text-amber-800":"bg-slate-200 text-slate-700"}`}>{o.receivableStatus==="PAID"?"Pago":o.receivableStatus==="PARTIALLY_PAID"?"Parcialmente pago":o.receivableStatus==="OVERDUE"?"Vencido":o.receivableStatus==="OPEN"?"Em aberto":"A conferir"}</span>
            </div>
            <p className="mt-1 truncate text-xs text-slate-600" title={o.billingRecipientName||o.customerName}>{o.billingRecipientName||o.customerName}</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div><dt className="text-slate-500">Valor do título</dt><dd className="mt-1 font-semibold tabular-nums">{o.receivableAmount!=null?currency.format(Number(o.receivableAmount)):"—"}</dd></div>
              <div><dt className="text-slate-500">Saldo em aberto</dt><dd className="mt-1 font-semibold tabular-nums">{o.openAmount!=null?currency.format(Number(o.openAmount)):"—"}</dd></div>
              <div><dt className="text-slate-500">Vencimento</dt><dd className="mt-1 font-medium">{o.dueDate?new Date(o.dueDate).toLocaleDateString("pt-BR",{timeZone:"UTC"}):"—"}</dd></div>
              <div><dt className="text-slate-500">Pago em</dt><dd className="mt-1 font-medium">{o.receivableStatus==="PAID"&&o.paymentDate?new Date(o.paymentDate).toLocaleDateString("pt-BR",{timeZone:"UTC"}):"—"}</dd></div>
            </dl>
            {o.billingAvailable&&<a href={`/api/partner-portal/orders/${o.id}/billing/pdf`} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-semibold text-[#0E191D] underline underline-offset-2">Consultar cobrança</a>}
            {o.pixAvailable&&<SignaPixButton orderId={o.id} orderCode={o.code}/>}
          </article>)}
        </div>}
        <p className="mt-3 text-xs text-slate-500">Visão dos títulos mais recentes associados aos pedidos desta consulta; não substitui extrato bancário ou conciliação do financeiro da Bispo.</p>
      </section>
      <SignaCustomerHistory/>
      <SignaReports/>
    </section>
  );
}
