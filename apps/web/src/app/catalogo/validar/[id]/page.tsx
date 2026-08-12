"use client";
import * as React from "react";
import { CheckCircle2, XCircle } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
type Validation = { status: string; table: string; version: string; generatedAt: string; validUntil?: string | null };
export default function ValidateCatalogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const [data, setData] = React.useState<Validation | null>(null);
  const [error, setError] = React.useState(false);
  React.useEffect(() => { fetch(`${API}/commerce/catalog/validate/${id}`).then((r) => r.ok ? r.json() : Promise.reject()).then(setData).catch(() => setError(true)); }, [id]);
  if (error) return <main className="grid min-h-screen place-items-center bg-[#F7F7F5] p-6"><div className="rounded-2xl bg-white p-8 text-center shadow-sm"><XCircle className="mx-auto text-red-600"/><h1 className="mt-3 text-xl font-bold">Catálogo não encontrado</h1><p className="mt-2 text-sm text-stone-500">O documento informado não está disponível para validação.</p></div></main>;
  if (!data) return <main className="grid min-h-screen place-items-center bg-[#F7F7F5] text-sm text-stone-500">Validando catálogo…</main>;
  const current = data.status === "VIGENTE";
  return <main className="grid min-h-screen place-items-center bg-[#F7F7F5] p-6"><div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-sm"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#4A2A1A]">BISPO COFFEES</p><h1 className="mt-2 text-2xl font-bold">Catálogo Comercial</h1><div className={`mt-6 flex items-center gap-3 rounded-xl p-4 ${current ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{current ? <CheckCircle2/> : <XCircle/>}<div><p className="font-bold">{current ? "CATÁLOGO VIGENTE" : `CATÁLOGO ${data.status}`}</p><p className="text-sm">{current ? "Esta é a versão comercial autorizada." : "Consulte a tabela vigente antes de compartilhar."}</p></div></div><dl className="mt-6 grid grid-cols-2 gap-4 text-sm"><div><dt className="text-stone-500">Tabela</dt><dd className="font-semibold">{data.table}</dd></div><div><dt className="text-stone-500">Versão</dt><dd className="font-semibold">{data.version}</dd></div><div><dt className="text-stone-500">Gerado em</dt><dd className="font-semibold">{new Date(data.generatedAt).toLocaleString("pt-BR")}</dd></div><div><dt className="text-stone-500">Válido até</dt><dd className="font-semibold">{data.validUntil ? new Date(data.validUntil).toLocaleDateString("pt-BR") : "Não informado"}</dd></div></dl></div></main>;
}
