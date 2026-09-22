"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, ShieldCheck, Truck } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-url";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const freightLabels: Record<string, string> = {
  BISPO: "Por conta da Bispo",
  CUSTOMER: "Por conta do cliente",
  PICKUP: "Retirada na fábrica",
};

type Snapshot = {
  orderNumber: string;
  customerName: string;
  subtotal: number;
  discount: number;
  freight: number;
  totalAmount: number;
  paymentType?: string | null;
  paymentTerms?: string | null;
  freightResponsibility?: string | null;
  carrierName?: string | null;
  shippingServiceName?: string | null;
  estimatedDeliveryDays?: number | null;
  expectedDeliveryDate?: string | null;
  customerReference?: string | null;
  notes?: string | null;
  items: Array<{ productName: string; sku: string; quantity: number; unitPrice: number; totalAmount: number }>;
};

type Approval = {
  id: string;
  status: string;
  expiresAt: string;
  acceptedByName?: string | null;
  acceptedAt?: string | null;
  verificationRequired: boolean;
  termsText: string;
  snapshot: Snapshot;
};

export default function PublicOrderApprovalPage() {
  const params = useParams<{ token: string }>();
  const token = typeof params?.token === "string" ? params.token : "";
  const [approval, setApproval] = useState<Approval | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const api = `${getApiBaseUrl()}/sales-order-approvals/public/${token}`;

  const load = async () => {
    if (!token) return;
    setBusy(true);
    setError("");
    const response = await fetch(api, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) setError(payload.message ?? "Este pedido não está disponível para confirmação.");
    else {
      setApproval(payload);
      setName((current) => current || payload.snapshot?.customerName || "");
    }
    setBusy(false);
  };

  useEffect(() => { void load(); }, [token]);

  const paymentLabel = useMemo(() => {
    if (!approval) return "—";
    return approval.snapshot.paymentType === "TERM" ? (approval.snapshot.paymentTerms || "A prazo") : "À vista";
  }, [approval]);

  const approve = async () => {
    if (!name.trim()) return setError("Confirme o nome de quem está aprovando.");
    if (approval?.verificationRequired && !/^\d{6}$/.test(code)) return setError("Digite o código de seis dígitos recebido no WhatsApp.");
    setSending(true);
    setError("");
    const response = await fetch(`${api}/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, code }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) setError(payload.message ?? "Não foi possível confirmar o pedido.");
    else await load();
    setSending(false);
  };

  if (busy) return <Shell><div className="rounded-3xl bg-white p-8 text-sm text-stone-500">Carregando seu pedido…</div></Shell>;
  if (!approval) return <Shell><div className="rounded-3xl bg-white p-8"><h1 className="text-xl font-bold">Pedido indisponível</h1><p className="mt-3 text-sm text-stone-500">{error}</p></div></Shell>;

  const order = approval.snapshot;
  const approved = approval.status === "APPROVED";
  const expires = new Date(approval.expiresAt).toLocaleDateString("pt-BR");
  const delivery = order.expectedDeliveryDate
    ? new Date(order.expectedDeliveryDate).toLocaleDateString("pt-BR")
    : order.estimatedDeliveryDays
      ? `Até ${order.estimatedDeliveryDays} dias úteis`
      : "A combinar";
  const freightService = [order.carrierName, order.shippingServiceName].filter(Boolean).join(" · ");

  return (
    <Shell>
      <header className="mb-4 flex items-end justify-between gap-3">
        <div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#76604e]">Confirmação do cliente</p><h1 className="mt-1 text-2xl font-bold text-stone-950">Pedido {order.orderNumber}</h1><p className="mt-1 text-sm text-stone-500">Preparado para <strong className="text-stone-700">{order.customerName}</strong></p></div>
        <span className="shrink-0 rounded-full border bg-white px-3 py-1.5 text-[10px] font-semibold text-stone-500">Até {expires}</span>
      </header>

      <section className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
        {order.items.map((item) => (
          <div key={`${item.sku}-${item.productName}`} className="grid grid-cols-[1fr_auto] gap-3 border-b px-4 py-3 last:border-b-0">
            <div><strong className="block text-sm text-stone-900">{item.productName}</strong><span className="text-[10px] text-stone-400">{item.quantity} un. · {item.sku} · {money.format(item.unitPrice)}/un.</span></div>
            <strong className="self-center text-sm">{money.format(item.totalAmount)}</strong>
          </div>
        ))}
      </section>

      <section className="mt-3 rounded-2xl border bg-white p-4">
        <div className="flex items-start gap-3"><Truck size={18} className="mt-0.5 text-emerald-800"/><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Entrega e frete</p><p className="mt-1 text-sm font-semibold">{freightService || freightLabels[order.freightResponsibility ?? ""] || "A combinar"}</p><p className="mt-0.5 text-xs text-stone-500">{delivery} · {freightLabels[order.freightResponsibility ?? ""] || "Condição a combinar"}</p></div></div>
      </section>

      <section className="mt-3 rounded-3xl bg-stone-950 p-5 text-white">
        <MoneyLine label="Produtos" value={order.subtotal} />
        {order.discount > 0 && <MoneyLine label="Desconto" value={-order.discount} />}
        <MoneyLine label="Frete" value={order.freight} />
        <div className="mt-3 flex items-end justify-between border-t border-white/20 pt-4"><div><p className="text-[10px] uppercase tracking-wider text-stone-400">Total do pedido</p><p className="mt-1 text-xs text-stone-300">{paymentLabel}</p></div><strong className="text-2xl">{money.format(order.totalAmount)}</strong></div>
      </section>

      {order.notes && <section className="mt-3 rounded-2xl bg-white p-4"><p className="text-[9px] font-bold uppercase tracking-wider text-stone-400">Observações</p><p className="mt-1 text-sm leading-6 text-stone-700">{order.notes}</p></section>}

      {approved ? (
        <section className="mt-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center"><CheckCircle2 className="mx-auto text-emerald-700" size={34}/><h2 className="mt-3 text-lg font-bold text-emerald-950">Pedido confirmado</h2><p className="mt-1 text-sm text-emerald-800">Confirmado por {approval.acceptedByName}{approval.acceptedAt ? ` em ${new Date(approval.acceptedAt).toLocaleString("pt-BR")}` : ""}.</p><p className="mt-2 text-xs text-emerald-700">A Bispo Coffees já recebeu sua confirmação.</p></section>
      ) : (
        <section className="mt-4 rounded-3xl border bg-white p-5">
          <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 text-violet-700" size={19}/><div><h2 className="text-base font-bold">Tudo certo com o pedido?</h2><p className="mt-1 text-xs leading-5 text-stone-500">Confira os itens, o frete e o total. A confirmação vale para esta versão exata.</p></div></div>
          <label className="mt-4 block text-xs font-semibold">Confirmado por<input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3 text-sm" /></label>
          {approval.verificationRequired && <label className="mt-3 block text-xs font-semibold">Código recebido no WhatsApp<input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" className="mt-2 w-full rounded-xl border px-3 py-3 text-center text-xl font-bold tracking-[.35em]" placeholder="000000" /></label>}
          <p className="mt-3 text-[10px] leading-4 text-stone-400">Ao tocar no botão, você declara que conferiu e concorda com produtos, quantidades, valores, frete, prazo e condições desta proposta.</p>
          {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          <button disabled={sending} onClick={() => void approve()} className="mt-4 w-full rounded-xl bg-stone-950 py-4 text-sm font-bold text-white disabled:opacity-50">{sending ? "Confirmando…" : "Confirmar meu pedido"}</button>
        </section>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return <main className="min-h-screen bg-[#F5F3EE] px-4 py-5 sm:py-8"><div className="mx-auto max-w-xl"><div className="mb-6 flex justify-center"><Image src="/brand/logo/bispo-logo-official-transparent.png" alt="Bispo Coffees" width={170} height={64} priority className="h-auto w-[150px]" /></div>{children}<p className="py-6 text-center text-[10px] text-stone-400">Ambiente seguro · Bispo Coffees</p></div></main>;
}

function MoneyLine({ label, value }: { label: string; value: number }) {
  return <div className="mb-2 flex justify-between text-xs text-stone-300"><span>{label}</span><span>{money.format(value)}</span></div>;
}
