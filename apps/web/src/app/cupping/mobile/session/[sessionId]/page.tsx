"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Check, ChevronRight, Clock3, RefreshCw, Sparkles } from "lucide-react";
import { cacheCuppingSession, cuppingFetch, CUPPING_API, maskCuppingToken, readCachedCuppingSession, recoverCuppingToken, traceCuppingAccess } from "@/lib/cupping-mobile-access";

const API = CUPPING_API;

export default function MobileSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [data, setData] = React.useState<any>(null);
  const [accessError, setAccessError] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [connectionWarning, setConnectionWarning] = React.useState("");
  const [attempt, setAttempt] = React.useState(0);
  React.useEffect(() => {
    let active = true;
    const token = recoverCuppingToken(sessionId);
    const cached = readCachedCuppingSession<any>(sessionId);
    if (cached) setData(cached);
    if (!token) {
      traceCuppingAccess("session:missing-token", { url: window.location.href, pathname: window.location.pathname, sessionId, hashPresent: Boolean(window.location.hash), apiBase: API });
      setAccessError("Acesso não encontrado. Abra novamente o convite enviado pelo laboratório.");
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    setAccessError("");
    const endpoint = `${API}/cupping/mobile/sessions/${sessionId}`;
    traceCuppingAccess("session:start", { url: window.location.href, pathname: window.location.pathname, sessionId, token: maskCuppingToken(token), endpoint, apiBase: API });
    cuppingFetch(endpoint, {
      headers: { authorization: `Bearer ${token ?? ""}` },
    }, { retries: 1, timeoutMs: 8_000 })
      .then(async (response) => {
        const responseBody = await response.clone().json().catch(() => null);
        traceCuppingAccess("session:response", { status: response.status, endpoint, body: response.ok ? { sessionId: responseBody?.session?.id, participantId: responseBody?.participant?.id } : responseBody });
        if (!response.ok) {
          const body = responseBody;
          throw new Error(body?.message ?? "Não foi possível validar o acesso a esta sessão.");
        }
        return response.json();
      })
      .then((context) => {
        if (!active) return;
        setData(context);
        cacheCuppingSession(sessionId, context);
        setAccessError("");
        setConnectionWarning("");
      })
      .catch((cause) => {
        if (!active) return;
        if (cached) {
          setAccessError("");
          setConnectionWarning("Sem conexão — você pode continuar com os dados salvos neste dispositivo.");
        } else if (cause instanceof DOMException && cause.name === "AbortError") setAccessError("A API demorou para responder. Verifique a rede e tente novamente.");
        else setAccessError(cause instanceof Error ? cause.message : "Não foi possível carregar a sessão.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt, sessionId]);
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
      {data && connectionWarning && <p role="status" className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-xs font-semibold text-amber-800">{connectionWarning}</p>}
      {loading && <div className="mt-8 rounded-3xl bg-white/70 p-6 text-center text-sm text-slate-500"><Sparkles className="mx-auto mb-2 animate-pulse" />Validando acesso…</div>}
      {!loading && !data && accessError && <div className="mt-8 rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center"><p className="text-sm font-black text-rose-800">Não foi possível carregar sua sessão</p><p className="mt-2 text-xs leading-5 text-rose-700">{accessError}</p><button type="button" onClick={() => setAttempt((value) => value + 1)} className="mt-4 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#572f1d] px-5 text-sm font-black text-white"><RefreshCw size={16} /> Tentar novamente</button></div>}
    </main>
  );
}
