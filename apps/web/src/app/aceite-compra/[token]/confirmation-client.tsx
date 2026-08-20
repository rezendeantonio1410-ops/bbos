"use client";

import Image from "next/image";
import { useState } from "react";
import { getApiBaseUrl } from "@/lib/api-url";

export type PublicConfirmation = {
  acceptanceId: string;
  status: string;
  acceptedAt?: string | null;
  contactName?: string | null;
  contactRole?: string | null;
  contactPhoneSnapshot?: string | null;
  contactEmailSnapshot?: string | null;
  termsVersion: string;
  termsDocumentUrl?: string | null;
  snapshot: {
    purchaseNumber: string;
    supplier: { name: string; taxId?: string | null; farmName?: string | null; municipality?: string | null; state?: string | null };
    coffee: { species: string; harvest: string; variety?: string | null; process?: string | null; originRegion: string };
    specification: { qualityCategory?: string | null; contractedScreen?: string | null; maxDefects?: number | null; maxMoisturePercent?: number | null; minimumScore?: number | null; additionalSpecification?: string | null };
    quantity: { contractedWeightKg: number; volumeQuantity: number; packagingType: string; tolerancePercent: number };
    commercial: { pricePerKg?: number | null; totalValue: number; currency: string; expectedAt?: string | null; contractReference?: string | null };
    payment: { installments?: { number: number; amount: number; dueDate: string }[]; type?: string };
    terms: { acceptanceConditionText: string };
  };
};

export default function ConfirmationClient({ token, initialData }: { token: string; initialData: PublicConfirmation }) {
  const [data, setData] = useState(initialData);
  const [name, setName] = useState(initialData.contactName ?? "");
  const [agreed, setAgreed] = useState(false);
  const [correction, setCorrection] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [divergenceOpen, setDivergenceOpen] = useState(false);
  const s = data.snapshot;
  const done = data.status === "ACCEPTED" || data.status === "DECLINED";
  const money = (value?: number | null) => Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: s.commercial.currency || "BRL" });
  const date = (value?: string | null) => value ? new Date(value).toLocaleDateString("pt-BR") : "—";
  const label = (value?: string | null) => {
    if (!value) return "—";
    const labels: Record<string, string> = { ARABICA: "Arábica", ROBUSTA: "Robusta", ROBUSTA_CONILON: "Robusta/Conilon", CANEPHORA: "Canephora/Robusta/Conilon", BAG_30_KG: "Sacas de 30 kg", BAG_60_KG: "Sacas de 60 kg", BIG_BAG: "Big Bag", NATURAL: "Natural", CEREJA_DESCASCADO: "Cereja descascado", HONEY: "Honey", LAVADO: "Lavado", FERMENTADO: "Fermentado" };
    return labels[value] ?? value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  };
  const submit = async (action: "accept" | "decline") => {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`${getApiBaseUrl()}/purchase-acceptance/${encodeURIComponent(token)}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action === "accept" ? { name, agreed } : { name, reason: correction }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Não foi possível registrar a confirmação.");
      setData((current) => ({ ...current, status: action === "accept" ? "ACCEPTED" : "DECLINED", acceptedAt: result.acceptedAt }));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível registrar a confirmação."); }
    finally { setBusy(false); }
  };
  return <main className="min-h-screen bg-stone-50 px-4 py-8 text-forest-950 sm:px-6"><div className="mx-auto max-w-3xl"><header className="mb-6 rounded-3xl bg-forest-950 p-6 text-white shadow-lg sm:p-8"><Image src="/brand/logo/bispo-logo-official.jpg" alt="Bispo Coffees" width={860} height={240} priority className="h-auto w-44 rounded bg-white p-2" /><p className="mt-5 text-xs font-semibold uppercase tracking-[.18em] text-amber-200">Compra de Café Verde</p><h1 className="mt-3 text-3xl font-semibold">Confirmação de Negócio</h1><p className="mt-2 text-sm text-stone-200">{s.purchaseNumber}</p></header><div className="space-y-4"><Block title="Status"><p className="font-semibold text-amber-800">{done ? (data.status === "ACCEPTED" ? "Aguardando entrega" : "Correção solicitada") : "Aguardando confirmação"}</p></Block><Block title="Vendedor"><strong>{s.supplier.name}</strong><p>{s.supplier.taxId ?? "Documento não informado"} · {s.supplier.farmName ?? "Propriedade não informada"}</p><p>{s.supplier.municipality ?? ""}{s.supplier.state ? ` / ${s.supplier.state}` : ""}</p></Block><Block title="Café"><p><b>Espécie:</b> {label(s.coffee.species)}</p><p><b>Safra:</b> {s.coffee.harvest} · <b>Variedade:</b> {label(s.coffee.variety)}</p><p><b>Processo:</b> {label(s.coffee.process)} · <b>Origem:</b> {s.coffee.originRegion}</p></Block><Block title="Especificação contratada"><p>{label(s.specification.qualityCategory)}</p><p>Peneira: {s.specification.contractedScreen ?? "—"} · Máx. defeitos: {s.specification.maxDefects ?? "—"}</p><p>Umidade máxima: {s.specification.maxMoisturePercent ?? "—"}% · Pontuação mínima: {s.specification.minimumScore ?? "—"}</p><p>{s.specification.additionalSpecification ?? ""}</p></Block><Block title="Quantidade e comercial"><p><b>{Number(s.quantity.contractedWeightKg).toLocaleString("pt-BR")} kg</b> · {s.quantity.volumeQuantity} volumes · {label(s.quantity.packagingType)}</p><p>Preço/kg: {money(s.commercial.pricePerKg)} · Valor total: <b>{money(s.commercial.totalValue)}</b></p><p>Entrega prevista: {date(s.commercial.expectedAt)}</p></Block><Block title="Condições de aceitação"><p>{s.terms.acceptanceConditionText}</p><p className="mt-3 text-xs text-stone-500">Termos Gerais de Compra Bispo Coffees — versão {data.termsVersion}</p></Block>{done ? <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6"><h2 className="text-xl font-semibold">{data.status === "ACCEPTED" ? "Negócio confirmado" : "Correção solicitada"}</h2><p className="mt-2 text-sm">A confirmação referente à Compra de Café Verde {s.purchaseNumber} foi registrada.</p></section> : <section className="rounded-3xl bg-white p-6 shadow-sm"><label className="flex gap-3 text-sm leading-6"><input className="mt-1 h-5 w-5" type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} /><span>Revisei os dados desta Confirmação de Negócio e estou de acordo com as condições apresentadas.</span></label><label className="mt-5 block text-sm font-semibold">Nome completo do responsável<input className="mt-2 w-full rounded-xl border px-3 py-3 font-normal" value={name} onChange={(event) => setName(event.target.value)} /></label><p className="mt-4 text-sm text-stone-600">A confirmação será registrada eletronicamente e integrará o Contrato de Compra de Café Verde desta operação.</p><div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm leading-6 text-stone-700">Os dados pessoais informados e os registros eletrônicos relacionados a esta confirmação serão tratados pela Bispo Coffees para formalização, execução e administração da relação contratual, observada a Lei nº 13.709/2018 (LGPD). <a className="font-semibold underline" href="/aviso-privacidade" target="_blank" rel="noreferrer">Aviso de Privacidade</a></div>{message && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{message}</p>}<button className="mt-5 min-h-12 w-full rounded-xl bg-forest-950 px-4 py-3 font-semibold text-white disabled:opacity-40" disabled={busy || !agreed || !name.trim()} onClick={() => setConfirmOpen(true)}>Confirmar negócio</button><button className="mt-3 min-h-12 w-full rounded-xl border border-amber-300 px-4 py-3 font-semibold text-amber-900" disabled={busy} onClick={() => setDivergenceOpen(true)}>Informar divergência</button>{divergenceOpen && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><label className="block text-sm font-semibold">Descreva a divergência encontrada<textarea className="mt-2 min-h-24 w-full rounded-xl border px-3 py-3 font-normal" value={correction} onChange={(event) => setCorrection(event.target.value)} /></label><div className="mt-3 flex gap-2"><button type="button" className="min-h-11 rounded-xl border bg-white px-4 text-sm font-semibold" onClick={() => { setDivergenceOpen(false); setCorrection(""); }}>Cancelar</button><button type="button" className="min-h-11 rounded-xl bg-amber-800 px-4 text-sm font-semibold text-white disabled:opacity-40" disabled={busy || !correction.trim() || !name.trim()} onClick={() => void submit("decline")}>Enviar divergência</button></div></div>}{confirmOpen && <div className="mt-4 rounded-2xl border border-forest-200 bg-forest-50 p-4"><h2 className="font-semibold">Confirmar este negócio?</h2><p className="mt-2 text-sm leading-6 text-stone-700">Esta confirmação registrará eletronicamente sua concordância com as condições comerciais apresentadas e integrará o Contrato de Compra de Café Verde.</p><div className="mt-3 flex gap-2"><button type="button" className="min-h-11 rounded-xl border bg-white px-4 text-sm font-semibold" onClick={() => setConfirmOpen(false)}>Voltar</button><button type="button" className="min-h-11 rounded-xl bg-forest-950 px-4 text-sm font-semibold text-white disabled:opacity-40" disabled={busy} onClick={() => { setConfirmOpen(false); void submit("accept"); }}>Confirmar negócio</button></div></div>}</section>}</div></div></main>;
}

function Block({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6"><h2 className="text-xs font-bold uppercase tracking-[.15em] text-forest-700">{title}</h2><div className="mt-3 space-y-1 text-sm leading-6 text-stone-700">{children}</div></section>; }
