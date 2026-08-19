"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchSessionIdentity, type SessionIdentity } from "@/lib/auth-session";
import { getApiBaseUrl } from "@/lib/api-url";
import { Check, Plus, ShieldCheck, X } from "lucide-react";
import { Badge, Button, Card } from "@bbos/ui";

const ROOT = getApiBaseUrl();
const API = `${ROOT}/green-coffee-purchases`;
const input =
  "w-full rounded-xl border bg-stone-50 px-3 py-3 text-sm outline-none focus:border-forest-700";
type Supplier = {
  id: string;
  name: string;
  legalName?: string;
  taxId?: string;
  supplierType?: string;
  farmName?: string;
  city?: string;
  state?: string;
  country?: string;
  address?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  contacts?: SupplierContact[];
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
type Options = {
  company: { id: string } | null;
  suppliers: Supplier[];
  users: { id: string; name: string; role: string }[];
};
type SpeciesReference = {
  id: string;
  code: string;
  name: string;
  varieties: { id: string; code: string; name: string; breeder?: string | null; sortOrder?: number }[];
};
type ReferenceData = {
  species: SpeciesReference[];
  regions: { id: string; state: string; name: string; country: string }[];
  screenClassifications: { id: string; code: string; name: string }[];
};
type Purchase = {
  id: string;
  purchaseNumber: string;
  status: string;
  approvalStatus: string;
  operationalStatus: string;
  financialStatus: string;
  externalAcceptanceStatus: string;
  externalAcceptance?: {
    channel?: string;
    destinationMasked?: string;
    contactName?: string;
    sentAt?: string;
    viewedAt?: string;
    acceptedAt?: string;
    termsVersion?: string;
  } | null;
  termsVersion?: string;
  species: string;
  originRegion: string;
  harvest: string;
  contractedWeightKg: number;
  receivedKg: number;
  receivedPercent: number;
  balanceKg: number;
  totalValue: number;
  supplier: Supplier;
  farmName?: string;
  municipality?: string;
  state?: string;
  variety?: string;
  process?: string;
  supplierLotCode?: string;
  qualityCategory?: string;
  contractedScreen?: string;
  maxDefects?: number;
  maxMoisturePercent?: number;
  minimumScore?: number;
  volumeQuantity?: number;
  nominalUnitWeightKg?: number;
  weightTolerancePercent?: number;
  paymentTermType?: string;
  installments?: {
    installmentNumber: number;
    amount: string | number;
    dueDate: string;
    status: string;
  }[];
  createdByName?: string;
  createdAt?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectedByName?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  receipts?: {
    receiptNumber: string;
    netWeightKg: string | number;
    confirmedAt: string;
    qualityStatus: string;
    coffeeLot?: { code: string };
  }[];
  financial: {
    committed: number;
    paid: number;
    balance: number;
    nextPayment?: { amount: number; dueDate: string } | null;
  };
};
async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", ...init });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? "Falha na operação.");
  return data;
}
const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const label = (value: string) => value.replaceAll("_", " ");
const coffeeSpeciesLabel: Record<string, string> = {
  ARABICA: "Arábica",
  ROBUSTA: "Robusta",
  ROBUSTA_CONILON: "Robusta/Conilon",
  CANEPHORA: "Canephora/Robusta/Conilon",
};
const approvalLabel: Record<string, string> = {
  DRAFT: "Rascunho",
  PENDING_APPROVAL: "Pendente de aprovação",
  APPROVED: "Aprovada",
  REJECTED: "Reprovada",
};
const deliveryLabel: Record<string, string> = {
  NOT_STARTED: "Não iniciada",
  AWAITING_DELIVERY: "Aguardando entrega",
  PARTIALLY_RECEIVED: "Recebida parcialmente",
  RECEIVED: "Recebida",
  CANCELLED: "Cancelada",
};
const financialLabel: Record<string, string> = {
  NOT_COMMITTED: "Não comprometido",
  SCHEDULED: "Programado",
  PARTIALLY_PAID: "Parcialmente pago",
  PAID: "Pago",
  CANCELLED: "Cancelado",
};
const paymentLabel: Record<string, string> = {
  SINGLE: "Pagamento único",
  UPFRONT_BALANCE: "Antecipação + saldo",
  INSTALLMENTS: "Parcelado",
  CUSTOM: "Parcelas customizadas",
};
const qualityLabel: Record<string, string> = {
  AWAITING_ANALYSIS: "Aguardando análise",
  APPROVED: "Aprovado",
  APPROVED_WITH_RESTRICTION: "Aprovado com ressalva",
  BLOCKED: "Bloqueado",
  REJECTED: "Rejeitado",
};
const externalAcceptanceLabel: Record<string, string> = {
  NOT_SENT: "Não enviado",
  SENT: "Enviado",
  VIEWED: "Visualizado",
  ACCEPTED: "Confirmado",
  DECLINED: "Recusado",
  EXPIRED: "Expirado",
};

type CardStatus = {
  label: string;
  marker: string;
  surface: string;
  nextAction: string;
};

function cardStatus(row: Purchase): CardStatus {
  if (row.approvalStatus === "REJECTED") return { label: "Reprovada", marker: "bg-rose-600", surface: "bg-rose-50/50", nextAction: "Ver detalhes" };
  if (row.operationalStatus === "CANCELLED") return { label: "Cancelada", marker: "bg-rose-600", surface: "bg-rose-50/50", nextAction: "Ver detalhes" };
  if (row.operationalStatus === "RECEIVED" || row.balanceKg <= 0) return { label: "Concluída", marker: "bg-emerald-600", surface: "bg-emerald-50/50", nextAction: "Ver detalhes" };
  if (row.approvalStatus === "DRAFT" || row.approvalStatus === "PENDING_APPROVAL") return { label: "Em aprovação", marker: "bg-amber-700", surface: "bg-amber-50/50", nextAction: "Revisar compra" };
  if (row.approvalStatus === "APPROVED" && row.externalAcceptanceStatus !== "ACCEPTED") return { label: "Aguardando confirmação", marker: "bg-amber-600", surface: "bg-amber-50/50", nextAction: "Ver confirmação" };
  if (row.operationalStatus === "PARTIALLY_RECEIVED") return { label: "Em recebimento", marker: "bg-blue-600", surface: "bg-blue-50/50", nextAction: "Continuar recebimento" };
  return { label: "Aguardando entrega", marker: "bg-amber-600", surface: "bg-amber-50/50", nextAction: "Registrar recebimento" };
}

export default function Page() {
  const [options, setOptions] = useState<Options | null>(null),
    [references, setReferences] = useState<ReferenceData | null>(null),
    [rows, setRows] = useState<Purchase[]>([]),
    [open, setOpen] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [filter, setFilter] = useState("ALL"),
    [search, setSearch] = useState("");
  const [supplierId, setSupplierId] = useState(""),
    [speciesCode, setSpeciesCode] = useState("ARABICA"),
    [purchaseState, setPurchaseState] = useState("PR"),
    [volumes, setVolumes] = useState(1),
    [unitWeight, setUnitWeight] = useState(60),
    [priceKg, setPriceKg] = useState(0),
    [installmentCount, setInstallmentCount] = useState(1);
  const [supplierContacts, setSupplierContacts] = useState<SupplierContact[]>([]);
  const [contactDraft, setContactDraft] = useState({ name: "", role: "", whatsapp: "", email: "", isPrimary: false, canConfirmBusiness: true, active: true });
  const [contactMessage, setContactMessage] = useState("");
  const [sessionUser, setSessionUser] = useState<SessionIdentity | null>(null);
  const router = useRouter();
  const load = async () => {
    try {
      const [currentOptions, sessionResponse] = await Promise.all([
        req<Options>(`${ROOT}/receipts/options`, { credentials: "include" }),
        fetchSessionIdentity(ROOT),
      ]);
      const identity = sessionResponse;
      setSessionUser(identity);
      setOptions(currentOptions);
      setSupplierId((value) => value || currentOptions.suppliers[0]?.id || "");
      const [purchases, species] = await Promise.all([
        req<Purchase[]>(API, { credentials: "include" }),
        req<ReferenceData>(`${API}/references`, { credentials: "include" }),
      ]);
      setRows(purchases);
      setReferences(species);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (!supplierId) {
      setSupplierContacts([]);
      return;
    }
    void req<SupplierContact[]>(`${API}/suppliers/${supplierId}/contacts`)
      .then(setSupplierContacts)
      .catch(() => setSupplierContacts([]));
  }, [supplierId]);
  const supplier = options?.suppliers.find((item) => item.id === supplierId);
  const species = references?.species.find((item) => item.code === speciesCode);
  const regions = references?.regions.filter((region) => region.state === purchaseState) ?? [];
  const totalWeight = volumes * unitWeight,
    totalValue = totalWeight * priceKg;
  const totals = useMemo(
    () =>
      rows.reduce(
        (sum, row) => ({
          contracted: sum.contracted + row.contractedWeightKg,
          received: sum.received + row.receivedKg,
          committed: sum.committed + row.financial.committed,
          pending:
            sum.pending + (row.approvalStatus === "PENDING_APPROVAL" ? 1 : 0),
        }),
        { contracted: 0, received: 0, committed: 0, pending: 0 },
      ),
    [rows],
  );
  const filteredRows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return rows.filter((row) => {
      const status = cardStatus(row).label;
      const matchesFilter = filter === "ALL" || (filter === "APPROVAL" && status === "Em aprovação") || (filter === "DELIVERY" && status === "Aguardando entrega") || (filter === "RECEIVING" && status === "Em recebimento") || (filter === "DONE" && status === "Concluída");
      const matchesSearch = !term || row.purchaseNumber.toLocaleLowerCase().includes(term) || row.supplier.name.toLocaleLowerCase().includes(term);
      return matchesFilter && matchesSearch;
    });
  }, [filter, rows, search]);

  const addSupplierContact = async () => {
    if (!contactDraft.name.trim()) return setContactMessage("Informe o nome do contato.");
    try {
      const created = await req<SupplierContact>(`${API}/suppliers/${supplierId}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactDraft),
      });
      setSupplierContacts((items) => [...items, created]);
      setContactDraft({ name: "", role: "", whatsapp: "", email: "", isPrimary: false, canConfirmBusiness: true, active: true });
      setContactMessage("Contato comercial salvo.");
    } catch (cause) {
      setContactMessage(cause instanceof Error ? cause.message : "Falha ao salvar contato.");
    }
  };

  const act = async (purchase: Purchase, action: "approve" | "reject") => {
    if (!sessionUser || !["EXECUTIVE", "ADMIN"].includes(sessionUser.role))
      return setError(
        "Nenhum Diretor/Administrador ativo disponível para esta decisão.",
      );
    try {
      await req(`${API}/${purchase.id}/${action}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "reject"
            ? { reason: "Reprovada na revisão de governança" }
            : {},
        ),
      });
      setMessage(
        `${purchase.purchaseNumber} ${action === "approve" ? "aprovada e comprometida no financeiro" : "reprovada"}.`,
      );
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha na decisão.");
    }
  };

  const sendAcceptance = async (purchase: Purchase) => {
    if (!sessionUser || !["EXECUTIVE", "ADMIN"].includes(sessionUser.role)) return setError("Somente Diretor/Administrador pode enviar para aceite.");
    try {
      const result = await req<{ url: string; whatsappUrl?: string | null }>(
        `${API}/${purchase.id}/acceptance/send`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channel: "WHATSAPP" }),
        },
      );
      if (result.whatsappUrl && typeof window !== "undefined")
        window.open(result.whatsappUrl, "_blank", "noopener,noreferrer");
      setMessage(`Ficha ${purchase.purchaseNumber} enviada para aceite. Link: ${result.url}`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao enviar para aceite.");
    }
  };

  const submit = async (
    event: React.FormEvent<HTMLFormElement>,
    action: "DRAFT" | "SUBMIT" | "APPROVE",
  ) => {
    event.preventDefault();
    if (!sessionUser || !supplier) return;
    const form = new FormData(event.currentTarget);
    if (!sessionUser) return setError("Sessão não autenticada.");
    const due = String(form.get("firstDueDate"));
    const amountBase = Math.floor((totalValue * 100) / installmentCount) / 100;
    let allocated = 0;
    const installments = Array.from(
      { length: installmentCount },
      (_, index) => {
        const amount =
          index === installmentCount - 1
            ? Math.round((totalValue - allocated) * 100) / 100
            : amountBase;
        allocated = Math.round((allocated + amount) * 100) / 100;
        const date = new Date(`${due}T12:00:00`);
        date.setMonth(date.getMonth() + index);
        const percentageBase = Math.floor(10000 / installmentCount) / 100;
        return {
          installmentNumber: index + 1,
          percentage:
            index === installmentCount - 1
              ? Math.round((100 - percentageBase * index) * 100) / 100
              : percentageBase,
          amount,
          dueDate: date.toISOString(),
        };
      },
    );
    try {
      const cultivarId = String(form.get("cultivarId") || "");
      const cultivar = species?.varieties.find((item) => item.id === cultivarId);
      const regionId = String(form.get("coffeeRegionId") || "");
      const region = regions.find((item) => item.id === regionId);
      const screenClassificationId = String(form.get("screenClassificationId") || "");
      const screenClassification = references?.screenClassifications.find((item) => item.id === screenClassificationId);
      const selectedSpecies = references?.species.find((item) => item.code === speciesCode);
      const result = await req<{ purchaseNumber: string }>(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          idempotencyKey: crypto.randomUUID(),
          action,
          department: form.get("department"),
          approverName: form.get("approverName"),
          purchasedAt: new Date().toISOString(),
          species: speciesCode,
          speciesId: selectedSpecies?.id,
          originRegion: region?.name ?? "",
          municipality: supplier.city,
          state: purchaseState,
          country: supplier.country ?? "Brasil",
          farmName: supplier.farmName,
          harvest: form.get("harvest"),
          variety: cultivar?.code,
          cultivarId,
          process: form.get("process"),
          supplierLotCode: form.get("supplierLotCode"),
          qualityCategory: form.get("qualityCategory"),
          additionalSpecification: form.get("additionalSpecification"),
          contractedScreen: screenClassification?.name,
          screenClassificationId,
          coffeeRegionId: regionId,
          maxDefects: Number(form.get("maxDefects")) || undefined,
          maxMoisturePercent:
            Number(form.get("maxMoisturePercent")) || undefined,
          minimumScore: form.get("minimumScore")
            ? Number(form.get("minimumScore"))
            : undefined,
          packagingType: form.get("packagingType"),
          volumeQuantity: volumes,
          nominalUnitWeightKg: unitWeight,
          contractedWeightKg: totalWeight,
          weightTolerancePercent:
            Number(form.get("weightTolerancePercent")) || 0,
          pricePerKg: priceKg,
          currency: "BRL",
          totalValue,
          paymentTermType: form.get("paymentTermType"),
          paymentTermData: { installmentCount },
          installments,
          expectedAt: form.get("expectedAt")
            ? new Date(String(form.get("expectedAt"))).toISOString()
            : undefined,
          contractReference: form.get("contractReference"),
          commercialNotes: form.get("commercialNotes"),
        }),
      });
      setOpen(false);
      setMessage(
        `${result.purchaseNumber} ${action === "DRAFT" ? "salva como rascunho" : action === "APPROVE" ? "aprovada" : "enviada para aprovação"}.`,
      );
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao salvar.");
    }
  };

  return (
    <div className="mx-auto max-w-[1480px]">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.14em] text-forest-700">
            Suprimentos · Café verde
          </p>
          <h1 className="mt-2 text-3xl font-bold">Compras de café verde</h1>
          <p className="mt-2 text-sm text-stone-500">
            Aquisição, governança, financeiro e rastreabilidade desde a origem.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus size={16} />
          Nova compra
        </Button>
      </header>
      {message && (
        <p className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
          <Check className="mr-2 inline" size={15} />
          {message}
        </p>
      )}
      {error && (
        <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Compras", rows.length.toString()],
          ["Contratado", `${totals.contracted.toLocaleString("pt-BR")} kg`],
          ["Recebido", `${totals.received.toLocaleString("pt-BR")} kg`],
          ["Comprometido", brl(totals.committed)],
          ["Pendente de aprovação", totals.pending.toString()],
        ].map(([title, value]) => (
          <Card className="p-5" key={title}>
            <p className="text-xs text-stone-500">{title}</p>
            <b className="mt-3 block text-xl">{value}</b>
          </Card>
        ))}
      </div>
      <div className="mt-7 flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          {[['ALL', `Todas · ${rows.length}`], ['APPROVAL', `Em aprovação · ${rows.filter((row) => cardStatus(row).label === "Em aprovação").length}`], ['DELIVERY', `Aguardando entrega · ${rows.filter((row) => cardStatus(row).label === "Aguardando entrega").length}`], ['RECEIVING', `Em recebimento · ${rows.filter((row) => cardStatus(row).label === "Em recebimento").length}`], ['DONE', `Concluídas · ${rows.filter((row) => cardStatus(row).label === "Concluída").length}`]].map(([value, text]) => <button key={value} type="button" onClick={() => setFilter(value ?? "ALL")} className={`rounded-lg px-3 py-2 transition ${filter === value ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"}`}>{text}</button>)}
        </div>
        <input aria-label="Buscar compra ou fornecedor" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar CP ou fornecedor" className="w-full rounded-xl border bg-stone-50 px-3 py-2.5 text-sm outline-none focus:border-forest-700 sm:max-w-xs" />
      </div>
      <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredRows.map((row) => {
          const status = cardStatus(row);
          return (
          <Card
            key={row.id}
            className={`cursor-pointer p-5 transition hover:-translate-y-0.5 hover:shadow-lg ${status.surface}`}
            role="button"
            tabIndex={0}
            aria-label={`Abrir ficha da compra ${row.purchaseNumber}`}
            onClick={() => router.push(`/compras-cafe-verde/${row.id}`)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                router.push(`/compras-cafe-verde/${row.id}`);
              }
            }}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <b>{row.purchaseNumber}</b>
              <span className="inline-flex items-center gap-2 text-xs font-bold text-stone-800"><i className={`size-2 rounded-full ${status.marker}`} />{status.label}</span>
            </div>
            <p className="mt-3 font-semibold">{row.supplier.name}</p>
            <p className="mt-1 text-xs text-stone-500">
              {row.farmName ? `${row.farmName} · ` : ""}
              {coffeeSpeciesLabel[row.species] ?? label(row.species)} · {row.originRegion} · Safra {row.harvest}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-4 text-xs">
              <span>
                Contratado
                <br />
                <b>{row.contractedWeightKg} kg</b>
              </span>
              <span>
                Recebido
                <br />
                <b>{row.receivedKg} kg</b>
              </span>
              <span>
                Saldo físico
                <br />
                <b>{row.balanceKg} kg</b>
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-stone-50 p-3 text-xs">
              <span>
                Valor
                <br />
                <b>{brl(row.totalValue)}</b>
              </span>
              <span>
                Comprometido
                <br />
                <b>{brl(row.financial.committed)}</b>
              </span>
              <span>
                Pago
                <br />
                <b>{brl(row.financial.paid)}</b>
              </span>
              <span>
                Saldo financeiro
                <br />
                <b>{brl(row.financial.balance)}</b>
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-stone-200/70 pt-3 text-xs text-stone-600">
              {row.approvalStatus === "APPROVED" && <span>✓ Compra aprovada</span>}
              {row.externalAcceptanceStatus === "ACCEPTED" && <span>✓ Contrato confirmado</span>}
              <span className="ml-auto font-bold text-forest-800">{status.nextAction} →</span>
            </div>
            {row.approvalStatus === "PENDING_APPROVAL" &&
              ["EXECUTIVE", "ADMIN"].includes(
                sessionUser?.role ?? "",
              ) && (
                <div className="mt-3 flex gap-2">
                  <button
                    className="min-h-11 rounded-xl bg-forest-800 px-3 text-xs font-bold text-white"
                    onClick={(event) => {
                      event.stopPropagation();
                      void act(row, "approve");
                    }}
                  >
                    Aprovar
                  </button>
                  <button
                    className="min-h-11 rounded-xl border px-3 text-xs font-bold"
                    onClick={(event) => {
                      event.stopPropagation();
                      void act(row, "reject");
                    }}
                  >
                    Reprovar
                  </button>
                </div>
              )}
            {row.approvalStatus === "PENDING_APPROVAL" &&
              !["EXECUTIVE", "ADMIN"].includes(
                sessionUser?.role ?? "",
              ) && (
                <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">
                  Aguardando aprovação da diretoria
                </p>
              )}
            {row.approvalStatus === "APPROVED" && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {row.externalAcceptanceStatus !== "ACCEPTED" && (
                  <button
                    className="min-h-11 rounded-xl bg-forest-900 px-3 text-xs font-bold text-white"
                    onClick={(event) => {
                      event.stopPropagation();
                      void sendAcceptance(row);
                    }}
                  >
                    {row.externalAcceptanceStatus === "SENT" || row.externalAcceptanceStatus === "VIEWED"
                      ? "Reenviar confirmação"
                      : "Gerar link de confirmação"}
                  </button>
                )}
                {row.externalAcceptanceStatus === "ACCEPTED" && (
                  <a
                    href={`/recebimento?purchase=${row.id}`}
                    onClick={(event) => event.stopPropagation()}
                    className="inline-flex min-h-11 items-center text-xs font-bold text-forest-700"
                  >
                    Registrar recebimento →
                  </a>
                )}
              </div>
            )}
          </Card>
          );
        })}
      </div>
      {open && options && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-forest-950/30 p-3">
          <form
            onSubmit={(event) => void submit(event, "SUBMIT")}
            className="max-h-[96vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-7"
          >
            <div className="flex justify-between">
              <div>
                <p className="text-xs font-bold uppercase text-forest-700">
                  Ficha de compra
                </p>
                <h2 className="mt-1 text-xl font-bold">
                  Nova compra de café verde
                </h2>
              </div>
              <button
                type="button"
                className="min-h-11 min-w-11"
                onClick={() => setOpen(false)}
              >
                <X />
              </button>
            </div>
            <Section title="A · Origem">
              <Field label="Fornecedor">
                <select
                  required
                  className={input}
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                >
                  {options.suppliers.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {item.taxId}
                    </option>
                  ))}
                </select>
              </Field>
              {supplier && (
                <div className="rounded-xl bg-stone-50 p-3 text-xs sm:col-span-2">
                  <b>{supplier.legalName ?? supplier.name}</b>
                  <p className="mt-1 text-stone-500">
                    {supplier.farmName ?? "Sem propriedade informada"} ·{" "}
                    {supplier.city ?? "—"}/{supplier.state ?? "—"}
                  </p>
                  <p className="text-stone-500">
                    {supplier.contactName ?? "Contato não informado"} ·{" "}
                    {supplier.contactPhone ?? supplier.contactEmail ?? "—"}
                  </p>
                  <div className="mt-3 border-t border-stone-200 pt-3">
                    <p className="font-bold text-stone-700">Contatos comerciais</p>
                    {supplierContacts.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {supplierContacts.map((contact) => (
                          <div key={contact.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-2">
                            <span>
                              <b>{contact.name}</b>{contact.role ? ` · ${contact.role}` : ""}
                              <span className="ml-1 text-stone-500">{contact.whatsapp ?? contact.email ?? "Sem canal"}</span>
                            </span>
                            {contact.canConfirmBusiness && <span className="font-semibold text-forest-700">Autorizado</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <input aria-label="Nome completo do contato" placeholder="Nome completo" value={contactDraft.name} onChange={(event) => setContactDraft((draft) => ({ ...draft, name: event.target.value }))} className={input} />
                      <input aria-label="Cargo ou função" placeholder="Cargo/função" value={contactDraft.role} onChange={(event) => setContactDraft((draft) => ({ ...draft, role: event.target.value }))} className={input} />
                      <input aria-label="WhatsApp do contato" placeholder="WhatsApp" value={contactDraft.whatsapp} onChange={(event) => setContactDraft((draft) => ({ ...draft, whatsapp: event.target.value }))} className={input} />
                      <input aria-label="E-mail do contato" type="email" placeholder="E-mail" value={contactDraft.email} onChange={(event) => setContactDraft((draft) => ({ ...draft, email: event.target.value }))} className={input} />
                    </div>
                    <label className="mt-2 flex items-center gap-2 text-xs text-stone-600">
                      <input type="checkbox" checked={contactDraft.canConfirmBusiness} onChange={(event) => setContactDraft((draft) => ({ ...draft, canConfirmBusiness: event.target.checked }))} />
                      Autorizado a confirmar negócios
                    </label>
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-stone-600">
                      <label className="flex items-center gap-2"><input type="checkbox" checked={contactDraft.isPrimary} onChange={(event) => setContactDraft((draft) => ({ ...draft, isPrimary: event.target.checked }))} /> Contato principal</label>
                      <label className="flex items-center gap-2"><input type="checkbox" checked={contactDraft.active} onChange={(event) => setContactDraft((draft) => ({ ...draft, active: event.target.checked }))} /> Ativo</label>
                    </div>
                    <button type="button" className="mt-2 min-h-10 rounded-lg border px-3 text-xs font-bold" onClick={() => void addSupplierContact()}>
                      Adicionar contato
                    </button>
                    {contactMessage && <p className="mt-1 text-[11px] text-stone-500">{contactMessage}</p>}
                  </div>
                </div>
              )}
              <Field label="Estado">
                <select required name="state" value={purchaseState} onChange={(event) => setPurchaseState(event.target.value)} className={input}>
                  {["PR", "SP", "MG", "ES", "BA", "RJ", "RO", "GO"].map((state) => <option key={state} value={state}>{state}</option>)}
                </select>
              </Field>
              <Field label="Região cafeeira">
                <select key={purchaseState} required name="coffeeRegionId" className={input} defaultValue="">
                  <option value="" disabled>Selecione a região</option>
                  {regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}
                </select>
              </Field>
              <Field label="Safra">
                <input
                  required
                  name="harvest"
                  placeholder="2026/27"
                  className={input}
                />
              </Field>
              <Field label="Espécie">
                <select
                  required
                  className={input}
                  value={speciesCode}
                  onChange={(e) => setSpeciesCode(e.target.value)}
                >
                  {references?.species.map((item) => (
                    <option key={item.id} value={item.code}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Variedade/Cultivar">
                <select key={speciesCode} required name="cultivarId" className={input} defaultValue="">
                  <option value="" disabled>Selecione a cultivar</option>
                  {species?.varieties.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Field>
            </Section>
            <Section title="B · Especificação contratada">
              <Field label="Processo">
                <select name="process" className={input}>
                  {[
                    "Natural",
                    "Cereja Descascado",
                    "Honey",
                    "Lavado",
                    "Fermentado",
                    "Outro",
                  ].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </Field>
              <Field label="Qualidade contratada">
                <select name="qualityCategory" className={input}>
                  {[
                    "Especial",
                    "Gourmet",
                    "Fine Cup",
                    "Good Cup",
                    "Comercial",
                    "Robusta/Conilon",
                    "Outra",
                  ].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </Field>
              <Field label="Peneira">
                <select required name="screenClassificationId" className={input} defaultValue="">
                  <option value="" disabled>Selecione a classificação</option>
                  {references?.screenClassifications.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
              <Field label="Máx. defeitos">
                <input name="maxDefects" type="number" className={input} />
              </Field>
              <Field label="Umidade máxima (%)">
                <select name="maxMoisturePercent" defaultValue="12.0" className={input}>
                  {Array.from({ length: 26 }, (_, index) => (10 + index / 10).toFixed(1)).map((value) => <option key={value} value={value}>{value.replace(".", ",")} %</option>)}
                </select>
              </Field>
              <Field label="Pontuação mínima (opcional)">
                <input
                  name="minimumScore"
                  type="number"
                  step=".25"
                  className={input}
                />
              </Field>
              <Field label="Especificação adicional">
                <input name="additionalSpecification" className={input} />
              </Field>
            </Section>
            <Section title="C · Quantidade / embalagem">
              <Field label="Acondicionamento">
                <select
                  name="packagingType"
                  className={input}
                  onChange={(e) => {
                    if (e.target.value === "BAG_30_KG") setUnitWeight(30);
                    if (e.target.value === "BAG_60_KG") setUnitWeight(60);
                  }}
                >
                  <option value="BAG_30_KG">Saca 30 kg</option>
                  <option value="BAG_60_KG">Saca 60 kg</option>
                  <option value="BIG_BAG">Big Bag</option>
                  <option value="OTHER">Outro</option>
                </select>
              </Field>
              <Field label="Número de volumes">
                <input
                  required
                  type="number"
                  min="1"
                  value={volumes}
                  onChange={(e) => setVolumes(Number(e.target.value))}
                  className={input}
                />
              </Field>
              <Field label="Peso nominal/volume">
                <input
                  required
                  type="number"
                  min=".01"
                  step=".01"
                  value={unitWeight}
                  onChange={(e) => setUnitWeight(Number(e.target.value))}
                  className={input}
                />
              </Field>
              <Field label="Tolerância de peso (%)">
                <input
                  name="weightTolerancePercent"
                  type="number"
                  step=".01"
                  defaultValue="0"
                  className={input}
                />
              </Field>
              <div className="rounded-xl bg-forest-50 p-4">
                <span className="text-xs text-stone-500">
                  Peso total contratado
                </span>
                <b className="mt-1 block text-xl">
                  {totalWeight.toLocaleString("pt-BR")} kg
                </b>
              </div>
            </Section>
            <Section title="D · Comercial">
              <Field label="Preço/kg">
                <input
                  required
                  type="number"
                  min=".01"
                  step=".01"
                  value={priceKg || ""}
                  onChange={(e) => setPriceKg(Number(e.target.value))}
                  className={input}
                />
              </Field>
              <div className="rounded-xl bg-forest-50 p-4">
                <span className="text-xs text-stone-500">
                  Valor total da compra
                </span>
                <b className="mt-1 block text-xl">{brl(totalValue)}</b>
              </div>
              <Field label="Entrega prevista">
                <input name="expectedAt" type="date" className={input} />
              </Field>
              <Field label="Condição de pagamento">
                <select name="paymentTermType" className={input}>
                  <option value="CASH">À vista</option>
                  <option value="DAYS_AFTER_PURCHASE">X dias</option>
                  <option value="FIXED_DATE">Data definida</option>
                  <option value="INSTALLMENTS">Parcelado</option>
                  <option value="ADVANCE_AND_BALANCE">
                    Antecipado + saldo
                  </option>
                  <option value="AFTER_RECEIPT">Após recebimento</option>
                  <option value="CUSTOM">Customizado</option>
                </select>
              </Field>
              <Field label="Número de parcelas">
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={installmentCount}
                  onChange={(e) => setInstallmentCount(Number(e.target.value))}
                  className={input}
                />
              </Field>
              <Field label="Primeiro vencimento">
                <input
                  required
                  name="firstDueDate"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  className={input}
                />
              </Field>
              <Field label="Contrato/referência">
                <input name="contractReference" className={input} />
              </Field>
              <Field label="Observações">
                <input name="commercialNotes" className={input} />
              </Field>
            </Section>
            <Section title="E · Governança">
              <div className="rounded-xl bg-stone-50 p-4 text-sm">
                <span className="text-xs text-stone-500">
                  Comprador responsável
                </span>
                <b className="mt-1 block">{sessionUser?.name ?? "—"}</b>
                <span className="text-xs text-stone-500">
                  {sessionUser?.role ?? "—"}
                </span>
              </div>
              <Field label="Departamento">
                <input
                  name="department"
                  defaultValue="COMPRAS"
                  className={input}
                />
              </Field>
              <Field label="Diretor aprovador">
                <input name="approverName" className={input} />
              </Field>
              <div className="rounded-xl border p-4 text-xs">
                <ShieldCheck className="mb-2 text-forest-700" size={20} />
                <b>Governança separada da operação</b>
                <p className="mt-1 text-stone-500">
                  Compras sem poder de aprovação ficam pendentes.
                  Diretor/Administrador pode aprovar diretamente.
                </p>
              </div>
            </Section>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                onClick={(e) => {
                  const form = e.currentTarget.closest("form");
                  if (form)
                    void submit(
                      {
                        currentTarget: form,
                        preventDefault: () => {},
                      } as React.FormEvent<HTMLFormElement>,
                      "DRAFT",
                    );
                }}
              >
                Salvar rascunho
              </Button>
              <Button type="submit">Enviar para aprovação</Button>
              {["EXECUTIVE", "ADMIN"].includes(
                sessionUser?.role ?? "",
              ) && (
                <Button
                  type="button"
                  onClick={(e) => {
                    const form = e.currentTarget.closest("form");
                    if (form)
                      void submit(
                        {
                          currentTarget: form,
                          preventDefault: () => {},
                        } as React.FormEvent<HTMLFormElement>,
                        "APPROVE",
                      );
                  }}
                >
                  Aprovar diretamente
                </Button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 rounded-2xl border p-4">
      <h3 className="text-xs font-bold uppercase tracking-[.12em] text-forest-700">
        {title}
      </h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </div>
    </section>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="text-xs font-semibold">{label}</span>
      {children}
    </label>
  );
}

// Kept as a compatibility component for callers from the earlier V2.1 modal implementation.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function PurchaseDetails({
  purchase,
  onClose,
  onSendAcceptance,
}: {
  purchase: Purchase;
  onClose: () => void;
  onSendAcceptance: () => void;
}) {
  const detail = (title: string, value: React.ReactNode) => (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-stone-500">
        {title}
      </p>
      <p className="mt-1 text-sm font-semibold">{value || "—"}</p>
    </div>
  );
  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-forest-950/30 p-3"
      onClick={onClose}
    >
      <section
        className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-7"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-forest-700">
              Ficha completa da compra
            </p>
            <h2 className="mt-1 text-2xl font-bold">
              {purchase.purchaseNumber}
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              {purchase.supplier.name} ·{" "}
              {purchase.supplier.taxId ?? "Documento não informado"}
            </p>
          </div>
          <button
            className="min-h-11 min-w-11"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X />
          </button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="p-4 sm:col-span-2 lg:col-span-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-forest-700">
              Status
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge
                tone={
                  purchase.approvalStatus === "APPROVED"
                    ? "success"
                    : purchase.approvalStatus === "REJECTED"
                      ? "danger"
                      : "warning"
                }
              >
                {approvalLabel[purchase.approvalStatus] ??
                  purchase.approvalStatus}
              </Badge>
              <Badge>
                {purchase.approvalStatus === "APPROVED" && purchase.externalAcceptanceStatus !== "ACCEPTED"
                  ? "Aguardando aceite"
                  : deliveryLabel[purchase.operationalStatus] ?? purchase.operationalStatus}
              </Badge>
              <Badge>
                {financialLabel[purchase.financialStatus] ??
                  purchase.financialStatus}
              </Badge>
              <Badge>
                {externalAcceptanceLabel[purchase.externalAcceptanceStatus] ??
                  purchase.externalAcceptanceStatus}
              </Badge>
            </div>
          </Card>
          <Card className="p-4 sm:col-span-2 lg:col-span-3">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-forest-700">
                  Aceite do fornecedor
                </h3>
                <p className="mt-2 text-sm font-semibold">
                  {externalAcceptanceLabel[purchase.externalAcceptanceStatus] ??
                    purchase.externalAcceptanceStatus}
                </p>
                {purchase.externalAcceptance && (
                  <p className="mt-1 text-xs text-stone-500">
                    Canal: {purchase.externalAcceptance.channel ?? "—"} · Contato: {purchase.externalAcceptance.contactName ?? "—"} · Versão: {purchase.externalAcceptance.termsVersion ?? purchase.termsVersion ?? "—"}
                  </p>
                )}
              </div>
              {purchase.approvalStatus === "APPROVED" &&
                purchase.externalAcceptanceStatus !== "ACCEPTED" && (
                  <Button onClick={onSendAcceptance}>Enviar para aceite</Button>
                )}
            </div>
          </Card>
          <Card className="p-4 sm:col-span-2 lg:col-span-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-forest-700">
              Identificação
            </h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {detail("Fornecedor", purchase.supplier.name)}
              {detail(
                "Fazenda / propriedade",
                purchase.farmName ?? purchase.supplier.farmName,
              )}
              {detail(
                "Município / estado",
                `${purchase.municipality ?? purchase.supplier.city ?? "—"} / ${purchase.state ?? purchase.supplier.state ?? "—"}`,
              )}
              {detail("Região", purchase.originRegion)}
              {detail("Espécie", purchase.species)}
              {detail("Variedade", purchase.variety)}
              {detail("Safra", purchase.harvest)}
              {detail("Processo", purchase.process)}
              {detail("Lote fornecedor", purchase.supplierLotCode)}
            </div>
          </Card>
          <Card className="p-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-forest-700">
              Qualidade contratada
            </h3>
            <div className="mt-4 grid gap-4">
              {detail("Categoria", purchase.qualityCategory)}
              {detail("Peneira", purchase.contractedScreen)}
              {detail("Máx. defeitos", purchase.maxDefects)}
              {detail(
                "Umidade máxima",
                purchase.maxMoisturePercent
                  ? `${purchase.maxMoisturePercent}%`
                  : "—",
              )}
              {detail("Pontuação mínima", purchase.minimumScore)}
            </div>
          </Card>
          <Card className="p-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-forest-700">
              Quantidade
            </h3>
            <div className="mt-4 grid gap-4">
              {detail("Volumes", purchase.volumeQuantity)}
              {detail(
                "Peso contratado",
                `${purchase.contractedWeightKg.toLocaleString("pt-BR")} kg`,
              )}
              {detail(
                "Recebido",
                `${purchase.receivedKg.toLocaleString("pt-BR")} kg`,
              )}
              {detail(
                "Saldo físico",
                `${purchase.balanceKg.toLocaleString("pt-BR")} kg`,
              )}
              {detail(
                "Tolerância",
                purchase.weightTolerancePercent
                  ? `${purchase.weightTolerancePercent}%`
                  : "0%",
              )}
            </div>
          </Card>
          <Card className="p-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-forest-700">
              Comercial / financeiro
            </h3>
            <div className="mt-4 grid gap-4">
              {detail("Valor total", brl(purchase.totalValue))}
              {detail("Comprometido", brl(purchase.financial.committed))}
              {detail("Pago", brl(purchase.financial.paid))}
              {detail("Saldo", brl(purchase.financial.balance))}
              {detail(
                "Condição",
                purchase.paymentTermType
                  ? paymentLabel[purchase.paymentTermType] ?? label(purchase.paymentTermType)
                  : "—",
              )}
              {purchase.financial.nextPayment &&
                detail(
                  "Próximo vencimento",
                  `${brl(purchase.financial.nextPayment.amount)} · ${new Date(purchase.financial.nextPayment.dueDate).toLocaleDateString("pt-BR")}`,
                )}
            </div>
          </Card>
          <Card className="p-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-forest-700">
              Governança
            </h3>
            <div className="mt-4 grid gap-4">
              {detail("Criado por", purchase.createdByName)}
              {detail(
                "Criado em",
                purchase.createdAt &&
                  new Date(purchase.createdAt).toLocaleString("pt-BR"),
              )}
              {detail("Aprovado por", purchase.approvedByName)}
              {detail(
                "Aprovado em",
                purchase.approvedAt &&
                  new Date(purchase.approvedAt).toLocaleString("pt-BR"),
              )}
              {detail("Reprovado por", purchase.rejectedByName)}
              {detail("Motivo", purchase.rejectionReason)}
            </div>
          </Card>
          <Card className="p-4 sm:col-span-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-forest-700">
              Recebimentos vinculados
            </h3>
            {purchase.receipts?.length ? (
              <div className="mt-3 space-y-2">
                {purchase.receipts.map((receipt) => (
                  <div
                    className="grid grid-cols-2 gap-2 rounded-xl bg-stone-50 p-3 text-xs sm:grid-cols-4"
                    key={receipt.receiptNumber}
                  >
                    <b>{receipt.receiptNumber}</b>
                    <span>
                      {Number(receipt.netWeightKg).toLocaleString("pt-BR")} kg
                    </span>
                    <span>{receipt.coffeeLot?.code ?? "—"}</span>
                    <span>
                      {qualityLabel[receipt.qualityStatus] ?? label(receipt.qualityStatus)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-stone-500">
                Nenhum recebimento vinculado.
              </p>
            )}
          </Card>
        </div>
        {purchase.approvalStatus === "APPROVED" && (
          <a
            className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-forest-900 px-4 py-2.5 text-sm font-semibold text-white"
            href={`/recebimento?purchase=${purchase.id}`}
          >
            Registrar recebimento
          </a>
        )}
      </section>
    </div>
  );
}
