"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge, Card } from "@bbos/ui";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
const score = (value: unknown) => Number.isFinite(Number(value)) ? Number(value).toFixed(2).replace(".", ",") : "—";

export default function CuppingSessionResultPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = React.useState<any>(null);
  React.useEffect(() => { fetch(`${API}/laboratory/sessions/${id}?reveal=true`).then((response) => response.ok ? response.json() : null).then(setSession); }, [id]);
  if (!session) return <p className="text-sm text-stone-500">Carregando consolidação…</p>;
  return <div className="mx-auto max-w-[1100px] pb-10">
    <Link href={`/laboratorio/sessoes/${id}`} className="text-xs font-bold text-forest-700">← Sessão {session.code}</Link>
    <h1 className="mt-5 text-3xl font-bold">Resultado por amostra</h1>
    <p className="mt-2 text-sm text-stone-500">Cada café mantém resultados, provadores e decisão independentes.</p>
    <div className="mt-6 space-y-6">{session.samples?.map((membership: any) => {
      const rows = (session.evaluations ?? []).filter((evaluation: any) => evaluation.sampleId === membership.sampleId);
      const completed = rows.filter((evaluation: any) => evaluation.status === "COMPLETED");
      const scores = completed.map((evaluation: any) => Number(evaluation.finalScore ?? evaluation.totalScore)).filter(Number.isFinite);
      const average = scores.length ? scores.reduce((sum: number, value: number) => sum + value, 0) / scores.length : null;
      const decision = session.decisions?.find((item: any) => item.sampleId === membership.sampleId);
      return <Card key={membership.sampleId} className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-forest-700">Amostra</p><h2 className="mt-1 text-xl font-bold">{membership.sample.sampleCode}</h2><p className="mt-1 text-xs text-stone-500">Lote {membership.sample.lot?.code ?? "—"}</p></div>{decision && <Badge tone="success">{decision.decision}</Badge>}</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3"><div><small>Média</small><strong className="mt-1 block text-2xl">{score(average)}</strong></div><div><small>Mínimo</small><strong className="mt-1 block text-2xl">{scores.length ? score(Math.min(...scores)) : "—"}</strong></div><div><small>Máximo</small><strong className="mt-1 block text-2xl">{scores.length ? score(Math.max(...scores)) : "—"}</strong></div></div>
        <div className="mt-4 space-y-2">{rows.map((evaluation: any) => { const participant = session.participants?.find((item: any) => item.id === evaluation.participantId); return <div key={evaluation.id} className="flex items-center justify-between rounded-xl border border-stone-200 p-3 text-xs"><span><strong>{participant?.user?.name ?? "Provador"}</strong><span className="ml-2 text-stone-500">{evaluation.status}</span></span><strong>{evaluation.status === "COMPLETED" ? score(evaluation.finalScore ?? evaluation.totalScore) : "Pendente"}</strong></div>; })}</div>
      </Card>;
    })}</div>
  </div>;
}
