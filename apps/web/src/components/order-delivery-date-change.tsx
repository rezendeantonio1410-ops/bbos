"use client";

import { useState } from "react";
import { CalendarClock, RefreshCw } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-url";

function todayInSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/**
 * Remarcar a entrega de um pedido que ainda não saiu. Só José ou Suzi
 * (o servidor confere). Muda apenas a data prevista e fica no histórico.
 */
export function OrderDeliveryDateChange({ orderId, currentDate, onDone }: { orderId: string; currentDate: string | null; onDone: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState(currentDate ? currentDate.slice(0, 10) : "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const save = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${getApiBaseUrl()}/sales-orders/${orderId}/delivery-date`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deliveryDate, reason }),
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Não foi possível remarcar a entrega.");
      setOpen(false);
      setReason("");
      setMessage(`Entrega remarcada para ${new Date(`${deliveryDate}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "UTC" })}. Ficou registrada no histórico do pedido.`);
      await onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível remarcar a entrega.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sm:col-span-2">
      {!open && (
        <button type="button" onClick={() => { setOpen(true); setMessage(""); }} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 text-xs font-bold text-stone-800">
          <CalendarClock size={14} /> Remarcar entrega
        </button>
      )}
      {open && (
        <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-3">
          <p className="text-xs font-bold text-stone-800">Nova data de entrega</p>
          <label className="block text-[11px] font-semibold text-stone-600">Entregar em
            <input type="date" min={todayInSaoPaulo()} value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="mt-1 block w-44 rounded-lg border border-stone-200 px-3 py-2.5 text-sm" />
          </label>
          <label className="block text-[11px] font-semibold text-stone-600">Motivo
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Ex.: data lançada errada; combinado com o cliente para segunda." className="mt-1 block min-h-16 w-full rounded-lg border border-stone-200 p-3 text-xs" />
          </label>
          <p className="text-[10px] text-stone-500">Só José ou Suzi podem confirmar. Muda apenas a data de entrega: valor, cobrança e nota fiscal continuam iguais.</p>
          {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => { setOpen(false); setError(""); }} className="min-h-10 rounded-xl border px-4 text-xs font-bold text-stone-600">Cancelar</button>
            <button type="button" disabled={busy || !deliveryDate || reason.trim().length < 10} onClick={() => void save()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-stone-900 px-4 text-xs font-bold text-white disabled:opacity-50">
              {busy ? <RefreshCw size={14} className="animate-spin" /> : <CalendarClock size={14} />} Salvar nova data
            </button>
          </div>
        </div>
      )}
      {message && <p role="status" className="mt-2 text-[11px] font-semibold text-emerald-900">{message}</p>}
    </div>
  );
}
