"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Boxes, Plus } from "lucide-react";
import { Card } from "@bbos/ui";
import { getApiBaseUrl } from "@/lib/api-url";

type Blend = { id: string; name: string; code: string; version: number; active: boolean; components?: Array<{ percentage: number; coffeeLot?: { code?: string } }> };

export default function BlendsPage() {
  const [blends, setBlends] = useState<Blend[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    void fetch(`${getApiBaseUrl()}/blends`, { credentials: "include", cache: "no-store" })
      .then((response) => { if (!response.ok) throw new Error(); return response.json() as Promise<Blend[]>; })
      .then((rows) => { setBlends(rows); setState("ready"); })
      .catch(() => setState("error"));
  }, []);
  return <div className="mx-auto max-w-[1480px]">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[.16em] text-forest-700">Catálogo industrial</p><h1 className="mt-2 text-3xl font-bold">Blends</h1><p className="mt-2 text-sm text-stone-500">Composições e versões baseadas em lotes liberados.</p></div>
      <Link href="/blends/novo" className="inline-flex items-center gap-2 rounded-xl bg-forest-900 px-4 py-3 text-xs font-bold text-white"><Plus size={15} />Novo blend</Link>
    </header>
    {state === "error" && <Card className="mt-8 border-red-200 bg-red-50 p-6 text-sm text-red-700">Não foi possível carregar os blends da empresa.</Card>}
    {state === "loading" && <Card className="mt-8 p-8 text-sm text-stone-500">Carregando blends…</Card>}
    {state === "ready" && blends.length === 0 && <Card className="mt-8 border-dashed p-12 text-center"><Boxes className="mx-auto text-forest-700" size={30} /><h2 className="mt-4 text-lg font-bold">Nenhum blend cadastrado</h2><p className="mt-2 text-sm text-stone-500">Crie o primeiro blend usando lotes liberados pela Qualidade.</p><Link href="/blends/novo" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-forest-900 px-4 py-3 text-xs font-bold text-white">Criar primeiro blend <ArrowRight size={14} /></Link></Card>}
    {blends.length > 0 && <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{blends.map((blend) => <Link key={blend.id} href={`/blends/${blend.id}`}><Card className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-lg"><div className="flex items-start justify-between"><span className="grid size-10 place-items-center rounded-xl bg-forest-50 text-forest-800"><Boxes size={18} /></span><span className="text-xs font-semibold text-stone-500">v{blend.version}</span></div><h2 className="mt-5 text-lg font-bold">{blend.name}</h2><p className="mt-1 text-xs text-stone-500">{blend.code} · {blend.active ? "Ativo" : "Inativo"}</p><p className="mt-4 text-xs text-stone-500">{blend.components?.length ?? 0} componentes</p></Card></Link>)}</section>}
  </div>;
}
