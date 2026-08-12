"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card } from "@bbos/ui";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

export default function CuppingSessionResultPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = React.useState<any>(null);
  React.useEffect(() => { fetch(`${API}/laboratory/sessions/${id}?reveal=true`).then((r) => r.ok ? r.json() : null).then(setSession); }, [id]);
  if (!session) return <p className="text-sm text-stone-500">Carregando consolidação…</p>;
  const scores = (session.evaluations ?? []).map((evaluation: any) => Number(evaluation.totalScore)).filter(Number.isFinite);
  const average = scores.length ? scores.reduce((sum: number, value: number) => sum + value, 0) / scores.length : null;
  return <div className="mx-auto max-w-[1100px] pb-10"><Link href={`/laboratorio/sessoes/${id}`} className="text-xs font-bold text-forest-700">← Sessão {session.code}</Link><h1 className="mt-5 text-3xl font-bold">Resultado consolidado</h1><p className="mt-2 text-sm text-stone-500">Resultados individuais permanecem identificados; a média não substitui a decisão do responsável.</p><div className="mt-6 grid gap-3 sm:grid-cols-3"><Card className="p-5"><small>Média</small><strong className="mt-2 block text-3xl">{average?.toFixed(2).replace(".", ",") ?? "—"}</strong></Card><Card className="p-5"><small>Mínimo</small><strong className="mt-2 block text-3xl">{scores.length ? Math.min(...scores).toFixed(2).replace(".", ",") : "—"}</strong></Card><Card className="p-5"><small>Máximo</small><strong className="mt-2 block text-3xl">{scores.length ? Math.max(...scores).toFixed(2).replace(".", ",") : "—"}</strong></Card></div><div className="mt-5 space-y-3">{session.evaluations?.map((evaluation: any) => { const participant = session.participants?.find((item: any) => item.id === evaluation.participantId); const sample = session.samples?.find((item: any) => item.sampleId === evaluation.sampleId); return <Card key={evaluation.id} className="p-5"><div className="flex justify-between gap-4"><div><strong>{sample?.sample?.sampleCode ?? "Amostra"}</strong><p className="mt-1 text-xs text-stone-500">{participant?.user?.name ?? "Provador"} · {evaluation.status}</p></div><strong className="text-2xl">{evaluation.totalScore?.toFixed?.(2).replace(".", ",") ?? "—"}</strong></div><p className="mt-3 text-xs text-stone-600">Descritores: {evaluation.descriptorSelections?.map((item: any) => item.descriptor ?? item.subfamily ?? item.family).join(" · ") || "—"}</p><p className="mt-2 text-xs text-stone-600">Acidez: {evaluation.acidityType ?? "—"} · Corpo: {evaluation.bodyType ?? "—"}</p></Card>; })}</div></div>;
}
