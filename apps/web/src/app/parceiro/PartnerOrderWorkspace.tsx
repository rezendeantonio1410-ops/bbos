"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  History,
  Plus,
  RefreshCw,
  Send,
  ShoppingCart,
  UserPlus,
  X,
} from "lucide-react";
import { brazilianCepDigits, formatBrazilianCep } from "@/lib/brazil-address";
import { useBrazilianCepAutofill } from "@/lib/use-brazilian-cep-autofill";
import { searchSignaEndCustomers } from "@/lib/signa-end-customer-search";
import { createSignaOrderDraft, parseSignaOrderDraft, signaOrderDraftKey, signaServerDraftEditTarget, signaServerDraftRecoveryIsCurrent, type SignaOrderDraftScope } from "@/lib/signa-order-draft";

type AccessLevel = "VIEWER" | "SELLER" | "SALES_MANAGER" | "DISTRIBUTOR";
type Customer = {
  id: string;
  name: string;
  tradeName?: string | null;
  segment?: string | null;
  city?: string | null;
  state?: string | null;
  creditStatus?: "NOT_ANALYZED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
  creditLimit?: number | string;
  creditReviewPending?: boolean;
  paymentTerms?: string | null;
  fiscalReadiness?: { ready: boolean; issues: string[] };
};
type Variant = {
  productVariantId: string;
  warehouseId: string;
  line: string;
  lineCode: string;
  product: string;
  internalLine?: string;
  internalProduct?: string;
  catalogSortOrder?: number;
  catalogPrice?: number | null;
  sku: string;
  presentationGrams: number;
  availableStock: number;
  productionToOrder?: boolean;
};
type CatalogInfo = {
  distributor: boolean;
  exclusive: boolean;
  productCount: number;
};
type Order = {
  id: string;
  code: string;
  status: string;
  totalAmount: number | string;
  orderedAt: string;
  customerName: string;
  paymentType?: "CASH" | "TERM" | null;
  paymentTermsSnapshot?: string | null;
  receivableStatus?: string | null;
  dueDate?: string | null;
  receivableAmount?: number | string | null;
  openAmount?: number | string | null;
  paymentDate?: string | null;
  invoiceNumber?: string | null;
  invoiceStatus?: string | null;
  invoicePdfAvailable?: boolean;
  billingAvailable?: boolean;
};
type Line = { id: string; productVariantId: string; quantity: number };
type ServerOrderDraft = {
  id: string;
  version: number;
  updatedAt: string;
  payload: {
    customerId: string | null;
    partnerEndCustomerId: string | null;
    billingRecipientId: string | null;
    items: Array<{ productVariantId: string; quantity: number }>;
    deliveryMode: "PICKUP" | "CUSTOMER_CARRIER";
    carrierName: string;
    expectedDeliveryDate: string;
    customerReference: string;
    notes: string;
  };
};
type Quote = {
  items: Array<{
    productVariantId: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    salesChannelName: string;
  }>;
  totalAmount: number;
};
type Visit = {
  id: string;
  customerId: string;
  recordedByName: string;
  visitAt: string;
  contactName?: string | null;
  purpose: string;
  outcome: string;
  facts: string;
  nextAction?: string | null;
  nextActionAt?: string | null;
};

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const newLine = (): Line => ({
  id: crypto.randomUUID(),
  productVariantId: "",
  quantity: 1,
});
const localDateTime = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
};
const statusLabel: Record<string, string> = {
  DRAFT: "Em conferência",
  CONFIRMED: "Confirmado",
  RESERVED: "Estoque reservado",
  PICKING: "Em separação",
  READY_TO_SHIP: "Pronto para envio",
  IN_PRODUCTION: "Em produção",
  INVOICED: "Faturado",
  SHIPPED: "Expedido",
  DELIVERED: "Entregue",
};
const purposeLabels: Record<string, string> = {
  PROSPECCAO: "Prospecção",
  APRESENTACAO: "Apresentação de produtos",
  NEGOCIACAO: "Negociação",
  POS_VENDA: "Pós-venda",
  COBRANCA: "Cobrança",
  OUTRO: "Outro",
};
const outcomeLabels: Record<string, string> = {
  ACOMPANHAR: "Acompanhar",
  INTERESSADO: "Cliente interessado",
  COTACAO: "Solicitou cotação",
  PEDIDO: "Pedido encaminhado",
  SEM_INTERESSE: "Sem interesse agora",
  NAO_LOCALIZADO: "Contato não localizado",
};
const creditStatusLabels: Record<string, string> = {
  NOT_ANALYZED: "não analisado",
  UNDER_REVIEW: "em análise",
  APPROVED: "aprovado",
  REJECTED: "não aprovado",
};
const receivableStatusLabels: Record<string, string> = {
  OPEN: "Em aberto",
  PARTIALLY_PAID: "Pago parcialmente",
  OVERDUE: "Vencido",
  PAID: "Pago",
  CANCELLED: "Cancelado",
};
const distributorCatalogTones = [
  "border-[var(--bbos-surface-border)] bg-[var(--bbos-surface)]",
  "border-[var(--bbos-surface-border)] bg-[var(--bbos-surface-subtle)]",
  "border-[var(--bbos-surface-border)] bg-[var(--bbos-surface)]",
  "border-[var(--bbos-surface-border)] bg-[var(--bbos-surface-subtle)]",
];
const orderStatusTone = (order: Order) => {
  if (order.receivableStatus === "OVERDUE") {
    return {
      row: "bg-[var(--bbos-danger-soft)] hover:bg-red-100/60",
      badge: "bg-red-100 text-[var(--bbos-danger)]",
      card: "border-[var(--bbos-danger-border)] bg-[var(--bbos-danger-soft)]",
    };
  }
  if (order.status === "DELIVERED") {
    return {
      row: "bg-[var(--bbos-success-soft)] hover:bg-emerald-100/60",
      badge: "bg-emerald-100 text-[var(--bbos-success)]",
      card: "border-[var(--bbos-success-border)] bg-[var(--bbos-success-soft)]",
    };
  }
  if (
    ["INVOICED", "SHIPPED", "READY_TO_SHIP", "PICKING"].includes(order.status)
  ) {
    return {
      row: "bg-[var(--bbos-info-soft)] hover:bg-blue-100/60",
      badge: "bg-blue-100 text-[var(--bbos-info)]",
      card: "border-blue-200 bg-[var(--bbos-info-soft)]",
    };
  }
  if (["CONFIRMED", "RESERVED", "IN_PRODUCTION"].includes(order.status)) {
    return {
      row: "bg-[var(--bbos-warning-soft)] hover:bg-amber-100/60",
      badge: "bg-amber-100 text-[var(--bbos-warning)]",
      card: "border-[var(--bbos-warning-border)] bg-[var(--bbos-warning-soft)]",
    };
  }
  return {
    row: "bg-[var(--bbos-surface)] hover:bg-[var(--bbos-surface-subtle)]",
    badge: "bg-[var(--bbos-nav-active)] text-[var(--bbos-nav-active-text)]",
    card: "border-[var(--bbos-surface-border)] bg-[var(--bbos-surface)]",
  };
};
const purposeLabel = (value: string) => purposeLabels[value] || value;
const outcomeLabel = (value: string) => outcomeLabels[value] || value;
const creditStatusLabel = (value?: string) =>
  creditStatusLabels[value || ""] || "não analisado";
const emptyCustomerAddress = {
  postalCode: "",
  city: "",
  state: "",
  address: "",
  district: "",
};

async function portalApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/partner-portal${path}`, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || "Não foi possível concluir a operação.");
  }
  return payload as T;
}

export function PartnerOrderWorkspace({
  accessLevel,
  orders,
  onOrderCreated,
}: {
  accessLevel: AccessLevel;
  orders: Order[];
  onOrderCreated: () => Promise<void>;
}) {
  const isDistributor = accessLevel === "DISTRIBUTOR";
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [catalog, setCatalog] = useState<CatalogInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [draftStatus, setDraftStatus] = useState("");
  const [draftDirty, setDraftDirty] = useState(false);
  const [draftScope, setDraftScope] = useState<SignaOrderDraftScope | null>(null);
  const [serverDrafts, setServerDrafts] = useState<ServerOrderDraft[]>([]);
  const [serverDraftId, setServerDraftId] = useState("");
  // Only the draft actually recovered into this form can be overwritten.
  const [recoveredServerDraftId, setRecoveredServerDraftId] = useState("");
  const [serverDraftBusy, setServerDraftBusy] = useState(false);
  // Invalidate an in-flight GET when the selection, form or account context changes.
  const serverDraftRecoveryEpoch = useRef(0);
  const [showCustomer, setShowCustomer] = useState(false);
  const [customerAddress, setCustomerAddress] = useState(emptyCustomerAddress);
  const [showOrder, setShowOrder] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const draftKey = useMemo(() => isDistributor && draftScope && customerId
    ? signaOrderDraftKey(draftScope, customerId) : null,
    [isDistributor, draftScope, customerId]);
  const [billingEnabled, setBillingEnabled] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingRecipients, setBillingRecipients] = useState<Array<{
    id: string;
    name: string;
    documentType: "CNPJ" | "CPF";
    taxIdVerificationStatus: string;
    fiscalReady: boolean;
  }>>([]);
  const [billingRecipientId, setBillingRecipientId] = useState("");

  const [endCustomers, setEndCustomers] = useState<Array<{id:string;name:string;city?:string|null;state?:string|null}>>([]);
  const [partnerEndCustomerId, setPartnerEndCustomerId] = useState("");
  const [endCustomerSearch, setEndCustomerSearch] = useState("");
  const [newEndCustomerName, setNewEndCustomerName] = useState("");
  const [newEndCustomerCity, setNewEndCustomerCity] = useState("");
  const [newEndCustomerState, setNewEndCustomerState] = useState("");
  const [savingEndCustomer, setSavingEndCustomer] = useState(false);
  const [editingEndCustomerId, setEditingEndCustomerId] = useState("");

  function closeOrder() {
    serverDraftRecoveryEpoch.current += 1;
    setBillingRecipientId("");
    setPartnerEndCustomerId("");
    setEndCustomerSearch("");
    setEditingEndCustomerId("");
    setShowOrder(false);
    setServerDraftId("");
    setRecoveredServerDraftId("");
  }

  // The main New order button must invalidate any in-flight draft recovery.
  // Toggling showOrder directly allowed a delayed GET to reopen stale form data.
  function toggleOrderForm() {
    if (showOrder) {
      closeOrder();
      return;
    }
    serverDraftRecoveryEpoch.current += 1;
    setServerDraftId("");
    setRecoveredServerDraftId("");
    setBillingRecipientId("");
    setPartnerEndCustomerId("");
    setShowOrder(true);
  }


  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState<
    "PICKUP" | "CUSTOMER_CARRIER"
  >("PICKUP");
  const [carrierName, setCarrierName] = useState("");
  const [paymentType, setPaymentType] = useState<"CASH" | "TERM">("CASH");
  const [paymentTermDays, setPaymentTermDays] = useState(28);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [customerReference, setCustomerReference] = useState("");
  const [notes, setNotes] = useState("");
  const [relationshipCustomerId, setRelationshipCustomerId] = useState("");
  const [showVisit, setShowVisit] = useState(false);
  const [showCredit, setShowCredit] = useState(false);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const customerCepLookup = useBrazilianCepAutofill({
    postalCode: customerAddress.postalCode,
    enabled: showCustomer,
    onResolved: (result) =>
      setCustomerAddress((current) => ({
        ...current,
        postalCode: result.postalCode,
        city: result.city,
        state: result.state,
        address: result.address || current.address,
        district: result.district || current.district,
      })),
  });

  const loadOptions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await portalApi<{
        customers: Customer[];
        variants: Variant[];
        catalog: CatalogInfo;
        draftScope: SignaOrderDraftScope | null;
      }>("/order-options");
      setCustomers(result.customers);
      setVariants(result.variants);
      setCatalog(result.catalog);
      setDraftScope(result.draftScope ?? null);
    } catch (cause) {
      setDraftScope(null);
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar clientes e produtos.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    if (!isDistributor) return;
    let active = true;
    setBillingLoading(true);
    void portalApi<{
      enabled: boolean;
      recipients: Array<{
        id: string;
        name: string;
        documentType: "CNPJ" | "CPF";
        taxIdVerificationStatus: string;
        fiscalReady: boolean;
      }>;
    }>("/billing-recipients")
      .then((result) => {
        if (!active) return;
        setBillingEnabled(result.enabled);
        setBillingRecipients(result.recipients);
        // A new order must never preselect its fiscal recipient.
        setBillingRecipientId("");
      })
      .catch(() => {
        if (active) setError("Não foi possível consultar os destinatários fiscais. Atualize a página antes de enviar o pedido.");
      })
      .finally(() => { if (active) setBillingLoading(false); });
    return () => { active = false; };
  }, [isDistributor]);

  useEffect(() => {
    if (!isDistributor) return;
    let active = true;
    void portalApi<{customers: Array<{id:string;name:string;city?:string|null;state?:string|null}>}>("/end-customers")
      .then(result => { if(active) setEndCustomers(result.customers); })
      .catch(() => { /* Optional commercial customer list may not yet be configured. */ });
    return () => { active = false; };
  }, [isDistributor]);

  useEffect(() => {
    const distributorCustomer =
      isDistributor && customers.length === 1 ? customers[0] : null;
    if (!distributorCustomer) return;
    setCustomerId(distributorCustomer.id);
  }, [customers, isDistributor]);

  useEffect(() => {
    if (!isDistributor) return;
    const openNewOrder = () => {
      serverDraftRecoveryEpoch.current += 1;
      setError("");
      setMessage("");
      setBillingRecipientId("");
      setPartnerEndCustomerId("");
      setServerDraftId("");
      setRecoveredServerDraftId("");
      setEndCustomerSearch("");
      setShowOrder(true);
    };
    window.addEventListener("bbos:partner-order:new", openNewOrder);
    return () =>
      window.removeEventListener("bbos:partner-order:new", openNewOrder);
  }, [isDistributor]);

  const loadVisits = useCallback(async (selectedCustomerId: string) => {
    if (!selectedCustomerId) {
      setVisits([]);
      return;
    }
    setVisitsLoading(true);
    try {
      setVisits(
        await portalApi<Visit[]>(`/customers/${selectedCustomerId}/visits`),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar o histórico de visitas.",
      );
    } finally {
      setVisitsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isDistributor) {
      setVisits([]);
      return;
    }
    void loadVisits(relationshipCustomerId);
  }, [isDistributor, loadVisits, relationshipCustomerId]);

  const cleanItems = useMemo(
    () =>
      lines
        .filter((line) => line.productVariantId && line.quantity > 0)
        .map((line) => ({
          productVariantId: line.productVariantId,
          quantity: line.quantity,
        })),
    [lines],
  );

  const invalidateQuote = () => {
    setQuote(null);
    if (isDistributor) setDraftDirty(true);
  };

  // Only product/quantity/date drafts persist locally. Customer, fiscal and prices never do.
  // Do not overwrite a previously saved valid draft with incomplete edits.
  useEffect(() => {
    if (!draftDirty || !draftKey || !showOrder || !variants.length) return;
    const allowed = new Set(variants.map(variant => variant.productVariantId));
    const draft = createSignaOrderDraft(lines, allowed, deliveryMode, expectedDeliveryDate);
    if (!draft) {
      setDraftStatus("Alterações ainda não salvas: confira produtos, quantidades e data.");
      return;
    }
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(draft));
      setDraftDirty(false);
      setDraftStatus("Rascunho atualizado automaticamente neste navegador. Revise e recalcule a cotação antes de enviar.");
    } catch {
      setDraftStatus("Não foi possível salvar automaticamente. Use Salvar rascunho ou confira a privacidade do navegador.");
    }
  }, [draftDirty, draftKey, showOrder, variants, lines, deliveryMode, expectedDeliveryDate]);

  // Deliberately stores only a short-lived product/quantity draft in this browser.
  // Never persist clients, billing recipient, notes, payment details or quoted prices.
  function saveOrderDraft() {
    if (!draftKey || !variants.length) return;
    const allowed = new Set(variants.map(variant => variant.productVariantId));
    const draft = createSignaOrderDraft(lines, allowed, deliveryMode, expectedDeliveryDate);
    if (!draft) {
      setDraftStatus("Preencha produtos autorizados com quantidades inteiras positivas e uma data válida antes de salvar.");
      return;
    }
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(draft));
      setDraftDirty(false);
      setDraftStatus("Rascunho parcial salvo neste navegador. Preços e dados fiscais não foram guardados.");
    } catch {
      setDraftStatus("O navegador não permitiu salvar o rascunho. Confira suas configurações de privacidade.");
    }
  }

  function restoreOrderDraft() {
    if (!draftKey || !variants.length) return;
    try {
      const raw = window.localStorage.getItem(draftKey);
      const allowed = new Set(variants.map(variant => variant.productVariantId));
      const draft = parseSignaOrderDraft(raw, allowed);
      if (!draft) {
        setDraftStatus("Nenhum rascunho válido: pode ter expirado ou o catálogo mudou. Nada foi enviado.");
        return;
      }
      serverDraftRecoveryEpoch.current += 1;
      // A local-browser draft is an independent document. Restoring it must
      // revoke the edit target of any account draft previously recovered here;
      // otherwise the next "Salvar na conta" could overwrite that other draft.
      setServerDraftId("");
      setRecoveredServerDraftId("");
      setLines(draft.lines.map(line => ({ id: crypto.randomUUID(), ...line })));
      setDeliveryMode(draft.deliveryMode);
      setExpectedDeliveryDate(draft.expectedDeliveryDate);
      setCarrierName("");
      setNotes("");
      setCustomerReference("");
      setPartnerEndCustomerId("");
      setBillingRecipientId("");
      setQuote(null);
      setDraftDirty(false);
      setDraftStatus("Rascunho recuperado. Escolha novamente o destinatário fiscal, revise entrega e solicite nova cotação antes de enviar.");
    } catch {
      setDraftStatus("Não foi possível ler o rascunho neste navegador.");
    }
  }

  function clearOrderDraft() {
    if (!draftKey) return;
    try {
      window.localStorage.removeItem(draftKey);
      setDraftDirty(false);
      setDraftStatus("Rascunho deste navegador descartado. Nenhum pedido ou dado do servidor foi alterado.");
    } catch {
      setDraftStatus("Não foi possível descartar o rascunho neste navegador.");
    }
  }


  // Server drafts belong to the signed-in Signa user, never to a shared browser.
  // The API validates the current catalog, fiscal recipient and commercial buyer.
  const refreshServerDrafts = useCallback(async () => {
    if (!isDistributor || !draftScope) return;
    const response = await portalApi<{ drafts: ServerOrderDraft[] }>("/order-drafts");
    setServerDrafts(response.drafts);
  }, [isDistributor, draftScope]);

  useEffect(() => {
    if (!draftScope || !isDistributor) {
      serverDraftRecoveryEpoch.current += 1;
      setServerDrafts([]);
      setServerDraftId("");
      setRecoveredServerDraftId("");
      return;
    }
    void refreshServerDrafts().catch(() => {
      setDraftStatus("Não foi possível carregar rascunhos da conta. O envio de pedidos não foi afetado.");
    });
  }, [draftScope, isDistributor, refreshServerDrafts]);

  async function saveServerDraft() {
    if (!draftScope || serverDraftBusy) return;
    setServerDraftBusy(true);
    setDraftStatus("");
    try {
      const payload = {
        customerId: customerId || null,
        partnerEndCustomerId: partnerEndCustomerId || null,
        billingRecipientId: billingRecipientId || null,
        items: cleanItems,
        deliveryMode, carrierName, expectedDeliveryDate, customerReference, notes,
      };
      const editTarget = signaServerDraftEditTarget(
        serverDraftId, recoveredServerDraftId, new Set(serverDrafts.map(draft => draft.id)),
      );
      const previous = serverDrafts.find(draft => draft.id === editTarget);
      const result = previous
        ? await portalApi<ServerOrderDraft>("/order-drafts/" + previous.id, {
            method: "PATCH", body: JSON.stringify({ version: previous.version, payload }),
          })
        : await portalApi<ServerOrderDraft>("/order-drafts", {
            method: "POST", body: JSON.stringify({ payload }),
          });
      setServerDraftId(result.id);
      setRecoveredServerDraftId(result.id);
      setServerDrafts(current =>
        [result, ...current.filter(draft => draft.id !== result.id)]
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      );
      setDraftStatus("Rascunho salvo na conta. Pode recuperar noutro dispositivo. Recalcule a cotação antes de enviar.");
    } catch (cause) {
      setDraftStatus(
        (cause instanceof Error ? cause.message : "Não foi possível guardar o rascunho na conta.") +
        " Para editar o registro existente, recupere-o novamente; salvar sem recuperar cria uma cópia independente.",
      );
      // After a 409, refreshing list versions must not permit a blind second PATCH:
      // discard recovered edit authority until the user explicitly loads the current version.
      setRecoveredServerDraftId("");
      await refreshServerDrafts().catch(() => {});
    } finally {
      setServerDraftBusy(false);
    }
  }

  async function restoreServerDraft() {
    if (!serverDraftId || serverDraftBusy) return;
    const requestedId = serverDraftId;
    const requestEpoch = ++serverDraftRecoveryEpoch.current;
    // A failed or interrupted recovery must not retain permission to PATCH a prior draft.
    setRecoveredServerDraftId("");
    setServerDraftBusy(true);
    try {
      const saved = await portalApi<ServerOrderDraft>("/order-drafts/" + encodeURIComponent(requestedId));
      // Never apply a late response after selection, form or account context changes.
      if (!signaServerDraftRecoveryIsCurrent(requestedId, saved.id, requestEpoch, serverDraftRecoveryEpoch.current)) return;
      const allowed = new Set(variants.map(variant => variant.productVariantId));
      if (saved.payload.items.some(item => !allowed.has(item.productVariantId))) {
        setDraftStatus("Catálogo alterado. Este rascunho não pode ser recuperado sem revisão pela Bispo.");
        return;
      }
      if (saved.payload.customerId && !customers.some(customer => customer.id === saved.payload.customerId)) {
        setDraftStatus("O comprador do rascunho já não está autorizado para este acesso.");
        return;
      }
      setCustomerId(saved.payload.customerId || "");
      setLines(saved.payload.items.length
        ? saved.payload.items.map(item => ({ id: crypto.randomUUID(), ...item }))
        : [newLine()]);
      setPartnerEndCustomerId(
        endCustomers.some(customer => customer.id === saved.payload.partnerEndCustomerId)
          ? saved.payload.partnerEndCustomerId || "" : "",
      );
      setBillingRecipientId(
        billingRecipients.some(recipient => recipient.id === saved.payload.billingRecipientId)
          ? saved.payload.billingRecipientId || "" : "",
      );
      setDeliveryMode(saved.payload.deliveryMode);
      setCarrierName(saved.payload.carrierName);
      setExpectedDeliveryDate(saved.payload.expectedDeliveryDate);
      setCustomerReference(saved.payload.customerReference);
      setNotes(saved.payload.notes);
      setQuote(null);
      setDraftDirty(false);
      setShowOrder(true);
      setRecoveredServerDraftId(saved.id);
      setServerDrafts(current => [saved, ...current.filter(draft => draft.id !== saved.id)]);
      setDraftStatus("Rascunho recuperado da conta. Confirme destinatário fiscal, disponibilidade e cotação antes de enviar.");
    } catch (cause) {
      if (requestEpoch === serverDraftRecoveryEpoch.current) {
        setDraftStatus(cause instanceof Error ? cause.message : "Falha na recuperação do rascunho.");
      }
    } finally {
      setServerDraftBusy(false);
    }
  }

  // Copy the selected server draft as a new draft; never create or alter a SalesOrder.
  // Re-read under the current session so stale browser data cannot bypass server scope.
  async function duplicateServerDraft() {
    if (!draftScope || !serverDraftId || serverDraftBusy) return;
    setServerDraftBusy(true);
    setDraftStatus("");
    try {
      const saved = await portalApi<ServerOrderDraft>(
        "/order-drafts/" + encodeURIComponent(serverDraftId),
      );
      const copy = await portalApi<ServerOrderDraft>("/order-drafts", {
        method: "POST",
        body: JSON.stringify({ payload: saved.payload }),
      });
      setServerDrafts(current =>
        [copy, ...current].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      );
      setServerDraftId(copy.id);
      setRecoveredServerDraftId("");
      setDraftStatus("Cópia independente criada na conta. Recupere-a para editar e confira os dados antes de enviar.");
    } catch (cause) {
      setDraftStatus(cause instanceof Error ? cause.message : "Não foi possível duplicar o rascunho.");
      await refreshServerDrafts().catch(() => {});
    } finally {
      setServerDraftBusy(false);
    }
  }

  async function discardServerDraft() {
    const previous = serverDrafts.find(draft => draft.id === serverDraftId);
    if (!previous || serverDraftBusy) return;
    setServerDraftBusy(true);
    try {
      await portalApi("/order-drafts/" + previous.id, {
        method: "DELETE", body: JSON.stringify({ version: previous.version }),
      });
      setServerDrafts(current => current.filter(draft => draft.id !== previous.id));
      setServerDraftId("");
      if (recoveredServerDraftId === previous.id) setRecoveredServerDraftId("");
      setDraftStatus("Rascunho descartado da conta. Nenhum pedido foi alterado.");
    } catch (cause) {
      setDraftStatus(cause instanceof Error ? cause.message : "Não foi possível descartar o rascunho.");
      await refreshServerDrafts().catch(() => {});
    } finally {
      setServerDraftBusy(false);
    }
  }

  async function createCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const customer = await portalApi<Customer>("/customers", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(data.entries())),
      });
      await loadOptions();
      setCustomerId(customer.id);
      setRelationshipCustomerId(customer.id);
      setShowCustomer(false);
      closeOrder();
      setShowVisit(true);
      setShowCredit(false);
      setMessage(
        "Cliente cadastrado. Registre agora os fatos desta primeira visita.",
      );
      form.reset();
      setCustomerAddress(emptyCustomerAddress);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível cadastrar o cliente.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function createVisit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!relationshipCustomerId) {
      setError("Selecione o cliente visitado.");
      return;
    }
    setBusy(true);
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await portalApi(`/customers/${relationshipCustomerId}/visits`, {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(data.entries())),
      });
      form.reset();
      const visitAt = form.elements.namedItem(
        "visitAt",
      ) as HTMLInputElement | null;
      if (visitAt) visitAt.value = localDateTime();
      setShowVisit(false);
      setMessage("Visita registrada no histórico do cliente.");
      await loadVisits(relationshipCustomerId);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível registrar a visita.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function requestCredit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!relationshipCustomerId) {
      setError("Selecione o cliente para solicitar crédito.");
      return;
    }
    setBusy(true);
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await portalApi(`/customers/${relationshipCustomerId}/credit-request`, {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(data.entries())),
      });
      setShowCredit(false);
      setMessage("Solicitação de crédito enviada para análise da Bispo.");
      form.reset();
      await loadOptions();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível solicitar o crédito.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function calculateQuote() {
    if (!customerId || cleanItems.length !== lines.length) {
      setError("Selecione o cliente e preencha todos os produtos.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      setQuote(
        await portalApi<Quote>("/quote", {
          method: "POST",
          body: JSON.stringify({ customerId, items: cleanItems }),
        }),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível conferir o pedido.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveEndCustomer() {
    if (!newEndCustomerName.trim()) { setError("Informe o nome do cliente final."); return; }
    setSavingEndCustomer(true);
    setError("");
    const editingId = editingEndCustomerId;
    const city = newEndCustomerCity.trim();
    const state = newEndCustomerState.trim().toUpperCase();
    try {
      const result = await portalApi<{id:string;name:string;city?:string|null;state?:string|null}>(
        editingId ? `/end-customers/${encodeURIComponent(editingId)}` : "/end-customers",
        {
          method: editingId ? "PATCH" : "POST",
          body: JSON.stringify({name:newEndCustomerName,city,state}),
        },
      );
      const entry = {
        id: result.id, name: result.name,
        city: result.city ?? (city || null),
        state: result.state ?? (state || null),
      };
      setEndCustomers(previous => (
        editingId ? previous.map(customer => customer.id === editingId ? entry : customer) : [...previous, entry]
      ).sort((left,right) => left.name.localeCompare(right.name)));
      setEndCustomerSearch("");
      setPartnerEndCustomerId(result.id);
      setEditingEndCustomerId("");
      setNewEndCustomerName("");
      setNewEndCustomerCity("");
      setNewEndCustomerState("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar o cliente comercial.");
    } finally { setSavingEndCustomer(false); }
  }

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (billingLoading) {
      setError("Aguarde a consulta dos destinatários fiscais antes de enviar o pedido.");
      return;
    }
    if (billingEnabled && !billingRecipientId) {
      setError("Selecione Signa (CNPJ) ou Rodrigo (CPF) como destinatário fiscal.");
      return;
    }
    if (!quote) {
      setError("Confira o pedido antes de enviá-lo.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const order = await portalApi<{ code: string; message: string }>(
        "/orders",
        {
          method: "POST",
          body: JSON.stringify({
            partnerEndCustomerId: isDistributor ? partnerEndCustomerId || null : undefined,
            customerId,
            billingRecipientId: billingEnabled ? billingRecipientId : undefined,
            items: cleanItems,
            deliveryMode,
            carrierName,
            paymentType: isDistributor ? "CASH" : paymentType,
            paymentTermDays:
              !isDistributor && paymentType === "TERM"
                ? paymentTermDays
                : undefined,
            expectedDeliveryDate,
            customerReference,
            notes,
          }),
        },
      );
      setMessage(`${order.code} criado. ${order.message}`);
      // Only remove the local draft after the server confirms the order.
      if (draftKey) {
        try { window.localStorage.removeItem(draftKey); } catch { /* Storage may be disabled. */ }
        setDraftStatus("");
        setDraftDirty(false);
      }
      closeOrder();
      setLines([newLine()]);
      const distributorCustomer =
        isDistributor && customers.length === 1 ? customers[0] : null;
      setCustomerId(distributorCustomer?.id ?? "");
      setBillingRecipientId("");
      setPartnerEndCustomerId("");
      setEndCustomerSearch("");
      setQuote(null);
      setCarrierName("");
      setPaymentType("CASH");
      setPaymentTermDays(28);
      setExpectedDeliveryDate("");
      setCustomerReference("");
      setNotes("");
      await onOrderCreated();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível criar o pedido.",
      );
    } finally {
      setBusy(false);
    }
  }

  const relationshipCustomer = customers.find(
    (customer) => customer.id === relationshipCustomerId,
  );
  const availableProductsByLine = useMemo(() => {
    const groups = new Map<string, Variant[]>();
    for (const variant of variants) {
      const line = variant.line || "Outros";
      groups.set(line, [...(groups.get(line) ?? []), variant]);
    }
    return [...groups.entries()]
      .sort(([, leftItems], [, rightItems]) => {
        const leftOrder = Math.min(
          ...leftItems.map((item) => item.catalogSortOrder ?? 9999),
        );
        const rightOrder = Math.min(
          ...rightItems.map((item) => item.catalogSortOrder ?? 9999),
        );
        return leftOrder - rightOrder;
      })
      .map(([line, items]) => ({
        line,
        items: items.sort(
          (left, right) =>
            (left.catalogSortOrder ?? 9999) -
              (right.catalogSortOrder ?? 9999) ||
            left.presentationGrams - right.presentationGrams,
        ),
      }));
  }, [variants]);

  return (
    <section
      className={`border ${
        isDistributor
          ? "rounded-2xl border-[var(--bbos-surface-border)] bg-[var(--bbos-surface-subtle)] p-3 pb-24 sm:p-4 sm:pb-4"
          : "rounded-3xl border-[var(--bbos-surface-border)] bg-[var(--bbos-surface-subtle)] p-5 sm:p-7"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {!isDistributor && (
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--bbos-coffee-green)]">
              Operação liberada ·{" "}
              {accessLevel === "SALES_MANAGER"
                ? "Gerente comercial · carteira completa"
                : "Vendedor · somente sua carteira"}
            </p>
          )}
          <h2
            className={`mt-1 font-semibold ${isDistributor ? "text-xl" : "text-2xl"}`}
          >
            {isDistributor ? "Produtos disponíveis" : "Pedidos para clientes"}
          </h2>
          {!isDistributor && (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
              Use clientes vinculados ao seu acesso ou cadastre um novo. O preço
              vem da tabela oficial e o pedido segue para conferência da Bispo.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {!isDistributor && (
            <button
              type="button"
              onClick={() => setShowCustomer((value) => !value)}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-800 bg-white px-4 py-3 text-xs font-bold text-emerald-900"
            >
              <UserPlus size={15} /> Cadastrar cliente
            </button>
          )}
          <button
            type="button"
            onClick={toggleOrderForm}
            disabled={
              (isDistributor && customers.length !== 1) || !variants.length
            }
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--bbos-action-primary)] px-4 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-[var(--bbos-action-primary-hover)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <ShoppingCart size={15} /> Novo pedido
          </button>
        </div>
      </div>

      {loading && (
        <p className="mt-5 text-xs text-stone-500">
          Carregando clientes e catálogo…
        </p>
      )}
      {error && (
        <div className="mt-5 flex items-start justify-between gap-3 rounded-xl bg-red-50 p-3 text-xs text-red-800">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")}>
            <X size={14} />
          </button>
        </div>
      )}
      {message && (
        <p className="mt-5 rounded-xl bg-white p-3 text-xs font-semibold text-emerald-900">
          {message}
        </p>
      )}

      {isDistributor && availableProductsByLine.length > 0 && (
        <section
          id="catalogo-signa"
          className="mt-3 scroll-mt-4 rounded-2xl border border-emerald-900/10 bg-white p-3 sm:p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--bbos-coffee-green)]">
                Catálogo Signa
              </p>
            </div>
            <span className="rounded-full bg-[var(--bbos-nav-active)] px-3 py-1 text-xs font-bold text-[var(--bbos-coffee-green)]">
              {variants.length} apresentações
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {availableProductsByLine.map((group, groupIndex) => (
              <div
                key={group.line}
                className={`rounded-xl border p-3 ${distributorCatalogTones[groupIndex % distributorCatalogTones.length]}`}
              >
                <p className="text-sm font-bold text-[var(--bbos-text-primary)]">
                  {group.line}
                </p>
                <div className="mt-2 space-y-1.5">
                  {group.items.map((variant) => (
                    <p
                      key={variant.productVariantId}
                      className="flex items-center justify-between gap-3 text-xs text-stone-600"
                    >
                      <span className="font-medium">
                        {variant.presentationGrams >= 1000
                          ? `${variant.presentationGrams / 1000} kg`
                          : `${variant.presentationGrams} g`}
                      </span>
                      <span className="whitespace-nowrap font-bold text-stone-700">
                        {variant.catalogPrice != null
                          ? money.format(variant.catalogPrice)
                          : "Consultar"}
                      </span>
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {showCustomer && !isDistributor && (
        <form
          onSubmit={createCustomer}
          className="mt-6 grid gap-3 rounded-2xl bg-white p-4 sm:grid-cols-2"
        >
          <PortalField label="Nome / razão social">
            <input name="name" required />
          </PortalField>
          <PortalField label="Razão social (CNPJ)">
            <input name="legalName" />
          </PortalField>
          <PortalField label="Nome fantasia">
            <input name="tradeName" />
          </PortalField>
          <PortalField label="CPF/CNPJ *">
            <input name="taxId" inputMode="numeric" required />
          </PortalField>
          <PortalField label="Segmento">
            <select name="segment" defaultValue="B2B">
              <option value="B2B">Empresa / B2B</option>
              <option value="Cafeteria">Cafeteria</option>
              <option value="Escritório">Escritório</option>
              <option value="Distribuidor">Distribuidor</option>
            </select>
          </PortalField>
          <PortalField label="E-mail">
            <input name="email" type="email" />
          </PortalField>
          <PortalField label="Telefone internacional">
            <input name="phone" placeholder="+5543999999999" />
          </PortalField>
          <PortalField label="CEP *">
            <input
              name="postalCode"
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="00000-000"
              value={formatBrazilianCep(customerAddress.postalCode)}
              onChange={(event) =>
                setCustomerAddress((current) => ({
                  ...current,
                  postalCode: brazilianCepDigits(event.target.value),
                }))
              }
              required
            />
            {customerCepLookup.statusText && (
              <span
                className={`mt-1 block text-xs ${
                  customerCepLookup.status === "found"
                    ? "text-emerald-700"
                    : customerCepLookup.status === "not-found" ||
                        customerCepLookup.status === "error"
                      ? "text-amber-700"
                      : "text-stone-500"
                }`}
              >
                {customerCepLookup.statusText}
              </span>
            )}
          </PortalField>
          <div className="grid grid-cols-[1fr_90px] gap-3">
            <PortalField label="Cidade">
              <input
                name="city"
                value={customerAddress.city}
                onChange={(event) =>
                  setCustomerAddress((current) => ({
                    ...current,
                    city: event.target.value,
                  }))
                }
                required
              />
            </PortalField>
            <PortalField label="UF">
              <input
                name="state"
                maxLength={2}
                value={customerAddress.state}
                onChange={(event) =>
                  setCustomerAddress((current) => ({
                    ...current,
                    state: event.target.value.toUpperCase(),
                  }))
                }
                required
              />
            </PortalField>
          </div>
          <PortalField label="Logradouro *">
            <input
              name="address"
              value={customerAddress.address}
              onChange={(event) =>
                setCustomerAddress((current) => ({
                  ...current,
                  address: event.target.value,
                }))
              }
              required
            />
          </PortalField>
          <PortalField label="Número *">
            <input
              name="addressNumber"
              placeholder="Use S/N quando necessário"
              required
            />
          </PortalField>
          <PortalField label="Complemento">
            <input name="addressComplement" />
          </PortalField>
          <PortalField label="Bairro *">
            <input
              name="district"
              value={customerAddress.district}
              onChange={(event) =>
                setCustomerAddress((current) => ({
                  ...current,
                  district: event.target.value,
                }))
              }
              required
            />
          </PortalField>
          <PortalField label="Situação da inscrição estadual">
            <select name="stateRegistrationType" defaultValue="">
              <option value="">Selecione para CNPJ</option>
              <option value="NUMBER">Contribuinte com IE</option>
              <option value="EXEMPT">Isento</option>
              <option value="NON_TAXPAYER">Não contribuinte</option>
            </select>
          </PortalField>
          <PortalField label="Inscrição estadual">
            <input name="stateRegistration" />
          </PortalField>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button
              type="button"
              onClick={() => setShowCustomer(false)}
              className="rounded-xl border px-4 py-2.5 text-xs font-bold"
            >
              Cancelar
            </button>
            <button
              disabled={busy}
              className="rounded-xl bg-[#14201d] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
            >
              Salvar cliente
            </button>
          </div>
        </form>
      )}

      {!isDistributor && (
        <section className="mt-6 rounded-2xl border border-emerald-900/10 bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#087568]">
                Relacionamento comercial
              </p>
              <h3 className="mt-1 text-lg font-semibold">
                Visitas, crédito e histórico
              </h3>
              <p className="mt-1 text-xs leading-5 text-stone-500">
                Registre o que aconteceu no cliente e deixe a próxima ação clara
                para toda a equipe.
              </p>
            </div>
            <History size={20} className="text-emerald-800" />
          </div>

          <div className="mt-4">
            <PortalField label="Cliente">
              <select
                value={relationshipCustomerId}
                onChange={(event) => {
                  setRelationshipCustomerId(event.target.value);
                  setShowVisit(false);
                  setShowCredit(false);
                }}
              >
                <option value="">Selecione o cliente</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.tradeName || customer.name}
                    {customer.city
                      ? ` · ${customer.city}/${customer.state || ""}`
                      : ""}
                  </option>
                ))}
              </select>
            </PortalField>
          </div>

          {relationshipCustomer && (
            <>
              <div
                className={`grid gap-2 ${isDistributor ? "mt-3 grid-cols-2" : "mt-4 sm:grid-cols-3"}`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowVisit((value) => !value);
                    setShowCredit(false);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#14201d] px-4 py-3 text-xs font-bold text-white"
                >
                  <CalendarDays size={15} /> Registrar visita
                </button>
                <button
                  type="button"
                  disabled={relationshipCustomer.creditReviewPending}
                  onClick={() => {
                    setShowCredit((value) => !value);
                    setShowVisit(false);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-xs font-bold text-violet-800 disabled:opacity-45"
                >
                  <CreditCard size={15} />
                  {relationshipCustomer.creditReviewPending
                    ? "Crédito em análise"
                    : "Solicitar crédito"}
                </button>
                <button
                  type="button"
                  disabled={!variants.length}
                  onClick={() => {
                    setCustomerId(relationshipCustomer.id);
                    setShowOrder(true);
                    setShowVisit(false);
                    setShowCredit(false);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-800 px-4 py-3 text-xs font-bold text-emerald-900 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <ShoppingCart size={15} /> Fazer pedido
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider">
                <span className="rounded-full bg-stone-100 px-2.5 py-1 text-stone-600">
                  {relationshipCustomer.segment || "Sem segmento"}
                </span>
                <span className="rounded-full bg-violet-50 px-2.5 py-1 text-violet-700">
                  Crédito:{" "}
                  {creditStatusLabel(relationshipCustomer.creditStatus)}
                </span>
                {relationshipCustomer.creditStatus === "APPROVED" && (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                    Limite{" "}
                    {money.format(
                      Number(relationshipCustomer.creditLimit || 0),
                    )}
                  </span>
                )}
              </div>
            </>
          )}

          {showVisit && relationshipCustomer && !isDistributor && (
            <form
              onSubmit={createVisit}
              className="mt-5 grid gap-3 rounded-2xl bg-[#f5f3ed] p-4 sm:grid-cols-2"
            >
              <PortalField label="Data e hora da visita">
                <input
                  name="visitAt"
                  type="datetime-local"
                  defaultValue={localDateTime()}
                  required
                />
              </PortalField>
              <PortalField label="Pessoa que recebeu o vendedor">
                <input name="contactName" placeholder="Nome do contato" />
              </PortalField>
              <PortalField label="Objetivo da visita">
                <select name="purpose" defaultValue="PROSPECCAO" required>
                  <option value="PROSPECCAO">Prospecção</option>
                  <option value="APRESENTACAO">Apresentação de produtos</option>
                  <option value="NEGOCIACAO">Negociação</option>
                  <option value="POS_VENDA">Pós-venda</option>
                  <option value="COBRANCA">Cobrança</option>
                  <option value="OUTRO">Outro</option>
                </select>
              </PortalField>
              <PortalField label="Resultado">
                <select name="outcome" defaultValue="ACOMPANHAR" required>
                  <option value="ACOMPANHAR">Acompanhar</option>
                  <option value="INTERESSADO">Cliente interessado</option>
                  <option value="COTACAO">Solicitou cotação</option>
                  <option value="PEDIDO">Pedido encaminhado</option>
                  <option value="SEM_INTERESSE">Sem interesse agora</option>
                  <option value="NAO_LOCALIZADO">Contato não localizado</option>
                </select>
              </PortalField>
              <div className="sm:col-span-2">
                <PortalField label="Fatos registrados na visita">
                  <textarea
                    name="facts"
                    rows={4}
                    placeholder="O que foi conversado, necessidades, objeções, produtos de interesse e decisões tomadas."
                    required
                  />
                </PortalField>
              </div>
              <PortalField label="Próxima ação">
                <textarea
                  name="nextAction"
                  rows={2}
                  placeholder="Ex.: enviar amostras e retornar com proposta."
                />
              </PortalField>
              <PortalField label="Data da próxima ação">
                <input name="nextActionAt" type="datetime-local" />
              </PortalField>
              <div className="flex justify-end gap-2 sm:col-span-2">
                <button
                  type="button"
                  onClick={() => setShowVisit(false)}
                  className="rounded-xl border px-4 py-2.5 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#14201d] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  <ClipboardCheck size={14} /> Salvar visita
                </button>
              </div>
            </form>
          )}

          {showCredit && relationshipCustomer && (
            <form
              onSubmit={requestCredit}
              className="mt-5 grid gap-3 rounded-2xl bg-violet-50 p-4 sm:grid-cols-2"
            >
              <PortalField label="Limite solicitado (R$)">
                <input
                  name="requestedLimit"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                />
              </PortalField>
              <PortalField label="Condição solicitada">
                <select name="requestedTerms" defaultValue="28 dias" required>
                  <option value="7 dias">7 dias</option>
                  <option value="14 dias">14 dias</option>
                  <option value="21 dias">21 dias</option>
                  <option value="28 dias">28 dias</option>
                  <option value="30 dias">30 dias</option>
                  <option value="45 dias">45 dias</option>
                  <option value="60 dias">60 dias</option>
                </select>
              </PortalField>
              <PortalField label="Volume mensal estimado (R$)">
                <input name="monthlyVolume" type="number" min="0" step="0.01" />
              </PortalField>
              <PortalField label="Justificativa comercial">
                <textarea
                  name="rationale"
                  rows={3}
                  placeholder="Relacionamento, potencial, frequência de compra e demais informações relevantes."
                  required
                />
              </PortalField>
              <div className="flex justify-end gap-2 sm:col-span-2">
                <button
                  type="button"
                  onClick={() => setShowCredit(false)}
                  className="rounded-xl border px-4 py-2.5 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  disabled={busy}
                  className="rounded-xl bg-violet-800 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  Enviar para análise
                </button>
              </div>
            </form>
          )}

          {relationshipCustomer && !isDistributor && (
            <div className="mt-6 border-t border-stone-100 pt-5">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-bold">Histórico de visitas</h4>
                <button
                  type="button"
                  disabled={visitsLoading}
                  onClick={() => void loadVisits(relationshipCustomer.id)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 disabled:opacity-50"
                >
                  <RefreshCw size={13} /> Atualizar
                </button>
              </div>
              {visitsLoading ? (
                <p className="mt-3 text-xs text-stone-500">
                  Carregando histórico…
                </p>
              ) : visits.length ? (
                <div className="mt-3 space-y-3">
                  {visits.map((visit) => (
                    <article
                      key={visit.id}
                      className="rounded-2xl border border-stone-200 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-[#14201d]">
                            {purposeLabel(visit.purpose)} ·{" "}
                            {outcomeLabel(visit.outcome)}
                          </p>
                          <p className="mt-1 text-[11px] text-stone-500">
                            {new Date(visit.visitAt).toLocaleString("pt-BR")} ·{" "}
                            {visit.recordedByName}
                            {visit.contactName
                              ? ` · contato: ${visit.contactName}`
                              : ""}
                          </p>
                        </div>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-700">
                        {visit.facts}
                      </p>
                      {visit.nextAction && (
                        <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-900">
                          <strong>Próxima ação:</strong> {visit.nextAction}
                          {visit.nextActionAt
                            ? ` · ${new Date(visit.nextActionAt).toLocaleString("pt-BR")}`
                            : ""}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <p className="mt-3 rounded-xl border border-dashed p-4 text-center text-xs text-stone-500">
                  Nenhuma visita registrada para este cliente.
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {showOrder && (
        <>
          {isDistributor && (
            <button
              type="button"
              aria-label="Fechar novo pedido"
              onClick={() => closeOrder()}
              className="fixed inset-0 z-40 cursor-default bg-stone-950/45 backdrop-blur-[2px]"
            />
          )}
          <form
            onSubmit={createOrder}
            className={
              isDistributor
                ? "fixed inset-x-2 bottom-2 top-2 z-50 mx-auto max-w-3xl space-y-4 overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl sm:inset-x-5 sm:p-5"
                : "mt-6 space-y-4 rounded-2xl bg-white p-4 sm:p-5"
            }
          >
            {isDistributor && (
              <div className="sticky -top-4 z-10 -mx-4 -mt-4 flex items-center justify-between gap-4 border-b border-stone-100 bg-white/95 px-4 py-3 backdrop-blur sm:-top-5 sm:-mx-5 sm:-mt-5 sm:px-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#087568]">
                    Novo pedido Signa
                  </p>
                  <h3 className="text-lg font-semibold">Monte seu pedido</h3>
                </div>
                <button
                  type="button"
                  aria-label="Cancelar e fechar"
                  onClick={() => closeOrder()}
                  className="grid size-10 place-items-center rounded-full bg-stone-100 text-stone-600"
                >
                  <X size={18} />
                </button>
              </div>
            )}
            {isDistributor && (
              <div className="rounded-xl border border-[#d5dedc] bg-[#F3F6F5] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={saveOrderDraft} disabled={!draftKey || !variants.length || busy} className="rounded-lg bg-[#0E191D] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Salvar rascunho</button>
                  <button type="button" onClick={restoreOrderDraft} disabled={!draftKey || !variants.length || busy} className="rounded-lg border border-[#bacac6] bg-white px-3 py-2 text-xs font-semibold text-[#0E191D] disabled:opacity-40">Recuperar rascunho</button>
                  <button type="button" onClick={clearOrderDraft} disabled={!draftKey || busy} className="px-2 py-2 text-xs font-semibold text-slate-600 underline disabled:opacity-40">Descartar rascunho</button>
                </div>
                <p className="mt-2 text-xs text-slate-600">Salvo por até 30 dias somente neste navegador e neste acesso: produtos, quantidades, modalidade e data desejada. Dados pessoais, fiscais, notas e preços não são armazenados. Para concluir, confirme tudo e recalcule a cotação.</p>
                {draftStatus && <p role="status" className="mt-2 text-xs font-medium text-[#0E3A31]">{draftStatus}</p>}
              </div>
            )}
            {isDistributor && draftScope && (
              <div className="rounded-xl border border-[#d5dedc] bg-white p-3">
                <p className="text-xs font-semibold text-[#0E191D]">Rascunhos da conta Signa</p>
                <p className="mt-1 text-xs text-slate-600">Guardados com o seu acesso, também disponíveis noutros dispositivos. Não criam pedido, estoque reservado, NF-e ou cobrança. Para alterar um rascunho existente, selecione e use Recuperar da conta antes de salvar; apenas selecionar não o substitui.</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button type="button" disabled={busy || serverDraftBusy} onClick={() => void saveServerDraft()} className="rounded-lg bg-[#0E191D] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Salvar na conta</button>
                  <select aria-label="Selecionar rascunho da conta" value={serverDraftId} disabled={busy || serverDraftBusy} onChange={event => { serverDraftRecoveryEpoch.current += 1; setServerDraftId(event.target.value); setRecoveredServerDraftId(""); }} className="min-w-36 rounded-lg border border-slate-300 px-2 py-2 text-xs">
                    <option value="">Selecionar rascunho</option>
                    {serverDrafts.map(draft => (
                      <option key={draft.id} value={draft.id}>{new Date(draft.updatedAt).toLocaleString("pt-BR")} · {draft.payload.items.length} item(ns)</option>
                    ))}
                  </select>
                  <button type="button" disabled={!serverDraftId || busy || serverDraftBusy} onClick={() => void restoreServerDraft()} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-40">Recuperar da conta</button>
                  <button type="button" disabled={!serverDraftId || busy || serverDraftBusy} onClick={() => void duplicateServerDraft()} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-40">Duplicar na conta</button>
                   <button type="button" disabled={!serverDraftId || busy || serverDraftBusy} onClick={() => void discardServerDraft()} className="px-2 py-2 text-xs font-semibold text-red-700 underline disabled:opacity-40">Excluir da conta</button>
                </div>
              </div>
            )}
            {isDistributor && customers.length === 1 && customers[0] && (
              <div className="rounded-xl border border-emerald-900/10 bg-[#f7faf8] p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#087568]">
                  Comprador
                </p>
                <p className="mt-1 text-sm font-bold text-[#14201d]">
                  {customers[0].tradeName || customers[0].name}
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  Escolha os produtos e as quantidades para o seu próximo
                  pedido. {catalog?.productCount ?? 0} apresentação(ões)
                  disponíveis.
                </p>
              </div>
            )}
            {isDistributor && (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <label htmlFor="signa-end-customer" className="block text-sm font-semibold text-slate-900">Cliente final (registro comercial, não consta na NF-e)</label>
                <input type="search" aria-label="Pesquisar cliente atendido" placeholder="Pesquisar pelo nome, cidade ou UF" value={endCustomerSearch} onChange={event=>{ setEndCustomerSearch(event.target.value); setPartnerEndCustomerId(""); setEditingEndCustomerId(""); }} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                <select id="signa-end-customer" value={partnerEndCustomerId} onChange={event=>{ setPartnerEndCustomerId(event.target.value); setEditingEndCustomerId(""); }} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                  <option value="">Não indicar cliente final</option>
                  {searchSignaEndCustomers(endCustomers, endCustomerSearch).map(customer=><option key={customer.id} value={customer.id}>{customer.name}{customer.city ? ` — ${customer.city}` : ""}</option>)}
                </select>
                {partnerEndCustomerId && (
                  <button type="button" className="mt-2 text-sm font-semibold text-[#0E191D] underline" onClick={()=>{
                    const chosen = endCustomers.find(customer => customer.id === partnerEndCustomerId);
                    if (!chosen) return;
                    setEditingEndCustomerId(chosen.id);
                    setNewEndCustomerName(chosen.name);
                    setNewEndCustomerCity(chosen.city ?? "");
                    setNewEndCustomerState(chosen.state ?? "");
                  }}>Editar cliente selecionado</button>
                )}
                <details key={editingEndCustomerId ? "edit" : "new"} open={Boolean(editingEndCustomerId)} className="mt-3">
                  <summary className="cursor-pointer text-sm font-semibold text-[#0E191D]">{editingEndCustomerId ? "Editar cliente comercial" : "Cadastrar novo cliente final"}</summary>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <input aria-label="Nome do cliente final" placeholder="Nome ou razão social" value={newEndCustomerName} onChange={event=>setNewEndCustomerName(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm"/>
                    <input aria-label="Cidade do cliente final" placeholder="Cidade" value={newEndCustomerCity} onChange={event=>setNewEndCustomerCity(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm"/>
                    <input aria-label="UF do cliente final" placeholder="UF" maxLength={2} value={newEndCustomerState} onChange={event=>setNewEndCustomerState(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm"/>
                  </div>
                  <button type="button" disabled={savingEndCustomer || !newEndCustomerName.trim()} onClick={()=>void saveEndCustomer()} className="mt-3 rounded-lg bg-[#0E191D] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{savingEndCustomer ? "Salvando..." : editingEndCustomerId ? "Salvar alterações" : "Salvar cliente"}</button>
                  {editingEndCustomerId && <button type="button" className="ml-3 text-sm underline" onClick={()=>{
                    setEditingEndCustomerId("");
                    setNewEndCustomerName("");
                    setNewEndCustomerCity("");
                    setNewEndCustomerState("");
                  }}>Cancelar edição</button>}
                </details>
              </div>
            )}
            {isDistributor && (billingEnabled || billingLoading) && (
              <div className="rounded-xl border border-[#d5dedc] bg-white p-4">
                <fieldset>
                  <legend className="text-sm font-semibold text-[#0E191D]">Faturar para <span className="text-red-700">*</span></legend>
                  <p className="mt-1 text-xs text-slate-600">Escolha quem receberá a nota fiscal. Nenhuma opção vem selecionada.</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {billingRecipients.map((recipient) => (
                      <label key={recipient.id}
                        className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${billingRecipientId === recipient.id ? "border-[#0E191D] bg-[#E0EAE9]" : "border-[#d5dedc] bg-white hover:bg-[#F3F6F5]"}`}>
                        <input type="radio" name="signa-billing-recipient" required
                          disabled={billingLoading} value={recipient.id} checked={billingRecipientId === recipient.id}
                          onChange={() => setBillingRecipientId(recipient.id)}
                          className="size-4 accent-[#0E191D]" />
                        <span className="text-sm font-semibold text-[#0E191D]">{recipient.name}
                          <span className="block text-xs font-normal text-slate-600">{recipient.documentType}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  {!billingRecipientId && <p className="mt-2 text-xs font-medium text-amber-800">Seleção obrigatória para finalizar o pedido.</p>}
                  {!billingLoading && billingRecipients.length === 0 && <p className="mt-2 text-xs font-medium text-red-700">Nenhum destinatário fiscal disponível. Contacte a Bispo.</p>}
                </fieldset>
                <p className="mt-2 text-xs text-slate-600">
                  O preço permanece o da tabela exclusiva Signa, inclusive quando o faturamento é para Rodrigo.
                  O cliente final acima é apenas um registro comercial.
                </p>
                {billingRecipients.some((recipient) => recipient.id === billingRecipientId && (
                  recipient.taxIdVerificationStatus !== "VERIFIED" || !recipient.fiscalReady
                )) && (
                  <p className="mt-1 text-xs font-medium text-amber-800">
                    Os dados fiscais deste destinatário precisam ser validados pela Bispo antes da emissão da NF-e.
                  </p>
                )}
              </div>
            )}
            {!isDistributor && (
              <PortalField label="Cliente liberado">
                <select
                  value={customerId}
                  onChange={(event) => {
                    setCustomerId(event.target.value);
                    invalidateQuote();
                  }}
                  required
                >
                  <option value="">Selecione</option>
                  {customers.map((customer) => (
                    <option
                      key={customer.id}
                      value={customer.id}
                      disabled={customer.fiscalReadiness?.ready === false}
                    >
                      {customer.tradeName || customer.name}
                      {customer.city
                        ? ` · ${customer.city}/${customer.state || ""}`
                        : ""}
                      {customer.fiscalReadiness?.ready === false
                        ? " · cadastro fiscal pendente"
                        : ""}
                    </option>
                  ))}
                </select>
              </PortalField>
            )}
            {!customers.length && !loading && (
              <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
                {isDistributor
                  ? "Estamos preparando os dados da Signa para receber o próximo pedido. Tente novamente em instantes."
                  : "Cadastre um cliente ou peça à equipe Bispo para liberar um cliente existente."}
              </p>
            )}
            {!variants.length && !loading && (
              <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
                {isDistributor
                  ? "O catálogo Signa está sendo atualizado. Tente novamente em instantes."
                  : "A equipe Bispo ainda precisa liberar produtos e preços para esta lista comercial."}
              </p>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-stone-700">Produtos</p>
                <button
                  type="button"
                  onClick={() => {
                    setLines((current) => [...current, newLine()]);
                    invalidateQuote();
                  }}
                  className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800"
                >
                  <Plus size={13} /> Produto
                </button>
              </div>
              {lines.map((line, index) => (
                <div
                  key={line.id}
                  className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_100px_40px]"
                >
                  <select
                    value={line.productVariantId}
                    onChange={(event) => {
                      setLines((current) =>
                        current.map((item) =>
                          item.id === line.id
                            ? { ...item, productVariantId: event.target.value }
                            : item,
                        ),
                      );
                      invalidateQuote();
                    }}
                    required
                  >
                    <option value="">Selecione o produto</option>
                    {availableProductsByLine.map((group) => (
                      <optgroup key={group.line} label={group.line}>
                        {group.items.map((variant) => (
                          <option
                            key={`${variant.productVariantId}-${variant.warehouseId}`}
                            value={variant.productVariantId}
                          >
                            {variant.product} ·{" "}
                            {variant.presentationGrams >= 1000
                              ? `${variant.presentationGrams / 1000} kg`
                              : `${variant.presentationGrams} g`}{" "}
                            {variant.catalogPrice != null
                              ? `· ${money.format(variant.catalogPrice)} `
                              : ""}
                            ·{" "}
                            {isDistributor
                              ? "disponível sob encomenda"
                              : `estoque ${variant.availableStock}`}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(event) => {
                      setLines((current) =>
                        current.map((item) =>
                          item.id === line.id
                            ? {
                                ...item,
                                quantity: Math.max(
                                  1,
                                  Number(event.target.value),
                                ),
                              }
                            : item,
                        ),
                      );
                      invalidateQuote();
                    }}
                  />
                  <button
                    type="button"
                    aria-label={`Remover produto ${index + 1}`}
                    disabled={lines.length === 1}
                    onClick={() => {
                      setLines((current) =>
                        current.filter((item) => item.id !== line.id),
                      );
                      invalidateQuote();
                    }}
                    className="grid place-items-center text-stone-400 disabled:opacity-20"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {isDistributor && (
                <PortalField label="Condição de pagamento">
                  <div className="flex min-h-10 items-center rounded-xl border border-emerald-900/15 bg-[#f7faf8] px-3 py-2.5 text-sm font-semibold text-[#14201d]">
                    À vista na emissão da NF-e
                  </div>
                </PortalField>
              )}
              <PortalField label="Entrega">
                <select
                  value={deliveryMode}
                  onChange={(event) => {
                    setDeliveryMode(event.target.value as "PICKUP" | "CUSTOMER_CARRIER");
                    setDraftDirty(true);
                  }}
                >
                  <option value="PICKUP">Retirada na Bispo</option>
                  <option value="CUSTOMER_CARRIER">
                    Transportadora do cliente
                  </option>
                </select>
              </PortalField>
              {deliveryMode === "CUSTOMER_CARRIER" && (
                <PortalField label="Transportadora">
                  <input
                    value={carrierName}
                    onChange={(event) => setCarrierName(event.target.value)}
                    required
                  />
                </PortalField>
              )}
              <PortalField
                label={
                  isDistributor
                    ? "Data desejada para o produto pronto"
                    : "Entrega desejada"
                }
              >
                <input
                  type="date"
                  value={expectedDeliveryDate}
                  onChange={(event) => {
                    setExpectedDeliveryDate(event.target.value);
                    setDraftDirty(true);
                  }}
                />
                {isDistributor && (
                  <span className="mt-1 block text-[10px] leading-4 text-stone-500">
                    Esta é a data solicitada pela Signa, não um prazo confirmado. A Bispo poderá aceitá-la ou definir outra data na aprovação.
                  </span>
                )}
              </PortalField>
              <PortalField label="Referência do cliente">
                <input
                  value={customerReference}
                  onChange={(event) => setCustomerReference(event.target.value)}
                />
              </PortalField>
            </div>
            <PortalField label="Observações">
              <textarea
                rows={2}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </PortalField>

            {quote && (
              <div className="rounded-2xl bg-stone-950 p-4 text-white">
                {quote.items.map((item) => {
                  const variant = variants.find(
                    (candidate) =>
                      candidate.productVariantId === item.productVariantId,
                  );
                  return (
                    <div
                      key={item.productVariantId}
                      className="flex justify-between gap-3 py-1 text-xs text-stone-300"
                    >
                      <span>
                        {variant?.product || item.productVariantId} ·{" "}
                        {item.quantity} × {money.format(item.unitPrice)}
                      </span>
                      <strong>{money.format(item.totalAmount)}</strong>
                    </div>
                  );
                })}
                <div className="mt-3 flex justify-between border-t border-white/20 pt-3">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Total
                  </span>
                  <strong className="text-xl">
                    {money.format(quote.totalAmount)}
                  </strong>
                </div>
              </div>
            )}

            <div
              className={`flex flex-wrap items-center justify-end gap-2 ${
                isDistributor
                  ? "sticky -bottom-4 z-10 -mx-4 -mb-4 border-t border-stone-100 bg-white/95 p-3 backdrop-blur sm:-mx-5 sm:-mb-5 sm:px-5"
                  : ""
              }`}
            >
              {isDistributor && (
                <p
                  className={`w-full text-xs font-semibold sm:mr-auto sm:w-auto ${
                    quote ? "text-emerald-800" : "text-stone-600"
                  }`}
                >
                  {quote
                    ? "Pedido conferido. Agora você pode enviar."
                    : "Confira produtos, quantidades e valores para liberar o envio."}
                </p>
              )}
              <button
                type="button"
                onClick={() => closeOrder()}
                className="rounded-xl border px-4 py-2.5 text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void calculateQuote()}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition disabled:opacity-50 ${
                  quote
                    ? "border border-emerald-800 bg-white text-emerald-900"
                    : "bg-[#087568] text-white shadow-[0_8px_22px_rgba(8,117,104,0.24)] ring-2 ring-[#087568]/15"
                }`}
              >
                {quote ? <RefreshCw size={14} /> : <ClipboardCheck size={14} />}
                {quote ? "Conferir novamente" : "1. Conferir pedido"}
              </button>
              <button
                disabled={busy || !quote}
                title={
                  quote
                    ? "Enviar pedido para aprovação da Bispo"
                    : "Confira o pedido para liberar o envio"
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#14201d] px-4 py-2.5 text-xs font-bold text-white transition disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500"
              >
                <Send size={13} /> 2. Enviar pedido
              </button>
            </div>
          </form>
        </>
      )}

      {!isDistributor && (
        <div className="mt-7">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="text-base font-bold">Meus pedidos</h3>
              <p className="mt-0.5 text-xs text-stone-500">
                Acompanhe aprovação, produção, pagamento e NF-e em um só lugar.
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold text-stone-500">
              {orders.length} {orders.length === 1 ? "pedido" : "pedidos"}
            </span>
          </div>
          {orders.length ? (
            <>
              <div className="mt-3 overflow-x-auto rounded-2xl bg-white">
                <table className="w-full min-w-[620px] text-left text-xs">
                  <thead className="border-b bg-stone-50 text-[10px] uppercase tracking-wider text-stone-500">
                    <tr>
                      <th className="px-4 py-3">Pedido</th>
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">Situação</th>
                      <th className="px-4 py-3">Pagamento</th>
                      <th className="px-4 py-3">Documento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {orders.map((order) => (
                      <tr key={order.id} className={orderStatusTone(order).row}>
                        <td className="px-4 py-3 font-bold">{order.code}</td>
                        <td className="px-4 py-3">{order.customerName}</td>
                        <td className="px-4 py-3 text-stone-500">
                          {new Date(order.orderedAt).toLocaleDateString(
                            "pt-BR",
                          )}
                        </td>
                        <td className="px-4 py-3 font-bold">
                          {money.format(Number(order.totalAmount))}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${orderStatusTone(order).badge}`}
                          >
                            {statusLabel[order.status] || order.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p
                            className={`font-bold ${order.receivableStatus === "OVERDUE" ? "text-red-700" : "text-stone-700"}`}
                          >
                            {receivableStatusLabels[
                              order.receivableStatus || ""
                            ] ||
                              (order.paymentType === "TERM"
                                ? "Aguardando faturamento"
                                : "À vista")}
                          </p>
                          {order.paymentDate ? (
                            <p className="mt-1 text-[10px] text-emerald-700">
                              Pago em{" "}
                              {new Date(order.paymentDate).toLocaleDateString(
                                "pt-BR",
                              )}
                            </p>
                          ) : order.dueDate ? (
                            <p className="mt-1 text-[10px] text-stone-500">
                              Vence em{" "}
                              {new Date(order.dueDate).toLocaleDateString(
                                "pt-BR",
                              )}{" "}
                              · saldo{" "}
                              {money.format(Number(order.openAmount || 0))}
                            </p>
                          ) : order.paymentTermsSnapshot ? (
                            <p className="mt-1 text-[10px] text-stone-500">
                              {order.paymentTermsSnapshot}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            {order.invoiceStatus === "AUTHORIZED" &&
                            order.invoicePdfAvailable ? (
                              <a
                                href={`/api/partner-portal/orders/${order.id}/invoice/pdf`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex rounded-lg bg-emerald-900 px-3 py-2 text-[10px] font-bold text-white"
                              >
                                Baixar NF {order.invoiceNumber || ""}
                              </a>
                            ) : order.invoiceNumber ? (
                              <span className="inline-flex rounded-lg bg-emerald-50 px-3 py-2 text-[10px] font-bold text-emerald-800">
                                NF {order.invoiceNumber} ·{" "}
                                {order.invoiceStatus === "AUTHORIZED"
                                  ? "Autorizada"
                                  : "Em processamento"}
                              </span>
                            ) : (
                              <span className="inline-flex rounded-lg bg-stone-100 px-3 py-2 text-[10px] font-bold text-stone-500">
                                NF aguardando emissão pela Bispo
                              </span>
                            )}
                            {order.billingAvailable ? (
                              <a
                                href={`/api/partner-portal/orders/${order.id}/billing/pdf`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex rounded-lg border border-emerald-800 px-3 py-2 text-[10px] font-bold text-emerald-900"
                              >
                                Baixar cobrança
                              </a>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="mt-3 rounded-2xl border border-dashed border-emerald-900/20 bg-white/50 p-5 text-center text-xs text-stone-500">
              Você ainda não tem pedidos. Quando fizer o primeiro, ele aparecerá
              aqui.
            </p>
          )}
        </div>
      )}
      {isDistributor && !showOrder && (
        <nav className="fixed inset-x-3 bottom-3 z-30 mx-auto grid max-w-sm grid-cols-3 gap-1 rounded-2xl border border-emerald-900/10 bg-white/95 p-1.5 shadow-xl backdrop-blur md:hidden">
          <a
            href="#catalogo-signa"
            className="flex min-h-12 flex-col items-center justify-center rounded-xl text-[10px] font-bold text-[#087568]"
          >
            <ClipboardCheck size={17} />
            Produtos
          </a>
          <button
            type="button"
            onClick={() => setShowOrder(true)}
            disabled={customers.length !== 1 || !variants.length}
            className="flex min-h-12 flex-col items-center justify-center rounded-xl bg-[#14201d] text-[10px] font-bold text-white disabled:opacity-45"
          >
            <Plus size={17} />
            Novo pedido
          </button>
          <a
            href="#pedidos-em-andamento"
            className="flex min-h-12 flex-col items-center justify-center rounded-xl text-[10px] font-bold text-[#087568]"
          >
            <History size={17} />
            Pedidos
          </a>
        </nav>
      )}
    </section>
  );
}

function PortalField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="text-xs font-bold text-stone-700">
      {label}
      <div className="mt-1 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-stone-200 [&_input]:px-3 [&_input]:py-2.5 [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:border-stone-200 [&_select]:bg-white [&_select]:px-3 [&_select]:py-2.5 [&_textarea]:w-full [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:border-stone-200 [&_textarea]:px-3 [&_textarea]:py-2.5">
        {children}
      </div>
    </label>
  );
}
