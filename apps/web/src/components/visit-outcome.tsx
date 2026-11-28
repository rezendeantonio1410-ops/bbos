"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getApiBaseUrl } from "@/lib/api-url";
import { WhatsButton } from "@/components/whatsapp-sheet";
import { visitPayload, NO_ORDER_REASONS, RETURN_IN_DAYS, type VisitChoice } from "@/lib/visit-outcome";

/**
 * "Como foi?" ao chegar no cliente: registra a visita em 1 toque.
 * Fez pedido → registra e abre o pedido; Sem pedido → motivo; Voltar em… → agenda o retorno.
 */
export function VisitOutcome({ customer, phone, onDone }: { customer: { id: string; name: string }; phone: string | null; onDone: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<"ask" | "noorder" | "later" | "saved">("ask");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<VisitChoice | null>(null);

  const save = async (choice: VisitChoice) => {
    setBusy(true);
    setError("");
    const position = await new Promise<GeolocationPosition | null>((resolve) => {
      if (typeof navigator === "undefined" || !("geolocation" in navigator)) return resolve(null);
      navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { maximumAge: 120_000, timeout: 4_000 });
    });
    const body = visitPayload(choice, new Date(), position ? { lat: position.coords.latitude, lng: position.coords.longitude } : null);
    const r = await fetch(`${getApiBaseUrl()}/customers/${encodeURIComponent(customer.id)}/visits`, {
      method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    }).catch(() => null);
    setBusy(false);
    if (!r?.ok) {
      const b = r ? ((await r.json().catch(() => ({}))) as { message?: string }) : {};
      return setError(b.message ?? "Não foi possível registrar a visita. Tente de novo.");
    }
    setSaved(choice);
    if (choice.kind === "ORDER") return router.push(`/pedidos?novo=1&cliente=${encodeURIComponent(customer.id)}`);
    setStep("saved");
  };

  const chip = "min-h-11 rounded-xl border border-stone-200 bg-white px-3 text-[13px] font-bold disabled:opacity-50";
  return (
    <section className="mt-2.5 rounded-[22px] border-2 border-emerald-500 bg-white p-4" aria-live="polite">
      {step === "saved" ? (
        <>
          <p className="text-[11px] font-extrabold uppercase tracking-[.1em] text-emerald-700">✓ Visita registrada</p>
          <p className="mt-1 text-[15px] font-bold">{customer.name}</p>
          <p className="text-[13px] text-stone-500">{saved?.kind === "LATER" ? `Retorno agendado em ${saved.days} dias.` : "Fica no histórico do cliente e na sua BI."}</p>
          <div className="mt-2.5 flex gap-1.5">
            <WhatsButton target={{ customerId: customer.id, customerName: customer.name, phone, kinds: ["THANKS", "RESTOCK", "FREE"] }} label="Mandar mensagem" />
            <button type="button" onClick={onDone} className={chip}>Fechar</button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[11px] font-extrabold uppercase tracking-[.1em] text-emerald-700">Você está no cliente</p>
          <p className="mt-1 text-lg font-bold">Como foi no {customer.name}?</p>
          {step === "ask" && (
            <div className="mt-2.5 grid grid-cols-3 gap-1.5">
              <button type="button" disabled={busy} onClick={() => void save({ kind: "ORDER" })} className="min-h-[52px] rounded-xl bg-emerald-500 text-[14px] font-extrabold text-emerald-950 disabled:opacity-50">🛒 Fez pedido</button>
              <button type="button" disabled={busy} onClick={() => setStep("noorder")} className={chip}>Sem pedido</button>
              <button type="button" disabled={busy} onClick={() => setStep("later")} className={chip}>Voltar em…</button>
            </div>
          )}
          {step === "noorder" && (<>
            <p className="mt-2 text-[13px] text-stone-500">Por quê? (1 toque)</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {NO_ORDER_REASONS.map((reason) => <button key={reason} type="button" disabled={busy} onClick={() => void save({ kind: "NO_ORDER", reason })} className={chip}>{reason}</button>)}
            </div>
          </>)}
          {step === "later" && (<>
            <p className="mt-2 text-[13px] text-stone-500">Voltar daqui a:</p>
            <div className="mt-1.5 flex gap-1.5">
              {RETURN_IN_DAYS.map((days) => <button key={days} type="button" disabled={busy} onClick={() => void save({ kind: "LATER", days })} className={`${chip} flex-1`}>{days} dias</button>)}
            </div>
          </>)}
          {step !== "ask" && <button type="button" onClick={() => setStep("ask")} className="mt-2 text-[13px] font-bold text-stone-500">← voltar</button>}
          {error && <p role="alert" className="mt-2 rounded-xl bg-red-50 p-2.5 text-[13px] text-red-700">{error}</p>}
          <p className="mt-2 text-[11.5px] text-stone-400">O tempo no cliente é contado sozinho pelo GPS do dia.</p>
        </>
      )}
    </section>
  );
}
