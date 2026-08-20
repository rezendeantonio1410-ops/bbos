"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Card } from "@bbos/ui";
import { getApiBaseUrl } from "@/lib/api-url";

type Lot = { id: string; code: string; status?: string };
export default function NewBlendPage() {
  const [name, setName] = useState(""); const [code, setCode] = useState(""); const [lotId, setLotId] = useState(""); const [lots, setLots] = useState<Lot[]>([]); const [error, setError] = useState(""); const [saved, setSaved] = useState(false);
  useEffect(() => { void fetch(`${getApiBaseUrl()}/inventory/lots`, { credentials: "include", cache: "no-store" }).then((r) => r.ok ? r.json() : []).then((rows: Lot[]) => setLots(rows.filter((row) => row.status === "APPROVED"))); }, []);
  async function submit(event: React.FormEvent) { event.preventDefault(); setError(""); if (!lotId) { setError("Selecione um lote liberado."); return; } const response = await fetch(`${getApiBaseUrl()}/blends`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, code, components: [{ coffeeLotId: lotId, percentage: 100 }] }) }); if (!response.ok) { setError("Não foi possível criar o blend com o lote selecionado."); return; } setSaved(true); }
  return <div className="mx-auto max-w-[720px]"><Link href="/blends" className="inline-flex items-center gap-2 text-xs font-semibold text-forest-700"><ArrowLeft size={14} />Voltar para blends</Link><Card className="mt-6 p-6"><h1 className="text-2xl font-bold">Novo blend</h1><p className="mt-2 text-sm text-stone-500">A composição deve ser formada por lotes liberados e somar 100%.</p><form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-sm font-semibold">Nome<input required value={name} onChange={(e) => setName(e.target.value)} className="mt-2 w-full rounded-xl border p-3" /></label><label className="block text-sm font-semibold">Código<input required value={code} onChange={(e) => setCode(e.target.value)} className="mt-2 w-full rounded-xl border p-3" /></label><label className="block text-sm font-semibold">Lote liberado<select required value={lotId} onChange={(e) => setLotId(e.target.value)} className="mt-2 w-full rounded-xl border p-3"><option value="">Selecione</option>{lots.map((lot) => <option key={lot.id} value={lot.id}>{lot.code}</option>)}</select></label>{error && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{error}</p>}{saved && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Blend criado.</p>}<button className="rounded-xl bg-forest-900 px-4 py-3 text-sm font-bold text-white">Criar blend</button></form></Card></div>;
}
