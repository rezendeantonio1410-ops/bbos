"use client";

import Image from "next/image";
import {
  createContext,
  FormEvent,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { Check, Minus, Plus, ShoppingBag, X } from "lucide-react";
import styles from "./storefront-cart.module.css";

export type StoreProductStory = {
  promise: string;
  founderNote: string;
  bestFor: string;
  brew: string;
  description?: string;
  sensory?: { label: string; value: number }[];
};

export type StoreProduct = {
  id: string;
  name: string;
  line: string;
  notes: string;
  priceCents: number;
  weightGrams: number;
  image?: string | null;
  story?: StoreProductStory;
};
type Item = StoreProduct & { quantity: number };
type Grind = "Grãos" | "Espresso" | "Coado" | "Prensa francesa";
type CartItem = Item & { grind?: Grind };
type Quote = {
  id: string;
  name: string;
  serviceName: string;
  carrierName: string;
  priceCents: number;
  deliveryDays: number;
  expiresAt: string;
};
type CartApi = {
  add: (p: StoreProduct) => void;
  open: () => void;
  count: number;
};
const Cart = createContext<CartApi | null>(null);
const money = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    v / 100,
  );

const cartProductStories: Record<string, StoreProductStory> = {
  essencial: {
    promise: "Um café fácil de gostar: macio, doce e equilibrado para acompanhar a rotina sem cansar o paladar.",
    founderNote: "Escolhemos o Essencial para ser aquela xícara honesta e confortável que funciona de manhã, à tarde e com diferentes preparos.",
    bestFor: "Rotina, café da manhã e quem prefere uma xícara macia.",
    brew: "Coado, cafeteira elétrica ou prensa francesa.",
  },
  intenso: {
    promise: "Mais presença no primeiro gole, com corpo marcante e uma finalização limpa.",
    founderNote: "Aqui buscamos presença com limpeza. Ele entrega intensidade sem esconder a qualidade da xícara.",
    bestFor: "Quem gosta de café forte, leite e manhãs de mais energia.",
    brew: "Espresso, moka italiana ou prensa francesa.",
  },
  caramelo: {
    promise: "Doçura reconhecível, chocolate e equilíbrio: uma xícara acolhedora que convida ao próximo gole.",
    founderNote: "O Caramelo traduz muito do que acreditamos: sabor fácil de reconhecer, equilíbrio e vontade de repetir a xícara.",
    bestFor: "Pausas confortáveis, receber pessoas e acompanhar doces.",
    brew: "Coado, espresso ou prensa francesa.",
  },
  "doce-de-leite": {
    promise: "Uma xícara gulosa e macia, com lembranças de açúcar mascavo, doce de leite e alfajor.",
    founderNote: "Este é o nosso convite para perceber que o café pode ser naturalmente doce e cheio de referências afetivas.",
    bestFor: "Uma pausa especial, sobremesas e quem valoriza doçura.",
    brew: "Coado ou prensa francesa, valorizando textura e doçura.",
  },
  tangerina: {
    promise: "Cítrico, doce e fresco: um perfil luminoso para quem gosta de uma xícara viva.",
    founderNote: "Queríamos um frutado claro e alegre, capaz de apresentar frescor sem transformar a xícara em algo difícil.",
    bestFor: "Dias quentes, coados e quem quer explorar perfis frutados.",
    brew: "Coado ou preparo gelado.",
  },
  singular: {
    promise: "Frutado, complexo e evolutivo: uma xícara que muda enquanto esfria e recompensa a atenção.",
    founderNote: "O Singular fica na memória porque não entrega tudo de uma vez. É um café para provar com curiosidade.",
    bestFor: "Degustação, presentes e momentos de descoberta.",
    brew: "Coado, com água e proporção controladas.",
  },
  sublime: {
    promise: "Rapadura, caramelo e doçura profunda em uma xícara longa, densa e contemplativa.",
    founderNote: "O Sublime representa profundidade: uma doçura que ocupa a boca, permanece e ainda preserva elegância.",
    bestFor: "Rituais sem pressa, presentes e quem busca profundidade.",
    brew: "Prensa francesa, espresso ou coado mais concentrado.",
  },
  raros: {
    promise: "Um pequeno lote de Carlos Alexandre Siqueira, eleito por José e Suzi entre os cafés provados ao longo das últimas safras.",
    founderNote: "A Suzi acompanha o trabalho do Alexandre há três anos. Nesta safra, José e Suzi escolheram este pequeno lote como uma raridade Bispo.",
    bestFor: "Degustar com atenção, presentear e conhecer a expressão do Norte do Paraná.",
    brew: "Coado, com água filtrada e preparo cuidadoso.",
  },
};

function CartItemStory({ item }: { item: CartItem }) {
  const story = item.story ?? cartProductStories[item.id];
  if (!story) return null;

  return (
    <details className={styles.itemStory}>
      <summary>Conhecer este café <span>+</span></summary>
      <div>
        <p className={styles.storyPromise}>{story.promise}</p>
        <dl>
          <div><dt>Combina com</dt><dd>{story.bestFor}</dd></div>
          <div><dt>Para preparar</dt><dd>{story.brew}</dd></div>
        </dl>
        <blockquote>“{story.founderNote}”<cite>José e Suzi · curadoria Bispo</cite></blockquote>
      </div>
    </details>
  );
}

export function StorefrontCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [visible, setVisible] = useState(false);
  const [cep, setCep] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"now" | "return">("now");
  const [rhythm, setRhythm] = useState(30);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discountCents: number } | null>(null);
  const [couponMessage, setCouponMessage] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);

  useEffect(() => {
    try {
      setItems(JSON.parse(localStorage.getItem("bispo-cart-v2") || "[]"));
    } catch {}
  }, []);
  useEffect(() => {
    localStorage.setItem("bispo-cart-v2", JSON.stringify(items));
  }, [items]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => e.key === "Escape" && setVisible(false);
    window.addEventListener("keydown", close);
    document.body.style.overflow = visible ? "hidden" : "";
    return () => {
      window.removeEventListener("keydown", close);
      document.body.style.overflow = "";
    };
  }, [visible]);

  const subtotal = items.reduce(
    (sum, item) => sum + item.priceCents * item.quantity,
    0,
  );
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const remaining = Math.max(0, 27000 - subtotal);
  const add = (product: StoreProduct) => {
    setItems((current) => {
      const found = current.find((item) => item.id === product.id);
      return found
        ? current.map((item) =>
            item.id === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          )
        : [...current, { ...product, quantity: 1 }];
    });
    setQuote(null);
    setQuotes([]);
    setCoupon(null);
    setVisible(true);
  };
  const quantity = (id: string, next: number) => {
    setItems((current) =>
      next < 1
        ? current.filter((item) => item.id !== id)
        : current.map((item) =>
            item.id === id ? { ...item, quantity: next } : item,
          ),
    );
    setQuote(null);
    setQuotes([]);
    setCoupon(null);
  };
  const chooseGrind = (id: string, grind: Grind) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, grind } : item)),
    );
  };
  async function calculate(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (cep.replace(/\D/g, "").length !== 8) {
      setError("Digite um CEP válido com 8 números.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/storefront/shipping/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          postalCode: cep,
          subtotalCents: subtotal,
          weightGrams: items.reduce(
            (s, i) => s + i.weightGrams * i.quantity,
            0,
          ),
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Não foi possível calcular.");
      const options = Array.isArray(data.options) ? data.options : [];
      if (!options.length)
        throw new Error("Nenhuma modalidade de entrega disponível.");
      setQuotes(options);
      setQuote(options[0]);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Não foi possível calcular.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function applyCoupon() {
    setCouponMessage("");
    setCouponLoading(true);
    try {
      const response = await fetch("/api/storefront/coupons/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: couponInput, subtotalCents: subtotal }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Não foi possível aplicar o cupom.");
      setCoupon({ code: data.code, discountCents: data.discountCents });
      setCouponInput(data.code);
      setCouponMessage(`Cupom ${data.code} aplicado.`);
    } catch (reason) {
      setCoupon(null);
      setCouponMessage(reason instanceof Error ? reason.message : "Não foi possível aplicar o cupom.");
    } finally {
      setCouponLoading(false);
    }
  }

  function continueToCheckout() {
    if (!quote) return;
    localStorage.setItem(
      "bispo-checkout-v1",
      JSON.stringify({ items, cep, quote, mode, rhythm, subtotal, couponCode: coupon?.code, discountCents: coupon?.discountCents || 0 }),
    );
    window.location.assign("/loja/finalizar");
  }

  return (
    <Cart.Provider value={{ add, open: () => setVisible(true), count }}>
      {children}
      {visible && (
        <div className={styles.layer}>
          <button
            className={styles.backdrop}
            onClick={() => setVisible(false)}
            aria-label="Fechar sacola"
          />
          <aside
            className={styles.drawer}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-title"
          >
            <header>
              <div>
                <small>SUA ESCOLHA</small>
                <h2 id="cart-title">Seu café está na sacola</h2>
              </div>
              <button
                onClick={() => setVisible(false)}
                aria-label="Fechar sacola"
              >
                <X />
              </button>
            </header>
            <nav aria-label="Etapas">
              <strong>1 Sua escolha</strong>
              <span>2 Entrega</span>
              <span>3 Pagamento</span>
            </nav>
            {!items.length ? (
              <div className={styles.empty}>
                <ShoppingBag />
                <p>Sua sacola está vazia.</p>
                <button onClick={() => setVisible(false)}>
                  Escolher um café
                </button>
              </div>
            ) : (
              <>
                <main>
                  {items.map((item) => (
                    <article key={item.id}>
                      <div className={styles.photo}>
                        {item.image ? (
                          <Image
                            src={item.image}
                            alt=""
                            width={70}
                            height={78}
                          />
                        ) : (
                          <span>BISPO</span>
                        )}
                      </div>
                      <div>
                        <small>{item.line}</small>
                        <h3>{item.name}</h3>
                        <p>{item.notes}</p>
                        <p className={styles.productFacts}>
                          {item.weightGrams} g <span aria-hidden="true">·</span>{" "}
                          Torra média <span aria-hidden="true">·</span> Café torrado
                        </p>
                        <label className={styles.grind}>
                          <span>Moagem</span>
                          <select
                            value={item.grind || "Grãos"}
                            onChange={(event) =>
                              chooseGrind(item.id, event.target.value as Grind)
                            }
                            aria-label={`Moagem do café ${item.name}`}
                          >
                            <option>Grãos</option>
                            <option>Espresso</option>
                            <option>Coado</option>
                            <option>Prensa francesa</option>
                          </select>
                        </label>
                        <b>{money(item.priceCents)}</b>
                      </div>
                      <div className={styles.qty}>
                        <button
                          onClick={() => quantity(item.id, item.quantity - 1)}
                          aria-label="Diminuir"
                        >
                          <Minus />
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          onClick={() => quantity(item.id, item.quantity + 1)}
                          aria-label="Aumentar"
                        >
                          <Plus />
                        </button>
                      </div>
                      <CartItemStory item={item} />
                    </article>
                  ))}
                  <section className={styles.bispo}>
                    <small>LEITURA DO BISPO</small>
                    <h3>Uma escolha para querer outra xícara.</h3>
                    <p>
                      <Check /> Escolhido por José e Suzi, da origem à xícara.
                    </p>
                  </section>
                  <section className={styles.choice}>
                    <small>SUA EXPERIÊNCIA</small>
                    <h3>Uma vez — ou no seu ritmo.</h3>
                    <div>
                      <button
                        className={mode === "now" ? styles.active : ""}
                        onClick={() => setMode("now")}
                      >
                        Comprar uma vez
                      </button>
                      <button
                        className={mode === "return" ? styles.active : ""}
                        onClick={() => setMode("return")}
                      >
                        Receber regularmente
                      </button>
                    </div>
                    {mode === "return" && (
                      <div className={styles.rhythm}>
                        <p>O Bispo mantém o perfil. Você escolhe o ritmo.</p>
                        {[15, 30, 45].map((days) => (
                          <button
                            className={rhythm === days ? styles.active : ""}
                            key={days}
                            onClick={() => setRhythm(days)}
                          >
                            A cada {days} dias
                          </button>
                        ))}
                      </div>
                    )}
                  </section>
                  <section className={styles.progress}>
                    <b>
                      {remaining
                        ? "Faltam " + money(remaining) + " para o frete grátis"
                        : "Frete grátis alcançado"}
                    </b>
                    <div>
                      <span
                        style={{ width: Math.min(100, subtotal / 270) + "%" }}
                      />
                    </div>
                    <small>Sul e Sudeste</small>
                  </section>
                </main>
                <footer>
                  <section className={styles.shipping}>
                    <div className={styles.shippingTitle}>
                      <small>PASSO 2</small>
                      <h3>Onde entregamos seu café?</h3>
                    </div>
                    <form onSubmit={calculate}>
                      <label htmlFor="cart-cep">CEP de entrega</label>
                      <div>
                        <input
                          id="cart-cep"
                          value={cep}
                          onChange={(e) => {
                            setQuote(null);
                            setQuotes([]);
                            setError("");
                            setCep(
                              e.target.value
                                .replace(/\D/g, "")
                                .slice(0, 8)
                                .replace(/(\d{5})(\d)/, "$1-$2"),
                            );
                          }}
                          inputMode="numeric"
                          autoComplete="postal-code"
                          placeholder="00000-000"
                        />
                        <button disabled={loading} type="submit">
                          {loading ? "Calculando…" : "Calcular"}
                        </button>
                      </div>
                    </form>
                    <div aria-live="polite">
                      {error && <p className={styles.error}>{error}</p>}
                      {quotes.map((option) => (
                        <button
                          type="button"
                          key={option.id}
                          className={`${styles.quote} ${quote?.id === option.id ? styles.selectedQuote : ""}`}
                          onClick={() => setQuote(option)}
                        >
                          <span>
                            <b>{option.name}</b>
                            <small>
                              {option.carrierName} · até {option.deliveryDays}{" "}
                              dias úteis
                            </small>
                          </span>
                          <strong>
                            {option.priceCents
                              ? money(option.priceCents)
                              : "Grátis"}
                          </strong>
                        </button>
                      ))}
                    </div>
                  </section>
                  <section className={styles.coupon}>
                    <label htmlFor="cart-coupon">Cupom de benefício</label>
                    <div>
                      <input id="cart-coupon" value={couponInput} onChange={(event) => { setCouponInput(event.target.value.toUpperCase()); setCoupon(null); setCouponMessage(""); }} placeholder="Digite seu cupom" />
                      <button type="button" onClick={applyCoupon} disabled={couponLoading || !couponInput.trim()}>{couponLoading ? "Aplicando…" : "Aplicar"}</button>
                    </div>
                    {couponMessage && <small className={coupon ? styles.couponOk : styles.error}>{couponMessage}</small>}
                  </section>
                  <div className={styles.total}>
                    <span>Total</span>
                    <b>{money(subtotal - (coupon?.discountCents || 0) + (quote?.priceCents || 0))}</b>
                  </div>
                  <button disabled={!quote} onClick={continueToCheckout}>
                    Finalizar minha escolha →
                  </button>
                  <small>
                    {quote
                      ? "Torra própria · Escolha acompanhada · Entrega calculada pelo CEP"
                      : "Informe o CEP para continuar."}
                  </small>
                </footer>
              </>
            )}
          </aside>
        </div>
      )}
    </Cart.Provider>
  );
}
function useCart() {
  const value = useContext(Cart);
  if (!value) throw new Error("Cart provider missing");
  return value;
}
export function AddToCartButton({
  product,
  className,
  children,
}: {
  product: StoreProduct;
  className?: string;
  children: ReactNode;
}) {
  const cart = useCart();
  return (
    <button className={className} onClick={() => cart.add(product)}>
      {children}
    </button>
  );
}
export function CartButton() {
  const cart = useCart();
  return (
    <button
      onClick={cart.open}
      aria-label={"Sacola com " + cart.count + " itens"}
    >
      <svg
        className={styles.bispoBagIcon}
        viewBox="0 0 32 36"
        aria-hidden="true"
      >
        <path d="M5.5 11.5h21l-1.4 20H6.9l-1.4-20Z" />
        <path d="M10.5 12V8.6A5.5 5.5 0 0 1 16 3.1a5.5 5.5 0 0 1 5.5 5.5V12" />
        <path
          className={styles.bispoBagLetter}
          d="M12.1 17.1h4.8c2.2 0 3.5 1 3.5 2.6 0 1.1-.6 1.9-1.6 2.3 1.3.3 2.1 1.2 2.1 2.5 0 1.8-1.5 3-3.9 3h-4.9V17.1Zm4.5 4c1 0 1.6-.4 1.6-1.2 0-.7-.6-1.1-1.6-1.1h-2.3v2.3h2.3Zm.2 4.6c1.2 0 1.9-.5 1.9-1.4s-.7-1.4-1.9-1.4h-2.5v2.8h2.5Z"
        />
      </svg>
      {cart.count > 0 && <span>{cart.count}</span>}
    </button>
  );
}
