"use client";

import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Check, Circle, ExternalLink, PackageCheck, Truck } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-url";

type Event = { eventType: string; title: string; detail: string; occurredAt: string };
type Tracking = {
  orderNumber: string;
  status: string;
  totalAmount: string | number;
  customerName: string;
  events: Event[];
  shipment?: { carrierName?: string | null; serviceName?: string | null; trackingCode?: string | null; trackingUrl?: string | null } | null;
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const stages = [
  { label: "Confirmado", events: ["ORDER_CONFIRMED"] },
  { label: "Em preparo", events: ["PREPARING"] },
  { label: "NF emitida", events: ["INVOICE_AUTHORIZED", "SHIPMENT_CREATED"] },
  { label: "A caminho", events: ["SHIPPED", "OUT_FOR_DELIVERY"] },
  { label: "Entregue", events: ["DELIVERED"] },
];

export default function AssistedOrderTrackingPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = typeof params?.orderId === "string" ? params.orderId : "";
  const [data, setData] = useState<Tracking | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!orderId) return;
    const token = new URLSearchParams(window.location.search).get("token") || "";
    void fetch(`${getApiBaseUrl()}/sales-order-approvals/public/tracking/${orderId}?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || "Não foi possível abrir o acompanhamento.");
        setData(payload);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Não foi possível abrir o acompanhamento."))
      .finally(() => setBusy(false));
  }, [orderId]);

  const currentStage = useMemo(() => {
    if (!data) return 0;
    return data.events.reduce((highest, event) => {
      const index = stages.findIndex((stage) => stage.events.includes(event.eventType));
      return Math.max(highest, index);
    }, 0);
  }, [data]);

  return <main className="min-h-screen bg-[#F5F3EE] px-4 py-6 sm:py-10"><div className="mx-auto max-w-xl">
    <div className="mb-6 flex justify-center"><Image src="/brand/logo/bispo-logo-official-transparent.png" alt="Bispo Coffees" width={170} height={64} priority className="h-auto w-[150px]" /></div>
    {busy && <Card><p className="text-sm text-stone-500">Carregando o acompanhamento…</p></Card>}
    {!busy && error && <Card><h1 className="text-lg font-bold">Acompanhamento indisponível</h1><p className="mt-2 text-sm text-red-700">{error}</p></Card>}
    {data && <>
      <header className="rounded-3xl bg-stone-950 p-6 text-white">
        <p className="text-[10px] font-bold uppercase tracking-[.2em] text-stone-400">Acompanhamento do pedido</p>
        <h1 className="mt-2 text-2xl font-bold">{data.orderNumber}</h1>
        <p className="mt-1 text-sm text-stone-300">{data.customerName}</p>
        <p className="mt-5 border-t border-white/15 pt-4 text-2xl font-bold">{money.format(Number(data.totalAmount || 0))}</p>
      </header>

      <section className="mt-3 rounded-3xl border bg-white p-5 shadow-sm">
        <div className="grid grid-cols-5 gap-1">
          {stages.map((stage, index) => <div key={stage.label} className="text-center">
            <div className={`mx-auto grid size-7 place-items-center rounded-full border ${index <= currentStage ? "border-emerald-800 bg-emerald-800 text-white" : "border-stone-300 text-stone-300"}`}>{index < currentStage ? <Check size={13}/> : <Circle size={9}/>}</div>
            <p className={`mt-2 text-[8px] font-bold uppercase leading-3 ${index <= currentStage ? "text-emerald-900" : "text-stone-400"}`}>{stage.label}</p>
          </div>)}
        </div>
      </section>

      {data.shipment && <section className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
        <div className="flex gap-3"><Truck size={19} className="mt-0.5 text-emerald-800"/><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-wider text-emerald-700">Transporte</p><p className="mt-1 text-sm font-semibold text-emerald-950">{[data.shipment.carrierName, data.shipment.serviceName].filter(Boolean).join(" · ") || "Envio Bispo"}</p>{data.shipment.trackingCode && <p className="mt-1 text-xs text-emerald-800">Rastreio: {data.shipment.trackingCode}</p>}{data.shipment.trackingUrl && <a href={data.shipment.trackingUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-900 underline">Abrir rastreamento <ExternalLink size={12}/></a>}</div></div>
      </section>}

      <section className="mt-3 rounded-3xl border bg-white p-5">
        <div className="flex items-center gap-2"><PackageCheck size={18} className="text-stone-700"/><h2 className="text-sm font-bold">Jornada do pedido</h2></div>
        <div className="mt-4 space-y-4">{data.events.map((event, index) => <div key={`${event.eventType}-${event.occurredAt}`} className="grid grid-cols-[12px_1fr] gap-3"><div className="flex flex-col items-center"><span className="mt-1 size-2.5 rounded-full bg-emerald-700"/>{index < data.events.length - 1 && <span className="mt-1 h-full w-px bg-stone-200"/>}</div><div className="pb-2"><p className="text-sm font-bold">{event.title}</p><p className="mt-1 text-xs leading-5 text-stone-500">{event.detail}</p><p className="mt-1 text-[9px] text-stone-400">{new Date(event.occurredAt).toLocaleString("pt-BR")}</p></div></div>)}</div>
      </section>
    </>}
    <p className="py-6 text-center text-[10px] text-stone-400">Acompanhamento seguro · Bispo Coffees</p>
  </div></main>;
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-3xl border bg-white p-6 shadow-sm">{children}</section>;
}
