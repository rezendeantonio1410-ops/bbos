"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getApiBaseUrl } from "@/lib/api-url";

type S={wip?:{availableKg?:number;lots?:number};finishedGoods?:{units?:number;lots?:number;missingExpiry?:number}};
export function ProductionFlowStrip(){
 const [s,setS]=useState<S>({});
 useEffect(()=>{void fetch(`${getApiBaseUrl()}/operations-flow/summary`,{credentials:"include",cache:"no-store"}).then(r=>r.ok?r.json():{}).then(setS).catch(()=>setS({}));},[]);
 return <div className="mb-5 grid gap-3 rounded-2xl border bg-white p-3 sm:grid-cols-4">
  <Metric label="WIP torrado" value={`${Number(s.wip?.availableKg??0).toLocaleString("pt-BR",{maximumFractionDigits:1})} kg`} />
  <Metric label="Lotes WIP" value={String(s.wip?.lots??0)} />
  <Metric label="Produto acabado" value={`${Number(s.finishedGoods?.units??0).toLocaleString("pt-BR")} un.`} />
  <Link href="/producao/controle" className="rounded-xl bg-stone-50 p-3"><p className="text-[10px] font-bold uppercase text-stone-500">Validade pendente</p><p className="mt-1 text-lg font-bold">{s.finishedGoods?.missingExpiry??0}</p><p className="mt-1 text-[10px] text-forest-700">Abrir rastreabilidade →</p></Link>
 </div>;
}
function Metric({label,value}:{label:string;value:string}){return <div className="rounded-xl bg-stone-50 p-3"><p className="text-[10px] font-bold uppercase text-stone-500">{label}</p><p className="mt-1 text-lg font-bold">{value}</p></div>}
