"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, ExternalLink, Send } from "lucide-react";
import { Badge, Button, Card } from "@bbos/ui";
import { getApiBaseUrl } from "@/lib/api-url";
import { fetchSessionIdentity, type SessionIdentity } from "@/lib/auth-session";

const API_ROOT = getApiBaseUrl();
const approval: Record<string, string> = {
  DRAFT: "Rascunho",
  PENDING_APPROVAL: "Pendente de aprovação",
  APPROVED: "Aprovada",
  REJECTED: "Reprovada",
};
const delivery: Record<string, string> = {
  NOT_STARTED: "Não iniciada",
  AWAITING_DELIVERY: "Aguardando entrega",
  PARTIALLY_RECEIVED: "Recebida parcialmente",
  RECEIVED: "Recebida",
  CANCELLED: "Cancelada",
};
const financial: Record<string, string> = {
  NOT_COMMITTED: "Não comprometido",
  SCHEDULED: "Programado",
  PARTIALLY_PAID: "Parcialmente pago",
  PAID: "Pago",
  CANCELLED: "Cancelado",
};
const external: Record<string, string> = {
  NOT_SENT: "Não enviado",
  SENT: "Enviado",
  VIEWED: "Visualizado",
  ACCEPTED: "Confirmado",
  DECLINED: "Recusado",
  EXPIRED: "Expirado",
};
const speciesLabel: Record<string, string> = { ARABICA: "Arábica", ROBUSTA: "Robusta", ROBUSTA_CONILON: "Robusta/Conilon", CANEPHORA: "Canephora/Robusta/Conilon" };
const processLabel: Record<string, string> = { NATURAL: "Natural", CEREJA_DESCASCADO: "Cereja descascado", HONEY: "Honey", LAVADO: "Lavado", FERMENTADO: "Fermentado", OUTRO: "Outro" };
const formatCatalog = (value?: string | null) => value ? value.replaceAll("_", " ").replace(/\bIPR\s+(\d+)/i, "IPR $1").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "—";
type Purchase = {
  id: string;
  purchaseNumber: string;
  approvalStatus: string;
  operationalStatus: string;
  financialStatus: string;
  externalAcceptanceStatus: string;
  supplier: { id?: string; name: string; taxId?: string | null; farmName?: string | null; city?: string | null; state?: string | null; whatsapp?: string | null; contactEmail?: string | null; contacts?: { id: string; name: string; role?: string | null; whatsapp?: string | null; email?: string | null }[] };
  farmName?: string | null;
  municipality?: string | null;
  state?: string | null;
  species: string;
  originRegion: string;
  harvest: string;
  variety?: string | null;
  process?: string | null;
  supplierLotCode?: string | null;
  qualityCategory?: string | null;
  contractedScreen?: string | null;
  maxDefects?: number | null;
  maxMoisturePercent?: number | null;
  minimumScore?: number | null;
  volumeQuantity: number;
  contractedWeightKg: number;
  receivedKg: number;
  balanceKg: number;
  totalValue: number;
  pricePerKg?: number | null;
  expectedAt?: string | null;
  financial: { committed: number; paid: number; balance: number };
  createdByName?: string;
  createdAt?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectedByName?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  returnedByUserId?: string | null;
  returnedByName?: string | null;
  returnedAt?: string | null;
  returnReason?: string | null;
  correctionRequest?: string | null;
  receipts?: { receiptNumber: string; netWeightKg: number; confirmedAt: string; coffeeLot?: { code: string } }[];
  paymentTermType?: string;
  installments?: { installmentNumber: number; amount: number; dueDate: string }[];
  termsVersion?: string;
  termsDocumentUrl?: string | null;
  acceptanceConditionText?: string | null;
  externalAcceptance?: { status?: string; channel?: string; destinationMasked?: string; contactName?: string; sentAt?: string; viewedAt?: string; acceptedAt?: string; termsVersion?: string; snapshot?: unknown; acceptedByName?: string | null; acceptedByRole?: string | null; documentHash?: string } | null;
};

export default function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [sessionUser, setSessionUser] = useState<SessionIdentity | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [contractOpen, setContractOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [correctionRequest, setCorrectionRequest] = useState("");
  const [busy, setBusy] = useState(false);
  const [acceptanceUrl, setAcceptanceUrl] = useState("");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [selectedContactId, setSelectedContactId] = useState("");
  const acceptanceInputRef = useRef<HTMLInputElement>(null);
  const [approvalConfirmOpen, setApprovalConfirmOpen] = useState(false);
  const [validationMissing, setValidationMissing] = useState<string[]>([]);
  const load = async (id: string) => {
    const [purchaseResponse, sessionIdentity] = await Promise.all([
      fetch(`${API_ROOT}/green-coffee-purchases/${id}`, { credentials: "include" }),
      fetchSessionIdentity(API_ROOT),
    ]);
    const data = await purchaseResponse.json();
    if (!purchaseResponse.ok) throw new Error(data.message ?? "Compra não encontrada.");
    setPurchase(data);
    if (data.externalAcceptanceStatus === "ACCEPTED") setAcceptanceUrl("");
    if (data.supplier?.contacts?.length === 1) setSelectedContactId(data.supplier.contacts[0].id);
    setSessionUser(sessionIdentity);
  };
  useEffect(() => {
    void params.then(({ id }) => load(id)).catch((cause) => setError(cause instanceof Error ? cause.message : "Falha ao carregar compra."));
  }, [params]);
  if (error) return <div className="mx-auto max-w-4xl"><Link href="/compras-cafe-verde" className="text-sm font-semibold text-forest-700">← Voltar para compras</Link><p className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p></div>;
  if (!purchase) return <div className="mx-auto max-w-4xl text-sm text-stone-500">Carregando ficha…</div>;
  const money = (value: number) => Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const date = (value?: string) => value ? new Date(value).toLocaleString("pt-BR") : "—";
  // A identidade do shell é a fonte da sessão. A lista da API só confirma
  // que esse mesmo usuário existe, está ativo e pertence à empresa.
  const actor = sessionUser && ["EXECUTIVE", "ADMIN"].includes(sessionUser.role) ? sessionUser : null;
  const activeUser = sessionUser;
  const returnedForAdjustment = purchase.approvalStatus === "DRAFT" && Boolean(purchase.returnReason || purchase.returnedAt);
  const operationalLabel = purchase.approvalStatus === "APPROVED" && purchase.externalAcceptanceStatus !== "ACCEPTED" ? "Aguardando aceite" : delivery[purchase.operationalStatus] ?? purchase.operationalStatus;
  const approvalMissing = () => {
    const missing: string[] = [];
    if (!purchase.supplier.id) missing.push("Fornecedor");
    if (!purchase.supplier.name) missing.push("Nome/razão social do fornecedor");
    if (!purchase.supplier.taxId) missing.push("CPF/CNPJ do fornecedor");
    if (!purchase.supplier.city && !purchase.municipality) missing.push("Município do fornecedor");
    if (!purchase.supplier.state && !purchase.state) missing.push("Estado do fornecedor");
    if (!purchase.species) missing.push("Espécie");
    if (!purchase.harvest) missing.push("Safra");
    if (!purchase.contractedWeightKg) missing.push("Quantidade contratada");
    if (!purchase.pricePerKg && !purchase.totalValue) missing.push("Preço ou valor total");
    if (!purchase.paymentTermType) missing.push("Condição de pagamento");
    if (!purchase.expectedAt) missing.push("Data/período de entrega");
    if (!purchase.process) missing.push("Processo");
    if (["ESPECIAL", "GOURMET", "SPECIAL"].some((value) => (purchase.qualityCategory ?? "").toUpperCase().includes(value))) {
      if (!purchase.contractedScreen) missing.push("Peneira");
      if (purchase.maxMoisturePercent == null) missing.push("Umidade máxima");
    }
    return [...new Set(missing)];
  };
  const decision = async (action: "approve" | "reject", confirmed = false) => {
    if (!actor) return setError("Aguardando aprovação da Diretoria.");
    if (action === "approve" && !confirmed) {
      const missing = approvalMissing();
      if (missing.length) { setValidationMissing(missing); return; }
      setApprovalConfirmOpen(true); return;
    }
    if (action === "reject" && !rejectReason.trim()) return setError("Informe o motivo da reprovação.");
    setBusy(true);
    try {
      const response = await fetch(`${API_ROOT}/green-coffee-purchases/${purchase.id}/${action}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...(action === "reject" ? { reason: rejectReason } : {}) }) });
      const data = await response.json();
      if (!response.ok) { if (Array.isArray(data.missingFields)) setValidationMissing(data.missingFields); throw new Error(data.message ?? "Falha na decisão."); }
      setRejectOpen(false); setRejectReason(""); setNotice(action === "approve" ? "Compra aprovada internamente." : "Compra reprovada.");
      await load(purchase.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha na decisão."); }
    finally { setBusy(false); }
  };
  const sendAcceptance = async () => {
    if (!activeUser) return setError("Usuário responsável não encontrado.");
    setBusy(true);
    try {
      const response = await fetch(`${API_ROOT}/green-coffee-purchases/${purchase.id}/acceptance/send`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel: "WHATSAPP", ...(selectedContactId ? { supplierContactId: selectedContactId } : {}) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Falha ao enviar para aceite.");
      setAcceptanceUrl(data.url ?? "");
      setNotice(data.url ? "Link de aceite gerado." : "Convite enviado.");
      await load(purchase.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao enviar para aceite."); }
    finally { setBusy(false); }
  };
  const submitForApproval = async () => {
    const missing = approvalMissing();
    if (missing.length) { setValidationMissing(missing); return; }
    setBusy(true);
    try {
      const response = await fetch(`${API_ROOT}/green-coffee-purchases/${purchase.id}/submit`, { method: "PATCH", credentials: "include" });
      const data = await response.json();
      if (!response.ok) { if (Array.isArray(data.missingFields)) setValidationMissing(data.missingFields); throw new Error(data.message ?? "Não foi possível enviar para aprovação."); }
      setNotice("Compra enviada para aprovação."); await load(purchase.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível enviar para aprovação."); }
    finally { setBusy(false); }
  };
  const returnForAdjustment = async () => {
    if (!returnReason.trim() || !correctionRequest.trim()) return;
    setBusy(true);
    try {
      const response = await fetch(`${API_ROOT}/green-coffee-purchases/${purchase.id}/return-adjustment`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnReason, correctionRequest }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Não foi possível devolver para ajuste.");
      setReturnOpen(false); setReturnReason(""); setCorrectionRequest(""); setNotice("Compra devolvida para ajuste."); await load(purchase.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível devolver para ajuste."); }
    finally { setBusy(false); }
  };
  const copyAcceptanceLink = async () => {
    if (!acceptanceUrl) return;
    const selectLink = () => {
      const input = acceptanceInputRef.current;
      if (!input) return;
      input.focus();
      input.select();
      input.setSelectionRange(0, input.value.length);
    };
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(acceptanceUrl);
        copied = true;
      }
    } catch {
      copied = false;
    }
    if (!copied) {
      selectLink();
      try { copied = document.execCommand("copy"); } catch { copied = false; }
    }
    setCopyStatus(copied ? "copied" : "failed");
    if (copied) window.setTimeout(() => setCopyStatus("idle"), 2200);
    else window.setTimeout(() => setCopyStatus("idle"), 5000);
  };
  const selectAcceptanceLink = () => {
    const input = acceptanceInputRef.current;
    if (!input) return;
    input.focus();
    input.select();
    input.setSelectionRange(0, input.value.length);
  };
  return <div className="mx-auto max-w-[1180px]">
    <Link href="/compras-cafe-verde" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-forest-700"><ArrowLeft size={16} />Voltar para compras</Link>
    {notice && <p className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800"><Check className="mr-2 inline" size={15} />{notice}</p>}
    {error && <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <header className="mt-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-forest-700">Ficha completa da compra</p><h1 className="mt-2 text-3xl font-bold">{purchase.purchaseNumber}</h1><p className="mt-2 text-sm text-stone-500">{purchase.supplier.name} · {purchase.supplier.taxId ?? "Documento não informado"}</p></div>{purchase.externalAcceptanceStatus !== "ACCEPTED" && <div className="flex flex-wrap gap-2"><Badge>{approval[purchase.approvalStatus] ?? purchase.approvalStatus}</Badge><Badge>{operationalLabel}</Badge><Badge>{financial[purchase.financialStatus] ?? purchase.financialStatus}</Badge><Badge>{external[purchase.externalAcceptanceStatus] ?? purchase.externalAcceptanceStatus}</Badge></div>}</header>
    <Card className="mt-6 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-forest-700">Ações da ficha</p><p className="mt-1 text-sm text-stone-500">A aprovação, o aceite e o recebimento são etapas independentes.</p></div><div className="flex flex-wrap gap-2">
      {purchase.approvalStatus === "DRAFT" && <><span className={`rounded-xl px-4 py-3 text-sm font-semibold ${returnedForAdjustment ? "bg-amber-50 text-amber-900" : "bg-stone-100 text-stone-700"}`}>{returnedForAdjustment ? "Devolvida para ajuste" : "Rascunho"}</span><Link className="inline-flex min-h-11 items-center rounded-xl border px-4 py-2.5 text-sm font-semibold" href={`/compras-cafe-verde/${purchase.id}/editar`}>Editar compra</Link>{approvalMissing().length === 0 && <Button disabled={busy} onClick={() => void submitForApproval()}>{returnedForAdjustment ? "Reenviar para aprovação" : "Enviar para aprovação"}</Button>}</>}
      {purchase.approvalStatus === "PENDING_APPROVAL" && actor && <><Button disabled={busy} onClick={() => void decision("approve")}>Aprovar compra</Button><button disabled={busy} className="min-h-11 rounded-xl border border-amber-300 px-4 py-2.5 text-sm font-semibold text-amber-800" onClick={() => setReturnOpen(true)}>Devolver para ajuste</button></>}
      {purchase.approvalStatus === "PENDING_APPROVAL" && !actor && <span className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">Aguardando aprovação da Diretoria</span>}
      {purchase.approvalStatus === "APPROVED" && purchase.externalAcceptanceStatus !== "ACCEPTED" && <>{(purchase.supplier.contacts?.length ?? 0) > 1 && <select aria-label="Enviar confirmação para" className="min-h-11 rounded-xl border px-3 py-2.5 text-sm" value={selectedContactId} onChange={(event) => setSelectedContactId(event.target.value)}><option value="">Enviar confirmação para</option>{purchase.supplier.contacts?.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}{contact.role ? ` · ${contact.role}` : ""}{contact.whatsapp ? ` · ${contact.whatsapp}` : contact.email ? ` · ${contact.email}` : ""}</option>)}</select>}<Button disabled={busy} onClick={() => void sendAcceptance()}><Send size={15} />{purchase.supplier.whatsapp ? "Enviar por WhatsApp" : "Gerar link de confirmação"}</Button><button className="min-h-11 rounded-xl border px-4 py-2.5 text-sm font-semibold" onClick={() => setContractOpen((value) => !value)}>{contractOpen ? "Fechar contrato" : "Visualizar contrato"}</button></>}
      {purchase.approvalStatus === "APPROVED" && purchase.externalAcceptanceStatus === "ACCEPTED" && <><span className="inline-flex min-h-11 items-center rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800">✓ Negócio confirmado</span><button className="min-h-11 rounded-xl border px-4 py-2.5 text-sm font-semibold" onClick={() => setContractOpen((value) => !value)}>{contractOpen ? "Fechar contrato" : "Visualizar contrato"}</button></>}
      {purchase.approvalStatus === "APPROVED" && purchase.externalAcceptanceStatus === "ACCEPTED" && <a className="inline-flex min-h-11 items-center rounded-xl border px-4 py-2.5 text-sm font-semibold text-forest-800" href={`${API_ROOT}/green-coffee-purchases/${purchase.id}/contract.pdf`}>Baixar PDF</a>}
    </div></div></Card>
    {purchase.approvalStatus === "APPROVED" && purchase.externalAcceptanceStatus !== "ACCEPTED" && !purchase.supplier.whatsapp && <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Fornecedor sem WhatsApp cadastrado. Gere o link de confirmação e compartilhe por outro canal.</p>}
    {acceptanceUrl && purchase.externalAcceptanceStatus !== "ACCEPTED" && <Card className="mt-3 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><input ref={acceptanceInputRef} aria-label="Link de confirmação" readOnly value={acceptanceUrl} className="min-h-11 min-w-0 flex-1 select-text rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm text-stone-600" onClick={selectAcceptanceLink} onFocus={selectAcceptanceLink} /><button type="button" className="min-h-11 rounded-xl border px-4 text-sm font-semibold" onClick={() => void copyAcceptanceLink()}>{copyStatus === "copied" ? "Link copiado ✓" : "Copiar link de confirmação"}</button></div>{copyStatus === "copied" && <p role="status" className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">Link copiado com sucesso.</p>}{copyStatus === "failed" && <p role="status" className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">Não foi possível copiar automaticamente. Pressione ⌘C para copiar.</p>}</Card>}
    {(validationMissing.length > 0 || (purchase.approvalStatus === "DRAFT" && approvalMissing().length > 0)) && <Card className="mt-4 border-amber-200 bg-amber-50 p-5"><h2 className="text-sm font-bold text-amber-900">{returnedForAdjustment ? "Devolvida para ajuste" : purchase.approvalStatus === "DRAFT" ? "Rascunho incompleto" : "Esta compra ainda não pode ser aprovada."}</h2><p className="mt-1 text-sm text-amber-800">{returnedForAdjustment ? "A Diretoria solicitou alterações nesta compra. Revise as correções abaixo, edite a ficha e envie novamente para aprovação." : "Complete as informações contratuais abaixo antes de continuar."}</p>{returnedForAdjustment && <div className="mt-4 rounded-xl border border-amber-200 bg-white/70 p-4 text-sm text-amber-950"><p><strong>Motivo da devolução:</strong> {purchase.returnReason}</p><p className="mt-2"><strong>Correção solicitada:</strong> {purchase.correctionRequest}</p><p className="mt-2"><strong>Devolvido por:</strong> {purchase.returnedByName ?? purchase.returnedByUserId ?? "—"}</p><p className="mt-2"><strong>Data/hora:</strong> {date(purchase.returnedAt ?? undefined)}</p></div>}{approvalMissing().length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-900">{(validationMissing.length > 0 ? validationMissing : approvalMissing()).map((field) => <li key={field}>{field}</li>)}</ul>}<div className="mt-4 flex flex-wrap gap-2"><button className="min-h-11 rounded-xl border border-amber-300 bg-white px-4 text-sm font-semibold" onClick={() => setValidationMissing([])}>Voltar para ficha</button><Link className="inline-flex min-h-11 items-center rounded-xl bg-forest-800 px-4 text-sm font-semibold text-white" href={`/compras-cafe-verde/${purchase.id}/editar`}>Editar compra</Link></div></Card>}
    {approvalConfirmOpen && <Card className="mt-4 border-forest-100 bg-forest-50 p-5"><h2 className="text-base font-bold text-forest-950">Confirmar aprovação</h2><p className="mt-1 text-sm text-stone-600">{purchase.purchaseNumber}</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><Detail label="Fornecedor" value={purchase.supplier.name} /><Detail label="Café" value={`${speciesLabel[purchase.species] ?? formatCatalog(purchase.species)} / ${purchase.qualityCategory ?? "—"} / ${purchase.harvest}`} /><Detail label="Quantidade" value={`${purchase.contractedWeightKg.toLocaleString("pt-BR")} kg`} /><Detail label="Preço" value={money(purchase.pricePerKg ?? 0)} /><Detail label="Valor total" value={money(purchase.totalValue)} /><Detail label="Entrega" value={date(purchase.expectedAt ?? undefined)} /><Detail label="Pagamento" value={formatCatalog(purchase.paymentTermType)} /></div><p className="mt-4 text-sm text-stone-700">Ao confirmar, esta compra será aprovada internamente e seguirá para formalização e aceite do fornecedor.</p><div className="mt-4 flex justify-end gap-2"><button className="min-h-11 rounded-xl border bg-white px-4 text-sm font-semibold" onClick={() => setApprovalConfirmOpen(false)}>Cancelar</button><Button disabled={busy} onClick={() => { setApprovalConfirmOpen(false); void decision("approve", true); }}>Aprovar compra</Button></div></Card>}
    {rejectOpen && <Card className="mt-4 border-red-100 p-5"><h2 className="text-sm font-bold text-red-800">Reprovar compra</h2><p className="mt-1 text-sm text-stone-500">O motivo ficará registrado na auditoria.</p><textarea className="mt-4 min-h-24 w-full rounded-xl border p-3 text-sm" value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Informe o motivo" /><div className="mt-3 flex justify-end gap-2"><button className="min-h-11 rounded-xl border px-4 text-sm font-semibold" onClick={() => setRejectOpen(false)}>Cancelar</button><button className="min-h-11 rounded-xl bg-red-700 px-4 text-sm font-semibold text-white" disabled={busy || !rejectReason.trim()} onClick={() => void decision("reject")}>Confirmar reprovação</button></div></Card>}
    {returnOpen && <Card className="mt-4 border-amber-200 bg-amber-50 p-5"><h2 className="text-sm font-bold text-amber-900">Devolver para ajuste</h2><p className="mt-1 text-sm text-amber-800">Os dois campos são obrigatórios e ficarão preservados no histórico.</p><label className="mt-4 block text-sm font-semibold text-stone-700">Motivo da devolução<textarea required className="mt-2 min-h-20 w-full rounded-xl border p-3 text-sm" value={returnReason} onChange={(event) => setReturnReason(event.target.value)} /></label><label className="mt-3 block text-sm font-semibold text-stone-700">Correção solicitada<textarea required className="mt-2 min-h-20 w-full rounded-xl border p-3 text-sm" value={correctionRequest} onChange={(event) => setCorrectionRequest(event.target.value)} /></label><div className="mt-3 flex justify-end gap-2"><button className="min-h-11 rounded-xl border bg-white px-4 text-sm font-semibold" onClick={() => setReturnOpen(false)}>Cancelar</button><button className="min-h-11 rounded-xl bg-amber-700 px-4 text-sm font-semibold text-white" disabled={busy || !returnReason.trim() || !correctionRequest.trim()} onClick={() => void returnForAdjustment()}>Confirmar devolução</button></div></Card>}
    {contractOpen && <ContractCard purchase={purchase} money={money} date={date} />}
    <div className="mt-7 grid gap-4 md:grid-cols-2">
      <Block title="Identificação"><Detail label="Fornecedor" value={purchase.supplier.name} /><Detail label="Fazenda / propriedade" value={purchase.farmName ?? purchase.supplier.farmName} /><Detail label="Município / estado" value={`${purchase.municipality ?? purchase.supplier.city ?? "—"} / ${purchase.state ?? purchase.supplier.state ?? "—"}`} /><Detail label="Região" value={purchase.originRegion} /><Detail label="Espécie" value={speciesLabel[purchase.species] ?? formatCatalog(purchase.species)} /><Detail label="Variedade" value={formatCatalog(purchase.variety)} /><Detail label="Safra" value={purchase.harvest} /><Detail label="Processo" value={processLabel[purchase.process ?? ""] ?? formatCatalog(purchase.process)} /><Detail label="Lote fornecedor" value={purchase.supplierLotCode} /></Block>
      <Block title="Qualidade contratada"><Detail label="Categoria" value={purchase.qualityCategory} /><Detail label="Peneira" value={purchase.contractedScreen} /><Detail label="Máx. defeitos" value={purchase.maxDefects} /><Detail label="Umidade máxima" value={purchase.maxMoisturePercent ? `${purchase.maxMoisturePercent}%` : "—"} /><Detail label="Pontuação mínima" value={purchase.minimumScore} /></Block>
      <Block title="Quantidade"><Detail label="Volumes" value={purchase.volumeQuantity} /><Detail label="Contratado" value={`${purchase.contractedWeightKg.toLocaleString("pt-BR")} kg`} /><Detail label="Recebido" value={`${purchase.receivedKg.toLocaleString("pt-BR")} kg`} /><Detail label="Saldo físico" value={`${purchase.balanceKg.toLocaleString("pt-BR")} kg`} /></Block>
      <Block title="Financeiro"><Detail label="Valor total" value={money(purchase.totalValue)} /><Detail label="Comprometido" value={money(purchase.financial.committed)} /><Detail label="Pago" value={money(purchase.financial.paid)} /><Detail label="Saldo" value={money(purchase.financial.balance)} /></Block>
      <Block title="Governança"><Detail label="Criado por" value={purchase.createdByName} /><Detail label="Criado em" value={date(purchase.createdAt)} /><Detail label="Aprovado por" value={purchase.approvedByName} /><Detail label="Aprovado em" value={date(purchase.approvedAt)} /><Detail label="Reprovado por" value={purchase.rejectedByName} /><Detail label="Motivo" value={purchase.rejectionReason} /></Block>
      {returnedForAdjustment && <Block title="Devolvida para ajuste"><Detail label="Devolvido por" value={purchase.returnedByName ?? purchase.returnedByUserId} /><Detail label="Data/hora" value={date(purchase.returnedAt ?? undefined)} /><Detail label="Motivo" value={purchase.returnReason} /><Detail label="Correção solicitada" value={purchase.correctionRequest} /></Block>}
      <Block title="Recebimentos vinculados">{purchase.receipts?.length ? purchase.receipts.map((receipt) => <div key={receipt.receiptNumber} className="flex flex-wrap justify-between gap-2 border-b border-stone-100 py-2 text-sm"><b>{receipt.receiptNumber}</b><span>{Number(receipt.netWeightKg).toLocaleString("pt-BR")} kg</span><span>{receipt.coffeeLot?.code ?? "—"}</span><span>{date(receipt.confirmedAt)}</span></div>) : <p className="text-sm text-stone-500">Nenhum recebimento vinculado.</p>}</Block>
    </div>
    {purchase.externalAcceptanceStatus === "ACCEPTED" && <PurchaseJourney purchase={purchase} />}
    <Card className="mt-4 p-5"><h2 className="text-xs font-bold uppercase tracking-[.13em] text-forest-700">Rastreabilidade</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><TimelineItem label="Compra criada" state="Concluída" complete /><TimelineItem label="Aprovação interna" state={purchase.approvalStatus === "APPROVED" ? "Aprovada" : approval[purchase.approvalStatus] ?? purchase.approvalStatus} complete={purchase.approvalStatus === "APPROVED"} /><TimelineItem label="Confirmação do fornecedor" state={purchase.externalAcceptanceStatus === "ACCEPTED" ? "Confirmada" : "Pendente"} complete={purchase.externalAcceptanceStatus === "ACCEPTED"} /><TimelineItem label="Recebimento" state={purchase.receivedKg > 0 ? (purchase.balanceKg > 0 ? "Parcial" : "Completo") : "Pendente"} current={purchase.externalAcceptanceStatus === "ACCEPTED" && purchase.balanceKg > 0} complete={purchase.balanceKg === 0 && purchase.receivedKg > 0} /><TimelineItem label="Laboratório / estoque" state={purchase.receivedKg > 0 ? "Em acompanhamento" : "Pendente"} /></div></Card>
  </div>;
}
function ContractCard({ purchase, money, date }: { purchase: Purchase; money: (value: number) => string; date: (value?: string) => string }) {
  const terms = purchase.acceptanceConditionText ?? "O café entregue estará sujeito à conferência de quantidade, documentação e análise de qualidade pela Compradora. A aceitação definitiva ocorrerá após a verificação de conformidade com as especificações desta Ficha de Compra. Eventuais divergências poderão resultar em reclassificação, ajuste comercial, substituição ou recusa, conforme aplicável e de acordo com os Termos Gerais de Compra.";
  const accepted = purchase.externalAcceptance?.status === "ACCEPTED";
  return <Card className="mt-4 border-forest-100 bg-[#fffdf8] p-6"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-200 pb-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-forest-700">Bispo Coffees</p><h2 className="mt-1 text-xl font-bold">Ficha de compra / contrato de café verde</h2><p className="mt-1 text-sm text-stone-500">Contrato nº {purchase.purchaseNumber} · {date(purchase.createdAt)}</p></div>{purchase.termsDocumentUrl && <a className="inline-flex items-center gap-1 text-sm font-semibold text-forest-700 underline" href={purchase.termsDocumentUrl} target="_blank" rel="noreferrer">Termos gerais <ExternalLink size={14} /></a>}</div><div className="mt-5 grid gap-5 md:grid-cols-2"><ContractSection title="Comprador"><Detail label="Empresa" value="Bispo Coffees" /><Detail label="Referência" value={purchase.purchaseNumber} /></ContractSection><ContractSection title="Vendedor"><Detail label="Nome / razão social" value={purchase.supplier.name} /><Detail label="Documento" value={purchase.supplier.taxId} /><Detail label="Fazenda" value={purchase.farmName ?? purchase.supplier.farmName} /><Detail label="Município / UF" value={`${purchase.municipality ?? purchase.supplier.city ?? "—"} / ${purchase.state ?? purchase.supplier.state ?? "—"}`} /></ContractSection><ContractSection title="1. Objeto"><Detail label="Café" value={`${speciesLabel[purchase.species] ?? formatCatalog(purchase.species)} · ${purchase.harvest}`} /><Detail label="Variedade" value={formatCatalog(purchase.variety)} /><Detail label="Processo" value={processLabel[purchase.process ?? ""] ?? formatCatalog(purchase.process)} /><Detail label="Origem" value={purchase.originRegion} /></ContractSection><ContractSection title="2. Especificação contratada"><Detail label="Qualidade" value={purchase.qualityCategory} /><Detail label="Peneira" value={purchase.contractedScreen} /><Detail label="Máx. defeitos" value={purchase.maxDefects} /><Detail label="Umidade máxima" value={purchase.maxMoisturePercent ? `${purchase.maxMoisturePercent}%` : "—"} /><Detail label="Pontuação mínima" value={purchase.minimumScore} /></ContractSection><ContractSection title="3. Quantidade e preço"><Detail label="Volumes" value={purchase.volumeQuantity} /><Detail label="Peso contratado" value={`${purchase.contractedWeightKg.toLocaleString("pt-BR")} kg`} /><Detail label="Preço / valor total" value={money(purchase.totalValue)} /><Detail label="Tolerância" value="Conforme ficha e conferência" /></ContractSection><ContractSection title="4. Entrega"><Detail label="Previsão" value="Conforme programação da compra" /><Detail label="Local" value="Armazém Bispo Coffees" /></ContractSection><ContractSection title="5. Pagamento"><Detail label="Condição" value={formatCatalog(purchase.paymentTermType)} />{purchase.installments?.map((installment) => <Detail key={installment.installmentNumber} label={`Parcela ${installment.installmentNumber}`} value={`${money(installment.amount)} · ${date(installment.dueDate)}`} />)}</ContractSection></div><section className="mt-5 border-t border-stone-200 pt-5"><h3 className="text-sm font-bold">6. Inspeção e aceitação da mercadoria</h3><p className="mt-2 max-w-4xl text-sm leading-6 text-stone-600">{terms}</p></section><section className="mt-5 border-t border-stone-200 pt-5"><h3 className="text-sm font-bold">7. Rastreabilidade e documentação</h3><p className="mt-2 text-sm text-stone-600">A documentação fiscal, a identificação da origem e os registros de recebimento integram esta operação e permanecem vinculados à compra.</p><h3 className="mt-4 text-sm font-bold">8. Termos gerais</h3><p className="mt-2 text-sm text-stone-600">Termos Gerais de Compra Bispo Coffees — versão {purchase.termsVersion ?? "vigente"}.</p>{accepted && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Contrato confirmado eletronicamente por {purchase.externalAcceptance?.acceptedByName ?? "fornecedor"} em {date(purchase.externalAcceptance?.acceptedAt)}. Esta visualização e o PDF utilizam a versão congelada no aceite.</p>}</section></Card>;
}
function ContractSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-xl border border-stone-100 bg-white/70 p-4"><h3 className="mb-3 text-sm font-bold text-stone-800">{title}</h3><div className="grid gap-3 sm:grid-cols-2">{children}</div></section>; }
function TimelineItem({ label, state, complete = false, current = false }: { label: string; state: string; complete?: boolean; current?: boolean }) { return <div className={`rounded-xl border p-3 ${current ? "border-amber-200 bg-amber-50/40" : "border-stone-100 bg-white"}`}><div className="flex items-center gap-2"><span className={`grid h-6 w-6 place-items-center rounded-full ${complete ? "bg-emerald-50 text-emerald-700" : current ? "bg-amber-100 text-amber-800" : "bg-stone-100 text-stone-400"}`}>{complete ? <Check size={14} /> : <span className="h-2 w-2 rounded-full bg-current" />}</span><p className="text-sm font-semibold">{label}</p></div><p className={`mt-2 pl-8 text-xs ${current ? "font-semibold text-amber-900" : "text-stone-500"}`}>{state}</p></div>; }
function PurchaseJourney({ purchase }: { purchase: Purchase }) { const expected = purchase.expectedAt ? new Date(purchase.expectedAt).toLocaleDateString("pt-BR") : null; return <Card className="mt-4 border-forest-100 bg-[#fffdf8] p-5"><h2 className="text-xs font-bold uppercase tracking-[.13em] text-forest-700">Jornada da compra</h2><div className="mt-4 grid gap-3 md:grid-cols-4"><JourneyStep label="Compra aprovada" done /><JourneyStep label="Negócio confirmado" done /><JourneyStep label="Aguardando entrega" current detail={expected ? `Entrega prevista: ${expected}` : "Entrega ainda não programada"} /><JourneyStep label="Recebimento" /></div><div className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><p><span className="font-semibold">Etapa atual:</span> Aguardando entrega</p><p><span className="font-semibold">Próxima ação:</span> Aguardar chegada do café</p></div></Card>; }
function JourneyStep({ label, done = false, current = false, detail }: { label: string; done?: boolean; current?: boolean; detail?: string }) { return <div className="relative rounded-xl border border-stone-100 bg-white p-3"><div className="flex items-center gap-2"><span className={`grid h-7 w-7 place-items-center rounded-full ${done ? "bg-emerald-50 text-emerald-700" : current ? "bg-amber-100 text-amber-800" : "bg-stone-100 text-stone-400"}`}>{done ? <Check size={15} /> : <span className="h-2 w-2 rounded-full bg-current" />}</span><span className="text-sm font-semibold">{label}</span></div>{detail && <p className="mt-2 pl-9 text-xs text-stone-600">{detail}</p>}</div>; }
function Block({ title, children }: { title: string; children: React.ReactNode }) { return <Card className="p-5"><h2 className="text-xs font-bold uppercase tracking-[.13em] text-forest-700">{title}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{children}</div></Card>; }
function Detail({ label, value }: { label: string; value?: React.ReactNode }) { return <div><p className="text-[11px] uppercase tracking-wide text-stone-500">{label}</p><p className="mt-1 text-sm font-semibold">{value || "—"}</p></div>; }
