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
  mode: "now" | "return" | "reminder";
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
const preparationFor = (id: string) =>
  new Set(["essencial", "intenso"]).has(id) ? "Moído" : "Grãos";
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
    paymentMethod?: "PIX" | "CARD";
    pix?: {
      ticketUrl?: string | null;
      qrCode?: string | null;
      qrCodeBase64?: string | null;
      expiresInSeconds?: number;
    } | null;
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
      if (paymentOrder) {
        const previous = JSON.parse(paymentOrder);
        setOrder(previous);
        if (previous.paymentMethod) setPaymentMethod(previous.paymentMethod);
      }
    } catch {}
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/storefront/customer/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((customer) => {
        if (!active || !customer?.account) return;
        const primary =
          customer.addresses?.find(
            (item: { isDefault?: boolean }) => item.isDefault,
          ) || customer.addresses?.[0];
        setData((current) => {
          const useSavedAddress =
            Boolean(primary) &&
            (!current.postalCode ||
              digits(current.postalCode) === digits(primary.postalCode || ""));
          return {
            ...current,
            name: current.name || customer.account.name || "",
            email: current.email || customer.account.email || "",
            phone: current.phone || customer.account.phone || "",
            cpf: current.cpf || customer.account.taxId || "",
            postalCode:
              current.postalCode ||
              (useSavedAddress ? primary.postalCode : "") ||
              "",
            street:
              current.street || (useSavedAddress ? primary.street : "") || "",
            number:
              current.number || (useSavedAddress ? primary.number : "") || "",
            complement:
              current.complement ||
              (useSavedAddress ? primary.complement : "") ||
              "",
            district:
              current.district ||
              (useSavedAddress ? primary.district : "") ||
              "",
            city: current.city || (useSavedAddress ? primary.city : "") || "",
            state:
              current.state || (useSavedAddress ? primary.state : "") || "",
          };
        });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
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
    if (
      !order?.confirmationToken ||
      ["PAID", "PAYMENT_FAILED", "CANCELLED"].includes(order.status)
    )
      return;
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
      if (current.status === "PAYMENT_FAILED") {
        setOrder(
          (previous) => previous && { ...previous, status: "PAYMENT_FAILED" },
        );
        setMessage(
          "O pagamento não foi concluído. O estoque foi liberado e você pode gerar uma nova tentativa.",
        );
        return;
      }
      if (current.status === "CANCELLED") {
        setOrder(
          (previous) => previous && { ...previous, status: "CANCELLED" },
        );
        setMessage(
          "O prazo desta reserva terminou. Volte à loja para iniciar uma nova compra.",
        );
        return;
      }
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
      setMessage(
        "Se escolheu Pix, conclua a transferência no aplicativo do seu banco usando o QR Code ou Pix Copia e Cola exibido pelo Mercado Pago. O pedido será confirmado após a aprovação do pagamento.",
      );
    if (result === "success")
      setMessage(
        "Estamos consultando a aprovação do pagamento no Mercado Pago…",
      );
  }, []);

  const total = useMemo(
    () =>
      (checkout?.subtotal || 0) -
      (checkout?.discountCents || 0) +
      (checkout?.quote.priceCents || 0),
    [checkout],
  );
  const discountCents = checkout?.discountCents || 0;
  const netSubtotal = Math.max(0, (checkout?.subtotal || 0) - discountCents);
  const paymentPending = order?.status === "AWAITING_PAYMENT";
  const change = (field: keyof FormData, value: string) =>
    setData((current) => ({ ...current, [field]: value }));

  async function copyPix() {
    const code = order?.pix?.qrCode;
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setMessage("Pix Copia e Cola copiado.");
  }

  async function retryPayment() {
    if (!order?.confirmationToken) return;
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/storefront/orders/${encodeURIComponent(order.id)}/retry-payment`,
        {
          method: "POST",
          headers: {
            "x-storefront-order-token": order.confirmationToken,
          },
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.message || "Não foi possível gerar uma nova tentativa.",
        );
      const nextOrder = {
        ...order,
        ...result,
        paymentMethod,
        pix: result.pix ?? null,
      };
      setOrder(nextOrder);
      sessionStorage.setItem("bispo-payment-order", JSON.stringify(nextOrder));
      if (result.status === "PAID") {
        setMessage(`Pagamento do pedido ${result.code} já está confirmado.`);
      } else if (paymentMethod === "PIX" && result.pix?.qrCode) {
        setMessage(
          "Novo Pix gerado. A cobrança anterior foi encerrada com segurança.",
        );
      } else if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
      }
    } catch (reason) {
      setMessage(
        reason instanceof Error
          ? reason.message
          : "Não foi possível gerar uma nova tentativa.",
      );
    } finally {
      setSubmitting(false);
    }
  }

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
            grind: preparationFor(item.id),
          })),
          recurrence: {
            mode: checkout.mode === "now" ? "now" : "reminder",
            reminderDays: checkout.mode === "now" ? undefined : checkout.rhythm,
          },
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.message || "Não foi possível preparar o pedido.",
        );
      if (result.shippingRefreshRequired && result.quote) {
        const nextCheckout = {
          ...checkout,
          quote: {
            ...checkout.quote,
            ...result.quote,
          },
        };
        setCheckout(nextCheckout);
        localStorage.setItem("bispo-checkout-v1", JSON.stringify(nextCheckout));
        setMessage(
          result.message ||
            "O frete foi atualizado. Confira o novo total e confirme novamente.",
        );
        return;
      }
      setOrder(result);
      sessionStorage.setItem(
        "bispo-payment-order",
        JSON.stringify({
          id: result.id,
          code: result.code,
          status: result.status,
          confirmationToken: result.confirmationToken,
          paymentMethod,
          pix: result.pix ?? null,
        }),
      );
      if (result.status === "PAID") {
        localStorage.removeItem("bispo-cart-v2");
        localStorage.removeItem("bispo-checkout-v1");
        sessionStorage.removeItem("bispo-checkout-idempotency");
        sessionStorage.removeItem("bispo-payment-order");
        setMessage(`Pagamento do pedido ${result.code} já está confirmado.`);
      } else if (paymentMethod === "PIX" && result.pix?.qrCode) {
        setOrder({ ...result, paymentMethod, pix: result.pix });
        setMessage(
          "Pix gerado. Escaneie o QR Code ou use o Pix Copia e Cola. A confirmação será automática.",
        );
      } else if (result.checkoutUrl) {
        setMessage(
          "Pedido preparado. Abrindo o ambiente seguro do Mercado Pago…",
        );
        window.location.assign(result.checkoutUrl);
      } else {
        throw new Error(
          paymentMethod === "PIX"
            ? "O Mercado Pago não devolveu os dados do Pix."
            : "O endereço seguro de pagamento não foi recebido.",
        );
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
            <p className={styles.privacyNote}>
              Seus dados são utilizados para processar e entregar seu pedido.{" "}
              <Link href="/aviso-privacidade">Privacidade</Link>
            </p>
            <button
              disabled={
                submitting ||
                order?.status === "PAID" ||
                order?.status === "CANCELLED" ||
                paymentPending
              }
              onClick={
                order?.status === "PAYMENT_FAILED"
                  ? () => void retryPayment()
                  : undefined
              }
              type={order?.status === "PAYMENT_FAILED" ? "button" : "submit"}
            >
              {submitting
                ? "Conectando ao Mercado Pago…"
                : order?.status === "PAID"
                  ? "Pagamento confirmado"
                  : order?.status === "CANCELLED"
                    ? "Reserva encerrada"
                    : order?.status === "PAYMENT_FAILED"
                      ? "Gerar nova tentativa →"
                      : paymentPending
                        ? "Pagamento aguardando confirmação"
                        : paymentMethod === "PIX"
                          ? "Gerar Pix →"
                          : "Pagar com Mercado Pago →"}
            </button>
            {order?.status === "AWAITING_PAYMENT" && order.pix?.qrCode && (
              <div
                style={{
                  marginTop: 22,
                  padding: 22,
                  border: "1px solid #d9ddd9",
                  borderRadius: 16,
                  background: "#fff",
                  maxWidth: 520,
                }}
              >
                <strong
                  style={{ display: "block", fontSize: 18, marginBottom: 8 }}
                >
                  Pague com Pix
                </strong>
                <p style={{ margin: "0 0 16px", lineHeight: 1.5 }}>
                  Escaneie o QR Code no aplicativo do seu banco ou use o Pix
                  Copia e Cola.
                </p>
                {order.pix.qrCodeBase64 && (
                  <img
                    alt="QR Code Pix"
                    src={`data:image/png;base64,${order.pix.qrCodeBase64}`}
                    style={{
                      width: 220,
                      height: 220,
                      display: "block",
                      margin: "0 auto 16px",
                    }}
                  />
                )}
                <textarea
                  readOnly
                  value={order.pix.qrCode || ""}
                  aria-label="Pix Copia e Cola"
                  style={{
                    width: "100%",
                    minHeight: 90,
                    resize: "none",
                    padding: 12,
                    borderRadius: 10,
                    border: "1px solid #d9ddd9",
                    fontSize: 13,
                    wordBreak: "break-all",
                  }}
                />
                <button
                  type="button"
                  onClick={copyPix}
                  style={{
                    width: "100%",
                    marginTop: 10,
                    padding: "12px 16px",
                    borderRadius: 10,
                    border: "1px solid #0b2024",
                    background: "#fff",
                    color: "#0b2024",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Copiar código Pix
                </button>
                <small
                  style={{ display: "block", marginTop: 12, opacity: 0.72 }}
                >
                  O BBOS confirma o pagamento automaticamente.
                </small>
              </div>
            )}
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
                  {item.quantity} ×{" "}
                  {preparationFor(item.id) === "Moído" ? "Moído" : "Em grãos"}
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
          {checkout.mode !== "now" && (
            <p className={styles.return}>
              <Check /> Preferência de recompra: {checkout.rhythm} dias. Este
              pedido é único e não será renovado automaticamente.
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
