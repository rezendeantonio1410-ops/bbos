"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import { Card } from "@bbos/ui";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
export default function CommercialVisitsPage() {
  const [items, setItems] = React.useState<Array<Record<string, any>>>([]);
  React.useEffect(() => { fetch(`${API}/commercial/visits`).then((r) => r.ok ? r.json() : []).then(setItems).catch(() => setItems([])); }, []);
  return <div className="mx-auto max-w-[1500px]"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-forest-700">Comercial</p><h1 className="mt-2 text-3xl font-bold">Agenda e visitas</h1><p className="mt-2 text-sm text-stone-500">Acompanhe os próximos contatos da equipe.</p><Card className="mt-6 overflow-hidden"><div className="grid grid-cols-[1fr_1fr_140px] gap-4 border-b border-stone-200 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-stone-500"><span>Cliente</span><span>Representante</span><span>Status</span></div>{items.length ? items.map((item) => <div key={item.id} className="grid grid-cols-[1fr_1fr_140px] gap-4 border-b border-stone-100 px-5 py-4 text-sm"><span>{item.customer?.name ?? "—"}</span><span>{item.salesPerson?.user?.name ?? "—"}</span><span>{item.status}</span></div>) : <p className="p-8 text-center text-sm text-stone-500">Nenhuma visita cadastrada.</p>}</Card></div>;
}
