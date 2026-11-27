"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, FileText, Loader2, Printer, Truck } from "lucide-react";
import { directShipmentAddress, directShipmentStatus, fileSize, type DirectShipment } from "@/lib/direct-shipment";

/** Envio direto do distribuidor dentro do pedido: imprimir etiqueta e documentos, e marcar Postado. */
export function DirectShipmentCard({ orderId, canOperate }: { orderId: string; canOperate: boolean }) {
  const base = `/api/sales-orders/${encodeURIComponent(orderId)}/direct-shipment`;
  const [shipment, setShipment] = useState<DirectShipment | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setShipment(null); setConfirming(false); setError(""); setResult("");
    fetch(base, { credentials: "include", cache: "no-store", signal: controller.signal })
      .then((r) => (r.ok ? r.json() : { shipment: null }))
      .then((body) => { if (!controller.signal.aborted) setShipment(body.shipment ?? null); })
      .catch(() => undefined);
    return () => controller.abort();
  }, [base]);

  if (!shipment) return null;
  const status = directShipmentStatus(shipment);
  const posted = shipment.status === "POSTED";
  const hasLabel = shipment.documents.some((doc) => doc.kind === "LABEL");
  const tone = status.tone === "done" ? "bg-emerald-100 text-emerald-800" : status.tone === "ready" ? "bg-sky-100 text-sky-800" : "bg-amber-100 text-amber-900";

  const markPosted = async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch(`${base}/posted`, { method: "POST", credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.message ?? "Não foi possível marcar como postado.");
      setShipment(body.shipment);
      setConfirming(false);
      const notice = body.shipment?.notice as { to: string; test: boolean } | null | undefined;
      setResult(
        notice
          ? notice.test
            ? `Postado. Aviso de TESTE enviado para ${notice.to} (o cliente final não recebeu).`
            : `Postado. ${shipment.partnerName} avisou o cliente em ${notice.to}.`
          : "Postado.",
      );
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível marcar como postado."); }
    setBusy(false);
  };

  return (
    <section aria-label="Envio direto do parceiro" className="mt-5 rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Truck size={18} className="text-violet-700" aria-hidden />
          <h3 className="text-sm font-semibold">Envio direto · {shipment.partnerName}</h3>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{posted && <CheckCircle2 size={12} aria-hidden />}{status.label}</span>
      </div>
      <p className="mt-1 text-xs text-stone-600">Etiqueta comprada pelo parceiro, em nome dele. A Bispo imprime, cola e posta.</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-white p-3 text-sm">
          <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">Destino</p>
          <p className="mt-0.5 font-semibold">{shipment.recipientName}</p>
          {directShipmentAddress(shipment).map((line) => <p key={line} className="text-xs text-stone-600">{line}</p>)}
        </div>
        <div className="rounded-xl bg-white p-3 text-sm">
          <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">Etiqueta</p>
          <p className="mt-0.5 font-semibold">{shipment.carrier}</p>
          <p className="text-xs text-stone-600">Rastreio <strong className="font-semibold text-stone-900">{shipment.trackingCode}</strong></p>
          <p className="text-xs text-stone-600">{[shipment.volumes ? `${shipment.volumes} volume${shipment.volumes > 1 ? "s" : ""}` : "", shipment.weightKg ? `${String(shipment.weightKg).replace(".", ",")} kg` : ""].filter(Boolean).join(" · ") || "Volumes não informados"}</p>
          <a href={shipment.publicTrackingUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-violet-800 underline underline-offset-2">Acompanhar entrega <ExternalLink size={12} aria-hidden /></a>
        </div>
      </div>

      <div className="mt-3">
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-stone-500">Para imprimir</p>
        {shipment.documents.length === 0
          ? <p className="text-xs text-amber-900">O parceiro ainda não anexou a etiqueta.</p>
          : <ul className="flex flex-wrap gap-2">
              {shipment.documents.map((doc) => (
                <li key={doc.id}>
                  <a href={`${base}/documents/${doc.id}`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-lg border bg-white px-3 text-sm font-medium hover:bg-stone-50">
                    {doc.kind === "LABEL" ? <Printer size={15} aria-hidden /> : <FileText size={15} aria-hidden />}{doc.label}<span className="text-[11px] font-normal text-stone-500">{fileSize(doc.sizeBytes)}</span>
                  </a>
                </li>
              ))}
            </ul>}
      </div>

      <p className="mt-3 text-xs text-stone-600">
        {shipment.notifyEndCustomer
          ? shipment.notifiedTo ? `Aviso “a caminho” enviado para ${shipment.notifiedTo}.` : `Ao postar, o cliente recebe o aviso em nome de ${shipment.partnerName}.`
          : "O parceiro não pediu aviso ao cliente final."}
      </p>
      {posted && <p className="mt-1 text-xs font-medium text-emerald-800">Postado{shipment.postedAt ? ` em ${new Date(shipment.postedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}` : ""}{shipment.postedByName ? ` por ${shipment.postedByName}` : ""}.</p>}
      {result && <p role="status" className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900">{result}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}

      {!posted && canOperate && (
        confirming ? (
          <div className="mt-3 rounded-xl border border-violet-200 bg-white p-3">
            <p className="text-sm font-medium">Confirma que a etiqueta foi colada e o pacote entregue à transportadora?</p>
            {shipment.notifyEndCustomer && <p className="mt-1 text-xs text-stone-600">O aviso “Seu pedido está a caminho” será enviado.</p>}
            <div className="mt-2 flex gap-2">
              <button type="button" disabled={busy} onClick={markPosted} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-violet-700 px-4 text-sm font-semibold text-white disabled:opacity-60">{busy && <Loader2 size={14} className="animate-spin" aria-hidden />}Sim, foi postado</button>
              <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="min-h-10 rounded-lg border px-4 text-sm">Voltar</button>
            </div>
          </div>
        ) : (
          <button type="button" disabled={!hasLabel} onClick={() => setConfirming(true)} title={hasLabel ? undefined : "Falta a etiqueta do parceiro"} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-violet-700 px-4 text-sm font-semibold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50">
            <CheckCircle2 size={15} aria-hidden /> Marcar como postado
          </button>
        )
      )}
    </section>
  );
}
