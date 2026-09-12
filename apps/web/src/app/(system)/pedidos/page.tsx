"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ChevronRight, Clock3, CreditCard, PackageCheck, Plus, Sparkles, X } from "lucide-react";
import { Badge, Card } from "@bbos/ui";
import { getApiBaseUrl } from "@/lib/api-url";

const salesOrdersApi = () => `${getApiBaseUrl()}/sales-orders`;
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const paymentOptions = ["7 dias", "14 dias", "21 dias", "28 dias", "30 dias", "45 dias", "60 dias"];

type StockOption = {
  productVariantId: string;
  warehouseId: string;
  warehouse: string;
  line: string;
  lineCode: string;
  product: string;
  sku: string;
  presentationGrams: number;
  physicalStock: number;
  reservedStock: number;
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
  paymentTerms?: string | null;
  financialHealth: {
    openReceivables: number;
    overdueAmount: number;
    overdueCount: number;
    maxDaysOverdue: number;
    availableCredit: number;
  };
  termPurchaseAllowed?: boolean;
  cashPurchaseAllowed?: boolean;
};

type OrderItem = {
  id: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice?: string;
  totalAmount: string;
  reservations?: Array<{ status: string; quantity: number }>;
};

type Order = {
  id: string;
  code: string;
  orderNumber?: string;
  status: string;
  totalAmount: string;
  subtotal?: string;
  discount?: string;
  freight?: string;
  quantity: number;
  orderedAt: string;
  expectedDeliveryDate?: string;
  customer: Customer;
  items: OrderItem[];
  reservations: Array<{ id: string; status: string; quantity: number }>;
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
    const [a, b] = await Promise.all([
      fetch(API, { credentials: "include", cache: "no-store" }),
      fetch(`${API}/options`, { credentials: "include", cache: "no-store" }),
    ]);
    if (a.ok) setOrders(await a.json());
    if (b.ok) {
      const o = await b.json();
      setCustomers(o.customers);
      setVariants(o.variants);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const visible = useMemo(
    () => (filter === "ALL" ? orders : orders.filter((i) => i.status === filter)),
    [orders, filter],
  );
  const open = orders.filter((i) => !["DELIVERED", "CANCELLED", "SHIPPED"].includes(i.status));
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
    const result = await response.json();
    setMessage(
      response.ok
        ? `${order.orderNumber ?? order.code} atualizado com sucesso.`
        : (result.message ?? "Não foi possível atualizar o pedido."),
    );
    setBusy("");
    await refresh();
  };

  return (
    <div className="mx-auto max-w-[1600px]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-violet-700">
            <Sparkles size={13} /> Comercial inteligente
          </p>
          <h1 className="mt-1 text-3xl font-bold">Pedidos</h1>
          <p className="mt-2 text-sm text-stone-500">O BBOS acompanha cliente, estoque e condições antes de a venda avançar.</p>
        </div>
        <button onClick={() => setCreating(true)} className="flex items-center gap-2 rounded-xl bg-forest-900 px-4 py-3 text-xs font-bold text-white">
          <Plus size={15} /> Novo pedido
        </button>
      </header>

      {message && <div className="mt-5 rounded-xl border border-forest-100 bg-forest-50 p-3 text-xs font-semibold text-forest-800">{message}</div>}

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Pedidos em aberto" value={String(open.length)} />
        <Kpi label="Valor em carteira" value={money.format(open.reduce((s, i) => s + Number(i.totalAmount), 0))} />
        <Kpi label="Pedidos reservados" value={String(orders.filter((i) => ["RESERVED", "PICKING", "READY_TO_SHIP", "INVOICED"].includes(i.status)).length)} />
        <Kpi label="Aguardando estoque" value={String(orders.filter((i) => i.status === "CONFIRMED").length)} />
        <Kpi label="Prontos para expedição" value={String(orders.filter((i) => ["READY_TO_SHIP", "INVOICED"].includes(i.status)).length)} />
        <Kpi label="Ticket médio" value={money.format(avgTicket)} />
      </section>

      <div className="mt-7 flex flex-wrap gap-2">
        {filters.map(([value, label]) => (
          <button key={value} onClick={() => setFilter(value)} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${filter === value ? "border-forest-200 bg-forest-50" : "bg-white"}`}>
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

      {creating && <NewOrder customers={customers} variants={variants} onClose={() => setCreating(false)} onCreated={async () => { setCreating(false); await refresh(); }} />}
      {selected && <OrderDrawer order={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function NewOrder({ customers, variants, onClose, onCreated }: { customers: Customer[]; variants: StockOption[]; onClose: () => void; onCreated: () => Promise<void> }) {
  const [orderNumber, setOrderNumber] = useState("Gerando…");
  const [customerId, setCustomerId] = useState("");
  const [paymentType, setPaymentType] = useState<"CASH" | "TERM">("CASH");
  const [paymentTerms, setPaymentTerms] = useState("14 dias");
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [error, setError] = useState("");
  const [health, setHealth] = useState<CustomerHealth | null>(null);
  const [healthBusy, setHealthBusy] = useState(false);

  const selected = variants.find((v) => v.productVariantId === variantId);
  const customer = customers.find((c) => c.id === customerId);
  const orderTotal = Math.max(0, quantity * unitPrice);
  const isTerm = paymentType === "TERM";
  const used = Number(health?.financialHealth?.openReceivables ?? 0);
  const limit = Number(health?.creditLimit ?? customer?.creditLimit ?? 0);
  const available = Number(health?.financialHealth?.availableCredit ?? Math.max(0, limit - used));
  const utilization = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const after = Math.max(0, available - orderTotal);
  const exceeds = isTerm && orderTotal > available;

  useEffect(() => {
    void fetch(`${salesOrdersApi()}/next-number`, { credentials: "include", cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const data = await r.json();
        setOrderNumber(data.number ?? "—");
      })
      .catch(() => setOrderNumber("—"));
  }, []);

  useEffect(() => {
    if (!customerId || !isTerm) {
      setHealth(null);
      return;
    }
    const selectedCustomer = customers.find((c) => c.id === customerId);
    if (selectedCustomer?.paymentTerms && selectedCustomer.paymentTerms !== "À vista") setPaymentTerms(selectedCustomer.paymentTerms);
    setHealthBusy(true);
    void fetch(`/api/customers/${customerId}/health`, { credentials: "include", cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        setHealth(await r.json());
      })
      .catch(() => setHealth(null))
      .finally(() => setHealthBusy(false));
  }, [customerId, isTerm, customers]);

  const submit = async () => {
    if (!selected || !customerId) return setError("Selecione cliente e produto.");
    if (isTerm && !paymentTerms) return setError("Informe a condição da venda a prazo.");
    const r = await fetch(salesOrdersApi(), {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: orderNumber,
        orderNumber,
        customerId,
        paymentType,
        paymentTerms: isTerm ? paymentTerms : "À vista",
        items: [{ productVariantId: selected.productVariantId, warehouseId: selected.warehouseId, quantity, unitPrice }],
      }),
    });
    const result = await r.json();
    if (!r.ok) return setError(result.message ?? "Não foi possível criar o pedido.");
    await onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button aria-label="Fechar" onClick={onClose} className="absolute inset-0 bg-black/25" />
      <aside className="relative h-full w-full max-w-2xl overflow-y-auto bg-white p-6">
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
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Selecione</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>

          <div>
            <p className="text-xs font-semibold">Forma de pagamento</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setPaymentType("CASH")} className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${paymentType === "CASH" ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "bg-white text-stone-600"}`}>À vista</button>
              <button type="button" onClick={() => setPaymentType("TERM")} className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${paymentType === "TERM" ? "border-violet-300 bg-violet-50 text-violet-900" : "bg-white text-stone-600"}`}>A prazo</button>
            </div>
          </div>

          {isTerm && (
            <>
              <Field label="Condição de pagamento">
                <select value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)}>
                  {paymentOptions.map((option) => <option key={option}>{option}</option>)}
                </select>
              </Field>
              {customerId && <CreditContext loading={healthBusy} limit={limit} used={used} available={available} utilization={utilization} orderTotal={orderTotal} after={after} exceeds={exceeds} status={health?.creditStatus ?? customer?.creditStatus} reviewPending={health?.creditReviewPending} />}
            </>
          )}

          <div className="rounded-2xl border bg-stone-50 p-3">
            <div className="grid grid-cols-[minmax(0,1fr)_88px_116px_118px] items-end gap-2">
              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-400">Produto / apresentação</p>
                <select value={variantId} onChange={(e) => setVariantId(e.target.value)} className="w-full rounded-xl border bg-white px-3 py-3 text-sm">
                  <option value="">Selecione</option>
                  {variants.map((v) => (
                    <option key={v.productVariantId} value={v.productVariantId}>
                      {v.product} · {v.presentationGrams >= 1000 ? `${v.presentationGrams / 1000} kg` : `${v.presentationGrams} g`} · {v.sku}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-400">Qtd.</p>
                <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="w-full rounded-xl border bg-white px-3 py-3 text-sm" />
              </div>
              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-400">Preço unit.</p>
                <input type="number" min="0" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(Number(e.target.value))} className="w-full rounded-xl border bg-white px-3 py-3 text-sm" />
              </div>
              <div className="rounded-xl bg-white px-3 py-3 text-right">
                <p className="text-[9px] font-bold uppercase tracking-wider text-stone-400">Total</p>
                <p className="mt-1 text-sm font-bold text-stone-900">{money.format(orderTotal)}</p>
              </div>
            </div>
            {selected && <p className="mt-2 text-[10px] text-stone-400">{selected.line} · estoque disponível {selected.availableStock} pacote(s)</p>}
          </div>

          {isTerm && health && (
            <p className={`rounded-xl px-3 py-2 text-xs ${exceeds ? "bg-red-50 text-red-700" : "bg-stone-50 text-stone-500"}`}>
              {exceeds ? `Excede o crédito disponível em ${money.format(orderTotal - available)}.` : `Após este pedido, restariam ${money.format(after)} de crédito disponível.`}
            </p>
          )}

          {error && <p className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p>}
          <button onClick={() => void submit()} className="w-full rounded-xl bg-forest-900 py-3 text-xs font-bold text-white">Salvar pedido</button>
          <p className="text-[10px] leading-4 text-stone-400">O número exibido é confirmado no salvamento. Se o pedido for cancelado depois, o número permanece no histórico e não é reutilizado.</p>
        </div>
      </aside>
    </div>
  );
}

function CreditContext({ loading, limit, used, available, utilization, orderTotal, after, exceeds, status, reviewPending }: { loading: boolean; limit: number; used: number; available: number; utilization: number; orderTotal: number; after: number; exceeds: boolean; status?: string; reviewPending?: boolean }) {
  if (loading) return <div className="rounded-2xl border bg-stone-50 p-4 text-xs text-stone-500">Consultando crédito do cliente…</div>;
  return (
    <div className={`rounded-2xl border p-4 ${exceeds ? "border-red-200 bg-red-50" : "border-violet-100 bg-violet-50/60"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.14em] text-violet-700">Linha de crédito vigente</p>
          <p className="mt-1 text-xs text-stone-500">Status: {status === "APPROVED" ? "Aprovado" : status === "UNDER_REVIEW" ? "Em análise" : status === "REJECTED" ? "Reprovado" : "Não analisado"}{reviewPending ? " · revisão de limite pendente" : ""}</p>
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
          <span>Utilização</span><strong>{Math.round(utilization)}%</strong>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white">
          <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${Math.min(100, utilization)}%` }} />
        </div>
      </div>
      {orderTotal > 0 && (
        <div className={`mt-3 rounded-xl px-3 py-2 text-xs ${exceeds ? "bg-red-100 text-red-800" : "bg-white text-stone-600"}`}>
          {exceeds ? `Pedido acima do disponível em ${money.format(orderTotal - available)}.` : `Impacto do pedido: crédito restante ${money.format(after)}.`}
        </div>
      )}
    </div>
  );
}

function MiniCredit({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-white p-2.5"><p className="text-[9px] uppercase tracking-wider text-stone-400">{label}</p><p className="mt-1 text-xs font-bold text-stone-800">{value}</p></div>;
}

function OrderDrawer({ order, onClose }: { order: Order; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex justify-end"><button aria-label="Fechar" onClick={onClose} className="absolute inset-0 bg-black/25"/><aside className="relative h-full w-full max-w-xl bg-white p-6"><div className="flex justify-between"><div><h2 className="text-xl font-bold">{order.orderNumber ?? order.code}</h2><p className="text-xs text-stone-500">{order.customer.name}</p></div><button onClick={onClose}><X/></button></div><div className="mt-6"><Status status={order.status}/><div className="mt-4 flex items-center gap-2 text-xs text-stone-500"><Clock3 size={14}/> Pedido registrado no fluxo operacional.</div></div></aside></div>;
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
