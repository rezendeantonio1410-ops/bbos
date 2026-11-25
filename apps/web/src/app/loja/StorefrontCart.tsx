"use client";

import Image from "next/image";
import {
  CSSProperties,
  createContext,
  FormEvent,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { Minus, Plus, ShoppingBag, X } from "lucide-react";
import { resolveStorefrontProduct } from "@bbos/shared";
import { freeShippingRegion } from "@/lib/storefront-checkout-validation";
import { track } from "@/lib/storefront-analytics";
import styles from "./storefront-cart.module.css";
import sacola from "./sacola.module.css";
import { storefrontCommerce } from "./storefront-catalog";

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
type Preparation = "Grãos" | "Moído";
type CartItem = Item & { grind: Preparation };
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
/** "sex, 5/dez" counting business days from today (weekends skipped). */
const arrivalDate = (businessDays: number) => {
  const date = new Date();
  let left = Math.max(1, businessDays);
  while (left > 0) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) left -= 1;
  }
  return date
    .toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })
    .replace(/\./g, "");
};
const groundProductIds = new Set(["essencial", "intenso"]);
const preparationFor = (product: Pick<StoreProduct, "id">): Preparation =>
  groundProductIds.has(product.id) ? "Moído" : "Grãos";
const normalizeCartProduct = (product: StoreProduct): StoreProduct | null => {
  const catalogProduct = resolveStorefrontProduct(product.id);
  return catalogProduct
    ? {
        ...product,
        id: catalogProduct.id,
        name: catalogProduct.name,
        priceCents: catalogProduct.unitPriceCents,
        weightGrams: catalogProduct.weightGrams,
      }
    : null;
};

const cartProductStories: Record<string, StoreProductStory> = {
  essencial: {
    promise:
      "Um café fácil de gostar: macio, doce e equilibrado para acompanhar a rotina sem cansar o paladar.",
    founderNote:
      "Escolhemos o Essencial para ser aquela xícara honesta e confortável que funciona de manhã, à tarde e com diferentes preparos.",
    bestFor: "Rotina, café da manhã e quem prefere uma xícara macia.",
    brew: "Coado, cafeteira elétrica ou prensa francesa.",
  },
  intenso: {
    promise:
      "Mais presença no primeiro gole, com corpo marcante e uma finalização limpa.",
    founderNote:
      "Aqui buscamos presença com limpeza. Ele entrega intensidade sem esconder a qualidade da xícara.",
    bestFor: "Quem gosta de café forte, leite e manhãs de mais energia.",
    brew: "Espresso, moka italiana ou prensa francesa.",
  },
  caramelo: {
    promise:
      "Doçura reconhecível, chocolate e equilíbrio: uma xícara acolhedora que convida ao próximo gole.",
    founderNote:
      "O Caramelo traduz muito do que acreditamos: sabor fácil de reconhecer, equilíbrio e vontade de repetir a xícara.",
    bestFor: "Pausas confortáveis, receber pessoas e acompanhar doces.",
    brew: "Coado, espresso ou prensa francesa.",
  },
  "doce-de-leite": {
    promise:
      "Uma xícara gulosa e macia, com lembranças de açúcar mascavo, doce de leite e alfajor.",
    founderNote:
      "Este é o nosso convite para perceber que o café pode ser naturalmente doce e cheio de referências afetivas.",
    bestFor: "Uma pausa especial, sobremesas e quem valoriza doçura.",
    brew: "Coado ou prensa francesa, valorizando textura e doçura.",
  },
  tangerina: {
    promise:
      "Cítrico, doce e fresco: um perfil luminoso para quem gosta de uma xícara viva.",
    founderNote:
      "Queríamos um frutado claro e alegre, capaz de apresentar frescor sem transformar a xícara em algo difícil.",
    bestFor: "Dias quentes, coados e quem quer explorar perfis frutados.",
    brew: "Coado ou preparo gelado.",
  },
  singular: {
    promise:
      "Frutado, complexo e evolutivo: uma xícara que muda enquanto esfria e recompensa a atenção.",
    founderNote:
      "O Singular fica na memória porque não entrega tudo de uma vez. É um café para provar com curiosidade.",
    bestFor: "Degustação, presentes e momentos de descoberta.",
    brew: "Coado, com água e proporção controladas.",
  },
  sublime: {
    promise:
      "Rapadura, caramelo e doçura profunda em uma xícara longa, densa e contemplativa.",
    founderNote:
      "O Sublime representa profundidade: uma doçura que ocupa a boca, permanece e ainda preserva elegância.",
    bestFor: "Rituais sem pressa, presentes e quem busca profundidade.",
    brew: "Prensa francesa, espresso ou coado mais concentrado.",
  },
  raros: {
    promise:
      "Um pequeno lote de Carlos Alexandre Siqueira, eleito por Suzi e José entre os cafés provados ao longo das últimas safras.",
    founderNote:
      "A Suzi acompanha o trabalho do Alexandre há três anos. Nesta safra, Suzi e José escolheram este pequeno lote como uma raridade Bispo.",
    bestFor:
      "Degustar com atenção, presentear e conhecer a expressão do Norte do Paraná.",
    brew: "Coado, com água filtrada e preparo cuidadoso.",
  },
};

const cartRecommendationProducts: Record<string, StoreProduct> = {
  essencial: {
    name: "Essencial",
    line: "GOURMET",
    notes: "Macio · Doce · Fácil",
    ...storefrontCommerce("essencial"),
    image: "/brand/products/real/essencial-frontal.jpg",
    story: cartProductStories.essencial,
  },
  caramelo: {
    name: "Caramelo",
    line: "CLÁSSICOS",
    notes: "Caramelo · Chocolate · Equilíbrio",
    ...storefrontCommerce("caramelo"),
    image: "/brand/products/real/caramelo-frontal.jpg",
    story: cartProductStories.caramelo,
  },
  singular: {
    name: "Singular",
    line: "ÉPICOS",
    notes: "Frutado · Complexo · Evolutivo",
    ...storefrontCommerce("singular"),
    image: "/brand/products/real/singular-frontal.jpg",
    story: cartProductStories.singular,
  },
  sublime: {
    name: "Sublime",
    line: "ÉPICOS",
    notes: "Rapadura · Caramelo · Doçura profunda",
    ...storefrontCommerce("sublime"),
    image: "/brand/products/real/sublime-frontal.jpg",
    story: cartProductStories.sublime,
  },
};

const cartRecommendationOrder: Record<string, string[]> = {
  essencial: ["caramelo", "singular", "sublime"],
  intenso: ["caramelo", "singular", "essencial"],
  caramelo: ["essencial", "sublime", "singular"],
  "doce-de-leite": ["singular", "essencial", "sublime"],
  tangerina: ["caramelo", "sublime", "essencial"],
  singular: ["caramelo", "essencial", "sublime"],
  sublime: ["essencial", "caramelo", "singular"],
  raros: ["caramelo", "essencial", "sublime"],
};


export function StorefrontCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [visible, setVisible] = useState(false);
  const [cep, setCep] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"now" | "reminder">("now");
  const [rhythm, setRhythm] = useState(30);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{
    code: string;
    discountCents: number;
  } | null>(null);
  const [couponMessage, setCouponMessage] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponOpen, setCouponOpen] = useState(false);

  useEffect(() => {
    // "Trocar CEP" on the checkout comes back here with ?sacola=1.
    if (new URLSearchParams(window.location.search).get("sacola") === "1") {
      setVisible(true);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("bispo-cart-v2") || "[]");
      setItems(
        Array.isArray(stored)
          ? stored.flatMap((item) => {
              const product = normalizeCartProduct(item);
              const quantity = Math.min(
                20,
                Math.max(1, Number(item?.quantity) || 1),
              );
              return product
                ? [{ ...product, quantity, grind: preparationFor(product) }]
                : [];
            })
          : [],
      );
      if (localStorage.getItem("bispo-open-cart") === "1") {
        localStorage.removeItem("bispo-open-cart");
        setVisible(true);
      }
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

  // The CEP typed once is remembered; the freight is recalculated by itself
  // whenever the bag opens or changes, so the customer never types it twice.
  useEffect(() => {
    if (cep) return;
    try {
      const saved = localStorage.getItem("bispo-cep");
      if (saved) setCep(saved);
    } catch {}
  }, [cep]);
  useEffect(() => {
    if (!visible || !items.length || quote || loading || error) return;
    if (cep.replace(/\D/g, "").length !== 8) return;
    void calculate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, items, cep, quote]);

  const subtotal = items.reduce(
    (sum, item) => sum + item.priceCents * item.quantity,
    0,
  );
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const remaining = Math.max(0, 27000 - subtotal);
  const currentItemIds = new Set(items.map((item) => item.id));
  const primaryItemId = items[0]?.id;
  const recommendationIds = [
    ...(primaryItemId ? (cartRecommendationOrder[primaryItemId] ?? []) : []),
    "caramelo",
    "essencial",
    "singular",
    "sublime",
  ];
  const recommendations =
    currentItemIds.size < 2
      ? [...new Set(recommendationIds)]
          .filter((id) => !currentItemIds.has(id))
          .map((id) => cartRecommendationProducts[id])
          .filter((product): product is StoreProduct => Boolean(product))
          .slice(0, 2)
      : [];
  const add = (product: StoreProduct) => {
    const normalizedProduct = normalizeCartProduct(product);
    if (!normalizedProduct) return;
    setItems((current) => {
      const found = current.find((item) => item.id === normalizedProduct.id);
      return found
        ? current.map((item) =>
            item.id === normalizedProduct.id
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          )
        : [
            ...current,
            {
              ...normalizedProduct,
              grind: preparationFor(normalizedProduct),
              quantity: 1,
            },
          ];
    });
    setQuote(null);
    setQuotes([]);
    setCoupon(null);
    setVisible(true);
    track("add_to_cart", [
      {
        id: normalizedProduct.id,
        name: normalizedProduct.name,
        priceCents: normalizedProduct.priceCents,
        quantity: 1,
      },
    ]);
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
  async function calculate(event?: FormEvent) {
    event?.preventDefault();
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
      try {
        localStorage.setItem("bispo-cep", cep);
      } catch {}
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
      if (!response.ok)
        throw new Error(data.message || "Não foi possível aplicar o cupom.");
      setCoupon({ code: data.code, discountCents: data.discountCents });
      setCouponInput(data.code);
      setCouponMessage(`Cupom ${data.code} aplicado.`);
    } catch (reason) {
      setCoupon(null);
      setCouponMessage(
        reason instanceof Error
          ? reason.message
          : "Não foi possível aplicar o cupom.",
      );
    } finally {
      setCouponLoading(false);
    }
  }

  function continueToCheckout() {
    if (!quote) return;
    track(
      "begin_checkout",
      items.map((item) => ({
        id: item.id,
        name: item.name,
        priceCents: item.priceCents,
        quantity: item.quantity,
      })),
    );
    localStorage.setItem(
      "bispo-checkout-v1",
      JSON.stringify({
        items,
        cep,
        quote,
        mode,
        rhythm,
        subtotal,
        couponCode: coupon?.code,
        discountCents: coupon?.discountCents || 0,
      }),
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
            className={sacola.drawer}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-title"
          >
            <header className={sacola.header}>
              <h2 id="cart-title">
                Sua sacola{" "}
                {count > 0 && (
                  <span>
                    · {count} {count === 1 ? "item" : "itens"}
                  </span>
                )}
              </h2>
              <button
                type="button"
                onClick={() => setVisible(false)}
                aria-label="Fechar sacola"
              >
                <X />
              </button>
            </header>
            {!items.length ? (
              <main className={sacola.body}>
                <div className={sacola.emptyIntro}>
                  <ShoppingBag aria-hidden="true" />
                  <p>
                    <b>Sua sacola está vazia.</b>
                    <span>Escolha um café e toque em Adicionar.</span>
                  </p>
                </div>
                <ul className={sacola.shelf}>
                  {Object.values(cartRecommendationProducts).map((product) => (
                    <li key={product.id}>
                      <div className={sacola.photo}>
                        {product.image ? (
                          <Image src={product.image} alt="" width={64} height={76} />
                        ) : (
                          <span>BISPO</span>
                        )}
                      </div>
                      <div className={sacola.itemInfo}>
                        <h3>{product.name}</h3>
                        <p>{product.notes}</p>
                        <b>
                          {money(product.priceCents)}{" "}
                          <small>· {product.weightGrams} g</small>
                        </b>
                      </div>
                      <button
                        type="button"
                        className={sacola.addButton}
                        onClick={() => add(product)}
                        aria-label={`Adicionar ${product.name} por ${money(product.priceCents)}`}
                      >
                        <Plus aria-hidden="true" /> Adicionar
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={sacola.couponLink}
                  onClick={() => {
                    setVisible(false);
                    document.getElementById("cafes")?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  Ver todos os cafés na loja →
                </button>
              </main>
            ) : (
              <>
                <main className={sacola.body}>
                  <section className={sacola.freeShipping} aria-live="polite">
                    {freeShippingRegion(cep) === false ? (
                      <p>Frete grátis vale só para Sul e Sudeste.</p>
                    ) : remaining ? (
                      <p>
                        Faltam <b>{money(remaining)}</b> para o{" "}
                        <b>frete grátis</b>
                        <small> (Sul e Sudeste)</small>
                      </p>
                    ) : (
                      <p>
                        <b>Frete grátis</b> garantido no Sul e Sudeste
                      </p>
                    )}
                    {freeShippingRegion(cep) !== false && (
                      <div>
                        <span
                          style={{ width: Math.min(100, subtotal / 270) + "%" }}
                        />
                      </div>
                    )}
                  </section>

                  <ul className={sacola.items}>
                    {items.map((item) => (
                      <li key={item.id}>
                        <div className={sacola.photo}>
                          {item.image ? (
                            <Image src={item.image} alt="" width={64} height={76} />
                          ) : (
                            <span>BISPO</span>
                          )}
                        </div>
                        <div className={sacola.itemInfo}>
                          <h3>{item.name}</h3>
                          <p>
                            {item.weightGrams} g ·{" "}
                            {item.grind === "Moído" ? "Moído" : "Em grãos"} ·{" "}
                            {item.notes}
                          </p>
                          <div className={sacola.itemActions}>
                            <div className={sacola.qty}>
                              <button
                                type="button"
                                onClick={() =>
                                  quantity(item.id, item.quantity - 1)
                                }
                                aria-label={`Diminuir quantidade de ${item.name}`}
                              >
                                <Minus />
                              </button>
                              <span aria-live="polite">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  quantity(item.id, item.quantity + 1)
                                }
                                aria-label={`Aumentar quantidade de ${item.name}`}
                              >
                                <Plus />
                              </button>
                            </div>
                            <button
                              type="button"
                              className={sacola.remove}
                              onClick={() => quantity(item.id, 0)}
                            >
                              Remover
                            </button>
                          </div>
                        </div>
                        <b className={sacola.itemPrice}>
                          {money(item.priceCents * item.quantity)}
                        </b>
                      </li>
                    ))}
                  </ul>

                  <section className={sacola.delivery}>
                    <h3>Entrega</h3>
                    <form onSubmit={calculate}>
                      <label htmlFor="cart-cep" className={sacola.srOnly}>
                        CEP de entrega
                      </label>
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
                        placeholder="Seu CEP"
                      />
                      <button disabled={loading} type="submit">
                        {loading ? "Calculando…" : "Calcular"}
                      </button>
                    </form>
                    <div aria-live="polite">
                      {error && <p className={sacola.error}>{error}</p>}
                      {quotes.map((option) => (
                        <button
                          type="button"
                          key={option.id}
                          aria-pressed={quote?.id === option.id}
                          className={sacola.quote}
                          onClick={() => setQuote(option)}
                        >
                          <i aria-hidden="true" />
                          <span>
                            <b>{option.name}</b>
                            <small>
                              Chega até {arrivalDate(option.deliveryDays)}
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

                  {recommendations.length > 0 && (
                    <section className={sacola.suggestions}>
                      <h3>Combina com o seu café</h3>
                      <div>
                        {recommendations.map((product) => (
                          <button
                            type="button"
                            key={product.id}
                            onClick={() => add(product)}
                            aria-label={`Adicionar ${product.name} por ${money(product.priceCents)}`}
                          >
                            {product.image ? (
                              <Image
                                src={product.image}
                                alt=""
                                width={44}
                                height={52}
                              />
                            ) : null}
                            <span>
                              <b>{product.name}</b>
                              <small>{product.notes}</small>
                              <em>{money(product.priceCents)}</em>
                            </span>
                            <Plus aria-hidden="true" />
                          </button>
                        ))}
                      </div>
                    </section>
                  )}

                  <section className={sacola.extras}>
                    <label className={sacola.reminder}>
                      <input
                        type="checkbox"
                        checked={mode === "reminder"}
                        onChange={(e) =>
                          setMode(e.target.checked ? "reminder" : "now")
                        }
                      />
                      <span>
                        Me lembre de comprar de novo em{" "}
                        <select
                          value={rhythm}
                          onChange={(e) => {
                            setRhythm(Number(e.target.value));
                            setMode("reminder");
                          }}
                          aria-label="Intervalo do lembrete"
                        >
                          {[15, 30, 45].map((days) => (
                            <option key={days} value={days}>
                              {days} dias
                            </option>
                          ))}
                        </select>
                        <small>Só um aviso. Nada é cobrado automaticamente.</small>
                      </span>
                    </label>
                    {couponOpen || coupon ? (
                      <div className={sacola.coupon}>
                        <input
                          id="cart-coupon"
                          value={couponInput}
                          onChange={(event) => {
                            setCouponInput(event.target.value.toUpperCase());
                            setCoupon(null);
                            setCouponMessage("");
                          }}
                          placeholder="Código do cupom"
                          aria-label="Código do cupom"
                        />
                        <button
                          type="button"
                          onClick={applyCoupon}
                          disabled={couponLoading || !couponInput.trim()}
                        >
                          {couponLoading ? "…" : "Aplicar"}
                        </button>
                        {couponMessage && (
                          <small className={coupon ? sacola.ok : sacola.error}>
                            {couponMessage}
                          </small>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={sacola.couponLink}
                        onClick={() => setCouponOpen(true)}
                      >
                        Tem um cupom?
                      </button>
                    )}
                  </section>
                </main>
                <footer className={sacola.footer}>
                  <dl>
                    <div>
                      <dt>Produtos</dt>
                      <dd>{money(subtotal)}</dd>
                    </div>
                    {coupon && (
                      <div>
                        <dt>Cupom {coupon.code}</dt>
                        <dd>− {money(coupon.discountCents)}</dd>
                      </div>
                    )}
                    <div>
                      <dt>Frete</dt>
                      <dd>
                        {quote
                          ? quote.priceCents
                            ? money(quote.priceCents)
                            : "Grátis"
                          : "informe o CEP"}
                      </dd>
                    </div>
                    <div className={sacola.grand}>
                      <dt>Total</dt>
                      <dd>
                        {money(
                          subtotal -
                            (coupon?.discountCents || 0) +
                            (quote?.priceCents || 0),
                        )}
                      </dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    className={sacola.cta}
                    onClick={() =>
                      quote
                        ? continueToCheckout()
                        : document.getElementById("cart-cep")?.focus()
                    }
                  >
                    {quote ? "Continuar para pagamento →" : "Calcular o frete para continuar"}
                  </button>
                  <small className={sacola.trust}>
                    Pix ou cartão · pagamento pelo Mercado Pago · sem cadastro
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
  style,
  children,
  disabled = false,
}: {
  product: StoreProduct;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  disabled?: boolean;
}) {
  const cart = useCart();
  return (
    <button
      className={className}
      style={style}
      disabled={disabled}
      onClick={() => cart.add(product)}
    >
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
