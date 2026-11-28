"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-url";

type Summary = { km: number; totalMinutes: number; customerMinutes: number; drivingMinutes: number; visits: number; visitsWithOrder: number; revenue: number; revenuePerKm: number | null; kmPerVisit: number | null };
type Report = {
  team: Array<{ userId: string; name: string; days: number; lastAt: string }>;
  selected: { userId: string; name: string; span: number } | null;
  totals?: { km: number; visits: number; revenue: number; customerMinutes: number; totalMinutes: number; revenuePerKm: number | null; kmPerVisit: number | null };
  days: Array<{ id: string; status: string; startedAt: string; endedAt: string | null; summary: Summary; insights: string[] }>;
};

const brl = (v: number) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
const hm = (min: number) => `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, "0")}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

/** Liderança: km, tempo com clientes e venda por km de cada vendedor em campo. */
export function FieldTeamReport() {
  const [userId, setUserId] = useState("");
  const [span, setSpan] = useState(7);
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const q = new URLSearchParams({ days: String(span) });
    if (userId) q.set("userId", userId);
    fetch(`${getApiBaseUrl()}/field/report?${q}`, { credentials: "include", cache: "no-store" })
      .then(async (r) => (r.ok ? setData((await r.json()) as Report) : setError("Não foi possível carregar o relatório.")))
      .catch(() => setError("Não foi possível carregar o relatório."));
  }, [userId, span]);

  if (!data) return <p className="flex items-center gap-2 p-6 text-sm text-stone-500">{error || <><RefreshCw size={15} className="animate-spin" /> Carregando…</>}</p>;
  if (!data.team.length) return <p className="rounded-2xl border border-stone-200 bg-white p-6 text-sm text-stone-600">Ainda não há dias registrados. O relatório aparece depois que um vendedor concordar com o texto e tocar em <b>Iniciar dia</b> em Visitas → Meu dia.</p>;

  const t = data.totals;
  const share = t && t.totalMinutes ? Math.round((t.customerMinutes / t.totalMinutes) * 100) : null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={data.selected?.userId ?? ""} onChange={(e) => setUserId(e.target.value)} className="min-h-11 rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold" aria-label="Vendedor">
          {data.team.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
        </select>
        <div className="flex rounded-xl border border-stone-200 bg-white p-1" role="group" aria-label="Período">
          {[[1, "Hoje"], [7, "7 dias"], [30, "30 dias"]].map(([v, l]) => (
            <button key={v} type="button" onClick={() => setSpan(Number(v))} aria-pressed={span === v} className={`min-h-9 rounded-lg px-3 text-sm font-semibold ${span === v ? "bg-stone-950 text-white" : "text-stone-600"}`}>{l}</button>
          ))}
        </div>
      </div>
      {t && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[[`${t.km.toLocaleString("pt-BR")} km`, "rodados"], [String(t.visits), "visitas"], [brl(t.revenue), "vendido nas visitas"], [t.revenuePerKm !== null ? brl(t.revenuePerKm) : "—", "vendido por km"], [share !== null ? `${share}%` : "—", "do tempo com clientes"]].map(([v, l]) => (
            <div key={l} className="rounded-2xl border border-stone-200 bg-white p-4"><b className="block text-2xl tracking-tight">{v}</b><span className="text-xs text-stone-500">{l}</span></div>
          ))}
        </div>
      )}
      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr><th className="px-4 py-2.5">Dia</th><th className="px-3">Km</th><th className="px-3">Em campo</th><th className="px-3">Com clientes</th><th className="px-3">Visitas</th><th className="px-3">Vendido</th><th className="px-3">Leitura</th></tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {data.days.length === 0 && <tr><td colSpan={7} className="px-4 py-4 text-stone-500">Nenhum dia neste período.</td></tr>}
            {[...data.days].reverse().map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-3 font-semibold">{day(d.startedAt)}{d.status !== "ENDED" && <span className="ml-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">em andamento</span>}</td>
                <td className="px-3">{d.summary.km.toLocaleString("pt-BR")}</td>
                <td className="px-3">{hm(d.summary.totalMinutes)}</td>
                <td className="px-3">{hm(d.summary.customerMinutes)}</td>
                <td className="px-3">{d.summary.visits} · {d.summary.visitsWithOrder} c/ pedido</td>
                <td className="px-3">{brl(d.summary.revenue)}</td>
                <td className="px-3 text-stone-600">{d.insights[0] ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
