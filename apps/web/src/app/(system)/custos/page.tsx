"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CircleDollarSign,
  Factory,
  Flame,
  Gauge,
  Settings2,
  Wrench,
  Zap,
} from "lucide-react";
import { Badge, Card } from "@bbos/ui";
import { CostNavigation } from "@/components/cost-navigation";

const API = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api"}/costing`;
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const compactBrl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

type Summary = {
  period: string | null;
  periodStatus: string;
  source: "database";
  metrics: { industrialCost: number; averageCostPerKg: number; energy: number; gas: number; maintenance: number; budgetVariance: number };
  byNature: Array<{ nature: string; amount: number }>;
  products: Array<{ productVariantId: string; sku: string; product: string; line: string; presentationGrams: number; status: string; industrialCost: number; costPerUnit: number; costPerKg: number }>;
};
type Center = { id: string; code: string; name: string; category: string; allocationMethod: string; actual: number; budget: number; variance: number; active: boolean; resources: number };
type Resource = { id: string; code: string; name: string; costCenter: string; active: boolean; usageHours: number; cost: { depreciationPerHour: number; maintenancePerHour: number; energyPerHour: number; gasPerHour: number; otherPerHour: number; totalPerHour: number } };

export default function CostsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [centers, setCenters] = useState<Center[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  useEffect(() => {
    void Promise.all([fetch(`${API}/summary`), fetch(`${API}/cost-centers`), fetch(`${API}/resources`)]).then(async ([summaryResponse, centersResponse, resourcesResponse]) => {
      if (summaryResponse.ok) setSummary(await summaryResponse.json());
      if (centersResponse.ok) setCenters(await centersResponse.json());
      if (resourcesResponse.ok) setResources(await resourcesResponse.json());
    });
  }, []);
  const metrics = summary?.metrics;
  return <div className="mx-auto max-w-[1600px]">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-forest-700"><CircleDollarSign size={13}/>Custeio gerencial industrial</p><h1 className="mt-1 text-3xl font-bold">Custos</h1><p className="mt-2 text-sm text-stone-500">Custos reais, centros, recursos e rastreabilidade por OP e SKU</p></div><Badge tone={summary?.periodStatus === "CLOSED" ? "neutral" : "success"}>{summary?.period ? `${summary.period} • ${summary.periodStatus}` : "Sem período calculado"}</Badge></header>
    <CostNavigation />
    <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <Metric icon={Factory} label="Custo industrial do mês" value={compactBrl.format(metrics?.industrialCost ?? 0)}/>
      <Metric icon={Gauge} label="Custo médio/kg" value={brl.format(metrics?.averageCostPerKg ?? 0)}/>
      <Metric icon={Zap} label="Energia" value={compactBrl.format(metrics?.energy ?? 0)}/>
      <Metric icon={Flame} label="Gás" value={compactBrl.format(metrics?.gas ?? 0)}/>
      <Metric icon={Wrench} label="Manutenção" value={compactBrl.format(metrics?.maintenance ?? 0)}/>
      <Metric icon={Activity} label="Desvio vs orçamento" value={compactBrl.format(metrics?.budgetVariance ?? 0)} tone={(metrics?.budgetVariance ?? 0) > 0 ? "attention" : "normal"}/>
    </section>
    {!summary?.period && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900"><strong>Estrutura pronta, aguardando dados reais.</strong> Centros e máquinas estão persistidos; os indicadores serão preenchidos por lançamentos, apontamentos de OP e períodos de rateio.</div>}
    <section className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
      <Card className="p-5"><Heading title="Centros de custo" subtitle="Realizado, orçamento e critério de rateio"/><div className="mt-4 space-y-2">{centers.map((center)=><div key={center.id} className="grid gap-3 rounded-xl border border-[#E8ECEB] p-3 md:grid-cols-[1.2fr_.8fr_1fr_90px] md:items-center"><div><p className="text-sm font-semibold">{center.name}</p><p className="mt-1 text-[10px] text-stone-500">{center.code} • {categoryLabel(center.category)}</p></div><div><p className="text-xs font-bold">{compactBrl.format(center.actual)}</p><p className="text-[10px] text-stone-500">Orçado {compactBrl.format(center.budget)}</p></div><div><p className="text-[10px] text-stone-500">Rateio</p><p className="text-xs font-semibold">{methodLabel(center.allocationMethod)}</p></div><div className="text-right"><Badge tone={center.variance > 0 ? "warning" : "success"}>{center.variance > 0 ? "+" : ""}{compactBrl.format(center.variance)}</Badge></div></div>)}</div></Card>
      <Card className="p-5"><Heading title="Custos por natureza" subtitle="Direto, industrial indireto e corporativo"/><div className="mt-5 space-y-5">{(summary?.byNature ?? []).map((item)=>{const total=(summary?.byNature ?? []).reduce((sum,current)=>sum+current.amount,0);const ratio=total?item.amount/total*100:0;return <div key={item.nature}><div className="flex justify-between text-xs"><span className="font-semibold">{natureLabel(item.nature)}</span><strong>{compactBrl.format(item.amount)}</strong></div><div className="mt-2 h-2 rounded-full bg-stone-100"><div className={`h-full rounded-full ${item.nature === "DIRECT" ? "bg-forest-800" : item.nature === "INDIRECT_INDUSTRIAL" ? "bg-coffee-500" : "bg-[#6f7890]"}`} style={{width:`${ratio}%`}}/></div><p className="mt-1 text-[10px] text-stone-500">{ratio.toLocaleString("pt-BR",{maximumFractionDigits:1})}% do total lançado</p></div>})}</div></Card>
    </section>
    <section className="mt-6 grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
      <Card className="p-5"><Heading title="Máquinas / recursos" subtitle="Memória de custo por hora"/><div className="mt-4 space-y-3">{resources.map((resource)=><div key={resource.id} className="rounded-xl bg-stone-50 p-4"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold">{resource.name}</p><p className="mt-1 text-[10px] text-stone-500">{resource.code} • {resource.costCenter}</p></div><strong className="text-sm">{brl.format(resource.cost.totalPerHour)}/h</strong></div><div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-stone-500 sm:grid-cols-4"><span>Depreciação<br/><b className="text-stone-900">{brl.format(resource.cost.depreciationPerHour)}</b></span><span>Manutenção<br/><b className="text-stone-900">{brl.format(resource.cost.maintenancePerHour)}</b></span><span>Energia<br/><b className="text-stone-900">{brl.format(resource.cost.energyPerHour)}</b></span><span>Gás<br/><b className="text-stone-900">{brl.format(resource.cost.gasPerHour)}</b></span></div></div>)}</div></Card>
      <Card className="p-5"><Heading title="Produtos com maior custo" subtitle="Custo industrial real por ProductVariant"/><div className="mt-4 space-y-2">{(summary?.products ?? []).sort((a,b)=>b.costPerUnit-a.costPerUnit).map((product)=><Link key={product.productVariantId} href={`/custos/produtos/${product.productVariantId}`} className="group grid gap-3 rounded-xl border border-transparent p-3 transition hover:border-forest-100 hover:bg-forest-50/40 md:grid-cols-[1.2fr_.7fr_.7fr_110px_20px] md:items-center"><div><p className="text-sm font-semibold">{product.product}</p><p className="mt-1 text-[10px] text-stone-500">{product.line} • {product.sku} • {product.presentationGrams===1000?"1 kg":`${product.presentationGrams} g`}</p></div><div><p className="text-[10px] text-stone-500">Custo/un.</p><strong className="text-xs">{brl.format(product.costPerUnit)}</strong></div><div><p className="text-[10px] text-stone-500">Custo/kg</p><strong className="text-xs">{brl.format(product.costPerKg)}</strong></div><Badge tone={product.status === "CALCULATED" ? "success" : "warning"}>{product.status === "CALCULATED" ? "Calculado" : "Aguardando dados"}</Badge><ArrowRight size={14} className="text-stone-300 transition group-hover:translate-x-0.5"/></Link>)}</div></Card>
    </section>
    <section className="mt-6"><Card className="p-5"><Heading title="Variações relevantes" subtitle="Diagnósticos serão exibidos somente quando houver lançamentos rastreáveis"/><div className="mt-4 flex items-center gap-3 rounded-xl border border-dashed p-5 text-xs text-stone-500"><Settings2 size={17}/><p>Nenhuma variação real disponível. O BBOS não apresenta causas sem origem auditável.</p></div></Card></section>
  </div>;
}

function Metric({icon:Icon,label,value,tone="normal"}:{icon:typeof Factory;label:string;value:string;tone?:"normal"|"attention"}) {return <Card className="p-4"><span className={`grid size-8 place-items-center rounded-lg ${tone === "attention" ? "bg-amber-50 text-amber-700" : "bg-forest-50 text-forest-700"}`}><Icon size={15}/></span><p className="mt-3 text-[10px] font-medium text-stone-500">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></Card>}
function Heading({title,subtitle}:{title:string;subtitle:string}) {return <div><h2 className="text-base font-bold">{title}</h2><p className="mt-1 text-xs text-stone-500">{subtitle}</p></div>}
function categoryLabel(value:string){return value === "INDUSTRIAL" ? "Industrial" : value === "LOGISTICS_INVENTORY" ? "Estoque / Logística" : "Corporativo"}
function natureLabel(value:string){return value === "DIRECT" ? "Custo direto" : value === "INDIRECT_INDUSTRIAL" ? "Industrial indireto" : "Corporativo"}
function methodLabel(value:string){return value.replaceAll("_"," ").toLocaleLowerCase("pt-BR")}
