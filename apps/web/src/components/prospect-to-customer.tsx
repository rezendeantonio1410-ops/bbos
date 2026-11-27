"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { CheckCircle2, Loader2, UserPlus, X } from "lucide-react";
import {
  customerDraftFromProspect,
  missingForCustomer,
  parseMoneyInput,
  type CustomerDraft,
  type ProspectSource,
} from "@/lib/prospect-to-customer";

const TERMS = ["7 dias", "14 dias", "21 dias", "28 dias", "30 dias", "45 dias", "60 dias"];
const input = "mt-1 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none focus:border-stone-900";
const label = "block text-xs font-semibold text-stone-600";

async function send<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(data?.message) ? data.message.join(" ") : data?.message || "Não foi possível concluir.");
  return data as T;
}

/**
 * Botão "Transformar em cliente": cria o cliente com os dados que a visita já
 * levantou, liga o prospect a ele e, se marcado, já pede o crédito. Se o CNPJ
 * já estiver cadastrado, só liga o prospect ao cliente existente.
 */
export function ProspectToCustomer({
  prospectId, prospect, customerId, onConverted,
}: { prospectId: string; prospect: ProspectSource; customerId?: string | null; onConverted: (customerId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CustomerDraft>(() => customerDraftFromProspect(prospect));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ customerId: string; credit: boolean; existing: boolean } | null>(null);

  if (customerId)
    return (
      <Link href={`/clientes?cliente=${encodeURIComponent(customerId)}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-800">
        <CheckCircle2 size={16} /> Já é cliente · abrir
      </Link>
    );

  const set = <K extends keyof CustomerDraft>(key: K, value: CustomerDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const missing = missingForCustomer(draft);

  const submit = async () => {
    if (missing.length) { setError(`Falta: ${missing.join(", ")}.`); return; }
    setBusy(true);
    setError("");
    try {
      let id: string | null = null;
      let existing = false;
      try {
        const created = await send<{ id: string }>("/api/customers", {
          name: draft.tradeName || draft.legalName,
          tradeName: draft.tradeName,
          legalName: draft.legalName,
          taxId: draft.taxId,
          countryCode: "BR",
          email: draft.email,
          phone: draft.phone,
          postalCode: draft.postalCode,
          address: draft.address,
          addressNumber: draft.addressNumber,
          addressComplement: draft.addressComplement,
          district: draft.district,
          city: draft.city,
          state: draft.state.toUpperCase(),
          stateRegistrationType: draft.stateRegistrationType,
          stateRegistration: draft.stateRegistration,
          segment: prospect.segment ?? undefined,
          paymentTerms: draft.askCredit ? draft.requestedTerms : "À vista",
        });
        id = created.id;
      } catch (cause) {
        // CNPJ já cadastrado: liga o prospect ao cliente que já existe.
        if (!(cause instanceof Error) || !/já cadastrado/i.test(cause.message)) throw cause;
        existing = true;
      }
      const linked = await send<{ customerId: string }>(`/api/prospects/${encodeURIComponent(prospectId)}/convert`, id ? { customerId: id } : { taxId: draft.taxId });
      const finalId = id ?? linked.customerId;
      let credit = false;
      if (draft.askCredit) {
        await send(`/api/customers/${encodeURIComponent(finalId)}/credit-request`, {
          requestedLimit: parseMoneyInput(draft.requestedLimit),
          requestedTerms: draft.requestedTerms,
          monthlyVolume: draft.monthlyVolume ? parseMoneyInput(draft.monthlyVolume) : undefined,
          rationale: draft.rationale,
        });
        credit = true;
      }
      setDone({ customerId: finalId, credit, existing });
      onConverted(finalId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível transformar em cliente.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => { setDraft(customerDraftFromProspect(prospect)); setDone(null); setError(""); setOpen(true); }} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800">
        <UserPlus size={16} /> Transformar em cliente
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/30 sm:items-center" onClick={(event) => { if (event.target === event.currentTarget && !busy) setOpen(false); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="to-customer-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="to-customer-title" className="text-lg font-bold">Transformar {prospect.name} em cliente</h2>
                <p className="text-sm text-stone-500">Os dados vêm da visita. Confira, complete o que faltar e confirme.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} disabled={busy} aria-label="Fechar" className="grid size-10 place-items-center rounded-xl hover:bg-stone-100"><X size={18} /></button>
            </div>

            {done ? (
              <div className="mt-5 space-y-3">
                <p className="flex items-start gap-2 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                  <span>
                    {done.existing ? "O CNPJ já estava cadastrado: o prospect foi ligado ao cliente existente." : `${prospect.name} agora é cliente.`}
                    {done.credit ? " O pedido de crédito foi enviado para a liderança aprovar." : ""}
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/clientes?cliente=${encodeURIComponent(done.customerId)}`} className="inline-flex min-h-11 items-center rounded-xl bg-stone-900 px-4 text-sm font-semibold text-white">Abrir cliente</Link>
                  <Link href="/pedidos?novo=1" className="inline-flex min-h-11 items-center rounded-xl border border-stone-200 px-4 text-sm font-semibold">Fazer o primeiro pedido</Link>
                </div>
              </div>
            ) : (
              <form className="mt-4 space-y-5" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
                <fieldset className="grid gap-3 sm:grid-cols-2">
                  <legend className="mb-1 text-xs font-bold uppercase tracking-wider text-stone-500">Empresa</legend>
                  <label className={label}>Nome fantasia<input className={input} value={draft.tradeName} onChange={(e) => set("tradeName", e.target.value)} /></label>
                  <label className={label}>Razão social<input className={input} value={draft.legalName} onChange={(e) => set("legalName", e.target.value)} /></label>
                  <label className={label}>CNPJ ou CPF<input className={input} value={draft.taxId} onChange={(e) => set("taxId", e.target.value.toUpperCase())} /></label>
                  <label className={label}>Inscrição estadual
                    <select className={input} value={draft.stateRegistrationType} onChange={(e) => set("stateRegistrationType", e.target.value as CustomerDraft["stateRegistrationType"])}>
                      <option value="EXEMPT">Isento</option>
                      <option value="NUMBER">Tem inscrição</option>
                      <option value="NON_TAXPAYER">Não contribuinte</option>
                    </select>
                  </label>
                  {draft.stateRegistrationType === "NUMBER" && <label className={label}>Número da inscrição<input className={input} inputMode="numeric" value={draft.stateRegistration} onChange={(e) => set("stateRegistration", e.target.value)} /></label>}
                  <label className={label}>Telefone<input className={input} inputMode="tel" value={draft.phone} onChange={(e) => set("phone", e.target.value)} /></label>
                  <label className={label}>E-mail (para NF e boleto)<input className={input} type="email" value={draft.email} onChange={(e) => set("email", e.target.value)} /></label>
                </fieldset>

                <fieldset className="grid gap-3 sm:grid-cols-6">
                  <legend className="mb-1 text-xs font-bold uppercase tracking-wider text-stone-500">Endereço de entrega e nota</legend>
                  <label className={`${label} sm:col-span-2`}>CEP<input className={input} inputMode="numeric" value={draft.postalCode} onChange={(e) => set("postalCode", e.target.value)} /></label>
                  <label className={`${label} sm:col-span-4`}>Rua<input className={input} value={draft.address} onChange={(e) => set("address", e.target.value)} /></label>
                  <label className={`${label} sm:col-span-2`}>Número<input className={input} value={draft.addressNumber} onChange={(e) => set("addressNumber", e.target.value)} /></label>
                  <label className={`${label} sm:col-span-4`}>Complemento<input className={input} value={draft.addressComplement} onChange={(e) => set("addressComplement", e.target.value)} /></label>
                  <label className={`${label} sm:col-span-2`}>Bairro<input className={input} value={draft.district} onChange={(e) => set("district", e.target.value)} /></label>
                  <label className={`${label} sm:col-span-3`}>Cidade<input className={input} value={draft.city} onChange={(e) => set("city", e.target.value)} /></label>
                  <label className={`${label} sm:col-span-1`}>UF<input className={input} maxLength={2} value={draft.state} onChange={(e) => set("state", e.target.value.toUpperCase())} /></label>
                </fieldset>

                <fieldset className="space-y-3 rounded-2xl bg-stone-50 p-4">
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" className="mt-0.5 size-4" checked={draft.askCredit} onChange={(e) => set("askCredit", e.target.checked)} />
                    <span><b>Pedir crédito agora</b><span className="block text-xs text-stone-500">Vai para a liderança aprovar. Sem crédito, o cliente compra à vista.</span></span>
                  </label>
                  {draft.askCredit && (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className={label}>Limite pedido (R$)<input className={input} inputMode="decimal" placeholder="Ex.: 2.000" value={draft.requestedLimit} onChange={(e) => set("requestedLimit", e.target.value)} /></label>
                      <label className={label}>Prazo de pagamento
                        <select className={input} value={draft.requestedTerms} onChange={(e) => set("requestedTerms", e.target.value)}>{TERMS.map((t) => <option key={t}>{t}</option>)}</select>
                      </label>
                      <label className={label}>Compra por mês (R$, estimado)<input className={input} inputMode="decimal" value={draft.monthlyVolume} onChange={(e) => set("monthlyVolume", e.target.value)} /></label>
                      <label className={`${label} sm:col-span-3`}>Justificativa (veio da visita)<textarea className={`${input} min-h-24 py-2`} value={draft.rationale} onChange={(e) => set("rationale", e.target.value)} /></label>
                    </div>
                  )}
                </fieldset>

                {missing.length > 0 && <p className="text-sm text-amber-800">Falta: {missing.join(", ")}.</p>}
                {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                <div className="flex flex-wrap gap-2">
                  <button type="submit" disabled={busy || missing.length > 0} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white disabled:opacity-50">
                    {busy && <Loader2 size={16} className="animate-spin" />} {draft.askCredit ? "Criar cliente e pedir crédito" : "Criar cliente"}
                  </button>
                  <button type="button" onClick={() => setOpen(false)} disabled={busy} className="min-h-11 rounded-xl border border-stone-200 px-4 text-sm font-semibold">Cancelar</button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
