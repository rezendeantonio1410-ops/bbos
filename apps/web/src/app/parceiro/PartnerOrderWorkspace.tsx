"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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
  product: string;
  sku: string;
  presentationGrams: number;
  availableStock: number;
};
type Order = {
  id: string;
  code: string;
  status: string;
  totalAmount: number | string;
  orderedAt: string;
  customerName: string;
};
type Line = { id: string; productVariantId: string; quantity: number };
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
const purposeLabel = (value: string) => purposeLabels[value] || value;
const outcomeLabel = (value: string) => outcomeLabels[value] || value;
const creditStatusLabel = (value?: string) =>
  creditStatusLabels[value || ""] || "não analisado";

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
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showCustomer, setShowCustomer] = useState(false);
  const [showOrder, setShowOrder] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState<
    "PICKUP" | "CUSTOMER_CARRIER"
  >("PICKUP");
  const [carrierName, setCarrierName] = useState("");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [customerReference, setCustomerReference] = useState("");
  const [notes, setNotes] = useState("");
  const [relationshipCustomerId, setRelationshipCustomerId] = useState("");
  const [showVisit, setShowVisit] = useState(false);
  const [showCredit, setShowCredit] = useState(false);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(false);

  const loadOptions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await portalApi<{
        customers: Customer[];
        variants: Variant[];
      }>("/order-options");
      setCustomers(result.customers);
      setVariants(result.variants);
    } catch (cause) {
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
    void loadVisits(relationshipCustomerId);
  }, [loadVisits, relationshipCustomerId]);

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

  const invalidateQuote = () => setQuote(null);

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
      setShowOrder(false);
      setShowVisit(true);
      setShowCredit(false);
      setMessage(
        "Cliente cadastrado. Registre agora os fatos desta primeira visita.",
      );
      form.reset();
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
          : "Não foi possível calcular o pedido.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quote) {
      setError("Calcule o pedido antes de enviá-lo.");
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
            customerId,
            items: cleanItems,
            deliveryMode,
            carrierName,
            expectedDeliveryDate,
            customerReference,
            notes,
          }),
        },
      );
      setMessage(`${order.code} criado. ${order.message}`);
      setShowOrder(false);
      setLines([newLine()]);
      setCustomerId("");
      setQuote(null);
      setCarrierName("");
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

  return (
    <section className="rounded-3xl border border-emerald-900/10 bg-[#eaf2ec] p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#087568]">
            Operação liberada ·{" "}
            {accessLevel === "DISTRIBUTOR"
              ? "Distribuidor"
              : accessLevel === "SALES_MANAGER"
                ? "Gerente comercial · carteira completa"
                : "Vendedor · somente sua carteira"}
          </p>
          <h2 className="mt-1 text-2xl font-semibold">Pedidos para clientes</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
            Use clientes vinculados ao seu acesso ou cadastre um novo. O preço
            vem da tabela oficial e o pedido segue para conferência da Bispo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowCustomer((value) => !value)}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-800 bg-white px-4 py-3 text-xs font-bold text-emerald-900"
          >
            <UserPlus size={15} /> Cadastrar cliente
          </button>
          <button
            type="button"
            onClick={() => setShowOrder((value) => !value)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#14201d] px-4 py-3 text-xs font-bold text-white"
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

      {showCustomer && (
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
            <input name="postalCode" inputMode="numeric" required />
          </PortalField>
          <div className="grid grid-cols-[1fr_90px] gap-3">
            <PortalField label="Cidade">
              <input name="city" required />
            </PortalField>
            <PortalField label="UF">
              <input name="state" maxLength={2} required />
            </PortalField>
          </div>
          <PortalField label="Logradouro *">
            <input name="address" required />
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
            <input name="district" required />
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
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
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
                onClick={() => {
                  setCustomerId(relationshipCustomer.id);
                  setShowOrder(true);
                  setShowVisit(false);
                  setShowCredit(false);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-800 px-4 py-3 text-xs font-bold text-emerald-900"
              >
                <ShoppingCart size={15} /> Fazer pedido
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider">
              <span className="rounded-full bg-stone-100 px-2.5 py-1 text-stone-600">
                {relationshipCustomer.segment || "Sem segmento"}
              </span>
              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-violet-700">
                Crédito: {creditStatusLabel(relationshipCustomer.creditStatus)}
              </span>
              {relationshipCustomer.creditStatus === "APPROVED" && (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                  Limite{" "}
                  {money.format(Number(relationshipCustomer.creditLimit || 0))}
                </span>
              )}
            </div>
          </>
        )}

        {showVisit && relationshipCustomer && (
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

        {relationshipCustomer && (
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

      {showOrder && (
        <form
          onSubmit={createOrder}
          className="mt-6 space-y-4 rounded-2xl bg-white p-4 sm:p-5"
        >
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
          {!customers.length && !loading && (
            <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
              Cadastre um cliente ou peça à equipe Bispo para liberar um cliente
              existente.
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
                  {variants.map((variant) => (
                    <option
                      key={`${variant.productVariantId}-${variant.warehouseId}`}
                      value={variant.productVariantId}
                    >
                      {variant.product} ·{" "}
                      {variant.presentationGrams >= 1000
                        ? `${variant.presentationGrams / 1000} kg`
                        : `${variant.presentationGrams} g`}{" "}
                      · estoque {variant.availableStock}
                    </option>
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
                              quantity: Math.max(1, Number(event.target.value)),
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
            <PortalField label="Entrega">
              <select
                value={deliveryMode}
                onChange={(event) =>
                  setDeliveryMode(
                    event.target.value as "PICKUP" | "CUSTOMER_CARRIER",
                  )
                }
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
            <PortalField label="Entrega desejada">
              <input
                type="date"
                value={expectedDeliveryDate}
                onChange={(event) =>
                  setExpectedDeliveryDate(event.target.value)
                }
              />
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

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowOrder(false)}
              className="rounded-xl border px-4 py-2.5 text-xs font-bold"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void calculateQuote()}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-800 px-4 py-2.5 text-xs font-bold text-emerald-900 disabled:opacity-50"
            >
              <RefreshCw size={13} /> Calcular
            </button>
            <button
              disabled={busy || !quote}
              className="inline-flex items-center gap-2 rounded-xl bg-[#14201d] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40"
            >
              <Send size={13} /> Enviar pedido
            </button>
          </div>
        </form>
      )}

      <div className="mt-7">
        <h3 className="text-sm font-bold">Pedidos criados por este acesso</h3>
        {orders.length ? (
          <div className="mt-3 overflow-x-auto rounded-2xl bg-white">
            <table className="w-full min-w-[620px] text-left text-xs">
              <thead className="border-b bg-stone-50 text-[10px] uppercase tracking-wider text-stone-500">
                <tr>
                  <th className="px-4 py-3">Pedido</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-4 py-3 font-bold">{order.code}</td>
                    <td className="px-4 py-3">{order.customerName}</td>
                    <td className="px-4 py-3 text-stone-500">
                      {new Date(order.orderedAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 font-bold">
                      {money.format(Number(order.totalAmount))}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800">
                        {statusLabel[order.status] || order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 rounded-2xl border border-dashed border-emerald-900/20 bg-white/50 p-5 text-center text-xs text-stone-500">
            Nenhum pedido criado por este acesso.
          </p>
        )}
      </div>
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
