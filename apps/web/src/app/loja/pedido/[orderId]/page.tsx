"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Check, Circle, Coffee, PackageCheck, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import styles from "./tracking.module.css";

type OrderStatus = {
  id: string;
  code: string;
  status: string;
  carrierName?: string | null;
  shippingServiceName?: string | null;
  estimatedDeliveryDays?: number | null;
  events: Array<{ eventType: string; title: string; detail?: string; occurredAt: string }>;
  shipment?: { trackingCode?: string; trackingUrl?: string; carrierName?: string; serviceName?: string } | null;
};

export default function StorefrontOrderTrackingPage() {
  const params = useParams<{ orderId: string }>();
  const search = useSearchParams();
  const token = search.get("token") || "";
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!params.orderId || !token) {
      setError("O link de acompanhamento está incompleto.");
      return;
    }
    const load = async () => {
      const response = await fetch(`/api/storefront/orders/${encodeURIComponent(params.orderId)}/status`, {
        headers: { "x-storefront-order-token": token },
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "Não foi possível consultar o pedido.");
      setOrder(body);
    };
    void load().catch((reason) => setError(reason.message));
    const timer = window.setInterval(() => void load().catch(() => undefined), 30000);
    return () => window.clearInterval(timer);
  }, [params.orderId, token]);

  return (
    <main className={styles.page}>
      <header>
        <Link href="/loja">BISPO <small>True Coffee</small></Link>
        <span>ACOMPANHAMENTO DO PEDIDO</span>
      </header>
      <section className={styles.hero}>
        <Coffee />
        <p>Seu café, acompanhado em cada etapa.</p>
        <h1>{order?.code || "Pedido Bispo"}</h1>
        {order && <small>{order.carrierName} · {order.shippingServiceName} · previsão de até {order.estimatedDeliveryDays} dias úteis após a postagem</small>}
      </section>
      {error && <p className={styles.error}>{error}</p>}
      {!order && !error && <p className={styles.loading}>Consultando seu pedido…</p>}
      {order && (
        <section className={styles.timeline}>
          {order.events.map((event, index) => (
            <article key={`${event.eventType}-${event.occurredAt}`}>
              <span>{index === order.events.length - 1 ? <PackageCheck /> : <Check />}</span>
              <div>
                <time>{new Date(event.occurredAt).toLocaleString("pt-BR")}</time>
                <h2>{event.title}</h2>
                {event.detail && <p>{event.detail}</p>}
              </div>
            </article>
          ))}
          {!order.events.some((event) => event.eventType === "DELIVERED") && (
            <article className={styles.pending}>
              <span><Circle /></span>
              <div><h2>Próxima atualização</h2><p>Esta página será atualizada automaticamente quando o pedido avançar.</p></div>
            </article>
          )}
          {order.shipment?.trackingCode && (
            <aside>
              <Truck />
              <div><small>CÓDIGO DE RASTREAMENTO</small><strong>{order.shipment.trackingCode}</strong></div>
              {order.shipment.trackingUrl && <a href={order.shipment.trackingUrl} target="_blank" rel="noreferrer">Acompanhar na transportadora</a>}
            </aside>
          )}
        </section>
      )}
    </main>
  );
}
