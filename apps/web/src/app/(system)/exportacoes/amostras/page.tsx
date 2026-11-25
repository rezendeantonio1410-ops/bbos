"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, Plus, RefreshCw } from "lucide-react";
import {
  CARRIER_LABEL,
  RESULT_LABEL,
  SAMPLE_STATUS_LABEL,
  alertText,
  dateTime,
  exportsApi,
  flag,
  shortDate,
} from "@/lib/exports";
import { ErrorNote, Field, Journey, Sheet, buttonClass, cardClass, inputClass, primaryClass } from "@/components/exports-ui";

type Buyer = { id: string; name: string; country: string; city?: string | null; contactName?: string | null };
type Sample = {
  id: string; buyerId: string; buyerName: string; buyerCountry: string; buyerCity?: string | null; buyerContact?: string | null;
  reference: string | null; proformaNumber: string | null; declaredValue: number | null; declaredCurrency: string; shippedByName: string | null;
  coffeeType: "GREEN" | "ROASTED"; lotReference: string; weightGrams: number; scaScore: number | null;
  carrier: string | null; trackingCode: string | null; trackingUrl: string | null; shippingCost: number | null;
  status: string; sentAt: string | null; deliveredAt: string | null; responseDueAt: string | null; responseDays: number;
  result: string | null; buyerScore: number | null; feedback: string | null; contractId: string | null; contractCode: string | null;
  notes: string | null; alert: { kind: string; days: number } | null;
  trackingSyncedAt?: string | null; trackingStatusText?: string | null; trackingProblem?: string | null; syncMessage?: string | null;
  events?: Array<{ id: string; status: string; note: string | null; occurredAt: string; recordedByName: string | null; source: string }>;
};
type Overview = { trackingEnabled?: boolean; inTransit: number; awaitingAnswer: number; approvalRate: number | null; evaluated: number; becameContract: number };

const FILTERS: Array<[string, string, (s: Sample) => boolean]> = [
  ["all", "Todas", () => true],
  ["moving", "A caminho", (s) => ["PREPARED", "SENT", "IN_TRANSIT", "CUSTOMS"].includes(s.status)],
  ["waiting", "Aguardando resposta", (s) => s.status === "DELIVERED"],
  ["approved", "Aprovadas", (s) => s.result === "APPROVED"],
  ["rejected", "Recusadas", (s) => s.result === "REJECTED"],
];
const weight = (grams: number) => (grams >= 1000 ? `${(grams / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg` : `${grams} g`);
const NEXT_STEPS = ["SENT", "IN_TRANSIT", "CUSTOMS", "DELIVERED", "LOST", "RETURNED"];

function statusPill(sample: Sample) {
  const warn = alertText(sample.alert);
  if (sample.result) {
    const tone = sample.result === "APPROVED" ? "bg-[var(--bbos-success-soft)] text-[var(--bbos-success)]" : sample.result === "REJECTED" ? "bg-[#fdecea] text-[var(--bbos-danger)]" : "bg-[var(--bbos-warning-soft)] text-[var(--bbos-warning)]";
    return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${tone}`}>{RESULT_LABEL[sample.result]}{sample.buyerScore !== null ? ` · nota ${sample.buyerScore}` : ""}</span>;
  }
  if (warn) return <span className="rounded-full bg-[var(--bbos-warning-soft)] px-2.5 py-0.5 text-xs font-bold text-[var(--bbos-warning)]">{warn}</span>;
  return <span className="rounded-full bg-[#e8f0fb] px-2.5 py-0.5 text-xs font-bold text-[#1d4f91]">{SAMPLE_STATUS_LABEL[sample.status]}</span>;
}

export default function ExportSamplesPage() {
  const [samples, setSamples] = React.useState<Sample[]>([]);
  const [buyers, setBuyers] = React.useState<Buyer[]>([]);
  const [overview, setOverview] = React.useState<Overview | null>(null);
  const [filter, setFilter] = React.useState("all");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [openId, setOpenId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const [list, buyerList, summary] = await Promise.all([
        exportsApi<Sample[]>("/samples"),
        exportsApi<Buyer[]>("/buyers"),
        exportsApi<Overview>("/overview"),
      ]);
      setSamples(Array.isArray(list) ? list : []);
      setBuyers(Array.isArray(buyerList) ? buyerList : []);
      setOverview(summary);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar as amostras.");
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  const [syncing, setSyncing] = React.useState(false);
  const [syncNote, setSyncNote] = React.useState("");
  async function syncAll() {
    setSyncing(true);
    try {
      const result = await exportsApi<{ synced: number; changed: number; message: string | null }>("/samples/tracking-sync", { method: "POST", body: {} });
      setSyncNote(result.message ?? (result.synced ? `${result.synced} consultada(s), ${result.changed} com etapa nova.` : "Nenhuma amostra a caminho com código de rastreio."));
      await load();
    } catch (reason) {
      setSyncNote(reason instanceof Error ? reason.message : "Não foi possível consultar agora.");
    } finally {
      setSyncing(false);
    }
  }

  const active = FILTERS.find(([key]) => key === filter) ?? FILTERS[0]!;
  const visible = samples.filter(active[2]);

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 pb-24 sm:pb-6">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold">Amostras de exportação</h1>
          <p className="text-sm text-[var(--bbos-text-secondary)]">Do envio à resposta do comprador, com rastreio em cada etapa</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {overview?.trackingEnabled && (
            <button type="button" className={buttonClass} disabled={syncing} onClick={() => void syncAll()}>
              <RefreshCw size={15} className={syncing ? "animate-spin" : ""} /> {syncing ? "Consultando…" : "Atualizar rastreios"}
            </button>
          )}
          <button type="button" className={primaryClass} onClick={() => setCreating(true)} disabled={!buyers.length && !loading}>
            <Plus size={16} /> Nova amostra
          </button>
        </div>
      </section>
      {overview && (
        <p className="text-xs text-[var(--bbos-text-secondary)]">
          {overview.trackingEnabled
            ? "Rastreio automático ligado: o BBOS consulta a transportadora a cada 6 horas e registra cada etapa sozinho."
            : "Rastreio automático desligado: registre as etapas à mão ou ligue a conexão com o 17TRACK."}
          {syncNote ? ` ${syncNote}` : ""}
        </p>
      )}
      {!loading && !buyers.length && (
        <p className="rounded-xl bg-[var(--bbos-warning-soft)] px-3 py-2 text-sm">
          Cadastre primeiro um <Link className="font-semibold underline" href="/exportacoes/clientes">cliente externo</Link> para enviar amostras.
        </p>
      )}
      <ErrorNote message={error} />

      {overview && (
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            ["A caminho", String(overview.inTransit), "enviadas, em trânsito ou na alfândega"],
            ["Aguardando resposta", String(overview.awaitingAnswer), "entregues, sem avaliação"],
            ["Taxa de aprovação", overview.approvalRate === null ? "—" : `${Math.round(overview.approvalRate * 100)}%`, `${overview.evaluated} avaliada(s) em 12 meses`],
            ["Viraram contrato", String(overview.becameContract), "amostras ligadas a um contrato"],
          ].map(([label, value, note]) => (
            <div key={label} className={`${cardClass} p-4`}>
              <span className="block text-[11px] font-bold uppercase tracking-[.06em] text-[var(--bbos-text-secondary)]">{label}</span>
              <span className="mt-1 block text-2xl font-bold tabular-nums">{value}</span>
              <span className="block text-xs text-[var(--bbos-text-secondary)]">{note}</span>
            </div>
          ))}
        </section>
      )}

      <nav aria-label="Filtrar amostras" className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map(([key, label, test]) => (
          <button key={key} type="button" onClick={() => setFilter(key)}
            className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-semibold ${filter === key ? "border-[var(--bbos-text-primary,#14201b)] bg-[var(--bbos-text-primary,#14201b)] text-white" : "border-[var(--bbos-border)] bg-white"}`}>
            {label} {samples.filter(test).length}
          </button>
        ))}
      </nav>

      <section className={`${cardClass} divide-y divide-[#eef1ed]`}>
        {loading ? (
          <p className="p-5 text-sm text-[var(--bbos-text-secondary)]">Carregando…</p>
        ) : !visible.length ? (
          <p className="p-5 text-sm text-[var(--bbos-text-secondary)]">Nenhuma amostra aqui ainda.</p>
        ) : (
          visible.map((sample) => (
            <article key={sample.id} className="grid gap-3 p-4 lg:grid-cols-[1.3fr_1.1fr_2fr_1.2fr_auto] lg:items-center">
              <div>
                <p className="font-semibold"><span className="mr-1.5 text-lg">{flag(sample.buyerCountry)}</span>{sample.buyerName}</p>
                <p className="text-xs text-[var(--bbos-text-secondary)]">{[sample.buyerCity, sample.buyerContact && `comprador: ${sample.buyerContact}`].filter(Boolean).join(" · ")}</p>
              </div>
              <div>
                <p className="font-semibold">{sample.lotReference}</p>
                <p className="text-xs text-[var(--bbos-text-secondary)]">{sample.coffeeType === "GREEN" ? "verde" : "torrado"} · {weight(sample.weightGrams)}{sample.scaScore !== null ? ` · SCA ${sample.scaScore}` : ""}{sample.reference ? ` · ${sample.reference}` : ""}</p>
              </div>
              <Journey status={sample.status} warn={Boolean(sample.alert)} />
              <div className="grid gap-1">
                <span>{statusPill(sample)}</span>
                {sample.trackingUrl ? (
                  <a href={sample.trackingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-[#1d4f91]">
                    {CARRIER_LABEL[sample.carrier ?? "OTHER"]} {sample.trackingCode} <ExternalLink size={12} />
                  </a>
                ) : <span className="text-xs text-[var(--bbos-text-secondary)]">sem código de rastreio</span>}
              </div>
              <button type="button" className={sample.alert?.kind === "FOLLOW_UP" ? primaryClass : buttonClass} onClick={() => setOpenId(sample.id)}>
                {sample.alert?.kind === "FOLLOW_UP" ? "Registrar resposta" : "Abrir"}
              </button>
            </article>
          ))
        )}
      </section>

      {creating && <NewSample buyers={buyers} onClose={() => setCreating(false)} onSaved={(id) => { setCreating(false); void load(); setOpenId(id); }} />}
      {openId && <SampleSheet id={openId} onClose={() => setOpenId(null)} onChanged={() => void load()} />}
    </div>
  );
}

function NewSample({ buyers, onClose, onSaved }: { buyers: Buyer[]; onClose: () => void; onSaved: (id: string) => void }) {
  const [form, setForm] = React.useState<Record<string, string>>({ buyerId: buyers[0]?.id ?? "", coffeeType: "GREEN", weightKg: "", responseDays: "7", carrier: "", declaredCurrency: "USD" });
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const set = (key: string) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [key]: event.target.value }));
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const sample = await exportsApi<Sample>("/samples", { method: "POST", body: form });
      onSaved(sample.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Sheet title="Nova amostra" onClose={onClose}>
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
        <Field label="Cliente externo" wide>
          <select className={inputClass} value={form.buyerId} onChange={set("buyerId")}>
            {buyers.map((b) => <option key={b.id} value={b.id}>{flag(b.country)} {b.name}</option>)}
          </select>
        </Field>
        <Field label="Café / lote" wide><input className={inputClass} required value={form.lotReference ?? ""} onChange={set("lotReference")} placeholder="Ex.: Lote Sublime 24/25" /></Field>
        <Field label="Tipo">
          <select className={inputClass} value={form.coffeeType} onChange={set("coffeeType")}><option value="GREEN">Verde</option><option value="ROASTED">Torrado</option></select>
        </Field>
        <Field label="Peso (kg)" hint="ex.: 15 ou 0,3"><input className={inputClass} required inputMode="decimal" value={form.weightKg} onChange={set("weightKg")} /></Field>
        <Field label="Referência do envio" hint="ex.: BC-BR-0001"><input className={inputClass} autoCapitalize="characters" spellCheck={false} value={form.reference ?? ""} onChange={set("reference")} /></Field>
        <Field label="Nº da pró-forma" hint="ex.: BC-BR-PI-0001"><input className={inputClass} autoCapitalize="characters" spellCheck={false} value={form.proformaNumber ?? ""} onChange={set("proformaNumber")} /></Field>
        <Field label="Valor declarado (alfândega)" hint="amostra grátis, só para a alfândega">
          <div className="grid grid-cols-[1fr_92px] gap-2">
            <input className={inputClass} inputMode="decimal" value={form.declaredValue ?? ""} onChange={set("declaredValue")} placeholder="105,00" />
            <select className={inputClass} aria-label="Moeda" value={form.declaredCurrency} onChange={set("declaredCurrency")}>{["USD", "EUR", "GBP", "JPY", "BRL"].map((c) => <option key={c}>{c}</option>)}</select>
          </div>
        </Field>
        <Field label="Quem enviou"><input className={inputClass} value={form.shippedByName ?? ""} onChange={set("shippedByName")} placeholder="Ex.: Suzi" /></Field>
        <Field label="Nota SCA" hint="opcional"><input className={inputClass} inputMode="decimal" value={form.scaScore ?? ""} onChange={set("scaScore")} placeholder="Ex.: 86,5" /></Field>
        <Field label="Prazo para o comprador responder" hint="dias depois da entrega"><input className={inputClass} inputMode="numeric" value={form.responseDays} onChange={set("responseDays")} /></Field>
        <Field label="Transportadora" hint="pode preencher depois">
          <select className={inputClass} value={form.carrier} onChange={set("carrier")}>
            <option value="">—</option>{Object.entries(CARRIER_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Código de rastreio" hint="pode preencher depois"><input className={inputClass} autoCapitalize="characters" spellCheck={false} value={form.trackingCode ?? ""} onChange={set("trackingCode")} /></Field>
        <Field label="Custo do envio (R$)" hint="opcional"><input className={inputClass} inputMode="decimal" value={form.shippingCost ?? ""} onChange={set("shippingCost")} /></Field>
        <Field label="Observações" wide><textarea className={`${inputClass} min-h-20 py-2`} value={form.notes ?? ""} onChange={set("notes")} /></Field>
        <div className="sm:col-span-2"><ErrorNote message={error} /></div>
        <button type="submit" className={`${primaryClass} sm:col-span-2`} disabled={saving}>{saving ? "Salvando…" : "Salvar amostra"}</button>
      </form>
    </Sheet>
  );
}

function SampleSheet({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [sample, setSample] = React.useState<Sample | null>(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [step, setStep] = React.useState({ status: "SENT", note: "", occurredAt: "" });
  const [tracking, setTracking] = React.useState({ carrier: "", trackingCode: "" });
  const [evaluation, setEvaluation] = React.useState({ result: "APPROVED", buyerScore: "", feedback: "" });

  const load = React.useCallback(async () => {
    try {
      const data = await exportsApi<Sample>(`/samples/${id}`);
      setSample(data);
      setTracking({ carrier: data.carrier ?? "", trackingCode: data.trackingCode ?? "" });
      const next = NEXT_STEPS.find((s) => ["SENT", "IN_TRANSIT", "CUSTOMS", "DELIVERED"].indexOf(s) > ["SENT", "IN_TRANSIT", "CUSTOMS", "DELIVERED"].indexOf(data.status));
      setStep((current) => ({ ...current, status: next ?? "DELIVERED" }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível abrir a amostra.");
    }
  }, [id]);
  React.useEffect(() => { void load(); }, [load]);

  async function run(path: string, body: unknown, method = "POST") {
    setBusy(true);
    setError("");
    try {
      const data = await exportsApi<Sample>(path, { method, body });
      setSample(data);
      onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  if (!sample) return <Sheet title="Amostra" onClose={onClose}><ErrorNote message={error} />{!error && <p className="text-sm">Carregando…</p>}</Sheet>;
  const evaluated = sample.status === "EVALUATED";

  return (
    <Sheet title={`${flag(sample.buyerCountry)} ${sample.buyerName}`} onClose={onClose}>
      <div className="space-y-5">
        <div>
          <p className="font-semibold">{sample.lotReference}</p>
          <p className="text-sm text-[var(--bbos-text-secondary)]">{sample.coffeeType === "GREEN" ? "verde" : "torrado"} · {weight(sample.weightGrams)}{sample.scaScore !== null ? ` · SCA ${sample.scaScore}` : ""}{sample.responseDueAt && !evaluated ? ` · resposta até ${shortDate(sample.responseDueAt)}` : ""}</p>
          <p className="mt-1 text-xs text-[var(--bbos-text-secondary)]">
            {[sample.reference && `Envio ${sample.reference}`, sample.proformaNumber && `Pró-forma ${sample.proformaNumber}`,
              sample.declaredValue !== null && `declarado ${sample.declaredCurrency} ${sample.declaredValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
              sample.shippedByName && `enviado por ${sample.shippedByName}`].filter(Boolean).join(" · ")}
          </p>
          <div className="mt-3"><Journey status={sample.status} warn={Boolean(sample.alert)} /></div>
          {alertText(sample.alert) && <p className="mt-2 rounded-xl bg-[var(--bbos-warning-soft)] px-3 py-2 text-sm font-semibold text-[var(--bbos-warning)]">{alertText(sample.alert)}</p>}
        </div>

        <section>
          <h3 className="mb-2 text-sm font-bold">Rastreio</h3>
          <div className="grid grid-cols-[1fr_1.4fr_auto] gap-2">
            <select className={inputClass} aria-label="Transportadora" value={tracking.carrier} onChange={(e) => setTracking((t) => ({ ...t, carrier: e.target.value }))}>
              <option value="">—</option>{Object.entries(CARRIER_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input className={inputClass} aria-label="Código de rastreio" autoCapitalize="characters" spellCheck={false} value={tracking.trackingCode} onChange={(e) => setTracking((t) => ({ ...t, trackingCode: e.target.value }))} />
            <button type="button" className={buttonClass} disabled={busy} onClick={() => run(`/samples/${id}`, tracking, "PATCH")}>Salvar</button>
          </div>
          {sample.trackingUrl && (
            <a href={sample.trackingUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[#1d4f91]">
              Ver no site da {CARRIER_LABEL[sample.carrier ?? "OTHER"]} <ExternalLink size={13} />
            </a>
          )}
          {sample.trackingCode && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--bbos-surface-subtle)] px-3 py-2">
              <p className="text-xs text-[var(--bbos-text-secondary)]">
                {sample.trackingStatusText
                  ? <><b className="text-[var(--bbos-text-primary,#1f2a22)]">{sample.trackingStatusText}</b> · consultado {dateTime(sample.trackingSyncedAt)}</>
                  : "Ainda não consultado na transportadora."}
              </p>
              <button type="button" className={buttonClass} disabled={busy} onClick={() => run(`/samples/${id}/tracking-sync`, {})}>
                <RefreshCw size={14} /> Atualizar agora
              </button>
            </div>
          )}
          {sample.trackingProblem && <p className="mt-2 rounded-xl bg-[#fdecea] px-3 py-2 text-sm text-[var(--bbos-danger)]">{sample.trackingProblem}</p>}
          {sample.syncMessage && <p className="mt-2 text-xs text-[var(--bbos-text-secondary)]">{sample.syncMessage}</p>}
        </section>

        {!evaluated && (
          <section>
            <h3 className="mb-2 text-sm font-bold">Registrar etapa</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <select className={inputClass} aria-label="Etapa" value={step.status} onChange={(e) => setStep((s) => ({ ...s, status: e.target.value }))}>
                {NEXT_STEPS.map((s) => <option key={s} value={s}>{SAMPLE_STATUS_LABEL[s]}</option>)}
              </select>
              <input className={inputClass} type="datetime-local" aria-label="Quando" value={step.occurredAt} onChange={(e) => setStep((s) => ({ ...s, occurredAt: e.target.value }))} />
              <input className={`${inputClass} sm:col-span-2`} placeholder="Observação (ex.: retida para inspeção)" value={step.note} onChange={(e) => setStep((s) => ({ ...s, note: e.target.value }))} />
              <button type="button" className={`${primaryClass} sm:col-span-2`} disabled={busy} onClick={() => run(`/samples/${id}/steps`, { ...step, occurredAt: step.occurredAt ? new Date(step.occurredAt).toISOString() : undefined }).then(() => setStep((s) => ({ ...s, note: "", occurredAt: "" })))}>
                Registrar “{SAMPLE_STATUS_LABEL[step.status]}”
              </button>
            </div>
          </section>
        )}

        {!evaluated && ["DELIVERED", "IN_TRANSIT", "CUSTOMS", "SENT"].includes(sample.status) && (
          <section>
            <h3 className="mb-2 text-sm font-bold">Resposta do comprador</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <select className={inputClass} aria-label="Resultado" value={evaluation.result} onChange={(e) => setEvaluation((v) => ({ ...v, result: e.target.value }))}>
                {Object.entries(RESULT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input className={inputClass} inputMode="decimal" placeholder="Nota do comprador (opcional)" value={evaluation.buyerScore} onChange={(e) => setEvaluation((v) => ({ ...v, buyerScore: e.target.value }))} />
              <textarea className={`${inputClass} min-h-16 py-2 sm:col-span-2`} placeholder="Comentário do comprador" value={evaluation.feedback} onChange={(e) => setEvaluation((v) => ({ ...v, feedback: e.target.value }))} />
              <button type="button" className={`${buttonClass} sm:col-span-2`} disabled={busy} onClick={() => run(`/samples/${id}/evaluation`, evaluation)}>Registrar resposta</button>
            </div>
          </section>
        )}

        {sample.result === "APPROVED" && !sample.contractId && (
          <Link href={`/exportacoes/contratos?novo=1&cliente=${sample.buyerId}&amostra=${sample.id}&produto=${encodeURIComponent(sample.lotReference)}`} className={`${primaryClass} w-full`}>
            Transformar em contrato
          </Link>
        )}
        {sample.contractCode && <p className="text-sm">Contrato: <Link className="font-semibold underline" href="/exportacoes/contratos">{sample.contractCode}</Link></p>}

        <section>
          <h3 className="mb-2 text-sm font-bold">Histórico</h3>
          <ol className="space-y-0">
            {(sample.events ?? []).map((event) => (
              <li key={event.id} className="grid grid-cols-[92px_1fr] gap-2 border-t border-dashed border-[var(--bbos-border)] py-2 text-sm">
                <span className="text-xs text-[var(--bbos-text-secondary)]">{dateTime(event.occurredAt)}</span>
                <span><b>{SAMPLE_STATUS_LABEL[event.status] ?? event.status}</b>{event.note ? ` · ${event.note}` : ""}{event.source === "TRACKING"
                  ? <span className="ml-1 rounded bg-[#e8f0fb] px-1.5 py-0.5 text-[10px] font-bold text-[#1d4f91]">transportadora</span>
                  : event.recordedByName ? <span className="text-xs text-[var(--bbos-text-secondary)]"> — {event.recordedByName}</span> : null}</span>
              </li>
            ))}
          </ol>
        </section>
        <ErrorNote message={error} />
      </div>
    </Sheet>
  );
}
