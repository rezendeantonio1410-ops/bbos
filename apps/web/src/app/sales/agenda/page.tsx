"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import Link from "next/link";
import { currentUser } from "@/lib/current-user";
import { salesDesktopRoutes as routes } from "@/lib/sales-routes";
import { SalesEmptyState, SalesPageHeader } from "@/components/sales-components";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

export default function SalesAgenda() {
  const [items, setItems] = React.useState<any[]>([]);
  React.useEffect(() => { fetch(`${API}/commercial/visits?status=SCHEDULED`, { headers: { "x-user-id": currentUser.id } }).then((r) => r.ok ? r.json() : []).then(setItems).catch(() => setItems([])); }, []);
  return <main className="min-h-screen bg-[#F7F7F5] px-5 py-7"><div className="mx-auto max-w-7xl"><SalesPageHeader title="Agenda / Visitas" description="Organize seus compromissos, visitas e próximos contatos." action={{ label: "+ Nova visita", href: routes.agenda }} /><div className="mt-6 flex flex-wrap gap-2"><button className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-800">Hoje</button><button className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-bold text-stone-600">Semana</button><button className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-bold text-stone-600">Mês</button></div>{items.length ? <section className="mt-5 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"><div className="grid grid-cols-[100px_1fr_1fr_1fr_140px] gap-4 border-b border-stone-100 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-stone-500"><span>Horário</span><span>Tipo</span><span>Cliente</span><span>Objetivo</span><span>Status</span></div>{items.map((item) => <Link key={item.id} href={`${routes.clients}/${item.customerId}`} className="grid grid-cols-[100px_1fr_1fr_1fr_140px] gap-4 border-b border-stone-100 px-5 py-4 text-sm transition hover:bg-stone-50"><span className="font-bold text-blue-700">{new Date(item.scheduledAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span><span>Visita</span><span className="font-semibold">{item.customer?.name ?? "Cliente"}</span><span className="text-stone-500">{item.purpose ?? "Contato comercial"}</span><span className="text-xs font-bold text-amber-700">{item.status ?? "Agendada"}</span></Link>)}</section> : <div className="mt-5"><SalesEmptyState title="Sua agenda está livre hoje." description="Você pode aproveitar para visitar clientes ou trabalhar sua carteira." primaryAction={{ label: "+ Agendar visita", href: routes.agenda }} secondaryAction={{ label: "Ver clientes que precisam de atenção", href: `${routes.clients}?filter=attention` }} /></div>}</div></main>;
}
