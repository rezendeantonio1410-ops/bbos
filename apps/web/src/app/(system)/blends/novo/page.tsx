"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Card } from "@bbos/ui";
import { getApiBaseUrl } from "@/lib/api-url";

type Lot = { id: string; code: string; origin?: string; availableQuantityKg: number };
type Component = { coffeeLotId: string; percentage: string };

export default function NewBlendPage() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [lots, setLots] = useState<Lot[]>([]);
  const [components, setComponents] = useState<Component[]>([{ coffeeLotId: "", percentage: "100" }]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => { void fetch(`${getApiBaseUrl()}/production/available-lots`, { credentials: "include", cache: "no-store" }).then((r) => r.ok ? r.json() as Promise<Lot[]> : []).then(setLots).catch(() => setLots([])); }, []);
  const total = useMemo(() => components.reduce((sum, item) => sum + Number(item.percentage || 0), 0), [components]);
  function update(index: number, patch: Partial<Component>) { setComponents((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError("");
    if (Math.abs(total - 100) > 0.01) { setError("A soma dos componentes deve ser 100%."); return; }
    if (components.some((item) => !item.coffeeLotId || Number(item.percentage) <= 0)) { setError("Selecione um lote e uma participação maior que zero para cada componente."); return; }
    const response = await fetch(`${getApiBaseUrl()}/blends`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, code, components: components.map((item) => ({ coffeeLotId: item.coffeeLotId, percentage: Number(item.percentage) })) }) });
    if (!response.ok) { setError("Não foi possível criar o blend. Verifique os lotes liberados e a soma dos percentuais."); return; }
    setSaved(true);
  }
  return <div className="mx-auto max-w-[720px]"><Link href="/blends" className="inline-flex items-center gap-2 text-xs font-semibold text-forest-700"><ArrowLeft size={14} />Voltar para blends</Link><Card className="mt-6 p-6"><h1 className="text-2xl font-bold">Novo blend</h1><p className="mt-2 text-sm text-stone-500">A receita deve somar 100% e usar somente lotes aprovados com saldo.</p><form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-sm font-semibold">Nome<input required value={name} onChange={(e) => setName(e.target.value)} className="mt-2 w-full rounded-xl border p-3" /></label><label className="block text-sm font-semibold">Código<input required value={code} onChange={(e) => setCode(e.target.value)} className="mt-2 w-full rounded-xl border p-3" /></label><div className="space-y-3"><div className="flex items-center justify-between"><p className="text-sm font-semibold">Componentes da receita</p><span className={`text-xs font-bold ${Math.abs(total - 100) < 0.01 ? "text-emerald-700" : "text-amber-700"}`}>{total.toFixed(2)}%</span></div>{components.map((component, index) => <div key={index} className="grid grid-cols-[1fr_110px_36px] gap-2"><select required value={component.coffeeLotId} onChange={(e) => update(index, { coffeeLotId: e.target.value })} className="rounded-xl border p-3 text-sm"><option value="">Selecione um lote aprovado</option>{lots.map((lot) => <option key={lot.id} value={lot.id}>{lot.code} · {lot.origin ?? "origem não informada"} · {lot.availableQuantityKg} kg</option>)}</select><input required type="number" min="0.01" max="100" step="0.01" value={component.percentage} onChange={(e) => update(index, { percentage: e.target.value })} className="rounded-xl border p-3 text-sm" aria-label="Percentual" /><button type="button" aria-label="Remover componente" disabled={components.length === 1} onClick={() => setComponents((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="grid place-items-center rounded-xl border text-stone-500 disabled:opacity-30"><Trash2 size={15} /></button></div>)}<button type="button" onClick={() => setComponents((current) => [...current, { coffeeLotId: "", percentage: "" }])} className="inline-flex items-center gap-2 text-xs font-bold text-forest-800"><Plus size={14} />Adicionar componente</button></div>{error && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{error}</p>}{saved && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Blend criado.</p>}<button className="rounded-xl bg-forest-900 px-4 py-3 text-sm font-bold text-white">Criar blend</button></form></Card></div>;
}
