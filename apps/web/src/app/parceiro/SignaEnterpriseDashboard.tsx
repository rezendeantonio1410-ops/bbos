"use client";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, CreditCard, LayoutDashboard, MapPinned, Package, Plus, Search, ShoppingCart, Users } from "lucide-react";
import { brazilianCepDigits, formatBrazilianCep } from "@/lib/brazil-address";
import { SignaPurchasesMap } from "@/components/signa-purchases-map";
import { signaStatePurchases } from "@/lib/signa-region-map";
import { BispoSeal } from "@/components/bispo-seal";
import { SignaPixButton } from "@/components/signa-pix-dialog";
import { SignaShellBar } from "@/components/signa-shell-bar";
import { SignaOrderPanel, paymentLabel } from "@/components/signa-order-panel";
import { PortalToaster, showToast } from "@/components/portal-toast";
import { useCnpjRegistryAutofill } from "@/lib/use-cnpj-registry-autofill";
import { applyCnpjRecord } from "@/lib/cnpj-registry";
import { CnpjRegistryPanel, CnpjSearchButton } from "@/components/cnpj-registry-panel";
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
  // Complete CNPJ → Receita Federal lookup (free). Fills every empty field;
  // "Buscar na Receita" refills all. Everything stays editable.
  const cnpjLookup = useCnpjRegistryAutofill({
    cnpj: form.taxId,
    enabled: expanded,
    onResolved: (record, context) => {
      setForm(previous => applyCnpjRecord(previous as unknown as Record<string,string>, record, {
        name: "legalName", postalCode: "postalCode", street: "street", number: "number",
        district: "district", complement: "complement", city: "city", state: "state",
        stateRegistration: r => r.suggestedStateRegistration ?? null,
      }, context) as unknown as SignaEndCustomerForm);
      const take = (current: string, value: string | null, before: string | null | undefined) =>
        value && (context.overwrite || !current.trim() || current === before) ? value : current;
      setPhone(current => take(current, record.phone, context.previous?.phone));
      setEmail(current => take(current, record.email, context.previous?.email));
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
      setExpanded(false);setNotice("Cliente comercial cadastrado com sucesso.");showToast("Cliente cadastrado.");setRefresh(value=>value+1);
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
        <label className="text-xs font-semibold sm:col-span-6">CNPJ *<span className="mt-1 flex gap-2"><input required inputMode="numeric" placeholder="00.000.000/0000-00" value={formatCnpj(form.taxId)} onChange={e=>setField("taxId",e.target.value.replace(/\D/g,"").slice(0,14))} className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal"/><CnpjSearchButton onClick={cnpjLookup.search} busy={cnpjLookup.busy}/></span></label>
        <label className="text-xs font-semibold sm:col-span-3">CEP *<input required inputMode="numeric" placeholder="00000-000" value={formatBrazilianCep(form.postalCode)} onChange={e=>setField("postalCode",brazilianCepDigits(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal"/></label>
        {cnpjLookup.statusText&&<p role="status" className={`text-xs sm:col-span-6 ${cnpjLookup.warning?"font-semibold text-amber-800":"text-slate-600"}`}>{cnpjLookup.statusText}</p>}
        {cnpjLookup.record&&<div className="sm:col-span-6"><CnpjRegistryPanel record={cnpjLookup.record}/></div>}
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
type SortKey = "code"|"orderedAt"|"endCustomerName"|"totalAmount"|"status";
const PIPELINE = [
  {label:"Em análise",match:(s:string)=>s==="DRAFT"},
  {label:"Em produção",match:(s:string)=>["CONFIRMED","RESERVED","IN_PRODUCTION","PICKING","READY_TO_SHIP"].includes(s)},
  {label:"Faturado",match:(s:string)=>["INVOICED","SHIPPED"].includes(s)},
  {label:"Concluído",match:(s:string)=>s==="DELIVERED"},
] as const;
type OrderTimelineEvent = {id:string;orderId:string;title:string;detail:string;occurredAt:string};
export function SignaEnterpriseDashboard({orders,partnerName,events=[],onLogout}:{orders:SignaOrderSummary[];partnerName:string;events?:OrderTimelineEvent[];onLogout:()=>void}) {
  const [search,setSearch] = useState("");
  const [filter,setFilter] = useState("Todos");
  const [menuOpen,setMenuOpen] = useState(false);
  const [openOrderId,setOpenOrderId] = useState<string | null>(null);
  const [showAllOrders,setShowAllOrders] = useState(false);
  const [sort,setSort] = useState<{key:SortKey;dir:"asc"|"desc"}>({key:"orderedAt",dir:"desc"});
  const [activeSection,setActiveSection] = useState("inicio");
  const [hello,setHello] = useState("Olá");
  const isSigna = partnerName.trim().toLowerCase() === "signa coffee";
  useEffect(()=>setHello(greeting()),[]);
  // Returning to "#inicio" (back navigation, reload) must show the page top,
  // not a position where the header is cut behind the fixed bar.
  useEffect(()=>{
    const toTop=()=>{if(window.location.hash===""||window.location.hash==="#inicio")window.scrollTo({top:0});};
    toTop();
    window.addEventListener("pageshow",toTop);
    return ()=>window.removeEventListener("pageshow",toTop);
  },[]);
  // Highlights the section in view (SAP Fiori / Microsoft 365 style navigation).
  // "#inicio" wraps the whole page and "#mapa-signa" sits inside the reports, so
  // the active item is the last section whose top has passed the fixed bar.
  useEffect(()=>{
    const ids=menu.map(item=>item.href.slice(1)).filter(id=>id!=="inicio");
    let frame=0;
    let lockUntil=0;
    const update=()=>{
      frame=0;
      if(Date.now()<lockUntil)return;
      const line=140;
      const atBottom=window.innerHeight+window.scrollY>=document.documentElement.scrollHeight-4;
      const tops=ids.map(id=>[id,document.getElementById(id)?.getBoundingClientRect().top] as const)
        .filter((entry):entry is readonly [string,number]=>typeof entry[1]==="number")
        .sort((a,b)=>a[1]-b[1]);
      const passed=tops.filter(([,top])=>top<=line);
      const last=tops[tops.length-1];
      setActiveSection(atBottom&&last&&last[1]<window.innerHeight?last[0]:passed.length?passed[passed.length-1]![0]:"inicio");
    };
    const onScroll=()=>{
      // While a menu click is scrolling, keep the clicked item; release once scrolling settles.
      if(Date.now()<lockUntil){lockUntil=Date.now()+180;return;}
      if(!frame)frame=window.requestAnimationFrame(update);
    };
    const onHash=()=>{const id=window.location.hash.slice(1);if(menu.some(item=>item.href==="#"+id)){setActiveSection(id);lockUntil=Date.now()+700;}};
    window.addEventListener("hashchange",onHash);
    update();
    window.addEventListener("scroll",onScroll,{passive:true});
    window.addEventListener("resize",onScroll);
    const retry=window.setTimeout(update,1500);
    return ()=>{window.clearTimeout(retry);if(frame)window.cancelAnimationFrame(frame);window.removeEventListener("scroll",onScroll);window.removeEventListener("resize",onScroll);window.removeEventListener("hashchange",onHash);};
  },[]);
  const filtered = useMemo(()=>{
    const term=search.toLocaleLowerCase("pt-BR");
    const stage=PIPELINE.find(item=>item.label===filter);
    const list=orders.filter(o=>{
      const text=(o.code+" "+o.customerName+" "+(o.endCustomerName??"")).toLocaleLowerCase("pt-BR");
      return (!term||text.includes(term)) && (!stage||stage.match(o.status));
    });
    const value=(o:SignaOrderSummary)=>sort.key==="totalAmount"?Number(o.totalAmount||0):sort.key==="status"?(stages[o.status]||o.status):String(o[sort.key]??"");
    return [...list].sort((a,b)=>{const x=value(a),y=value(b);const r=typeof x==="number"&&typeof y==="number"?x-y:String(x).localeCompare(String(y),"pt-BR");return sort.dir==="asc"?r:-r;});
  },[orders,search,filter,sort]);
  const visibleOrders = showAllOrders||search ? filtered : filtered.slice(0,10);
  const receivableOrders = useMemo(()=>orders.filter(o=>Boolean(o.receivableStatus)),[orders]);
  const openOrder = orders.find(o=>o.id===openOrderId) ?? null;
  const orderEvents = useMemo(()=>getSignaOrderTimelineEvents(events,openOrderId),[events,openOrderId]);
  const sum=orders.reduce((s,o)=>s+Number(o.totalAmount||0),0);
  const invoiced = orders.filter(o=>o.invoiceStatus==="AUTHORIZED").reduce((s,o)=>s+Number(o.totalAmount||0),0);
  const openBalance = receivableOrders.filter(o=>["OPEN","PARTIALLY_PAID","OVERDUE"].includes(o.receivableStatus??"")).reduce((s,o)=>s+Number(o.openAmount||0),0);
  const sortBy=(key:SortKey)=>setSort(current=>current.key===key?{key,dir:current.dir==="asc"?"desc":"asc"}:{key,dir:key==="orderedAt"||key==="totalAmount"?"desc":"asc"});
  const ariaSort=(key:SortKey)=>sort.key===key?(sort.dir==="asc"?"ascending":"descending"):"none";
  // A column that is empty on every row only adds noise; it comes back as soon as one order has it.
  const hasEndCustomer = orders.some(o=>Boolean(o.endCustomerName));
  const columns:Array<[string,SortKey|null]>=[["Pedido","code"],["Data","orderedAt"],...(hasEndCustomer?[["Cliente atendido","endCustomerName"] as [string,SortKey]]:[]),["Faturar para",null],["Valor","totalAmount"],["Situação","status"],["Pagamento",null]];
  const openReceivables = receivableOrders.filter(o=>o.receivableStatus!=="PAID");
  const paidReceivables = receivableOrders.filter(o=>o.receivableStatus==="PAID");
  return (
    <section id="inicio" className="relative scroll-mt-20 space-y-5 [&_h1]:font-display [&_h2]:font-display [&_h3]:font-display [&_h4]:font-display" aria-label="Painel comercial">
      <SignaShellBar partnerName={partnerName} orders={orders} events={events} stages={stages} onOpenOrder={setOpenOrderId} onLogout={onLogout} onToggleMenu={()=>setMenuOpen(v=>!v)} menuOpen={menuOpen}/>
      <PortalToaster/>
      <aside id="signa-portal-nav" className={`${menuOpen?"block":"hidden"} fixed inset-x-3 top-16 z-40 rounded-xl border border-[#e6e6e1] bg-white p-3 text-[#0A0A0A] shadow-xl lg:inset-x-auto lg:shadow-none lg:fixed lg:bottom-0 lg:left-0 lg:top-14 lg:z-30 lg:block lg:w-52 lg:rounded-none lg:border-y-0 lg:border-l-0 lg:pt-5`}>
        <nav aria-label="Seções do portal" className="space-y-0.5">
          {menu.map(({label,href,icon:Icon})=>{
            const current=activeSection===href.slice(1);
            return <a key={label} href={href} aria-current={current?"location":undefined} onClick={()=>setMenuOpen(false)} className={`relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0A0A0A] ${current?"bg-[#f4f4f1] font-semibold text-[#0A0A0A] before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-[#0A0A0A]":"font-medium text-[#55554f] hover:bg-[#f7f7f4] hover:text-[#0A0A0A]"}`}><Icon size={17} aria-hidden className={current?"text-[#0A0A0A]":"text-[#8a8a84]"}/>{label}</a>;
          })}
        </nav>
        <div className="mt-6 border-t border-[#ececE7] px-3 pt-4">
          {isSigna
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src="/brand/partners/signa-coffee-logo.svg" alt="Signa Coffee" className="h-7 w-auto"/>
            : <p className="text-sm font-semibold">{partnerName}</p>}
          <p className="mt-1 text-[11px] text-[#8a8a84]">Parceiro Bispo Coffees</p>
        </div>
      </aside>

      <div className="flex flex-wrap items-end justify-between gap-3 pt-1">
        <div className="flex min-w-0 items-center gap-3">
          {isSigna
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src="/brand/partners/signa-coffee-mark.svg" alt="" aria-hidden="true" className="size-11 shrink-0"/>
            : <BispoSeal className="size-11 shrink-0 text-[#0A0A0A]"/>}
          <div className="min-w-0">
            <p className="text-xs text-[#6b6b66]">{hello}! Este é o seu painel de pedidos.</p>
            <h1 className="truncate text-2xl font-semibold tracking-tight text-[#0A0A0A]">{partnerName}</h1>
          </div>
        </div>
        <button type="button" onClick={()=>window.dispatchEvent(new Event("bbos:partner-order:new"))} className="hidden min-h-11 items-center gap-2 rounded-lg bg-[#0A0A0A] px-4 text-sm font-semibold text-white transition hover:bg-[#262626] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A0A0A] sm:inline-flex"><Plus size={16} aria-hidden/> Novo pedido</button>
      </div>

      <dl aria-label="Indicadores" className="grid grid-cols-2 overflow-hidden [&>div:last-child]:col-span-2 sm:[&>div:last-child]:col-span-1 rounded-xl border border-[#e6e6e1] bg-white sm:grid-cols-5 sm:divide-x sm:divide-[#ececE7]">
        {[
          ["Pedidos",String(orders.length)],
          ["Volume",`${orders.reduce((s,o)=>s+Number(o.volumeKg||0),0).toLocaleString("pt-BR",{maximumFractionDigits:1})} kg`],
          ["Valor dos pedidos",currency.format(sum)],
          ["Com NF autorizada",currency.format(invoiced)],
          ["Saldo a pagar",currency.format(openBalance)],
        ].map(([label,value])=><div key={label} className="min-w-0 border-b border-[#ececE7] px-4 py-3 sm:border-b-0">
          <dt className="text-[11px] font-medium text-[#6b6b66]">{label}</dt>
          <dd className="mt-0.5 truncate font-display text-lg font-semibold tracking-tight text-[#0A0A0A]" title={value}>{value}</dd>
        </div>)}
      </dl>

      <section id="pedidos-signa" className="scroll-mt-20 overflow-hidden rounded-xl border border-[#e6e6e1] bg-white" aria-labelledby="pedidos-title">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-5">
          <h2 id="pedidos-title" className="text-lg font-semibold text-[#0A0A0A]">Pedidos</h2>
          <label className="flex h-10 items-center gap-2 rounded-lg border border-[#e2e2dd] px-3"><Search size={16} aria-hidden className="text-[#8a8a84]"/><span className="sr-only">Filtrar pedidos</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Filtrar por pedido ou cliente" className="w-48 bg-transparent text-sm outline-none sm:w-64"/></label>
        </div>
        <div role="group" aria-label="Etapas dos pedidos" className="mt-3 flex gap-1 overflow-x-auto px-4 pb-3 sm:px-5" id="pedidos-em-andamento">
          {[{label:"Todos",count:orders.length},...PIPELINE.map(stage=>({label:stage.label,count:orders.filter(o=>stage.match(o.status)).length}))].map(item=>
            <button key={item.label} type="button" aria-pressed={filter===item.label} onClick={()=>{setFilter(item.label);setShowAllOrders(false);}}
              className={`flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm transition ${filter===item.label?"bg-[#0A0A0A] font-semibold text-white":"text-[#3d3d39] hover:bg-[#f4f4f1]"}`}>
              {item.label}<span className={`rounded-md px-1.5 text-xs tabular-nums ${filter===item.label?"bg-white/20":"bg-[#f1f1ee] text-[#55554f]"}`}>{item.count}</span>
            </button>)}
        </div>
        <ul className="divide-y divide-[#f1f1ee] border-t border-[#ececE7] md:hidden">
          {visibleOrders.map(o=><li key={o.id}>
            <button type="button" onClick={()=>setOpenOrderId(o.id)} className="grid w-full grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 px-4 py-3 text-left">
              <span className="font-semibold">{o.code}</span><span className="tabular-nums font-semibold">{currency.format(Number(o.totalAmount))}</span>
              <span className="truncate text-xs text-[#6b6b66]">{o.endCustomerName||o.billingRecipientName||o.customerName} · {new Date(o.orderedAt).toLocaleDateString("pt-BR")}</span><span className="text-xs text-[#55554f]">{stages[o.status]||o.status}</span>
            </button>
          </li>)}
        </ul>
        <div className="hidden max-h-[34rem] overflow-auto border-t border-[#ececE7] md:block">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-[#fafaf8] text-xs text-[#6b6b66] shadow-[0_1px_0_#ececE7]">
              <tr>{columns.map(([label,key])=><th key={label} scope="col" aria-sort={key?ariaSort(key):undefined} className="px-4 py-2.5 font-medium">
                {key?<button type="button" onClick={()=>sortBy(key)} className="inline-flex items-center gap-1 rounded hover:text-[#0A0A0A]">{label}<span aria-hidden className="text-[10px]">{sort.key===key?(sort.dir==="asc"?"▲":"▼"):"↕"}</span></button>:label}
              </th>)}</tr>
            </thead>
            <tbody className="divide-y divide-[#f1f1ee]">
              {visibleOrders.map(o=><tr key={o.id} onClick={()=>setOpenOrderId(o.id)} className="cursor-pointer hover:bg-[#fafaf8]">
                <td className="px-4 py-2.5"><button type="button" onClick={e=>{e.stopPropagation();setOpenOrderId(o.id);}} className="font-semibold text-[#0A0A0A] underline decoration-[#cfcfca] underline-offset-4 hover:decoration-[#0A0A0A]">{o.code}</button></td>
                <td className="px-4 py-2.5 tabular-nums text-[#3d3d39]">{new Date(o.orderedAt).toLocaleDateString("pt-BR")}</td>
                {hasEndCustomer&&<td className="px-4 py-2.5">{o.endCustomerName||<span className="text-[#8a8a84]">Não informado</span>}</td>}
                <td className="px-4 py-2.5 text-[#3d3d39]">{o.billingRecipientName||o.customerName}</td>
                <td className="px-4 py-2.5 tabular-nums font-medium">{currency.format(Number(o.totalAmount))}</td>
                <td className="px-4 py-2.5"><StatusDot status={o.status}/>{stages[o.status]||o.status}</td>
                <td className="px-4 py-2.5 text-[#3d3d39]">{paymentLabel(o.receivableStatus)}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
        {!filtered.length&&<p className="border-t border-[#ececE7] p-6 text-center text-sm text-[#6b6b66]">Nenhum pedido nesta etapa. <button type="button" className="font-semibold underline" onClick={()=>{setFilter("Todos");setSearch("");}}>Ver todos</button></p>}
        {filtered.length>visibleOrders.length&&<div className="border-t border-[#ececE7] p-2 text-center"><button type="button" onClick={()=>setShowAllOrders(true)} className="min-h-10 rounded-lg px-4 text-sm font-semibold text-[#0A0A0A] hover:bg-[#f4f4f1]">Ver todos os {filtered.length} pedidos</button></div>}
      </section>

      <section id="pagamentos-signa" aria-labelledby="pagamentos-title" className="scroll-mt-20 rounded-xl border border-[#e6e6e1] bg-white">
        <div className="flex flex-wrap items-end justify-between gap-2 px-4 pt-4 sm:px-5">
          <div><h2 id="pagamentos-title" className="text-lg font-semibold text-[#0A0A0A]">Pagamentos</h2>
          <p className="text-xs text-[#6b6b66]">Pague títulos em aberto com um clique pelo Pix da Bispo Coffees. A confirmação do recebimento continua com o financeiro da Bispo.</p></div>
        </div>
        {receivableOrders.length===0 ? <p role="status" className="px-5 py-5 text-sm text-[#6b6b66]">Nenhum título vinculado aos seus pedidos ainda. Isso não significa que algum pagamento tenha sido realizado.</p> :
        <>
        {openReceivables.length===0
          ? <p role="status" className="mt-3 flex items-center gap-2 border-t border-[#ececE7] px-4 py-3 text-sm text-[#1d5c3a] sm:px-5"><span aria-hidden className="size-2 rounded-full bg-[#25734c]"/>Nenhum título em aberto no momento.</p>
          : <ul aria-label="Títulos em aberto" className="mt-3 divide-y divide-[#f1f1ee] border-t border-[#ececE7]">{openReceivables.map(o=><li key={o.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-5">
            <button type="button" onClick={()=>setOpenOrderId(o.id)} className="min-w-24 text-left font-semibold underline decoration-[#cfcfca] underline-offset-4">{o.code}</button>
            <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${o.receivableStatus==="PAID"?"bg-[#e3f2e8] text-[#1d5c3a]":o.receivableStatus==="OVERDUE"?"bg-[#fbe5e1] text-[#8f2d1f]":"bg-[#f1f1ee] text-[#3d3d39]"}`}>{paymentLabel(o.receivableStatus)}</span>
            <span className="text-sm text-[#3d3d39]">Saldo <strong className="tabular-nums text-[#0A0A0A]">{o.openAmount!=null?currency.format(Number(o.openAmount)):"—"}</strong></span>
            <span className="text-sm text-[#3d3d39]">Vence {o.dueDate?new Date(o.dueDate).toLocaleDateString("pt-BR",{timeZone:"UTC"}):"—"}</span>
            {o.receivableStatus==="PAID"&&o.paymentDate&&<span className="text-sm text-[#3d3d39]">Pago em {new Date(o.paymentDate).toLocaleDateString("pt-BR",{timeZone:"UTC"})}</span>}
            <span className="ml-auto flex items-center gap-3">
              {o.billingAvailable&&<a href={`/api/partner-portal/orders/${o.id}/billing/pdf`} target="_blank" rel="noreferrer" className="text-sm font-medium underline underline-offset-4">Cobrança</a>}
              {o.pixAvailable&&<SignaPixButton orderId={o.id} orderCode={o.code}/>}
            </span>
          </li>)}</ul>}
        {paidReceivables.length>0&&<details className="group border-t border-[#ececE7]">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 text-sm font-medium text-[#3d3d39] hover:bg-[#fafaf8] sm:px-5 [&::-webkit-details-marker]:hidden"><span aria-hidden className="text-[10px] transition group-open:rotate-90">▶</span>Títulos pagos <span className="rounded-md bg-[#f1f1ee] px-1.5 text-xs tabular-nums text-[#55554f]">{paidReceivables.length}</span></summary>
          <ul aria-label="Títulos pagos" className="divide-y divide-[#f1f1ee] border-t border-[#f1f1ee]">{paidReceivables.map(o=><li key={o.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-5">
            <button type="button" onClick={()=>setOpenOrderId(o.id)} className="min-w-24 text-left font-semibold underline decoration-[#cfcfca] underline-offset-4">{o.code}</button>
            <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${o.receivableStatus==="PAID"?"bg-[#e3f2e8] text-[#1d5c3a]":o.receivableStatus==="OVERDUE"?"bg-[#fbe5e1] text-[#8f2d1f]":"bg-[#f1f1ee] text-[#3d3d39]"}`}>{paymentLabel(o.receivableStatus)}</span>
            <span className="text-sm text-[#3d3d39]">Saldo <strong className="tabular-nums text-[#0A0A0A]">{o.openAmount!=null?currency.format(Number(o.openAmount)):"—"}</strong></span>
            <span className="text-sm text-[#3d3d39]">Vence {o.dueDate?new Date(o.dueDate).toLocaleDateString("pt-BR",{timeZone:"UTC"}):"—"}</span>
            {o.receivableStatus==="PAID"&&o.paymentDate&&<span className="text-sm text-[#3d3d39]">Pago em {new Date(o.paymentDate).toLocaleDateString("pt-BR",{timeZone:"UTC"})}</span>}
            <span className="ml-auto flex items-center gap-3">
              {o.billingAvailable&&<a href={`/api/partner-portal/orders/${o.id}/billing/pdf`} target="_blank" rel="noreferrer" className="text-sm font-medium underline underline-offset-4">Cobrança</a>}
              {o.pixAvailable&&<SignaPixButton orderId={o.id} orderCode={o.code}/>}
            </span>
          </li>)}</ul>
        </details>}
        </>}
        <p className="border-t border-[#ececE7] px-5 py-2.5 text-[11px] text-[#8a8a84]">Consulta dos títulos do contas a receber da Bispo; não substitui extrato bancário ou conciliação do financeiro da Bispo.</p>
      </section>

      {openOrder&&<SignaOrderPanel order={openOrder} stageLabel={stages[openOrder.status]||openOrder.status} events={orderEvents} onClose={()=>setOpenOrderId(null)}/>}
      <SignaCustomerHistory/>
      <SignaReports/>
    </section>
  );
}
function StatusDot({status}:{status:string}){
  const tone=status==="DELIVERED"?"bg-[#25734c]":["INVOICED","SHIPPED"].includes(status)?"bg-[#4f7fb0]":status==="CANCELLED"?"bg-[#b0473a]":status==="DRAFT"?"bg-[#c8792f]":"bg-[#8a8a84]";
  return <span aria-hidden className={`mr-2 inline-block size-2 rounded-full align-middle ${tone}`}/>;
}
