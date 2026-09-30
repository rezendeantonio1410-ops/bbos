import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Search, UserRound } from "lucide-react";
import styles from "./sales.module.css";
import tight from "./sales-tight.module.css";
import review from "./hero-review.module.css";
import journey from "./conversion-review.module.css";
import founder from "./founder-trust.module.css";
import layers from "./layers.module.css";
import brand from "./brand-review.module.css";
import storyNav from "./story-navigation.module.css";
import premium from "./premium-overrides.module.css";
import ScrollToTopOnLoad from "./ScrollToTopOnLoad";
import SensoryConcierge from "./SensoryConcierge";
import EditorialHero from "./EditorialHero";
import ProductDetails, { type ProductStory } from "./ProductDetails";
import { alexandreMicrolot } from "./microlots";
import { loadStorefrontImages } from "@/lib/storefront-images";
import { loadStorefrontMedia } from "@/lib/storefront-media";
import {
  AddToCartButton,
  CartButton,
  StorefrontCartProvider,
} from "./StorefrontCart";

const products = [
  {
    name: "Essencial",
    line: "GOURMET",
    notes: "Macio · Doce · Fácil",
    price: "R$ 52",
    priceCents: 5200,
    weight: "500 g",
    tone: "#E9BB00",
    image: "/brand/products/essencial-treated.webp",
    tag: "para todo dia",
    story: {
      promise: "Um café fácil de gostar: macio, doce e equilibrado para acompanhar a rotina sem cansar o paladar.",
      description: "A doçura aparece com delicadeza e o corpo é leve o bastante para mais de uma xícara. É uma escolha segura para quem está começando no café especial ou quer simplicidade bem-feita todos os dias.",
      founderNote: "Escolhemos o Essencial para ser aquela xícara honesta e confortável que funciona de manhã, à tarde e com diferentes preparos.",
      bestFor: "rotina, café da manhã e quem prefere uma xícara macia",
      brew: "coado, cafeteira elétrica ou prensa francesa",
      sensory: [{ label: "Doçura", value: 72 }, { label: "Corpo", value: 48 }, { label: "Frescor", value: 38 }, { label: "Intensidade", value: 44 }],
    } satisfies ProductStory,
  },
  {
    name: "Intenso",
    line: "GOURMET",
    notes: "Corpo · Presença · Limpeza",
    price: "R$ 52",
    priceCents: 5200,
    weight: "500 g",
    tone: "#E9BB00",
    image: "/brand/products/intenso-treated.webp",
    tag: "mais corpo",
    story: {
      promise: "Mais presença no primeiro gole, com corpo marcante e uma finalização limpa.",
      description: "É a escolha para quem associa uma boa xícara à intensidade. A sensação é mais encorpada e direta, mas sem deixar o sabor pesado ou confuso.",
      founderNote: "Aqui buscamos presença com limpeza. Ele entrega intensidade sem esconder a qualidade da xícara.",
      bestFor: "quem gosta de café forte, leite e manhãs de mais energia",
      brew: "espresso, moka italiana ou prensa francesa",
      sensory: [{ label: "Doçura", value: 55 }, { label: "Corpo", value: 86 }, { label: "Frescor", value: 34 }, { label: "Intensidade", value: 88 }],
    } satisfies ProductStory,
  },
  {
    name: "Caramelo",
    line: "CLÁSSICOS",
    notes: "Caramelo · Chocolate · Equilíbrio",
    price: "R$ 68",
    priceCents: 6800,
    weight: "500 g",
    tone: "#F96D01",
    image: "/brand/products/caramelo-treated.webp",
    tag: "conforto",
    story: {
      promise: "Doçura reconhecível, chocolate e equilíbrio: uma xícara acolhedora que convida ao próximo gole.",
      description: "O perfil lembra caramelo e chocolate sem precisar procurar demais. O corpo é redondo, a doçura permanece e o conjunto funciona tanto puro quanto acompanhado.",
      founderNote: "O Caramelo traduz muito do que acreditamos: sabor fácil de reconhecer, equilíbrio e vontade de repetir a xícara.",
      bestFor: "pausas confortáveis, receber pessoas e acompanhar doces",
      brew: "coado, espresso ou prensa francesa",
      sensory: [{ label: "Doçura", value: 88 }, { label: "Corpo", value: 70 }, { label: "Frescor", value: 42 }, { label: "Intensidade", value: 66 }],
    } satisfies ProductStory,
  },
  {
    name: "Doce de Leite",
    line: "CLÁSSICOS",
    notes: "Mascavo · Doce de leite · Alfajor",
    price: "R$ 68",
    priceCents: 6800,
    weight: "500 g",
    tone: "#F96D01",
    image: "/brand/products/doce-de-leite-treated.webp",
    tag: "doçura",
    story: {
      promise: "Uma xícara gulosa e macia, com lembranças de açúcar mascavo, doce de leite e alfajor.",
      description: "A experiência começa na doçura e termina com sensação cremosa e prolongada. É um café para quem procura conforto, mas quer um perfil com personalidade própria.",
      founderNote: "Este é o nosso convite para perceber que o café pode ser naturalmente doce e cheio de referências afetivas.",
      bestFor: "uma pausa especial, sobremesas e quem valoriza doçura",
      brew: "coado ou prensa francesa, valorizando textura e doçura",
      sensory: [{ label: "Doçura", value: 94 }, { label: "Corpo", value: 76 }, { label: "Frescor", value: 36 }, { label: "Intensidade", value: 64 }],
    } satisfies ProductStory,
  },
  {
    name: "Tangerina",
    line: "CLÁSSICOS",
    notes: "Cítrico · Doce · Fresco",
    price: "R$ 68",
    priceCents: 6800,
    weight: "500 g",
    tone: "#F96D01",
    image: null,
    tag: "frescor",
    story: {
      promise: "Cítrico, doce e fresco: um perfil luminoso para quem gosta de uma xícara viva.",
      description: "A lembrança de tangerina traz brilho sem perder a doçura. É uma porta de entrada acessível para sabores frutados e uma escolha especialmente agradável em preparos filtrados.",
      founderNote: "Queríamos um frutado claro e alegre, capaz de apresentar frescor sem transformar a xícara em algo difícil.",
      bestFor: "dias quentes, coados e quem quer explorar perfis frutados",
      brew: "coado ou preparo gelado",
      sensory: [{ label: "Doçura", value: 72 }, { label: "Corpo", value: 45 }, { label: "Frescor", value: 90 }, { label: "Intensidade", value: 58 }],
    } satisfies ProductStory,
  },
  {
    name: "Singular",
    line: "ÉPICOS",
    notes: "Frutado · Complexo · Evolutivo",
    price: "R$ 84",
    priceCents: 8400,
    weight: "500 g",
    tone: "#5C7D5F",
    image: "/brand/products/singular-treated.webp",
    tag: "descoberta",
    story: {
      promise: "Frutado, complexo e evolutivo: uma xícara que muda enquanto esfria e recompensa a atenção.",
      description: "Há mais camadas para perceber e novas sensações aparecem ao longo da xícara. É indicado para quem já gosta de café especial ou quer descobrir até onde uma origem bem trabalhada pode chegar.",
      founderNote: "O Singular fica na memória porque não entrega tudo de uma vez. É um café para provar com curiosidade.",
      bestFor: "degustação, presentes e momentos de descoberta",
      brew: "coado, com água e proporção controladas",
      sensory: [{ label: "Doçura", value: 78 }, { label: "Corpo", value: 58 }, { label: "Frescor", value: 84 }, { label: "Intensidade", value: 72 }],
    } satisfies ProductStory,
  },
  {
    name: "Sublime",
    line: "ÉPICOS",
    notes: "Rapadura · Caramelo · Doçura profunda",
    price: "R$ 84",
    priceCents: 8400,
    weight: "500 g",
    tone: "#5C7D5F",
    image: "/brand/products/sublime-treated.webp",
    tag: "experiência",
    story: {
      promise: "Rapadura, caramelo e doçura profunda em uma xícara longa, densa e contemplativa.",
      description: "O perfil combina doçura intensa e corpo envolvente, com final persistente. É uma experiência mais profunda para quem procura concentração de sabor sem abrir mão do equilíbrio.",
      founderNote: "O Sublime representa profundidade: uma doçura que ocupa a boca, permanece e ainda preserva elegância.",
      bestFor: "rituais sem pressa, presentes e quem busca profundidade",
      brew: "prensa francesa, espresso ou coado mais concentrado",
      sensory: [{ label: "Doçura", value: 92 }, { label: "Corpo", value: 88 }, { label: "Frescor", value: 40 }, { label: "Intensidade", value: 82 }],
    } satisfies ProductStory,
  },
  alexandreMicrolot.product,
];
const collections = [
  {
    name: "Gourmet",
    eyebrow: "Para começar",
    copy: "Perfis macios e doces para a xícara de todos os dias.",
    tone: "#E9BB00",
  },
  {
    name: "Clássicos",
    eyebrow: "A linha de conforto",
    copy: "Doçura reconhecível, corpo e equilíbrio.",
    tone: "#F96D01",
  },
  {
    name: "Épicos",
    eyebrow: "Para explorar",
    copy: "Lotes de maior complexidade e leitura sensorial mais longa.",
    tone: "#5C7D5F",
  },
  {
    name: "Raros",
    eyebrow: "Edições limitadas",
    copy: "Microlotes selecionados em volumes pequenos e safras específicas.",
    tone: "#FF0000",
  },
] as const;

const collectionId = (name: string) =>
  `camada-${name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()}`;

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Cafés especiais brasileiros",
  description: "Escolha por perfil sensorial entre cafés especiais brasileiros com torra própria, origem transparente e curadoria de José e Suzi.",
  alternates: { canonical: "/loja" },
  openGraph: { title: "Bispo Coffees — cafés escolhidos, não apenas vendidos", url: "/loja" },
};

export default async function LojaPage() {
  const [storefrontImages, mediaLibrary] = await Promise.all([
    loadStorefrontImages(),
    loadStorefrontMedia(),
  ]);
  const catalogProducts = products.map((product) => ({
    ...product,
    image: storefrontImages[product.name]?.primary ?? product.image,
  }));
  const featuredGuidance: Record<
    string,
    { eyebrow: string; reason: string }
  > = {
    Essencial: {
      eyebrow: "PARA TODO DIA",
      reason: "Macio e equilibrado para começar pelo conforto.",
    },
    Caramelo: {
      eyebrow: "DOÇURA RECONHECÍVEL",
      reason: "Caramelo e chocolate em uma xícara acolhedora.",
    },
    Sublime: {
      eyebrow: "MAIS PROFUNDIDADE",
      reason: "Uma experiência longa, densa e contemplativa.",
    },
  };
  const featuredProducts = ["Essencial", "Caramelo", "Sublime"]
    .map((name) => catalogProducts.find((product) => product.name === name))
    .filter(
      (product): product is (typeof catalogProducts)[number] =>
        Boolean(product),
    );
  return (
    <StorefrontCartProvider>
      <main className={`${styles.page} ${brand.storefront}`}>
        <ScrollToTopOnLoad />
        <div className={styles.commerceBar}>
          <span>Frete grátis Sul + Sudeste em compras a partir de R$ 270</span>
          <a href="#cafes">Comprar cafés →</a>
        </div>
        <header className={`${styles.header} ${journey.header} ${storyNav.header}`}>
          <a
            href="#top"
            className={styles.brand}
            aria-label="Bispo Coffees — início"
          >
            <Image
              src="/brand/logo/bispo-logo-official-transparent.png"
              width={176}
              height={58}
              alt="Bispo Coffees"
              priority
            />
          </a>
          <nav className={`${styles.nav} ${storyNav.nav}`} aria-label="Navegação principal">
            <a href="#cafes">Cafés</a>
            <a href="#camadas">Escolher</a>
            <Link href="/loja/descobrir">Descobrir o meu</Link>
            <Link href="/loja/sobre">Sobre a Bispo</Link>
            <Link href="/loja/origem">A geografia na xícara</Link>
          </nav>
          <div className={`${styles.actions} ${journey.actions}`}>
            <a
              className={journey.actionLink}
              href="#cafes"
              aria-label="Buscar cafés"
            >
              <Search aria-hidden="true" />
            </a>
            <Link className={journey.actionLink} href="/loja/conta" aria-label="Minha Bispo">
              <UserRound aria-hidden="true" />
            </Link>
            <CartButton />
          </div>
        </header>

        <EditorialHero productImages={storefrontImages} mediaSlots={mediaLibrary.slots} />

        <section
          className={premium.conversionShelf}
          aria-labelledby="comece-por-aqui"
        >
          <header className={premium.conversionIntro}>
            <div>
              <small>COMECE POR AQUI</small>
              <h2 id="comece-por-aqui">
                Três escolhas para comprar sem dúvida.
              </h2>
            </div>
            <p>
              Escolha pelo momento. A moagem é definida na sacola e José e
              Suzi acompanham a curadoria de cada perfil.
            </p>
          </header>
          <div className={premium.featuredGrid}>
            {featuredProducts.map((product) => {
              const guidance = featuredGuidance[product.name] ?? {
                eyebrow: product.tag.toUpperCase(),
                reason: product.story.promise,
              };
              return (
                <article
                  key={product.name}
                  className={premium.featuredCard}
                  style={{ "--featured-tone": product.tone } as React.CSSProperties}
                >
                  <div className={premium.featuredVisual}>
                    {product.image ? (
                      <Image
                        src={product.image}
                        alt={`Embalagem Bispo ${product.name}`}
                        width={180}
                        height={230}
                        sizes="(max-width: 600px) 112px, (max-width: 1050px) 200px, 14vw"
                      />
                    ) : (
                      <span>BISPO</span>
                    )}
                  </div>
                  <div className={premium.featuredCopy}>
                    <small>{guidance.eyebrow}</small>
                    <h3>{product.name}</h3>
                    <p>{guidance.reason}</p>
                    <span>{product.notes}</span>
                    <div>
                      <strong>
                        {product.price} <small>· {product.weight}</small>
                      </strong>
                      <AddToCartButton
                        product={{
                          id: product.name.toLowerCase().replaceAll(" ", "-"),
                          name: product.name,
                          line: product.line,
                          notes: product.notes,
                          priceCents: product.priceCents,
                          weightGrams: Number.parseInt(product.weight, 10),
                          image: product.image,
                          story: product.story,
                        }}
                      >
                        Escolher {product.name} →
                      </AddToCartButton>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <div className={premium.purchaseAssurances}>
            <span>
              <b>Pix simples</b>
              <small>Confirmação automática</small>
            </span>
            <span>
              <b>Moagem à sua escolha</b>
              <small>Definida antes do pagamento</small>
            </span>
            <span>
              <b>Receber regularmente</b>
              <small>Sem cobrança automática</small>
            </span>
            <Link href="/loja/descobrir">Ainda em dúvida? Descubra o seu →</Link>
          </div>
        </section>

        <section id="camadas" className={layers.section}>
          <div className={layers.intro}>
            <div>
              <small>OS CAMINHOS DO BISPO</small>
              <h2>Quatro camadas. Escolha o seu momento.</h2>
            </div>
            <p>
              Do cotidiano aos microlotes, compare os perfis e escolha com
              clareza.
            </p>
          </div>
          <div className={layers.grid}>
            {collections.map((collection, index) => (
              <a
                key={collection.name}
                href={`#${collectionId(collection.name)}`}
                className={layers.card}
                style={
                  { "--layer-tone": collection.tone } as React.CSSProperties
                }
              >
                <span className={layers.number}>0{index + 1}</span>
                <i />
                <strong>{collection.name}</strong>
                <p>{collection.copy}</p>
              </a>
            ))}
          </div>
        </section>

        <section
          className={brand.editorialBridge}
          aria-label="A experiência Bispo"
        >
          <article
            className={brand.editorialLead}
            data-photo-slot="sectional-origin-new-photo"
          >
            <Image
              src={mediaLibrary.slots["home.origin"]?.url ?? "/brand/story/jose-origem.jpeg"}
              alt={mediaLibrary.slots["home.origin"]?.altText ?? "A leitura da origem pela Bispo Coffees"}
              fill
              sizes="(max-width: 800px) 100vw, 58vw"
            />
            <div>
              <small>DA ORIGEM À XÍCARA</small>
              <h2>O café começa muito antes do primeiro gole.</h2>
              <p>
                Relação, prova e escolha. Cada lote chega com uma história que
                José e Suzi fazem questão de preservar.
              </p>
            </div>
          </article>
          <aside
            className={brand.photoManifest}
            data-photo-slot="sectional-ritual-new-photo"
          >
            <span>SELEÇÃO BISPO</span>
            <strong>Da origem, à torra, à xícara.</strong>
            <p>
              Cada lote é escolhido por José e Suzi, torrado pela Bispo e
              apresentado pelo seu perfil sensorial.
            </p>
          </aside>
        </section>

        <section
          id="cafes"
          className={`${styles.productsSection} ${journey.productsSection}`}
        >
          <div className={styles.sectionHeader}>
            <div>
              <small>ESCOLHA O SEU CAFÉ</small>
              <h2>Escolha pelo perfil.</h2>
            </div>
            <p>
              Compare os perfis, escolha a moagem e compre. Se preferir, José e
              Suzi ajudam você a encontrar a xícara certa.
            </p>
          </div>
          <nav className={layers.filter} aria-label="Camadas dos cafés">
            {collections.map((collection) => (
              <a
                key={collection.name}
                href={`#${collectionId(collection.name)}`}
              >
                {collection.name}
              </a>
            ))}
          </nav>
          {collections.map((collection) => {
            const collectionProducts = catalogProducts.filter(
              (product) => product.line === collection.name.toUpperCase(),
            );

            return (
              <div
                key={collection.name}
                id={collectionId(collection.name)}
                className={layers.catalogLayer}
                style={
                  { "--layer-tone": collection.tone } as React.CSSProperties
                }
              >
                <header className={layers.catalogHeader}>
                  <div>
                    <small>{collection.eyebrow}</small>
                    <h3>{collection.name}</h3>
                  </div>
                  <p>{collection.copy}</p>
                </header>
                {collectionProducts.length ? (
                  <div
                    className={`${styles.productGrid} ${
                      collectionProducts.length === 1
                        ? layers.oneProduct
                        : collectionProducts.length === 2
                          ? layers.twoProducts
                          : ""
                    }`}
                  >
                    {collectionProducts.map((p) => (
                      <article
                        key={p.name}
                        id={p.name.toLowerCase().replaceAll(" ", "-")}
                        className={`${styles.productCard} ${journey.productCard}`}
                        style={{ "--tone": p.tone } as React.CSSProperties}
                      >
                        <div
                          className={styles.productVisual}
                          data-photo-slot={`product-${p.name.toLowerCase().replaceAll(" ", "-")}`}
                        >
                          {p.image ? (
                            <img
                              src={p.image}
                              alt={`Embalagem Bispo ${p.name}`}
                              className={`${styles.productPhoto} ${review.editorialProductPhoto}`}
                            />
                          ) : p.name === "Raro" ? (
                            <div className={layers.rarePackagePlaceholder} aria-label="Espaço reservado para a embalagem do café Raro">
                              <small>EDIÇÃO LIMITADA</small>
                              <span>BISPO</span>
                              <b>Raro</b>
                              <em>250 g</em>
                            </div>
                          ) : (
                            <div className={tight.catalogFallback}>
                              <span>BISPO</span>
                              <b>{p.name}</b>
                              <small>SAFRA ATUAL · {p.weight}</small>
                            </div>
                          )}
                          <small>{p.tag}</small>
                        </div>
                        <div className={styles.productMeta}>
                          <p>{p.line}</p>
                          <h3>{p.name}</h3>
                          <span>{p.notes}</span>
                          <ProductDetails
                            product={{
                              id: p.name === "Raro" ? "raros" : p.name.toLowerCase().replaceAll(" ", "-"),
                              name: p.name,
                              line: p.line,
                              notes: p.notes,
                              priceCents: p.priceCents,
                              weightGrams: Number.parseInt(p.weight, 10),
                              image: p.image,
                              priceLabel: p.price,
                              weightLabel: p.weight,
                              tag: p.tag,
                              tone: p.tone,
                            }}
                            story={{
                              ...p.story,
                              proofImages: (
                                mediaLibrary.productProofs[
                                  p.name === "Raro" ? "raros" : p.name.toLowerCase().replaceAll(" ", "-")
                                ] ?? []
                              ).map((photo) => ({
                                src: photo.url,
                                alt: photo.altText,
                                caption: photo.caption ?? photo.title,
                              })),
                            }}
                            detailHref={p.name === "Raro" ? `/loja/cafes/${alexandreMicrolot.slug}` : undefined}
                            detailLabel={p.name === "Raro" ? "Conhecer este lote →" : undefined}
                          />
                          <div className={`${styles.buyRow} ${premium.buyRow}`}>
                            <strong>
                              {p.price} <small>· {p.weight}</small>
                            </strong>
                            <AddToCartButton
                              product={{
                                id: p.name === "Raro" ? "raros" : p.name.toLowerCase().replaceAll(" ", "-"),
                                name: p.name,
                                line: p.line,
                                notes: p.notes,
                                priceCents: p.priceCents,
                                weightGrams: Number.parseInt(p.weight, 10),
                                image: p.image,
                                story: p.story,
                              }}
                            >
                              Adicionar à sacola
                            </AddToCartButton>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className={layers.rareNote}>
                    <span>EDIÇÕES LIMITADAS · 250 G</span>
                    <strong>
                      Os Raros aparecem quando a safra revela algo
                      extraordinário.
                    </strong>
                    <Link href="/loja/descobrir">Descobrir meu perfil →</Link>
                  </div>
                )}
              </div>
            );
          })}
          <div className={styles.allProducts}>
            <a href="#camadas">Voltar às quatro camadas ↑</a>
            <Link href="/loja/descobrir">
              Não sabe qual escolher? Descubra o seu →
            </Link>
          </div>
        </section>

        <section
          className={founder.section}
          data-photo-slot="founders-jose-suzi"
        >
          <div className={founder.photos}>
            <figure className={founder.portrait}>
              <img
                src={mediaLibrary.slots["founder.jose.portrait"]?.url ?? "/brand/founders/jose-rezende.jpg"}
                alt={mediaLibrary.slots["founder.jose.portrait"]?.altText ?? "José Rezende avaliando um café"}
              />
              <figcaption>JOSÉ · ORIGEM E PROVA</figcaption>
            </figure>
            <figure className={founder.portrait}>
              <img
                src={mediaLibrary.slots["founder.suzi.portrait"]?.url ?? "/brand/founders/suzi-ninov.jpg"}
                alt={mediaLibrary.slots["founder.suzi.portrait"]?.altText ?? "Suzi Ninov avaliando um café"}
              />
              <figcaption>SUZI · CRITÉRIO E CUIDADO</figcaption>
            </figure>
          </div>
          <div
            className={`${tight.foundersCopy} ${journey.foundersCopy} ${founder.copy}`}
          >
            <small>O BISPO · A BISPO</small>
            <h2>O Bispo é José. A Bispo é José e Suzi.</h2>
            <p className={founder.sharedStory}>
              A marca reúne dois percursos reais: José, do produtor ao mercado
              internacional; Suzi, da planta e do solo à qualidade. A escolha
              final é construída pelos dois.
            </p>
            <div className={founder.proofs}>
              <p>
                <b>José Rezende</b>
                <br />
                No campo desde 2003. Q-Grader e, em 2015, cofundador da
                Capricornio Coffees.
              </p>
              <p>
                <b>Suzi Ninov</b>
                <br />
                No Paraná desde 2006, une nutrição, manejo, produtividade e
                qualidade na relação com produtores.
              </p>
            </div>
            <div className={founder.trust} aria-label="Critérios Bispo">
              <span>Campo · desde 2003</span>
              <span>Suzi · Paraná desde 2006</span>
              <span>Mercado internacional · desde 2015</span>
            </div>
            <div className={founder.actions}>
              <a className={founder.primary} href="#cafes">
                Ver os cafés escolhidos →
              </a>
              <Link className={founder.secondary} href="/loja/sobre">
                Conhecer nossa história
              </Link>
            </div>
          </div>
        </section>

        <SensoryConcierge />

        <section className={styles.valueStrip}>
          <span>Perfis claros.</span>
          <span>Torra própria.</span>
          <span>Constância de xícara.</span>
          <span>Frete grátis Sul + Sudeste · R$ 270+</span>
        </section>
        <footer className={`${styles.footer} ${premium.footer}`}>
          <div className={styles.footerBrand}>
            <Image
              src="/brand/logo/bispo-logo-official-transparent.png"
              width={150}
              height={50}
              alt="Bispo Coffees"
              className={journey.footerLogo}
            />
            <p>Sourcing Brazilian Coffees for the World.</p>
          </div>
          <div className={styles.footerNav}>
            <strong>Explorar</strong>
            <Link href="/loja/descobrir">Descubra o seu café</Link>
            <Link href="/loja/sobre">Sobre a Bispo</Link>
            <Link href="/loja/origem">A geografia na xícara</Link>
          </div>
          <div className={styles.footerNav}>
            <strong>Comprar</strong>
            <a href="#cafes">Todos os cafés</a>
            <a href="#camadas">Escolher por sensação</a>
          </div>
          <div className={styles.footerNav}>
            <strong>Atendimento</strong>
            <Link href="/loja/entrega-e-devolucoes">Entrega e devoluções</Link>
            <Link href="/loja/termos-de-compra">Termos de compra</Link>
            <a href="mailto:pedidos@bispocoffees.com.br">pedidos@bispocoffees.com.br</a>
          </div>
          <div className={styles.footerBottom}>
            <span>Bispo Coffees Ltda · CNPJ 13.008.726/0001-12 · Londrina, PR</span>
            <span><Link href="/aviso-privacidade">Privacidade</Link> · © {new Date().getFullYear()}</span>
          </div>
        </footer>
      </main>
    </StorefrontCartProvider>
  );
}
