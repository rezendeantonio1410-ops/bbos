"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, LoaderCircle, LockKeyhole } from "lucide-react";
import styles from "./checkout.module.css";

type CheckoutItem = {
  id: string;
  name: string;
  quantity: number;
  priceCents: number;
  grind?: string;
};
type CheckoutState = {
  items: CheckoutItem[];
  cep: string;
  subtotal: number;
  mode: "now" | "return";
  rhythm: number;
  couponCode?: string;
  discountCents?: number;
  quote: {
    id: string;
    name: string;
    serviceName: string;
    carrierName: string;
    priceCents: number;
    deliveryDays: number;
    expiresAt: string;
  };
};
type FormData = {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  postalCode: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
};

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value / 100,
  );
const digits = (value: string) => value.replace(/\D/g, "");
const phoneMask = (value: string) => {
  const raw = digits(value).slice(0, 11);
  if (raw.length <= 10)
    return raw.replace(
      /(\d{2})(\d{0,4})(\d{0,4})/,
      (_, a, b, c) => `(${a}${b ? `) ${b}` : ""}${c ? `-${c}` : ""}`,
    );
  return raw.replace(
    /(\d{2})(\d{0,5})(\d{0,4})/,
    (_, a, b, c) => `(${a}) ${b}${c ? `-${c}` : ""}`,
  );
};
const cpfMask = (value: string) =>
  digits(value)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
function validCpf(value: string) {
  const cpf = digits(value);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  for (let size = 9; size <= 10; size += 1) {
    let sum = 0;
    for (let index = 0; index < size; index += 1)
      sum += Number(cpf[index]) * (size + 1 - index);
    if (((sum * 10) % 11) % 10 !== Number(cpf[size])) return false;
  }
  return true;
}

export default function CheckoutPage() {
  const [checkout, setCheckout] = useState<CheckoutState | null>(null);
  const [data, setData] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    cpf: "",
    postalCode: "",
    street: "",
    number: "",
    complement: "",
    district: "",
    city: "",
    state: "",
  });
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"PIX" | "CARD">("PIX");
  const [order, setOrder] = useState<{
    id: string;
    code: string;
    status: string;
    confirmationToken?: string;
    checkoutUrl?: string;
  } | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("bispo-checkout-v1");
      if (stored) {
        const parsed = JSON.parse(stored) as CheckoutState;
        setCheckout(parsed);
        setData((current) => ({ ...current, postalCode: parsed.cep }));
      }
      const paymentOrder = sessionStorage.getItem("bispo-payment-order");
      if (paymentOrder) setOrder(JSON.parse(paymentOrder));
    } catch {}
  }, []);

  useEffect(() => {
    const cep = digits(data.postalCode);
    if (cep.length !== 8) return;
    const controller = new AbortController();
    setLoadingAddress(true);
    fetch(`/api/storefront/address/${cep}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.message);
        setData((current) => ({
          ...current,
          street: body.street,
          district: body.district,
          city: body.city,
          state: body.state,
        }));
      })
      .catch((reason) => {
        if (reason.name !== "AbortError")
          setMessage(reason.message || "Não foi possível consultar o CEP.");
      })
      .finally(() => setLoadingAddress(false));
    return () => controller.abort();
  }, [data.postalCode]);

  useEffect(() => {
    if (!order?.confirmationToken || order.status === "PAID") return;
    const poll = async () => {
      const response = await fetch(
        `/api/storefront/orders/${order.id}/status`,
        {
          headers: { "x-storefront-order-token": order.confirmationToken! },
          cache: "no-store",
        },
      );
      if (!response.ok) return;
      const current = await response.json();
      if (current.status !== "PAID") return;
      localStorage.removeItem("bispo-cart-v2");
      localStorage.removeItem("bispo-checkout-v1");
      sessionStorage.removeItem("bispo-checkout-idempotency");
      sessionStorage.removeItem("bispo-payment-order");
      setOrder((previous) => previous && { ...previous, status: "PAID" });
      setMessage(
        `Pagamento do pedido ${current.code} confirmado. Sua sacola foi concluída.`,
      );
      window.setTimeout(() => {
        window.location.assign(
          `/loja/pedido/${encodeURIComponent(order.id)}?token=${encodeURIComponent(order.confirmationToken!)}`,
        );
      }, 1200);
    };
    void poll();
    const timer = window.setInterval(poll, 4000);
    return () => window.clearInterval(timer);
  }, [order?.confirmationToken, order?.id, order?.status]);

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("payment");
    if (result === "failure")
      setMessage("O pagamento não foi concluído. Você pode tentar novamente.");
    if (result === "pending")
      setMessage("O Mercado Pago está processando o pagamento.");
    if (result === "success")
      setMessage("Pagamento recebido. Estamos confirmando com o Mercado Pago…");
  }, []);

  const total = useMemo(
    () => (checkout?.subtotal || 0) - (checkout?.discountCents || 0) + (checkout?.quote.priceCents || 0),
    [checkout],
  );
  const discountCents = checkout?.discountCents || 0;
  const netSubtotal = Math.max(0, (checkout?.subtotal || 0) - discountCents);
  const change = (field: keyof FormData, value: string) =>
    setData((current) => ({ ...current, [field]: value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!checkout) return;
    if (!validCpf(data.cpf)) {
      setMessage("Confira o CPF informado.");
      return;
    }
    if (digits(data.phone).length < 10) {
      setMessage("Confira o telefone informado.");
      return;
    }
    setSubmitting(true);
    try {
      let idempotencyKey = sessionStorage.getItem("bispo-checkout-idempotency");
      if (!idempotencyKey) {
        idempotencyKey = crypto.randomUUID();
        sessionStorage.setItem("bispo-checkout-idempotency", idempotencyKey);
      }
      const response = await fetch("/api/storefront/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idempotencyKey,
          shippingQuoteId: checkout.quote.id,
          couponCode: checkout.couponCode,
          paymentMethod,
          customer: {
            name: data.name,
            email: data.email,
            phone: data.phone,
            cpf: data.cpf,
          },
          delivery: data,
          items: checkout.items.map((item) => ({
            id: item.id,
            quantity: item.quantity,
            grind: item.grind || "Grãos",
          })),
          recurrence: {
            mode: checkout.mode,
            rhythmDays:
              checkout.mode === "return" ? checkout.rhythm : undefined,
          },
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.message || "Não foi possível preparar o pedido.",
        );
      setOrder(result);
      sessionStorage.setItem(
        "bispo-payment-order",
        JSON.stringify({
          id: result.id,
          code: result.code,
          status: result.status,
          confirmationToken: result.confirmationToken,
        }),
      );
      if (result.status === "PAID") {
        localStorage.removeItem("bispo-cart-v2");
        localStorage.removeItem("bispo-checkout-v1");
        sessionStorage.removeItem("bispo-checkout-idempotency");
        sessionStorage.removeItem("bispo-payment-order");
        setMessage(`Pagamento do pedido ${result.code} já está confirmado.`);
      } else if (result.checkoutUrl) {
        setMessage(
          "Pedido preparado. Abrindo o ambiente seguro do Mercado Pago…",
        );
        window.location.assign(result.checkoutUrl);
      } else {
        throw new Error("O endereço seguro de pagamento não foi recebido.");
      }
    } catch (reason) {
      setMessage(
        reason instanceof Error
          ? reason.message
          : "Não foi possível preparar o pedido.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!checkout)
    return (
      <main className={styles.empty}>
        <p>Sua sacola não possui uma entrega calculada.</p>
        <Link href="/loja">Voltar para a loja</Link>
      </main>
    );

  return (
    <main className={styles.page}>
      <header>
        <Link href="/loja">
          <ChevronLeft /> Voltar à loja
        </Link>
        <div>
          <small>FINALIZAR COMPRA</small>
          <h1>Seu café está quase a caminho.</h1>
        </div>
        <span>
          <LockKeyhole /> Ambiente protegido
        </span>
      </header>

      <div className={styles.layout}>
        <form onSubmit={submit}>
          <section>
            <small>1 · SEUS DADOS</small>
            <h2>Quem recebe?</h2>
            <div className={styles.fields}>
              <label className={styles.wide}>
                Nome completo
                <input
                  required
                  autoComplete="name"
                  value={data.name}
                  onChange={(e) => change("name", e.target.value)}
                />
              </label>
              <label>
                E-mail
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={data.email}
                  onChange={(e) => change("email", e.target.value)}
                />
              </label>
              <label>
                Telefone
                <input
                  required
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(43) 99999-9999"
                  value={data.phone}
                  onChange={(e) => change("phone", phoneMask(e.target.value))}
                />
              </label>
              <label>
                CPF
                <input
                  required
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={data.cpf}
                  onChange={(e) => change("cpf", cpfMask(e.target.value))}
                />
              </label>
            </div>
          </section>

          <section>
            <small>2 · ENTREGA</small>
            <h2>Para onde enviamos?</h2>
            <div className={styles.fields}>
              <label>
                CEP
                <span className={styles.inputStatus}>
                  {loadingAddress && <LoaderCircle />}
                </span>
                <input required value={data.postalCode} readOnly />
              </label>
              <label className={styles.wide}>
                Endereço
                <input
                  required
                  autoComplete="street-address"
                  value={data.street}
                  onChange={(e) => change("street", e.target.value)}
                />
              </label>
              <label>
                Número
                <input
                  required
                  inputMode="numeric"
                  value={data.number}
                  onChange={(e) => change("number", e.target.value)}
                />
              </label>
              <label>
                Complemento
                <input
                  value={data.complement}
                  onChange={(e) => change("complement", e.target.value)}
                />
              </label>
              <label>
                Bairro
                <input
                  required
                  value={data.district}
                  onChange={(e) => change("district", e.target.value)}
                />
              </label>
              <label>
                Cidade
                <input
                  required
                  value={data.city}
                  onChange={(e) => change("city", e.target.value)}
                />
              </label>
              <label>
                Estado
                <input
                  required
                  maxLength={2}
                  value={data.state}
                  onChange={(e) =>
                    change("state", e.target.value.toUpperCase())
                  }
                />
              </label>
            </div>
          </section>

          <section className={styles.paymentSection}>
            <div>
              <small>3 · PAGAMENTO</small>
              <h2>Como prefere pagar?</h2>
            </div>
            <div className={styles.payment}>
              <label>
                <input
                  checked={paymentMethod === "PIX"}
                  name="payment"
                  onChange={() => setPaymentMethod("PIX")}
                  type="radio"
                />{" "}
                PIX
              </label>
              <label>
                <input
                  checked={paymentMethod === "CARD"}
                  name="payment"
                  onChange={() => setPaymentMethod("CARD")}
                  type="radio"
                />{" "}
                Cartão
              </label>
            </div>
            <button
              disabled={submitting || order?.status === "PAID"}
              type="submit"
            >
              {submitting
                ? "Conectando ao Mercado Pago…"
                : order?.status === "PAID"
                  ? "Pagamento confirmado"
                  : "Pagar com Mercado Pago →"}
            </button>
            {message && (
              <p className={styles.message} role="status">
                {message}
              </p>
            )}
          </section>
        </form>

        <aside>
          <small>SUA ESCOLHA</small>
          <h2>Resumo do pedido</h2>
          {checkout.items.map((item) => (
            <article key={item.id}>
              <div>
                <b>{item.name}</b>
                <span>
                  {item.quantity} × {item.grind || "Grãos"}
                </span>
              </div>
              <strong>{money(item.priceCents * item.quantity)}</strong>
            </article>
          ))}
          <div className={styles.breakdown}>
            <div>
              <span>Subtotal dos produtos</span>
              <b>{money(checkout.subtotal)}</b>
            </div>
            {discountCents > 0 && (
              <>
                <div className={styles.discount}>
                  <span>
                    Cupom <strong>{checkout.couponCode}</strong>
                  </span>
                  <b>−{money(discountCents)}</b>
                </div>
                <div>
                  <span>Subtotal após desconto</span>
                  <b>{money(netSubtotal)}</b>
                </div>
              </>
            )}
          </div>
          <div className={styles.delivery}>
            <span>
              {checkout.quote.carrierName} · {checkout.quote.serviceName} · até{" "}
              {checkout.quote.deliveryDays} dias úteis
            </span>
            <b>
              {checkout.quote.priceCents
                ? money(checkout.quote.priceCents)
                : "Grátis"}
            </b>
          </div>
          {checkout.mode === "return" && (
            <p className={styles.return}>
              <Check /> Reencontro escolhido a cada {checkout.rhythm} dias.
            </p>
          )}
          <div className={styles.total}>
            <span>Total</span>
            <strong>{money(total)}</strong>
          </div>
          <p className={styles.proof}>
            Escolhido por José e Suzi, preparado para chegar à sua melhor
            xícara.
          </p>
        </aside>
      </div>
    </main>
  );
}
