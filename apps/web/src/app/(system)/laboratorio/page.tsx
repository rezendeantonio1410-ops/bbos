"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@bbos/ui";
import { LabKpiCard, LabQueueTable, LabQualityDecisionSummary, LabSensoryIntelligence, LabSessionCard, type LabQueueItem } from "@/components/laboratory-dashboard";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
type Dashboard = { receivedToday: number; awaitingProof: number; inAnalysis: number; approved: number; pending: number; queue: LabQueueItem[]; activeSession: { id: string } | null; sessions: React.ComponentProps<typeof LabSessionCard>["session"][]; decisions: React.ComponentProps<typeof LabQualityDecisionSummary>["data"] & { recent: unknown[] }; sensory: React.ComponentProps<typeof LabSensoryIntelligence>["sensory"] };
const empty: Dashboard = { receivedToday: 0, awaitingProof: 0, inAnalysis: 0, approved: 0, pending: 0, queue: [], activeSession: null, sessions: [], decisions: { approved: 0, retest: 0, blocked: 0, awaiting: 0, recent: [] }, sensory: { sessionsConsidered: 0, scores: null, descriptors: [], acidityTypes: [] } };
const navigation = [["Visão Geral", "/laboratorio"], ["Amostras", "/laboratorio/lotes"], ["Sessões", "/laboratorio/sessoes"], ["Resultados", "/laboratorio/sessoes?status=CLOSED"], ["Perfis sensoriais", "/laboratorio/perfis"]] as const;

export default function LaboratoryPage() {
  const [data, setData] = React.useState<Dashboard>(empty);
  React.useEffect(() => { fetch(`${API}/laboratory/dashboard`).then((response) => response.ok ? response.json() : null).then((value) => value && setData(value)).catch(() => setData(empty)); }, []);
  return <div className="mx-auto max-w-[1500px] pb-10"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-forest-700">Operação de qualidade</p><h1 className="mt-2 text-3xl font-bold">Laboratório</h1><p className="mt-2 text-sm text-stone-500">Amostras, cupping e decisões sensoriais rastreáveis.</p></div><Link href="/laboratorio/sessoes/nova" className="rounded-xl bg-forest-900 px-4 py-2.5 text-xs font-bold text-white">Nova sessão</Link></header>
    <nav className="mt-5 flex gap-2 overflow-x-auto border-b border-stone-200 pb-3 text-xs font-semibold">{navigation.map(([label,href]) => <Link key={href} href={href} className={`whitespace-nowrap rounded-lg px-3 py-2 ${href === "/laboratorio" ? "bg-forest-50 text-forest-800" : "text-stone-500 hover:bg-stone-50"}`}>{label}</Link>)}</nav>
    <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><LabKpiCard label="Amostras recebidas hoje" value={data.receivedToday} href="/laboratorio/lotes?period=today"/><LabKpiCard label="Aguardando prova" value={data.awaitingProof} href="/laboratorio/lotes?status=PENDING"/><LabKpiCard label="Em análise" value={data.inAnalysis} href="/laboratorio/sessoes?status=active"/><LabKpiCard label="Aprovados" value={data.approved} href="/laboratorio/sessoes?decision=approved"/><LabKpiCard label="Reanálise / Pendentes" value={data.pending} href="/laboratorio/sessoes?decision=pending" attention={data.pending > 0}/></section>
    <section className="mt-6"><LabQueueTable items={data.queue} activeSession={data.activeSession}/></section>
    <section className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_.9fr]"><Card className="p-5"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-forest-700">Sessões</p><h2 className="mt-1 text-lg font-bold">Sessões recentes</h2></div><Link href="/laboratorio/sessoes" className="text-xs font-bold text-forest-700">Ver sessões <ArrowRight className="inline" size={13}/></Link></div>{data.sessions.length ? <div className="mt-4 space-y-3">{data.sessions.map((session) => <LabSessionCard key={session.id} session={session}/>)}</div> : <div className="mt-4 rounded-xl border border-dashed p-7 text-center"><p className="text-sm font-semibold">Nenhuma sessão registrada ainda.</p><Link href="/laboratorio/sessoes/nova" className="mt-3 inline-flex text-xs font-bold text-forest-700">Nova sessão →</Link></div>}</Card><LabQualityDecisionSummary data={data.decisions}/></section>
    <section className="mt-6"><LabSensoryIntelligence sensory={data.sensory}/></section>
  </div>;
}
