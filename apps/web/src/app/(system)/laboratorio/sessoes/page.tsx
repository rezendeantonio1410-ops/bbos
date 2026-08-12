"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import Link from "next/link";
import { Card, Badge } from "@bbos/ui";
import { SensoryWheelHint } from "@/components/sensory-illustrated-wheel";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
export default function SessionsPage() { const [items, setItems] = React.useState<any[]>([]); React.useEffect(() => { fetch(`${API}/laboratory/sessions`).then((r) => r.ok ? r.json() : []).then(setItems).catch(() => setItems([])); }, []); return <div className="mx-auto max-w-[1200px]"><Link href="/laboratorio" className="text-xs font-bold text-forest-700">← Laboratório</Link><h1 className="mt-5 text-3xl font-bold">Sessões de Cupping</h1><p className="mt-2 text-sm text-stone-500">Coordene provas, acompanhe progresso e consolide decisões.</p><div className="mt-6 grid gap-3">{items.length ? items.map((item) => <Link href={`/laboratorio/sessoes/${item.id}`} key={item.id}><Card className="flex items-center justify-between p-5 hover:shadow-md"><div><div className="flex items-center gap-2"><p className="font-bold">{item.code}</p><SensoryWheelHint mode={item.mode === "TRAINING" ? "TRAINING" : "CUPPING"}/></div><p className="mt-1 text-xs text-stone-500">{item.protocol} · {item.samples.length} amostra(s) · {item.participants.length} provador(es)</p></div><Badge tone={item.status === "CLOSED" ? "success" : "warning"}>{item.status}</Badge></Card></Link>) : <Card className="p-10 text-center text-sm text-stone-500">Nenhuma sessão cadastrada.</Card>}</div></div>; }
