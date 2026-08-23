"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, FlaskConical } from "lucide-react";
import { Button, Card } from "@bbos/ui";
import { getApiBaseUrl } from "@/lib/api-url";

const API = `${getApiBaseUrl()}/professional-samples`;
const attributes = ["fragrance", "aroma", "flavor", "aftertaste", "acidity", "body", "balance", "sweetness", "overall"] as const;
type Sample = { id: string; code: string; status: string; supplier?: { name: string } | null; originUnit?: { name: string } | null; harvest?: string | null; species?: string | null; cultivar?: string | null; process?: string | null; evaluations: { attributes: Record<string, number>; score?: number | null; completedAt?: string | null }[] };
async function request<T>(url: string, init?: RequestInit): Promise<T> { const response = await fetch(url, { credentials: "include", ...init }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.message ?? "Não foi possível carregar a amostra."); return body as T; }

export default function ProfessionalCuppingPage() {
  const params = useParams<{ id: string }>();
  const [sample, setSample] = useState<Sample | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const load = () => request<Sample>(`${API}/${params.id}`).then((data) => { setSample(data); const evaluation = data.evaluations[0]; if (evaluation) setValues(Object.fromEntries(attributes.map((key) => [key, String(evaluation.attributes[key] ?? "")]))) }).catch((e) => setError(e instanceof Error ? e.message : "Não foi possível carregar a amostra."));
  useEffect(() => { void request<Sample>(`${API}/${params.id}`).then((data) => { setSample(data); const evaluation = data.evaluations[0]; if (evaluation) setValues(Object.fromEntries(attributes.map((key) => [key, String(evaluation.attributes[key] ?? "")]))) }).catch((e) => setError(e instanceof Error ? e.message : "Não foi possível carregar a amostra.")); }, [params.id]);
  const score = useMemo(() => { const numbers = attributes.map((key) => Number(values[key])).filter(Number.isFinite); return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : 0; }, [values]);
  const save = async (complete = false) => { setBusy(true); setError(""); try { await request(`${API}/${params.id}/evaluation`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attributes: Object.fromEntries(attributes.map((key) => [key, values[key] ? Number(values[key]) : undefined])), notes, complete }) }); setMessage(complete ? "Avaliação concluída. A amostra pode ser aprovada para uma possível compra." : "Rascunho salvo."); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar a avaliação."); } finally { setBusy(false); } };
  const approve = async () => { setBusy(true); setError(""); try { await request(`${API}/${params.id}/approve-for-purchase`, { method: "POST" }); setMessage("Amostra aprovada para uma possível compra. Nenhum estoque foi movimentado."); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível aprovar a amostra."); } finally { setBusy(false); } };
  if (!sample) return <div className="mx-auto max-w-4xl p-8">{error ? <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p> : "Carregando amostra..."}</div>;
  return <div className="mx-auto max-w-4xl pb-12"><Link href="/laboratorio" className="inline-flex items-center gap-2 text-sm font-bold text-forest-700"><ChevronLeft size={16} /> Laboratório</Link><header className="mt-5"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-forest-700"><FlaskConical size={15} /> Cupping profissional</p><h1 className="mt-2 text-3xl font-bold">{sample.code}</h1><p className="mt-1 text-sm text-stone-500">{sample.supplier?.name ?? "Fornecedor não informado"} · {sample.originUnit?.name ?? "Origem não informada"} · Safra {sample.harvest ?? "—"}</p></header><Card className="mt-6 p-5"><p className="text-xs font-bold uppercase tracking-wide text-stone-400">Contexto da amostra</p><p className="mt-2 text-sm">{sample.species ?? "—"} · {sample.cultivar ?? "—"} · {sample.process ?? "—"} · status {sample.status}</p></Card><Card className="mt-4 p-5"><div className="flex items-center justify-between"><div><h2 className="font-bold">Ficha sensorial</h2><p className="text-sm text-stone-500">O mesmo motor profissional usado no laboratório.</p></div><span className="text-lg font-bold text-forest-800">{score.toFixed(2)} / 10</span></div><div className="mt-4 grid gap-3 sm:grid-cols-3">{attributes.map((key) => <label key={key} className="text-sm font-semibold capitalize">{key}<input type="number" min="0" max="10" step=".1" value={values[key] ?? ""} onChange={(e) => setValues((current) => ({ ...current, [key]: e.target.value }))} className="mt-1 w-full rounded-xl border p-3" /></label>)}</div><label className="mt-4 block text-sm font-semibold">Observações<textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 min-h-24 w-full rounded-xl border p-3" /></label>{(error || message) && <p className={`mt-4 rounded-xl p-3 text-sm ${error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>{error || message}</p>}<div className="mt-5 flex flex-wrap justify-end gap-2"><Button disabled={busy} onClick={() => void save(false)} className="border bg-white text-stone-700">Salvar parcial</Button><Button disabled={busy} onClick={() => void save(true)}>Concluir avaliação</Button>{sample.status === "EVALUATED" && <Button disabled={busy} onClick={() => void approve()}>Aprovar para compra</Button>}</div></Card></div>;
}
