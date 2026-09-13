"use client";
import { useEffect,useState } from "react";
import { Card } from "@bbos/ui";
import { getApiBaseUrl } from "@/lib/api-url";

type Wip={id:string;code:string;productionOrderCode:string;productName:string;sku:string;availableKg:number;producedKg:number;status:string;producedAt:string};
type Lot={id:string;code:string;name:string;sku:string;warehouse:string;quantityOnHand:number;initialUnits:number;status:string;manufacturedAt:string;expiresAt?:string|null;productionOrderCode?:string|null};
export default function ProductionControl(){
 const [wip,setWip]=useState<Wip[]>([]),[lots,setLots]=useState<Lot[]>([]);
 useEffect(()=>{const r=getApiBaseUrl();void Promise.all([fetch(`${r}/operations-flow/wip`,{credentials:"include"}).then(x=>x.ok?x.json():[]),fetch(`${r}/operations-flow/finished-lots`,{credentials:"include"}).then(x=>x.ok?x.json():[])]).then(([a,b])=>{setWip(a);setLots(b)}).catch(()=>{});},[]);
 return <div className="mx-auto max-w-[1400px] space-y-6">
  <header><p className="text-xs font-bold uppercase tracking-[.14em] text-amber-700">Produção · rastreabilidade</p><h1 className="mt-2 text-3xl font-bold">Do torrador ao pacote</h1><p className="mt-2 text-sm text-stone-500">WIP torrado, lotes de produto acabado e validade em uma única linha operacional.</p></header>
  <section><h2 className="mb-3 text-sm font-bold">WIP torrado</h2><div className="grid gap-3 md:grid-cols-2">{wip.map(x=><Card key={x.id} className="p-4"><div className="flex justify-between gap-4"><div><p className="font-bold">{x.code}</p><p className="text-xs text-stone-500">{x.productionOrderCode} · {x.productName} · {x.sku}</p></div><strong>{Number(x.availableKg).toLocaleString("pt-BR",{maximumFractionDigits:2})} kg</strong></div><p className="mt-3 text-[10px] uppercase text-stone-400">Produzido {new Date(x.producedAt).toLocaleDateString("pt-BR")} · {x.status}</p></Card>)}</div>{!wip.length&&<p className="text-sm text-stone-500">Nenhum café torrado aguardando embalagem.</p>}</section>
  <section><h2 className="mb-3 text-sm font-bold">Lotes de produto acabado</h2><div className="overflow-hidden rounded-2xl border bg-white"><div className="grid grid-cols-[1.2fr_1fr_.7fr_.7fr_.9fr] bg-stone-50 px-4 py-3 text-[10px] font-bold uppercase text-stone-500"><span>Lote / produto</span><span>OP / armazém</span><span>Inicial</span><span>Saldo</span><span>Validade</span></div>{lots.map(x=><div key={x.id} className="grid grid-cols-[1.2fr_1fr_.7fr_.7fr_.9fr] items-center border-t px-4 py-3 text-xs"><span><b>{x.code}</b><br/><em className="not-italic text-stone-500">{x.name} · {x.sku}</em></span><span>{x.productionOrderCode??"Legado"}<br/><em className="not-italic text-stone-500">{x.warehouse}</em></span><span>{x.initialUnits}</span><span>{x.quantityOnHand}</span><span className={x.expiresAt?"":"font-semibold text-amber-700"}>{x.expiresAt?new Date(x.expiresAt).toLocaleDateString("pt-BR"):"Definir validade"}</span></div>)}</div></section>
 </div>;
}
