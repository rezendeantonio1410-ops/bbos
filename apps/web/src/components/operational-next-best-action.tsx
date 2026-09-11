"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Boxes, Factory, PackageCheck, ShieldAlert, Sparkles } from "lucide-react";
import { Card } from "@bbos/ui";
import { getApiBaseUrl } from "@/lib/api-url";

type SalesOrder={id:string;code?:string;status:string;totalAmount?:string;expectedDeliveryDate?:string};
type ProductionOrder={id:string;code:string;status:string;plannedWeightKg?:number;actualOutputKg?:number;plannedAt?:string};
type FinishedGood={sku:string;product:string;physicalUnits:number;reservedUnits:number;availableUnits:number};
type InventoryLot={id:string;code:string;availableQuantityKg:number;reservedQuantityKg:number;status:string};
type Recommendation={priority:"critical"|"attention"|"ready"|"insufficient";eyebrow:string;title:string;reason:string;impact:string;href:string;action:string};

const openSales=(s:string)=>!["DELIVERED","CANCELLED","SHIPPED"].includes(s);
const openProduction=(s:string)=>!["completed","cancelled","COMPLETED","CANCELLED"].includes(s);

export function OperationalNextBestAction(){
 const[data,setData]=React.useState<{orders:SalesOrder[];production:ProductionOrder[];goods:FinishedGood[];lots:InventoryLot[]}|null>(null); const[failed,setFailed]=React.useState(false);
 React.useEffect(()=>{const api=getApiBaseUrl();void Promise.all([
  fetch(`${api}/sales-orders`,{credentials:"include",cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject()),
  fetch(`${api}/production/orders`,{credentials:"include",cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject()),
  fetch(`${api}/inventory/finished-goods`,{credentials:"include",cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject()),
  fetch(`${api}/inventory/lots`,{credentials:"include",cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject()),
 ]).then(([orders,production,goods,lots])=>setData({orders,production,goods,lots})).catch(()=>setFailed(true))},[]);
 const recommendation=React.useMemo<Recommendation>(()=>{
  if(failed)return{priority:"insufficient",eyebrow:"Leitura interrompida",title:"Não vou recomendar sem dados confiáveis",reason:"Uma ou mais fontes operacionais não responderam.",impact:"Evita transformar indisponibilidade em uma decisão falsa.",href:"/home",action:"Revisar Central"};
  if(!data)return{priority:"insufficient",eyebrow:"Reunindo contexto",title:"Cruzando pedidos, produção e estoque",reason:"O BBOS está formando uma leitura única do fluxo operacional.",impact:"A recomendação só aparece depois da validação das fontes.",href:"/pedidos",action:"Abrir pedidos"};
  const orders=data.orders.filter(o=>openSales(o.status)); const awaiting=orders.filter(o=>o.status==="CONFIRMED"); const ready=orders.filter(o=>["READY_TO_SHIP","INVOICED"].includes(o.status)); const production=data.production.filter(o=>openProduction(o.status));
  const availableGoods=data.goods.reduce((s,g)=>s+Number(g.availableUnits||0),0); const availableGreen=data.lots.filter(l=>!["blocked","BLOCKED"].includes(l.status)).reduce((s,l)=>s+Number(l.availableQuantityKg||0),0);
  if(ready.length)return{priority:"ready",eyebrow:"Próxima melhor ação",title:`Expedir ${ready.length} pedido${ready.length>1?"s":""} já pronto${ready.length>1?"s":""}`,reason:"Há pedido em estágio de expedição/faturamento; produzir mais antes de concluir esse fluxo aumenta trabalho em processo.",impact:"Priorizar saída reduz carteira parada e fecha o ciclo comercial.",href:"/pedidos",action:"Abrir pedidos prontos"};
  if(awaiting.length&&availableGoods>0)return{priority:"attention",eyebrow:"Próxima melhor ação",title:`Reservar estoque para ${awaiting.length} pedido${awaiting.length>1?"s":""} confirmado${awaiting.length>1?"s":""}`,reason:`Existem pedidos confirmados e ${availableGoods} unidades disponíveis de produto acabado no estoque.`,impact:"O próximo passo seguro é validar SKU e quantidade e reservar antes de abrir produção.",href:"/pedidos",action:"Validar e reservar"};
  if(awaiting.length&&availableGoods<=0&&production.length)return{priority:"attention",eyebrow:"Próxima melhor ação",title:"Priorizar as ordens que atendem pedidos confirmados",reason:"Há demanda confirmada, sem produto acabado disponível, e produção já aberta.",impact:"Evita criar OP duplicada e concentra capacidade no que já está comprometido.",href:"/producao",action:"Revisar produção aberta"};
  if(awaiting.length&&availableGoods<=0&&production.length===0&&availableGreen>0)return{priority:"critical",eyebrow:"Próxima melhor ação",title:"Planejar produção para atender pedidos confirmados",reason:`Há ${awaiting.length} pedido${awaiting.length>1?"s":""} confirmado${awaiting.length>1?"s":""}, sem produto acabado e com ${Math.round(availableGreen)} kg de café verde disponível.`,impact:"O BBOS identifica a necessidade, mas a criação da OP continua dependendo da confirmação humana de SKU, lote e quantidade.",href:"/producao",action:"Planejar OP"};
  if(awaiting.length&&availableGoods<=0&&availableGreen<=0)return{priority:"critical",eyebrow:"Bloqueio operacional",title:"Não iniciar produção: matéria-prima indisponível",reason:"Há pedido confirmado sem produto acabado e sem café verde disponível para suportar a produção.",impact:"Primeiro resolva abastecimento/recebimento; criar uma OP agora produziria um plano inexequível.",href:"/cafe-verde",action:"Revisar café verde"};
  if(orders.length===0&&production.length===0&&availableGoods===0&&availableGreen===0)return{priority:"insufficient",eyebrow:"Ainda sem sequência operacional",title:"Faltam movimentos para formar uma recomendação",reason:"Não há pedidos abertos, produção ativa nem estoque disponível registrado.",impact:"O BBOS não interpreta zeros como operação saudável; aguarda evidência operacional.",href:"/pedidos",action:"Começar pelos pedidos"};
  return{priority:"ready",eyebrow:"Fluxo sob controle",title:"Nenhum bloqueio cruzado identificado agora",reason:"Pedidos, produção e estoques disponíveis não geraram uma exceção operacional pelas regras atuais.",impact:"Continue acompanhando novas entradas; o BBOS recalcula a prioridade com os dados reais.",href:"/pedidos",action:"Revisar carteira"};
 },[data,failed]);
 const Icon=recommendation.priority==="critical"?ShieldAlert:recommendation.priority==="attention"?Factory:recommendation.priority==="ready"?PackageCheck:Boxes;
 return <Card className="bbos-guide-card p-5"><div className="flex items-start gap-3"><span className="bbos-guide-icon"><Icon size={17}/></span><div className="min-w-0 flex-1"><p className="bbos-eyebrow">{recommendation.eyebrow}</p><h3 className="mt-1 text-base font-bold">{recommendation.title}</h3><p className="mt-2 text-xs leading-5 text-[var(--bbos-text-secondary)]"><strong>Por quê:</strong> {recommendation.reason}</p><p className="mt-1 text-xs leading-5 text-[var(--bbos-text-secondary)]"><strong>Impacto:</strong> {recommendation.impact}</p><div className="mt-4 flex flex-wrap gap-2"><Link href={recommendation.href} className="bbos-quick-link">{recommendation.action}<ArrowRight size={12}/></Link><button type="button" onClick={()=>window.dispatchEvent(new Event("bbos:open-assistant"))} className="bbos-quick-link"><Sparkles size={12}/> Explicar recomendação</button></div></div></div></Card>
}
