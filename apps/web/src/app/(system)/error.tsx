"use client";

import { useEffect } from "react";

export default function SystemError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("BBOS system render error", error);
  }, [error]);

  return (
    <main className="grid min-h-[60vh] place-items-center px-6 py-12">
      <section className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#087568]">
          BBOS · Recuperação
        </p>
        <h1 className="mt-2 text-xl font-bold text-stone-950">
          Esta tela não conseguiu concluir o carregamento.
        </h1>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          Sua sessão e seus dados não foram alterados. O BBOS pode tentar carregar esta área novamente.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-xl bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Tentar novamente
          </button>
          <button
            type="button"
            onClick={() => window.location.assign("/home")}
            className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700"
          >
            Voltar ao início
          </button>
        </div>
        {error.digest ? (
          <p className="mt-4 text-[10px] text-stone-400">Referência: {error.digest}</p>
        ) : null}
      </section>
    </main>
  );
}
