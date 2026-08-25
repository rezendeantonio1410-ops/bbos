"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

/** Compatibilidade com convites antigos: o aceite público atual é a fonte de verdade. */
export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  useEffect(() => { if (token) router.replace(`/cupping/sessao/${token}`); }, [router, token]);
  return <main className="grid min-h-screen place-items-center p-6 text-sm text-slate-600">Abrindo sua sessão de cupping…</main>;
}
