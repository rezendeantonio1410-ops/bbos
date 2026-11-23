"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getApiBaseUrl } from "@/lib/api-url";

const TARGET = "contato@signacoffee.com.br";
const SIGNA_PARTNER_ID = "a550f8fa-9b8d-45ba-8065-ac37dc79c6e4";
const API = getApiBaseUrl();

type Partner = {
  id: string;
  name: string;
  email?: string | null;
  portalEmail?: string | null;
  portalUserId?: string | null;
};

export default function SignaEmailAdministration() {
  const [partner, setPartner] = useState<Partner | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const reload = async () => {
    const response = await fetch(`${API}/storefront/partners`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Acesso administrativo não disponível.");
    const partners = await response.json() as Partner[];
    const signa = partners.find(item => item.id === SIGNA_PARTNER_ID);
    if (!signa) throw new Error("Parceiro Signa não encontrado nesta empresa.");
    setPartner(signa);
  };

  useEffect(() => {
    void reload().catch(cause =>
      setError(cause instanceof Error ? cause.message : "Erro ao carregar a Signa."));
  }, []);

  const update = async () => {
    if (!partner || busy || !partner.portalUserId) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `${API}/storefront/partners/${partner.id}/portal-email`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: TARGET }),
        },
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message ?? "Falha ao atualizar.");
      await reload();
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível atualizar.");
    } finally {
      setBusy(false);
    }
  };

  const correct = partner?.email?.toLowerCase() === TARGET &&
    partner?.portalEmail?.toLowerCase() === TARGET;
  return (
    <main className="mx-auto max-w-2xl space-y-5 p-4 sm:p-8">
      <Link href="/pedidos" className="text-sm font-semibold text-forest-800">
        Voltar ao BBOS
      </Link>
      <div className="rounded-2xl border border-stone-200 bg-white p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-forest-700">
          Administração · Parceiros
        </p>
        <h1 className="mt-2 text-2xl font-bold">Acesso da Signa Coffee</h1>
        <p className="mt-2 text-sm text-stone-600">
          Padronizar e-mail comercial e de login sem criar conta, trocar senha,
          revogar sessões ou alterar pedidos existentes.
        </p>
        <dl className="mt-5 space-y-3 text-sm">
          <div><dt className="font-bold">Parceiro</dt><dd>{partner?.name ?? "Carregando…"}</dd></div>
          <div><dt className="font-bold">E-mail comercial atual</dt><dd>{partner?.email ?? "—"}</dd></div>
          <div><dt className="font-bold">Login atual</dt><dd>{partner?.portalEmail ?? "—"}</dd></div>
          <div><dt className="font-bold">Novo e-mail dos dois cadastros</dt>
            <dd className="font-semibold">{TARGET}</dd></div>
        </dl>
        {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {(correct || saved) && !error && (
          <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
            {correct ? "E-mail comercial e login confirmados." : "Atualização concluída."}
          </p>
        )}
        <button type="button" onClick={() => void update()}
          disabled={!partner || !partner.portalUserId || correct || busy}
          className="mt-5 min-h-11 rounded-xl bg-forest-900 px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? "Atualizando…" : correct ? "E-mails padronizados" : "Atualizar e-mail comercial e login"}
        </button>
      </div>
    </main>
  );
}
