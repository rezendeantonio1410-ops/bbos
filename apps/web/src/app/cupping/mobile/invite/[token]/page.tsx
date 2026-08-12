"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { LoaderCircle, Sparkles } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [accessError, setAccessError] = React.useState("");

  React.useEffect(() => {
    fetch(`${API}/cupping/invitations/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
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
        sessionStorage.setItem(
          `cupping-token:${data.sessionId}`,
          data.accessToken,
        );
        sessionStorage.setItem(
          `cupping-participant:${data.sessionId}`,
          data.participantId,
        );
        router.replace(`/cupping/mobile/session/${data.sessionId}`);
      })
      .catch((error) => setAccessError(error.message));
  }, [router, token]);

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
          </>
        ) : (
          <p className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-500">
            <LoaderCircle className="animate-spin" size={17} />
            Preparando sua experiência sensorial…
          </p>
        )}
      </section>
    </main>
  );
}
