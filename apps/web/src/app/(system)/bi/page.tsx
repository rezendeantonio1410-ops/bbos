import {
  ArrowRight,
  BrainCircuit,
  Database,
  Route,
  Sparkles,
} from "lucide-react";
import { Card } from "@bbos/ui";

export default function ExecutiveBiPlaceholderPage() {
  return (
    <div className="mx-auto max-w-[1500px]">
      <header>
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-forest-700">
          <BrainCircuit size={14} strokeWidth={1.7} />
          Camada reservada
        </div>
        <h1 className="mt-2 text-3xl font-bold">BI Executivo</h1>
        <p className="mt-2 text-sm font-medium text-stone-600">
          Business Intelligence Humanizado
        </p>
      </header>
      <Card className="mt-7 max-w-3xl p-7 md:p-9">
        <span className="grid size-11 place-items-center rounded-2xl bg-forest-50 text-forest-800">
          <Sparkles size={20} strokeWidth={1.6} />
        </span>
        <h2 className="mt-6 max-w-xl text-xl font-bold leading-snug">
          Esta área consolidará análises, causas, impactos, projeções e
          recomendações do BBOS.
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-stone-500">
          O BI consumirá as fontes oficiais dos módulos operacionais. Nenhuma
          camada analítica paralela ou IA generativa está ativa nesta fase.
        </p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-stone-50 p-4">
            <Database size={16} className="text-forest-700" />
            <p className="mt-3 text-xs font-bold">Fontes oficiais</p>
            <p className="mt-1 text-[11px] leading-5 text-stone-500">
              Produtos, vendas, produção, estoque, custos, financeiro, pedidos e
              logística.
            </p>
          </div>
          <div className="rounded-xl bg-stone-50 p-4">
            <Route size={16} className="text-forest-700" />
            <p className="mt-3 text-xs font-bold">Rastreabilidade</p>
            <p className="mt-1 flex items-center gap-1 text-[11px] leading-5 text-stone-500">
              KPI <ArrowRight size={10} /> módulo <ArrowRight size={10} />{" "}
              entidade <ArrowRight size={10} /> origem
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
