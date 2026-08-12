"use client";
import * as React from "react";
import Link from "next/link";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
type Promotion = { id: string; name: string; description?: string | null; status: string; promotionalPrice?: number | null; discountPercent?: number | null };
export default function CommercialPromotionsPage() {
  const [promotions, setPromotions] = React.useState<Promotion[]>([]);
  React.useEffect(() => { fetch(`${API}/commerce/promotions`).then((r) => r.ok ? r.json() : []).then(setPromotions).catch(() => setPromotions([])); }, []);
  return <div className="mx-auto max-w-[1500px]"><div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-forest-700">Comercial</p><h1 className="mt-2 text-3xl font-bold">Promoções</h1><p className="mt-2 text-sm text-stone-500">Campanhas vigentes, agendadas e encerradas.</p></div><Link href="/comercial" className="text-xs font-bold text-forest-700">Voltar ao Comercial</Link></div><div className="mt-6 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">{promotions.length ? <div className="divide-y divide-stone-100">{promotions.map((promotion) => <div key={promotion.id} className="flex flex-wrap items-center justify-between gap-3 p-5"><div><p className="font-bold">{promotion.name}</p><p className="mt-1 text-xs text-stone-500">{promotion.description ?? "Campanha comercial"}</p></div><div className="flex items-center gap-4 text-xs"><span>{promotion.status}</span><strong>{promotion.promotionalPrice != null ? `R$ ${Number(promotion.promotionalPrice).toFixed(2)}` : promotion.discountPercent ? `${promotion.discountPercent}%` : "Condição especial"}</strong></div></div>)}</div> : <div className="p-12 text-center text-sm text-stone-500">Nenhuma promoção cadastrada.</div>}</div></div>;
}
