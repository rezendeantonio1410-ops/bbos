"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { LoaderCircle, RefreshCw, Sparkles } from "lucide-react";
import { cuppingFetch, CUPPING_API, maskCuppingToken, persistCuppingAccess, traceCuppingAccess } from "@/lib/cupping-mobile-access";

const API = CUPPING_API;

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [accessError, setAccessError] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setAccessError("");
    const endpoint = `${API}/cupping/invitations/accept`;
    traceCuppingAccess("invite:start", { url: window.location.href, pathname: window.location.pathname, token: maskCuppingToken(token), endpoint, apiBase: API });
    cuppingFetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    }, { retries: 0, timeoutMs: 8_000 })
      .then(async (response) => {
        traceCuppingAccess("invite:response", { status: response.status, endpoint });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(
            body?.message ??
              "Este convite não é válido. Solicite um novo acesso ao responsável pelo laboratório.",
          );
        }
        return response.json();
      })
      .then((data) => {
        if (!active) return;
        traceCuppingAccess("invite:accepted", { sessionId: data.sessionId, participantId: data.participantId, token: maskCuppingToken(data.accessToken) });
        persistCuppingAccess(data.sessionId, data.accessToken, data.participantId);
        router.replace(`/cupping/mobile/session/${data.sessionId}#access=${encodeURIComponent(data.accessToken)}`);
      })
      .catch((cause) => {
        if (!active) return;
        if (cause instanceof DOMException && cause.name === "AbortError") setAccessError("A API demorou para responder. Verifique a rede e tente novamente.");
        else setAccessError(cause instanceof Error ? cause.message : "Não foi possível validar este convite.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt, router, token]);

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <section className="w-full max-w-sm rounded-[2rem] bg-white/80 p-8 text-center shadow-xl backdrop-blur">
        <Sparkles className="mx-auto text-fuchsia-500" />
        <h1 className="mt-4 text-2xl font-black">Seu cupping está pronto</h1>
        {accessError ? (
          <>
            <p className="mt-3 text-sm font-bold text-rose-700">
              Não foi possível validar seu acesso
            </p>
            <p className="mt-2 text-xs text-slate-600">{accessError}</p>
            <button type="button" onClick={() => setAttempt((value) => value + 1)} className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#572f1d] px-5 text-sm font-black text-white"><RefreshCw size={16} /> Tentar novamente</button>
          </>
        ) : loading ? (
          <p className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-500">
            <LoaderCircle className="animate-spin" size={17} />
            Preparando sua experiência sensorial…
          </p>
        ) : null}
      </section>
    </main>
  );
}
