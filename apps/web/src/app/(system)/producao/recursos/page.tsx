import Link from "next/link";
import { ArrowLeft, Bolt, Factory, Flame, Gauge, Settings } from "lucide-react";
import { Card } from "@bbos/ui";
import { resourcesDemo } from "@/lib/costing-demo-data";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});
export default function ResourcesPage() {
  return (
    <div className="mx-auto max-w-[1500px]">
      <header className="flex items-start gap-4">
        <Link href="/producao" className="rounded-xl border bg-white p-2">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-forest-700">
            Produção • Cost Engine V2
          </p>
          <h1 className="mt-2 text-3xl font-bold">Recursos e Máquinas</h1>
          <p className="mt-2 text-sm text-stone-500">
            Memória de cálculo do custo máquina/hora por recurso produtivo.
          </p>
        </div>
      </header>
      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        {resourcesDemo.map((resource) => (
          <Card className="p-5" key={resource.id}>
            <div className="flex items-start justify-between">
              <div className="flex gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-forest-50 text-forest-700">
                  <Factory size={18} />
                </span>
                <div>
                  <h2 className="text-sm font-bold">{resource.name}</h2>
                  <p className="text-[10px] text-stone-500">
                    {resource.code} • {resource.center}
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                Ativo
              </span>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <Small
                label="Custo máquina/h"
                value={brl.format(resource.cost.totalPerHour)}
              />
              <Small label="Horas no mês" value={`${resource.hours} h`} />
              <Small label="Utilização" value={`${resource.utilization}%`} />
            </div>
            <div className="mt-5 space-y-3 border-t pt-4">
              <Cost
                icon={Gauge}
                label="Depreciação/h"
                value={resource.cost.depreciationPerHour}
              />
              <Cost
                icon={Settings}
                label="Manutenção/h"
                value={resource.cost.maintenancePerHour}
              />
              <Cost
                icon={Bolt}
                label="Energia/h"
                value={resource.cost.energyPerHour}
              />
              <Cost
                icon={Flame}
                label="Gás/h"
                value={resource.cost.gasPerHour}
              />
              <Cost
                icon={Factory}
                label="Outros atribuíveis/h"
                value={resource.cost.otherPerHour}
              />
            </div>
            <p className="mt-4 rounded-xl bg-stone-50 p-3 text-[10px] leading-4 text-stone-500">
              Base depreciável{" "}
              {brl.format(resource.cost.memory.depreciableBase)} em{" "}
              {resource.cost.memory.lifetimeProductiveHours.toLocaleString(
                "pt-BR",
              )}{" "}
              horas produtivas estimadas.
            </p>
          </Card>
        ))}
      </section>
    </div>
  );
}
function Small({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-stone-50 p-3">
      <p className="text-[10px] text-stone-500">{label}</p>
      <p className="mt-1 text-sm font-bold">{value}</p>
    </div>
  );
}
function Cost({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Factory;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon size={14} className="text-forest-700" />
      <span className="flex-1 text-xs text-stone-600">{label}</span>
      <strong className="text-xs">{brl.format(value)}</strong>
    </div>
  );
}
