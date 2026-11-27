"use client";

import * as React from "react";
import { Target } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-url";

type Goal = { partnerId: string; month: string; salesTarget: number | null; kgTarget: number | null };

function monthKeys(now = new Date()) {
  const local = new Date(now.getTime() - 3 * 3_600_000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const key = (year: number, month: number) => `${year}-${String(month + 1).padStart(2, "0")}`;
  return [key(y, m), m === 11 ? key(y + 1, 0) : key(y, m + 1)];
}

const label = (key: string) => new Date(`${key}-15T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** Meta mensal do vendedor (R$ e kg), na tela de Parceiros. Só liderança. */
export function SellerGoalEditor({ partnerId, partnerName }: { partnerId: string; partnerName: string }) {
  const months = React.useMemo(() => monthKeys(), []);
  const [month, setMonth] = React.useState(months[0]!);
  const [goal, setGoal] = React.useState<Goal | null>(null);
  const [open, setOpen] = React.useState(false);
  const [sales, setSales] = React.useState("");
  const [kg, setKg] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState("");

  const load = React.useCallback(async (key: string) => {
    const response = await fetch(`${getApiBaseUrl()}/seller-portfolio/goals?month=${key}`, { credentials: "include", cache: "no-store" }).catch(() => null);
    const list = response?.ok ? ((await response.json()) as Goal[]) : [];
    const found = list.find((item) => item.partnerId === partnerId) ?? null;
    setGoal(found);
    setSales(found?.salesTarget ? String(found.salesTarget).replace(".", ",") : "");
    setKg(found?.kgTarget ? String(found.kgTarget).replace(".", ",") : "");
  }, [partnerId]);

  React.useEffect(() => { void load(month); }, [load, month]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const response = await fetch(`${getApiBaseUrl()}/seller-portfolio/goal`, {
      method: "PUT", credentials: "include", headers: { "content-type": "application/json" },
      body: JSON.stringify({ partnerId, month, salesTarget: sales, kgTarget: kg }),
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      const body = response ? await response.json().catch(() => ({})) : {};
      setMessage((body as { message?: string }).message ?? "Não foi possível salvar a meta.");
      return;
    }
    setMessage("Meta salva. Já aparece na tela do vendedor.");
    setOpen(false);
    await load(month);
  };

  return (
    <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2 text-[11px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-emerald-900">
          <Target size={12} className="mr-1 inline" />
          Meta de {label(month)}:{" "}
          {goal && (goal.salesTarget || goal.kgTarget)
            ? [goal.salesTarget ? brl.format(goal.salesTarget) : null, goal.kgTarget ? `${goal.kgTarget.toLocaleString("pt-BR")} kg` : null].filter(Boolean).join(" · ")
            : "a definir"}
        </p>
        <div className="flex items-center gap-2">
          <select aria-label={`Mês da meta de ${partnerName}`} value={month} onChange={(e) => { setMonth(e.target.value); setOpen(false); }} className="rounded-md border border-emerald-200 bg-white px-1.5 py-1 text-[11px]">
            {months.map((key) => <option key={key} value={key}>{label(key)}</option>)}
          </select>
          <button type="button" onClick={() => setOpen((v) => !v)} className="font-bold text-[#087568]">{open ? "Fechar" : goal ? "Alterar" : "Definir"}</button>
        </div>
      </div>
      {open && (
        <form onSubmit={save} className="mt-2 flex flex-wrap items-end gap-2">
          <label className="text-[10px] font-semibold text-stone-600">Vendas (R$)
            <input id={`goal-sales-${partnerId}`} inputMode="decimal" placeholder="Ex.: 15.000" value={sales} onChange={(e) => setSales(e.target.value)} className="mt-0.5 block w-28 rounded-md border border-stone-200 bg-white px-2 py-1.5 text-xs" />
          </label>
          <label className="text-[10px] font-semibold text-stone-600">Volume (kg)
            <input id={`goal-kg-${partnerId}`} inputMode="decimal" placeholder="Ex.: 150" value={kg} onChange={(e) => setKg(e.target.value)} className="mt-0.5 block w-24 rounded-md border border-stone-200 bg-white px-2 py-1.5 text-xs" />
          </label>
          <button type="submit" disabled={busy} className="rounded-md bg-[#087568] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">{busy ? "Salvando…" : "Salvar meta"}</button>
          <span className="w-full text-[10px] text-stone-500">Deixe em branco para tirar a meta.</span>
        </form>
      )}
      {message && <p role="status" className="mt-1 text-[10px] text-emerald-800">{message}</p>}
    </div>
  );
}
