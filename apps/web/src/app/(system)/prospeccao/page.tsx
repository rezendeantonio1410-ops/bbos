"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Crosshair,
  FileSpreadsheet,
  Mic,
  MicOff,
  Navigation,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
} from "lucide-react";
import type { CnpjRegistryRecord } from "@/lib/cnpj-registry";
import { useCnpjRegistryAutofill } from "@/lib/use-cnpj-registry-autofill";
import { useSpeechDictation } from "@/lib/use-speech-dictation";
import {
  CONFIDENCE_LABEL,
  MACHINE_LABEL,
  POTENTIAL_LABEL,
  SEGMENT_LABEL,
  STAGE_LABEL,
  STAGE_TONE,
  addressLine,
  directionsUrl,
  formatCnpj,
  formatPhone,
  matchesSearch,
} from "@/lib/prospecting";

type Prospect = {
  id: string;
  name: string;
  segment: string;
  taxId: string | null;
  legalName: string | null;
  tradeName: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  postalCode: string | null;
  address: string | null;
  addressNumber: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  profile: string | null;
  openingHours: string | null;
  potential: string;
  espressoMachine: string;
  machineNotes: string | null;
  currentSupplier: string | null;
  monthlyVolumeKg: number | null;
  stage: string;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  geocodeSource: string | null;
  nextAction: string | null;
  nextActionAt: string | null;
  suggestedTaxId: string | null;
  suggestedTaxIdConfidence: string | null;
  suggestedTaxIdReason: string | null;
  lastVisitAt?: string | null;
  lastVisitBy?: string | null;
  visitCount?: number;
  visits?: Array<{ id: string; recordedByName: string; visitAt: string; outcome: string; facts: string; nextAction: string | null }>;
};

type Draft = {
  taxId: string;
  legalName: string;
  tradeName: string;
  contactName: string;
  phone: string;
  email: string;
  postalCode: string;
  address: string;
  addressNumber: string;
  district: string;
  city: string;
  state: string;
  monthlyVolumeKg: string;
  espressoMachine: string;
  currentSupplier: string;
  stage: string;
  purpose: string;
  outcome: string;
  facts: string;
  nextAction: string;
  nextActionAt: string;
};

const OUTCOMES = [
  ["INTERESSADO", "Interessado"],
  ["ACOMPANHAR", "Acompanhar"],
  ["COTACAO", "Pediu cotação"],
  ["PEDIDO", "Fez pedido"],
  ["SEM_INTERESSE", "Sem interesse"],
  ["NAO_LOCALIZADO", "Não encontrado"],
] as const;
const STAGE_ORDER = ["NAO_CONTATADO", "CONTATADO", "VISITADO", "DEGUSTACAO", "PROPOSTA", "CLIENTE", "SEM_INTERESSE"];
const REGISTRY_FIELDS = ["legalName", "tradeName", "postalCode", "address", "addressNumber", "district", "city", "state", "phone", "email"] as const;

const value = (text: string | null | undefined) => text ?? "";

function draftFrom(p: Prospect): Draft {
  return {
    taxId: formatCnpj(p.taxId),
    legalName: value(p.legalName),
    tradeName: value(p.tradeName),
    contactName: value(p.contactName),
    phone: formatPhone(p.phone),
    email: value(p.email),
    postalCode: value(p.postalCode),
    address: value(p.address),
    addressNumber: value(p.addressNumber),
    district: value(p.district),
    city: value(p.city),
    state: value(p.state),
    monthlyVolumeKg: p.monthlyVolumeKg === null ? "" : String(p.monthlyVolumeKg).replace(".", ","),
    espressoMachine: p.espressoMachine,
    currentSupplier: value(p.currentSupplier),
    stage: p.stage === "NAO_CONTATADO" ? "VISITADO" : p.stage,
    purpose: "PROSPECCAO",
    outcome: "INTERESSADO",
    facts: "",
    nextAction: "",
    nextActionAt: "",
  };
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", cache: "no-store", ...init });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = Array.isArray(payload?.message) ? payload.message.join(" ") : payload?.message;
    throw new Error(message ?? "Não foi possível concluir. Tente de novo.");
  }
  return payload as T;
}

export default function ProspectingPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<string>("TODOS");
  const [city, setCity] = useState<string>("TODAS");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showImport, setShowImport] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProspects(await api<Prospect[]>("/api/prospects"));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar os pré-cadastros.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) setSelectedId(id);
  }, [load]);

  const cities = useMemo(() => [...new Set(prospects.map((p) => p.city).filter(Boolean) as string[])].sort(), [prospects]);
  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const p of prospects) result[p.stage] = (result[p.stage] ?? 0) + 1;
    return result;
  }, [prospects]);
  const visible = useMemo(
    () =>
      prospects.filter(
        (p) =>
          (stage === "TODOS" || p.stage === stage) &&
          (city === "TODAS" || p.city === city) &&
          (!search || matchesSearch(`${p.name} ${p.tradeName ?? ""} ${p.legalName ?? ""} ${p.address ?? ""} ${p.district ?? ""}`, search)),
      ),
    [prospects, stage, city, search],
  );

  const createProspect = async () => {
    const name = window.prompt("Nome do estabelecimento");
    if (!name?.trim()) return;
    const cityName = window.prompt("Cidade", city !== "TODAS" ? city : "Londrina") ?? "";
    try {
      const created = await api<Prospect>("/api/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), city: cityName.trim(), state: "PR" }),
      });
      await load();
      setSelectedId(created.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar o pré-cadastro.");
    }
  };

  const toVisit = visible.length;
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-28 pt-4 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--bbos-coffee-green)]">Vendas</p>
          <h1 className="mt-1 text-2xl font-bold">Prospecção</h1>
          <p className="mt-1 text-sm text-stone-600">
            {counts.NAO_CONTATADO ?? 0} para visitar · {(counts.VISITADO ?? 0) + (counts.DEGUSTACAO ?? 0) + (counts.PROPOSTA ?? 0)} em andamento · {counts.CLIENTE ?? 0} viraram clientes
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowImport((open) => !open)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-700">
            <FileSpreadsheet size={17} /> Importar planilha
          </button>
          <button type="button" onClick={() => void createProspect()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-stone-950 px-4 text-sm font-semibold text-white">
            <Plus size={17} /> Novo
          </button>
        </div>
      </header>

      {error && <p role="alert" className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      {showImport && <ImportPanel onDone={(message) => { setNotice(message); setShowImport(false); void load(); }} />}

      <div className="mt-5 grid gap-5 lg:grid-cols-[300px_1fr] xl:grid-cols-[360px_1fr]">
        <section className={`${selectedId ? "hidden lg:block" : ""}`} aria-label="Lista de pré-cadastros">
          <label className="relative block">
            <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar nome, rua ou bairro"
              className="min-h-12 w-full rounded-xl border border-stone-200 bg-white pl-10 pr-3 text-base outline-none sm:text-sm"
            />
          </label>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Etapa">
            {["TODOS", ...STAGE_ORDER].filter((s) => s === "TODOS" || counts[s]).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={stage === s}
                onClick={() => setStage(s)}
                className={`min-h-10 shrink-0 rounded-full border px-3 text-sm font-semibold ${stage === s ? "border-stone-950 bg-stone-950 text-white" : "border-stone-200 bg-white text-stone-700"}`}
              >
                {s === "TODOS" ? "Todos" : STAGE_LABEL[s]} <span className="opacity-60">{s === "TODOS" ? prospects.length : counts[s]}</span>
              </button>
            ))}
          </div>
          {cities.length > 1 && (
            <select value={city} onChange={(event) => setCity(event.target.value)} aria-label="Cidade" className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm">
              <option value="TODAS">Todas as cidades</option>
              {cities.map((c) => <option key={c}>{c}</option>)}
            </select>
          )}
          <p className="mt-3 text-xs text-stone-500">{loading ? "Carregando..." : `${toVisit} pré-cadastros`}</p>
          <ul className="mt-2 grid gap-2">
            {visible.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={`w-full rounded-2xl border bg-white p-3 text-left shadow-sm transition ${selectedId === p.id ? "border-stone-950 ring-1 ring-stone-950" : "border-stone-200 hover:border-stone-300"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold leading-tight">{p.name}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${STAGE_TONE[p.stage]}`}>{STAGE_LABEL[p.stage]}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-stone-500">{SEGMENT_LABEL[p.segment]} · {addressLine(p) || "Endereço a confirmar"}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-stone-500">
                    <span>Potencial: {POTENTIAL_LABEL[p.potential]}</span>
                    {p.taxId ? <span className="text-emerald-700">CNPJ confirmado</span> : p.suggestedTaxId ? <span className="text-amber-700">CNPJ sugerido</span> : null}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className={`${selectedId ? "" : "hidden lg:block"}`}>
          {selectedId ? (
            <VisitSheet
              key={selectedId}
              id={selectedId}
              onBack={() => setSelectedId(null)}
              onSaved={(message) => { setNotice(message); void load(); }}
            />
          ) : (
            <div className="grid min-h-80 place-items-center rounded-3xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">
              Escolha um pré-cadastro na lista para registrar a visita.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function VisitSheet({ id, onBack, onSaved }: { id: string; onBack: () => void; onSaved: (message: string) => void }) {
  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [filledByRegistry, setFilledByRegistry] = useState<Set<string>>(new Set());
  const [transcript, setTranscript] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<Prospect>(`/api/prospects/${encodeURIComponent(id)}`)
      .then((p) => { if (!cancelled) { setProspect(p); setDraft(draftFrom(p)); } })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Pré-cadastro não encontrado."));
    return () => { cancelled = true; };
  }, [id]);

  const set = (field: keyof Draft, next: string) => setDraft((current) => (current ? { ...current, [field]: next } : current));

  const registry = useCnpjRegistryAutofill({
    cnpj: draft?.taxId ?? "",
    // A CNPJ already confirmed is not looked up again unless "Buscar" is tapped.
    enabled: Boolean(draft) && (draft?.taxId ?? "").replace(/\D/g, "") !== (prospect?.taxId ?? ""),
    onResolved: (record: CnpjRegistryRecord) => {
      const filled: Partial<Draft> = {
        legalName: record.legalName,
        tradeName: record.tradeName ?? "",
        postalCode: record.postalCode ?? "",
        address: record.street ?? "",
        addressNumber: record.number ?? "",
        district: record.district ?? "",
        city: record.city ?? "",
        state: record.state ?? "",
        phone: record.phone ? formatPhone(record.phone) : "",
        email: record.email ?? "",
      };
      setDraft((current) => {
        if (!current) return current;
        const next = { ...current };
        for (const field of REGISTRY_FIELDS) {
          const incoming = filled[field];
          // Keeps what the seller typed for phone/e-mail when the registry has nothing.
          if (incoming) next[field] = incoming;
        }
        return next;
      });
      setFilledByRegistry(new Set(REGISTRY_FIELDS.filter((field) => filled[field])));
    },
  });

  const dictation = useSpeechDictation((text) => {
    if (!text) return;
    setTranscript((current) => `${current}${current ? " " : ""}${text}`);
    setDraft((current) => (current ? { ...current, facts: `${current.facts}${current.facts && !current.facts.endsWith(" ") ? " " : ""}${text}` } : current));
  });

  const pinHere = () => {
    if (!prospect || !("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const updated = await api<Prospect>(`/api/prospects/${encodeURIComponent(prospect.id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
          });
          setProspect((current) => (current ? { ...current, ...updated } : updated));
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "Não foi possível gravar o local.");
        } finally {
          setLocating(false);
        }
      },
      () => { setLocating(false); setError("Permita o acesso à localização para gravar o local."); },
      { enableHighAccuracy: true, timeout: 20_000 },
    );
  };

  const save = async () => {
    if (!prospect || !draft) return;
    if (!draft.facts.trim()) { setError("Escreva ou dite o relato da visita."); return; }
    setSaving(true);
    setError("");
    if (dictation.listening) dictation.stop();
    const updates: Record<string, unknown> = {
      contactName: draft.contactName,
      phone: draft.phone,
      email: draft.email,
      monthlyVolumeKg: draft.monthlyVolumeKg.trim(),
      espressoMachine: draft.espressoMachine,
      currentSupplier: draft.currentSupplier,
      stage: draft.outcome === "SEM_INTERESSE" ? "SEM_INTERESSE" : draft.stage,
    };
    const address = { postalCode: draft.postalCode, address: draft.address, addressNumber: draft.addressNumber, district: draft.district, city: draft.city, state: draft.state };
    const original = draftFrom(prospect);
    // Sends address fields only when changed (a change re-locates the place).
    for (const [field, next] of Object.entries(address)) if (next !== original[field as keyof Draft]) updates[field] = next;
    if (draft.taxId.replace(/\D/g, "").length === 14) Object.assign(updates, { taxId: draft.taxId, legalName: draft.legalName, tradeName: draft.tradeName });
    try {
      await api(`/api/prospects/${encodeURIComponent(prospect.id)}/visits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitAt: new Date().toISOString(),
          contactName: draft.contactName,
          purpose: draft.purpose,
          outcome: draft.outcome,
          facts: draft.facts,
          factsTranscript: transcript || undefined,
          nextAction: draft.nextAction,
          nextActionAt: draft.nextActionAt || undefined,
          updates,
          confirmedFields: Object.keys(updates).filter((field) => field !== "stage"),
        }),
      });
      onSaved(`Visita a ${prospect.name} registrada.`);
      onBack();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar a visita.");
    } finally {
      setSaving(false);
    }
  };

  if (!prospect || !draft)
    return <div className="rounded-3xl border border-stone-200 bg-white p-6 text-sm text-stone-500">{error || "Carregando..."}</div>;

  const showSuggestion = !prospect.taxId && prospect.suggestedTaxId && draft.taxId.replace(/\D/g, "") !== prospect.suggestedTaxId;
  return (
    <article className="rounded-3xl border border-stone-200 bg-white shadow-sm">
      <header className="border-b border-stone-100 p-4 sm:p-5">
        <button type="button" onClick={onBack} className="mb-3 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-stone-600 lg:hidden">
          <ArrowLeft size={17} /> Lista
        </button>
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700" aria-hidden><Store size={20} /></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold leading-tight">{prospect.name}</h2>
            <p className="mt-0.5 text-sm text-stone-500">{SEGMENT_LABEL[prospect.segment]} · {addressLine(prospect) || "Endereço a confirmar"}</p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-semibold">
              <span className={`rounded-full px-2 py-0.5 ${STAGE_TONE[prospect.stage]}`}>{STAGE_LABEL[prospect.stage]}</span>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-700">Potencial: {POTENTIAL_LABEL[prospect.potential]}</span>
              {prospect.openingHours && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-700">{prospect.openingHours}</span>}
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {prospect.latitude !== null && prospect.longitude !== null && (
            <a href={directionsUrl(prospect.latitude, prospect.longitude)} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-stone-200 px-3 text-sm font-semibold"><Navigation size={16} /> Rota</a>
          )}
          {prospect.phone && <a href={`tel:${prospect.phone}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-stone-200 px-3 text-sm font-semibold"><Phone size={16} /> {formatPhone(prospect.phone)}</a>}
          <button type="button" onClick={pinHere} disabled={locating} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-stone-200 px-3 text-sm font-semibold disabled:opacity-60">
            <Crosshair size={16} /> {locating ? "Gravando..." : prospect.geocodeSource === "GPS" ? "Local gravado (GPS) · regravar" : "Estou aqui"}
          </button>
        </div>
        {prospect.notes && <p className="mt-3 rounded-xl bg-stone-50 p-3 text-sm text-stone-700">{prospect.notes}</p>}
      </header>

      <div className="grid gap-6 p-4 sm:p-5">
        <section aria-labelledby="confirm-title">
          <h3 id="confirm-title" className="flex items-center gap-2 font-semibold"><ShieldCheck size={18} className="text-emerald-700" /> Confirmar dados</h3>
          {showSuggestion && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm text-amber-900">
                CNPJ sugerido <strong className="tabular-nums">{formatCnpj(prospect.suggestedTaxId)}</strong>
                <span className="block text-xs">
                  {CONFIDENCE_LABEL[prospect.suggestedTaxIdConfidence ?? "BAIXA"]}
                  {prospect.suggestedTaxIdReason ? ` · bate ${prospect.suggestedTaxIdReason}` : ""}. Pergunte ao responsável antes de confirmar.
                </span>
              </p>
              <button type="button" onClick={() => set("taxId", formatCnpj(prospect.suggestedTaxId))} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-amber-900 px-4 text-sm font-semibold text-white">
                <Search size={16} /> Conferir na Receita
              </button>
            </div>
          )}
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <Field label="CNPJ" hint={registry.busy ? "Consultando a Receita..." : registry.statusText}>
              <div className="flex gap-2">
                <input inputMode="numeric" value={draft.taxId} onChange={(event) => set("taxId", event.target.value)} placeholder="00.000.000/0000-00" />
                <button type="button" onClick={registry.search} className="min-h-12 shrink-0 rounded-xl border border-stone-200 px-3 text-sm font-semibold">Buscar</button>
              </div>
            </Field>
            <Field label="Volume de café por mês (kg)">
              <input inputMode="decimal" value={draft.monthlyVolumeKg} onChange={(event) => set("monthlyVolumeKg", event.target.value.replace(/[^\d,.]/g, ""))} placeholder="Ex.: 12" />
            </Field>
            {draft.legalName && (
              <Field label="Razão social" filled={filledByRegistry.has("legalName")}>
                <input value={draft.legalName} onChange={(event) => set("legalName", event.target.value)} />
              </Field>
            )}
            {draft.legalName && (
              <Field label="Nome fantasia" filled={filledByRegistry.has("tradeName")}>
                <input value={draft.tradeName} onChange={(event) => set("tradeName", event.target.value)} />
              </Field>
            )}
            <Field label="Responsável pelas compras"><input value={draft.contactName} onChange={(event) => set("contactName", event.target.value)} /></Field>
            <Field label="Telefone" filled={filledByRegistry.has("phone")}><input inputMode="tel" value={draft.phone} onChange={(event) => set("phone", event.target.value)} /></Field>
            <Field label="E-mail" filled={filledByRegistry.has("email")}><input type="email" value={draft.email} onChange={(event) => set("email", event.target.value)} /></Field>
            <Field label="Fornecedor atual"><input value={draft.currentSupplier} onChange={(event) => set("currentSupplier", event.target.value)} /></Field>
            <Field label="Endereço" filled={filledByRegistry.has("address")}><input value={draft.address} onChange={(event) => set("address", event.target.value)} /></Field>
            <div className="grid grid-cols-[1fr_1.4fr] gap-3">
              <Field label="Número" filled={filledByRegistry.has("addressNumber")}><input value={draft.addressNumber} onChange={(event) => set("addressNumber", event.target.value)} /></Field>
              <Field label="Bairro" filled={filledByRegistry.has("district")}><input value={draft.district} onChange={(event) => set("district", event.target.value)} /></Field>
            </div>
          </div>
          <fieldset className="mt-4">
            <legend className="text-sm font-semibold text-stone-700">Máquina de espresso</legend>
            <div className="mt-1 inline-flex rounded-xl border border-stone-200 p-1">
              {Object.entries(MACHINE_LABEL).map(([key, label]) => (
                <button key={key} type="button" aria-pressed={draft.espressoMachine === key} onClick={() => set("espressoMachine", key)} className={`min-h-10 rounded-lg px-3 text-sm font-semibold ${draft.espressoMachine === key ? "bg-stone-950 text-white" : "text-stone-600"}`}>
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        </section>

        <section aria-labelledby="report-title">
          <h3 id="report-title" className="flex items-center gap-2 font-semibold"><Sparkles size={18} className="text-violet-700" /> Relato da visita</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Resultado">
              <select value={draft.outcome} onChange={(event) => set("outcome", event.target.value)}>
                {OUTCOMES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </Field>
            <Field label="Etapa depois da visita">
              <select value={draft.outcome === "SEM_INTERESSE" ? "SEM_INTERESSE" : draft.stage} disabled={draft.outcome === "SEM_INTERESSE"} onChange={(event) => set("stage", event.target.value)}>
                {STAGE_ORDER.filter((s) => !["NAO_CONTATADO", "CLIENTE"].includes(s)).map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
              </select>
            </Field>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="facts" className="text-sm font-semibold text-stone-700">O que aconteceu</label>
              {dictation.supported && (
                <button
                  type="button"
                  onClick={dictation.listening ? dictation.stop : dictation.start}
                  aria-pressed={dictation.listening}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold ${dictation.listening ? "animate-pulse bg-rose-600 text-white" : "bg-violet-50 text-violet-800"}`}
                >
                  {dictation.listening ? <><MicOff size={17} /> Parar</> : <><Mic size={17} /> Ditar</>}
                </button>
              )}
            </div>
            <textarea
              id="facts"
              rows={6}
              value={draft.facts}
              onChange={(event) => set("facts", event.target.value)}
              placeholder={dictation.supported ? "Toque em Ditar e conte como foi a visita, ou escreva aqui." : "Conte como foi a visita."}
              className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-3 text-base outline-none sm:text-sm"
            />
            {dictation.interim && <p className="mt-1 text-sm italic text-stone-500">{dictation.interim}…</p>}
            {dictation.error && <p className="mt-1 text-sm text-rose-700">{dictation.error}</p>}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1.4fr_1fr]">
            <Field label="Próxima ação"><input value={draft.nextAction} onChange={(event) => set("nextAction", event.target.value)} placeholder="Ex.: levar amostra para degustação" /></Field>
            <Field label="Quando"><input type="date" value={draft.nextActionAt} onChange={(event) => set("nextActionAt", event.target.value)} /></Field>
          </div>
        </section>

        {error && <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        <div className="sticky bottom-20 -mx-4 flex justify-end border-t border-stone-100 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:px-5 lg:bottom-0 lg:rounded-b-3xl">
          <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--bbos-coffee-green,#1f5131)] px-6 text-base font-semibold text-white disabled:opacity-60 sm:w-auto">
            <CheckCircle2 size={18} /> {saving ? "Salvando..." : "Salvar visita"}
          </button>
        </div>

        {!!prospect.visits?.length && (
          <section aria-labelledby="history-title">
            <h3 id="history-title" className="font-semibold">Visitas anteriores</h3>
            <ol className="mt-2 grid gap-2">
              {prospect.visits.map((visit) => (
                <li key={visit.id} className="rounded-xl bg-stone-50 p-3 text-sm">
                  <p className="text-xs text-stone-500">{new Date(visit.visitAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} · {visit.recordedByName}</p>
                  <p className="mt-1 whitespace-pre-line">{visit.facts}</p>
                  {visit.nextAction && <p className="mt-1 text-xs text-stone-600">Próxima ação: {visit.nextAction}</p>}
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </article>
  );
}

function Field({ label, hint, filled, children }: { label: string; hint?: string; filled?: boolean; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-stone-700">
      <span className="flex items-center gap-1.5">
        {label}
        {filled && <span className="rounded-full bg-emerald-50 px-1.5 text-[11px] font-semibold text-emerald-700">da Receita</span>}
      </span>
      <div className="mt-1 [&_input]:min-h-12 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-stone-200 [&_input]:px-3 [&_input]:text-base [&_input]:font-normal [&_input]:outline-none [&_select]:min-h-12 [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:border-stone-200 [&_select]:px-3 [&_select]:text-base [&_select]:font-normal sm:[&_input]:text-sm sm:[&_select]:text-sm">
        {children}
      </div>
      {hint && <span className="mt-1 block text-xs font-normal text-stone-500">{hint}</span>}
    </label>
  );
}

type ImportSummary = { total: number; new: number; alreadyImported: number; duplicatesInFile: number; skipped: number; imported: number; preview: Array<{ name: string; city: string | null; segment: string; suggestedTaxId: string | null }> };

function ImportPanel({ onDone }: { onDone: (message: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const send = async (confirm: boolean) => {
    if (!file) return;
    setBusy(true);
    setError("");
    const form = new FormData();
    form.append("file", file);
    if (confirm) form.append("confirm", "true");
    try {
      const result = await api<ImportSummary>("/api/prospects/import", { method: "POST", body: form });
      if (confirm) onDone(`${result.imported} pré-cadastros importados.`);
      else setSummary(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível ler a planilha.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-4 rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5" aria-label="Importar planilha">
      <p className="text-sm text-stone-600">Envie a planilha (.xlsx). Primeiro mostramos o que será criado; nada é sobrescrito. Colunas “CNPJ sugerido”, “Confiança” e “Motivo” entram como sugestão para confirmar na visita.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input type="file" accept=".xlsx" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setSummary(null); }} className="min-h-11 text-sm" />
        <button type="button" disabled={!file || busy} onClick={() => void send(false)} className="min-h-11 rounded-xl border border-stone-200 px-4 text-sm font-semibold disabled:opacity-50">Pré-visualizar</button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
      {summary && (
        <div className="mt-4">
          <p className="text-sm">
            <strong>{summary.new}</strong> novos · {summary.alreadyImported} já existem · {summary.duplicatesInFile} repetidos na planilha · {summary.skipped} linhas sem nome
          </p>
          <ul className="mt-2 max-h-56 overflow-auto rounded-xl border border-stone-100 text-sm">
            {summary.preview.map((row) => (
              <li key={`${row.name}-${row.city}`} className="flex justify-between gap-2 border-b border-stone-100 px-3 py-2 last:border-0">
                <span>{row.name} <span className="text-stone-500">· {row.city ?? "—"} · {SEGMENT_LABEL[row.segment]}</span></span>
                {row.suggestedTaxId && <span className="shrink-0 text-xs text-amber-700">CNPJ sugerido</span>}
              </li>
            ))}
          </ul>
          <button type="button" disabled={busy || !summary.new} onClick={() => void send(true)} className="mt-3 min-h-11 rounded-xl bg-stone-950 px-4 text-sm font-semibold text-white disabled:opacity-50">
            Importar {summary.new} pré-cadastros
          </button>
        </div>
      )}
    </section>
  );
}
