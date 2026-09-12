"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Link2, RefreshCw } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-url";

type ApprovalHistory = {
  id: string;
  status: string;
  expiresAt: string;
  createdByName?: string | null;
  createdAt: string;
  acceptedByName?: string | null;
  acceptedAt?: string | null;
};

export function OrderCustomerApprovalActions({ orderId }: { orderId: string }) {
  const [history, setHistory] = useState<ApprovalHistory[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");

  const base = `${getApiBaseUrl()}/sales-order-approvals`;

  const load = async () => {
    const response = await fetch(`${base}/${orderId}/history`, {
      credentials: "include",
      cache: "no-store",
    });
    if (response.ok) setHistory(await response.json());
  };

  useEffect(() => { void load(); }, [orderId]);

  const generate = async () => {
    setBusy(true);
    setMessage("");
    const response = await fetch(`${base}/${orderId}/link`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ expiresInDays: 7 }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.message ?? "Não foi possível gerar o link de aprovação.");
      setBusy(false);
      return;
    }
    const publicLink = `${window.location.origin}${payload.path}`;
    setLink(publicLink);
    try {
      await navigator.clipboard.writeText(publicLink);
      setMessage("Link gerado e copiado. Válido por 7 dias.");
    } catch {
      setMessage("Link gerado. Copie o endereço abaixo para enviar ao cliente.");
    }
    await load();
    setBusy(false);
  };

  const latest = history[0];
  const approved = latest?.status === "APPROVED";

  return (
    <section className="mt-4 rounded-2xl border border-violet-100 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700">Aprovação do cliente</p>
          <p className="mt-1 text-xs text-stone-500">Gere um link seguro da versão exata deste pedido.</p>
        </div>
        {approved ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-800"><CheckCircle2 size={13}/> Aprovado</span>
        ) : (
          <button disabled={busy} onClick={() => void generate()} className="inline-flex items-center gap-2 rounded-xl bg-stone-950 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">
            {busy ? <RefreshCw size={13} className="animate-spin"/> : <Link2 size={13}/>} {latest?.status === "PENDING" ? "Gerar novo link" : "Gerar link de aprovação"}
          </button>
        )}
      </div>

      {link && <input readOnly value={link} onFocus={(event) => event.currentTarget.select()} className="mt-3 w-full rounded-xl border bg-stone-50 px-3 py-2.5 text-[11px] text-stone-600" />}
      {message && <p className="mt-2 text-[10px] text-stone-500">{message}</p>}

      {latest && (
        <div className="mt-3 border-t pt-3 text-[10px] text-stone-500">
          {latest.status === "APPROVED"
            ? <>Aprovado por <strong>{latest.acceptedByName}</strong>{latest.acceptedAt ? ` em ${new Date(latest.acceptedAt).toLocaleString("pt-BR")}` : ""}.</>
            : latest.status === "PENDING"
              ? <>Link ativo até {new Date(latest.expiresAt).toLocaleDateString("pt-BR")}.</>
              : <>Último link: {latest.status.toLowerCase()}.</>}
        </div>
      )}
    </section>
  );
}
