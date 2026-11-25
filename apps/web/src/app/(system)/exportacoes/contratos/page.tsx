"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { CONTRACT_STATUS_LABEL, CURRENCIES, INCOTERMS, PRICE_UNIT_LABEL, exportsApi, flag } from "@/lib/exports";
import { ErrorNote, Field, Sheet, buttonClass, cardClass, inputClass, primaryClass } from "@/components/exports-ui";

type Buyer = { id: string; name: string; country: string; currency: string; incoterm: string | null };
type Contract = {
  id: string; buyerId: string; buyerName: string; buyerCountry: string; code: string; product: string; quantityKg: number;
  unitPrice: number | null; priceUnit: string; currency: string; incoterm: string | null; shipmentFrom: string | null;
  shipmentTo: string | null; status: string; notes: string | null;
};
const kg = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const STATUS_TONE: Record<string, string> = {
  NEGOTIATING: "bg-[var(--bbos-warning-soft)] text-[var(--bbos-warning)]",
  SIGNED: "bg-[#e8f0fb] text-[#1d4f91]",
  SHIPPED: "bg-[#e8f0fb] text-[#1d4f91]",
  COMPLETED: "bg-[var(--bbos-success-soft)] text-[var(--bbos-success)]",
  CANCELLED: "bg-[var(--bbos-surface-subtle)] text-[var(--bbos-text-secondary)]",
};

function ContractsInner() {
  const params = useSearchParams();
  const [contracts, setContracts] = React.useState<Contract[]>([]);
  const [buyers, setBuyers] = React.useState<Buyer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [creating, setCreating] = React.useState<Record<string, string> | null>(null);

  const load = React.useCallback(async () => {
    try {
      const [list, buyerList] = await Promise.all([exportsApi<Contract[]>("/contracts"), exportsApi<Buyer[]>("/buyers")]);
      setContracts(Array.isArray(list) ? list : []);
      setBuyers(Array.isArray(buyerList) ? buyerList : []);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar.");
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  // "Transformar em contrato" from an approved sample opens the form pre-filled.
  React.useEffect(() => {
    if (params.get("novo") === "1")
      setCreating({ buyerId: params.get("cliente") ?? "", sampleId: params.get("amostra") ?? "", product: params.get("produto") ?? "", currency: "USD", priceUnit: "PER_LB" });
  }, [params]);

  async function changeStatus(contract: Contract, status: string) {
    try {
      await exportsApi(`/contracts/${contract.id}`, { method: "PATCH", body: { status } });
      void load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível alterar.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1300px] space-y-4 pb-24 sm:pb-6">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold">Contratos de exportação</h1>
          <p className="text-sm text-[var(--bbos-text-secondary)]">Do aprovado ao embarque</p>
        </div>
        <button type="button" className={primaryClass} disabled={!buyers.length} onClick={() => setCreating({ buyerId: buyers[0]?.id ?? "", currency: buyers[0]?.currency ?? "USD", priceUnit: "PER_LB" })}><Plus size={16} /> Novo contrato</button>
      </section>
      <ErrorNote message={error} />
      <section className={`${cardClass} divide-y divide-[#eef1ed]`}>
        {loading ? <p className="p-5 text-sm">Carregando…</p> : !contracts.length ? (
          <p className="p-5 text-sm text-[var(--bbos-text-secondary)]">Nenhum contrato ainda. Uma amostra aprovada pode virar contrato com um toque.</p>
        ) : contracts.map((c) => (
          <article key={c.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_1.4fr_1.2fr_auto] sm:items-center">
            <div><p className="font-semibold">{c.code}</p><p className="text-xs text-[var(--bbos-text-secondary)]">{flag(c.buyerCountry)} {c.buyerName}</p></div>
            <div><p className="font-semibold">{c.product}</p><p className="text-xs text-[var(--bbos-text-secondary)]">{kg.format(c.quantityKg)} kg ≈ {kg.format(c.quantityKg / 60)} sacas{c.unitPrice !== null ? ` · ${c.currency} ${c.unitPrice} ${PRICE_UNIT_LABEL[c.priceUnit]}` : ""}{c.incoterm ? ` · ${c.incoterm}` : ""}</p></div>
            <div className="text-xs text-[var(--bbos-text-secondary)]">{c.shipmentFrom || c.shipmentTo ? `Embarque ${[c.shipmentFrom, c.shipmentTo].filter(Boolean).map((d) => d!.split("-").reverse().slice(0, 2).join("/")).join(" a ")}` : "embarque a definir"}</div>
            <select aria-label={`Situação do contrato ${c.code}`} value={c.status} onChange={(e) => void changeStatus(c, e.target.value)} className={`min-h-10 rounded-full border-0 px-3 text-xs font-bold ${STATUS_TONE[c.status]}`}>
              {Object.entries(CONTRACT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </article>
        ))}
      </section>
      {creating && <ContractForm initial={creating} buyers={buyers} onClose={() => setCreating(null)} onSaved={() => { setCreating(null); void load(); }} />}
    </div>
  );
}

function ContractForm({ initial, buyers, onClose, onSaved }: { initial: Record<string, string>; buyers: Buyer[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = React.useState<Record<string, string>>(initial);
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const set = (key: string) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [key]: event.target.value }));
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await exportsApi("/contracts", { method: "POST", body: form });
      onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Sheet title="Novo contrato" onClose={onClose}>
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
        <Field label="Cliente externo" wide>
          <select className={inputClass} value={form.buyerId} onChange={set("buyerId")}>{buyers.map((b) => <option key={b.id} value={b.id}>{flag(b.country)} {b.name}</option>)}</select>
        </Field>
        {form.sampleId && <p className="text-xs text-[var(--bbos-text-secondary)] sm:col-span-2">Ligado à amostra aprovada.</p>}
        <Field label="Café" wide><input className={inputClass} required value={form.product ?? ""} onChange={set("product")} /></Field>
        <Field label="Quantidade (kg)" hint="1 saca = 60 kg"><input className={inputClass} required inputMode="decimal" value={form.quantityKg ?? ""} onChange={set("quantityKg")} /></Field>
        <Field label="Preço"><input className={inputClass} inputMode="decimal" value={form.unitPrice ?? ""} onChange={set("unitPrice")} /></Field>
        <Field label="Unidade do preço"><select className={inputClass} value={form.priceUnit} onChange={set("priceUnit")}>{Object.entries(PRICE_UNIT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Moeda"><select className={inputClass} value={form.currency} onChange={set("currency")}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Incoterm"><select className={inputClass} value={form.incoterm ?? ""} onChange={set("incoterm")}><option value="">—</option>{INCOTERMS.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Embarque de"><input className={inputClass} type="date" value={form.shipmentFrom ?? ""} onChange={set("shipmentFrom")} /></Field>
        <Field label="Embarque até"><input className={inputClass} type="date" value={form.shipmentTo ?? ""} onChange={set("shipmentTo")} /></Field>
        <Field label="Observações" wide><textarea className={`${inputClass} min-h-16 py-2`} value={form.notes ?? ""} onChange={set("notes")} /></Field>
        <div className="sm:col-span-2"><ErrorNote message={error} /></div>
        <div className="flex gap-2 sm:col-span-2">
          <button type="button" className={buttonClass} onClick={onClose}>Cancelar</button>
          <button type="submit" className={`${primaryClass} flex-1`} disabled={saving}>{saving ? "Salvando…" : "Criar contrato"}</button>
        </div>
      </form>
    </Sheet>
  );
}

export default function ExportContractsPage() {
  return <React.Suspense fallback={null}><ContractsInner /></React.Suspense>;
}
