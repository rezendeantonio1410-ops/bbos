import Link from "next/link";
import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@bbos/ui";

export const commercialMoney = (value: number) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

const changeLabel = (change: number | null | undefined) => {
  if (change == null) return null;
  const UpOrDown = change >= 0 ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${change >= 0 ? "text-emerald-700" : "text-orange-700"}`}>
      <UpOrDown size={13} /> {Math.abs(change).toFixed(1)}% vs. mês anterior
    </span>
  );
};

export function CommercialManagerKpi({
  label,
  value,
  supporting,
  href,
  progress,
  progressTone = "blue",
  change,
  attention = false,
}: {
  label: string;
  value: string | number;
  supporting?: string;
  href: string;
  progress?: number;
  progressTone?: "orange" | "blue" | "green";
  change?: number | null;
  attention?: boolean;
}) {
  const tones = { orange: "bg-orange-400", blue: "bg-blue-600", green: "bg-emerald-600" };
  return (
    <Link href={href} className="group block min-w-0">
      <Card className={`h-full p-4 transition group-hover:-translate-y-0.5 group-hover:border-forest-300 group-hover:shadow-sm ${attention ? "border-orange-200 bg-orange-50/30" : ""}`}>
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold text-stone-500">{label}</p>
          <ArrowRight size={14} className="shrink-0 text-stone-300 transition group-hover:text-forest-700" />
        </div>
        <p className="mt-2 text-xl font-bold tracking-tight text-stone-900">{value}</p>
        {progress != null && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100" aria-label={`${progress.toFixed(1)}%`}>
            <div className={`h-full rounded-full ${tones[progressTone]}`} style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
          </div>
        )}
        <div className="mt-2 min-h-4 text-[11px] text-stone-500">
          {changeLabel(change) ?? supporting ?? "\u00a0"}
        </div>
      </Card>
    </Link>
  );
}

export function CommercialForecastBar({ revenue, pipeline, target }: { revenue: number; pipeline: number; target: number }) {
  const scale = Math.max(target, revenue + pipeline, 1);
  const revenueWidth = (revenue / scale) * 100;
  const pipelineWidth = (pipeline / scale) * 100;
  const targetPosition = (target / scale) * 100;
  return (
    <div>
      <div className="relative mt-5 h-4 overflow-visible rounded-full bg-stone-100">
        <div className="absolute inset-y-0 left-0 rounded-l-full bg-blue-700" style={{ width: `${revenueWidth}%` }} />
        <div className="absolute inset-y-0 bg-emerald-400" style={{ left: `${revenueWidth}%`, width: `${pipelineWidth}%` }} />
        {target > 0 && <div className="absolute -top-2 h-8 w-0.5 bg-stone-900" style={{ left: `${targetPosition}%` }}><span className="absolute -top-5 -translate-x-1/2 whitespace-nowrap text-[9px] font-bold uppercase text-stone-600">Meta</span></div>}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[10px] font-bold uppercase tracking-wide text-stone-500">
        <span><i className="mr-1 inline-block size-2 rounded-full bg-blue-700" /> Realizado</span>
        <span><i className="mr-1 inline-block size-2 rounded-full bg-emerald-400" /> Pipeline provável</span>
        <span><i className="mr-1 inline-block size-2 rounded-full bg-stone-200" /> Faltante até a meta</span>
      </div>
    </div>
  );
}

export function CommercialForecastCard({ revenue, pipeline, projection, target }: { revenue: number; pipeline: number; projection: number; target: number }) {
  const difference = projection - target;
  return (
    <Card className="p-6">
      <p className="text-[10px] font-bold uppercase tracking-[.16em] text-forest-700">Previsão do mês</p>
      <div className="mt-4 grid items-end gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr_1.1fr]">
        <div><p className="text-xs text-stone-500">Vendido</p><strong className="mt-1 block text-xl">{commercialMoney(revenue)}</strong></div>
        <span className="hidden text-xl text-stone-300 md:block">+</span>
        <div><p className="text-xs text-stone-500">Pipeline ponderado</p><strong className="mt-1 block text-xl">{commercialMoney(pipeline)}</strong></div>
        <span className="hidden text-xl text-stone-300 md:block">=</span>
        <div><p className="text-xs text-stone-500">Projeção</p><strong className="mt-1 block text-xl">{commercialMoney(projection)}</strong></div>
        <div className={`rounded-xl px-4 py-3 ${difference >= 0 && target > 0 ? "bg-emerald-50 text-emerald-800" : "bg-orange-50 text-orange-800"}`}>
          <p className="text-[10px] font-bold uppercase">Meta {commercialMoney(target)}</p>
          <strong className="mt-1 block text-sm">{target <= 0 ? "Meta ainda não configurada" : difference >= 0 ? `Projeção ${commercialMoney(difference)} acima da meta` : `Faltam ${commercialMoney(Math.abs(difference))} para a meta`}</strong>
        </div>
      </div>
      <CommercialForecastBar revenue={revenue} pipeline={pipeline} target={target} />
      <p className="mt-4 text-[11px] text-stone-500">Projeção = vendas confirmadas do mês + valor ponderado das oportunidades com fechamento previsto neste mês.</p>
    </Card>
  );
}

const statusContent = {
  ABOVE_TARGET: ["Acima da meta", "bg-emerald-50 text-emerald-800"],
  ON_TRACK: ["No caminho", "bg-blue-50 text-blue-800"],
  ATTENTION: ["Atenção", "bg-orange-50 text-orange-800"],
  CRITICAL: ["Crítico", "bg-red-50 text-red-800"],
} as const;

export function CommercialStatusBadge({ status }: { status: keyof typeof statusContent }) {
  const [label, classes] = statusContent[status];
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${classes}`}>{label}</span>;
}

export type RepresentativePerformance = {
  id: string; name: string; revenue: number; target: number; achievement: number;
  pipeline: number; customers: number; status: keyof typeof statusContent;
};

export function RepresentativePerformanceTable({ people }: { people: RepresentativePerformance[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 p-5">
        <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-forest-700">Equipe comercial</p><h2 className="mt-1 text-lg font-bold">Desempenho por representante</h2></div>
        <Link href="/comercial/representantes" className="text-xs font-bold text-forest-700">Ver equipe <ArrowRight className="inline" size={13} /></Link>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[850px]">
          <div className="grid grid-cols-[1.4fr_repeat(5,1fr)_110px] gap-3 border-y border-stone-100 bg-stone-50 px-5 py-3 text-[10px] font-bold uppercase tracking-wide text-stone-500">
            <span>Representante</span><span>Vendas</span><span>Meta</span><span>Atingimento</span><span>Pipeline</span><span>Clientes</span><span>Situação</span>
          </div>
          {people.length ? people.map((person) => (
            <Link key={person.id} href={`/comercial/representantes?representativeId=${person.id}`} className="grid grid-cols-[1.4fr_repeat(5,1fr)_110px] gap-3 border-b border-stone-100 px-5 py-4 text-xs transition hover:bg-stone-50">
              <strong>{person.name}</strong><span>{commercialMoney(person.revenue)}</span><span>{commercialMoney(person.target)}</span><span>{(person.achievement * 100).toFixed(1)}%</span><span>{commercialMoney(person.pipeline)}</span><span>{person.customers}</span><CommercialStatusBadge status={person.status} />
            </Link>
          )) : <p className="p-8 text-center text-sm text-stone-500">Nenhum representante ativo no período.</p>}
        </div>
      </div>
    </Card>
  );
}

type AttentionItem = { id: string; priority: "CRITICAL" | "HIGH" | "NORMAL" | "OPPORTUNITY"; category: string; title: string; description: string; href: string; cta: string };
const attentionTone = { CRITICAL: "border-red-200 bg-red-50/40", HIGH: "border-orange-200 bg-orange-50/40", NORMAL: "border-blue-200 bg-blue-50/30", OPPORTUNITY: "border-emerald-200 bg-emerald-50/40" };
const attentionLabel = { CRITICAL: "Crítico", HIGH: "Alto", NORMAL: "Normal", OPPORTUNITY: "Oportunidade" };

export function CommercialAttentionPanel({ items }: { items: AttentionItem[] }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-orange-700">Atenção comercial</p><h2 className="mt-1 text-lg font-bold">Onde agir agora</h2></div><Link href="/comercial/desempenho" className="text-xs font-bold text-forest-700">Ver todas as ações <ArrowRight className="inline" size={13} /></Link></div>
      {items.length ? <div className="mt-4 grid gap-3 lg:grid-cols-2">{items.map((item) => <div key={item.id} className={`rounded-xl border p-4 ${attentionTone[item.priority]}`}><div className="flex items-center justify-between gap-3"><span className="text-[10px] font-bold uppercase tracking-wide text-stone-500">{item.category}</span><span className="text-[10px] font-bold text-stone-600">{attentionLabel[item.priority]}</span></div><strong className="mt-2 block text-sm">{item.title}</strong><p className="mt-1 text-xs leading-relaxed text-stone-600">{item.description}</p><Link href={item.href} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-forest-700">{item.cta} <ArrowRight size={12} /></Link></div>)}</div> : <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">✓ Operação comercial sem alertas críticos.</div>}
    </Card>
  );
}
