"use client";
import { useEffect,useMemo,useState } from "react";
import { Card } from "@bbos/ui";
import { getApiBaseUrl } from "@/lib/api-url";

type Row={id:string;salesOrderId:string;orderNumber:string;customer:string;installment:number;dueDate:string;amount:string|number;status:string};
const brl=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"});
export default function SalesAgenda(){
 const [rows,setRows]=useState<Row[]>([]);
 useEffect(()=>{void fetch(`${getApiBaseUrl()}/finance/sales-schedule`,{credentials:"include",cache:"no-store"}).then(r=>r.ok?r.json():[]).then(setRows).catch(()=>setRows([]));},[]);
 const total=useMemo(()=>rows.reduce((s,r)=>s+Number(r.amount),0),[rows]);
 const overdue=useMemo(()=>rows.filter(r=>new Date(r.dueDate)<new Date()).length,[rows]);
 return <div className="mx-auto max-w-[1320px] space-y-6">
  <header><p className="text-xs font-bold uppercase tracking-[.14em] text-violet-700">Financeiro · vendas</p><h1 className="mt-2 text-3xl font-bold">Agenda de recebimentos</h1><p className="mt-2 text-sm text-stone-500">Parcelas calculadas a partir da condição comercial efetiva de cada pedido.</p></header>
  <div className="grid gap-3 sm:grid-cols-3"><Card className="p-4"><p className="text-xs text-stone-500">A receber programado</p><p className="mt-2 text-xl font-bold">{brl.format(total)}</p></Card><Card className="p-4"><p className="text-xs text-stone-500">Parcelas abertas</p><p className="mt-2 text-xl font-bold">{rows.length}</p></Card><Card className="p-4"><p className="text-xs text-stone-500">Vencidas na agenda</p><p className={`mt-2 text-xl font-bold ${overdue?"text-red-700":""}`}>{overdue}</p></Card></div>
  <div className="overflow-hidden rounded-2xl border bg-white"><div className="grid grid-cols-[1fr_1.3fr_.55fr_.8fr_.9fr] bg-stone-50 px-4 py-3 text-[10px] font-bold uppercase text-stone-500"><span>Pedido</span><span>Cliente</span><span>Parcela</span><span>Vencimento</span><span className="text-right">Valor</span></div>{rows.map(r=><div key={r.id} className="grid grid-cols-[1fr_1.3fr_.55fr_.8fr_.9fr] items-center border-t px-4 py-3 text-xs"><strong>{r.orderNumber}</strong><span>{r.customer}</span><span>{r.installment}</span><span className={new Date(r.dueDate)<new Date()?"font-semibold text-red-700":""}>{new Date(r.dueDate).toLocaleDateString("pt-BR")}</span><strong className="text-right">{brl.format(Number(r.amount))}</strong></div>)}</div>
  {!rows.length&&<p className="text-sm text-stone-500">Nenhuma parcela de venda aberta. A agenda nasce automaticamente quando o pedido é faturado.</p>}
 </div>;
}
