"use client";

import { useState } from "react";
import {
  Activity,
  ArrowRight,
  Building2,
  CircleDollarSign,
  Factory,
  Scale,
  X,
} from "lucide-react";
import { Badge, Card } from "@bbos/ui";
import { costCentersDemo } from "@/lib/costing-demo-data";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
type Center = (typeof costCentersDemo)[number];

export default function CostCentersPage() {
  const [selected, setSelected] = useState<Center | null>(null);
  const total = costCentersDemo.reduce((sum, center) => sum + center.actual, 0);
  const industrial = costCentersDemo
    .filter((center) => center.category === "Industrial")
    .reduce((sum, center) => sum + center.actual, 0);
  return (
    <div className="mx-auto max-w-[1500px]">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-forest-700">
          Financeiro • Custeio gerencial
        </p>
        <h1 className="mt-2 text-3xl font-bold">Centros de Custo</h1>
        <p className="mt-2 text-sm text-stone-500">
          Custos, critérios de rateio e impacto industrial — período aberto
          agosto/2026.
        </p>
      </header>
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          icon={CircleDollarSign}
          label="Custo do mês"
          value={brl.format(total)}
          detail="Realizado consolidado"
        />
        <Metric
          icon={Factory}
          label="Custo industrial"
          value={brl.format(industrial)}
          detail={`${Math.round((industrial / total) * 100)}% do total`}
        />
        <Metric
          icon={Building2}
          label="Centros ativos"
          value={`${costCentersDemo.length}`}
          detail="3 categorias gerenciais"
        />
        <Metric
          icon={Activity}
          label="Centros em atenção"
          value="3"
          detail="1 desvio crítico"
        />
      </section>
      <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Realizado x orçamento</h2>
            <p className="text-xs text-stone-500">
              Clique em um centro para auditar composição e rateios.
            </p>
          </div>
          <Badge tone="warning">Período OPEN</Badge>
        </div>
        <div className="mt-5 space-y-2">
          {costCentersDemo.map((center) => {
            const variance = center.actual - center.budget;
            const ratio = Math.min(100, (center.actual / center.budget) * 100);
            return (
              <button
                key={center.id}
                onClick={() => setSelected(center)}
                className="grid w-full gap-3 rounded-xl border border-transparent p-3 text-left transition hover:border-forest-100 hover:bg-forest-50/40 md:grid-cols-[1.4fr_.8fr_1.5fr_.8fr_24px] md:items-center"
              >
                <div>
                  <p className="text-sm font-bold text-stone-900">
                    {center.name}
                  </p>
                  <p className="text-[10px] text-stone-500">
                    {center.code} • {center.category}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-bold">
                    {brl.format(center.actual)}
                  </p>
                  <p
                    className={`text-[10px] ${variance > 0 ? "text-amber-700" : "text-emerald-700"}`}
                  >
                    {variance > 0 ? "+" : ""}
                    {brl.format(variance)} vs. orçamento
                  </p>
                </div>
                <div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
                    <div
                      className={`h-full rounded-full ${center.status === "critical" ? "bg-red-500" : center.status === "attention" ? "bg-amber-500" : "bg-emerald-600"}`}
                      style={{ width: `${ratio}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-stone-500">
                    Orçado {brl.format(center.budget)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-stone-500">Rateio</p>
                  <p className="text-xs font-semibold">{center.method}</p>
                </div>
                <ArrowRight size={15} className="text-stone-400" />
              </button>
            );
          })}
        </div>
      </section>
      {selected && (
        <div
          className="fixed inset-0 z-40 bg-forest-950/20"
          onClick={() => setSelected(null)}
        >
          <aside
            className="ml-auto h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-forest-700">
                  {selected.code}
                </p>
                <h2 className="mt-1 text-2xl font-bold">{selected.name}</h2>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="size-9 rounded-xl border"
              >
                <X className="m-auto" size={17} />
              </button>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Info label="Realizado" value={brl.format(selected.actual)} />
              <Info label="Orçado" value={brl.format(selected.budget)} />
              <Info label="Critério" value={selected.method} />
              <Info label="Recursos" value={`${selected.resources}`} />
            </div>
            <h3 className="mt-7 text-sm font-bold">Trilha de custo</h3>
            <div className="mt-3 space-y-3">
              {[
                "Lançamentos de origem classificados",
                "Base operacional consolidada",
                `Rateio por ${selected.method.toLowerCase()}`,
                "Impacto por OP e SKU",
              ].map((item, index) => (
                <div className="flex gap-3" key={item}>
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-forest-50 text-[10px] font-bold text-forest-700">
                    {index + 1}
                  </span>
                  <p className="text-xs text-stone-600">{item}</p>
                </div>
              ))}
            </div>
            <div className="mt-7 rounded-xl bg-amber-50 p-4 text-xs text-amber-900">
              <strong>Diagnóstico</strong>
              <p className="mt-1">
                O desvio é explicado por lançamentos e bases do período; nenhuma
                mudança em período fechado reescreve o histórico.
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
function Metric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Scale;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="p-4">
      <Icon size={16} className="text-forest-700" />
      <p className="mt-3 text-[10px] text-stone-500">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      <p className="mt-1 text-[10px] text-stone-500">{detail}</p>
    </Card>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-stone-50 p-3">
      <p className="text-[10px] text-stone-500">{label}</p>
      <p className="mt-1 text-sm font-bold">{value}</p>
    </div>
  );
}
