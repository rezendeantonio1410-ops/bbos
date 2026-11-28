"use client";

import { useState } from "react";
import { CalendarClock, RefreshCw } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-url";

function todayInSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/**
 * Nova data de pagamento combinada com o cliente. Só José ou Suzi
 * (o servidor confere). Muda apenas o vencimento e fica no histórico.
 */
export function OrderDueDateChange({ orderId, currentDueDate, onDone }: { orderId: string; currentDueDate: string | null; onDone: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [dueDate, setDueDate] = useState(currentDueDate ? currentDueDate.slice(0, 10) : "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const save = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${getApiBaseUrl()}/sales-orders/${orderId}/due-date`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dueDate, reason }),
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Não foi possível alterar a data.");
      setOpen(false);
      setReason("");
      setMessage(`Nova data de pagamento: ${new Date(`${dueDate}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" })}. Ficou registrada no histórico do pedido.`);
      await onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível alterar a data.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3">
      {!open && (
        <button type="button" onClick={() => { setOpen(true); setMessage(""); }} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 text-xs font-bold text-emerald-900">
          <CalendarClock size={14} /> Alterar data de pagamento
        </button>
      )}
      {open && (
        <div className="space-y-3 rounded-xl border border-emerald-200 bg-white p-3">
          <p className="text-xs font-bold text-stone-800">Nova data combinada com o cliente</p>
          <label className="block text-[11px] font-semibold text-stone-600">Nova data de pagamento
            <input type="date" min={todayInSaoPaulo()} value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1 block w-44 rounded-lg border border-stone-200 px-3 py-2.5 text-sm" />
          </label>
          <label className="block text-[11px] font-semibold text-stone-600">Motivo
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Ex.: cliente pediu para pagar dia 15; combinado por telefone." className="mt-1 block min-h-16 w-full rounded-lg border border-stone-200 p-3 text-xs" />
          </label>
          <p className="text-[10px] text-stone-500">Só José ou Suzi podem confirmar. Muda apenas a data: valor, nota fiscal e entrega continuam iguais.</p>
          {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => { setOpen(false); setError(""); }} className="min-h-10 rounded-xl border px-4 text-xs font-bold text-stone-600">Cancelar</button>
            <button type="button" disabled={busy || !dueDate || reason.trim().length < 10} onClick={() => void save()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-800 px-4 text-xs font-bold text-white disabled:opacity-50">
              {busy ? <RefreshCw size={14} className="animate-spin" /> : <CalendarClock size={14} />} Salvar nova data
            </button>
          </div>
        </div>
      )}
      {message && <p role="status" className="mt-2 text-[11px] font-semibold text-emerald-900">{message}</p>}
    </div>
  );
}
