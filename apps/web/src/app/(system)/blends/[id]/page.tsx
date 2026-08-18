"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Boxes } from "lucide-react";
import { Card } from "@bbos/ui";
import { getApiBaseUrl } from "@/lib/api-url";

type Blend = { id: string; name: string; code: string; version: number; active: boolean; components?: Array<{ percentage: number; coffeeLot?: { code?: string } }> };
export default function BlendDetail({ params }: { params: Promise<{ id: string }> }) {
  const [blend, setBlend] = useState<Blend | null>(null); const [error, setError] = useState(false);
  useEffect(() => { void params.then(({ id }) => fetch(`${getApiBaseUrl()}/blends/${id}`, { credentials: "include", cache: "no-store" }).then((r) => { if (!r.ok) throw new Error(); return r.json(); }).then(setBlend).catch(() => setError(true))); }, [params]);
  return <div className="mx-auto max-w-[1000px]"><Link href="/blends" className="inline-flex items-center gap-2 text-xs font-semibold text-forest-700"><ArrowLeft size={14} />Voltar para blends</Link>{error && <Card className="mt-6 p-6 text-sm text-red-700">Blend não encontrado.</Card>}{!error && !blend && <Card className="mt-6 p-6 text-sm text-stone-500">Carregando blend…</Card>}{blend && <><header className="mt-6 flex items-center gap-4"><span className="grid size-12 place-items-center rounded-2xl bg-forest-900 text-white"><Boxes size={22} /></span><div><p className="text-xs font-bold uppercase tracking-[.14em] text-forest-700">Blend persistido</p><h1 className="mt-1 text-3xl font-bold">{blend.name}</h1><p className="mt-1 text-sm text-stone-500">{blend.code} · versão {blend.version}</p></div></header><Card className="mt-8 p-6"><h2 className="text-lg font-bold">Componentes</h2><div className="mt-4 space-y-2">{blend.components?.map((component, index) => <div key={`${component.coffeeLot?.code ?? index}`} className="flex justify-between rounded-xl border p-4 text-sm"><span>{component.coffeeLot?.code ?? "Lote"}</span><strong>{component.percentage}%</strong></div>)}</div></Card></>}</div>;
}
