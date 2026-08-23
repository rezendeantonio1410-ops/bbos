"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Coffee } from "lucide-react";
import { Button, Card } from "@bbos/ui";
import { useParams } from "next/navigation";
import { getApiBaseUrl } from "@/lib/api-url";

const API = `${getApiBaseUrl()}/cupping-public/public`;
const fields = ["fragrance", "flavor", "aftertaste", "acidity", "body", "balance", "sweetness", "overall"] as const;
const labels: Record<(typeof fields)[number], string> = { fragrance: "Fragrância / aroma", flavor: "Sabor", aftertaste: "Finalização", acidity: "Acidez", body: "Corpo", balance: "Balanço", sweetness: "Doçura", overall: "Overall" };
async function request<T>(url: string, init?: RequestInit): Promise<T> { const response = await fetch(url, { ...init, credentials: "omit" }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.message ?? "Não foi possível acessar a sessão."); return body as T; }
type Session = { id: string; code: string; kind: "PROFESSIONAL" | "TRAINING"; sample?: { code: string; supplier?: { name: string } | null; originUnit?: { name: string } | null; harvest?: string | null; species?: string | null; cultivar?: string | null; process?: string | null } | null };

export default function PublicCuppingSessionPage() {
  const { token } = useParams<{ token: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [institution, setInstitution] = useState("");
  const [attributes, setAttributes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { if (token) void request<Session>(`${API}/${token}`).then(setSession).catch((e) => setError(e instanceof Error ? e.message : "Sessão indisponível.")); }, [token]);
  useEffect(() => {
    if (!token || !session) return;
    const stored = window.localStorage.getItem(`bbos-cupping:${token}`);
    if (!stored) return;
    try {
      const saved = JSON.parse(stored) as { participantId?: string; name?: string; phone?: string; institution?: string };
      if (!saved.participantId) return;
      setParticipantId(saved.participantId);
      setName(saved.name ?? ""); setPhone(saved.phone ?? ""); setInstitution(saved.institution ?? "");
      void request<{ evaluation?: { attributes?: Record<string, unknown> } }>(`${API}/${token}/participant/${saved.participantId}`).then((result) => {
        const savedAttributes = result.evaluation?.attributes;
        if (savedAttributes) setAttributes(Object.fromEntries(Object.entries(savedAttributes).map(([key, value]) => [key, String(value)])));
      }).catch(() => window.localStorage.removeItem(`bbos-cupping:${token}`));
    } catch { window.localStorage.removeItem(`bbos-cupping:${token}`); }
  }, [session, token]);
  const score = useMemo(() => { const values = fields.map((key) => Number(attributes[key])).filter(Number.isFinite); return values.length ? (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2) : "—"; }, [attributes]);
  const join = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); setError(""); try { const result = await request<{ participantId: string }>(`${API}/${token}/join`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, phone, institution }) }); setParticipantId(result.participantId); window.localStorage.setItem(`bbos-cupping:${token}`, JSON.stringify({ participantId: result.participantId, name, phone, institution })); setMessage("Você entrou na sessão. Sua ficha é individual."); } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível entrar na sessão."); } finally { setBusy(false); } };
  const save = async (complete = false) => { if (!participantId) return; setBusy(true); setError(""); try { await request(`${API}/${token}/participant/${participantId}/evaluation`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attributes: Object.fromEntries(fields.map((key) => [key, attributes[key] ? Number(attributes[key]) : undefined])), complete }) }); setMessage(complete ? "Avaliação concluída. Obrigado por participar." : "Progresso salvo."); } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar sua avaliação."); } finally { setBusy(false); } };
  useEffect(() => {
    if (!participantId || !Object.keys(attributes).length) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => { void save(false); }, 800);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
  }, [attributes, participantId]);
  if (error && !session) return <main className="mx-auto max-w-xl p-5"><Card className="p-6"><h1 className="text-xl font-bold">Confirmação indisponível</h1><p className="mt-2 text-sm text-stone-600">{error}</p></Card></main>;
  if (!session) return <main className="p-6 text-center">Carregando sessão...</main>;
  return <main className="mx-auto min-h-screen max-w-xl bg-stone-50 px-4 py-6 pb-12"><header className="text-center"><Coffee className="mx-auto text-forest-800" size={28} /><p className="mt-3 text-xs font-bold uppercase tracking-[.16em] text-forest-800">Bispo Coffees · Cupping</p><h1 className="mt-2 text-2xl font-bold">Você foi convidado para uma sessão de cupping.</h1><p className="mt-2 text-sm text-stone-600">Código {session.code} · {session.kind === "TRAINING" ? "Training & calibração" : "Avaliação profissional"}</p></header>{session.sample && <Card className="mt-5 p-4"><p className="text-xs font-bold uppercase tracking-wide text-stone-400">Amostra</p><p className="mt-2 font-bold">{session.sample.code} · {session.sample.supplier?.name ?? "Café em avaliação"}</p><p className="mt-1 text-sm text-stone-600">{session.sample.originUnit?.name ?? "Origem não informada"} · {session.sample.species ?? "—"} · {session.sample.cultivar ?? "—"} · Safra {session.sample.harvest ?? "—"}</p></Card>}{!participantId ? <Card className="mt-4 p-5"><h2 className="text-lg font-bold">Quem vai provar?</h2><p className="mt-1 text-sm text-stone-600">Seus dados registram sua participação nesta sessão. Não serão usados automaticamente para marketing.</p><form onSubmit={join} className="mt-4 space-y-3"><label className="block text-sm font-semibold">Nome completo *<input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl border p-3 text-base" /></label><label className="block text-sm font-semibold">Telefone / WhatsApp *<input required value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className="mt-1 w-full rounded-xl border p-3 text-base" /></label><label className="block text-sm font-semibold">Empresa / instituição<input value={institution} onChange={(e) => setInstitution(e.target.value)} className="mt-1 w-full rounded-xl border p-3 text-base" /></label><Button type="submit" disabled={busy} className="w-full justify-center">{busy ? "Entrando..." : "Entrar na sessão"}</Button></form></Card> : <Card className="mt-4 p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-forest-700">Sua ficha individual</p><h2 className="mt-1 text-lg font-bold">Descubra este café</h2></div><span className="text-lg font-bold text-forest-800">{score}</span></div><div className="mt-4 grid grid-cols-2 gap-3">{fields.map((key) => <label key={key} className="text-sm font-semibold">{labels[key]}<input type="number" min="0" max="10" step=".1" inputMode="decimal" value={attributes[key] ?? ""} onChange={(e) => setAttributes((current) => ({ ...current, [key]: e.target.value }))} className="mt-1 w-full rounded-xl border p-3 text-base" /></label>)}</div><div className="mt-5 flex gap-2"><Button disabled={busy} onClick={() => void save(false)} className="flex-1 border bg-white text-stone-700">Salvar progresso</Button><Button disabled={busy} onClick={() => void save(true)} className="flex-1"><Check size={15} /> Concluir</Button></div></Card>}{(error || message) && <p className={`mt-4 rounded-xl p-3 text-sm ${error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>{error || message}</p>}</main>;
}
