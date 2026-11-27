"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, X } from "lucide-react";
import { SignaPixButton } from "@/components/signa-pix-dialog";
import { SignaDirectShipment } from "@/components/signa-direct-shipment";

export type PanelOrder = {
  id: string; code: string; status: string; totalAmount: number | string; orderedAt: string;
  customerName: string; billingRecipientName?: string | null; endCustomerName?: string | null;
  volumeKg?: number | string | null; receivableStatus?: string | null; openAmount?: number | string | null;
  dueDate?: string | null; paymentDate?: string | null; invoiceStatus?: string | null;
  invoicePdfAvailable?: boolean; invoiceNumber?: string | null; billingAvailable?: boolean; pixAvailable?: boolean;
};
type Detail = {
  order: { customerReference?: string | null; expectedDeliveryDate?: string | null } | null;
  items: Array<{ id: string; sku: string; product: string; line?: string | null; grams?: number | null; quantity: number; unitPrice: number; totalAmount: number }>;
};
type TimelineEvent = { id: string; title: string; detail: string; occurredAt: string };

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const STEPS = [
  { key: 1, label: "Recebido" }, { key: 2, label: "Aprovado" }, { key: 3, label: "Produção" },
  { key: 4, label: "Preparação" }, { key: 5, label: "Faturado" }, { key: 6, label: "Entregue" },
];
export const ORDER_STEP: Record<string, number> = { DRAFT: 1, CONFIRMED: 2, RESERVED: 2, IN_PRODUCTION: 3, PICKING: 4, READY_TO_SHIP: 4, INVOICED: 5, SHIPPED: 5, DELIVERED: 6 };

export function paymentLabel(status?: string | null) {
  return status === "PAID" ? "Pago" : status === "PARTIALLY_PAID" ? "Parcialmente pago" : status === "OVERDUE" ? "Vencido" : status === "OPEN" ? "Em aberto" : "Aguardando faturamento";
}

/** Side panel ("object page") with the full picture of one order. Only the direct-shipment block is editable. */
export function SignaOrderPanel({ order, stageLabel, events, onClose }: { order: PanelOrder; stageLabel: string; events: TimelineEvent[]; onClose: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setDetail(null); setError("");
    fetch(`/api/partner-portal/orders/${encodeURIComponent(order.id)}/detail`, { credentials: "include", cache: "no-store", signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then((body) => { if (!controller.signal.aborted) setDetail(body as Detail); })
      .catch(() => { if (!controller.signal.aborted) setError("Não foi possível carregar os itens agora."); });
    return () => controller.abort();
  }, [order.id]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const step = ORDER_STEP[order.status] ?? 1;
  const cancelled = order.status === "CANCELLED";
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/25" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside role="dialog" aria-modal="true" aria-labelledby="order-panel-title" className="flex h-full w-full max-w-[30rem] flex-col bg-white shadow-2xl motion-safe:animate-[slideIn_.22s_ease]">
        <div className="flex items-start justify-between gap-3 border-b border-[#ececE7] px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-[#6b6b66]">Pedido</p>
            <h2 id="order-panel-title" className="font-display text-xl font-semibold text-[#0A0A0A]">{order.code}</h2>
            <p className="mt-0.5 text-xs text-[#6b6b66]">{new Date(order.orderedAt).toLocaleDateString("pt-BR", { dateStyle: "long" })}</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Fechar detalhes" className="grid size-10 place-items-center rounded-lg hover:bg-[#f4f4f1]"><X size={18} aria-hidden /></button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <dl className="grid grid-cols-3 divide-x divide-[#ececE7] rounded-xl border border-[#ececE7] text-sm">
            <div className="px-3 py-2.5"><dt className="text-[11px] text-[#6b6b66]">Situação</dt><dd className="mt-0.5 font-semibold">{stageLabel}</dd></div>
            <div className="px-3 py-2.5"><dt className="text-[11px] text-[#6b6b66]">Valor</dt><dd className="mt-0.5 font-semibold tabular-nums">{currency.format(Number(order.totalAmount || 0))}</dd></div>
            <div className="px-3 py-2.5"><dt className="text-[11px] text-[#6b6b66]">Pagamento</dt><dd className="mt-0.5 font-semibold">{paymentLabel(order.receivableStatus)}</dd></div>
          </dl>

          {!cancelled && <ol className="grid grid-cols-6 gap-1" aria-label={`Etapa ${step} de 6: ${stageLabel}`}>
            {STEPS.map((item) => (
              <li key={item.key} className="text-center">
                <span className={`block h-1.5 rounded-full ${item.key <= step ? "bg-[#25734c]" : "bg-[#e6e6e1]"}`} />
                <span className={`mt-1.5 block text-[10px] ${item.key === step ? "font-semibold text-[#0A0A0A]" : "text-[#8a8a84]"}`}>{item.label}</span>
              </li>
            ))}
          </ol>}

          <section aria-label="Cliente e faturamento" className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-[11px] text-[#6b6b66]">Cliente atendido</p><p className="font-medium">{order.endCustomerName || "Não informado"}</p></div>
            <div><p className="text-[11px] text-[#6b6b66]">Faturar para</p><p className="font-medium">{order.billingRecipientName || order.customerName}</p></div>
            {detail?.order?.expectedDeliveryDate && <div><p className="text-[11px] text-[#6b6b66]">Data desejada</p><p className="font-medium">{new Date(detail.order.expectedDeliveryDate).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</p></div>}
            {detail?.order?.customerReference && <div><p className="text-[11px] text-[#6b6b66]">Sua referência</p><p className="font-medium">{detail.order.customerReference}</p></div>}
          </section>

          <section aria-label="Itens do pedido">
            <h3 className="mb-2 font-display text-sm font-semibold">Itens</h3>
            {error && <p className="text-sm text-red-700">{error}</p>}
            {!detail && !error && <div className="space-y-2" aria-hidden>{[0, 1].map((n) => <div key={n} className="h-10 animate-pulse rounded-lg bg-[#f1f1ee]" />)}</div>}
            {detail && <table className="w-full text-sm">
              <thead><tr className="border-b border-[#ececE7] text-left text-[11px] text-[#6b6b66]"><th className="py-1.5 font-medium">Produto</th><th className="py-1.5 text-right font-medium">Qtd.</th><th className="py-1.5 text-right font-medium">Total</th></tr></thead>
              <tbody className="divide-y divide-[#f1f1ee]">
                {detail.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2"><span className="font-medium">{item.product}{item.grams ? ` · ${item.grams >= 1000 ? `${item.grams / 1000} kg` : `${item.grams} g`}` : ""}</span><span className="block text-[11px] text-[#8a8a84]">{item.sku} · {currency.format(item.unitPrice)} un.</span></td>
                    <td className="py-2 text-right tabular-nums">{item.quantity}</td>
                    <td className="py-2 text-right tabular-nums">{currency.format(item.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>}
          </section>

          <section aria-label="Documentos e pagamento" className="space-y-2">
            <h3 className="font-display text-sm font-semibold">Documentos e pagamento</h3>
            <div className="flex flex-wrap gap-2">
              {order.invoiceStatus === "AUTHORIZED" && order.invoicePdfAvailable
                ? <a href={`/api/partner-portal/orders/${order.id}/invoice/pdf`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#e2e2dd] px-3 text-sm font-medium hover:bg-[#f7f7f4]"><FileText size={16} aria-hidden /> Nota fiscal{order.invoiceNumber ? ` ${order.invoiceNumber}` : ""}</a>
                : <span className="text-sm text-[#6b6b66]">Nota fiscal ainda não emitida.</span>}
              {order.billingAvailable && <a href={`/api/partner-portal/orders/${order.id}/billing/pdf`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#e2e2dd] px-3 text-sm font-medium hover:bg-[#f7f7f4]"><FileText size={16} aria-hidden /> Cobrança</a>}
            </div>
            {order.pixAvailable && <SignaPixButton orderId={order.id} orderCode={order.code} />}
          </section>

          <SignaDirectShipment orderId={order.id} orderStatus={order.status} />

          <section aria-label="Linha do tempo">
            <h3 className="mb-2 font-display text-sm font-semibold">Linha do tempo</h3>
            <ol className="space-y-3 border-l-2 border-[#d9e6dd] pl-4">
              <li className="text-sm"><span className="font-medium">Pedido registrado</span><time className="block text-xs text-[#6b6b66]">{new Date(order.orderedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</time></li>
              {events.map((event) => (
                <li key={event.id} className="text-sm"><span className="font-medium">{event.title}</span><time className="block text-xs text-[#6b6b66]">{new Date(event.occurredAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</time>{event.detail && <p className="text-xs text-[#55554f]">{event.detail}</p>}</li>
              ))}
            </ol>
          </section>
        </div>
      </aside>
    </div>
  );
}
