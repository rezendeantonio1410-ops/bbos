"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function StorefrontRetryPaymentPage() {
  const params = useParams<{ orderId: string }>();
  const search = useSearchParams();
  const token = search.get("token") || "";
  const [message, setMessage] = useState("Preparando seu novo Pix…");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!params.orderId || !token) {
      setMessage("Este link de pagamento está incompleto.");
      setFailed(true);
      return;
    }
    const run = async () => {
      const response = await fetch(
        `/api/storefront/orders/${encodeURIComponent(params.orderId)}/retry-payment`,
        {
          method: "POST",
          headers: { "x-storefront-order-token": token },
          cache: "no-store",
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.message || "Não foi possível preparar o novo Pix.");
      if (body.status === "PAID") {
        window.location.assign(
          `/loja/pedido/${encodeURIComponent(params.orderId)}?token=${encodeURIComponent(token)}`,
        );
        return;
      }
      if (!body.checkoutUrl)
        throw new Error("O endereço seguro de pagamento não foi recebido.");
      setMessage("Pix preparado. Abrindo o ambiente seguro do Mercado Pago…");
      window.location.assign(body.checkoutUrl);
    };
    void run().catch((error) => {
      setMessage(error instanceof Error ? error.message : "Não foi possível preparar o novo Pix.");
      setFailed(true);
    });
  }, [params.orderId, token]);

  return (
    <main style={{ minHeight: "70vh", display: "grid", placeItems: "center", padding: 24, background: "#F1EEE8" }}>
      <section style={{ width: "min(560px,100%)", background: "#fff", padding: 36, borderRadius: 20, textAlign: "center" }}>
        <div style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>Bispo Coffees</div>
        <h1 style={{ margin: 0, fontFamily: "Georgia, serif", fontWeight: 400 }}>Pagamento do seu pedido</h1>
        <p style={{ margin: "18px 0 0", lineHeight: 1.6 }}>{message}</p>
        {failed && (
          <Link href="/loja" style={{ display: "inline-block", marginTop: 24, padding: "12px 18px", background: "#0A0A0A", color: "#fff", textDecoration: "none", borderRadius: 10 }}>
            Voltar à loja
          </Link>
        )}
      </section>
    </main>
  );
}
