"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, CircleDollarSign, Factory, Scale, ShieldCheck } from "lucide-react";
import { Badge, Card } from "@bbos/ui";

const API = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api"}/costing`;
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const pct = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const num = (value: unknown) => Number(value ?? 0);

type CostView = {
  productVariantId: string;
  sku: string;
  presentationGrams: number;
  salesUnit: string;
  product: string;
  line: string;
  status: string;
  snapshot: null | Record<string, unknown> & { composition: Record<string, unknown>; sourceIds: string[] };
  events: Array<{ id: string; type: string; nature: string; amount: number; description: string; costCenter: null | { id: string; code: string; name: string }; productionOrder: null | { id: string; code: string }; allocationRuleId: string | null }>;
};

const componentDefinitions = [
  ["Café verde", ["greenCoffee", "rawMaterial"], ["RAW_MATERIAL"]],
  ["Perdas", ["roastLoss"], []],
  ["Embalagem", ["packaging"], ["PACKAGING"]],
  ["Etiqueta", ["labels"], ["LABEL"]],
  ["Válvula", ["valves"], ["VALVE"]],
  ["Caixa", ["boxes"], ["BOX"]],
  ["Insumos", ["directSupplies"], ["SUPPLIES"]],
  ["Mão de obra", ["directLabor"], ["LABOR"]],
  ["Energia", ["energy"], ["ENERGY"]],
  ["Gás", ["gas"], ["GAS"]],
  ["Máquina / depreciação", ["machineDepreciation", "depreciation"], ["DEPRECIATION"]],
  ["Manutenção", ["maintenance"], ["MAINTENANCE"]],
  ["Outros industriais", ["otherIndustrial", "allocatedIndustrial"], ["OVERHEAD", "OTHER"]],
] as const;

export default function ProductVariantCostPage({ params }: { params: Promise<{ productVariantId: string }> }) {
  const route = use(params);
  const [data, setData] = useState<CostView | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  useEffect(() => { void fetch(`${API}/product-variants/${route.productVariantId}`).then(async (response)=>{if(response.ok)setData(await response.json())}); }, [route.productVariantId]);
  const components = useMemo(() => componentDefinitions.map(([label, keys, types]) => {
    const composition = data?.snapshot?.composition ?? {};
    const value = keys.reduce((sum, key) => sum + num(composition[key]), 0);
    const events = data?.events.filter((event) => (types as readonly string[]).includes(event.type)) ?? [];
    return { label, value, events };
  }), [data]);
  if (!data) return <div className="mx-auto max-w-[1500px]"><p className="text-sm text-stone-500">Carregando custo rastreável…</p></div>;
  const snapshot = data.snapshot;
  const direct = num(snapshot?.directCost);
  const industrial = num(snapshot?.industrialCost);
  const corporate = num(snapshot?.corporateAllocation);
  const absorbed = num(snapshot?.absorbedCost);
  const goodUnits = num(snapshot?.composition?.goodUnits) || 1;
  const netRevenue = num(snapshot?.netRevenue ?? snapshot?.composition?.netRevenue);
  const pricePerUnit = netRevenue / goodUnits;
  const max = Math.max(1, ...components.map((item) => item.value));
  return <div className="mx-auto max-w-[1500px]">
    <nav className="flex items-center gap-2 text-[10px] text-stone-500"><Link href="/custos">Custos</Link><span>›</span><strong className="text-forest-700">{data.sku}</strong></nav>
    <header className="mt-5 flex items-start gap-4"><Link href="/custos" className="rounded-xl border bg-white p-2"><ArrowLeft size={16}/></Link><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-forest-700">{data.line} • {data.sku}</p><h1 className="mt-1 text-3xl font-bold">{data.product} {data.presentationGrams===1000?"1 kg":`${data.presentationGrams} g`}</h1><p className="mt-2 text-sm text-stone-500">Custo real industrial e memória auditável por ProductVariant</p></div></header>
    {data.status !== "CALCULATED" && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900"><strong>Aguardando dados reais da produção.</strong> Nenhum valor demonstrativo foi apresentado como custo calculado para este SKU.</div>}
    <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric icon={CircleDollarSign} label="Preço líquido/un." value={brl.format(pricePerUnit)}/><Metric icon={Factory} label="Custo direto" value={brl.format(direct/goodUnits)}/><Metric icon={Scale} label="Custo industrial/un." value={brl.format(num(snapshot?.costPerUnit))}/><Metric icon={ShieldCheck} label="Custo absorvido/un." value={brl.format(num(snapshot?.absorbedCostPerUnit) || absorbed/goodUnits)}/></section>
    <section className="mt-6 grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
      <Card className="p-5"><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">Composição do custo</h2><p className="mt-1 text-xs text-stone-500">Clique para navegar da parcela até sua origem.</p></div><Badge tone={data.status === "CALCULATED" ? "success" : "warning"}>{data.status === "CALCULATED" ? "CALCULATED" : "PENDING"}</Badge></div><div className="mt-5 space-y-2">{components.map((component)=><button key={component.label} onClick={()=>setOpened(opened===component.label?null:component.label)} className="w-full rounded-xl p-2 text-left transition hover:bg-stone-50"><div className="flex items-center gap-3"><span className="w-40 text-xs font-medium">{component.label}</span><div className="h-2 flex-1 rounded-full bg-stone-100"><div className="h-full rounded-full bg-forest-800" style={{width:`${component.value/max*100}%`}}/></div><strong className="w-24 text-right text-xs">{brl.format(component.value)}</strong><ChevronDown size={13} className={`transition ${opened===component.label?"rotate-180":""}`}/></div>{opened===component.label&&<div className="ml-40 mt-2 rounded-lg border border-forest-100 bg-forest-50 p-3 text-[10px] text-forest-900">{component.events.length?component.events.map((event)=><div key={event.id} className="border-t py-2 first:border-0"><strong>{event.productionOrder?.code ?? "Sem OP"}</strong> → {event.costCenter ? `${event.costCenter.code} ${event.costCenter.name}` : "Centro legado não informado"} → {event.description} → {brl.format(event.amount)}</div>):<p>Sem lançamento de origem para este componente. A parcela só será exibida quando o snapshot tiver fonte auditável.</p>}</div>}</button>)}</div><div className="mt-5 border-t pt-4"><Total label="Custo direto" value={direct}/><Total label="Custo industrial real" value={industrial}/><Total label="Rateio corporativo" value={corporate}/><Total label="Custo total absorvido" value={absorbed} strong/></div></Card>
      <div className="space-y-4"><Card className="p-5"><h2 className="text-sm font-bold">Margens gerenciais</h2><div className="mt-4 space-y-4"><Margin label="Margem bruta" value={num(snapshot?.grossMarginPercent)}/><Margin label="Margem industrial" value={num(snapshot?.industrialMarginPercent)}/><Margin label="Margem de contribuição" value={num(snapshot?.contributionMarginPercent)}/><Margin label="Margem após rateio" value={num(snapshot?.afterAllocationMarginPercent)}/></div></Card><Card className="p-5"><h2 className="text-sm font-bold">Rastreabilidade</h2><p className="mt-3 text-xs leading-5 text-stone-600">Margem → {data.product} → {data.sku} → OP → componente → centro de custo → lançamento/origem.</p><div className="mt-4 space-y-2">{(snapshot?.sourceIds ?? []).map((source)=><p key={source} className="rounded-lg bg-stone-50 px-3 py-2 text-[10px] text-stone-600">{source}</p>)}{!snapshot?.sourceIds?.length&&<p className="rounded-lg bg-stone-50 px-3 py-2 text-[10px] text-stone-500">Nenhuma origem calculada ainda.</p>}</div></Card></div>
    </section>
  </div>;
}

function Metric({icon:Icon,label,value}:{icon:typeof Scale;label:string;value:string}){return <Card className="p-4"><Icon size={15} className="text-forest-700"/><p className="mt-3 text-[10px] text-stone-500">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></Card>}
function Total({label,value,strong=false}:{label:string;value:number;strong?:boolean}){return <div className={`flex justify-between py-1.5 text-xs ${strong?"mt-2 border-t pt-3 font-bold":""}`}><span>{label}</span><span>{brl.format(value)}</span></div>}
function Margin({label,value}:{label:string;value:number}){return <div><div className="flex justify-between text-xs"><span className="text-stone-600">{label}</span><strong>{pct.format(value)}%</strong></div><div className="mt-2 h-1.5 rounded-full bg-stone-100"><div className="h-full rounded-full bg-forest-800" style={{width:`${Math.max(0,Math.min(100,value))}%`}}/></div></div>}
