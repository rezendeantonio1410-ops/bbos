"use client";

import { normalizeTaxId } from "@bbos/shared";

import Link from "next/link";
import {
  brazilMobileDigits,
  formatBrazilMobile,
  normalizeCustomerPhone,
  MOBILE_ERROR,
} from "@bbos/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BadgeDollarSign,
  Building2,
  Clock3,
  History,
  Info,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { fetchSessionIdentity, getApiRoot } from "@/lib/auth-session";
import { QUICK_FILTERS, cityOptions, districtOptions, healthChip, matchesPlace, matchesQuickFilter, taxIdNeedsCheck, type CustomerQuickFilter } from "@/lib/customer-list";
import { brazilianCepDigits, formatBrazilianCep } from "@/lib/brazil-address";
import { useCnpjRegistryAutofill } from "@/lib/use-cnpj-registry-autofill";
import { applyCnpjRecord } from "@/lib/cnpj-registry";
import { CnpjRegistryPanel, CnpjSearchButton } from "@/components/cnpj-registry-panel";
import { useBrazilianCepAutofill } from "@/lib/use-brazilian-cep-autofill";
import { CustomerTaxIdSuggestionWorkflow } from "@/components/customer-tax-id-suggestion-workflow";
import { CustomerPaymentWeekday } from "@/components/customer-payment-weekday";

type Health = {
  health: "HEALTHY" | "INFO" | "ATTENTION" | "BLOCKED";
  guidance: string;
  openReceivables: number;
  overdueAmount: number;
  overdueCount: number;
  maxDaysOverdue: number;
  availableCredit: number;
};

type Customer = {
  id: string;
  name: string;
  legalName?: string | null;
  tradeName?: string | null;
  taxId?: string | null;
  taxIdVerificationStatus?: string | null;
  taxIdVerifiedAt?: string | null;
  taxIdVerificationSource?: string | null;
  countryCode?: string | null;
  countryName?: string | null;
  foreignTaxId?: string | null;
  segment?: string | null;
  email?: string | null;
  phone?: string | null;
  postalCode?: string | null;
  address?: string | null;
  addressNumber?: string | null;
  addressComplement?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
  stateRegistration?: string | null;
  stateRegistrationType?: "NOT_DECLARED" | "NUMBER" | "EXEMPT" | "NON_TAXPAYER";
  paymentTerms?: string | null;
  active: boolean;
  creditStatus: "NOT_ANALYZED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
  creditLimit: string | number;
  creditNotes?: string | null;
  creditReviewedAt?: string | null;
  creditReviewedBy?: string | null;
  creditReviewPending?: boolean;
  fiscalReadiness?: {
    ready: boolean;
    issues: string[];
    documentType?: "CPF" | "CNPJ" | null;
  };
  financialHealth: Health;
};

type CreditEvent = {
  id: string;
  eventType: "REQUEST" | "DECISION";
  requestedLimit?: string | number | null;
  requestedTerms?: string | null;
  monthlyVolume?: string | number | null;
  rationale?: string | null;
  decisionStatus?: Customer["creditStatus"] | null;
  decidedLimit?: string | number | null;
  decisionTerms?: string | null;
  notes?: string | null;
  actorName: string;
  actorRole?: string | null;
  createdAt: string;
};

type CustomerVisit = {
  id: string;
  recordedByName: string;
  partnerName?: string | null;
  visitAt: string;
  contactName?: string | null;
  purpose: string;
  outcome: string;
  facts: string;
  nextAction?: string | null;
  nextActionAt?: string | null;
};

type CustomerSale = {
  id: string;
  orderNumber: string;
  status: string;
  orderedAt: string;
  totalAmount: string | number;
  paymentType?: string | null;
  paymentTermsSnapshot?: string | null;
  paymentStatus?: string | null;
  dueDate?: string | null;
  openAmount?: string | number | null;
  paymentDate?: string | null;
  items: Array<{
    productName: string;
    sku: string;
    quantity: number;
    unitPrice: string | number;
    totalAmount: string | number;
  }>;
};

const segments = [
  "Distribuidor",
  "Cafeteria",
  "Escritório",
  "Varejo",
  "Restaurante / Hotel",
  "White Label",
  "Exportação",
  "Consumidor final",
  "Outro",
];
const states = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];
const paymentOptions = [
  "À vista",
  "7 dias",
  "14 dias",
  "21 dias",
  "28 dias",
  "30 dias",
  "45 dias",
  "60 dias",
  "Personalizada",
];
const countries = [
  { code: "BR", name: "Brasil" },
  { code: "CN", name: "China" },
  { code: "US", name: "Estados Unidos" },
  { code: "DE", name: "Alemanha" },
  { code: "ES", name: "Espanha" },
  { code: "FR", name: "França" },
  { code: "GB", name: "Reino Unido" },
  { code: "IT", name: "Itália" },
  { code: "JP", name: "Japão" },
  { code: "PT", name: "Portugal" },
  { code: "SG", name: "Singapura" },
  { code: "AE", name: "Emirados Árabes Unidos" },
];
const emptyCustomer = {
  name: "",
  legalName: "",
  tradeName: "",
  taxId: "",
  countryCode: "BR",
  countryName: "Brasil",
  foreignTaxId: "",
  segment: "",
  email: "",
  phone: "",
  postalCode: "",
  address: "",
  addressNumber: "",
  addressComplement: "",
  district: "",
  city: "",
  state: "",
  stateRegistration: "",
  stateRegistrationType: "",
  paymentTerms: "",
};
const creditLabel = {
  NOT_ANALYZED: "Não analisado",
  UNDER_REVIEW: "Em análise",
  APPROVED: "Aprovado",
  REJECTED: "Reprovado",
};
const visitPurposeLabel: Record<string, string> = {
  PROSPECCAO: "Prospecção",
  APRESENTACAO: "Apresentação de produtos",
  NEGOCIACAO: "Negociação",
  POS_VENDA: "Pós-venda",
  COBRANCA: "Cobrança",
  OUTRO: "Outro",
};
const visitOutcomeLabel: Record<string, string> = {
  ACOMPANHAR: "Acompanhar",
  INTERESSADO: "Cliente interessado",
  COTACAO: "Solicitou cotação",
  PEDIDO: "Pedido encaminhado",
  SEM_INTERESSE: "Sem interesse agora",
  NAO_LOCALIZADO: "Contato não localizado",
};
const saleStatusLabel: Record<string, string> = {
  DRAFT: "Rascunho",
  CONFIRMED: "Confirmado",
  RESERVED: "Reservado",
  IN_PRODUCTION: "Em produção",
  PICKING: "Separação",
  READY_TO_SHIP: "Pronto",
  INVOICED: "Faturado",
  SHIPPED: "Expedido",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
};
const paymentStatusLabel: Record<string, string> = {
  OPEN: "Em aberto",
  PARTIAL: "Parcial",
  PAID: "Pago",
  OVERDUE: "Vencido",
  CANCELLED: "Cancelado",
};
const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
const dateOnly = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(
    new Date(value),
  );
const normalizedFirstName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .split(/\s+/)[0];
type CustomerFormField =
  | "countryCode"
  | "countryName"
  | "name"
  | "legalName"
  | "taxId"
  | "foreignTaxId"
  | "email"
  | "phone"
  | "postalCode"
  | "address"
  | "addressNumber"
  | "district"
  | "city"
  | "state"
  | "stateRegistrationType"
  | "stateRegistration";

type CustomerFormErrors = Partial<Record<CustomerFormField, string>>;

const customerFormErrors = (form: typeof emptyCustomer): CustomerFormErrors => {
  const errors: CustomerFormErrors = {};
  try {
    normalizeCustomerPhone(form.phone);
  } catch {
    errors.phone = MOBILE_ERROR;
  }
  const document = normalizeTaxId(form.taxId);
  const isForeign = form.countryCode !== "BR";
  if (!form.name.trim()) errors.name = "Informe o nome usado pela equipe.";
  if (isForeign && !/^[A-Z]{2}$/.test(form.countryCode))
    errors.countryCode = "Selecione o país fiscal do cliente.";
  if (isForeign && !form.countryName.trim())
    errors.countryName = "Informe o país fiscal do cliente.";
  if (isForeign && !form.foreignTaxId.trim())
    errors.foreignTaxId = "Informe a identificação fiscal estrangeira.";
  if (!isForeign && ![11, 14].includes(document.length))
    errors.taxId = "Informe um CPF com 11 dígitos ou CNPJ com 14 dígitos.";
  if (!isForeign && document.length === 14 && !form.legalName.trim())
    errors.legalName = "A razão social é obrigatória para CNPJ.";
  if (
    form.email.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
  )
    errors.email = "Informe um e-mail válido, como nome@empresa.com.br.";
  if (!isForeign && form.postalCode.replace(/\D/g, "").length !== 8)
    errors.postalCode = "Informe um CEP com 8 dígitos.";
  if (!form.address.trim()) errors.address = "Informe o logradouro.";
  if (!isForeign && !form.addressNumber.trim())
    errors.addressNumber = "Informe o número ou use S/N.";
  if (!form.district.trim()) errors.district = "Informe o bairro.";
  if (!form.city.trim()) errors.city = "Informe a cidade.";
  if (!isForeign && !form.state.trim()) errors.state = "Selecione a UF.";
  if (!isForeign && document.length === 14 && !form.stateRegistrationType)
    errors.stateRegistrationType =
      "Selecione a situação da inscrição estadual.";
  if (
    !isForeign &&
    document.length === 14 &&
    form.stateRegistrationType === "NUMBER" &&
    !form.stateRegistration.trim()
  )
    errors.stateRegistration = "Informe o número da inscrição estadual.";
  return errors;
};

const readableCustomerSaveError = (message: unknown, fallback: string) => {
  const text = Array.isArray(message)
    ? message.filter(Boolean).join(" ")
    : String(message ?? "").trim();
  if (!text) return fallback;
  if (/internal server error/i.test(text))
    return "O BBOS encontrou um erro ao salvar. Tente novamente; se continuar, avise o administrador.";
  return text;
};

const customerFieldFromServerError = (
  message: string,
): CustomerFormField | undefined => {
  const normalized = message.toLowerCase();
  if (/cpf|cnpj|documento fiscal|tax.?id/.test(normalized)) return "taxId";
  if (/razão social|razao social|legal.?name/.test(normalized))
    return "legalName";
  if (/e-?mail/.test(normalized)) return "email";
  if (/telefone|celular|whatsapp|phone/.test(normalized)) return "phone";
  if (/cep|código postal|codigo postal|postal/.test(normalized))
    return "postalCode";
  if (/logradouro|endereço|endereco|address/.test(normalized)) return "address";
  if (/bairro|district/.test(normalized)) return "district";
  if (/cidade|city/.test(normalized)) return "city";
  if (/inscrição estadual|inscricao estadual/.test(normalized))
    return "stateRegistration";
  return undefined;
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [taxIdCustomer, setTaxIdCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyCustomer);
  const [formErrors, setFormErrors] = useState<CustomerFormErrors>({});
  const [saving, setSaving] = useState(false);
  const cepLookup = useBrazilianCepAutofill({
    postalCode: form.postalCode,
    enabled: form.countryCode === "BR" && (showNew || Boolean(editCustomer)),
    onResolved: (result) =>
      setForm((current) => ({
        ...current,
        postalCode: result.postalCode,
        address: result.address || current.address,
        district: result.district || current.district,
        city: result.city,
        state: result.state,
      })),
  });

  // Complete CNPJ → public Receita Federal data (BrasilAPI + cnpj.ws, free).
  // Typing the CNPJ fills every empty field; "Buscar na Receita" refills all.
  // Fields stay editable; what the user typed by hand is kept unless they click.
  const cnpjLookup = useCnpjRegistryAutofill({
    cnpj: normalizeTaxId(form.taxId).length === 14 ? form.taxId : "",
    enabled: form.countryCode === "BR" && (showNew || Boolean(editCustomer)),
    onResolved: (record, context) =>
      setForm((current) => {
        const filled = applyCnpjRecord(current as unknown as Record<string, string>, record, {
          legalName: "legalName",
          tradeName: "tradeName",
          name: (r) => r.tradeName || r.legalName,
          postalCode: "postalCode",
          address: "street",
          addressNumber: "number",
          addressComplement: "complement",
          district: "district",
          city: "city",
          state: "state",
          email: "email",
          // This field is a mobile number (11 digits); landlines stay manual.
          phone: (r) => (r.phone && /^\d{2}9\d{8}$/.test(r.phone) ? r.phone : null),
          stateRegistration: (r) => r.suggestedStateRegistration ?? null,
        }, context) as unknown as typeof current;
        // A suggested IE means the state registration type is "number".
        return !current.stateRegistrationType && !current.stateRegistration && filled.stateRegistration
          ? { ...filled, stateRegistrationType: "NUMBER" }
          : filled;
      }),
  });

  const [requestCustomer, setRequestCustomer] = useState<Customer | null>(null);
  const [requestedLimit, setRequestedLimit] = useState("");
  const [requestedTerms, setRequestedTerms] = useState("28 dias");
  const [monthlyVolume, setMonthlyVolume] = useState("");
  const [requestRationale, setRequestRationale] = useState("");

  const [creditCustomer, setCreditCustomer] = useState<Customer | null>(null);
  const [creditStatus, setCreditStatus] =
    useState<Customer["creditStatus"]>("UNDER_REVIEW");
  const [creditLimit, setCreditLimit] = useState("0");
  const [creditTerms, setCreditTerms] = useState("28 dias");
  const [creditNotes, setCreditNotes] = useState("");
  const [creditHistory, setCreditHistory] = useState<CreditEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [visitCustomer, setVisitCustomer] = useState<Customer | null>(null);
  const [visitHistory, setVisitHistory] = useState<CustomerVisit[]>([]);
  const [visitHistoryLoading, setVisitHistoryLoading] = useState(false);
  const [salesHistory, setSalesHistory] = useState<CustomerSale[]>([]);
  const [salesHistoryLoading, setSalesHistoryLoading] = useState(false);
  const [canApproveCredit, setCanApproveCredit] = useState(false);
  const historyAutoOpened = useRef(false);

  const validateCustomerForm = () => {
    const validationErrors = customerFormErrors(form);
    setFormErrors(validationErrors);
    const invalidFields = Object.keys(validationErrors);
    if (invalidFields.length === 0) return true;

    setError(
      `Revise ${invalidFields.length} ${
        invalidFields.length === 1 ? "campo marcado" : "campos marcados"
      } em vermelho antes de salvar.`,
    );
    window.requestAnimationFrame(() => {
      const firstInvalid = document.querySelector<HTMLElement>(
        '[data-customer-field][data-invalid="true"]',
      );
      firstInvalid?.scrollIntoView({ behavior: "smooth", block: "center" });
      firstInvalid
        ?.querySelector<HTMLElement>("input, select, textarea")
        ?.focus({ preventScroll: true });
    });
    return false;
  };

  useEffect(() => {
    setFormErrors((current) =>
      Object.keys(current).length > 0 ? customerFormErrors(form) : current,
    );
  }, [form]);

  useEffect(() => {
    if (error.startsWith("Revise ") && Object.keys(formErrors).length === 0)
      setError("");
  }, [error, formErrors]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/customers", {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error(
          (await response.json().catch(() => ({})))?.message ??
            "Não foi possível carregar clientes.",
        );
      setCustomers(await response.json());
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar clientes.",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
    // "Ver clientes de <cidade>" from the sales map pre-fills the search.
    const preset = new URLSearchParams(window.location.search).get("busca");
    if (preset) setSearch(preset.slice(0, 80));
    if (new URLSearchParams(window.location.search).get("novo") === "1") {
      setError("");
      setFormErrors({});
      setShowNew(true);
    }
  }, []);
  useEffect(() => {
    void fetchSessionIdentity(getApiRoot(), { retryDelaysMs: [0] })
      .then((identity) => {
        const isLeader = ["ADMIN", "EXECUTIVE"].includes(identity.role);
        const firstName = normalizedFirstName(identity.name);
        setCanApproveCredit(
          isLeader && (firstName === "jose" || firstName === "suzi"),
        );
      })
      .catch(() => setCanApproveCredit(false));
  }, []);

  const [quick, setQuick] = useState<CustomerQuickFilter>("ALL");
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((c) =>
      [
        c.name,
        c.legalName,
        c.tradeName,
        c.taxId,
        c.foreignTaxId,
        c.countryName,
        c.city,
        c.state,
        c.segment,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term)),
    );
  }, [customers, search]);
  const [cityFilter, setCityFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const cities = useMemo(() => cityOptions(customers), [customers]);
  const districts = useMemo(() => districtOptions(customers, cityFilter), [customers, cityFilter]);
  const visible = useMemo(
    () => filtered.filter((c) => matchesQuickFilter(c, quick) && matchesPlace(c, cityFilter, districtFilter)),
    [filtered, quick, cityFilter, districtFilter],
  );

  const createCustomer = async () => {
    if (!validateCustomerForm()) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...form,
          phone: normalizeCustomerPhone(form.phone),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          readableCustomerSaveError(
            payload?.message,
            "Não foi possível cadastrar o cliente.",
          ),
        );
      setForm(emptyCustomer);
      setFormErrors({});
      setShowNew(false);
      await load();
    } catch (cause) {
      const message = readableCustomerSaveError(
        cause instanceof Error ? cause.message : cause,
        "Não foi possível cadastrar o cliente.",
      );
      setError(message);
      const serverField = customerFieldFromServerError(message);
      if (serverField)
        setFormErrors((current) => ({ ...current, [serverField]: message }));
      window.requestAnimationFrame(() => {
        const target = serverField
          ? document.querySelector<HTMLElement>(
              `[data-customer-field="${serverField}"]`,
            )
          : document.querySelector<HTMLElement>("[data-customer-form-alert]");
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (customer: Customer) => {
    setError("");
    setFormErrors({});
    setEditCustomer(customer);
    setForm({
      name: customer.name ?? "",
      legalName: customer.legalName ?? "",
      tradeName: customer.tradeName ?? "",
      taxId: customer.taxId ?? "",
      countryCode: customer.countryCode ?? "BR",
      countryName: customer.countryName ?? "Brasil",
      foreignTaxId: customer.foreignTaxId ?? "",
      segment: customer.segment ?? "",
      email: customer.email ?? "",
      phone: customer.phone ?? "",
      postalCode: customer.postalCode ?? "",
      address: customer.address ?? "",
      addressNumber: customer.addressNumber ?? "",
      addressComplement: customer.addressComplement ?? "",
      district: customer.district ?? "",
      city: customer.city ?? "",
      state: customer.state ?? "",
      stateRegistration: customer.stateRegistration ?? "",
      stateRegistrationType:
        customer.stateRegistrationType === "NOT_DECLARED"
          ? ""
          : (customer.stateRegistrationType ?? ""),
      paymentTerms: customer.paymentTerms ?? "",
    });
  };

  const saveCustomer = async () => {
    if (!editCustomer) return;
    if (!validateCustomerForm()) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/customers/${editCustomer.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...form,
          phone: normalizeCustomerPhone(form.phone),
          active: editCustomer.active,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          readableCustomerSaveError(
            payload?.message,
            "Não foi possível atualizar o cliente.",
          ),
        );
      setEditCustomer(null);
      setForm(emptyCustomer);
      setFormErrors({});
      await load();
    } catch (cause) {
      const message = readableCustomerSaveError(
        cause instanceof Error ? cause.message : cause,
        "Não foi possível atualizar o cliente.",
      );
      setError(message);
      const serverField = customerFieldFromServerError(message);
      if (serverField)
        setFormErrors((current) => ({ ...current, [serverField]: message }));
      window.requestAnimationFrame(() => {
        const target = serverField
          ? document.querySelector<HTMLElement>(
              `[data-customer-field="${serverField}"]`,
            )
          : document.querySelector<HTMLElement>("[data-customer-form-alert]");
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    } finally {
      setSaving(false);
    }
  };

  const openRequest = (customer: Customer) => {
    setError("");
    setRequestCustomer(customer);
    setRequestedLimit(
      customer.creditStatus === "APPROVED"
        ? String(customer.creditLimit ?? "")
        : "",
    );
    setRequestedTerms(
      customer.paymentTerms && customer.paymentTerms !== "À vista"
        ? customer.paymentTerms
        : "28 dias",
    );
    setMonthlyVolume("");
    setRequestRationale("");
  };

  const submitCreditRequest = async () => {
    if (!requestCustomer) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/customers/${requestCustomer.id}/credit-request`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            requestedLimit: Number(requestedLimit || 0),
            requestedTerms,
            monthlyVolume:
              monthlyVolume === "" ? undefined : Number(monthlyVolume),
            rationale: requestRationale,
          }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          payload?.message ??
            "Não foi possível enviar a solicitação de crédito.",
        );
      setRequestCustomer(null);
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível enviar a solicitação de crédito.",
      );
    } finally {
      setSaving(false);
    }
  };

  const fetchHistory = useCallback(async (customerId: string) => {
    setHistoryLoading(true);
    try {
      const response = await fetch(
        `/api/customers/${customerId}/credit-history`,
        { credentials: "include", cache: "no-store" },
      );
      setCreditHistory(response.ok ? await response.json() : []);
    } catch {
      setCreditHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const openCredit = useCallback(
    (customer: Customer) => {
      setError("");
      setCreditCustomer(customer);
      setCreditStatus(
        customer.creditStatus === "NOT_ANALYZED"
          ? "UNDER_REVIEW"
          : customer.creditStatus,
      );
      setCreditLimit(String(customer.creditLimit ?? 0));
      setCreditTerms(
        customer.paymentTerms && customer.paymentTerms !== "À vista"
          ? customer.paymentTerms
          : "28 dias",
      );
      setCreditNotes(customer.creditNotes ?? "");
      void fetchHistory(customer.id);
    },
    [fetchHistory],
  );

  const openVisits = useCallback(async (customer: Customer) => {
    setError("");
    setVisitCustomer(customer);
    setVisitHistory([]);
    setSalesHistory([]);
    setVisitHistoryLoading(true);
    setSalesHistoryLoading(true);
    try {
      const [visitsResponse, salesResponse] = await Promise.all([
        fetch(`/api/customers/${customer.id}/visits`, {
          credentials: "include",
          cache: "no-store",
        }),
        fetch(`/api/customers/${customer.id}/sales-history`, {
          credentials: "include",
          cache: "no-store",
        }),
      ]);
      const [visitsPayload, salesPayload] = await Promise.all([
        visitsResponse.json().catch(() => []),
        salesResponse.json().catch(() => []),
      ]);
      if (!visitsResponse.ok || !salesResponse.ok) {
        throw new Error(
          visitsPayload?.message ??
            salesPayload?.message ??
            "Não foi possível carregar o histórico do cliente.",
        );
      }
      setVisitHistory(visitsPayload);
      setSalesHistory(salesPayload);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar o histórico do cliente.",
      );
    } finally {
      setVisitHistoryLoading(false);
      setSalesHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (historyAutoOpened.current || customers.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const creditCustomerId = params.get("credito");
    const historyCustomerId = params.get("cliente");
    const customerId = creditCustomerId || historyCustomerId;
    if (!customerId) return;
    const customer = customers.find((item) => item.id === customerId);
    if (!customer) return;
    historyAutoOpened.current = true;
    if (creditCustomerId) openCredit(customer);
    else void openVisits(customer);
  }, [customers, openCredit, openVisits]);

  const saveCredit = async () => {
    if (!creditCustomer) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/customers/${creditCustomer.id}/credit`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            status: creditStatus,
            creditLimit: Number(creditLimit || 0),
            paymentTerms: creditTerms,
            notes: creditNotes,
          }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          payload?.message ?? "Não foi possível salvar a análise de crédito.",
        );
      setCreditCustomer(null);
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar a análise de crédito.",
      );
    } finally {
      setSaving(false);
    }
  };

  const effectiveSales = salesHistory.filter(
    (sale) => sale.status !== "CANCELLED",
  );
  const salesTotal = effectiveSales.reduce(
    (total, sale) => total + Number(sale.totalAmount ?? 0),
    0,
  );
  const overdueSales = effectiveSales.filter(
    (sale) =>
      Boolean(sale.dueDate) &&
      Number(sale.openAmount ?? 0) > 0 &&
      !["PAID", "CANCELLED"].includes(String(sale.paymentStatus ?? "")) &&
      new Date(sale.dueDate!).getTime() < Date.now(),
  ).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="mt-0.5 text-sm text-stone-500">
            {customers.filter((c) => c.active).length} ativos
          </p>
        </div>
        <button
          data-bbos-write-action
          onClick={() => {
            setError("");
            setFormErrors({});
            setForm(emptyCustomer);
            setShowNew(true);
          }}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-stone-950 px-4 text-sm font-semibold text-white"
        >
          <Plus size={17} /> Novo cliente
        </button>
      </div>

      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="grid gap-3 border-b p-3 sm:p-4">
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,220px)_minmax(0,220px)]">
            <div className="flex min-w-0 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-stone-500">
              <Search size={16} aria-hidden />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente, CNPJ ou segmento"
                aria-label="Buscar clientes"
                className="min-h-11 w-full bg-transparent text-base outline-none sm:text-sm"
              />
            </div>
            <select
              aria-label="Filtrar por cidade"
              value={cityFilter}
              onChange={(e) => {
                setCityFilter(e.target.value);
                setDistrictFilter("");
              }}
              className="min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-base sm:text-sm"
            >
              <option value="">Todas as cidades</option>
              {cities.map((city) => (
                <option key={city.value} value={city.value}>
                  {city.label} ({city.count})
                </option>
              ))}
            </select>
            <select
              aria-label="Filtrar por bairro"
              value={districtFilter}
              disabled={!cityFilter || districts.length === 0}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-base disabled:bg-stone-50 disabled:text-stone-400 sm:text-sm"
            >
              <option value="">{cityFilter ? "Todos os bairros" : "Escolha a cidade"}</option>
              {districts.map((district) => (
                <option key={district.value} value={district.value}>
                  {district.label} ({district.count})
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Filtrar clientes">
            {QUICK_FILTERS.map(({ key, label, tone }) => {
              const count = customers.filter((c) => matchesQuickFilter(c, key)).length;
              if (key !== "ALL" && count === 0) return null;
              const active = quick === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setQuick(key)}
                  className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition ${
                    active ? "border-stone-950 bg-stone-950 text-white" : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                  }`}
                >
                  {label}
                  <span
                    className={`rounded-full px-1.5 text-xs font-semibold tabular-nums ${
                      active ? "bg-white/20" : tone === "warn" ? "bg-amber-100 text-amber-900" : tone === "info" ? "bg-violet-100 text-violet-800" : "bg-stone-100 text-stone-600"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {error && (
          <div className="m-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {loading ? (
          <div className="p-12 text-center text-sm text-stone-500">Carregando clientes…</div>
        ) : visible.length === 0 ? (
          <div className="p-14 text-center">
            <Building2 className="mx-auto text-stone-300" />
            <p className="mt-3 font-semibold">{customers.length ? "Nenhum cliente com esse filtro" : "Ainda não há clientes aqui"}</p>
            <p className="mt-1 text-sm text-stone-500">
              {customers.length ? "Mude a busca ou o filtro acima." : "Cadastre o primeiro em Novo cliente."}
            </p>
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.1fr)_auto] gap-x-4 border-b bg-stone-50 px-4 py-2 text-xs font-semibold text-stone-500 md:grid">
              <span>Cliente</span>
              <span>CPF/CNPJ</span>
              <span>Situação</span>
              <span>Crédito</span>
              <span className="w-[136px] text-right">Ações</span>
            </div>
            <div className="divide-y">
              {visible.map((customer) => (
                <CustomerRow
                  key={customer.id}
                  customer={customer}
                  onEdit={() => openEdit(customer)}
                  onRequest={() => openRequest(customer)}
                  onCredit={() => openCredit(customer)}
                  onVisits={() => void openVisits(customer)}
                  onTaxIdReview={() => setTaxIdCustomer(customer)}
                  canApproveCredit={canApproveCredit}
                />
              ))}
            </div>
            <p className="border-t px-4 py-2 text-xs text-stone-500">{visible.length} de {customers.length} clientes</p>
          </>
        )}
      </div>

      {showNew && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <aside className="h-full w-full max-w-2xl overflow-y-auto bg-white px-4 pb-32 pt-5 shadow-2xl sm:p-6 sm:pb-28">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[.18em] text-blue-700">
                  Cadastro guiado
                </p>
                <h2 className="mt-1 text-2xl font-semibold">Novo cliente</h2>
                <p className="mt-1 text-sm text-stone-500">
                  Cadastre uma vez, já pronto para pedido, NF-e e expedição.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void createCustomer()}
                  className="min-h-11 rounded-xl bg-stone-950 px-4 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
                >
                  {saving ? "Salvando…" : "Salvar"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNew(false);
                    setError("");
                    setFormErrors({});
                    setForm(emptyCustomer);
                  }}
                  aria-label="Fechar cadastro de cliente"
                  className="min-h-11 min-w-11 rounded-xl border p-2"
                >
                  <X className="mx-auto" size={18} />
                </button>
              </div>
            </div>
            <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
              <div className="flex gap-3">
                <Info className="mt-0.5 shrink-0" size={18} />
                <div>
                  <strong>Dados fiscais obrigatórios.</strong>
                  <p className="mt-1 text-xs leading-5 text-blue-800">
                    CPF/CNPJ, situação da inscrição estadual e endereço completo
                    serão validados agora para evitar bloqueios na emissão da
                    NF-e.
                  </p>
                </div>
              </div>
            </div>
            {error && (
              <div
                data-customer-form-alert
                role="alert"
                className="mt-4 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
              >
                <AlertTriangle className="mt-0.5 shrink-0" size={18} />
                <div>
                  <strong>Não foi possível salvar ainda.</strong>
                  <p className="mt-1">{error}</p>
                </div>
              </div>
            )}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field
                label="País fiscal *"
                fieldKey="countryCode"
                error={formErrors.countryCode || formErrors.countryName}
                wide
              >
                <select
                  value={form.countryCode}
                  onChange={(e) => {
                    const selected = countries.find(
                      (country) => country.code === e.target.value,
                    );
                    setForm({
                      ...form,
                      countryCode: e.target.value,
                      countryName: selected?.name ?? "",
                      taxId: e.target.value === "BR" ? form.taxId : "",
                      foreignTaxId:
                        e.target.value === "BR" ? "" : form.foreignTaxId,
                      stateRegistration: "",
                      stateRegistrationType: "",
                    });
                  }}
                >
                  {countries.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </Field>
              {form.countryCode === "BR" ? (
                <>
                <Field
                  label="CPF / CNPJ *"
                  fieldKey="taxId"
                  error={formErrors.taxId}
                  help={cnpjLookup.statusText || undefined}
                  wide
                >
                  <div className="flex gap-2">
                    <input
                    className="min-w-0 flex-1 rounded-xl border px-3 py-3 text-sm"
                    value={form.taxId}
                    onChange={(e) =>
                      setForm({ ...form, taxId: e.target.value })
                    }
                    autoCapitalize="characters"
                    spellCheck={false}
                    placeholder="CPF ou CNPJ (o CNPJ novo pode ter letras)"
                  />
                    <CnpjSearchButton onClick={cnpjLookup.search} busy={cnpjLookup.busy} />
                  </div>
                </Field>
                {cnpjLookup.record && (
                  <div className="sm:col-span-2">
                    <CnpjRegistryPanel record={cnpjLookup.record} />
                  </div>
                )}
                </>
              ) : (
                <Field
                  label="Identificação fiscal estrangeira *"
                  fieldKey="foreignTaxId"
                  error={formErrors.foreignTaxId}
                  help="Informe o número fiscal ou registro empresarial usado no país do cliente."
                >
                  <input
                    value={form.foreignTaxId}
                    onChange={(e) =>
                      setForm({ ...form, foreignTaxId: e.target.value })
                    }
                  />
                </Field>
              )}
              <Field
                label="Como você chama este cliente?"
                fieldKey="name"
                error={formErrors.name}
                help="Nome que a equipe reconhecerá rapidamente."
                wide
              >
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex.: Café Central"
                />
              </Field>
              <Field
                label="Razão social"
                fieldKey="legalName"
                error={formErrors.legalName}
                help="Obrigatória para CNPJ."
                wide
              >
                <input
                  value={form.legalName}
                  onChange={(e) =>
                    setForm({ ...form, legalName: e.target.value })
                  }
                />
              </Field>
              
              <Field label="Segmento">
                <select
                  value={form.segment}
                  onChange={(e) =>
                    setForm({ ...form, segment: e.target.value })
                  }
                >
                  <option value="">Escolha o perfil</option>
                  {segments.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="E-mail" fieldKey="email" error={formErrors.email}>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>
              <Field
                label="Telefone / WhatsApp"
                fieldKey="phone"
                error={formErrors.phone}
                help={
                  form.countryCode === "BR"
                    ? "Brasil (+55): informe DDD e celular."
                    : "Informe o número com código do país."
                }
              >
                <div className="flex items-center gap-2">
                  {form.countryCode === "BR" && (
                    <span className="whitespace-nowrap text-sm">
                      Brasil +55
                    </span>
                  )}
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    aria-label="Telefone / WhatsApp"
                    value={
                      form.countryCode === "BR"
                        ? formatBrazilMobile(form.phone)
                        : form.phone
                    }
                    onChange={(e) => {
                      const value = e.target.value;
                      if (form.countryCode !== "BR") {
                        setForm({ ...form, phone: value });
                        return;
                      }
                      if (
                        /[^\d\s()+.-]/.test(value) ||
                        brazilMobileDigits(value).length > 11
                      ) {
                        setError(MOBILE_ERROR);
                        return;
                      }
                      setForm({ ...form, phone: brazilMobileDigits(value) });
                    }}
                    placeholder={
                      form.countryCode === "BR"
                        ? "(43) 99999-9999"
                        : "+351912345678"
                    }
                  />
                </div>
              </Field>
              <Field
                label={form.countryCode === "BR" ? "CEP *" : "Código postal"}
                fieldKey="postalCode"
                error={formErrors.postalCode}
                help={
                  form.countryCode === "BR"
                    ? "O BBOS completa o endereço e você confirma os dados."
                    : "Informe o código postal no formato do país."
                }
              >
                <div className="flex gap-2">
                  <input
                    className="flex-1"
                    inputMode={form.countryCode === "BR" ? "numeric" : "text"}
                    autoComplete="postal-code"
                    placeholder={form.countryCode === "BR" ? "00000-000" : ""}
                    value={
                      form.countryCode === "BR"
                        ? formatBrazilianCep(form.postalCode)
                        : form.postalCode
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        postalCode:
                          form.countryCode === "BR"
                            ? brazilianCepDigits(e.target.value)
                            : e.target.value,
                      })
                    }
                  />
                  {form.countryCode === "BR" && (
                    <button
                      type="button"
                      onClick={() => void cepLookup.lookup()}
                      disabled={cepLookup.busy}
                      className="rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white"
                    >
                      {cepLookup.busy ? "Buscando…" : "Buscar"}
                    </button>
                  )}
                </div>
                {form.countryCode === "BR" && cepLookup.statusText && (
                  <p
                    className={`mt-1 text-xs ${
                      cepLookup.status === "found"
                        ? "text-emerald-700"
                        : cepLookup.status === "not-found" ||
                            cepLookup.status === "error"
                          ? "text-amber-700"
                          : "text-stone-500"
                    }`}
                  >
                    {cepLookup.statusText}
                  </p>
                )}
              </Field>
              <Field
                label={
                  form.countryCode === "BR" ? "UF *" : "Província / região"
                }
                fieldKey="state"
                error={formErrors.state}
              >
                {form.countryCode === "BR" ? (
                  <select
                    value={form.state}
                    onChange={(e) =>
                      setForm({ ...form, state: e.target.value, city: "" })
                    }
                  >
                    <option value="">Estado</option>
                    {states.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={form.state}
                    onChange={(e) =>
                      setForm({ ...form, state: e.target.value })
                    }
                  />
                )}
              </Field>
              <Field label="Cidade *" fieldKey="city" error={formErrors.city}>
                <input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder={
                    form.state
                      ? `Cidade em ${form.state}`
                      : "Escolha a UF primeiro"
                  }
                />
              </Field>
              <Field
                label="Bairro *"
                fieldKey="district"
                error={formErrors.district}
              >
                <input
                  value={form.district}
                  onChange={(e) =>
                    setForm({ ...form, district: e.target.value })
                  }
                />
              </Field>
              <Field
                label="Logradouro *"
                fieldKey="address"
                error={formErrors.address}
              >
                <input
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                />
              </Field>
              <Field
                label="Número *"
                fieldKey="addressNumber"
                error={formErrors.addressNumber}
                help="Use S/N quando o endereço não possuir número."
              >
                <input
                  value={form.addressNumber}
                  onChange={(e) =>
                    setForm({ ...form, addressNumber: e.target.value })
                  }
                />
              </Field>
              <Field label="Complemento">
                <input
                  value={form.addressComplement}
                  onChange={(e) =>
                    setForm({ ...form, addressComplement: e.target.value })
                  }
                />
              </Field>
              {form.countryCode === "BR" &&
                normalizeTaxId(form.taxId).length === 14 && (
                  <>
                    <Field
                      label="Situação da inscrição estadual *"
                      fieldKey="stateRegistrationType"
                      error={formErrors.stateRegistrationType}
                      wide
                    >
                      <select
                        value={form.stateRegistrationType}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            stateRegistrationType: e.target.value,
                            stateRegistration:
                              e.target.value === "NUMBER"
                                ? form.stateRegistration
                                : "",
                          })
                        }
                      >
                        <option value="">Selecione</option>
                        <option value="NUMBER">Contribuinte com IE</option>
                        <option value="EXEMPT">Isento</option>
                        <option value="NON_TAXPAYER">Não contribuinte</option>
                      </select>
                    </Field>
                    {form.stateRegistrationType === "NUMBER" && (
                      <Field
                        label="Inscrição estadual *"
                        fieldKey="stateRegistration"
                        error={formErrors.stateRegistration}
                        wide
                      >
                        <input
                          value={form.stateRegistration}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              stateRegistration: e.target.value,
                            })
                          }
                        />
                      </Field>
                    )}
                  </>
                )}
              <Field
                label="Condição de pagamento"
                help="Pode ser alterada depois conforme a análise de crédito."
                wide
              >
                <select
                  value={form.paymentTerms}
                  onChange={(e) =>
                    setForm({ ...form, paymentTerms: e.target.value })
                  }
                >
                  <option value="">Definir depois</option>
                  {paymentOptions.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="mt-6 rounded-2xl bg-violet-50 p-4 text-sm text-violet-900">
              <div className="flex gap-3">
                <Sparkles className="mt-0.5 shrink-0" size={18} />
                <p>
                  Depois de salvar, eu vou acompanhar crédito, títulos em aberto
                  e atrasos deste cliente e avisar a equipe no momento da venda.
                </p>
              </div>
            </div>
            <div className="fixed inset-x-2 bottom-[calc(4.75rem_+_env(safe-area-inset-bottom))] z-[90] rounded-2xl border border-stone-200 bg-white/95 p-2.5 shadow-[0_-12px_32px_rgba(28,25,23,0.18)] backdrop-blur sm:left-auto sm:right-2 sm:w-[calc(100%_-_1rem)] sm:max-w-2xl sm:px-4 lg:inset-x-0 lg:bottom-0 lg:rounded-none lg:border-x-0 lg:border-b-0 lg:px-6 lg:pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
              <div className="mx-auto flex max-w-2xl gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setShowNew(false);
                    setError("");
                    setFormErrors({});
                    setForm(emptyCustomer);
                  }}
                  className="min-h-12 flex-1 rounded-xl border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-700 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void createCustomer()}
                  className="min-h-12 flex-[1.6] rounded-xl bg-stone-950 px-4 text-sm font-semibold text-white shadow-lg disabled:opacity-50"
                >
                  {saving ? "Salvando…" : "Salvar cliente"}
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {editCustomer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <aside className="h-full w-full max-w-2xl overflow-y-auto bg-white px-4 pb-32 pt-5 shadow-2xl sm:p-6 sm:pb-28">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[.18em] text-blue-700">
                  Cadastro do cliente
                </p>
                <h2 className="mt-1 text-2xl font-semibold">Editar cliente</h2>
                <p className="mt-1 text-sm text-stone-500">
                  Atualize os dados comerciais e de entrega.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveCustomer()}
                  className="min-h-11 rounded-xl bg-stone-950 px-4 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
                >
                  {saving ? "Salvando…" : "Salvar"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditCustomer(null);
                    setForm(emptyCustomer);
                    setError("");
                    setFormErrors({});
                  }}
                  aria-label="Fechar edição do cliente"
                  className="min-h-11 min-w-11 rounded-xl border p-2"
                >
                  <X className="mx-auto" size={18} />
                </button>
              </div>
            </div>
            {error && (
              <div
                data-customer-form-alert
                role="alert"
                className="mt-4 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
              >
                <AlertTriangle className="mt-0.5 shrink-0" size={18} />
                <div>
                  <strong>Não foi possível salvar ainda.</strong>
                  <p className="mt-1">{error}</p>
                </div>
              </div>
            )}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field
                label="País fiscal *"
                fieldKey="countryCode"
                error={formErrors.countryCode || formErrors.countryName}
                wide
              >
                <select
                  value={form.countryCode}
                  onChange={(e) => {
                    const selected = countries.find(
                      (country) => country.code === e.target.value,
                    );
                    setForm({
                      ...form,
                      countryCode: e.target.value,
                      countryName: selected?.name ?? "",
                      taxId: e.target.value === "BR" ? form.taxId : "",
                      foreignTaxId:
                        e.target.value === "BR" ? "" : form.foreignTaxId,
                      stateRegistration: "",
                      stateRegistrationType: "",
                    });
                  }}
                >
                  {countries.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </Field>
              {form.countryCode === "BR" ? (
                <>
                <Field
                  label="CPF / CNPJ *"
                  fieldKey="taxId"
                  error={formErrors.taxId}
                  help={cnpjLookup.statusText || undefined}
                  wide
                >
                  <div className="flex gap-2">
                    <input
                    className="min-w-0 flex-1 rounded-xl border px-3 py-3 text-sm"
                    value={form.taxId}
                    onChange={(e) =>
                      setForm({ ...form, taxId: e.target.value })
                    }
                  />
                    <CnpjSearchButton onClick={cnpjLookup.search} busy={cnpjLookup.busy} />
                  </div>
                </Field>
                {cnpjLookup.record && (
                  <div className="sm:col-span-2">
                    <CnpjRegistryPanel record={cnpjLookup.record} />
                  </div>
                )}
                </>
              ) : (
                <Field
                  label="Identificação fiscal estrangeira *"
                  fieldKey="foreignTaxId"
                  error={formErrors.foreignTaxId}
                  help="Número fiscal ou registro empresarial do país do cliente."
                >
                  <input
                    value={form.foreignTaxId}
                    onChange={(e) =>
                      setForm({ ...form, foreignTaxId: e.target.value })
                    }
                  />
                </Field>
              )}
              <Field
                label="Nome do cliente *"
                fieldKey="name"
                error={formErrors.name}
                wide
              >
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field
                label="Razão social"
                fieldKey="legalName"
                error={formErrors.legalName}
              >
                <input
                  value={form.legalName}
                  onChange={(e) =>
                    setForm({ ...form, legalName: e.target.value })
                  }
                />
              </Field>
              <Field label="Nome fantasia">
                <input
                  value={form.tradeName}
                  onChange={(e) =>
                    setForm({ ...form, tradeName: e.target.value })
                  }
                />
              </Field>
              
              <Field label="Segmento">
                <select
                  value={form.segment}
                  onChange={(e) =>
                    setForm({ ...form, segment: e.target.value })
                  }
                >
                  <option value="">Escolha o perfil</option>
                  {segments.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="E-mail" fieldKey="email" error={formErrors.email}>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>
              <Field
                label="Telefone / WhatsApp"
                fieldKey="phone"
                error={formErrors.phone}
                help={
                  form.countryCode === "BR"
                    ? "Brasil (+55): informe DDD e celular."
                    : "Informe o número com código do país."
                }
              >
                <div className="flex items-center gap-2">
                  {form.countryCode === "BR" && (
                    <span className="whitespace-nowrap text-sm">
                      Brasil +55
                    </span>
                  )}
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    aria-label="Telefone / WhatsApp"
                    value={
                      form.countryCode === "BR"
                        ? formatBrazilMobile(form.phone)
                        : form.phone
                    }
                    onChange={(e) => {
                      const value = e.target.value;
                      if (form.countryCode !== "BR") {
                        setForm({ ...form, phone: value });
                        return;
                      }
                      if (
                        /[^\d\s()+.-]/.test(value) ||
                        brazilMobileDigits(value).length > 11
                      ) {
                        setError(MOBILE_ERROR);
                        return;
                      }
                      setForm({ ...form, phone: brazilMobileDigits(value) });
                    }}
                    placeholder={
                      form.countryCode === "BR"
                        ? "(43) 99999-9999"
                        : "+351912345678"
                    }
                  />
                </div>
              </Field>
              <Field
                label={form.countryCode === "BR" ? "CEP *" : "Código postal"}
                fieldKey="postalCode"
                error={formErrors.postalCode}
              >
                <div className="flex gap-2">
                  <input
                    className="flex-1"
                    inputMode={form.countryCode === "BR" ? "numeric" : "text"}
                    autoComplete="postal-code"
                    placeholder={form.countryCode === "BR" ? "00000-000" : ""}
                    value={
                      form.countryCode === "BR"
                        ? formatBrazilianCep(form.postalCode)
                        : form.postalCode
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        postalCode:
                          form.countryCode === "BR"
                            ? brazilianCepDigits(e.target.value)
                            : e.target.value,
                      })
                    }
                  />
                  {form.countryCode === "BR" && (
                    <button
                      type="button"
                      onClick={() => void cepLookup.lookup()}
                      disabled={cepLookup.busy}
                      className="rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white"
                    >
                      {cepLookup.busy ? "Buscando…" : "Buscar"}
                    </button>
                  )}
                </div>
                {form.countryCode === "BR" && cepLookup.statusText && (
                  <p
                    className={`mt-1 text-xs ${
                      cepLookup.status === "found"
                        ? "text-emerald-700"
                        : cepLookup.status === "not-found" ||
                            cepLookup.status === "error"
                          ? "text-amber-700"
                          : "text-stone-500"
                    }`}
                  >
                    {cepLookup.statusText}
                  </p>
                )}
              </Field>
              <Field
                label={
                  form.countryCode === "BR" ? "UF *" : "Província / região"
                }
                fieldKey="state"
                error={formErrors.state}
              >
                {form.countryCode === "BR" ? (
                  <select
                    value={form.state}
                    onChange={(e) =>
                      setForm({ ...form, state: e.target.value, city: "" })
                    }
                  >
                    <option value="">Estado</option>
                    {states.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={form.state}
                    onChange={(e) =>
                      setForm({ ...form, state: e.target.value })
                    }
                  />
                )}
              </Field>
              <Field label="Cidade *" fieldKey="city" error={formErrors.city}>
                <input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </Field>
              <Field
                label="Bairro *"
                fieldKey="district"
                error={formErrors.district}
              >
                <input
                  value={form.district}
                  onChange={(e) =>
                    setForm({ ...form, district: e.target.value })
                  }
                />
              </Field>
              <Field
                label="Logradouro *"
                fieldKey="address"
                error={formErrors.address}
              >
                <input
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                />
              </Field>
              <Field
                label="Número *"
                fieldKey="addressNumber"
                error={formErrors.addressNumber}
                help="Use S/N quando necessário."
              >
                <input
                  value={form.addressNumber}
                  onChange={(e) =>
                    setForm({ ...form, addressNumber: e.target.value })
                  }
                />
              </Field>
              <Field label="Complemento">
                <input
                  value={form.addressComplement}
                  onChange={(e) =>
                    setForm({ ...form, addressComplement: e.target.value })
                  }
                />
              </Field>
              {form.countryCode === "BR" &&
                normalizeTaxId(form.taxId).length === 14 && (
                  <>
                    <Field
                      label="Situação da inscrição estadual *"
                      fieldKey="stateRegistrationType"
                      error={formErrors.stateRegistrationType}
                      wide
                    >
                      <select
                        value={form.stateRegistrationType}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            stateRegistrationType: e.target.value,
                            stateRegistration:
                              e.target.value === "NUMBER"
                                ? form.stateRegistration
                                : "",
                          })
                        }
                      >
                        <option value="">Selecione</option>
                        <option value="NUMBER">Contribuinte com IE</option>
                        <option value="EXEMPT">Isento</option>
                        <option value="NON_TAXPAYER">Não contribuinte</option>
                      </select>
                    </Field>
                    {form.stateRegistrationType === "NUMBER" && (
                      <Field
                        label="Inscrição estadual *"
                        fieldKey="stateRegistration"
                        error={formErrors.stateRegistration}
                        wide
                      >
                        <input
                          value={form.stateRegistration}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              stateRegistration: e.target.value,
                            })
                          }
                        />
                      </Field>
                    )}
                  </>
                )}
              <Field label="Condição de pagamento" wide>
                <select
                  value={form.paymentTerms}
                  onChange={(e) =>
                    setForm({ ...form, paymentTerms: e.target.value })
                  }
                >
                  <option value="">Definir depois</option>
                  {paymentOptions.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </Field>
              <CustomerPaymentWeekday customerId={editCustomer.id} />
              <Field label="Status do cadastro" wide>
                <select
                  value={editCustomer.active ? "ACTIVE" : "INACTIVE"}
                  onChange={(e) =>
                    setEditCustomer({
                      ...editCustomer,
                      active: e.target.value === "ACTIVE",
                    })
                  }
                >
                  <option value="ACTIVE">Ativo</option>
                  <option value="INACTIVE">Inativo</option>
                </select>
              </Field>
            </div>
            <div className="fixed inset-x-2 bottom-[calc(4.75rem_+_env(safe-area-inset-bottom))] z-[90] rounded-2xl border border-stone-200 bg-white/95 p-2.5 shadow-[0_-12px_32px_rgba(28,25,23,0.18)] backdrop-blur sm:left-auto sm:right-2 sm:w-[calc(100%_-_1rem)] sm:max-w-2xl sm:px-4 lg:inset-x-0 lg:bottom-0 lg:rounded-none lg:border-x-0 lg:border-b-0 lg:px-6 lg:pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
              <div className="mx-auto flex max-w-2xl gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setEditCustomer(null);
                    setForm(emptyCustomer);
                    setError("");
                    setFormErrors({});
                  }}
                  className="min-h-12 flex-1 rounded-xl border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-700 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveCustomer()}
                  className="min-h-12 flex-[1.6] rounded-xl bg-stone-950 px-4 text-sm font-semibold text-white shadow-lg disabled:opacity-50"
                >
                  {saving ? "Salvando…" : "Salvar alterações"}
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {requestCustomer && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[.18em] text-emerald-700">
                  Etapa 1 · Solicitação
                </p>
                <h2 className="mt-1 text-2xl font-semibold">
                  Solicitar crédito
                </h2>
                <p className="mt-1 text-sm text-stone-500">
                  {requestCustomer.tradeName || requestCustomer.name}
                </p>
              </div>
              <button
                onClick={() => setRequestCustomer(null)}
                className="rounded-xl border p-2"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
              <div className="flex gap-3">
                <History size={18} className="mt-0.5 text-emerald-700" />
                <div>
                  <p className="text-sm font-semibold text-emerald-950">
                    Esta solicitação entra na trilha de auditoria
                  </p>
                  <p className="mt-1 text-xs leading-5 text-emerald-800">
                    O BBOS registra quem solicitou, quando, valor, condição e
                    justificativa. A decisão administrativa será registrada
                    separadamente.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Limite solicitado (R$)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={requestedLimit}
                  onChange={(e) => setRequestedLimit(e.target.value)}
                  placeholder="Ex.: 50000"
                />
              </Field>
              <Field label="Condição solicitada">
                <select
                  value={requestedTerms}
                  onChange={(e) => setRequestedTerms(e.target.value)}
                >
                  {paymentOptions
                    .filter((p) => p !== "À vista")
                    .map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                </select>
              </Field>
              <Field
                label="Volume mensal estimado (R$)"
                help="Opcional. Ajuda a administração a dimensionar o limite."
                wide
              >
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={monthlyVolume}
                  onChange={(e) => setMonthlyVolume(e.target.value)}
                  placeholder="Ex.: 20000"
                />
              </Field>
              <Field label="Justificativa da solicitação" wide>
                <textarea
                  rows={4}
                  value={requestRationale}
                  onChange={(e) => setRequestRationale(e.target.value)}
                  placeholder="Ex.: início de fornecimento recorrente, volume esperado, histórico comercial, referências..."
                />
              </Field>
            </div>
            {error && (
              <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}
            <button
              disabled={saving}
              onClick={() => void submitCreditRequest()}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-stone-950 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Send size={16} />
              {saving ? "Enviando…" : "Enviar para análise"}
            </button>
          </div>
        </div>
      )}

      {creditCustomer && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[.18em] text-violet-700">
                  {canApproveCredit
                    ? "Etapa 2 · Decisão administrativa"
                    : "Crédito · Consulta"}
                </p>
                <h2 className="mt-1 text-2xl font-semibold">
                  {canApproveCredit
                    ? "Análise de crédito"
                    : "Histórico de crédito"}
                </h2>
                <p className="mt-1 text-sm text-stone-500">
                  {creditCustomer.tradeName || creditCustomer.name}
                </p>
              </div>
              <button
                onClick={() => setCreditCustomer(null)}
                className="rounded-xl border p-2"
              >
                <X size={18} />
              </button>
            </div>
            <HealthPanel health={creditCustomer.financialHealth} compact />
            <CreditRequestContext
              history={creditHistory}
              loading={historyLoading}
            />
            {canApproveCredit ? (
              <>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Field label="Situação">
                    <select
                      value={creditStatus}
                      onChange={(e) =>
                        setCreditStatus(
                          e.target.value as Customer["creditStatus"],
                        )
                      }
                    >
                      <option value="UNDER_REVIEW">Em análise</option>
                      <option value="APPROVED">Aprovado</option>
                      <option value="REJECTED">Reprovado</option>
                      <option value="NOT_ANALYZED">Não analisado</option>
                    </select>
                  </Field>
                  <Field label="Limite aprovado (R$)">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={creditLimit}
                      onChange={(e) => setCreditLimit(e.target.value)}
                    />
                  </Field>
                  <Field label="Condição aprovada" wide>
                    <select
                      value={creditTerms}
                      onChange={(e) => setCreditTerms(e.target.value)}
                    >
                      {paymentOptions.map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Observação da decisão" wide>
                    <textarea
                      rows={4}
                      value={creditNotes}
                      onChange={(e) => setCreditNotes(e.target.value)}
                      placeholder="Documentos analisados, justificativa, condição, ressalvas..."
                    />
                  </Field>
                </div>
                <p className="mt-4 text-xs leading-5 text-stone-500">
                  A decisão não apaga a solicitação anterior. Cada nova revisão
                  permanece registrada na trilha de crédito.
                </p>
                {error && (
                  <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}
                <button
                  disabled={saving}
                  onClick={() => void saveCredit()}
                  className="mt-5 w-full rounded-xl bg-stone-950 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? "Salvando…" : "Salvar decisão auditável"}
                </button>
              </>
            ) : (
              <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
                <p className="font-semibold">Decisão protegida</p>
                <p className="mt-1 text-xs leading-5 text-blue-800">
                  O vendedor pode solicitar crédito e acompanhar o resultado.
                  Somente José ou Suzi podem aprovar, reprovar ou alterar o
                  limite.
                </p>
              </div>
            )}
            <CreditTimeline history={creditHistory} />
          </div>
        </div>
      )}

      {taxIdCustomer && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-tax-id-dialog-title"
            className="flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-h-[88vh] sm:rounded-3xl"
          >
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-stone-200 px-5 py-4 sm:px-7 sm:py-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[.18em] text-emerald-700">
                  Conferência cadastral
                </p>
                <h2
                  id="customer-tax-id-dialog-title"
                  className="mt-1 text-xl font-semibold sm:text-2xl"
                >
                  Confirmar CNPJ
                </h2>
                <p className="mt-1 text-sm text-stone-500">
                  {taxIdCustomer.tradeName || taxIdCustomer.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTaxIdCustomer(null)}
                className="rounded-xl border border-stone-200 p-2 text-stone-600 transition hover:bg-stone-50"
                aria-label="Fechar conferência de CNPJ"
              >
                <X size={18} />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-7 sm:py-6">
              <CustomerTaxIdSuggestionWorkflow
                customer={taxIdCustomer}
                onConfirmed={async (taxId) => {
                  setTaxIdCustomer((current) =>
                    current
                      ? {
                          ...current,
                          taxId,
                          taxIdVerificationStatus: "CONFIRMED_INTERNAL",
                        }
                      : current,
                  );
                  await load();
                }}
                onManualEntry={() => {
                  const customer = taxIdCustomer;
                  setTaxIdCustomer(null);
                  openEdit(customer);
                }}
              />
            </div>
          </section>
        </div>
      )}

      {visitCustomer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <aside className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[.18em] text-emerald-700">
                  Relacionamento comercial
                </p>
                <h2 className="mt-1 text-2xl font-semibold">
                  Histórico comercial
                </h2>
                <p className="mt-1 text-sm text-stone-500">
                  {visitCustomer.tradeName || visitCustomer.name}
                </p>
              </div>
              <button
                onClick={() => setVisitCustomer(null)}
                className="rounded-xl border p-2"
              >
                <X size={18} />
              </button>
            </div>

            <section className="mt-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Vendas e pagamentos</h3>
                  <p className="mt-1 text-xs text-stone-500">
                    Produtos comprados, valores, vencimentos e situação de cada
                    pedido.
                  </p>
                </div>
                <Link
                  href="/pedidos"
                  className="rounded-xl border px-3 py-2 text-xs font-semibold"
                >
                  Todos os pedidos
                </Link>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-stone-100 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-stone-500">
                    Pedidos
                  </p>
                  <p className="mt-1 font-semibold">{effectiveSales.length}</p>
                </div>
                <div className="rounded-xl bg-stone-100 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-stone-500">
                    Vendas
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    {money(salesTotal)}
                  </p>
                </div>
                <div
                  className={`rounded-xl p-3 ${overdueSales ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}
                >
                  <p className="text-[10px] uppercase tracking-wider opacity-70">
                    Em atraso
                  </p>
                  <p className="mt-1 font-semibold">{overdueSales}</p>
                </div>
              </div>

              {salesHistoryLoading ? (
                <p className="mt-3 rounded-2xl bg-stone-50 p-5 text-sm text-stone-500">
                  Carregando vendas…
                </p>
              ) : salesHistory.length === 0 ? (
                <p className="mt-3 rounded-2xl border border-dashed p-5 text-center text-sm text-stone-500">
                  Este cliente ainda não possui vendas registradas.
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {salesHistory.map((sale) => {
                    const overdue =
                      Boolean(sale.dueDate) &&
                      Number(sale.openAmount ?? 0) > 0 &&
                      !["PAID", "CANCELLED"].includes(
                        String(sale.paymentStatus ?? ""),
                      ) &&
                      new Date(sale.dueDate!).getTime() < Date.now();
                    return (
                      <article
                        key={sale.id}
                        className={`rounded-2xl border p-4 ${overdue ? "border-red-200 bg-red-50/60" : "border-stone-200"}`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold">
                              {sale.orderNumber}
                            </p>
                            <p className="mt-1 text-xs text-stone-500">
                              {dateOnly(sale.orderedAt)} ·{" "}
                              {saleStatusLabel[sale.status] || sale.status}
                            </p>
                          </div>
                          <p className="font-semibold">
                            {money(Number(sale.totalAmount ?? 0))}
                          </p>
                        </div>
                        {sale.items.length > 0 && (
                          <div className="mt-3 space-y-1 text-xs text-stone-600">
                            {sale.items.map((item) => (
                              <p key={`${sale.id}-${item.sku}`}>
                                {item.quantity} × {item.productName}
                                <span className="text-stone-400">
                                  {" "}
                                  · {item.sku}
                                </span>
                              </p>
                            ))}
                          </div>
                        )}
                        {(sale.paymentStatus || sale.dueDate) && (
                          <div
                            className={`mt-3 rounded-xl p-3 text-xs ${overdue ? "bg-red-100 text-red-900" : "bg-stone-100 text-stone-700"}`}
                          >
                            <strong>
                              {overdue
                                ? "Pagamento vencido"
                                : paymentStatusLabel[
                                    String(sale.paymentStatus ?? "")
                                  ] || "Pagamento"}
                            </strong>
                            {sale.dueDate
                              ? ` · vencimento ${dateOnly(sale.dueDate)}`
                              : ""}
                            {Number(sale.openAmount ?? 0) > 0
                              ? ` · saldo ${money(Number(sale.openAmount))}`
                              : ""}
                            {sale.paymentDate
                              ? ` · pago em ${dateOnly(sale.paymentDate)}`
                              : ""}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="mt-7 border-t border-stone-200 pt-6">
              <h3 className="font-semibold">Visitas e atendimentos</h3>
              <p className="mt-1 text-xs text-stone-500">
                Relatos registrados pelo vendedor e próximas ações combinadas.
              </p>

              {visitHistoryLoading ? (
                <p className="mt-6 rounded-2xl bg-stone-50 p-5 text-sm text-stone-500">
                  Carregando visitas…
                </p>
              ) : visitHistory.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed p-8 text-center">
                  <History className="mx-auto text-stone-300" />
                  <p className="mt-3 font-semibold">
                    Nenhuma visita registrada
                  </p>
                  <p className="mt-1 text-sm text-stone-500">
                    O histórico aparecerá aqui quando o vendedor registrar a
                    primeira visita no aplicativo.
                  </p>
                </div>
              ) : (
                <div className="mt-6 space-y-3">
                  {visitHistory.map((visit) => (
                    <article
                      key={visit.id}
                      className="rounded-2xl border border-stone-200 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">
                            {visitPurposeLabel[visit.purpose] || visit.purpose}{" "}
                            ·{" "}
                            {visitOutcomeLabel[visit.outcome] || visit.outcome}
                          </p>
                          <p className="mt-1 text-xs text-stone-500">
                            {dateTime(visit.visitAt)} · {visit.recordedByName}
                            {visit.partnerName &&
                            visit.partnerName !== visit.recordedByName
                              ? ` (${visit.partnerName})`
                              : ""}
                          </p>
                        </div>
                        {visit.contactName && (
                          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-semibold text-stone-600">
                            Contato: {visit.contactName}
                          </span>
                        )}
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-700">
                        {visit.facts}
                      </p>
                      {visit.nextAction && (
                        <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-900">
                          <strong>Próxima ação:</strong> {visit.nextAction}
                          {visit.nextActionAt
                            ? ` · ${dateTime(visit.nextActionAt)}`
                            : ""}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}

function CustomerRow({
  customer,
  onEdit,
  onRequest,
  onCredit,
  onVisits,
  onTaxIdReview,
  canApproveCredit,
}: {
  customer: Customer;
  onEdit: () => void;
  onRequest: () => void;
  onCredit: () => void;
  onVisits: () => void;
  onTaxIdReview: () => void;
  canApproveCredit: boolean;
}) {
  const h = customer.financialHealth;
  const chip = healthChip(h?.health);
  const needsTaxId = taxIdNeedsCheck(customer);
  const reviewing = customer.creditReviewPending || customer.creditStatus === "UNDER_REVIEW";
  const actions: Array<{ label: string; icon: typeof Pencil; onClick: () => void; write?: boolean }> = [
    { label: "Histórico comercial", icon: History, onClick: onVisits },
    { label: "Editar cadastro", icon: Pencil, onClick: onEdit, write: true },
    ...(needsTaxId ? [{ label: "Conferir CNPJ", icon: Search, onClick: onTaxIdReview, write: true }] : []),
    ...(!reviewing ? [{ label: "Solicitar crédito", icon: Send, onClick: onRequest, write: true }] : []),
    { label: reviewing && canApproveCredit ? "Analisar crédito" : "Ver crédito", icon: BadgeDollarSign, onClick: onCredit, write: true },
  ];
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-4 py-3 transition hover:bg-stone-50/70 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.1fr)_auto] md:items-center">
      <button type="button" onClick={onVisits} className="min-w-0 text-left" title="Abrir histórico comercial">
        <p className="truncate font-semibold">{customer.tradeName || customer.name}</p>
        <p className="mt-0.5 flex min-w-0 items-center gap-1 truncate text-sm text-stone-500">
          {customer.city && <MapPin size={13} className="shrink-0" aria-hidden />}
          <span className="truncate">
            {[customer.city && `${customer.city}${customer.state ? `/${customer.state}` : ""}`, customer.district, customer.segment].filter(Boolean).join(" · ") || "Sem cidade"}
          </span>
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 md:hidden">
          <span title={h?.guidance} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${chip.className}`}>{chip.label}</span>
          <span className="text-xs text-stone-500">
            Crédito: {creditLabel[customer.creditStatus]}
            {customer.creditStatus === "APPROVED" ? ` · ${money(h.availableCredit)}` : ""}
          </span>
          {(needsTaxId || !customer.fiscalReadiness?.ready) && (
            <span className="text-xs text-amber-800">{needsTaxId ? "CNPJ a conferir" : "Fiscal pendente"}</span>
          )}
        </p>
      </button>
      <div className="hidden min-w-0 text-sm md:block">
        <p className="truncate tabular-nums text-stone-700">{customer.taxId || "Sem CPF/CNPJ"}</p>
        {(needsTaxId || !customer.fiscalReadiness?.ready) && (
          <p className="truncate text-xs text-amber-800" title={customer.fiscalReadiness?.issues.join(", ")}>
            {needsTaxId ? "CNPJ a conferir" : "Cadastro fiscal pendente"}
          </p>
        )}
      </div>
      <div className="hidden min-w-0 md:block">
        <span title={h?.guidance} className={`inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-xs font-semibold ${chip.className}`}>
          <span className="truncate">{chip.label}</span>
        </span>
      </div>
      <div className="hidden min-w-0 text-sm md:block">
        <p className="truncate font-medium">{creditLabel[customer.creditStatus]}</p>
        {customer.creditStatus === "APPROVED" ? (
          <p className="truncate text-xs text-stone-500">Disponível {money(h.availableCredit)}</p>
        ) : customer.creditReviewPending ? (
          <p className="truncate text-xs font-medium text-violet-700">Revisão solicitada</p>
        ) : null}
      </div>
      <div className="flex items-start gap-2 self-start md:items-center md:self-auto md:justify-end">
        <Link
          data-bbos-write-action
          href={`/atendimento?cliente=${encodeURIComponent(customer.id)}`}
          aria-label={`Registrar visita a ${customer.tradeName || customer.name}`}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold hover:bg-stone-50"
        >
          <Plus size={15} /> <span className="hidden sm:inline">Visita</span>
        </Link>
        <RowMenu label={`Mais ações para ${customer.tradeName || customer.name}`} actions={actions} />
      </div>
    </div>
  );
}

function RowMenu({ label, actions }: { label: string; actions: Array<{ label: string; icon: typeof Pencil; onClick: () => void; write?: boolean }> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="grid size-10 place-items-center rounded-xl border border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
      >
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-lg">
          {actions.map(({ label: text, icon: Icon, onClick, write }) => (
            <button
              key={text}
              type="button"
              role="menuitem"
              {...(write ? { "data-bbos-write-action": true } : {})}
              onClick={() => {
                setOpen(false);
                onClick();
              }}
              className="flex min-h-10 w-full items-center gap-2.5 px-3 text-left text-sm hover:bg-stone-50"
            >
              <Icon size={16} className="shrink-0 text-stone-500" /> {text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CreditRequestContext({
  history,
  loading,
}: {
  history: CreditEvent[];
  loading: boolean;
}) {
  if (loading)
    return (
      <div className="mt-5 rounded-2xl border bg-stone-50 p-4 text-xs text-stone-500">
        Carregando solicitação…
      </div>
    );
  const request = history.find((item) => item.eventType === "REQUEST");
  if (!request)
    return (
      <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4">
        <p className="text-xs font-bold text-amber-900">
          Solicitação formal ainda não registrada
        </p>
        <p className="mt-1 text-xs leading-5 text-amber-800">
          Este cliente entrou em análise pelo fluxo anterior. Você pode decidir
          agora; as próximas revisões já seguirão o rito auditável.
        </p>
      </div>
    );
  return (
    <div className="mt-5 rounded-2xl border border-violet-100 bg-violet-50/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.14em] text-violet-700">
            Solicitação registrada
          </p>
          <p className="mt-1 text-sm font-semibold">
            {money(Number(request.requestedLimit || 0))} ·{" "}
            {request.requestedTerms || "Condição não informada"}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] text-violet-600">
          <Clock3 size={12} />
          {dateTime(request.createdAt)}
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-stone-600">
        {request.rationale}
      </p>
      <p className="mt-2 text-[10px] text-stone-400">
        Solicitado por {request.actorName}
        {request.monthlyVolume
          ? ` · volume mensal estimado ${money(Number(request.monthlyVolume))}`
          : ""}
      </p>
    </div>
  );
}

function CreditTimeline({ history }: { history: CreditEvent[] }) {
  if (!history.length) return null;
  return (
    <div className="mt-6 border-t pt-5">
      <div className="flex items-center gap-2">
        <History size={15} className="text-stone-500" />
        <h3 className="text-sm font-semibold">Trilha de crédito</h3>
      </div>
      <div className="mt-3 space-y-2">
        {history.slice(0, 6).map((event) => (
          <div
            key={event.id}
            className="flex gap-3 rounded-xl bg-stone-50 px-3 py-3"
          >
            <span
              className={`mt-1 size-2 shrink-0 rounded-full ${event.eventType === "REQUEST" ? "bg-emerald-500" : "bg-violet-500"}`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold">
                  {event.eventType === "REQUEST"
                    ? "Crédito solicitado"
                    : `Decisão: ${event.decisionStatus ? creditLabel[event.decisionStatus] : "registrada"}`}
                </p>
                <span className="text-[10px] text-stone-400">
                  {dateTime(event.createdAt)}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-stone-500">
                {event.eventType === "REQUEST"
                  ? `${money(Number(event.requestedLimit || 0))} · ${event.requestedTerms || "—"}`
                  : `${money(Number(event.decidedLimit || 0))} · ${event.decisionTerms || "—"}`}{" "}
                · {event.actorName}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HealthPanel({
  health,
  compact = false,
}: {
  health: Health;
  compact?: boolean;
}) {
  return (
    <div
      className={`mt-5 grid gap-2 ${compact ? "grid-cols-2" : "md:grid-cols-4"}`}
    >
      <Mini label="Em aberto" value={money(health.openReceivables)} />
      <Mini
        label="Vencido"
        value={money(health.overdueAmount)}
        alert={health.overdueAmount > 0}
      />
      <Mini
        label="Títulos vencidos"
        value={String(health.overdueCount)}
        alert={health.overdueCount > 0}
      />
      <Mini
        label="Maior atraso"
        value={`${health.maxDaysOverdue} dias`}
        alert={health.maxDaysOverdue > 0}
      />
    </div>
  );
}
function Mini({
  label,
  value,
  alert,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${alert ? "border-amber-100 bg-amber-50" : "bg-stone-50"}`}
    >
      <p className="text-[10px] uppercase tracking-wider text-stone-400">
        {label}
      </p>
      <p className={`mt-1 text-sm font-bold ${alert ? "text-amber-900" : ""}`}>
        {value}
      </p>
    </div>
  );
}
function Field({
  label,
  children,
  wide = false,
  help,
  fieldKey,
  error,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
  help?: string;
  fieldKey?: CustomerFormField;
  error?: string;
}) {
  return (
    <label
      data-customer-field={fieldKey}
      data-invalid={Boolean(error)}
      className={wide ? "sm:col-span-2" : ""}
    >
      <span
        className={`mb-1.5 block text-sm font-semibold ${error ? "text-red-700" : ""}`}
      >
        {label}
      </span>
      <div
        className={`[&>input]:w-full [&>input]:rounded-xl [&>input]:border [&>input]:px-3 [&>input]:py-3 [&>input]:text-sm [&>select]:w-full [&>select]:rounded-xl [&>select]:border [&>select]:px-3 [&>select]:py-3 [&>select]:text-sm [&>textarea]:w-full [&>textarea]:rounded-xl [&>textarea]:border [&>textarea]:px-3 [&>textarea]:py-3 [&>textarea]:text-sm ${
          error
            ? "rounded-xl [&_input]:border-red-400 [&_input]:bg-red-50/50 [&_input]:outline-red-400 [&_select]:border-red-400 [&_select]:bg-red-50/50 [&_select]:outline-red-400 [&_textarea]:border-red-400 [&_textarea]:bg-red-50/50"
            : ""
        }`}
      >
        {children}
      </div>
      {error && (
        <span className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-red-700">
          <AlertTriangle className="mt-0.5 shrink-0" size={13} /> {error}
        </span>
      )}
      {help && (
        <span
          className={`mt-1 block text-[11px] ${error ? "text-stone-500" : "text-stone-400"}`}
        >
          {help}
        </span>
      )}
    </label>
  );
}
