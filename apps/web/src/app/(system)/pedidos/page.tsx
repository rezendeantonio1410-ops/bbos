"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  BadgeDollarSign,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  CreditCard,
  Eye,
  PackageCheck,
  Plus,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { Badge, Card } from "@bbos/ui";
import { getApiBaseUrl } from "@/lib/api-url";

const salesOrdersApi = () => `${getApiBaseUrl()}/sales-orders`;
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatPostalCode = (value: string) => value.replace(/\D/g, "").replace(/^(\d{5})(\d{3})$/, "$1-$2");
const paymentOptions = ["7 dias", "14 dias", "21 dias", "28 dias", "30 dias", "45 dias", "60 dias"];
const freightLabels: Record<string, string> = {
  BISPO: "Frete por conta da Bispo",
  CUSTOMER: "Frete por conta do cliente",
  PICKUP: "Retirada na fábrica",
};

type StockOption = {
  productVariantId: string;
  warehouseId: string;
  warehouse: string;
  line: string;
  lineCode: string;
  product: string;
  sku: string;
  presentationGrams: number;
  availableStock: number;
};

type Customer = {
  id: string;
  name: string;
  paymentTerms?: string | null;
  creditStatus?: "NOT_ANALYZED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
  creditLimit?: string | number;
};

type CustomerHealth = {
  creditStatus?: string;
  creditReviewPending?: boolean;
  creditLimit?: string | number;
  financialHealth: {
    openReceivables: number;
    availableCredit: number;
  };
};

type Quote = {
  officialUnitPrice: number;
  salesChannelName: string;
  salesChannelType: string;
  totalAmount: number;
  discountPolicy: {
    maxRequestPercent: number;
    maxApprovalPercent: number;
    minimumPrice: number | null;
    minimumMarginPercent: number | null;
    minimumRoiPercent: number | null;
  };
};

type ShippingQuoteOption = {
  id: string;
  serviceName: string;
  carrierName: string;
  priceCents: number;
  deliveryDays: number;
  carrierLogoUrl?: string | null;
  postingType?: string;
  expiresAt: string;
};

type ShippingSummary = {
  originPostalCode: string;
  destinationPostalCode: string;
  weightGrams: number;
  widthCm: number;
  heightCm: number;
  lengthCm: number;
  packageCount?: number;
  weightPerPackageGrams?: number;
};

type DraftOrderLine = {
  id: string;
  variantId: string;
  quantity: number;
};

type PackageBox = {
  id: string;
  widthCm: string;
  heightCm: string;
  lengthCm: string;
  weightKg: string;
};

const randomId = () => typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

const newDraftLine = (): DraftOrderLine => ({
  id: randomId(),
  variantId: "",
  quantity: 1,
});

const newPackageBox = (source?: Partial<PackageBox>): PackageBox => ({
  id: randomId(),
  widthCm: source?.widthCm ?? "35",
  heightCm: source?.heightCm ?? "22",
  lengthCm: source?.lengthCm ?? "11",
  weightKg: source?.weightKg ?? "",
});

type OrderItem = {
  id: string;
  productVariantId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice?: string;
  totalAmount: string;
};

type Order = {
  id: string;
  code: string;
  orderNumber?: string;
  status: string;
  totalAmount: string;
  orderedAt: string;
  expectedDeliveryDate?: string | null;
  paymentType?: string | null;
  paymentTermsSnapshot?: string | null;
  freightResponsibility?: string | null;
  carrierName?: string | null;
  customerReference?: string | null;
  incoterm?: string | null;
  incotermLocation?: string | null;
  notes?: string | null;
  customer: Customer;
  items: OrderItem[];
  reservations: Array<{ id: string; status: string; quantity: number }>;
};

type DiscountRequest = {
  id: string;
  salesOrderItemId: string;
  officialUnitPrice: string | number;
  requestedUnitPrice: string | number;
  discountPercent: string | number;
  rationale: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedByName: string;
};

const statusLabel: Record<string, string> = {
  DRAFT: "Rascunho",
  CONFIRMED: "Confirmado",
  RESERVED: "Reservado",
  PICKING: "Separação",
  READY_TO_SHIP: "Pronto para expedição",
  INVOICED: "Faturado",
  SHIPPED: "Expedido",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
};

const statusTone: Record<string, "neutral" | "success" | "warning" | "danger"> = {
  DRAFT: "neutral",
  CONFIRMED: "warning",
  RESERVED: "warning",
  PICKING: "warning",
  READY_TO_SHIP: "success",
  INVOICED: "success",
  SHIPPED: "success",
  DELIVERED: "success",
  CANCELLED: "danger",
};

const filters: Array<[string, string]> = [
  ["ALL", "Todos"],
  ["DRAFT", "Rascunho"],
  ["CONFIRMED", "Confirmados"],
  ["RESERVED", "Reservados"],
  ["PICKING", "Separação"],
  ["READY_TO_SHIP", "Prontos"],
  ["INVOICED", "Faturados"],
  ["SHIPPED", "Expedidos"],
  ["DELIVERED", "Concluídos"],
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [variants, setVariants] = useState<StockOption[]>([]);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Order | null>(null);
  const [filter, setFilter] = useState("ALL");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const refresh = async () => {
    const API = salesOrdersApi();
    const [ordersResponse, optionsResponse] = await Promise.all([
      fetch(API, { credentials: "include", cache: "no-store" }),
      fetch(`${API}/options`, { credentials: "include", cache: "no-store" }),
    ]);

    if (ordersResponse.ok) setOrders(await ordersResponse.json());
    if (optionsResponse.ok) {
      const options = await optionsResponse.json();
      setCustomers(options.customers);
      setVariants(options.variants);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const visible = useMemo(
    () => (filter === "ALL" ? orders : orders.filter((item) => item.status === filter)),
    [orders, filter],
  );
  const open = orders.filter((item) => !["DELIVERED", "CANCELLED", "SHIPPED"].includes(item.status));
  const avgTicket = orders.length
    ? orders.reduce((sum, item) => sum + Number(item.totalAmount), 0) / orders.length
    : 0;

  const action = async (order: Order, endpoint: string) => {
    setBusy(order.id + endpoint);
    setMessage("");
    const response = await fetch(`${salesOrdersApi()}/${order.id}/${endpoint}`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const result = await response.json().catch(() => ({}));
    setMessage(
      response.ok
        ? `${order.orderNumber ?? order.code} atualizado com sucesso.`
        : (result.message ?? "Não foi possível atualizar o pedido."),
    );
    setBusy("");
    await refresh();
  };

  const refreshSelected = async (id: string) => {
    await refresh();
    const response = await fetch(`${salesOrdersApi()}/${id}`, {
      credentials: "include",
      cache: "no-store",
    });
    if (response.ok) setSelected(await response.json());
  };

  return (
    <div className="mx-auto max-w-[1600px]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-violet-700">
            <Sparkles size={13} /> Comercial inteligente
          </p>
          <h1 className="mt-1 text-3xl font-bold">Pedidos</h1>
          <p className="mt-2 text-sm text-stone-500">O BBOS acompanha cliente, preço, crédito e estoque antes de a venda avançar.</p>
        </div>
        <button onClick={() => setCreating(true)} className="flex items-center gap-2 rounded-xl bg-forest-900 px-4 py-3 text-xs font-bold text-white">
          <Plus size={15} /> Novo pedido
        </button>
      </header>

      {message && <div className="mt-5 rounded-xl border border-forest-100 bg-forest-50 p-3 text-xs font-semibold text-forest-800">{message}</div>}

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Pedidos em aberto" value={String(open.length)} />
        <Kpi label="Valor em carteira" value={money.format(open.reduce((sum, item) => sum + Number(item.totalAmount), 0))} />
        <Kpi label="Pedidos reservados" value={String(orders.filter((item) => ["RESERVED", "PICKING", "READY_TO_SHIP", "INVOICED"].includes(item.status)).length)} />
        <Kpi label="Aguardando estoque" value={String(orders.filter((item) => item.status === "CONFIRMED").length)} />
        <Kpi label="Prontos para expedição" value={String(orders.filter((item) => ["READY_TO_SHIP", "INVOICED"].includes(item.status)).length)} />
        <Kpi label="Ticket médio" value={money.format(avgTicket)} />
      </section>

      <div className="mt-7 flex flex-wrap gap-2">
        {filters.map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`rounded-xl border px-3 py-2 text-xs font-semibold ${filter === value ? "border-forest-200 bg-forest-50" : "bg-white"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="mt-5">
        <div className="mb-3 flex justify-between">
          <h2 className="text-lg font-semibold">Pedidos recentes</h2>
          <span className="text-xs text-stone-400">{visible.length} pedidos</span>
        </div>
        <div className="space-y-3">
          {visible.map((order) => (
            <Card key={order.id} className="p-4">
              <button onClick={() => setSelected(order)} className="w-full text-left">
                <div className="flex justify-between">
                  <div>
                    <strong>{order.orderNumber ?? order.code}</strong>
                    <p className="text-xs text-stone-500">{order.customer.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Status status={order.status} />
                    <strong>{money.format(Number(order.totalAmount))}</strong>
                    <ChevronRight size={16} />
                  </div>
                </div>
              </button>
              <div className="mt-3 flex gap-2">
                {order.status === "DRAFT" && (
                  <button disabled={!!busy} onClick={() => void action(order, "confirm")} className="rounded-lg bg-forest-900 px-3 py-2 text-xs text-white">Confirmar</button>
                )}
                {["DRAFT", "CONFIRMED", "RESERVED", "PICKING"].includes(order.status) && (
                  <button disabled={!!busy} onClick={() => void action(order, "cancel")} className="rounded-lg border px-3 py-2 text-xs">Cancelar</button>
                )}
              </div>
            </Card>
          ))}
          {!visible.length && (
            <Card className="py-14 text-center">
              <PackageCheck className="mx-auto text-stone-300" />
              <p className="mt-3 text-sm font-semibold">Nenhum pedido neste filtro</p>
            </Card>
          )}
        </div>
      </section>

      {creating && (
        <NewOrder
          customers={customers}
          variants={variants}
          onClose={() => setCreating(false)}
          onCreated={async () => {
            setCreating(false);
            await refresh();
          }}
        />
      )}

      {selected && (
        <OrderDrawer
          order={selected}
          onClose={() => setSelected(null)}
          onChanged={() => refreshSelected(selected.id)}
        />
      )}
    </div>
  );
}

function NewOrder({ customers, variants, onClose, onCreated }: { customers: Customer[]; variants: StockOption[]; onClose: () => void; onCreated: () => Promise<void> }) {
  const [orderNumber, setOrderNumber] = useState("Gerando…");
  const [customerId, setCustomerId] = useState("");
  const [paymentType, setPaymentType] = useState<"CASH" | "TERM">("CASH");
  const [paymentTerms, setPaymentTerms] = useState("14 dias");
  const [lines, setLines] = useState<DraftOrderLine[]>(() => [newDraftLine()]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [lineQuoteErrors, setLineQuoteErrors] = useState<Record<string, string>>({});
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [shippingQuotes, setShippingQuotes] = useState<ShippingQuoteOption[]>([]);
  const [shippingQuoteId, setShippingQuoteId] = useState("");
  const [shippingPostalCode, setShippingPostalCode] = useState("");
  const [shippingSummary, setShippingSummary] = useState<ShippingSummary | null>(null);
  const [shippingSort, setShippingSort] = useState<"PRICE" | "TIME">("PRICE");
  const [customPackage, setCustomPackage] = useState(false);
  const [packageBoxes, setPackageBoxes] = useState<PackageBox[]>(() => [newPackageBox()]);
  const [shippingBusy, setShippingBusy] = useState(false);
  const [shippingError, setShippingError] = useState("");
  const [freightResponsibility, setFreightResponsibility] = useState<"" | "BISPO" | "CUSTOMER" | "PICKUP">("");
  const [carrierName, setCarrierName] = useState("");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [customerReference, setCustomerReference] = useState("");
  const [notes, setNotes] = useState("");
  const [incoterm, setIncoterm] = useState("");
  const [incotermLocation, setIncotermLocation] = useState("");
  const [showTerms, setShowTerms] = useState(true);
  const [error, setError] = useState("");
  const [health, setHealth] = useState<CustomerHealth | null>(null);
  const [healthBusy, setHealthBusy] = useState(false);

  const customer = customers.find((candidate) => candidate.id === customerId);
  const completeLines = useMemo(
    () => lines.filter((line) => line.variantId && Number.isSafeInteger(line.quantity) && line.quantity > 0),
    [lines],
  );
  const firstQuote = completeLines.length ? quotes[completeLines[0]!.id] : undefined;
  const selectedShippingQuote = shippingQuotes.find((option) => option.id === shippingQuoteId);
  const sortedShippingQuotes = useMemo(
    () => [...shippingQuotes].sort((a, b) => shippingSort === "PRICE" ? a.priceCents - b.priceCents : a.deliveryDays - b.deliveryDays),
    [shippingQuotes, shippingSort],
  );
  const freightAmount = Number(selectedShippingQuote?.priceCents ?? 0) / 100;
  const productsTotal = completeLines.reduce((sum, line) => sum + Number(quotes[line.id]?.totalAmount ?? 0), 0);
  const totalWeightGrams = completeLines.reduce((sum, line) => {
    const variant = variants.find((candidate) => candidate.productVariantId === line.variantId);
    return sum + Number(variant?.presentationGrams ?? 0) * line.quantity;
  }, 0);
  const orderTotal = productsTotal + freightAmount;
  const isTerm = paymentType === "TERM";
  const isExport = firstQuote?.salesChannelType === "EXPORTACAO";
  const used = Number(health?.financialHealth?.openReceivables ?? 0);
  const limit = Number(health?.creditLimit ?? customer?.creditLimit ?? 0);
  const available = Number(health?.financialHealth?.availableCredit ?? Math.max(0, limit - used));
  const utilization = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const after = Math.max(0, available - orderTotal);
  const exceeds = isTerm && orderTotal > available;

  useEffect(() => {
    void fetch(`${salesOrdersApi()}/next-number`, { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = await response.json();
        setOrderNumber(data.number ?? "—");
      })
      .catch(() => setOrderNumber("—"));
  }, []);

  useEffect(() => {
    if (!customerId || !isTerm) {
      setHealth(null);
      return;
    }
    const selectedCustomer = customers.find((candidate) => candidate.id === customerId);
    if (selectedCustomer?.paymentTerms && selectedCustomer.paymentTerms !== "À vista") setPaymentTerms(selectedCustomer.paymentTerms);
    setHealthBusy(true);
    void fetch(`/api/customers/${customerId}/health`, { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setHealth(await response.json());
      })
      .catch(() => setHealth(null))
      .finally(() => setHealthBusy(false));
  }, [customerId, isTerm, customers]);

  useEffect(() => {
    if (!customerId || !completeLines.length) {
      setQuotes({});
      setLineQuoteErrors({});
      setQuoteError("");
      return;
    }
    let cancelled = false;
    setQuoteBusy(true);
    setQuoteError("");
    void Promise.all(completeLines.map(async (line) => {
      try {
        const params = new URLSearchParams({ customerId, productVariantId: line.variantId, quantity: String(line.quantity) });
        const response = await fetch(`${salesOrdersApi()}/quote?${params.toString()}`, { credentials: "include", cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message ?? "Preço interno não encontrado.");
        return { id: line.id, quote: payload as Quote, error: "" };
      } catch (cause) {
        return { id: line.id, quote: null, error: cause instanceof Error ? cause.message : "Preço interno não encontrado." };
      }
    }))
      .then((results) => {
        if (!cancelled) {
          setQuotes(results.reduce<Record<string, Quote>>((acc, result) => {
            if (result.quote) acc[result.id] = result.quote;
            return acc;
          }, {}));
          setLineQuoteErrors(Object.fromEntries(results.filter((result) => result.error).map((result) => [result.id, result.error])));
          setQuoteError(results.some((result) => result.error) ? "Existem produtos sem preço vigente. Verifique os itens destacados." : "");
        }
      })
      .finally(() => { if (!cancelled) setQuoteBusy(false); });
    return () => { cancelled = true; };
  }, [customerId, completeLines]);

  useEffect(() => {
    if (!customPackage) {
      const suggested = Math.max(1, Math.ceil(totalWeightGrams / 2500));
      setPackageBoxes((current) => Array.from({ length: suggested }, (_, index) =>
        current[index]
          ? { ...current[index]!, widthCm: "35", heightCm: "22", lengthCm: "11", weightKg: "" }
          : newPackageBox(),
      ));
    }
  }, [customPackage, totalWeightGrams]);

  useEffect(() => {
    setShippingQuotes([]);
    setShippingQuoteId("");
    setShippingPostalCode("");
    setShippingSummary(null);
    setShippingError("");
  }, [customerId, lines, customPackage, packageBoxes]);

  useEffect(() => {
    if (firstQuote?.salesChannelType === "DISTRIBUIDOR") setFreightResponsibility("CUSTOMER");
  }, [firstQuote?.salesChannelType]);

  const shippingPackages = () => {
    const count = Math.max(1, packageBoxes.length);
    const explicitWeightGrams = packageBoxes.map((box) => {
      const kg = Number(box.weightKg);
      return Number.isFinite(kg) && kg > 0 ? Math.round(kg * 1000) : 0;
    });
    const explicitTotal = explicitWeightGrams.reduce((sum, value) => sum + value, 0);
    const missing = explicitWeightGrams.filter((value) => value <= 0).length;
    const automaticWeight = missing > 0
      ? Math.max(1, Math.ceil(Math.max(0, totalWeightGrams - explicitTotal) / missing))
      : 0;

    return packageBoxes.map((box, index) => ({
      widthCm: Number(box.widthCm),
      heightCm: Number(box.heightCm),
      lengthCm: Number(box.lengthCm),
      weightGrams: (explicitWeightGrams[index] ?? 0) > 0 ? (explicitWeightGrams[index] ?? 0) : automaticWeight,
    }));
  };

  const calculateShipping = async () => {
    if (!customerId || !completeLines.length || completeLines.some((line) => !quotes[line.id])) return;
    setShippingBusy(true);
    setShippingError("");
    setShippingQuotes([]);
    setShippingQuoteId("");
    try {
      const response = await fetch(`${salesOrdersApi()}/shipping-quotes`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customerId,
          items: completeLines.map((line) => ({ productVariantId: line.variantId, quantity: line.quantity })),
          packages: shippingPackages(),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message ?? "Não foi possível cotar o frete.");
      setShippingQuotes(payload.options ?? []);
      setShippingPostalCode(payload.postalCode ?? "");
      setShippingSummary(payload.summary ?? null);
      if (payload.options?.length === 1) setShippingQuoteId(payload.options[0].id);
    } catch (cause) {
      setShippingError(cause instanceof Error ? cause.message : "Não foi possível cotar o frete.");
    } finally {
      setShippingBusy(false);
    }
  };

  const submit = async () => {
    setError("");
    if (!customerId || !completeLines.length) return setError("Selecione o cliente e ao menos um produto.");
    if (completeLines.length !== lines.length || completeLines.some((line) => !quotes[line.id])) return setError("Todos os itens precisam de produto, quantidade e preço vigente.");
    if (isTerm && !paymentTerms) return setError("Informe a condição da venda a prazo.");
    if (!freightResponsibility) return setError("Selecione quem será responsável pelo frete.");
    if (firstQuote?.salesChannelType === "DISTRIBUIDOR" && freightResponsibility === "CUSTOMER" && !selectedShippingQuote) {
      return setError("Calcule e selecione uma opção de frete para o distribuidor.");
    }

    const response = await fetch(salesOrdersApi(), {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: orderNumber,
        orderNumber,
        customerId,
        paymentType,
        paymentTerms: isTerm ? paymentTerms : "À vista",
        freightResponsibility,
        carrierName: selectedShippingQuote?.carrierName ?? carrierName,
        freight: freightAmount,
        shippingQuoteId: selectedShippingQuote?.id,
        destinationPostalCode: shippingPostalCode || undefined,
        packages: shippingPackages(),
        expectedDeliveryDate: expectedDeliveryDate || undefined,
        customerReference,
        notes,
        incoterm: isExport ? incoterm : undefined,
        incotermLocation: isExport ? incotermLocation : undefined,
        items: completeLines.map((line) => {
          const variant = variants.find((candidate) => candidate.productVariantId === line.variantId)!;
          return {
            productVariantId: variant.productVariantId,
            warehouseId: variant.warehouseId,
            quantity: line.quantity,
            unitPrice: quotes[line.id]!.officialUnitPrice,
          };
        }),
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setError(result.message ?? "Não foi possível criar o pedido.");
    await onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button aria-label="Fechar" onClick={onClose} className="absolute inset-0 bg-black/25" />
      <aside className="relative h-full w-full max-w-6xl overflow-y-auto bg-white p-6">
        <div className="flex justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-violet-700">Venda assistida</p>
            <h2 className="mt-1 text-xl font-bold">Novo pedido</h2>
            <p className="mt-2 text-sm font-semibold text-stone-700">{orderNumber}</p>
          </div>
          <button onClick={onClose}><X /></button>
        </div>

        <div className="mt-6 space-y-4">
          <Field label="Cliente">
            <select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
              <option value="">Selecione</option>
              {customers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Field>

          <div>
            <p className="text-xs font-semibold">Forma de pagamento</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setPaymentType("CASH")} className={`rounded-xl border px-4 py-3 text-sm font-semibold ${paymentType === "CASH" ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "bg-white text-stone-600"}`}>À vista</button>
              <button type="button" onClick={() => setPaymentType("TERM")} className={`rounded-xl border px-4 py-3 text-sm font-semibold ${paymentType === "TERM" ? "border-violet-300 bg-violet-50 text-violet-900" : "bg-white text-stone-600"}`}>A prazo</button>
            </div>
          </div>

          {isTerm && (
            <>
              <Field label="Condição de pagamento">
                <select value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value)}>
                  {paymentOptions.map((option) => <option key={option}>{option}</option>)}
                </select>
              </Field>
              {customerId && (
                <CreditContext
                  loading={healthBusy}
                  limit={limit}
                  used={used}
                  available={available}
                  utilization={utilization}
                  orderTotal={orderTotal}
                  after={after}
                  exceeds={exceeds}
                  status={health?.creditStatus ?? customer?.creditStatus}
                  reviewPending={health?.creditReviewPending}
                />
              )}
            </>
          )}

          <section className="rounded-2xl border bg-stone-50 p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold">Produtos do pedido</p>
                <p className="mt-0.5 text-[10px] text-stone-400">Adicione quantos produtos o distribuidor desejar.</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setLines(variants.map((variant) => ({ ...newDraftLine(), variantId: variant.productVariantId })))} className="rounded-lg border bg-white px-3 py-2 text-[10px] font-bold text-stone-600">Adicionar todos</button>
                <button type="button" onClick={() => setLines((current) => [...current, newDraftLine()])} className="rounded-lg bg-forest-900 px-3 py-2 text-[10px] font-bold text-white"><Plus size={12} className="mr-1 inline" /> Produto</button>
              </div>
            </div>

            <div className="space-y-2">
              {lines.map((line, index) => {
                const selectedVariant = variants.find((variant) => variant.productVariantId === line.variantId);
                const lineQuote = quotes[line.id];
                return (
                  <div key={line.id} className="rounded-xl border bg-white p-3">
                    <div className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_82px_112px_112px_32px]">
                      <div>
                        <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-stone-400">Produto / apresentação</p>
                        <select value={line.variantId} onChange={(event) => setLines((current) => current.map((item) => item.id === line.id ? { ...item, variantId: event.target.value } : item))} className="w-full rounded-lg border bg-white px-3 py-2.5 text-xs">
                          <option value="">Selecione</option>
                          {variants.map((variant) => (
                            <option key={variant.productVariantId} value={variant.productVariantId} disabled={lines.some((item) => item.id !== line.id && item.variantId === variant.productVariantId)}>
                              {variant.product} · {variant.presentationGrams >= 1000 ? `${variant.presentationGrams / 1000} kg` : `${variant.presentationGrams} g`} · {variant.sku}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-stone-400">Qtd.</p>
                        <input type="number" min="1" value={line.quantity} onChange={(event) => setLines((current) => current.map((item) => item.id === line.id ? { ...item, quantity: Math.max(1, Number(event.target.value)) } : item))} className="w-full rounded-lg border bg-white px-3 py-2.5 text-xs" />
                      </div>
                      <div>
                        <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-stone-400">Preço unit.</p>
                        <div className="rounded-lg border bg-stone-50 px-3 py-2.5 text-xs font-semibold">{quoteBusy && line.variantId ? "…" : lineQuote ? money.format(lineQuote.officialUnitPrice) : "—"}</div>
                      </div>
                      <div>
                        <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-stone-400">Subtotal</p>
                        <div className="rounded-lg bg-stone-50 px-3 py-2.5 text-right text-xs font-bold">{lineQuote ? money.format(lineQuote.totalAmount) : "—"}</div>
                      </div>
                      <button type="button" aria-label={`Remover item ${index + 1}`} disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))} className="mb-1 rounded-lg p-2 text-stone-400 hover:bg-red-50 hover:text-red-700 disabled:opacity-20"><X size={15} /></button>
                    </div>
                    {selectedVariant && <p className="mt-2 text-[9px] text-stone-400">{selectedVariant.line} · estoque disponível {selectedVariant.availableStock} pacote(s){lineQuote ? ` · tabela ${lineQuote.salesChannelName}` : ""}</p>}
                    {lineQuoteErrors[line.id] && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[10px] text-amber-800">{lineQuoteErrors[line.id]}</p>}
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-between rounded-xl bg-forest-900 px-4 py-3 text-white">
              <span className="text-[10px] font-semibold uppercase tracking-wider">Subtotal dos produtos</span>
              <b className="text-sm">{quoteBusy ? "Consultando…" : money.format(productsTotal)}</b>
            </div>
            {quoteError && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">{quoteError}</p>}
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white">
            <button type="button" onClick={() => setShowTerms((value) => !value)} className="flex w-full items-center justify-between px-4 py-3 text-left">
              <div>
                <p className="text-xs font-bold">Condições do pedido</p>
                <p className="mt-0.5 text-[10px] text-stone-400">Frete, entrega, referência e observações.</p>
              </div>
              <span className="text-xs font-semibold text-violet-700">{showTerms ? "Recolher" : "Editar"}</span>
            </button>

            {showTerms && (
              <div className="grid gap-3 border-t p-4 sm:grid-cols-2">
                <Field label="Frete">
                  <select value={freightResponsibility} onChange={(event) => setFreightResponsibility(event.target.value as "" | "BISPO" | "CUSTOMER" | "PICKUP")}>
                    <option value="">Selecione</option>
                    <option value="CUSTOMER">Por conta do cliente</option>
                    <option value="BISPO">Por conta da Bispo</option>
                    <option value="PICKUP">Retirada na fábrica</option>
                  </select>
                </Field>
                <Field label="Entrega prevista">
                  <input type="date" value={expectedDeliveryDate} onChange={(event) => setExpectedDeliveryDate(event.target.value)} />
                </Field>
                {freightResponsibility && freightResponsibility !== "PICKUP" && (
                  <Field label="Transportadora">
                    <input value={carrierName} onChange={(event) => setCarrierName(event.target.value)} placeholder="Opcional / a definir" />
                  </Field>
                )}
                {freightResponsibility === "CUSTOMER" && firstQuote?.salesChannelType === "DISTRIBUIDOR" && (
                  <div className="sm:col-span-2 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-emerald-950">Cotação do frete · Melhor Envio</p>
                        <p className="mt-1 text-[10px] text-emerald-800">Informe as medidas reais da caixa. O BBOS consulta todas as modalidades disponíveis para o CEP cadastrado.</p>
                      </div>
                      <button
                        type="button"
                        disabled={
                          shippingBusy ||
                          quoteBusy ||
                          !completeLines.length ||
                          completeLines.some((line) => !quotes[line.id]) ||
                          !packageBoxes.length ||
                          packageBoxes.some((box) =>
                            !Number.isFinite(Number(box.widthCm)) || Number(box.widthCm) <= 0 ||
                            !Number.isFinite(Number(box.heightCm)) || Number(box.heightCm) <= 0 ||
                            !Number.isFinite(Number(box.lengthCm)) || Number(box.lengthCm) <= 0
                          )
                        }
                        onClick={() => void calculateShipping()}
                        className="rounded-lg bg-emerald-950 px-4 py-2.5 text-[11px] font-bold text-white disabled:opacity-40"
                      >
                        {shippingBusy ? "Consultando todas…" : shippingQuotes.length ? "Cotar novamente" : "Ver todas as cotações"}
                      </button>
                    </div>
                    <div className="mt-3 rounded-xl border border-emerald-100 bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Volumes da cotação</p>
                          <p className="mt-1 text-[10px] text-stone-500">
                            Caixa P Bispo: 35 × 22 × 11 cm · até 2,5 kg. Cada caixa pode ter medidas e peso diferentes.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setCustomPackage(false);
                              const suggested = Math.max(1, Math.ceil(totalWeightGrams / 2500));
                              setPackageBoxes(Array.from({ length: suggested }, () => newPackageBox()));
                            }}
                            className={`rounded-lg border px-3 py-2 text-[10px] font-bold ${!customPackage ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "bg-white text-stone-600"}`}
                          >
                            Usar Caixa P
                          </button>
                          <button
                            type="button"
                            onClick={() => setCustomPackage(true)}
                            className={`rounded-lg border px-3 py-2 text-[10px] font-bold ${customPackage ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "bg-white text-stone-600"}`}
                          >
                            Personalizar caixas
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCustomPackage(true);
                              setPackageBoxes((current) => [...current, newPackageBox(current[current.length - 1])]);
                            }}
                            className="rounded-lg bg-emerald-950 px-3 py-2 text-[10px] font-bold text-white"
                          >
                            + Adicionar caixa
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        {packageBoxes.map((box, index) => {
                          const automaticKg = packageBoxes.length
                            ? totalWeightGrams / packageBoxes.length / 1000
                            : 0;
                          return (
                            <div key={box.id} className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                              <div className="mb-2 flex items-center justify-between">
                                <b className="text-[11px] text-stone-800">Caixa {index + 1}</b>
                                <button
                                  type="button"
                                  disabled={packageBoxes.length === 1}
                                  onClick={() => {
                                    setCustomPackage(true);
                                    setPackageBoxes((current) => current.filter((item) => item.id !== box.id));
                                  }}
                                  className="rounded-lg px-2 py-1 text-[10px] font-semibold text-red-700 disabled:opacity-25"
                                >
                                  Remover
                                </button>
                              </div>
                              <div className="grid gap-2 sm:grid-cols-4">
                                <Field label="Largura (cm)">
                                  <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={box.widthCm}
                                    disabled={!customPackage}
                                    onChange={(event) => setPackageBoxes((current) => current.map((item) => item.id === box.id ? { ...item, widthCm: event.target.value } : item))}
                                  />
                                </Field>
                                <Field label="Altura (cm)">
                                  <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={box.heightCm}
                                    disabled={!customPackage}
                                    onChange={(event) => setPackageBoxes((current) => current.map((item) => item.id === box.id ? { ...item, heightCm: event.target.value } : item))}
                                  />
                                </Field>
                                <Field label="Comprimento (cm)">
                                  <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={box.lengthCm}
                                    disabled={!customPackage}
                                    onChange={(event) => setPackageBoxes((current) => current.map((item) => item.id === box.id ? { ...item, lengthCm: event.target.value } : item))}
                                  />
                                </Field>
                                <Field label="Peso da caixa (kg)">
                                  <input
                                    type="number"
                                    min="0.1"
                                    step="0.1"
                                    value={box.weightKg}
                                    onChange={(event) => {
                                      setCustomPackage(true);
                                      setPackageBoxes((current) => current.map((item) => item.id === box.id ? { ...item, weightKg: event.target.value } : item));
                                    }}
                                    placeholder={automaticKg > 0 ? `Auto: ${automaticKg.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}` : "Automático"}
                                  />
                                </Field>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <p className="mt-2 text-[10px] text-stone-500">
                        Se o peso de uma caixa ficar em branco, o BBOS distribui automaticamente o peso restante do pedido entre as caixas sem peso informado.
                      </p>
                    </div>
                    {shippingError && <p className="mt-3 rounded-lg bg-white px-3 py-2 text-[11px] text-red-700">{shippingError}</p>}
                    {shippingSummary && (
                      <div className="mt-3 grid gap-2 rounded-xl bg-emerald-950 p-3 text-white sm:grid-cols-[1.4fr_.8fr_.8fr]">
                        <div className="flex items-center gap-3">
                          <div>
                            <small className="block text-[9px] uppercase tracking-wider text-emerald-200">Origem</small>
                            <b className="text-xs">{formatPostalCode(shippingSummary.originPostalCode)}</b>
                          </div>
                          <span className="text-emerald-300">→</span>
                          <div>
                            <small className="block text-[9px] uppercase tracking-wider text-emerald-200">Destino</small>
                            <b className="text-xs">{formatPostalCode(shippingSummary.destinationPostalCode)}</b>
                          </div>
                        </div>
                        <div>
                          <small className="block text-[9px] uppercase tracking-wider text-emerald-200">Peso</small>
                          <b className="text-xs">{(shippingSummary.weightGrams / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg</b>
                        </div>
                        <div>
                          <small className="block text-[9px] uppercase tracking-wider text-emerald-200">Embalagem cotada</small>
                          <b className="text-xs">{shippingSummary.widthCm} × {shippingSummary.heightCm} × {shippingSummary.lengthCm} cm</b>
                        </div>
                      </div>
                    )}
                    {shippingQuotes.length > 0 && (
                      <div className="mt-3">
                        <div className="mb-2 flex items-center gap-2">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-stone-500">Ordenar por</span>
                          <button type="button" onClick={() => setShippingSort("PRICE")} className={`rounded-full px-3 py-1 text-[10px] font-semibold ${shippingSort === "PRICE" ? "bg-emerald-950 text-white" : "bg-white text-stone-600"}`}>Mais barato</button>
                          <button type="button" onClick={() => setShippingSort("TIME")} className={`rounded-full px-3 py-1 text-[10px] font-semibold ${shippingSort === "TIME" ? "bg-emerald-950 text-white" : "bg-white text-stone-600"}`}>Menor prazo</button>
                        </div>
                        <div className="grid gap-2 lg:grid-cols-2">
                        {sortedShippingQuotes.map((option) => (
                          <label key={option.id} className={`cursor-pointer rounded-xl border p-3 ${shippingQuoteId === option.id ? "border-emerald-700 bg-white ring-1 ring-emerald-700" : "border-emerald-100 bg-white/70"}`}>
                            <input type="radio" name="shipping-quote" value={option.id} checked={shippingQuoteId === option.id} onChange={() => setShippingQuoteId(option.id)} className="sr-only" />
                            <span className="grid items-center gap-3 sm:grid-cols-[1.4fr_1fr_.7fr_.7fr]">
                              <span className="flex min-w-0 items-center gap-2">
                                {option.carrierLogoUrl ? <img src={option.carrierLogoUrl} alt="" className="h-6 w-10 object-contain" /> : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-100 text-[9px] font-bold">{option.carrierName.slice(0, 2).toUpperCase()}</span>}
                                <span className="min-w-0">
                                  <b className="block truncate text-xs text-stone-900">{option.carrierName}</b>
                                  <small className="block truncate text-[10px] text-stone-500">{option.serviceName}</small>
                                </span>
                              </span>
                              <small className="text-[10px] text-stone-500">{option.postingType}</small>
                              <small className="text-[10px] font-semibold text-stone-700">Até {option.deliveryDays} dias úteis</small>
                              <b className="whitespace-nowrap text-right text-xs text-stone-900">{money.format(option.priceCents / 100)}</b>
                            </span>
                          </label>
                        ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <Field label="Referência / PO do cliente">
                  <input value={customerReference} onChange={(event) => setCustomerReference(event.target.value)} placeholder="Opcional" />
                </Field>
                {isExport && (
                  <>
                    <Field label="Incoterm">
                      <input value={incoterm} onChange={(event) => setIncoterm(event.target.value.toUpperCase())} placeholder="Ex.: FOB, CIF" />
                    </Field>
                    <Field label="Local do Incoterm">
                      <input value={incotermLocation} onChange={(event) => setIncotermLocation(event.target.value)} placeholder="Ex.: Santos, Barcelona" />
                    </Field>
                  </>
                )}
                <label className="block text-xs font-semibold sm:col-span-2">
                  Observações comerciais
                  <textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3 text-sm" placeholder="Somente o que precisa aparecer no pedido..." />
                </label>
              </div>
            )}
          </section>

          {isTerm && health && (
            <p className={`rounded-xl px-3 py-2 text-xs ${exceeds ? "bg-red-50 text-red-700" : "bg-stone-50 text-stone-500"}`}>
              {exceeds ? `Excede o crédito disponível em ${money.format(orderTotal - available)}.` : `Após este pedido, restariam ${money.format(after)} de crédito disponível.`}
            </p>
          )}

          {error && <p className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p>}
          {selectedShippingQuote && (
            <div className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2 text-xs">
              <span className="text-stone-500">Produtos + frete por conta do comprador</span>
              <b>{money.format(orderTotal)}</b>
            </div>
          )}
          <button disabled={!completeLines.length || completeLines.length !== lines.length || quoteBusy || completeLines.some((line) => !quotes[line.id]) || !freightResponsibility || (firstQuote?.salesChannelType === "DISTRIBUIDOR" && freightResponsibility === "CUSTOMER" && !selectedShippingQuote)} onClick={() => void submit()} className="w-full rounded-xl bg-forest-900 py-3 text-xs font-bold text-white disabled:opacity-40">Salvar pedido</button>
          <p className="text-[10px] leading-4 text-stone-400">Preço e total vêm da tabela interna vigente. Condições comerciais ficam registradas no próprio pedido.</p>
        </div>
      </aside>
    </div>
  );
}

function CreditContext({
  loading,
  limit,
  used,
  available,
  utilization,
  orderTotal,
  after,
  exceeds,
  status,
  reviewPending,
}: {
  loading: boolean;
  limit: number;
  used: number;
  available: number;
  utilization: number;
  orderTotal: number;
  after: number;
  exceeds: boolean;
  status?: string;
  reviewPending?: boolean;
}) {
  if (loading) {
    return <div className="rounded-2xl border bg-stone-50 p-4 text-xs text-stone-500">Consultando crédito do cliente…</div>;
  }

  return (
    <div className={`rounded-2xl border p-4 ${exceeds ? "border-red-200 bg-red-50" : "border-violet-100 bg-violet-50/60"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.14em] text-violet-700">Linha de crédito vigente</p>
          <p className="mt-1 text-xs text-stone-500">
            Status: {status === "APPROVED" ? "Aprovado" : status === "UNDER_REVIEW" ? "Em análise" : status === "REJECTED" ? "Reprovado" : "Não analisado"}
            {reviewPending ? " · revisão de limite pendente" : ""}
          </p>
        </div>
        <CreditCard size={18} className="text-violet-600" />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <MiniCredit label="Limite" value={money.format(limit)} />
        <MiniCredit label="Utilizado" value={money.format(used)} />
        <MiniCredit label="Disponível" value={money.format(available)} />
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[10px] text-stone-500">
          <span>Utilização</span>
          <strong>{Math.round(utilization)}%</strong>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white">
          <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.min(100, utilization)}%` }} />
        </div>
      </div>

      {orderTotal > 0 && (
        <div className={`mt-3 rounded-xl px-3 py-2 text-xs ${exceeds ? "bg-red-100 text-red-800" : "bg-white text-stone-600"}`}>
          {exceeds
            ? `Pedido acima do disponível em ${money.format(orderTotal - available)}.`
            : `Impacto do pedido: crédito restante ${money.format(after)}.`}
        </div>
      )}
    </div>
  );
}

function MiniCredit({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-2.5">
      <p className="text-[9px] uppercase tracking-wider text-stone-400">{label}</p>
      <p className="mt-1 text-xs font-bold text-stone-800">{value}</p>
    </div>
  );
}

function OrderDrawer({ order, onClose, onChanged }: { order: Order; onClose: () => void; onChanged: () => Promise<void> }) {
  const [mode, setMode] = useState<"INTERNAL" | "CLIENT">("INTERNAL");
  const [requests, setRequests] = useState<DiscountRequest[]>([]);
  const [discountPercent, setDiscountPercent] = useState("");
  const [rationale, setRationale] = useState("");
  const [selectedItemId, setSelectedItemId] = useState(order.items[0]?.id ?? "");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const selectedItem = order.items.find((item) => item.id === selectedItemId) ?? order.items[0];

  const loadRequests = async () => {
    const response = await fetch(`${salesOrdersApi()}/${order.id}/discount-requests`, {
      credentials: "include",
      cache: "no-store",
    });
    if (response.ok) setRequests(await response.json());
  };

  useEffect(() => {
    void loadRequests();
  }, [order.id]);

  useEffect(() => {
    if (!selectedItem?.productVariantId) {
      setQuote(null);
      return;
    }
    const params = new URLSearchParams({
      customerId: order.customer.id,
      productVariantId: selectedItem.productVariantId,
      quantity: String(selectedItem.quantity),
    });
    void fetch(`${salesOrdersApi()}/quote?${params.toString()}`, {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => (response.ok ? setQuote(await response.json()) : setQuote(null)))
      .catch(() => setQuote(null));
  }, [selectedItem?.productVariantId, selectedItem?.quantity, order.customer.id]);

  const requestDiscount = async () => {
    if (!selectedItem) return;
    setBusy(true);
    setError("");
    const response = await fetch(`${salesOrdersApi()}/${order.id}/discount-request`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        salesOrderItemId: selectedItem.id,
        discountPercent: Number(discountPercent),
        rationale,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.message ?? "Não foi possível solicitar desconto.");
    } else {
      setDiscountPercent("");
      setRationale("");
      await loadRequests();
    }
    setBusy(false);
  };

  const decide = async (requestId: string, decision: "APPROVE" | "REJECT") => {
    setBusy(true);
    setError("");
    const response = await fetch(`${salesOrdersApi()}/${order.id}/discount-request/${requestId}/decision`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.message ?? "Não foi possível decidir a solicitação.");
    } else {
      await loadRequests();
      await onChanged();
    }
    setBusy(false);
  };

  const paymentLabel = order.paymentType === "TERM" ? (order.paymentTermsSnapshot || "A prazo") : "À vista";
  const deliveryLabel = order.expectedDeliveryDate
    ? new Date(order.expectedDeliveryDate).toLocaleDateString("pt-BR")
    : "A combinar";
  const freightLabel = freightLabels[order.freightResponsibility ?? ""] ?? "A combinar";
  const requested = Number(discountPercent || 0);
  const simulatedPrice = quote ? quote.officialUnitPrice * (1 - requested / 100) : 0;

  const clientSummary = [
    `PEDIDO ${order.orderNumber ?? order.code}`,
    `Cliente: ${order.customer.name}`,
    "",
    ...order.items.map((item) => `${item.productName} · ${item.quantity} un. · ${money.format(Number(item.unitPrice ?? 0))} · ${money.format(Number(item.totalAmount))}`),
    "",
    `Total: ${money.format(Number(order.totalAmount))}`,
    `Pagamento: ${paymentLabel}`,
    `Frete: ${freightLabel}`,
    `Entrega prevista: ${deliveryLabel}`,
    order.carrierName ? `Transportadora: ${order.carrierName}` : "",
    order.customerReference ? `Referência: ${order.customerReference}` : "",
    order.incoterm ? `Incoterm: ${order.incoterm}${order.incotermLocation ? ` · ${order.incotermLocation}` : ""}` : "",
    order.notes ? `Observações: ${order.notes}` : "",
  ].filter(Boolean).join("\n");

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(clientSummary);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Não foi possível copiar o resumo neste navegador.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button aria-label="Fechar" onClick={onClose} className="absolute inset-0 bg-black/25" />
      <aside className="relative h-full w-full max-w-3xl overflow-y-auto bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">{order.orderNumber ?? order.code}</h2>
            <p className="text-xs text-stone-500">{order.customer.name}</p>
          </div>
          <button onClick={onClose}><X /></button>
        </div>

        <div className="mt-5 grid grid-cols-2 rounded-xl bg-stone-100 p-1">
          <button onClick={() => setMode("INTERNAL")} className={`rounded-lg px-3 py-2 text-xs font-bold ${mode === "INTERNAL" ? "bg-white shadow-sm" : "text-stone-500"}`}>Interno</button>
          <button onClick={() => setMode("CLIENT")} className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold ${mode === "CLIENT" ? "bg-white shadow-sm" : "text-stone-500"}`}>
            <Eye size={13} /> Visualização do cliente
          </button>
        </div>

        {mode === "CLIENT" ? (
          <ClientOrderView
            order={order}
            paymentLabel={paymentLabel}
            freightLabel={freightLabel}
            deliveryLabel={deliveryLabel}
            copied={copied}
            onCopy={() => void copySummary()}
          />
        ) : (
          <>
            <div className="mt-6">
              <Status status={order.status} />
              <div className="mt-4 flex items-center gap-2 text-xs text-stone-500">
                <Clock3 size={14} /> Pedido registrado no fluxo operacional.
              </div>
            </div>

            <div className="mt-6 space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="grid grid-cols-[1fr_70px_110px_110px] gap-2 rounded-xl bg-stone-50 px-3 py-3 text-xs">
                  <strong>{item.productName}<span className="ml-1 font-normal text-stone-400">{item.sku}</span></strong>
                  <span>{item.quantity} un.</span>
                  <span>{money.format(Number(item.unitPrice ?? 0))}</span>
                  <strong className="text-right">{money.format(Number(item.totalAmount))}</strong>
                </div>
              ))}
            </div>

            <section className="mt-5 rounded-2xl border p-4">
              <p className="text-xs font-bold">Condições comerciais</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <MiniValue label="Pagamento" value={paymentLabel} />
                <MiniValue label="Frete" value={freightLabel} />
                <MiniValue label="Entrega" value={deliveryLabel} />
                {order.carrierName && <MiniValue label="Transportadora" value={order.carrierName} />}
                {order.customerReference && <MiniValue label="Referência" value={order.customerReference} />}
                {order.incoterm && <MiniValue label="Incoterm" value={`${order.incoterm}${order.incotermLocation ? ` · ${order.incotermLocation}` : ""}`} />}
              </div>
            </section>

            {order.status === "DRAFT" && order.items.length > 0 && (
              <section className="mt-6 rounded-2xl border border-violet-100 bg-violet-50/50 p-4">
                <div className="flex items-center gap-2">
                  <BadgeDollarSign size={17} className="text-violet-700" />
                  <div>
                    <p className="text-xs font-bold text-violet-900">Solicitar desconto</p>
                    <p className="text-[10px] text-violet-700">Controle interno. Nada desta aprovação aparece para o cliente.</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Field label="Item">
                    <select value={selectedItemId} onChange={(event) => setSelectedItemId(event.target.value)}>
                      {order.items.map((item) => <option key={item.id} value={item.id}>{item.productName} · {item.sku}</option>)}
                    </select>
                  </Field>
                  <Field label="Desconto solicitado (%)">
                    <input type="number" min="0" step="0.01" value={discountPercent} onChange={(event) => setDiscountPercent(event.target.value)} />
                  </Field>
                </div>
                {quote && (
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <MiniValue label="Preço oficial" value={money.format(quote.officialUnitPrice)} />
                    <MiniValue label="Preço proposto" value={money.format(simulatedPrice)} />
                    <MiniValue label="Máx. solicitável" value={`${quote.discountPolicy.maxRequestPercent.toFixed(2)}%`} />
                  </div>
                )}
                <label className="mt-3 block text-xs font-semibold">
                  Justificativa
                  <textarea rows={3} value={rationale} onChange={(event) => setRationale(event.target.value)} className="mt-2 w-full rounded-xl border bg-white px-3 py-3 text-sm" placeholder="Motivo comercial da exceção..." />
                </label>
                <button disabled={busy || !quote || requested <= 0 || !rationale.trim()} onClick={() => void requestDiscount()} className="mt-3 w-full rounded-xl bg-stone-950 py-3 text-xs font-bold text-white disabled:opacity-40">Enviar para aprovação</button>
              </section>
            )}

            {requests.length > 0 && (
              <section className="mt-6">
                <div className="flex items-center gap-2"><ShieldCheck size={16} /><h3 className="text-sm font-semibold">Histórico interno de descontos</h3></div>
                <div className="mt-3 space-y-2">
                  {requests.map((request) => (
                    <div key={request.id} className="rounded-xl border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold">{Number(request.discountPercent).toFixed(2)}% · {money.format(Number(request.officialUnitPrice))} → {money.format(Number(request.requestedUnitPrice))}</p>
                        <Badge tone={request.status === "APPROVED" ? "success" : request.status === "REJECTED" ? "danger" : "warning"}>{request.status === "APPROVED" ? "Aprovado" : request.status === "REJECTED" ? "Recusado" : "Pendente"}</Badge>
                      </div>
                      <p className="mt-1 text-[11px] text-stone-500">{request.rationale}</p>
                      <p className="mt-1 text-[10px] text-stone-400">Solicitado por {request.requestedByName}</p>
                      {request.status === "PENDING" && (
                        <div className="mt-3 flex gap-2">
                          <button disabled={busy} onClick={() => void decide(request.id, "APPROVE")} className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-[11px] font-semibold text-white"><Check size={13} /> Aprovar</button>
                          <button disabled={busy} onClick={() => void decide(request.id, "REJECT")} className="rounded-lg border px-3 py-2 text-[11px] font-semibold">Recusar</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {error && <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</div>}
      </aside>
    </div>
  );
}

function ClientOrderView({
  order,
  paymentLabel,
  freightLabel,
  deliveryLabel,
  copied,
  onCopy,
}: {
  order: Order;
  paymentLabel: string;
  freightLabel: string;
  deliveryLabel: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <section className="mt-6 rounded-3xl border bg-stone-50 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-violet-700">Bispo Coffees · Pedido</p>
          <h3 className="mt-1 text-2xl font-bold">{order.orderNumber ?? order.code}</h3>
          <p className="mt-1 text-sm text-stone-500">Preparado para {order.customer.name}</p>
        </div>
        <Status status={order.status} />
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border bg-white">
        <div className="grid grid-cols-[1fr_58px_100px_108px] gap-2 border-b bg-stone-50 px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-stone-400">
          <span>Produto</span><span>Qtd.</span><span>Preço</span><span className="text-right">Total</span>
        </div>
        {order.items.map((item) => (
          <div key={item.id} className="grid grid-cols-[1fr_58px_100px_108px] items-center gap-2 border-b px-3 py-3 text-xs last:border-b-0">
            <strong>{item.productName}</strong>
            <span>{item.quantity}</span>
            <span>{money.format(Number(item.unitPrice ?? 0))}</span>
            <strong className="text-right">{money.format(Number(item.totalAmount))}</strong>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ClientTerm label="Pagamento" value={paymentLabel} />
        <ClientTerm label="Frete" value={freightLabel} />
        <ClientTerm label="Entrega prevista" value={deliveryLabel} />
        {order.carrierName && <ClientTerm label="Transportadora" value={order.carrierName} />}
        {order.customerReference && <ClientTerm label="Referência" value={order.customerReference} />}
        {order.incoterm && <ClientTerm label="Incoterm" value={`${order.incoterm}${order.incotermLocation ? ` · ${order.incotermLocation}` : ""}`} />}
      </div>

      {order.notes && (
        <div className="mt-4 rounded-2xl bg-white p-4">
          <p className="text-[9px] font-bold uppercase tracking-wider text-stone-400">Observações</p>
          <p className="mt-1 text-xs leading-5 text-stone-700">{order.notes}</p>
        </div>
      )}

      <div className="mt-5 flex items-end justify-between rounded-2xl bg-stone-950 px-5 py-4 text-white">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-stone-400">Total do pedido</p>
          <p className="mt-1 text-xs text-stone-300">Condições resumidas para aprovação</p>
        </div>
        <strong className="text-2xl">{money.format(Number(order.totalAmount))}</strong>
      </div>

      <button onClick={onCopy} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border bg-white px-4 py-3 text-xs font-bold">
        <Copy size={14} /> {copied ? "Resumo copiado" : "Copiar resumo para enviar"}
      </button>
    </section>
  );
}

function ClientTerm({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-white p-4"><p className="text-[9px] font-bold uppercase tracking-wider text-stone-400">{label}</p><p className="mt-1 text-sm font-semibold text-stone-900">{value}</p></div>;
}

function MiniValue({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-white p-3"><p className="text-[9px] uppercase tracking-wider text-stone-400">{label}</p><p className="mt-1 font-bold text-stone-800">{value}</p></div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-xs font-semibold">{label}<div className="mt-2 [&>*]:w-full [&>*]:rounded-xl [&>*]:border [&>*]:px-3 [&>*]:py-3">{children}</div></label>;
}

function Kpi({ label, value }: { label: string; value: string }) {
  return <Card className="p-4"><p className="text-[11px] text-stone-500">{label}</p><p className="mt-2 text-xl font-bold">{value}</p></Card>;
}

function Status({ status }: { status: string }) {
  return <Badge tone={statusTone[status] ?? "neutral"}>{statusLabel[status] ?? status}</Badge>;
}
