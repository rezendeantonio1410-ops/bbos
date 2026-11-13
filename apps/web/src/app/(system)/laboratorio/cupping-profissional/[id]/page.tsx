"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, FlaskConical } from "lucide-react";
import { Button, Card } from "@bbos/ui";
import { getApiBaseUrl } from "@/lib/api-url";

const API = `${getApiBaseUrl()}/professional-samples`;
const attributes = ["fragrance", "aroma", "flavor", "aftertaste", "acidity", "body", "balance", "sweetness", "overall"] as const;
const attributeLabels: Record<(typeof attributes)[number], string> = {
  fragrance: "Fragrância",
  aroma: "Aroma",
  flavor: "Sabor",
  aftertaste: "Finalização",
  acidity: "Acidez",
  body: "Corpo",
  balance: "Equilíbrio",
  sweetness: "Doçura",
  overall: "Geral",
};
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
  return <div className="mx-auto max-w-4xl pb-24 sm:pb-12"><Link href="/laboratorio" className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-forest-700"><ChevronLeft size={16} /> Laboratório</Link><header className="mt-2 sm:mt-5"><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-forest-700 sm:text-xs"><FlaskConical size={15} /> Cupping profissional</p><h1 className="mt-1 text-2xl font-bold sm:mt-2 sm:text-3xl">{sample.code}</h1><p className="mt-1 line-clamp-2 text-xs text-stone-500 sm:text-sm">{sample.supplier?.name ?? "Fornecedor não informado"} · {sample.originUnit?.name ?? "Origem não informada"} · Safra {sample.harvest ?? "—"}</p></header><details className="mt-3 rounded-xl border bg-white px-3 sm:mt-6 sm:hidden"><summary className="flex min-h-10 cursor-pointer list-none items-center justify-between text-xs font-bold"><span>Contexto da amostra</span><span className="text-forest-700">Ver</span></summary><p className="border-t py-3 text-xs">{sample.species ?? "—"} · {sample.cultivar ?? "—"} · {sample.process ?? "—"} · status {sample.status}</p></details><Card className="mt-6 hidden p-5 sm:block"><p className="text-xs font-bold uppercase tracking-wide text-stone-400">Contexto da amostra</p><p className="mt-2 text-sm">{sample.species ?? "—"} · {sample.cultivar ?? "—"} · {sample.process ?? "—"} · status {sample.status}</p></Card><Card className="mt-3 p-3 sm:mt-4 sm:p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="font-bold">Ficha sensorial</h2><p className="hidden text-sm text-stone-500 sm:block">O mesmo motor profissional usado no laboratório.</p></div><span className="shrink-0 text-base font-bold text-forest-800 sm:text-lg">{score.toFixed(2)} / 10</span></div><div className="mt-3 grid grid-cols-3 gap-2 sm:mt-4 sm:gap-3">{attributes.map((key) => <label key={key} className="min-w-0 text-[11px] font-semibold sm:text-sm">{attributeLabels[key]}<input type="number" min="0" max="10" step=".1" inputMode="decimal" value={values[key] ?? ""} onChange={(e) => setValues((current) => ({ ...current, [key]: e.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border px-2 py-2 text-center text-base sm:p-3 sm:text-left" /></label>)}</div><label className="mt-3 block text-xs font-semibold sm:mt-4 sm:text-sm">Observações <span className="font-normal text-stone-400">(opcional)</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 min-h-14 w-full rounded-xl border p-2 text-base sm:min-h-24 sm:p-3" /></label>{(error || message) && <p className={`mt-3 rounded-xl p-3 text-sm sm:mt-4 ${error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>{error || message}</p>}<div className="sticky bottom-0 z-20 -mx-3 mt-3 grid grid-cols-2 gap-2 border-t bg-white/95 px-3 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-0 sm:mt-5 sm:flex sm:flex-wrap sm:justify-end sm:border-0 sm:bg-transparent sm:p-0"><Button disabled={busy} onClick={() => void save(false)} className="min-h-12 justify-center border bg-white px-2 text-stone-700">Salvar parcial</Button><Button disabled={busy} onClick={() => void save(true)} className="min-h-12 justify-center px-2">Concluir avaliação</Button>{sample.status === "EVALUATED" && <Button disabled={busy} onClick={() => void approve()} className="col-span-2 min-h-12 justify-center">Aprovar para compra</Button>}</div></Card></div>;
}
