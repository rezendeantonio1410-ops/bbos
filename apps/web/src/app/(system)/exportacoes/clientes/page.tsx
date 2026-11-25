"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { BUYER_STATUS_LABEL, COUNTRIES, CURRENCIES, INCOTERMS, countryName, exportsApi, flag } from "@/lib/exports";
import { ErrorNote, Field, Sheet, buttonClass, cardClass, inputClass, primaryClass } from "@/components/exports-ui";

type Buyer = {
  id: string; name: string; country: string; city: string | null; legalRepresentative: string | null; messenger: string | null; contactName: string | null; email: string | null;
  phone: string | null; language: string | null; currency: string; incoterm: string | null; taxId: string | null;
  address: string | null; status: string; notes: string | null; sampleCount: number; contractCount: number;
};

/** Buyers abroad: kept apart from the domestic customer list. */
export default function ExportBuyersPage() {
  const [buyers, setBuyers] = React.useState<Buyer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [editing, setEditing] = React.useState<Partial<Buyer> | null>(null);
  const [search, setSearch] = React.useState("");

  const load = React.useCallback(async () => {
    try {
      const list = await exportsApi<Buyer[]>("/buyers");
      setBuyers(Array.isArray(list) ? list : []);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar.");
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  const q = search.trim().toLowerCase();
  const visible = buyers.filter((b) => !q || `${b.name} ${b.city ?? ""} ${countryName(b.country)} ${b.contactName ?? ""}`.toLowerCase().includes(q));

  return (
    <div className="mx-auto w-full max-w-[1300px] space-y-4 pb-24 sm:pb-6">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold">Clientes externos</h1>
          <p className="text-sm text-[var(--bbos-text-secondary)]">Importadores e torrefações do exterior · separados dos clientes do Brasil</p>
        </div>
        <button type="button" className={primaryClass} onClick={() => setEditing({ currency: "USD", status: "PROSPECT" })}><Plus size={16} /> Novo cliente externo</button>
      </section>
      <input className={`${inputClass} max-w-md`} placeholder="Buscar por nome, país, cidade ou comprador" value={search} onChange={(e) => setSearch(e.target.value)} />
      <ErrorNote message={error} />
      <section className={`${cardClass} divide-y divide-[#eef1ed]`}>
        {loading ? <p className="p-5 text-sm">Carregando…</p> : !visible.length ? (
          <p className="p-5 text-sm text-[var(--bbos-text-secondary)]">Nenhum cliente externo ainda. Comece pelo botão “Novo cliente externo”.</p>
        ) : visible.map((b) => (
          <button key={b.id} type="button" onClick={() => setEditing(b)} className="grid w-full gap-1 p-4 text-left hover:bg-[var(--bbos-surface-subtle)] sm:grid-cols-[1.5fr_1fr_1fr_auto] sm:items-center">
            <span>
              <span className="block font-semibold"><span className="mr-1.5 text-lg">{flag(b.country)}</span>{b.name}</span>
              <span className="block text-xs text-[var(--bbos-text-secondary)]">{[b.city, countryName(b.country)].filter(Boolean).join(", ")}</span>
            </span>
            <span className="text-sm">{b.contactName ?? "—"}<span className="block text-xs text-[var(--bbos-text-secondary)]">{b.email ?? b.phone ?? ""}</span></span>
            <span className="text-xs text-[var(--bbos-text-secondary)]">{b.sampleCount} amostra(s) · {b.contractCount} contrato(s){b.incoterm ? ` · ${b.incoterm}` : ""} · {b.currency}</span>
            <span className={`justify-self-start rounded-full px-2.5 py-0.5 text-xs font-bold ${b.status === "ACTIVE" ? "bg-[var(--bbos-success-soft)] text-[var(--bbos-success)]" : "bg-[var(--bbos-surface-subtle)] text-[var(--bbos-text-secondary)]"}`}>{BUYER_STATUS_LABEL[b.status]}</span>
          </button>
        ))}
      </section>
      {editing && <BuyerForm buyer={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load(); }} />}
    </div>
  );
}

function BuyerForm({ buyer, onClose, onSaved }: { buyer: Partial<Buyer>; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = React.useState<Record<string, string>>(
    Object.fromEntries(Object.entries(buyer).filter(([, v]) => typeof v === "string")) as Record<string, string>,
  );
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const set = (key: string) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [key]: event.target.value }));
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await exportsApi(buyer.id ? `/buyers/${buyer.id}` : "/buyers", { method: buyer.id ? "PATCH" : "POST", body: form });
      onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Sheet title={buyer.id ? buyer.name ?? "Cliente externo" : "Novo cliente externo"} onClose={onClose}>
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
        <Field label="Empresa" wide><input className={inputClass} required value={form.name ?? ""} onChange={set("name")} /></Field>
        <Field label="País">
          <select className={inputClass} required value={form.country ?? ""} onChange={set("country")}>
            <option value="">Escolha…</option>
            {COUNTRIES.map(([code, name]) => <option key={code} value={code}>{flag(code)} {name}</option>)}
          </select>
        </Field>
        <Field label="Cidade"><input className={inputClass} value={form.city ?? ""} onChange={set("city")} /></Field>
        <Field label="Comprador (contato)"><input className={inputClass} value={form.contactName ?? ""} onChange={set("contactName")} /></Field>
        <Field label="E-mail"><input className={inputClass} type="email" value={form.email ?? ""} onChange={set("email")} /></Field>
        <Field label="Telefone" hint="com código do país, ex.: +86"><input className={inputClass} inputMode="tel" value={form.phone ?? ""} onChange={set("phone")} /></Field>
        <Field label="WeChat / WhatsApp"><input className={inputClass} value={form.messenger ?? ""} onChange={set("messenger")} placeholder="Ex.: WeChat 18676708112" /></Field>
        <Field label="Representante legal"><input className={inputClass} value={form.legalRepresentative ?? ""} onChange={set("legalRepresentative")} /></Field>
        <Field label="Idioma"><input className={inputClass} placeholder="Inglês, japonês…" value={form.language ?? ""} onChange={set("language")} /></Field>
        <Field label="Moeda"><select className={inputClass} value={form.currency ?? "USD"} onChange={set("currency")}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Incoterm preferido"><select className={inputClass} value={form.incoterm ?? ""} onChange={set("incoterm")}><option value="">—</option>{INCOTERMS.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Documento fiscal" hint="VAT, EIN, Unified Social Credit Code…"><input className={inputClass} value={form.taxId ?? ""} onChange={set("taxId")} /></Field>
        <Field label="Situação"><select className={inputClass} value={form.status ?? "PROSPECT"} onChange={set("status")}>{Object.entries(BUYER_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Endereço de entrega das amostras" wide><textarea className={`${inputClass} min-h-16 py-2`} value={form.address ?? ""} onChange={set("address")} /></Field>
        <Field label="Observações" wide><textarea className={`${inputClass} min-h-16 py-2`} value={form.notes ?? ""} onChange={set("notes")} /></Field>
        <div className="sm:col-span-2"><ErrorNote message={error} /></div>
        <div className="flex gap-2 sm:col-span-2">
          <button type="button" className={buttonClass} onClick={onClose}>Cancelar</button>
          <button type="submit" className={`${primaryClass} flex-1`} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</button>
        </div>
      </form>
    </Sheet>
  );
}
