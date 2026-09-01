"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Info,
  PackageCheck,
  Plus,
  Send,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  X,
} from "lucide-react";
import { Badge, Card } from "@bbos/ui";

const API = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api"}/sales-orders`;
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type StockOption = {
  productVariantId: string;
  warehouseId: string;
  warehouse: string;
  line: string;
  lineCode: string;
  product: string;
  sku: string;
  presentationGrams: number;
  physicalStock: number;
  reservedStock: number;
  availableStock: number;
};
type Customer = { id: string; name: string };
type CustomerHealth = {
  id: string;
  name: string;
  tradeName?: string | null;
  paymentTerms?: string | null;
  creditStatus: "NOT_ANALYZED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
  creditLimit: string | number;
  cashPurchaseAllowed: boolean;
  termPurchaseAllowed: boolean;
  financialHealth: {
    health: "HEALTHY" | "INFO" | "ATTENTION" | "BLOCKED";
    guidance: string;
    openReceivables: number;
    overdueAmount: number;
    overdueCount: number;
    maxDaysOverdue: number;
    availableCredit: number;
  };
};
type OrderItem = {
  id: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice?: string;
  totalAmount: string;
  productVariant?: { sku: string; netWeightGrams: number; product?: { name: string; productLine?: { name: string } } };
  reservations?: Array<{ status: string; quantity: number }>;
};
type Order = {
  id: string;
  code: string;
  orderNumber?: string;
  status: string;
  totalAmount: string;
  subtotal?: string;
  discount?: string;
  freight?: string;
  quantity: number;
  orderedAt: string;
  expectedDeliveryDate?: string;
  customer: Customer;
  items: OrderItem[];
  reservations: Array<{ id: string; status: string; quantity: number }>;
};

const statusLabel: Record<string, string> = {
  DRAFT: "Rascunho", CONFIRMED: "Confirmado", RESERVED: "Reservado", PICKING: "Separação",
  READY_TO_SHIP: "Pronto para expedição", INVOICED: "Faturado", SHIPPED: "Expedido",
  DELIVERED: "Entregue", CANCELLED: "Cancelado",
};
const statusTone: Record<string, "neutral" | "success" | "warning" | "danger"> = {
  DRAFT: "neutral", CONFIRMED: "warning", RESERVED: "warning", PICKING: "warning",
  READY_TO_SHIP: "success", INVOICED: "success", SHIPPED: "success", DELIVERED: "success", CANCELLED: "danger",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [variants, setVariants] = useState<StockOption[]>([]);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Order | null>(null);
  const [filter, setFilter] = useState("ALL");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const refresh = async () => {
    const [orderResponse, optionResponse] = await Promise.all([fetch(API), fetch(`${API}/options`)]);
    if (orderResponse.ok) setOrders(await orderResponse.json());
    if (optionResponse.ok) {
      const options = await optionResponse.json();
      setCustomers(options.customers);
      setVariants(options.variants);
    }
  };
  useEffect(() => { void refresh(); }, []);

  const visible = useMemo(() => filter === "ALL" ? orders : orders.filter((item) => item.status === filter), [orders, filter]);
  const open = orders.filter((item) => !["DELIVERED", "CANCELLED", "SHIPPED"].includes(item.status));
  const avgTicket = orders.length ? orders.reduce((sum, item) => sum + Number(item.totalAmount), 0) / orders.length : 0;

  const action = async (order: Order, endpoint: "confirm" | "reserve" | "cancel" | "ship" | "picking" | "ready-to-ship" | "confirm-picking" | "invoice") => {
    setBusy(order.id + endpoint); setMessage("");
    const selectedVariants = variants.filter((variant) => order.items.some((item) => item.sku === variant.sku));
    const response = await fetch(`${API}/${order.id}/${endpoint}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: (endpoint === "confirm" || endpoint === "reserve")
        ? JSON.stringify({ warehouseByVariant: Object.fromEntries(selectedVariants.map((item) => [item.productVariantId, item.warehouseId])) })
        : endpoint === "confirm-picking"
          ? JSON.stringify({ pickedByItem: Object.fromEntries(order.items.map((item) => [item.id, item.reservations?.filter((reservation) => reservation.status === "ACTIVE").reduce((sum, reservation) => sum + reservation.quantity, 0) ?? 0])) })
          : "{}",
    });
    const result = await response.json();
    setMessage(response.ok ? `${order.code} atualizado para ${statusLabel[result.status] ?? "com sucesso"}.` : (result.message?.message ?? result.message ?? "Não foi possível atualizar o pedido."));
    setBusy(""); await refresh();
  };

  return <div className="mx-auto max-w-[1600px]">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-violet-700"><Sparkles size={13}/> Comercial inteligente</p><h1 className="mt-1 text-3xl font-bold">Pedidos</h1><p className="mt-2 text-sm text-stone-500">O BBOS acompanha cliente, estoque e condições antes de a venda avançar.</p></div>
      <button onClick={() => setCreating(true)} className="flex items-center gap-2 rounded-xl bg-forest-900 px-4 py-3 text-xs font-bold text-white"><Plus size={15}/> Novo pedido</button>
    </header>
    {message && <div className="mt-5 rounded-xl border border-forest-100 bg-forest-50 p-3 text-xs font-semibold text-forest-800">{message}</div>}
    <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <Kpi label="Pedidos em aberto" value={String(open.length)}/>
      <Kpi label="Valor em carteira" value={money.format(open.reduce((sum, item) => sum + Number(item.totalAmount), 0))}/>
      <Kpi label="Pedidos reservados" value={String(orders.filter((item) => ["RESERVED", "PICKING", "READY_TO_SHIP", "INVOICED"].includes(item.status)).length)}/>
      <Kpi label="Aguardando estoque" value={String(orders.filter((item) => item.status === "CONFIRMED").length)}/>
      <Kpi label="Prontos para expedição" value={String(orders.filter((item) => ["READY_TO_SHIP", "INVOICED"].includes(item.status)).length)}/>
      <Kpi label="Ticket médio" value={money.format(avgTicket)}/>
    </section>
    <div className="mt-7 flex flex-wrap gap-2">{[["ALL","Todos"],["DRAFT","Rascunho"],["CONFIRMED","Confirmados"],["RESERVED","Reservados"],["PICKING","Separação"],["READY_TO_SHIP","Prontos"],["INVOICED","Faturados"],["SHIPPED","Expedidos"],["DELIVERED","Concluídos"]].map(([value,label]) => <button key={value} onClick={()=>setFilter(value)} className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${filter===value?"border-forest-200 bg-forest-50 text-forest-900":"border-stone-200 bg-white text-stone-500 hover:bg-stone-50"}`}>{label}</button>)}</div>
    <section className="mt-5">
      <div className="mb-3 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-forest-700">Fluxo operacional</p><h2 className="mt-1 text-lg font-semibold">Pedidos recentes</h2></div><span className="text-xs text-stone-400">{visible.length} pedidos</span></div>
      <div className="space-y-3">{visible.map((order)=><Card key={order.id} className="p-4 transition hover:shadow-md">
        <button onClick={()=>setSelected(order)} className="w-full text-left"><div className="grid gap-3 lg:grid-cols-[1.1fr_1.6fr_.75fr_auto] lg:items-center">
          <div><div className="flex items-center gap-2"><strong className="text-sm">{order.orderNumber ?? order.code}</strong><Status status={order.status}/></div><p className="mt-1 text-xs text-stone-500">{order.customer.name} · {new Date(order.orderedAt).toLocaleDateString("pt-BR")}</p></div>
          <div className="space-y-1">{order.items.length?order.items.slice(0,2).map((item)=><p key={item.id} className="truncate text-xs"><span className="font-semibold">{item.productName}</span> <span className="text-stone-400">· {item.sku} · {item.quantity} un.</span></p>):<p className="text-xs text-amber-700">Pedido legado · dados textuais preservados</p>}</div>
          <div><p className="text-xs text-stone-400">Valor</p><p className="text-sm font-bold">{money.format(Number(order.totalAmount))}</p><p className="text-[10px] text-stone-400">{order.reservations.filter((item)=>item.status==="ACTIVE").reduce((sum,item)=>sum+item.quantity,0)} reservadas</p></div><ChevronRight className="hidden text-stone-300 lg:block" size={18}/>
        </div></button>
        <div className="mt-3 flex flex-wrap gap-2 border-t border-stone-100 pt-3">
          {order.status==="DRAFT"&&<button disabled={busy!==""} onClick={()=>void action(order,"confirm")} className="rounded-lg bg-forest-900 px-3 py-2 text-[11px] font-bold text-white">Confirmar e reservar</button>}
          {order.status==="CONFIRMED"&&<button disabled={busy!==""} onClick={()=>void action(order,"reserve")} className="rounded-lg bg-forest-900 px-3 py-2 text-[11px] font-bold text-white">Reservar estoque</button>}
          {order.status==="RESERVED"&&<button disabled={busy!==""} onClick={()=>void action(order,"picking")} className="rounded-lg bg-forest-900 px-3 py-2 text-[11px] font-bold text-white">Iniciar separação</button>}
          {order.status==="PICKING"&&<button disabled={busy!==""} onClick={()=>void action(order,"confirm-picking")} className="rounded-lg bg-forest-900 px-3 py-2 text-[11px] font-bold text-white">Confirmar separação</button>}
          {order.status==="READY_TO_SHIP"&&<button disabled={busy!==""} onClick={()=>void action(order,"invoice")} className="rounded-lg bg-forest-900 px-3 py-2 text-[11px] font-bold text-white">Faturar</button>}
          {["INVOICED","READY_TO_SHIP"].includes(order.status)&&<button disabled={busy!==""} onClick={()=>void action(order,"ship")} className="flex items-center gap-1 rounded-lg bg-forest-900 px-3 py-2 text-[11px] font-bold text-white"><Send size={12}/> Expedir</button>}
          {["DRAFT","CONFIRMED","RESERVED","PICKING"].includes(order.status)&&<button disabled={busy!==""} onClick={()=>void action(order,"cancel")} className="rounded-lg border border-stone-200 px-3 py-2 text-[11px] font-bold text-stone-600">Cancelar</button>}
        </div>
      </Card>)}{!visible.length&&<Card className="py-14 text-center"><PackageCheck className="mx-auto text-stone-300"/><p className="mt-3 text-sm font-semibold">Nenhum pedido neste filtro</p></Card>}</div>
    </section>
    {creating&&<NewOrder customers={customers} variants={variants} onClose={()=>setCreating(false)} onCreated={async()=>{setCreating(false);await refresh();}}/>}
    {selected&&<OrderDrawer order={selected} onClose={()=>setSelected(null)}/>} 
  </div>;
}

function OrderDrawer({order,onClose}:{order:Order;onClose:()=>void}) {
  const steps=["DRAFT","RESERVED","PICKING","INVOICED","SHIPPED","DELIVERED"];
  const current=steps.indexOf(order.status);
  return <div className="fixed inset-0 z-50 flex justify-end"><button aria-label="Fechar" onClick={onClose} className="absolute inset-0 bg-forest-950/25"/><aside className="relative h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl">
    <div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-forest-700">Detalhe do pedido</p><h2 className="mt-1 text-xl font-bold">{order.orderNumber??order.code}</h2><p className="mt-1 text-xs text-stone-500">{order.customer.name} · {new Date(order.orderedAt).toLocaleDateString("pt-BR")}</p></div><button onClick={onClose} className="rounded-xl border border-stone-200 p-2"><X size={17}/></button></div>
    <div className="mt-6 flex items-center gap-2"><Status status={order.status}/>{order.expectedDeliveryDate&&<span className="text-xs text-stone-500">Entrega: {new Date(order.expectedDeliveryDate).toLocaleDateString("pt-BR")}</span>}</div>
    <div className="mt-7 grid grid-cols-6 gap-1">{steps.map((step,index)=><div key={step} className="text-center"><div className={`mx-auto grid size-7 place-items-center rounded-full text-[10px] ${index<=current?"bg-forest-900 text-white":"bg-stone-100 text-stone-400"}`}>{index<=current?<Check size={13}/>:index+1}</div><p className="mt-1 text-[9px] text-stone-500">{statusLabel[step]}</p></div>)}</div>
    <section className="mt-8"><h3 className="text-sm font-bold">Itens</h3><div className="mt-3 space-y-2">{order.items.map((item)=><div key={item.id} className="rounded-xl border border-stone-100 p-3"><div className="flex justify-between gap-3"><div><p className="text-xs font-semibold">{item.productName}</p><p className="mt-1 text-[11px] text-stone-500">{item.sku} · {item.quantity} un.</p></div><strong className="text-xs">{money.format(Number(item.totalAmount))}</strong></div><p className="mt-2 text-[10px] text-stone-400">Estoque reservado: {item.reservations?.filter((r)=>r.status==="ACTIVE").reduce((sum,r)=>sum+r.quantity,0)??0} un.</p></div>)}</div></section>
    <section className="mt-6 rounded-xl bg-stone-50 p-4"><h3 className="text-sm font-bold">Resumo financeiro</h3><div className="mt-3 space-y-2 text-xs"><Line label="Subtotal" value={money.format(Number(order.subtotal??order.totalAmount))}/><Line label="Desconto" value={money.format(Number(order.discount??0))}/><Line label="Frete" value={money.format(Number(order.freight??0))}/><div className="border-t border-stone-200 pt-2"><Line label="Total" value={money.format(Number(order.totalAmount))} strong/></div></div></section>
    <div className="mt-6 flex items-center gap-2 text-xs text-stone-500"><Clock3 size={14}/> Última atualização operacional registrada no pedido.</div>
  </aside></div>;
}
function Line({label,value,strong}:{label:string;value:string;strong?:boolean}) { return <div className={`flex justify-between ${strong?"font-bold text-stone-900":"text-stone-500"}`}><span>{label}</span><span>{value}</span></div>; }

function NewOrder({customers,variants,onClose,onCreated}:{customers:Customer[];variants:StockOption[];onClose:()=>void;onCreated:()=>Promise<void>}) {
  const lines=useMemo(()=>[...new Set(variants.map((item)=>item.lineCode))],[variants]);
  const [line,setLine]=useState(lines[0]??"");
  const products=useMemo(()=>[...new Set(variants.filter((item)=>item.lineCode===line).map((item)=>item.product))],[variants,line]);
  const [product,setProduct]=useState("");
  const available=variants.filter((item)=>item.lineCode===line&&(!product||item.product===product));
  const [variantId,setVariantId]=useState("");
  const [customerId,setCustomerId]=useState(customers[0]?.id??"");
  const [customerHealth,setCustomerHealth]=useState<CustomerHealth|null>(null);
  const [healthLoading,setHealthLoading]=useState(false);
  const [paymentTerm,setPaymentTerm]=useState("À vista");
  const [quantity,setQuantity]=useState(1);
  const [unitPrice,setUnitPrice]=useState(0);
  const [error,setError]=useState("");
  const selected=variants.find((item)=>item.productVariantId===variantId);

  useEffect(()=>{
    if(!customerId){setCustomerHealth(null);return;}
    let cancelled=false;
    setHealthLoading(true); setError(""); setPaymentTerm("À vista");
    void fetch(`/api/customers/${customerId}/health`,{credentials:"include",cache:"no-store"}).then(async(response)=>{
      const payload=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(payload?.message??"Não consegui ler a situação deste cliente.");
      if(!cancelled) setCustomerHealth(payload);
    }).catch((cause)=>{if(!cancelled){setCustomerHealth(null);setError(cause instanceof Error?cause.message:"Não consegui ler a situação deste cliente.");}}).finally(()=>{if(!cancelled)setHealthLoading(false);});
    return()=>{cancelled=true;};
  },[customerId]);

  const isTerm=paymentTerm!=="À vista";
  const termBlocked=isTerm&&!customerHealth?.termPurchaseAllowed;
  const submit=async()=>{
    if(!selected||!customerId) return setError("Escolha o cliente, o produto e a apresentação para continuar.");
    if(isTerm&&termBlocked) return setError("Esta venda a prazo ainda não está autorizada. Solicite a aprovação de crédito antes de confirmar o pedido.");
    if(quantity>selected.availableStock) return setError(`Hoje há ${selected.availableStock} un. disponíveis. Faltam ${quantity-selected.availableStock} un. para este pedido.`);
    const response=await fetch(API,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({code:`PV-${Date.now().toString().slice(-7)}`,customerId,notes:`Condição de pagamento: ${paymentTerm}`,items:[{productVariantId:selected.productVariantId,warehouseId:selected.warehouseId,quantity,unitPrice}]})});
    const result=await response.json();
    if(!response.ok) return setError(result.message??"Não foi possível criar o pedido.");
    await onCreated();
  };

  const approvedTerm=customerHealth?.paymentTerms&&customerHealth.paymentTerms!=="À vista"?customerHealth.paymentTerms:null;
  return <div className="fixed inset-0 z-50 flex justify-end"><button aria-label="Fechar" onClick={onClose} className="absolute inset-0 bg-forest-950/25"/><aside className="relative h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-2xl">
    <div className="flex items-start justify-between"><div><p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-violet-700"><Sparkles size={13}/> Venda assistida</p><h2 className="mt-1 text-xl font-bold">Novo pedido</h2><p className="mt-2 text-xs text-stone-500">Eu verifico cliente, condição e estoque enquanto você monta o pedido.</p></div><button onClick={onClose} className="rounded-xl border p-2"><X size={17}/></button></div>
    <div className="mt-7 space-y-4">
      <Field label="Cliente"><select value={customerId} onChange={(event)=>setCustomerId(event.target.value)}><option value="">Selecione</option>{customers.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
      {healthLoading&&<div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-xs text-blue-800">Estou verificando a situação deste cliente…</div>}
      {customerHealth&&!healthLoading&&<CustomerSignal health={customerHealth}/>} 
      <Field label="Condição de pagamento"><select value={paymentTerm} onChange={(event)=>{setPaymentTerm(event.target.value);setError("");}}><option>À vista</option>{approvedTerm&&<option>{approvedTerm}</option>}{!approvedTerm&&customerHealth?.paymentTerms&&customerHealth.paymentTerms!=="À vista"&&<option>{customerHealth.paymentTerms}</option>}</select></Field>
      {customerHealth&&paymentTerm==="À vista"&&<div className="flex gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-900"><CheckCircle2 className="mt-0.5 shrink-0" size={18}/><div><p className="text-xs font-bold">Compra à vista liberada</p><p className="mt-1 text-[11px] leading-5 text-emerald-800">Este cliente pode seguir normalmente para uma venda à vista.</p></div></div>}
      {customerHealth&&isTerm&&termBlocked&&<div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950"><AlertTriangle className="mt-0.5 shrink-0" size={18}/><div><p className="text-xs font-bold">Crédito pendente de aprovação</p><p className="mt-1 text-[11px] leading-5">A venda à vista continua liberada. Para usar {paymentTerm}, a aprovação de crédito precisa ocorrer primeiro.</p></div></div>}
      {customerHealth&&isTerm&&!termBlocked&&<div className="flex gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-900"><CheckCircle2 className="mt-0.5 shrink-0" size={18}/><div><p className="text-xs font-bold">Condição a prazo autorizada</p><p className="mt-1 text-[11px]">Crédito disponível hoje: {money.format(customerHealth.financialHealth.availableCredit)}.</p></div></div>}
      <Field label="Linha"><select value={line} onChange={(event)=>{setLine(event.target.value);setProduct("");setVariantId("");}}><option value="">Selecione</option>{lines.map((item)=><option key={item}>{item}</option>)}</select></Field>
      <Field label="Produto"><select value={product} onChange={(event)=>{setProduct(event.target.value);setVariantId("");}}><option value="">Selecione</option>{products.map((item)=><option key={item}>{item}</option>)}</select></Field>
      <Field label="SKU / apresentação"><select value={variantId} onChange={(event)=>setVariantId(event.target.value)}><option value="">Selecione</option>{available.map((item)=><option key={item.productVariantId} value={item.productVariantId}>{item.presentationGrams===1000?"1 kg":`${item.presentationGrams} g`} · {item.sku}</option>)}</select></Field>
      {selected&&<Card className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold">{selected.product} · {selected.presentationGrams===1000?"1 kg":`${selected.presentationGrams} g`}</p><p className="mt-1 text-[11px] text-stone-400">{selected.warehouse}</p></div><Badge tone={selected.availableStock>20?"success":selected.availableStock>0?"warning":"danger"}>{selected.availableStock>0?`${selected.availableStock} disponíveis`:"Indisponível"}</Badge></div><div className="mt-3 grid grid-cols-3 gap-2 text-xs"><span>Físico<br/><strong>{selected.physicalStock}</strong></span><span>Reservado<br/><strong>{selected.reservedStock}</strong></span><span>Disponível<br/><strong>{selected.availableStock}</strong></span></div></Card>}
      <Field label="Quantidade"><input type="number" min="1" max={selected?.availableStock} value={quantity} onChange={(event)=>setQuantity(Number(event.target.value))}/></Field>
      <Field label="Preço unitário"><input type="number" min="0" step="0.01" value={unitPrice} onChange={(event)=>setUnitPrice(Number(event.target.value))}/></Field>
      {error&&<p className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</p>}
      <button disabled={termBlocked||healthLoading} onClick={()=>void submit()} className="w-full rounded-xl bg-forest-900 py-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-stone-300">{termBlocked?"Aguardando aprovação de crédito":"Criar pedido"}</button>
    </div>
  </aside></div>;
}

function CustomerSignal({health}:{health:CustomerHealth}) {
  const state=health.financialHealth.health;
  const cfg=state==="HEALTHY"?{box:"border-emerald-100 bg-emerald-50 text-emerald-900",Icon:CheckCircle2,title:"Cliente em dia"}:state==="BLOCKED"?{box:"border-red-100 bg-red-50 text-red-900",Icon:ShieldAlert,title:"Atenção antes de continuar"}:state==="ATTENTION"?{box:"border-amber-100 bg-amber-50 text-amber-950",Icon:AlertTriangle,title:"Este cliente pede atenção"}:{box:"border-blue-100 bg-blue-50 text-blue-900",Icon:Info,title:"Cliente apto para compras à vista"};
  return <div className={`rounded-2xl border p-4 ${cfg.box}`}><div className="flex gap-3"><cfg.Icon className="mt-0.5 shrink-0" size={18}/><div><p className="text-xs font-bold">{cfg.title}</p><p className="mt-1 text-[11px] leading-5">{health.financialHealth.guidance}</p>{health.financialHealth.overdueCount>0&&<p className="mt-2 text-[11px] font-semibold">Há pendência financeira registrada. O BBOS não libera prazo automaticamente.</p>}</div></div></div>;
}
function Field({label,children}:{label:string;children:ReactNode}) { return <label className="block text-xs font-semibold text-stone-700">{label}<div className="mt-2 [&>*]:w-full [&>*]:rounded-xl [&>*]:border [&>*]:bg-white [&>*]:px-3 [&>*]:py-3 [&>*]:text-xs [&>*]:outline-none">{children}</div></label>; }
function Kpi({label,value}:{label:string;value:string}) { return <Card className="p-4"><p className="text-[11px] font-semibold text-stone-500">{label}</p><p className="mt-2 truncate text-xl font-bold">{value}</p></Card>; }
function Status({status}:{status:string}) { return <Badge tone={statusTone[status]??"neutral"}>{statusLabel[status]??status}</Badge>; }
