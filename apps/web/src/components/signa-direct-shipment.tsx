"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, FileText, Loader2, PackageCheck, Paperclip, Send, Trash2, Truck } from "lucide-react";
import { lookupBrazilianCep } from "@/lib/brazil-address";
import {
  DOCUMENT_KIND_OPTIONS,
  directShipmentAddress,
  directShipmentStatus,
  fileSize,
  formatPostalCode,
  type DirectShipment,
} from "@/lib/direct-shipment";

type Form = {
  recipientName: string; recipientTaxId: string; recipientEmail: string; recipientPhone: string;
  postalCode: string; street: string; number: string; complement: string; district: string; city: string; state: string;
  carrier: string; trackingCode: string; trackingUrl: string; volumes: string; weightKg: string; notifyEndCustomer: boolean;
};

const EMPTY: Form = {
  recipientName: "", recipientTaxId: "", recipientEmail: "", recipientPhone: "", postalCode: "", street: "", number: "",
  complement: "", district: "", city: "", state: "", carrier: "", trackingCode: "", trackingUrl: "", volumes: "", weightKg: "",
  notifyEndCustomer: false,
};

function toForm(s: DirectShipment): Form {
  return {
    recipientName: s.recipientName, recipientTaxId: s.recipientTaxId ?? "", recipientEmail: s.recipientEmail ?? "",
    recipientPhone: s.recipientPhone ?? "", postalCode: formatPostalCode(s.postalCode), street: s.street, number: s.number,
    complement: s.complement ?? "", district: s.district ?? "", city: s.city, state: s.state, carrier: s.carrier,
    trackingCode: s.trackingCode, trackingUrl: s.trackingUrl ?? "", volumes: s.volumes ? String(s.volumes) : "",
    weightKg: s.weightKg ? String(s.weightKg).replace(".", ",") : "", notifyEndCustomer: s.notifyEndCustomer,
  };
}

const input = "mt-1 min-h-10 w-full rounded-lg border border-[#e2e2dd] bg-white px-3 text-sm outline-none focus:border-[#25734c] focus:ring-2 focus:ring-[#25734c]/15";
const label = "block text-[11px] font-medium text-[#55554f]";

/** Envio direto no portal do distribuidor: cliente final, etiqueta própria e documentos. */
export function SignaDirectShipment({ orderId, orderStatus }: { orderId: string; orderStatus: string }) {
  const base = `/api/partner-portal/orders/${encodeURIComponent(orderId)}/direct-shipment`;
  const [shipment, setShipment] = useState<DirectShipment | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [kind, setKind] = useState<string>("LABEL");
  const [cepBusy, setCepBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoaded(false); setShipment(null); setEditing(false); setError("");
    fetch(base, { credentials: "include", cache: "no-store", signal: controller.signal })
      .then((r) => (r.ok ? r.json() : { shipment: null }))
      .then((body) => { if (!controller.signal.aborted) { setShipment(body.shipment ?? null); setLoaded(true); } })
      .catch(() => { if (!controller.signal.aborted) setLoaded(true); });
    return () => controller.abort();
  }, [base]);

  const set = (key: keyof Form, value: string | boolean) => setForm((f) => ({ ...f, [key]: value }));

  const findCep = async (value: string) => {
    if (value.replace(/\D/g, "").length !== 8) return;
    setCepBusy(true);
    try {
      const found = await lookupBrazilianCep(value);
      if (found) setForm((f) => ({ ...f, street: found.address || f.street, district: found.district || f.district, city: found.city, state: found.state }));
    } catch { /* o endereço pode ser digitado à mão */ }
    setCepBusy(false);
  };

  const save = async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch(base, {
        method: "PUT", credentials: "include", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, volumes: form.volumes || null, weightKg: form.weightKg || null }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.message ?? "Não foi possível salvar o envio.");
      setShipment(body.shipment); setEditing(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar o envio."); }
    setBusy(false);
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setError("");
    try {
      const data = new FormData();
      data.append("kind", kind);
      data.append("file", file);
      const response = await fetch(`${base}/documents`, { method: "POST", credentials: "include", body: data });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.message ?? "Não foi possível anexar o arquivo.");
      setShipment(body.shipment);
      if (kind === "LABEL") setKind("INVOICE");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível anexar o arquivo."); }
    setBusy(false);
  };

  const remove = async (documentId: string) => {
    setBusy(true); setError("");
    const response = await fetch(`${base}/documents/${encodeURIComponent(documentId)}`, { method: "DELETE", credentials: "include" });
    const body = await response.json().catch(() => ({}));
    if (response.ok) setShipment(body.shipment); else setError(body?.message ?? "Não foi possível remover.");
    setBusy(false);
  };

  if (!loaded || orderStatus === "CANCELLED") return null;
  const posted = shipment?.status === "POSTED";

  if (!shipment && !editing) {
    return (
      <section aria-label="Envio direto" className="rounded-xl border border-dashed border-[#bcd8c6] bg-[#f3f9f5] p-4">
        <div className="flex items-start gap-3">
          <Truck size={20} className="mt-0.5 shrink-0 text-[#25734c]" aria-hidden />
          <div className="flex-1">
            <h3 className="font-display text-sm font-semibold">Enviar direto para o meu cliente</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-[#55554f]">Você compra a etiqueta no seu Melhor Envio; a Bispo imprime, cola e posta em seu nome a partir de Londrina.</p>
            <button type="button" onClick={() => { setForm(EMPTY); setEditing(true); }} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#25734c] px-4 text-sm font-semibold text-white hover:bg-[#1d5c3d]">Preencher envio</button>
          </div>
        </div>
      </section>
    );
  }

  if (editing) {
    return (
      <section aria-label="Envio direto" className="space-y-4 rounded-xl border border-[#d9e6dd] p-4">
        <h3 className="font-display text-sm font-semibold">Envio direto · para quem vai o café</h3>
        <fieldset className="grid grid-cols-2 gap-3">
          <legend className="sr-only">Cliente final</legend>
          <label className={`${label} col-span-2`}>Nome ou razão social *<input className={input} value={form.recipientName} onChange={(e) => set("recipientName", e.target.value)} /></label>
          <label className={label}>CPF ou CNPJ<input className={input} inputMode="numeric" value={form.recipientTaxId} onChange={(e) => set("recipientTaxId", e.target.value)} /></label>
          <label className={label}>Telefone<input className={input} inputMode="tel" value={form.recipientPhone} onChange={(e) => set("recipientPhone", e.target.value)} /></label>
          <label className={`${label} col-span-2`}>E-mail do cliente<input className={input} type="email" value={form.recipientEmail} onChange={(e) => set("recipientEmail", e.target.value)} /></label>
        </fieldset>
        <fieldset className="grid grid-cols-6 gap-3">
          <legend className="mb-1 text-[11px] font-semibold uppercase tracking-[.12em] text-[#6b6b66]">Endereço de entrega</legend>
          <label className={`${label} col-span-3`}>CEP *
            <span className="relative block"><input className={input} inputMode="numeric" value={form.postalCode} onChange={(e) => { const v = formatPostalCode(e.target.value); set("postalCode", v); void findCep(v); }} />
            {cepBusy && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[#8a8a84]" aria-label="Buscando CEP" />}</span>
          </label>
          <label className={`${label} col-span-3`}>Número *<input className={input} value={form.number} onChange={(e) => set("number", e.target.value)} /></label>
          <label className={`${label} col-span-6`}>Rua *<input className={input} value={form.street} onChange={(e) => set("street", e.target.value)} /></label>
          <label className={`${label} col-span-3`}>Complemento<input className={input} value={form.complement} onChange={(e) => set("complement", e.target.value)} /></label>
          <label className={`${label} col-span-3`}>Bairro<input className={input} value={form.district} onChange={(e) => set("district", e.target.value)} /></label>
          <label className={`${label} col-span-4`}>Cidade *<input className={input} value={form.city} onChange={(e) => set("city", e.target.value)} /></label>
          <label className={`${label} col-span-2`}>UF *<input className={input} maxLength={2} value={form.state} onChange={(e) => set("state", e.target.value.toUpperCase())} /></label>
        </fieldset>
        <fieldset className="grid grid-cols-2 gap-3">
          <legend className="mb-1 text-[11px] font-semibold uppercase tracking-[.12em] text-[#6b6b66]">Etiqueta que você comprou</legend>
          <label className={label}>Transportadora *<input className={input} placeholder="Ex.: LATAM Cargo, Jadlog" value={form.carrier} onChange={(e) => set("carrier", e.target.value)} /></label>
          <label className={label}>Código de rastreio *<input className={input} value={form.trackingCode} onChange={(e) => set("trackingCode", e.target.value)} /></label>
          <label className={label}>Volumes<input className={input} inputMode="numeric" value={form.volumes} onChange={(e) => set("volumes", e.target.value.replace(/\D/g, ""))} /></label>
          <label className={label}>Peso total (kg)<input className={input} inputMode="decimal" value={form.weightKg} onChange={(e) => set("weightKg", e.target.value)} /></label>
          <label className={`${label} col-span-2`}>Link de rastreio (opcional)<input className={input} placeholder="https://…" value={form.trackingUrl} onChange={(e) => set("trackingUrl", e.target.value)} /></label>
        </fieldset>
        <label className="flex items-start gap-2 rounded-lg bg-[#f7f7f4] p-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-[#25734c]" checked={form.notifyEndCustomer} onChange={(e) => set("notifyEndCustomer", e.target.checked)} />
          <span><strong className="font-semibold">Avisar meu cliente por e-mail</strong><span className="block text-xs text-[#6b6b66]">Quando a Bispo postar, ele recebe “Seu pedido está a caminho” em nome da sua empresa, com o rastreio.</span></span>
        </label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={save} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#25734c] px-4 text-sm font-semibold text-white disabled:opacity-60">{busy && <Loader2 size={14} className="animate-spin" aria-hidden />}Salvar envio</button>
          <button type="button" disabled={busy} onClick={() => { setEditing(false); setError(""); }} className="min-h-10 rounded-lg border border-[#e2e2dd] px-4 text-sm">Cancelar</button>
        </div>
      </section>
    );
  }

  const s = shipment!;
  const status = directShipmentStatus(s);
  const tone = status.tone === "done" ? "bg-[#e7f3ec] text-[#1d5c3d]" : status.tone === "ready" ? "bg-[#eef4ff] text-[#1e40af]" : "bg-[#fff4e5] text-[#9a3412]";
  return (
    <section aria-label="Envio direto" className="space-y-3 rounded-xl border border-[#d9e6dd] p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-sm font-semibold">Envio direto para o seu cliente</h3>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{posted ? <CheckCircle2 size={12} aria-hidden /> : <PackageCheck size={12} aria-hidden />}{status.label}</span>
      </div>
      <div className="text-sm">
        <p className="font-medium">{s.recipientName}</p>
        {directShipmentAddress(s).map((line) => <p key={line} className="text-xs text-[#55554f]">{line}</p>)}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#55554f]">
        <span>{s.carrier} · <strong className="font-semibold text-[#0A0A0A]">{s.trackingCode}</strong></span>
        {s.volumes ? <span>{s.volumes} volume{s.volumes > 1 ? "s" : ""}</span> : null}
        {s.weightKg ? <span>{String(s.weightKg).replace(".", ",")} kg</span> : null}
        <a href={s.publicTrackingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-[#25734c] underline underline-offset-2">Acompanhar entrega <ExternalLink size={12} aria-hidden /></a>
      </div>
      <p className="text-xs text-[#6b6b66]">
        {s.notifyEndCustomer
          ? s.notifiedAt ? <><Send size={12} className="mr-1 inline" aria-hidden />Aviso enviado ao seu cliente.</> : "Seu cliente será avisado por e-mail quando a Bispo postar."
          : "Seu cliente não será avisado por e-mail."}
      </p>
      {posted && s.postedByName && <p className="text-xs text-[#1d5c3d]">Postado pela Bispo ({s.postedByName}).</p>}

      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.12em] text-[#6b6b66]">Documentos para a Bispo imprimir</p>
        {s.documents.length === 0 && <p className="text-xs text-[#9a3412]">Anexe a etiqueta (PDF) para a Bispo conseguir postar.</p>}
        <ul className="space-y-1.5">
          {s.documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-2 rounded-lg border border-[#ececE7] px-3 py-2 text-sm">
              <FileText size={15} className="shrink-0 text-[#6b6b66]" aria-hidden />
              <a href={`${base}/documents/${doc.id}`} target="_blank" rel="noreferrer" className="flex-1 truncate hover:underline"><strong className="font-semibold">{doc.label}</strong> · {doc.fileName}</a>
              <span className="text-[11px] text-[#8a8a84]">{fileSize(doc.sizeBytes)}</span>
              {!posted && <button type="button" disabled={busy} onClick={() => remove(doc.id)} aria-label={`Remover ${doc.label}`} className="grid size-8 place-items-center rounded-md text-[#8a8a84] hover:bg-red-50 hover:text-red-700"><Trash2 size={14} aria-hidden /></button>}
            </li>
          ))}
        </ul>
        {!posted && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Tipo do documento" className="min-h-10 rounded-lg border border-[#e2e2dd] bg-white px-2 text-sm">
              {DOCUMENT_KIND_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <label className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-[#e2e2dd] px-3 text-sm font-medium hover:bg-[#f7f7f4] ${busy ? "pointer-events-none opacity-60" : ""}`}>
              {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Paperclip size={15} aria-hidden />} Anexar PDF ou imagem
              <input type="file" accept="application/pdf,image/png,image/jpeg" className="sr-only" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
          </div>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!posted && <button type="button" onClick={() => { setForm(toForm(s)); setEditing(true); }} className="text-sm font-medium text-[#25734c] underline underline-offset-2">Corrigir dados do envio</button>}
    </section>
  );
}
