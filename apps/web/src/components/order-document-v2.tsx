"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Printer } from "lucide-react";

type Customer = {
  id: string;
  name: string;
  legalName?: string | null;
  tradeName?: string | null;
  taxId?: string | null;
  segment?: string | null;
  email?: string | null;
  phone?: string | null;
  postalCode?: string | null;
  address?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
};

type OrderItem = {
  id: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice?: string | number | null;
  totalAmount: string | number;
};

type Order = {
  id: string;
  code: string;
  orderNumber?: string | null;
  status: string;
  orderedAt: string;
  totalAmount: string | number;
  subtotal?: string | number | null;
  discount?: string | number | null;
  freight?: string | number | null;
  expectedDeliveryDate?: string | null;
  paymentType?: string | null;
  paymentTermsSnapshot?: string | null;
  freightResponsibility?: string | null;
  carrierName?: string | null;
  customerReference?: string | null;
  incoterm?: string | null;
  incotermLocation?: string | null;
  notes?: string | null;
  customer: { id: string; name: string };
  items: OrderItem[];
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR");
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
const freightLabel: Record<string, string> = {
  BISPO: "Por conta da Bispo",
  CUSTOMER: "Por conta do cliente",
  PICKUP: "Retirada na fábrica",
};

async function resolveOrder(reference: string, signal: AbortSignal): Promise<Order> {
  const direct = await fetch(`/api/sales-orders/${encodeURIComponent(reference)}`, {
    credentials: "include",
    cache: "no-store",
    signal,
  });
  if (direct.ok) return direct.json() as Promise<Order>;

  const list = await fetch("/api/sales-orders", {
    credentials: "include",
    cache: "no-store",
    signal,
  });
  if (!list.ok) throw new Error("order");
  const orders = (await list.json()) as Order[];
  const normalized = decodeURIComponent(reference).trim().toUpperCase();
  const match = orders.find((item) =>
    [item.id, item.code, item.orderNumber]
      .filter(Boolean)
      .some((value) => String(value).trim().toUpperCase() === normalized),
  );
  if (!match) throw new Error("order");
  return match;
}

export default function OrderDocumentV2() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [order, setOrder] = useState<Order | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    Promise.all([
      resolveOrder(id, controller.signal),
      fetch("/api/customers", { credentials: "include", cache: "no-store", signal: controller.signal }),
    ])
      .then(async ([nextOrder, customerResponse]) => {
        const customers = customerResponse.ok ? ((await customerResponse.json()) as Customer[]) : [];
        setOrder(nextOrder);
        setCustomer(customers.find((item) => item.id === nextOrder.customer.id) ?? null);
        setState("ready");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState("error");
      });
    return () => controller.abort();
  }, [id]);

  const businessNumber = order?.orderNumber ?? order?.code ?? "Pedido-Bispo";
  const provisional = order?.status === "DRAFT";
  const fileName = `${businessNumber}${provisional ? "-PROVISORIO" : ""}.pdf`;

  useEffect(() => {
    if (!order) return;
    const previousTitle = document.title;
    const applyBusinessNumber = () => { document.title = businessNumber; };
    applyBusinessNumber();
    window.addEventListener("beforeprint", applyBusinessNumber);
    return () => {
      window.removeEventListener("beforeprint", applyBusinessNumber);
      document.title = previousTitle;
    };
  }, [order, businessNumber]);

  const payment = order?.paymentType === "TERM" ? order.paymentTermsSnapshot || "A prazo" : "À vista";
  const delivery = order?.expectedDeliveryDate ? date.format(new Date(order.expectedDeliveryDate)) : "A combinar";
  const address = useMemo(() => {
    if (!customer) return "—";
    return [
      customer.address,
      customer.district,
      customer.city && customer.state ? `${customer.city}/${customer.state}` : customer.city || customer.state,
      customer.postalCode,
    ].filter(Boolean).join(" · ") || "—";
  }, [customer]);

  if (state === "loading") return <main className="grid min-h-screen place-items-center bg-stone-100 text-sm text-stone-500">Preparando documento do pedido…</main>;
  if (state === "error" || !order) return <main className="grid min-h-screen place-items-center bg-stone-100 p-6 text-center text-sm text-red-700">Não foi possível preparar o documento deste pedido.</main>;

  return (
    <main className="min-h-screen bg-[#EEEDEA] py-8 print:bg-white print:py-0">
      <div className="screen-only mx-auto mb-4 flex max-w-[210mm] items-center justify-between px-4">
        <p className="text-xs font-semibold text-stone-500">Nome do arquivo: <strong className="text-stone-800">{fileName}</strong></p>
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-[#0E191D] px-4 py-3 text-sm font-bold text-white shadow-lg">
          <Printer size={16} /> Gerar / salvar PDF
        </button>
      </div>

      <article className="order-sheet mx-auto min-h-[297mm] w-full max-w-[210mm] bg-white px-[14mm] py-[12mm] text-[#111715] shadow-xl print:min-h-0 print:shadow-none">
        <header className="grid grid-cols-[1.25fr_.75fr] items-start gap-8 border-b-2 border-[#0E191D] pb-6">
          <div>
            <Image
              src="/brand/logo/bispo-logo-official-transparent.png"
              alt="Bispo Coffees"
              width={860}
              height={240}
              priority
              className="h-auto w-[230px] object-contain"
            />
            <div className="mt-4">
              <p className="text-[11px] font-black uppercase tracking-[.18em] text-[#087568]">Bispo Coffees</p>
              <p className="mt-1 text-[10px] font-medium text-stone-500">Sourcing Brazilian Coffees for the World.</p>
              <h1 className="mt-4 text-xl font-bold tracking-tight">{provisional ? "Proposta Comercial Provisória" : "Confirmação de Pedido"}</h1>
              <p className="mt-1 text-[10px] text-stone-500">Documento comercial para conferência do cliente</p>
            </div>
          </div>
          <div className="rounded-2xl bg-[#F6F7F4] p-5 text-right">
            <p className="text-[9px] font-extrabold uppercase tracking-[.16em] text-stone-400">Pedido</p>
            <p className="mt-1 text-[26px] font-black tracking-tight text-[#0E191D]">{businessNumber}</p>
            <p className="mt-2 text-[10px] text-stone-500">Emitido em {date.format(new Date(order.orderedAt))}</p>
            <span className={`mt-4 inline-flex rounded-full px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-wide ${provisional ? "bg-amber-100 text-amber-900" : "bg-[#EAF6F2] text-[#087568]"}`}>{provisional ? "Provisório" : (statusLabel[order.status] ?? order.status)}</span>
          </div>
        </header>

        {provisional && (
          <section className="mt-5 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-amber-950">
            <p className="text-[10px] font-black uppercase tracking-[.14em]">Documento provisório — aguardando confirmação do cliente</p>
            <p className="mt-1 text-[10px] leading-4">Esta proposta serve somente para conferência. Não confirma a venda, não reserva estoque, não gera cobrança e não constitui documento fiscal.</p>
          </section>
        )}

        <section className="mt-6 grid grid-cols-2 gap-4">
          <Block title="Cliente / faturamento">
            <Value label="Cliente" value={customer?.name ?? order.customer.name} strong />
            <Value label="Razão social" value={customer?.legalName || "—"} />
            <Value label="Nome fantasia" value={customer?.tradeName || "—"} />
            <div className="grid grid-cols-2 gap-3"><Value label="CPF / CNPJ" value={customer?.taxId || "—"} /><Value label="Segmento" value={customer?.segment || "—"} /></div>
          </Block>
          <Block title="Contato / entrega">
            <div className="grid grid-cols-2 gap-3"><Value label="Telefone" value={customer?.phone || "—"} /><Value label="E-mail" value={customer?.email || "—"} /></div>
            <Value label="Endereço cadastrado" value={address} />
            <Value label="Referência / PO" value={order.customerReference || "—"} />
          </Block>
        </section>

        <section className="mt-5 overflow-hidden rounded-2xl border border-stone-200">
          <div className="grid grid-cols-[1fr_60px_110px_120px] bg-[#F6F7F4] px-4 py-3 text-[9px] font-extrabold uppercase tracking-[.12em] text-stone-500">
            <span>Produto / SKU</span><span className="text-center">Qtd.</span><span className="text-right">Preço unit.</span><span className="text-right">Total</span>
          </div>
          {order.items.map((item) => (
            <div key={item.id} className="grid grid-cols-[1fr_60px_110px_120px] items-center border-t border-stone-100 px-4 py-4 text-xs">
              <div><p className="font-bold">{item.productName}</p><p className="mt-1 text-[10px] text-stone-400">{item.sku}</p></div>
              <span className="text-center">{item.quantity}</span>
              <span className="text-right">{money.format(Number(item.unitPrice ?? 0))}</span>
              <strong className="text-right">{money.format(Number(item.totalAmount))}</strong>
            </div>
          ))}
        </section>

        <section className="mt-5 grid grid-cols-[1.2fr_.8fr] gap-4">
          <Block title="Condições comerciais">
            <div className="grid grid-cols-2 gap-3">
              <Value label="Pagamento" value={payment} strong />
              <Value label="Frete" value={freightLabel[order.freightResponsibility ?? ""] ?? "A combinar"} strong />
              <Value label="Entrega prevista" value={delivery} />
              <Value label="Transportadora" value={order.carrierName || "A definir"} />
              {order.incoterm && <Value label="Incoterm" value={`${order.incoterm}${order.incotermLocation ? ` · ${order.incotermLocation}` : ""}`} />}
            </div>
          </Block>

          <div className="rounded-2xl bg-[#0E191D] p-5 text-white">
            <p className="text-[9px] font-bold uppercase tracking-[.14em] text-stone-400">Resumo financeiro</p>
            <div className="mt-4 space-y-2 text-xs">
              <MoneyLine label="Subtotal" value={Number(order.subtotal ?? order.totalAmount)} />
              {Number(order.discount ?? 0) > 0 && <MoneyLine label="Desconto" value={-Number(order.discount)} />}
              {Number(order.freight ?? 0) > 0 && <MoneyLine label="Frete" value={Number(order.freight)} />}
            </div>
            <div className="mt-4 border-t border-white/20 pt-4">
              <p className="text-[10px] text-stone-400">Total do pedido</p>
              <p className="mt-1 text-2xl font-bold">{money.format(Number(order.totalAmount))}</p>
            </div>
          </div>
        </section>

        {order.notes && (
          <section className="mt-5 rounded-2xl border border-stone-200 p-4">
            <p className="text-[9px] font-extrabold uppercase tracking-[.12em] text-stone-400">Observações comerciais</p>
            <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-stone-700">{order.notes}</p>
          </section>
        )}

        <section className="mt-7 rounded-2xl border border-stone-200 p-5">
          <p className="text-[9px] font-extrabold uppercase tracking-[.14em] text-[#087568]">Conferência do cliente</p>
          <p className="mt-2 text-[10px] leading-4 text-stone-500">Ao conferir este documento, o cliente valida produtos, quantidades, valores e condições comerciais apresentadas.</p>
          <div className="mt-6 grid grid-cols-2 gap-8">
            <div><div className="border-b border-stone-300"/><p className="mt-2 text-[10px] text-stone-500">Nome / assinatura ou aceite eletrônico</p></div>
            <div><div className="border-b border-stone-300"/><p className="mt-2 text-[10px] text-stone-500">Data da conferência</p></div>
          </div>
        </section>

        <footer className="mt-8 grid grid-cols-[1fr_auto] items-end gap-6 border-t border-stone-100 pt-4 text-[9px] text-stone-400">
          <div>
            <p className="font-bold text-stone-600">Bispo Coffees</p>
            <p className="mt-1">Sourcing Brazilian Coffees for the World.</p>
          </div>
          <div className="text-right">
            <p>{provisional ? "Documento comercial provisório" : "Documento comercial"} · {businessNumber}</p>
            <p className="mt-1 font-semibold text-stone-600">Arquivo: {fileName}</p>
          </div>
        </footer>
      </article>

      <style jsx global>{`
        @page { size: A4; margin: 0; }
        @media print {
          html, body { background: #fff !important; }
          .screen-only { display: none !important; }
          .order-sheet { width: 210mm !important; max-width: 210mm !important; margin: 0 !important; }
          body > button, body > div[style*="position: fixed"] { display: none !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </main>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-stone-200 p-4"><p className="mb-3 text-[9px] font-extrabold uppercase tracking-[.12em] text-stone-400">{title}</p><div className="space-y-3">{children}</div></div>;
}
function Value({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div><p className="text-[9px] uppercase tracking-wide text-stone-400">{label}</p><p className={`mt-1 text-xs ${strong ? "font-bold" : "font-medium"}`}>{value}</p></div>;
}
function MoneyLine({ label, value }: { label: string; value: number }) {
  return <div className="flex items-center justify-between"><span className="text-stone-400">{label}</span><span>{money.format(value)}</span></div>;
}
