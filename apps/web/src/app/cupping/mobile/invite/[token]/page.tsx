"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Compatibilidade com convites antigos: o aceite público atual é a fonte de verdade. */
export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [error, setError] = useState("");
  useEffect(() => {
    if (!token) return;
    fetch(`/api/cupping-public/public/${token}/mobile`)
      .then(async (response) => { if (!response.ok) throw new Error("Este convite não está disponível."); return response.json() as Promise<{ sessionId: string; sessionSampleId?: string; participantId?: string; completed?: boolean }>; })
      .then(({ sessionId, sessionSampleId, participantId, completed }) => {
        if (completed) { setError("Sessão concluída ✓"); return; }
        const query = new URLSearchParams({ invite: token, ...(sessionSampleId ? { sessionSampleId } : {}), ...(participantId ? { participantId } : {}) });
        router.replace(`/cupping/mobile/session/${sessionId}?${query.toString()}`);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Não foi possível abrir o convite."));
  }, [router, token]);
  return <main className="grid min-h-screen place-items-center p-6 text-sm text-slate-600">{error || "Abrindo sua sessão de cupping…"}</main>;
}
