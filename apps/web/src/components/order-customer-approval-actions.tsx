"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Copy, Eye, MessageCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-url";

type ApprovalHistory = {
  id: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  viewedAt?: string | null;
  acceptedByName?: string | null;
  acceptedAt?: string | null;
  destinationMasked?: string | null;
  verificationRequired?: boolean;
};

type GeneratedLink = {
  url: string;
  whatsappUrl?: string | null;
  message: string;
  destinationMasked?: string | null;
  verificationRequired: boolean;
  confirmationCode?: string | null;
};

export function OrderCustomerApprovalActions({ orderId, onAccepted }: { orderId: string; onAccepted?: () => void | Promise<void> }) {
  const [history, setHistory] = useState<ApprovalHistory[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [generated, setGenerated] = useState<GeneratedLink | null>(null);
  const acceptedNotified = useRef(false);
  const base = `${getApiBaseUrl()}/sales-order-approvals`;

  const load = async () => {
    const response = await fetch(`${base}/${orderId}/history`, { credentials: "include", cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json();
    setHistory(payload);
    if (payload[0]?.status === "APPROVED" && !acceptedNotified.current) {
      acceptedNotified.current = true;
      await onAccepted?.();
    }
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 8000);
    return () => window.clearInterval(timer);
  }, [orderId]);

  const generate = async () => {
    const response = await fetch(`${base}/${orderId}/link`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ expiresInDays: 7 }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message ?? "Não foi possível gerar a confirmação.");
    setGenerated(payload);
    await load();
    return payload as GeneratedLink;
  };

  const sendWhatsApp = async () => {
    setBusy(true);
    setMessage("");
    const popup = window.open("", "_blank");
    try {
      const payload = await generate();
      if (payload.whatsappUrl) {
        if (popup) popup.location.href = payload.whatsappUrl;
        else window.location.href = payload.whatsappUrl;
        setMessage(`Mensagem pronta para ${payload.destinationMasked ?? "o cliente"}.`);
      } else {
        popup?.close();
        await navigator.clipboard.writeText(payload.message);
        setMessage("O cliente não possui WhatsApp cadastrado. Mensagem e link copiados.");
      }
    } catch (cause) {
      popup?.close();
      setMessage(cause instanceof Error ? cause.message : "Não foi possível preparar o envio.");
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    setBusy(true);
    setMessage("");
    try {
      const payload = generated ?? await generate();
      await navigator.clipboard.writeText(payload.url);
      setMessage("Link seguro copiado.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Não foi possível copiar o link.");
    } finally {
      setBusy(false);
    }
  };

  const latest = history[0];
  const approved = latest?.status === "APPROVED";
  const viewed = latest?.status === "VIEWED";

  return (
    <section className="mt-4 rounded-2xl border border-violet-100 bg-violet-50/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-700"><ShieldCheck size={13}/> Confirmação do cliente</p><p className="mt-1 text-xs text-stone-600">Pedido provisório até o cliente aprovar esta versão.</p></div>
        {approved && <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-[10px] font-bold text-emerald-800"><CheckCircle2 size={13}/> Confirmado</span>}
        {!approved && viewed && <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-[10px] font-bold text-blue-700"><Eye size={13}/> Cliente visualizou</span>}
      </div>

      {!approved && <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button disabled={busy} onClick={() => void sendWhatsApp()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#075E54] px-4 py-3 text-xs font-bold text-white disabled:opacity-50">{busy ? <RefreshCw size={14} className="animate-spin"/> : <MessageCircle size={15}/>} Enviar pelo WhatsApp</button>
        <button disabled={busy} onClick={() => void copyLink()} className="inline-flex items-center justify-center gap-2 rounded-xl border bg-white px-4 py-3 text-xs font-bold text-stone-700 disabled:opacity-50"><Copy size={14}/> Copiar link</button>
      </div>}

      {generated?.verificationRequired && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[10px] text-amber-800">Por ser um pedido de R$ 10.000 ou mais, a mensagem inclui um código de seis dígitos.</p>}
      {message && <p className="mt-2 text-[10px] text-stone-600">{message}</p>}
      {latest && <div className="mt-3 border-t pt-3 text-[10px] text-stone-500">{approved ? <>Confirmado por <strong>{latest.acceptedByName}</strong>{latest.acceptedAt ? ` em ${new Date(latest.acceptedAt).toLocaleString("pt-BR")}` : ""}.</> : viewed ? <>O cliente abriu o pedido{latest.viewedAt ? ` em ${new Date(latest.viewedAt).toLocaleString("pt-BR")}` : ""}. Aguardando confirmação.</> : <>Link ativo até {new Date(latest.expiresAt).toLocaleDateString("pt-BR")}{latest.destinationMasked ? ` · enviado para final ${latest.destinationMasked.slice(-4)}` : ""}.</>}</div>}
    </section>
  );
}
