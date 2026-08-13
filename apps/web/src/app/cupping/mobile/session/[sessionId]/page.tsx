"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Check, ChevronRight, Clock3, Sparkles } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

export default function MobileSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [data, setData] = React.useState<any>(null);
  React.useEffect(() => {
    const token = sessionStorage.getItem(`cupping-token:${sessionId}`);
    fetch(`${API}/cupping/mobile/sessions/${sessionId}`, {
      headers: { authorization: `Bearer ${token ?? ""}` },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then(setData);
  }, [sessionId]);
  const progressBySample = new Map(
    (data?.progress?.samples ?? []).map((item: any) => [item.sampleId, item]),
  );
  const complete = data?.progress?.overall?.state === "COMPLETED";

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-20">
      <p className="text-xs font-black uppercase tracking-[.18em] text-fuchsia-600">Cupping mobile</p>
      <h1 className="mt-2 text-3xl font-black">{data?.session?.code ?? "Carregando sessão…"}</h1>
      <p className="mt-2 text-sm text-slate-600">{data ? `${data.participant.name} · ${data.session.protocol}` : "Sua prova privada e rastreável."}</p>
      {complete && (
        <div className="mt-7 rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6 text-center">
          <Check className="mx-auto text-emerald-700" size={34} />
          <h2 className="mt-3 text-xl font-black text-emerald-950">Sua sessão está concluída</h2>
          <p className="mt-2 text-sm text-emerald-800">Todas as amostras atribuídas foram finalizadas.</p>
        </div>
      )}
      <div className="mt-7 space-y-3">
        {data?.session?.samples?.map((item: any, index: number) => {
          const progress: any = progressBySample.get(item.sample.id);
          const state = progress?.state ?? "NOT_STARTED";
          const target = state === "COMPLETED"
            ? `/cupping/mobile/session/${sessionId}/sample/${item.sample.id}/result`
            : `/cupping/mobile/session/${sessionId}/sample/${item.sample.id}/aroma`;
          return (
            <Link key={item.sample.id} href={target} className="flex min-h-24 items-center justify-between rounded-[2rem] bg-white/80 p-5 shadow-md">
              <span>
                <small className="font-bold text-fuchsia-600">Amostra {String(index + 1).padStart(2, "0")}</small>
                <strong className="mt-1 block text-lg">{item.sample.sampleCode}</strong>
                <span className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
                  {state === "COMPLETED" ? <Check size={13} /> : <Clock3 size={13} />}
                  {state === "COMPLETED" ? "Concluída" : state === "IN_PROGRESS" ? "Em andamento" : "Não iniciada"}
                </span>
              </span>
              <span className="grid size-12 place-items-center rounded-full bg-fuchsia-100 text-fuchsia-600"><ChevronRight /></span>
            </Link>
          );
        })}
      </div>
      {!data && <div className="mt-8 rounded-3xl bg-white/70 p-6 text-center text-sm text-slate-500"><Sparkles className="mx-auto mb-2 animate-pulse" />Validando acesso…</div>}
    </main>
  );
}
