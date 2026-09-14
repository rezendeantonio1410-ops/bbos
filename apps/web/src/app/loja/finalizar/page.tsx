"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, LockKeyhole } from "lucide-react";
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
  quote: { name: string; priceCents: number; deliveryDays: number };
};

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);

export default function CheckoutPage() {
  const [checkout, setCheckout] = useState<CheckoutState | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("bispo-checkout-v1");
      if (stored) setCheckout(JSON.parse(stored));
    } catch {}
  }, []);

  const total = useMemo(
    () => (checkout?.subtotal || 0) + (checkout?.quote.priceCents || 0),
    [checkout],
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(
      "Dados validados. O pagamento será habilitado quando o provedor estiver conectado.",
    );
  }

  if (!checkout) {
    return (
      <main className={styles.empty}>
        <p>Sua sacola não possui uma entrega calculada.</p>
        <Link href="/loja">Voltar para a loja</Link>
      </main>
    );
  }

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
              <label>
                Nome completo <input required autoComplete="name" />
              </label>
              <label>
                E-mail <input required type="email" autoComplete="email" />
              </label>
              <label>
                Telefone <input required inputMode="tel" autoComplete="tel" />
              </label>
              <label>
                CPF <input required inputMode="numeric" />
              </label>
            </div>
          </section>

          <section>
            <small>2 · ENTREGA</small>
            <h2>Para onde enviamos?</h2>
            <div className={styles.fields}>
              <label>
                CEP <input required value={checkout.cep} readOnly />
              </label>
              <label className={styles.wide}>
                Endereço <input required autoComplete="street-address" />
              </label>
              <label>
                Número <input required inputMode="numeric" />
              </label>
              <label>
                Complemento <input />
              </label>
            </div>
          </section>

          <section>
            <small>3 · PAGAMENTO</small>
            <h2>Como prefere pagar?</h2>
            <div className={styles.payment}>
              <label>
                <input defaultChecked name="payment" type="radio" /> PIX
              </label>
              <label>
                <input name="payment" type="radio" /> Cartão
              </label>
            </div>
            <button type="submit">Validar dados do pedido →</button>
            {message && <p className={styles.message}>{message}</p>}
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
          <div className={styles.delivery}>
            <span>
              {checkout.quote.name} · até {checkout.quote.deliveryDays} dias
              úteis
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
            Escolhido pelo Bispo, preparado com o cuidado de Suzi e da equipe.
          </p>
        </aside>
      </div>
    </main>
  );
}
