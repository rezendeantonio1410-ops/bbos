"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CircleDollarSign,
  Package,
  ShoppingBag,
  Target,
  TrendingUp,
} from "lucide-react";
import { Card } from "@bbos/ui";
import { getApiBaseUrl } from "@/lib/api-url";

type Period = "day" | "week" | "month" | "year";
type Metric = {
  label: string;
  value: string;
  change?: number;
  supportingText?: string;
};
type ExecutiveDashboard = {
  updatedAt?: string;
  metricsByPeriod?: Partial<Record<Period, Metric[]>>;
  salesMap?: {
    revenue?: number;
    volumeKg?: number;
    target?: number;
    attainment?: number;
  };
};

const periods: Array<{ key: Period; label: string }> = [
  { key: "day", label: "Dia" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mês" },
  { key: "year", label: "Ano" },
];

const API = `${getApiBaseUrl()}/dashboard/executive`;

export default function SalesPage() {
  const [period, setPeriod] = useState<Period>("month");
  const [data, setData] = useState<ExecutiveDashboard | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    fetch(`${API}?period=${period}`, {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.message ?? "Não foi possível carregar vendas.");
        }
        return response.json() as Promise<ExecutiveDashboard>;
      })
      .then((result) => {
        setData(result);
        setStatus("ready");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setData(null);
        setStatus("error");
      });
    return () => controller.abort();
  }, [period]);

  const metrics = data?.metricsByPeriod?.[period] ?? [];
  const byLabel = useMemo(
    () => new Map(metrics.map((metric) => [metric.label.toLowerCase(), metric])),
    [metrics],
  );
  const revenue = byLabel.get("receita")?.value ?? "R$ 0";
  const orders = byLabel.get("pedidos")?.value ?? "0";
  const production = byLabel.get("produção")?.value ?? "Sem dados";
  const greenCoffee = byLabel.get("café verde")?.value ?? "0 kg";

  return (
    <div className="mx-auto max-w-[1500px]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-forest-700">
            Comercial
          </p>
          <h1 className="mt-2 text-3xl font-bold">Vendas</h1>
          <p className="mt-2 text-sm text-stone-500">
            Indicadores comerciais baseados exclusivamente nos pedidos persistidos no BBOs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3 py-2 text-[10px] font-bold ${
              status === "ready"
                ? "bg-emerald-50 text-emerald-800"
                : status === "error"
                  ? "bg-red-50 text-red-800"
                  : "bg-stone-100 text-stone-600"
            }`}
          >
            {status === "ready"
              ? "Dados reais do PostgreSQL"
              : status === "error"
                ? "Falha ao carregar vendas"
                : "Carregando vendas..."}
          </span>
          <div className="flex rounded-xl border bg-white p-1">
            {periods.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setPeriod(item.key)}
                className={`rounded-lg px-3 py-2 text-[10px] font-bold transition ${
                  period === item.key
                    ? "bg-forest-900 text-white"
                    : "text-stone-500 hover:bg-stone-50"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Receita" value={revenue} icon={CircleDollarSign} detail="Pedidos não cancelados no período" />
        <Kpi label="Pedidos" value={orders} icon={ShoppingBag} detail="Pedidos persistidos no período" />
        <Kpi label="Produção" value={production} icon={Package} detail="Consulte o Dashboard Industrial para produção detalhada" />
        <Kpi label="Café verde" value={greenCoffee} icon={TrendingUp} detail="Saldo operacional reportado pelo núcleo" />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.5fr_.8fr]">
        <Card className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-forest-700">
                Fonte única de verdade
              </p>
              <h2 className="mt-1 text-lg font-bold">Performance comercial</h2>
              <p className="mt-2 text-xs text-stone-500">
                A tela não usa mais dados demonstrativos. Receita e quantidade de pedidos vêm do mesmo núcleo que alimenta o Dashboard Executivo.
              </p>
            </div>
            <Link href="/pedidos" className="inline-flex items-center gap-1 text-xs font-bold text-forest-700">
              Ver pedidos <ArrowRight size={13} />
            </Link>
          </div>

          {status === "ready" && metrics.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-stone-200 p-8 text-center text-sm text-stone-500">
              Nenhum dado comercial registrado para o período selecionado.
            </div>
          ) : (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {metrics.map((metric) => (
                <div key={metric.label} className="rounded-xl bg-[#F7F9F8] p-4">
                  <p className="text-[10px] text-stone-500">{metric.label}</p>
                  <p className="mt-2 text-lg font-bold text-stone-900">{metric.value}</p>
                  <p className="mt-1 text-[10px] text-stone-500">
                    {metric.supportingText || "Dados do período"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 text-forest-700">
            <Target size={16} />
            <p className="text-[10px] font-bold uppercase tracking-[.14em]">Metas comerciais</p>
          </div>
          <h2 className="mt-2 text-lg font-bold">Meta x realizado</h2>
          <p className="mt-2 text-xs text-stone-500">
            A meta só será exibida quando existir configuração persistida. O BBOs não apresenta mais percentuais ou projeções fictícias.
          </p>
          <div className="mt-6 rounded-xl border border-dashed border-stone-200 p-5 text-center text-xs text-stone-500">
            Sem meta comercial persistida para este período.
          </div>
        </Card>
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof ShoppingBag;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-stone-500">{label}</p>
        <Icon size={15} className="text-forest-700" />
      </div>
      <p className="mt-3 text-xl font-bold">{value}</p>
      <p className="mt-1 text-[10px] text-stone-500">{detail}</p>
    </Card>
  );
}
