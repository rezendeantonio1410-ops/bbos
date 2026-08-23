"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bean, Check, ChevronLeft, Handshake, MapPinned, Package, Scale, ShieldCheck } from "lucide-react";
import { Button, Card } from "@bbos/ui";
import { fetchSessionIdentity, type SessionIdentity } from "@/lib/auth-session";
import { getApiBaseUrl } from "@/lib/api-url";

const ROOT = getApiBaseUrl();
const API = `${ROOT}/green-coffee-purchases`;
const input = "w-full rounded-lg border border-[var(--bbos-border)] bg-[var(--bbos-surface-elevated)] px-3 py-2 text-sm text-[var(--bbos-text-primary)] outline-none transition focus:border-[var(--bbos-focus-ring)] focus:ring-2 focus:ring-[var(--bbos-focus-ring)]/15 disabled:cursor-not-allowed disabled:bg-[var(--bbos-surface-subtle)] disabled:opacity-60";

const states = ["PR", "SP", "MG", "ES", "BA", "RJ", "RO", "GO"];
const packagingWeights: Record<string, number | null> = {
  BAG_30_KG: 30,
  BAG_60_KG: 60,
  BIG_BAG: null,
  OTHER: null,
};
const packagingLabels: Record<string, string> = {
  BAG_30_KG: "Saca 30 kg",
  BAG_60_KG: "Saca 60 kg",
  BIG_BAG: "Big Bag",
  OTHER: "Outro",
};

type Contact = {
  id: string;
  name: string;
  role?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  isPrimary: boolean;
  canConfirmBusiness: boolean;
  active: boolean;
};
type OriginUnit = {
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
  city?: string;
  state?: string;
  country?: string;
  originUnits?: OriginUnit[];
};
type Species = {
  id: string;
  code: string;
  name: string;
  varieties: { id: string; code: string; name: string }[];
};
type ReferenceData = {
  species: Species[];
  regions: { id: string; state: string; name: string; country: string }[];
  screenClassifications: { id: string; code: string; name: string }[];
  suppliers: Supplier[];
};
type Options = { users: { id: string; name: string; role: string }[] };
type Broker = {
  id: string;
  name: string;
  legalName?: string | null;
  tradeName?: string | null;
  active: boolean;
};

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", ...init });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? "Falha na operação.");
  return data as T;
}

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function currentHarvest() {
  const now = new Date();
  const year = now.getFullYear();
  const start = now.getMonth() >= 6 ? year : year - 1;
  return `${start}/${String((start + 1) % 100).padStart(2, "0")}`;
}

function harvestOptions() {
  const items: string[] = [];
  const currentStart = Number(currentHarvest().slice(0, 4));
  for (let start = 2023; start <= currentStart + 4; start += 1) {
    items.push(`${start}/${String((start + 1) % 100).padStart(2, "0")}`);
  }
  return items;
}

export default function PurchaseFormV2Page() {
  const [references, setReferences] = useState<ReferenceData | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [sessionUser, setSessionUser] = useState<SessionIdentity | null>(null);
  const [purchaseState, setPurchaseState] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [originUnitId, setOriginUnitId] = useState("");
  const [speciesCode, setSpeciesCode] = useState("");
  const [cultivarId, setCultivarId] = useState("");
  const [supplierContacts, setSupplierContacts] = useState<Contact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [harvest, setHarvest] = useState(currentHarvest());
  const [packagingType, setPackagingType] = useState("BAG_30_KG");
  const [volumes, setVolumes] = useState(1);
  const [unitWeight, setUnitWeight] = useState(30);
  const [priceKg, setPriceKg] = useState(0);
  const [brokerId, setBrokerId] = useState("");
  const [brokerCommissionPercent, setBrokerCommissionPercent] = useState(0);
  const [paymentTermType, setPaymentTermType] = useState("CASH");
  const [installmentCount, setInstallmentCount] = useState(1);
  const [daysAfterPurchase, setDaysAfterPurchase] = useState(30);
  const [firstDueDate, setFirstDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedNumber, setSubmittedNumber] = useState<string | null>(null);
  const [submittedPurchaseId, setSubmittedPurchaseId] = useState<string | null>(null);
  const [submittedStatus, setSubmittedStatus] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      req<Options>(`${ROOT}/receipts/options`),
      req<Broker[]>(`${ROOT}/brokers`),
      fetchSessionIdentity(ROOT),
    ])
      .then(([currentOptions, currentBrokers, identity]) => {
        setOptions(currentOptions);
        setBrokers(currentBrokers);
        setSessionUser(identity);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Falha ao carregar sessão."));
  }, []);

  useEffect(() => {
    if (!purchaseState) {
      setReferences(null);
      setSupplierId("");
      return;
    }
    void req<ReferenceData>(`${API}/references?state=${encodeURIComponent(purchaseState)}`)
      .then((data) => {
        setReferences(data);
        setSupplierId("");
        setOriginUnitId("");
        setSpeciesCode("");
        setCultivarId("");
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Falha ao carregar origem."));
  }, [purchaseState]);

  useEffect(() => {
    if (!supplierId) {
      setSupplierContacts([]);
      setSelectedContactId("");
      setOriginUnitId("");
      return;
    }
    const selected = references?.suppliers.find((item) => item.id === supplierId);
    const units = selected?.originUnits ?? [];
    setOriginUnitId(units.length === 1 ? units[0]!.id : "");
    void req<Contact[]>(`${API}/suppliers/${supplierId}/contacts`)
      .then((contacts) => {
        const active = contacts.filter((item) => item.active);
        setSupplierContacts(active);
        const preferred = active.find((item) => item.isPrimary && item.canConfirmBusiness) ?? active.find((item) => item.canConfirmBusiness) ?? active[0];
        setSelectedContactId(preferred?.id ?? "");
      })
      .catch(() => setSupplierContacts([]));
  }, [supplierId, references?.suppliers]);

  useEffect(() => {
    if (paymentTermType === "CASH") setInstallmentCount(1);
  }, [paymentTermType]);

  const supplier = references?.suppliers.find((item) => item.id === supplierId);
  const originUnits = supplier?.originUnits ?? [];
  const originUnit = originUnits.find((item) => item.id === originUnitId) ?? (originUnits.length === 1 ? originUnits[0] : undefined);
  const unitProductions = originUnit?.productions ?? [];
  const availableSpecies = references?.species.filter((item) => !unitProductions.length || unitProductions.some((production) => production.speciesId === item.id)) ?? [];
  const species = availableSpecies.find((item) => item.code === speciesCode);
  const availableCultivars = species?.varieties.filter((item) => !unitProductions.length || unitProductions.some((production) => production.speciesId === species.id && production.cultivarId === item.id)) ?? [];
  const cultivar = availableCultivars.find((item) => item.id === cultivarId);
  const selectedContact = supplierContacts.find((item) => item.id === selectedContactId);
  const totalWeight = volumes * unitWeight;
  const totalValue = totalWeight * priceKg;
  const selectedBroker = brokers.find((item) => item.id === brokerId);
  const brokerCommissionAmount = Math.round(totalValue * brokerCommissionPercent) / 100;
  const totalOperationCost = totalValue + brokerCommissionAmount;
  const currentApprovers = options?.users.filter((item) => ["EXECUTIVE", "ADMIN"].includes(item.role)) ?? [];

  const installments = useMemo(() => {
    const count = paymentTermType === "CASH" ? 1 : Math.max(1, installmentCount);
    const due = new Date(`${firstDueDate}T12:00:00`);
    if (paymentTermType === "DAYS_AFTER_PURCHASE") due.setDate(new Date().getDate() + Math.max(0, daysAfterPurchase));
    return Array.from({ length: count }, (_, index) => {
      const date = new Date(due);
      if (paymentTermType === "INSTALLMENTS" && index > 0) date.setMonth(date.getMonth() + index);
      const amount = Math.round((totalValue / count) * 100) / 100;
      return { installmentNumber: index + 1, percentage: Math.round((100 / count) * 100) / 100, amount, dueDate: date.toISOString() };
    });
  }, [daysAfterPurchase, firstDueDate, installmentCount, paymentTermType, totalValue]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || submittedNumber) return;
    setError("");
    setMessage("");
    if (!supplier || !originUnit || !species || !cultivar) return setError("Complete origem, espécie e cultivar.");
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    try {
      const result = await req<{ id: string; purchaseNumber: string; status?: string; approvalStatus?: string }>(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          originUnitId: originUnit.id,
          idempotencyKey: crypto.randomUUID(),
          action: "SUBMIT",
          department: "COMPRAS",
          approverName: form.get("approverName"),
          purchasedAt: new Date().toISOString(),
          species: species.code,
          speciesId: species.id,
          originRegion: originUnit.coffeeRegion?.name ?? "",
          municipality: originUnit.municipality ?? supplier.city,
          state: originUnit.state,
          country: originUnit.country ?? supplier.country ?? "Brasil",
          farmName: originUnit.name,
          harvest,
          variety: cultivar.code,
          cultivarId: cultivar.id,
          process: form.get("process"),
          qualityCategory: form.get("qualityCategory"),
          contractedScreen: references?.screenClassifications.find((item) => item.id === form.get("screenClassificationId"))?.name,
          screenClassificationId: form.get("screenClassificationId"),
          coffeeRegionId: originUnit.coffeeRegionId,
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
          ...(selectedBroker
            ? { brokerId: selectedBroker.id, brokerCommissionPercent }
            : {}),
          paymentTermType,
          paymentTermData: { installmentCount: installments.length, daysAfterPurchase: paymentTermType === "DAYS_AFTER_PURCHASE" ? daysAfterPurchase : undefined },
          installments,
          expectedAt: form.get("expectedAt") ? new Date(String(form.get("expectedAt"))).toISOString() : undefined,
          contractReference: form.get("externalReference") || undefined,
          commercialNotes: form.get("commercialNotes"),
        }),
      });
      setSubmittedPurchaseId(result.id);
      setSubmittedNumber(result.purchaseNumber);
      setSubmittedStatus(result.approvalStatus ?? result.status ?? "PENDING_APPROVAL");
      setMessage(`${result.purchaseNumber} enviada para aprovação.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao salvar compra.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl pb-16">
      <Link href="/compras-cafe-verde" className="inline-flex items-center gap-2 text-sm font-bold text-forest-700"><ChevronLeft size={16} /> Compras</Link>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.15em] text-forest-700">Ficha de compra V2 · checkpoint</p>
          <h1 className="mt-2 text-3xl font-bold">Nova compra de café verde</h1>
          <p className="mt-2 text-sm text-stone-500">Fluxo progressivo: origem → especificação → quantidade → comercial → governança.</p>
        </div>
      </div>
      {message && <p className="mt-3 flex items-center gap-2 rounded-xl border border-[var(--bbos-success-border)] bg-[var(--bbos-success-soft)] p-3 text-sm font-semibold text-[var(--bbos-state-success)]"><Check size={15} aria-hidden="true" />{message}</p>}
      {error && <p className="mt-3 rounded-xl border border-[var(--bbos-danger-border)] bg-[var(--bbos-danger-soft)] p-3 text-sm font-semibold text-[var(--bbos-state-critical)]" role="alert">{error}</p>}

      <nav className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-[var(--bbos-border)] bg-[var(--bbos-surface-subtle)] px-3 py-2" aria-label="Progresso da ficha">
        {([["Origem", Boolean(supplier && originUnit), MapPinned], ["Especificação", Boolean(species && cultivar), Bean], ["Quantidade", totalWeight > 0, Package], ["Comercial", priceKg > 0, Handshake], ["Governança", Boolean(selectedContact?.canConfirmBusiness), ShieldCheck]] as const).map(([label, complete, Icon], index, items) => <span key={label} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--bbos-text-secondary)]"><span className={`grid size-5 place-items-center rounded-full border ${complete ? "border-[var(--bbos-success-border)] bg-[var(--bbos-success-soft)] text-[var(--bbos-state-success)]" : "border-[var(--bbos-warning-border)] bg-[var(--bbos-warning-soft)] text-[var(--bbos-state-attention)]"}`}><Icon size={11} aria-hidden="true" /></span>{label}{index < items.length - 1 && <span className="ml-0.5 text-[var(--bbos-text-muted)]" aria-hidden="true">→</span>}</span>)}
      </nav>

      <form onSubmit={submit} className="mt-3 space-y-2.5">
        <fieldset disabled={Boolean(submittedNumber)} className="contents">
        <Section title="A · Origem" tone="origin" icon={MapPinned}>
          <Field label="Estado"><select required className={input} value={purchaseState} onChange={(e) => setPurchaseState(e.target.value)}><option value="">Selecione</option>{states.map((value) => <option key={value}>{value}</option>)}</select></Field>
          <Field label="Fornecedor"><select required className={input} disabled={!purchaseState} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}><option value="">Selecione</option>{references?.suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          <Field label="Unidade / Fazenda"><select required className={input} disabled={!supplierId} value={originUnitId} onChange={(e) => { setOriginUnitId(e.target.value); setSpeciesCode(""); setCultivarId(""); }}><option value="">Selecione</option>{originUnits.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          <Field label="Safra"><select required className={input} value={harvest} onChange={(e) => setHarvest(e.target.value)}>{harvestOptions().map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Região cafeeira"><input readOnly className={input} value={originUnit?.coffeeRegion?.name ?? "—"} /></Field>
          <Field label="Município"><input readOnly className={input} value={originUnit?.municipality ?? "—"} /></Field>
          <Field label="Espécie"><select required className={input} disabled={!originUnitId} value={speciesCode} onChange={(e) => { setSpeciesCode(e.target.value); setCultivarId(""); }}><option value="">Selecione</option>{availableSpecies.map((item) => <option key={item.id} value={item.code}>{item.name}</option>)}</select></Field>
          <Field label="Cultivar"><select required className={input} disabled={!speciesCode} value={cultivarId} onChange={(e) => setCultivarId(e.target.value)}><option value="">Selecione</option>{availableCultivars.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          <div className="rounded-xl border bg-stone-50 p-4 sm:col-span-2 lg:col-span-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-xs font-bold uppercase text-stone-500">Contato comercial</p><b className="mt-1 block text-sm">{selectedContact?.name ?? "Nenhum contato autorizado selecionado"}</b><p className="text-xs text-stone-500">{selectedContact?.role ?? ""}{selectedContact?.whatsapp ? ` · ${selectedContact.whatsapp}` : selectedContact?.email ? ` · ${selectedContact.email}` : ""}</p></div>
              <select className="rounded-lg border bg-white px-3 py-2 text-xs" value={selectedContactId} onChange={(e) => setSelectedContactId(e.target.value)}><option value="">Selecionar contato</option>{supplierContacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}</select>
            </div>
          </div>
        </Section>

        <Section title="B · Especificação contratada" tone="quality" icon={Bean}>
          <Field label="Processo"><select name="process" className={input}>{["Natural", "Cereja Descascado", "Honey", "Lavado", "Fermentado", "Outro"].map((value) => <option key={value}>{value}</option>)}</select></Field>
          <Field label="Qualidade"><select name="qualityCategory" className={input}>{["Especial", "Gourmet", "Fine Cup", "Good Cup", "Comercial", "Outra"].map((value) => <option key={value}>{value}</option>)}</select></Field>
          <Field label="Peneira"><select required name="screenClassificationId" className={input} defaultValue=""><option value="" disabled>Selecione</option>{references?.screenClassifications.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          <Field label="Máx. defeitos"><input name="maxDefects" type="number" min="0" className={input} /></Field>
          <Field label="Umidade máxima (%)"><select name="maxMoisturePercent" defaultValue="12.0" className={input}>{Array.from({ length: 26 }, (_, index) => (10 + index / 10).toFixed(1)).map((value) => <option key={value} value={value}>{value.replace(".", ",")} %</option>)}</select></Field>
          <Field label="Pontuação mínima"><input name="minimumScore" type="number" step=".25" className={input} /></Field>
        </Section>

        <Section title="C · Quantidade / embalagem" tone="quantity" icon={Scale}>
          <Field label="Acondicionamento"><select className={input} value={packagingType} onChange={(e) => { const next = e.target.value; setPackagingType(next); const weight = packagingWeights[next] ?? null; if (weight !== null) setUnitWeight(weight); }}><option value="BAG_30_KG">Saca 30 kg</option><option value="BAG_60_KG">Saca 60 kg</option><option value="BIG_BAG">Big Bag</option><option value="OTHER">Outro</option></select></Field>
          <Field label="Número de volumes"><input required type="number" min="1" className={input} value={volumes} onChange={(e) => setVolumes(Math.max(1, Number(e.target.value)))} /></Field>
          <Field label="Peso nominal/volume"><input required type="number" min=".01" step=".01" className={input} value={unitWeight} readOnly={packagingWeights[packagingType] !== null} onChange={(e) => setUnitWeight(Number(e.target.value))} /></Field>
          <Field label="Tolerância de peso (%)"><input name="weightTolerancePercent" type="number" min="0" step=".01" defaultValue="0" className={input} /></Field>
          <Metric label="Peso total contratado" value={`${totalWeight.toLocaleString("pt-BR")} kg`} />
        </Section>

        <Section title="D · Comercial" tone="commercial" icon={Handshake}>
          <Field label="Preço/kg"><input required type="number" min=".01" step=".01" className={input} value={priceKg || ""} onChange={(e) => setPriceKg(Number(e.target.value))} /></Field>
          <Metric label="Valor total da compra" value={brl(totalValue)} />
          <Field label="Entrega prevista"><input name="expectedAt" type="date" className={input} /></Field>
          <Field label="Condição de pagamento"><select className={input} value={paymentTermType} onChange={(e) => setPaymentTermType(e.target.value)}><option value="CASH">À vista</option><option value="DAYS_AFTER_PURCHASE">X dias</option><option value="FIXED_DATE">Data definida</option><option value="INSTALLMENTS">Parcelado</option><option value="ADVANCE_AND_BALANCE">Antecipado + saldo</option><option value="AFTER_RECEIPT">Após recebimento</option><option value="CUSTOM">Customizado</option></select></Field>
          {paymentTermType === "DAYS_AFTER_PURCHASE" && <Field label="Dias após compra"><input type="number" min="0" value={daysAfterPurchase} onChange={(e) => setDaysAfterPurchase(Number(e.target.value))} className={input} /></Field>}
          {paymentTermType === "INSTALLMENTS" && <Field label="Número de parcelas"><input type="number" min="2" max="24" value={installmentCount} onChange={(e) => setInstallmentCount(Number(e.target.value))} className={input} /></Field>}
          {!["CASH", "DAYS_AFTER_PURCHASE"].includes(paymentTermType) && <Field label="Primeiro vencimento"><input type="date" value={firstDueDate} onChange={(e) => setFirstDueDate(e.target.value)} className={input} /></Field>}
          <Field label="Referência externa (opcional)"><input name="externalReference" className={input} /></Field>
          <Field label="Observações"><input name="commercialNotes" className={input} /></Field>
          <div className="rounded-lg border border-[var(--bbos-coffee-caramel)]/40 bg-[var(--bbos-surface-warm)] px-3 py-2 sm:col-span-2 lg:col-span-4">
            <div className="flex flex-wrap items-center gap-2"><span className="text-[11px] font-bold uppercase tracking-wide text-[var(--bbos-coffee-caramel)]">Intermediação</span><select aria-label="Corretor" className="rounded-lg border border-[var(--bbos-border)] bg-[var(--bbos-surface-elevated)] px-2 py-1.5 text-xs" value={brokerId} onChange={(event) => setBrokerId(event.target.value)}><option value="">Sem corretor ✓</option>{brokers.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{!selectedBroker && <span className="text-xs text-[var(--bbos-text-secondary)]">Custo total: {brl(totalValue)}</span>}</div>
            {selectedBroker && <div className="mt-2 grid gap-2 sm:grid-cols-3"><Field label="Comissão (%)"><input type="number" min="0" max="100" step="0.01" className={input} value={brokerCommissionPercent || ""} onChange={(event) => setBrokerCommissionPercent(Math.max(0, Number(event.target.value)))} /></Field><Metric label="Comissão estimada" value={brl(brokerCommissionAmount)} /><div className="rounded-lg border border-[var(--bbos-success-border)] bg-[var(--bbos-success-soft)] px-3 py-2"><span className="text-[11px] text-[var(--bbos-text-secondary)]">Custo total · fornecedor não muda</span><b className="mt-0.5 block text-base text-[var(--bbos-state-success)]">{brl(totalOperationCost)}</b></div></div>}
          </div>
        </Section>

        <Section title="E · Governança" tone="governance" icon={ShieldCheck}>
          <div className="rounded-lg bg-[var(--bbos-surface-subtle)] px-3 py-2"><p className="text-[11px] text-[var(--bbos-text-secondary)]">Comprador</p><b className="ml-1 text-sm">{sessionUser?.name ?? "—"} ✓</b></div>
          <Field label="Diretor aprovador"><select name="approverName" className={input} defaultValue=""><option value="">Seleção automática / próximo disponível</option>{currentApprovers.map((user) => <option key={user.id} value={user.name}>{user.name} · {user.role}</option>)}</select></Field>
          <div className="rounded-lg border border-[var(--bbos-success-border)] bg-[var(--bbos-success-soft)] px-3 py-2 text-xs"><ShieldCheck size={16} className="mr-1 inline text-[var(--bbos-state-success)]" /><b>Trilha registrada ✓</b></div>
        </Section>

        <Card data-purchase-id={submittedPurchaseId ?? undefined} className="border-[var(--bbos-success-border)] bg-[var(--bbos-success-soft)] p-3">
          <p className="text-xs font-bold uppercase tracking-[.12em] text-[var(--bbos-state-success)]">Confirmação da negociação</p>
          <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Summary label="Origem" value={`${originUnit?.name ?? "—"} · ${harvest}`} />
            <Summary label="Café" value={`${species?.name ?? "—"} · ${cultivar?.name ?? "—"}`} />
            <Summary label="Quantidade" value={`${volumes} × ${unitWeight} kg = ${totalWeight} kg`} />
            <Summary label="Comercial" value={`${brl(priceKg)}/kg · ${brl(totalValue)}`} />
            <Summary label="Corretagem" value={selectedBroker ? `${selectedBroker.name} · ${brokerCommissionPercent.toFixed(2)}% · ${brl(brokerCommissionAmount)}` : "Sem corretor"} />
            <Summary label="Custo total da operação" value={brl(totalOperationCost)} />
            <Summary label="Valor ao fornecedor" value={brl(totalValue)} />
            <Summary label="Embalagem" value={packagingLabels[packagingType] ?? "Outro"} />
            <Summary label="Pagamento" value={paymentTermType === "CASH" ? "À vista · 1 parcela" : `${installments.length} parcela(s)`} />
            <Summary label="Contato" value={selectedContact?.name ?? "—"} />
            <Summary label="Aprovação" value={submittedStatus ? "AGUARDANDO APROVAÇÃO" : sessionUser && ["ADMIN", "EXECUTIVE"].includes(sessionUser.role) ? "Usuário possui alçada" : "Enviar para aprovação"} />
          </div>
        </Card>

        </fieldset>

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Link href="/compras-cafe-verde" className="inline-flex min-h-11 items-center rounded-xl border bg-white px-4 text-sm font-bold">Cancelar</Link>
          <Button type="submit" disabled={submitting || Boolean(submittedNumber)} aria-disabled={submitting || Boolean(submittedNumber)}>{submitting ? "Enviando..." : submittedNumber ? "✓ Enviada para aprovação" : "Enviar para aprovação"}</Button>
        </div>
      </form>
    </div>
  );
}

type SectionTone = "origin" | "quality" | "quantity" | "commercial" | "governance";
function Section({ title, tone, icon: Icon, children }: { title: string; tone: SectionTone; icon: typeof MapPinned; children: React.ReactNode }) {
  const accent = { origin: "border-l-[var(--bbos-coffee-green)]", quality: "border-l-[var(--bbos-coffee-roasted)]", quantity: "border-l-[var(--bbos-state-information)]", commercial: "border-l-[var(--bbos-coffee-caramel)]", governance: "border-l-[var(--bbos-state-attention)]" }[tone];
  return <section className={`rounded-xl border border-[var(--bbos-border)] border-l-4 bg-[var(--bbos-surface-elevated)] px-3 py-2.5 ${accent}`}><h2 className="flex items-center gap-2 text-sm font-bold text-[var(--bbos-text-primary)]"><Icon size={15} aria-hidden="true" />{title}</h2><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{children}</div></section>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-0.5 block text-[11px] font-semibold text-[var(--bbos-text-secondary)]">{label}</span>{children}</label>;
}
function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-[var(--bbos-success-border)] bg-[var(--bbos-success-soft)] px-3 py-2"><span className="text-[11px] text-[var(--bbos-text-secondary)]">{label}</span><b className="mt-0.5 block text-base text-[var(--bbos-state-success)]">{value}</b></div>;
}
function Summary({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[11px] font-bold uppercase tracking-wide text-stone-400">{label}</p><p className="mt-1 font-semibold text-stone-800">{value}</p></div>;
}
