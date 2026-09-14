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

export type StoreProduct = {
  id: string;
  name: string;
  line: string;
  notes: string;
  priceCents: number;
  weightGrams: number;
  image?: string | null;
};
type Item = StoreProduct & { quantity: number };
type Grind = "Grãos" | "Espresso" | "Coado" | "Prensa francesa";
type CartItem = Item & { grind?: Grind };
type Quote = { name: string; priceCents: number; deliveryDays: number };
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

export function StorefrontCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [visible, setVisible] = useState(false);
  const [cep, setCep] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"now" | "return">("now");
  const [rhythm, setRhythm] = useState(30);

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
      setQuote(data);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Não foi possível calcular.",
      );
    } finally {
      setLoading(false);
    }
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
                <h2 id="cart-title">Sacola Bispo</h2>
              </div>
              <button
                onClick={() => setVisible(false)}
                aria-label="Fechar sacola"
              >
                <X />
              </button>
            </header>
            <nav aria-label="Etapas">
              <strong>1 Café</strong>
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
                    </article>
                  ))}
                  <section className={styles.bispo}>
                    <small>LEITURA DO BISPO</small>
                    <h3>Uma escolha para querer outra xícara.</h3>
                    <p>
                      <Check /> José Rezende, o Bispo — provador e Q-Grader. Com
                      o cuidado de Suzi e da equipe.
                    </p>
                  </section>
                  <section className={styles.choice}>
                    <small>COMO VOCÊ QUER RECEBER?</small>
                    <h3>Hoje — ou no seu ritmo.</h3>
                    <div>
                      <button
                        className={mode === "now" ? styles.active : ""}
                        onClick={() => setMode("now")}
                      >
                        Quero experimentar agora
                      </button>
                      <button
                        className={mode === "return" ? styles.active : ""}
                        onClick={() => setMode("return")}
                      >
                        Quero reencontrar este café
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
                      <h3>Para onde enviamos?</h3>
                    </div>
                    <form onSubmit={calculate}>
                      <label htmlFor="cart-cep">CEP de entrega</label>
                      <div>
                        <input
                          id="cart-cep"
                          value={cep}
                          onChange={(e) => {
                            setQuote(null);
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
                      {quote && (
                        <p className={styles.quote}>
                          <span>
                            <b>{quote.name}</b>
                            <small>até {quote.deliveryDays} dias úteis</small>
                          </span>
                          <strong>
                            {quote.priceCents
                              ? money(quote.priceCents)
                              : "Grátis"}
                          </strong>
                        </p>
                      )}
                    </div>
                  </section>
                  <div className={styles.total}>
                    <span>Total</span>
                    <b>{money(subtotal + (quote?.priceCents || 0))}</b>
                  </div>
                  <button disabled={!quote}>Continuar para pagamento →</button>
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
      <ShoppingBag />
      {cart.count > 0 && <span>{cart.count}</span>}
    </button>
  );
}
