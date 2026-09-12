"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
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
  totalAmount: number;
  paymentType?: string | null;
  paymentTerms?: string | null;
  freightResponsibility?: string | null;
  carrierName?: string | null;
  expectedDeliveryDate?: string | null;
  customerReference?: string | null;
  incoterm?: string | null;
  incotermLocation?: string | null;
  notes?: string | null;
  items: Array<{
    productName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
  }>;
};

type Approval = {
  id: string;
  status: string;
  expiresAt: string;
  acceptedByName?: string | null;
  acceptedAt?: string | null;
  snapshot: Snapshot;
};

export default function PublicOrderApprovalPage({ params }: { params: { token: string } }) {
  const token = params.token;
  const [approval, setApproval] = useState<Approval | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const api = `${getApiBaseUrl()}/sales-order-approvals/public/${token}`;

  const load = async () => {
    setBusy(true);
    setError("");
    const response = await fetch(api, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) setError(payload.message ?? "Este pedido não está disponível para aprovação.");
    else setApproval(payload);
    setBusy(false);
  };

  useEffect(() => { void load(); }, [token]);

  const paymentLabel = useMemo(() => {
    const snapshot = approval?.snapshot;
    if (!snapshot) return "—";
    return snapshot.paymentType === "TERM" ? (snapshot.paymentTerms || "A prazo") : "À vista";
  }, [approval]);

  const approve = async () => {
    if (!name.trim()) return setError("Informe seu nome para registrar a aprovação.");
    setSending(true);
    setError("");
    const response = await fetch(`${api}/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, email, note }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) setError(payload.message ?? "Não foi possível registrar a aprovação.");
    else await load();
    setSending(false);
  };

  if (busy) {
    return <main className="min-h-screen bg-[#F5F5F2] px-5 py-12"><div className="mx-auto max-w-3xl rounded-3xl bg-white p-8 text-sm text-stone-500">Carregando pedido…</div></main>;
  }

  if (!approval) {
    return <main className="min-h-screen bg-[#F5F5F2] px-5 py-12"><div className="mx-auto max-w-3xl rounded-3xl bg-white p-8"><h1 className="text-xl font-bold">Pedido indisponível</h1><p className="mt-3 text-sm text-stone-500">{error}</p></div></main>;
  }

  const order = approval.snapshot;
  const approved = approval.status === "APPROVED";
  const delivery = order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toLocaleDateString("pt-BR") : "A combinar";
  const expires = new Date(approval.expiresAt).toLocaleDateString("pt-BR");

  return (
    <main className="min-h-screen bg-[#F5F5F2] px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <header className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-violet-700">Bispo Coffees</p>
            <h1 className="mt-1 text-3xl font-bold text-stone-950">Pedido {order.orderNumber}</h1>
            <p className="mt-1 text-sm text-stone-500">Preparado para {order.customerName}</p>
          </div>
          <div className="rounded-full border bg-white px-3 py-1.5 text-[10px] font-semibold text-stone-500">Válido até {expires}</div>
        </header>

        <section className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
          <div className="grid grid-cols-[1fr_58px_100px_108px] gap-2 border-b bg-stone-50 px-4 py-3 text-[9px] font-bold uppercase tracking-wider text-stone-400">
            <span>Produto</span><span>Qtd.</span><span>Preço</span><span className="text-right">Total</span>
          </div>
          {order.items.map((item) => (
            <div key={`${item.sku}-${item.productName}`} className="grid grid-cols-[1fr_58px_100px_108px] items-center gap-2 border-b px-4 py-4 text-xs last:border-b-0">
              <div><strong className="block text-stone-900">{item.productName}</strong><span className="text-[10px] text-stone-400">{item.sku}</span></div>
              <span>{item.quantity}</span>
              <span>{money.format(item.unitPrice)}</span>
              <strong className="text-right">{money.format(item.totalAmount)}</strong>
            </div>
          ))}
        </section>

        <section className="mt-4 grid gap-3 sm:grid-cols-2">
          <Term label="Pagamento" value={paymentLabel} />
          <Term label="Frete" value={freightLabels[order.freightResponsibility ?? ""] ?? "A combinar"} />
          <Term label="Entrega prevista" value={delivery} />
          {order.carrierName && <Term label="Transportadora" value={order.carrierName} />}
          {order.customerReference && <Term label="Referência" value={order.customerReference} />}
          {order.incoterm && <Term label="Incoterm" value={`${order.incoterm}${order.incotermLocation ? ` · ${order.incotermLocation}` : ""}`} />}
        </section>

        {order.notes && <section className="mt-4 rounded-2xl bg-white p-4"><p className="text-[9px] font-bold uppercase tracking-wider text-stone-400">Observações</p><p className="mt-1 text-sm leading-6 text-stone-700">{order.notes}</p></section>}

        <section className="mt-4 flex items-end justify-between rounded-3xl bg-stone-950 px-5 py-5 text-white">
          <div><p className="text-[10px] uppercase tracking-wider text-stone-400">Total do pedido</p><p className="mt-1 text-xs text-stone-300">Valores e condições desta versão</p></div>
          <strong className="text-2xl sm:text-3xl">{money.format(order.totalAmount)}</strong>
        </section>

        {approved ? (
          <section className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <CheckCircle2 className="mx-auto text-emerald-700" size={32} />
            <h2 className="mt-3 text-lg font-bold text-emerald-950">Pedido aprovado</h2>
            <p className="mt-1 text-sm text-emerald-800">Aprovado por {approval.acceptedByName}{approval.acceptedAt ? ` em ${new Date(approval.acceptedAt).toLocaleString("pt-BR")}` : ""}.</p>
          </section>
        ) : (
          <section className="mt-5 rounded-3xl border bg-white p-5 sm:p-6">
            <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 text-violet-700" size={18}/><div><h2 className="text-base font-bold">Aprovar este pedido</h2><p className="mt-1 text-xs leading-5 text-stone-500">Seu aceite registra esta versão exata do pedido. Alterações futuras exigem um novo link de aprovação.</p></div></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold">Nome de quem aprova<input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3 text-sm" placeholder="Nome completo" /></label>
              <label className="text-xs font-semibold">E-mail <span className="font-normal text-stone-400">(opcional)</span><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" className="mt-2 w-full rounded-xl border px-3 py-3 text-sm" placeholder="email@empresa.com" /></label>
            </div>
            <label className="mt-3 block text-xs font-semibold">Observação <span className="font-normal text-stone-400">(opcional)</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} className="mt-2 w-full rounded-xl border px-3 py-3 text-sm" placeholder="Se necessário, deixe uma observação..." /></label>
            {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
            <button disabled={sending} onClick={() => void approve()} className="mt-4 w-full rounded-xl bg-stone-950 py-3.5 text-sm font-bold text-white disabled:opacity-50">{sending ? "Registrando aprovação…" : "Aprovar pedido"}</button>
          </section>
        )}
      </div>
    </main>
  );
}

function Term({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-white p-4"><p className="text-[9px] font-bold uppercase tracking-wider text-stone-400">{label}</p><p className="mt-1 text-sm font-semibold text-stone-900">{value}</p></div>;
}
