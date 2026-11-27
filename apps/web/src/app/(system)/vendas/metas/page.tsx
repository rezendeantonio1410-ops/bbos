"use client";

import * as React from "react";
import Link from "next/link";
import { getApiBaseUrl } from "@/lib/api-url";
import { salesPace } from "@/lib/command-center";
import { goalProgress, type CommandInsights, type TodaySales } from "@/lib/command-center-v6";
import { SalesGoal } from "@/components/command-center-v4";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const card = "rounded-[var(--bbos-radius-card,14px)] border border-[var(--bbos-border)] bg-white p-5";

/** Metas de vendas e margem do mês: aberto ao clicar em "Vendas no mês" na Central. */
export default function MetasPage() {
  const [salesMonth, setSalesMonth] = React.useState<number | null>(null);
  const [insights, setInsights] = React.useState<CommandInsights | null>(null);
  const [today, setToday] = React.useState<TodaySales | null>(null);

  const load = React.useCallback(async () => {
    const api = getApiBaseUrl();
    const get = async <T,>(path: string) => {
      const response = await fetch(`${api}${path}`, { credentials: "include", cache: "no-store" }).catch(() => null);
      return response?.ok ? ((await response.json()) as T) : null;
    };
    const [home, nextInsights, nextToday] = await Promise.all([
      get<{ salesMonth?: number }>("/dashboard/home"),
      get<CommandInsights>("/command-center/insights"),
      get<TodaySales>("/command-center/today"),
    ]);
    setSalesMonth(Number(home?.salesMonth ?? 0));
    setInsights(nextInsights);
    setToday(nextToday);
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  const saveGoal = async (month: string, salesTarget: number | null) => {
    const response = await fetch(`${getApiBaseUrl()}/command-center/goal`, {
      method: "PUT", credentials: "include", headers: { "content-type": "application/json" },
      body: JSON.stringify({ month, salesTarget }),
    }).catch(() => null);
    if (!response) return "Sem conexão. Tente de novo.";
    if (response.status === 403) return "Só a liderança (administrador ou executivo) define a meta.";
    if (!response.ok) return ((await response.json().catch(() => ({}))) as { message?: string }).message ?? "Não foi possível salvar a meta.";
    await load();
    return null;
  };

  const marketplace = today?.marketplaceMonth.amount ?? 0;
  const total = (salesMonth ?? 0) + marketplace;
  const pace = salesPace(total);
  const goal = goalProgress(total, insights?.goal.salesTarget ?? null, pace.projection, pace.daysLeft);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-24">
      <div>
        <Link href="/home" className="text-[13px] font-semibold text-[var(--bbos-coffee-green)]">← Central de comando</Link>
        <h1 className="mt-1 text-[22px] font-semibold">Metas e margem</h1>
        <p className="text-sm text-[var(--bbos-text-secondary)]">Meta de vendas do mês e do próximo, e quanto sobra do que é vendido.</p>
      </div>

      <section className={card} aria-labelledby="month-title">
        <h2 id="month-title" className="text-xs font-semibold uppercase tracking-[.08em] text-[var(--bbos-text-secondary)]">Vendas no mês</h2>
        <p className="mt-1 text-[30px] font-bold tabular-nums">{salesMonth === null ? "—" : brl.format(total)}</p>
        <p className="text-[13px] text-[var(--bbos-text-secondary)]">
          projeção {brl.format(pace.projection)} · ritmo {brl.format(pace.perDay)}/dia
          {marketplace > 0 && <> · inclui {today!.marketplaceMonth.byChannel.map((row) => `${row.channel} ${brl.format(row.amount)}`).join(" · ")}</>}
        </p>
        {goal && (
          <div className="mt-3">
            <div aria-hidden className="h-3 rounded bg-[var(--bbos-surface-subtle)]"><span className="block h-full rounded" style={{ width: `${goal.percent}%`, background: goal.reached || goal.onTrack ? "var(--bbos-success)" : "var(--bbos-warning)" }} /></div>
            <p className="mt-1 text-[13px] text-[var(--bbos-text-secondary)]">{goal.reached ? "Meta batida." : `${goal.percent}% da meta · faltam ${brl.format(goal.missing)} (${brl.format(goal.perDay)}/dia) · projeção chega a ${goal.projectedPercent}%`}</p>
          </div>
        )}
        <SalesGoal goal={goal} insights={insights} onSave={saveGoal} />
      </section>

      <section className={card} aria-labelledby="links-title">
        <h2 id="links-title" className="text-[15px] font-semibold">Para completar</h2>
        <ul className="mt-2 space-y-2 text-[14px]">
          {insights?.margin.marginPercent === null && <li><Link href="/custos" className="font-semibold text-[var(--bbos-coffee-green)] underline underline-offset-2">Cadastrar o custo dos produtos</Link> <span className="text-[var(--bbos-text-secondary)]">para a margem do mês aparecer na Central.</span></li>}
          {today && today.marketplaceMonth.orders > 0 && <li><Link href="/commerce/marketplaces" className="font-semibold text-[var(--bbos-coffee-green)] underline underline-offset-2">Importar {today.marketplaceMonth.orders} {today.marketplaceMonth.orders === 1 ? "pedido" : "pedidos"} de marketplace</Link> <span className="text-[var(--bbos-text-secondary)]">para virarem pedido, nota e estoque no BBOS.</span></li>}
          <li><Link href="/vendas" className="font-semibold text-[var(--bbos-coffee-green)] underline underline-offset-2">Ver vendas por região, produto e cliente</Link></li>
        </ul>
      </section>
    </div>
  );
}
