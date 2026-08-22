"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bean, Check, Handshake, MapPinned, Plus, Scale, ShieldCheck, X } from "lucide-react";
import { Button, Card } from "@bbos/ui";
import { getApiBaseUrl } from "@/lib/api-url";
import { fetchSessionIdentity, type SessionIdentity } from "@/lib/auth-session";

const ROOT = getApiBaseUrl();
const API = `${ROOT}/green-coffee-purchases`;
const input = "w-full rounded-lg border border-[var(--bbos-border)] bg-[var(--bbos-surface-elevated)] px-3 py-2.5 text-sm text-[var(--bbos-text-primary)] outline-none transition focus:border-[var(--bbos-focus-ring)] focus:ring-2 focus:ring-[var(--bbos-focus-ring)]/15";

const HARVESTS = Array.from({ length: 10 }, (_, index) => {
  const start = 2023 + index;
  return `${start}/${String(start + 1).slice(-2)}`;
});

const currentHarvest = () => {
  const now = new Date();
  const start = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  const candidate = `${start}/${String(start + 1).slice(-2)}`;
  return HARVESTS.includes(candidate) ? candidate : HARVESTS[0]!;
};

type SupplierContact = {
  id: string;
  name: string;
  role?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  isPrimary: boolean;
  canConfirmBusiness: boolean;
  active: boolean;
};

type SupplierOriginUnit = {
  id: string;
  name: string;
  country: string;
  state: string;
  municipality?: string | null;
  coffeeRegionId?: string | null;
  coffeeRegion?: { id: string; name: string; state: string } | null;
  productions?: { speciesId: string; cultivarId?: string | null }[];
};

type Supplier = {
  id: string;
  name: string;
  legalName?: string;
  taxId?: string;
  farmName?: string;
  city?: string;
  state?: string;
  country?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  originUnits?: SupplierOriginUnit[];
};

type SpeciesReference = {
  id: string;
  code: string;
  name: string;
  varieties: { id: string; code: string; name: string }[];
};

type ReferenceData = {
  species: SpeciesReference[];
  regions: { id: string; state: string; name: string; country: string }[];
  screenClassifications: { id: string; code: string; name: string }[];
  suppliers: Supplier[];
};

type Options = {
  users: { id: string; name: string; role: string }[];
};

type Purchase = {
  id: string;
  purchaseNumber: string;
  approvalStatus: string;
  operationalStatus: string;
  harvest: string;
  contractedWeightKg: number;
  totalValue: number;
  supplier: Supplier;
  farmName?: string;
  species?: string;
  variety?: string;
};

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", ...init });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? "Falha na operação.");
  return data as T;
}

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-[var(--bbos-text-secondary)]">{label}</span>
      {children}
    </label>
  );
}

type SectionTone = "origin" | "quality" | "quantity" | "commercial" | "governance";

function Section({ title, tone, icon: Icon, children }: { title: string; tone: SectionTone; icon: typeof MapPinned; children: React.ReactNode }) {
  const toneClasses = {
    origin: "border-l-[var(--bbos-coffee-green)] text-[var(--bbos-coffee-green)]",
    quality: "border-l-[var(--bbos-coffee-roasted)] text-[var(--bbos-coffee-roasted)]",
    quantity: "border-l-[var(--bbos-state-information)] text-[var(--bbos-state-information)]",
    commercial: "border-l-[var(--bbos-coffee-caramel)] text-[var(--bbos-coffee-caramel)]",
    governance: "border-l-[var(--bbos-state-attention)] text-[var(--bbos-state-attention)]",
  }[tone];
  return (
    <section className={`mt-4 rounded-2xl border border-[var(--bbos-border)] border-l-4 bg-[var(--bbos-surface-elevated)] p-3.5 sm:p-4 ${toneClasses}`}>
      <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--bbos-text-primary)]"><Icon size={16} aria-hidden="true" /><span>{title}</span></h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export default function GreenCoffeePurchasesV2() {
  const [rows, setRows] = useState<Purchase[]>([]);
  const [options, setOptions] = useState<Options | null>(null);
  const [references, setReferences] = useState<ReferenceData | null>(null);
  const [sessionUser, setSessionUser] = useState<SessionIdentity | null>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [purchaseState, setPurchaseState] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [originUnitId, setOriginUnitId] = useState("");
  const [speciesCode, setSpeciesCode] = useState("");
  const [harvest, setHarvest] = useState(currentHarvest());
  const [contacts, setContacts] = useState<SupplierContact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState("");

  const [packagingType, setPackagingType] = useState("BAG_30_KG");
  const [volumes, setVolumes] = useState(1);
  const [unitWeight, setUnitWeight] = useState(30);
  const [priceKg, setPriceKg] = useState(0);

  const [paymentTermType, setPaymentTermType] = useState("CASH");
  const [installmentCount, setInstallmentCount] = useState(1);
  const [daysAfterPurchase, setDaysAfterPurchase] = useState(30);
  const [firstDueDate, setFirstDueDate] = useState(new Date().toISOString().slice(0, 10));

  const load = async () => {
    try {
      const [purchases, currentOptions, identity] = await Promise.all([
        req<Purchase[]>(API),
        req<Options>(`${ROOT}/receipts/options`),
        fetchSessionIdentity(ROOT),
      ]);
      setRows(purchases);
      setOptions(currentOptions);
      setSessionUser(identity);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao carregar compras.");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!open || !purchaseState) {
      setReferences(null);
      return;
    }
    void req<ReferenceData>(`${API}/references?state=${encodeURIComponent(purchaseState)}`)
      .then((data) => {
        setReferences(data);
        setSupplierId("");
        setOriginUnitId("");
        setSpeciesCode("");
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Falha ao carregar referências."));
  }, [open, purchaseState]);

  useEffect(() => {
    if (!supplierId || !references) {
      setContacts([]);
      setSelectedContactId("");
      return;
    }
    const supplier = references.suppliers.find((item) => item.id === supplierId);
    const units = supplier?.originUnits ?? [];
    setOriginUnitId(units.length === 1 ? units[0]!.id : "");
    setSpeciesCode("");
    void req<SupplierContact[]>(`${API}/suppliers/${supplierId}/contacts`)
      .then((items) => {
        const active = items.filter((item) => item.active);
        setContacts(active);
        const preferred = active.find((item) => item.isPrimary) ?? active.find((item) => item.canConfirmBusiness) ?? active[0];
        setSelectedContactId(preferred?.id ?? "");
      })
      .catch(() => {
        setContacts([]);
        setSelectedContactId("");
      });
  }, [supplierId, references]);

  useEffect(() => {
    if (paymentTermType === "CASH") setInstallmentCount(1);
  }, [paymentTermType]);

  const supplier = references?.suppliers.find((item) => item.id === supplierId);
  const originUnits = supplier?.originUnits ?? [];
  const originUnit = originUnits.find((item) => item.id === originUnitId) ?? (originUnits.length === 1 ? originUnits[0] : undefined);
  const productions = originUnit?.productions ?? [];
  const availableSpecies = references?.species.filter(
    (item) => !productions.length || productions.some((production) => production.speciesId === item.id),
  ) ?? [];
  const species = availableSpecies.find((item) => item.code === speciesCode);
  const availableCultivars = species?.varieties.filter(
    (item) => !productions.length || productions.some((production) => production.speciesId === species.id && production.cultivarId === item.id),
  ) ?? [];

  useEffect(() => {
    if (!originUnit) return;
    const matching = availableSpecies;
    if (matching.length === 1) setSpeciesCode(matching[0]!.code);
  }, [originUnitId, references]);

  const totalWeight = Math.max(0, volumes) * Math.max(0, unitWeight);
  const totalValue = totalWeight * Math.max(0, priceKg);
  const selectedContact = contacts.find((item) => item.id === selectedContactId);
  const approvers = options?.users.filter((user) => ["ADMIN", "EXECUTIVE"].includes(user.role)) ?? [];
  const guidance = useMemo(() => {
    if (!purchaseState) return "Comece pela origem da compra.";
    if (!supplier) return "Selecione o fornecedor desta origem.";
    if (!originUnit) return "Selecione a unidade ou fazenda.";
    if (!speciesCode) return "Defina a espécie do café.";
    if (!priceKg) return "Falta definir o preço por kg.";
    if (!selectedContact || !selectedContact.canConfirmBusiness) return "Selecione um contato autorizado.";
    return "Compra pronta para aprovação.";
  }, [originUnit, priceKg, purchaseState, selectedContact, speciesCode, supplier]);

  const setPackaging = (value: string) => {
    setPackagingType(value);
    if (value === "BAG_30_KG") setUnitWeight(30);
    if (value === "BAG_60_KG") setUnitWeight(60);
    if (value === "BIG_BAG" && unitWeight <= 60) setUnitWeight(1000);
  };

  const computeDueDate = () => {
    if (paymentTermType !== "DAYS_AFTER_PURCHASE") return firstDueDate;
    const date = new Date();
    date.setDate(date.getDate() + Math.max(0, daysAfterPurchase));
    return date.toISOString().slice(0, 10);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>, action: "DRAFT" | "SUBMIT" | "APPROVE") => {
    event.preventDefault();
    if (!supplier || !sessionUser) return;
    const form = new FormData(event.currentTarget);
    const cultivarId = String(form.get("cultivarId") || "");
    const cultivar = species?.varieties.find((item) => item.id === cultivarId);
    const selectedSpecies = references?.species.find((item) => item.code === speciesCode);
    const due = computeDueDate();
    const count = paymentTermType === "CASH" ? 1 : Math.max(1, installmentCount);
    const installments = Array.from({ length: count }, (_, index) => {
      const amount = Math.round((totalValue / count) * 100) / 100;
      const date = new Date(`${due}T12:00:00`);
      if (paymentTermType === "INSTALLMENTS") date.setMonth(date.getMonth() + index);
      return {
        installmentNumber: index + 1,
        percentage: Math.round((100 / count) * 100) / 100,
        amount: index === count - 1 ? Math.round((totalValue - amount * (count - 1)) * 100) / 100 : amount,
        dueDate: date.toISOString(),
      };
    });

    try {
      const result = await req<{ purchaseNumber: string }>(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          originUnitId: originUnitId || undefined,
          idempotencyKey: crypto.randomUUID(),
          action,
          department: "COMPRAS",
          approverName: form.get("approverName") || undefined,
          purchasedAt: new Date().toISOString(),
          species: speciesCode,
          speciesId: selectedSpecies?.id,
          originRegion: originUnit?.coffeeRegion?.name ?? "",
          municipality: originUnit?.municipality ?? supplier.city,
          state: originUnit?.state ?? purchaseState,
          country: originUnit?.country ?? supplier.country ?? "Brasil",
          farmName: originUnit?.name ?? supplier.farmName,
          harvest,
          variety: cultivar?.code,
          cultivarId,
          process: form.get("process"),
          supplierLotCode: form.get("supplierLotCode"),
          qualityCategory: form.get("qualityCategory"),
          additionalSpecification: form.get("additionalSpecification"),
          contractedScreen: String(form.get("screenClassificationName") || ""),
          screenClassificationId: form.get("screenClassificationId"),
          coffeeRegionId: originUnit?.coffeeRegionId ?? undefined,
          maxDefects: Number(form.get("maxDefects")) || undefined,
          maxMoisturePercent: Number(form.get("maxMoisturePercent")) || undefined,
          minimumScore: form.get("minimumScore") ? Number(form.get("minimumScore")) : undefined,
          packagingType,
          volumeQuantity: volumes,
          nominalUnitWeightKg: unitWeight,
          contractedWeightKg: totalWeight,
          weightTolerancePercent: Number(form.get("weightTolerancePercent")) || 0,
          pricePerKg: priceKg,
          currency: "BRL",
          totalValue,
          paymentTermType,
          paymentTermData: { installmentCount: count, daysAfterPurchase: paymentTermType === "DAYS_AFTER_PURCHASE" ? daysAfterPurchase : undefined },
          installments,
          expectedAt: form.get("expectedAt") ? new Date(String(form.get("expectedAt"))).toISOString() : undefined,
          contractReference: form.get("externalReference") || undefined,
          commercialNotes: form.get("commercialNotes"),
          supplierContactId: selectedContactId || undefined,
        }),
      });
      setOpen(false);
      setMessage(`${result.purchaseNumber} ${action === "DRAFT" ? "salva como rascunho" : action === "APPROVE" ? "aprovada" : "enviada para aprovação"}.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao salvar a compra.");
    }
  };

  return (
    <div className="mx-auto max-w-[1480px]">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--bbos-coffee-green)]">Suprimentos · Café verde</p>
          <h1 className="mt-2 text-3xl font-bold">Compras de café verde</h1>
          <p className="mt-2 text-sm text-stone-500">Aquisição, governança, financeiro e rastreabilidade desde a origem.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/fornecedores" className="inline-flex min-h-11 items-center rounded-xl border bg-white px-4 text-sm font-bold">Fornecedores</Link>
          <Button onClick={() => setOpen(true)}><Plus size={16} /> Nova compra</Button>
        </div>
      </header>

      {message && <p className="mt-5 flex items-center gap-2 rounded-xl border border-[var(--bbos-success-border)] bg-[var(--bbos-success-soft)] p-4 text-sm text-[var(--bbos-state-success)]"><Check size={15} aria-hidden="true" />{message}</p>}
      {error && <p className="mt-5 rounded-xl border border-[var(--bbos-danger-border)] bg-[var(--bbos-danger-soft)] p-4 text-sm text-[var(--bbos-state-critical)]" role="alert">{error}</p>}

      <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <Card key={row.id} className="p-5">
            <div className="flex items-start justify-between gap-3"><b>{row.purchaseNumber}</b><span className="text-xs font-bold text-stone-500">{row.approvalStatus}</span></div>
            <p className="mt-2 text-sm font-semibold">{row.supplier?.name ?? "—"}</p>
            <p className="mt-1 text-xs text-stone-500">{row.farmName ?? "—"} · Safra {row.harvest}</p>
            <div className="mt-4 flex justify-between border-t pt-3 text-sm"><span>{row.contractedWeightKg.toLocaleString("pt-BR")} kg</span><b>{brl(row.totalValue)}</b></div>
          </Card>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[color:var(--bbos-action-primary)]/30 p-3">
          <form onSubmit={(event) => void submit(event, "SUBMIT")} className="max-h-[96vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-[var(--bbos-surface-warm)] p-4 pb-6 shadow-2xl sm:p-5 sm:pb-7">
            <div className="flex items-start justify-between">
              <div><p className="text-xs font-bold uppercase text-[var(--bbos-coffee-green)]">Ficha de compra V2</p><h2 className="mt-1 text-xl font-bold">Nova compra de café verde</h2></div>
              <button type="button" className="min-h-11 min-w-11" onClick={() => setOpen(false)}><X /></button>
            </div>

            <div className={`mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${guidance === "Compra pronta para aprovação." ? "border-[var(--bbos-success-border)] bg-[var(--bbos-success-soft)] text-[var(--bbos-state-success)]" : "border-[var(--bbos-warning-border)] bg-[var(--bbos-warning-soft)] text-[var(--bbos-state-attention)]"}`} role="status" aria-live="polite">
              <span className={`size-2 rounded-full ${guidance === "Compra pronta para aprovação." ? "bg-[var(--bbos-state-success)]" : "bg-[var(--bbos-state-attention)]"}`} aria-hidden="true" />
              {guidance}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-[var(--bbos-text-muted)]" aria-label="Progresso da ficha">
              {[
                ["Origem", Boolean(supplier && originUnit)],
                ["Especificação", Boolean(speciesCode && selectedContact)],
                ["Quantidade", totalWeight > 0],
                ["Comercial", priceKg > 0],
                ["Governança", Boolean(selectedContact?.canConfirmBusiness)],
              ].map(([label, complete], index) => (
                <span key={String(label)} className="inline-flex items-center gap-1.5">
                  <span className={`grid size-4 place-items-center rounded-full border text-[9px] ${complete ? "border-[var(--bbos-success-border)] bg-[var(--bbos-success-soft)] text-[var(--bbos-state-success)]" : "border-[var(--bbos-warning-border)] bg-[var(--bbos-warning-soft)] text-[var(--bbos-state-attention)]"}`} aria-hidden="true">{complete ? "✓" : "○"}</span>
                  {label}
                  {index < 4 && <span className="ml-0.5 text-[var(--bbos-border)]" aria-hidden="true">→</span>}
                </span>
              ))}
            </div>

            <Section title="A · Origem" tone="origin" icon={MapPinned}>
              <Field label="Estado"><select required className={input} value={purchaseState} onChange={(e) => setPurchaseState(e.target.value)}><option value="">Selecione</option>{["PR","SP","MG","ES","BA","RJ","RO","GO"].map((state) => <option key={state}>{state}</option>)}</select></Field>
              <Field label="Fornecedor"><select required disabled={!purchaseState} className={input} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}><option value="">{purchaseState ? "Selecione" : "Selecione o estado primeiro"}</option>{references?.suppliers.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.taxId}</option>)}</select></Field>
              <Field label="Unidade / Fazenda"><select required disabled={!supplierId} className={input} value={originUnitId} onChange={(e) => setOriginUnitId(e.target.value)}><option value="">Selecione</option>{originUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></Field>
              <Field label="Safra"><select required name="harvest" className={input} value={harvest} onChange={(e) => setHarvest(e.target.value)}>{HARVESTS.map((item) => <option key={item}>{item}</option>)}</select></Field>
              <Field label="Região cafeeira"><input className={`${input} bg-[var(--bbos-surface-subtle)] text-[var(--bbos-text-secondary)]`} readOnly value={originUnit?.coffeeRegion?.name ?? "—"} /></Field>
              <Field label="Município"><input className={`${input} bg-[var(--bbos-surface-subtle)] text-[var(--bbos-text-secondary)]`} readOnly value={originUnit?.municipality ?? "—"} /></Field>
              <Field label="Espécie"><select required disabled={!originUnitId} className={input} value={speciesCode} onChange={(e) => setSpeciesCode(e.target.value)}><option value="">Selecione</option>{availableSpecies.map((item) => <option key={item.id} value={item.code}>{item.name}</option>)}</select></Field>
              <Field label="Variedade/Cultivar"><select required name="cultivarId" disabled={!speciesCode} className={input} defaultValue=""><option value="">Selecione</option>{availableCultivars.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
              <div className="sm:col-span-2 rounded-xl border border-[var(--bbos-border)] bg-[var(--bbos-surface-subtle)] p-3">
                <div className="flex items-center justify-between"><div><p className="text-xs font-bold text-[var(--bbos-text-primary)]">Contato comercial</p><p className="mt-1 text-sm">{selectedContact ? `${selectedContact.name}${selectedContact.role ? ` · ${selectedContact.role}` : ""}` : "Nenhum contato cadastrado"}</p><p className="text-xs text-[var(--bbos-text-secondary)]">{selectedContact?.whatsapp ?? selectedContact?.email ?? "—"}</p></div><Link href="/fornecedores" className="text-xs font-bold text-[var(--bbos-coffee-green)]">+ Novo contato</Link></div>
                {contacts.length > 1 && <select className={`${input} mt-3`} value={selectedContactId} onChange={(e) => setSelectedContactId(e.target.value)}><option value="">Selecione o contato</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}{contact.role ? ` · ${contact.role}` : ""}</option>)}</select>}
              </div>
            </Section>

            <Section title="B · Especificação contratada" tone="quality" icon={Bean}>
              <Field label="Processo"><select name="process" className={input}>{["Natural","Cereja Descascado","Honey","Lavado","Fermentado","Outro"].map((value) => <option key={value}>{value}</option>)}</select></Field>
              <Field label="Qualidade contratada"><select name="qualityCategory" className={input}>{["Especial","Gourmet","Fine Cup","Good Cup","Comercial","Outra"].map((value) => <option key={value}>{value}</option>)}</select></Field>
              <Field label="Peneira"><select required name="screenClassificationId" className={input} defaultValue=""><option value="">Selecione</option>{references?.screenClassifications.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
              <Field label="Máx. defeitos"><input name="maxDefects" type="number" className={input} /></Field>
              <Field label="Umidade máxima (%)"><select name="maxMoisturePercent" defaultValue="12.0" className={input}>{Array.from({ length: 26 }, (_, index) => (10 + index / 10).toFixed(1)).map((value) => <option key={value} value={value}>{value.replace(".", ",")} %</option>)}</select></Field>
              <Field label="Pontuação mínima (opcional)"><input name="minimumScore" type="number" step=".25" className={input} /></Field>
              <Field label="Especificação adicional"><input name="additionalSpecification" className={input} /></Field>
              <Field label="Lote do fornecedor (opcional)"><input name="supplierLotCode" className={input} /></Field>
            </Section>

            <Section title="C · Quantidade / embalagem" tone="quantity" icon={Scale}>
              <Field label="Acondicionamento"><select name="packagingType" className={input} value={packagingType} onChange={(e) => setPackaging(e.target.value)}><option value="BAG_30_KG">Saca 30 kg</option><option value="BAG_60_KG">Saca 60 kg</option><option value="BIG_BAG">Big Bag</option><option value="OTHER">Outro</option></select></Field>
              <Field label="Número de volumes"><input required type="number" min="1" value={volumes} onChange={(e) => setVolumes(Number(e.target.value))} className={input} /></Field>
              <Field label="Peso nominal/volume"><input required type="number" min=".01" step=".01" value={unitWeight} readOnly={packagingType === "BAG_30_KG" || packagingType === "BAG_60_KG"} onChange={(e) => setUnitWeight(Number(e.target.value))} className={input} /></Field>
              <Field label="Tolerância de peso (%)"><input name="weightTolerancePercent" type="number" step=".01" defaultValue="0" className={input} /></Field>
              <div className="rounded-xl border border-[var(--bbos-success-border)] bg-[var(--bbos-success-soft)] p-3"><span className="text-xs text-[var(--bbos-text-secondary)]">Peso total contratado</span><b className="mt-1 block text-lg text-[var(--bbos-state-success)]">{totalWeight.toLocaleString("pt-BR")} kg</b></div>
            </Section>

            <Section title="D · Comercial" tone="commercial" icon={Handshake}>
              <Field label="Preço/kg"><input required type="number" min=".01" step=".01" value={priceKg || ""} onChange={(e) => setPriceKg(Number(e.target.value))} className={input} /></Field>
              <div className="rounded-xl border border-[var(--bbos-coffee-caramel)]/30 bg-[var(--bbos-surface-warm)] p-3"><span className="text-xs text-[var(--bbos-text-secondary)]">Valor da compra <span className="font-normal">· calculado</span></span><b className="mt-1 block text-lg text-[var(--bbos-coffee-caramel)]">{brl(totalValue)}</b></div>
              <Field label="Entrega prevista"><input name="expectedAt" type="date" className={input} /></Field>
              <Field label="Condição de pagamento"><select className={input} value={paymentTermType} onChange={(e) => setPaymentTermType(e.target.value)}><option value="CASH">À vista</option><option value="DAYS_AFTER_PURCHASE">X dias após a compra</option><option value="FIXED_DATE">Data definida</option><option value="INSTALLMENTS">Parcelado</option><option value="ADVANCE_AND_BALANCE">Antecipado + saldo</option><option value="AFTER_RECEIPT">Após recebimento</option></select></Field>
              {paymentTermType === "DAYS_AFTER_PURCHASE" && <Field label="Prazo (dias)"><input type="number" min="0" value={daysAfterPurchase} onChange={(e) => setDaysAfterPurchase(Number(e.target.value))} className={input} /></Field>}
              {paymentTermType === "INSTALLMENTS" && <Field label="Número de parcelas"><input type="number" min="2" max="24" value={installmentCount} onChange={(e) => setInstallmentCount(Number(e.target.value))} className={input} /></Field>}
              {!["DAYS_AFTER_PURCHASE"].includes(paymentTermType) && <Field label={paymentTermType === "CASH" ? "Data do pagamento" : "Primeiro vencimento"}><input required type="date" value={firstDueDate} onChange={(e) => setFirstDueDate(e.target.value)} className={input} /></Field>}
              <Field label="Referência externa (opcional)"><input name="externalReference" className={input} /></Field>
              <Field label="Observações"><input name="commercialNotes" className={input} /></Field>
            </Section>

            <Section title="E · Governança" tone="governance" icon={ShieldCheck}>
              <div className="rounded-xl border border-[var(--bbos-border)] bg-[var(--bbos-surface-subtle)] p-3 text-sm"><span className="text-xs text-[var(--bbos-text-secondary)]">Comprador responsável</span><b className="mt-1 block text-[var(--bbos-text-primary)]">{sessionUser?.name ?? "—"}</b><span className="text-xs text-[var(--bbos-text-secondary)]">Departamento Compras · {sessionUser?.role ?? "—"}</span></div>
              <Field label="Diretor aprovador"><select name="approverName" className={input} defaultValue=""><option value="">Selecione quando aplicável</option>{approvers.map((user) => <option key={user.id} value={user.name}>{user.name}</option>)}</select></Field>
              <div className="sm:col-span-2 rounded-xl border border-[var(--bbos-warning-border)] bg-[var(--bbos-warning-soft)] p-3 text-xs"><ShieldCheck className="mb-1.5 text-[var(--bbos-state-attention)]" size={18} /><b className="text-[var(--bbos-text-primary)]">Trilha de governança</b><p className="mt-1 text-[var(--bbos-text-secondary)]">Usuário, data/hora e valor da decisão ficam vinculados à compra.</p></div>
            </Section>

            <section className="mt-4 rounded-2xl border border-[var(--bbos-success-border)] bg-[var(--bbos-success-soft)] p-4">
              <p className="text-xs font-bold uppercase tracking-[.12em] text-[var(--bbos-state-success)]">Resumo da negociação</p>
              <div className="mt-2.5 grid gap-2.5 text-sm sm:grid-cols-2">
                <p><b>{originUnit?.name ?? "Origem não selecionada"}</b><br /><span className="text-stone-600">Safra {harvest} · {species?.name ?? "Espécie"}</span></p>
                <p><b>{volumes} × {unitWeight.toLocaleString("pt-BR")} kg = {totalWeight.toLocaleString("pt-BR")} kg</b><br /><span className="text-stone-600">{brl(priceKg)}/kg · Total {brl(totalValue)}</span></p>
                <p><b>Pagamento</b><br /><span className="text-stone-600">{paymentTermType === "CASH" ? "À vista" : paymentTermType === "INSTALLMENTS" ? `${installmentCount} parcelas` : paymentTermType === "DAYS_AFTER_PURCHASE" ? `${daysAfterPurchase} dias após a compra` : paymentTermType.replaceAll("_", " ")}</span></p>
                <p><b>Contato</b><br /><span className="text-stone-600">{selectedContact?.name ?? "Não selecionado"}</span></p>
              </div>
            </section>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={(event) => void submit(event as unknown as React.FormEvent<HTMLFormElement>, "DRAFT")} className="min-h-11 rounded-xl border bg-white px-4 text-sm font-bold">Salvar rascunho</button>
              <Button type="submit">Enviar para aprovação</Button>
              {sessionUser && ["ADMIN","EXECUTIVE"].includes(sessionUser.role) && <button type="button" onClick={(event) => void submit(event as unknown as React.FormEvent<HTMLFormElement>, "APPROVE")} className="min-h-11 rounded-xl bg-forest-900 px-4 text-sm font-bold text-white">Aprovar diretamente</button>}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
