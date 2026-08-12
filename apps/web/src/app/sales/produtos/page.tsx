"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import Link from "next/link";
import { Download, FileText, Package, Search, X } from "lucide-react";
import { salesDesktopRoutes as routes } from "@/lib/sales-routes";
import { currentUser } from "@/lib/current-user";
import { SalesEmptyState, SalesPageHeader } from "@/components/sales-components";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
const initialOptions = { showPrices: true, showAvailability: true, showPresentations: true, showSku: true, includeUnavailable: false };

export default function SalesProductsPage() {
  const [items, setItems] = React.useState<any[]>([]);
  const [documents, setDocuments] = React.useState<any[]>([]);
  const [query, setQuery] = React.useState("");
  const [presentation, setPresentation] = React.useState("ALL");
  const [modal, setModal] = React.useState(false);
  const [options, setOptions] = React.useState(initialOptions);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState("");

  const load = React.useCallback(() => {
    const headers = { "x-user-id": currentUser.id };
    Promise.all([
      fetch(`${API}/commerce/catalog`, { headers }).then((r) => r.ok ? r.json() : []),
      fetch(`${API}/commerce/catalog/documents`, { headers }).then((r) => r.ok ? r.json() : []),
    ]).then(([catalog, history]) => { setItems(catalog); setDocuments(history); }).catch(() => { setItems([]); setDocuments([]); });
  }, []);
  React.useEffect(() => { load(); }, [load]);
  const presentations = [...new Set(items.map((item) => item.presentation).filter(Boolean))];
  const visible = items.filter((item) => `${item.product} ${item.sku} ${item.presentation}`.toLowerCase().includes(query.toLowerCase()) && (presentation === "ALL" || item.presentation === presentation));
  async function generate() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`${API}/commerce/catalog/documents`, { method: "POST", headers: { "Content-Type": "application/json", "x-user-id": currentUser.id }, body: JSON.stringify(options) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Não foi possível gerar o catálogo.");
      setModal(false); load();
      window.open(`${API}/commerce/catalog/documents/${result.document.id}/download`, "_blank");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível gerar o catálogo."); } finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-[#F7F7F5] px-5 py-7"><div className="mx-auto max-w-7xl">
    <SalesPageHeader title="Catálogo e preços" description="Consulte produtos, apresentações, disponibilidade e preços autorizados para sua operação comercial." action={<button onClick={() => setModal(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#4A2A1A] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#63391f]"><Download size={17}/> Gerar catálogo PDF</button>} />
    <div className="mt-6 flex flex-wrap items-center gap-2"><div className="flex min-w-[280px] flex-1 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-3"><Search size={17} className="text-stone-400"/><input value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="Buscar produto..." /></div><button onClick={() => setPresentation("ALL")} className={`rounded-xl border px-3 py-2.5 text-xs font-bold ${presentation === "ALL" ? "border-blue-200 bg-blue-50 text-blue-800" : "border-stone-200 bg-white text-stone-600"}`}>Todos</button>{presentations.map((item) => <button key={item} onClick={() => setPresentation(item)} className={`rounded-xl border px-3 py-2.5 text-xs font-bold ${presentation === item ? "border-blue-200 bg-blue-50 text-blue-800" : "border-stone-200 bg-white text-stone-600"}`}>{item}</button>)}</div>
    {message && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p>}
    {visible.length ? <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{visible.map((item) => <article key={item.id} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="grid h-32 place-items-center rounded-xl bg-coffee-50 text-coffee-700"><Package size={40} strokeWidth={1.3}/></div><p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-forest-700">{item.line ?? "Produto"}</p><h2 className="mt-1 text-lg font-bold">{item.product}</h2><p className="mt-1 text-sm text-stone-500">{item.presentation} · SKU {item.sku}</p><div className="mt-4 flex items-end justify-between gap-3"><div><strong className="text-xl">{item.price != null ? Number(item.price).toLocaleString("pt-BR", { style: "currency", currency: item.currency ?? "BRL" }) : "Preço sob consulta"}</strong><p className="mt-1 text-xs text-stone-500">{item.available > 0 ? `${item.available} disponíveis` : "Indisponível"}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${item.available > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{item.available > 0 ? "Disponível" : "Indisponível"}</span></div><div className="mt-4 flex gap-2"><Link href={`${routes.catalog}/${item.id}`} className="flex-1 rounded-xl border border-stone-200 px-3 py-2.5 text-center text-xs font-bold text-stone-700">Ver detalhes</Link><Link href={`${routes.newOrder}?productVariantId=${item.productVariantId ?? item.id}`} className="flex-1 rounded-xl bg-forest-900 px-3 py-2.5 text-center text-xs font-bold text-white">Adicionar ao pedido</Link></div></article>)}</section> : <div className="mt-5"><SalesEmptyState title="Nenhum produto disponível no seu catálogo neste momento." description="Quando produtos e preços forem liberados para sua operação, eles aparecerão aqui automaticamente." /></div>}
    {documents.length > 0 && <section className="mt-8 rounded-2xl border border-stone-200 bg-white p-5"><div className="flex items-center gap-2"><FileText size={18} className="text-[#4A2A1A]"/><h2 className="text-sm font-bold uppercase tracking-wider text-stone-700">Catálogos gerados</h2></div><div className="mt-4 divide-y divide-stone-100">{documents.map((doc) => <div key={doc.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><p className="font-semibold">{doc.version}</p><p className="text-xs text-stone-500">{new Date(doc.generatedAt).toLocaleString("pt-BR")} · válido até {doc.validUntil ? new Date(doc.validUntil).toLocaleDateString("pt-BR") : "não informado"}</p></div><a className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50" href={`${API}/commerce/catalog/documents/${doc.id}/download`} target="_blank" rel="noreferrer"><Download size={14}/> Baixar novamente</a></div>)}</div></section>}
    {modal && <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-5"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-start justify-between"><div><h2 className="text-lg font-bold">Gerar catálogo comercial</h2><p className="mt-1 text-sm text-stone-500">A versão e a validade vêm da tabela autorizada vigente.</p></div><button onClick={() => setModal(false)} aria-label="Fechar" className="rounded-lg p-2 hover:bg-stone-100"><X size={18}/></button></div><div className="mt-5 space-y-3">{([ ["showPrices", "Mostrar preços"], ["showAvailability", "Mostrar disponibilidade"], ["showPresentations", "Mostrar apresentações"], ["showSku", "Mostrar código/SKU"], ["includeUnavailable", "Mostrar produtos indisponíveis"]] as const).map(([key, label]) => <label key={key} className="flex items-center gap-3 text-sm"><input type="checkbox" checked={options[key]} onChange={(e) => setOptions((current) => ({ ...current, [key]: e.target.checked }))} className="h-4 w-4 accent-[#4A2A1A]"/>{label}</label>)}</div><div className="mt-6 flex justify-end gap-2"><button onClick={() => setModal(false)} className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-bold">Cancelar</button><button disabled={busy} onClick={generate} className="rounded-xl bg-[#4A2A1A] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{busy ? "Gerando..." : "Gerar PDF"}</button></div></div></div>}
  </div></main>;
}
