"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button, Card } from "@bbos/ui";
import { getApiBaseUrl } from "@/lib/api-url";

const API = getApiBaseUrl();
type Purchase = { id: string; purchaseNumber: string; process?: string | null; contractedScreen?: string | null; maxMoisturePercent?: number | null; expectedAt?: string | null; pricePerKg?: number | null; totalValue: number; qualityCategory?: string | null; additionalSpecification?: string | null; returnReason?: string | null; correctionRequest?: string | null };
const input = "mt-1 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none focus:border-forest-700";

export default function EditPurchase({ params }: { params: Promise<{ id: string }> }) {
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitIntent, setSubmitIntent] = useState(false);
  const [values, setValues] = useState({ process: "", screen: "", moisture: "", expectedAt: "", price: "" });

  useEffect(() => {
    void params.then(({ id }) => fetch(`${API}/green-coffee-purchases/${id}`, { credentials: "include" }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setPurchase(data);
    }).catch((cause) => setError(cause.message ?? "Falha ao carregar.")));
  }, [params]);

  async function save(event: FormEvent<HTMLFormElement>, submit = false) {
    event.preventDefault();
    if (!purchase) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API}/green-coffee-purchases/${purchase.id}`, { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({
        process: form.get("process"), contractedScreen: form.get("contractedScreen"), maxMoisturePercent: form.get("maxMoisturePercent") ? Number(form.get("maxMoisturePercent")) : null,
        expectedAt: form.get("expectedAt") ? new Date(String(form.get("expectedAt"))).toISOString() : null, pricePerKg: form.get("pricePerKg") ? Number(form.get("pricePerKg")) : null, additionalSpecification: form.get("additionalSpecification"),
      }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      if (submit) {
        const submitResponse = await fetch(`${API}/green-coffee-purchases/${purchase.id}/submit`, { method: "PATCH", credentials: "include" });
        const submitData = await submitResponse.json();
        if (!submitResponse.ok) throw new Error(submitData.message ?? "Campos faltantes.");
      }
      setMessage(submit ? "Enviado para aprovação." : "Rascunho salvo.");
      if (submit) window.location.href = `/compras-cafe-verde/${purchase.id}`;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao salvar.");
    } finally { setBusy(false); }
  }

  if (!purchase) return <div className="mx-auto max-w-3xl text-sm text-stone-500">{error || "Carregando…"}</div>;
  const quality = (purchase.qualityCategory ?? "").toUpperCase();
  const special = ["ESPECIAL", "GOURMET", "SPECIAL"].some((value) => quality.includes(value));
  const missing = [
    !values.expectedAt && !purchase.expectedAt ? "Data/período de entrega" : "",
    !values.process && !purchase.process ? "Processo" : "",
    special && !values.screen && !purchase.contractedScreen ? "Peneira" : "",
    special && !values.moisture && purchase.maxMoisturePercent == null ? "Umidade máxima" : "",
    !values.price && !purchase.pricePerKg && !purchase.totalValue ? "Preço ou valor total" : "",
  ].filter(Boolean);
  const returned = Boolean(purchase.returnReason);
  const current = (field: keyof typeof values, fallback?: string | number | null) => values[field] || fallback || "";

  return <div className="mx-auto max-w-4xl">
    <Link href={`/compras-cafe-verde/${purchase.id}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-forest-700"><ArrowLeft size={16} />Voltar para ficha</Link>
    <h1 className="mt-5 text-3xl font-bold">Editar {purchase.purchaseNumber}</h1>
    <p className="mt-2 text-sm text-stone-500">Ajuste os dados contratuais antes de enviar para aprovação.</p>
    {error && <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {message && <p className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}
    {returned && <Card className="mt-5 border-amber-200 bg-amber-50 p-4"><p className="text-sm font-bold text-amber-900">Devolvida para ajuste</p><p className="mt-1 text-sm text-amber-800">Revise as correções solicitadas pela Diretoria antes de reenviar.</p><p className="mt-3 text-sm text-amber-950"><strong>Motivo:</strong> {purchase.returnReason}</p><p className="mt-2 text-sm text-amber-950"><strong>Correção solicitada:</strong> {purchase.correctionRequest}</p></Card>}
    {missing.length > 0 ? <Card className="mt-5 border-amber-200 bg-amber-50 p-4"><p className="text-sm font-bold text-amber-900">Campos necessários para enviar para aprovação</p><ul className="mt-2 list-disc pl-5 text-sm text-amber-900">{missing.map((item) => <li key={item}>{item}</li>)}</ul></Card> : <p className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{returned ? "Compra pronta para reenviar à aprovação." : "Compra pronta para aprovação."}</p>}
    <form onSubmit={(event) => { const intent = submitIntent; setSubmitIntent(false); void save(event, intent); }} className="mt-6 space-y-4">
      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        <label className="text-sm font-semibold">Processo<select name="process" value={current("process", purchase.process)} onChange={(event) => setValues((value) => ({ ...value, process: event.target.value }))} className={input}><option value="">Selecione</option><option>Natural</option><option>Cereja Descascado</option><option>Honey</option><option>Lavado</option><option>Fermentado</option><option>Outro</option></select></label>
        <label className="text-sm font-semibold">Peneira<input name="contractedScreen" value={current("screen", purchase.contractedScreen)} onChange={(event) => setValues((value) => ({ ...value, screen: event.target.value }))} className={input} /></label>
        <label className="text-sm font-semibold">Umidade máxima (%)<input name="maxMoisturePercent" type="number" step=".01" value={current("moisture", purchase.maxMoisturePercent)} onChange={(event) => setValues((value) => ({ ...value, moisture: event.target.value }))} className={input} /></label>
        <label className="text-sm font-semibold">Entrega prevista<input name="expectedAt" type="date" value={current("expectedAt", purchase.expectedAt?.slice(0, 10))} onChange={(event) => setValues((value) => ({ ...value, expectedAt: event.target.value }))} className={input} /></label>
        <label className="text-sm font-semibold">Preço/kg<input name="pricePerKg" type="number" step=".01" value={current("price", purchase.pricePerKg)} onChange={(event) => setValues((value) => ({ ...value, price: event.target.value }))} className={input} /></label>
        <label className="text-sm font-semibold sm:col-span-2">Especificação adicional<textarea name="additionalSpecification" defaultValue={purchase.additionalSpecification ?? ""} className={`${input} min-h-24 py-2`} /></label>
      </Card>
      <div className="flex flex-wrap justify-end gap-2"><Button type="submit" disabled={busy}>Salvar rascunho</Button><Button type="button" disabled={busy || missing.length > 0} onClick={(event) => { setSubmitIntent(true); event.currentTarget.form?.requestSubmit(); }}>{returned ? "Reenviar para aprovação" : "Enviar para aprovação"}</Button></div>
    </form>
  </div>;
}
