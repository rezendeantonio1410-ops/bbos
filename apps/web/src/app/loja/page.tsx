import Image from "next/image";
import Link from "next/link";
import { Search, UserRound } from "lucide-react";
import styles from "./sales.module.css";
import tight from "./sales-tight.module.css";
import review from "./hero-review.module.css";
import journey from "./conversion-review.module.css";
import founder from "./founder-trust.module.css";
import layers from "./layers.module.css";
import brand from "./brand-review.module.css";
import ScrollToTopOnLoad from "./ScrollToTopOnLoad";
import SensoryConcierge from "./SensoryConcierge";
import EditorialHero from "./EditorialHero";
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
  },
];
const collections = [
  {
    name: "Gourmet",
    eyebrow: "Para começar",
    copy: "Cafés fáceis de gostar, escolhidos para transformar o cotidiano em ritual.",
    tone: "#E9BB00",
  },
  {
    name: "Clássicos",
    eyebrow: "A linha de conforto",
    copy: "Perfis doces, envolventes e fáceis de reconhecer, com personalidade.",
    tone: "#F96D01",
  },
  {
    name: "Épicos",
    eyebrow: "Para explorar",
    copy: "Cafés de alta pontuação para quem busca complexidade e descoberta.",
    tone: "#5C7D5F",
  },
  {
    name: "Raros",
    eyebrow: "Edições limitadas",
    copy: "O extraordinário em pequenas edições: microlotes de produção limitada.",
    tone: "#FF0000",
  },
] as const;

const collectionId = (name: string) =>
  `camada-${name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()}`;

export default function LojaPage() {
  return (
    <StorefrontCartProvider>
      <main className={`${styles.page} ${brand.storefront}`}>
        <ScrollToTopOnLoad />
        <div className={styles.commerceBar}>
          <span>Frete grátis Sul + Sudeste em compras a partir de R$ 270</span>
          <a href="#cafes">Comprar cafés →</a>
        </div>
        <header className={`${styles.header} ${journey.header}`}>
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
          <nav className={styles.nav} aria-label="Navegação principal">
            <a href="#cafes">Cafés</a>
            <a href="#camadas">Escolher</a>
            <Link href="/loja/descobrir">Descobrir o meu</Link>
            <Link href="/loja/sobre">Sobre a Bispo</Link>
          </nav>
          <div className={`${styles.actions} ${journey.actions}`}>
            <a
              className={journey.actionLink}
              href="#cafes"
              aria-label="Buscar cafés"
            >
              <Search aria-hidden="true" />
            </a>
            <Link
              className={journey.actionLink}
              href="/login"
              aria-label="Minha conta"
            >
              <UserRound aria-hidden="true" />
            </Link>
            <CartButton />
          </div>
        </header>

        <EditorialHero />

        <section id="camadas" className={layers.section}>
          <div className={layers.intro}>
            <div>
              <small>OS CAMINHOS DO BISPO</small>
              <h2>Quatro camadas. Escolha o seu momento.</h2>
            </div>
            <p>
              Do cotidiano aos pequenos lotes: encontre rapidamente o perfil
              que combina com a sua xícara.
            </p>
          </div>
          <div className={layers.grid}>
            {collections.map((collection, index) => (
              <a
                key={collection.name}
                href={`#${collectionId(collection.name)}`}
                className={layers.card}
                style={{ "--layer-tone": collection.tone } as React.CSSProperties}
              >
                <span className={layers.number}>0{index + 1}</span>
                <i />
                <strong>{collection.name}</strong>
                <p>{collection.copy}</p>
              </a>
            ))}
          </div>
        </section>

        <section className={brand.editorialBridge} aria-label="A experiência Bispo">
          <article className={brand.editorialLead} data-photo-slot="sectional-origin-new-photo">
            <Image src="/brand/story/jose-origem.jpeg" alt="A leitura da origem pela Bispo Coffees" fill sizes="(max-width: 800px) 100vw, 58vw" />
            <div><small>DA ORIGEM À XÍCARA</small><h2>O café começa muito antes do primeiro gole.</h2><p>Relação, prova e escolha. Cada lote chega com uma história que José e Suzi fazem questão de preservar.</p></div>
          </article>
          <aside className={brand.photoManifest} data-photo-slot="sectional-ritual-new-photo">
            <span>FOTO EDITORIAL 02</span>
            <strong>O seu ritual, com a assinatura Bispo.</strong>
            <p>Espaço preparado para a nova fotografia de preparo e desejo.</p>
          </aside>
        </section>

        <section
          id="cafes"
          className={`${styles.productsSection} ${journey.productsSection}`}
        >
          <div className={styles.sectionHeader}>
            <div>
              <small>ESCOLHA O SEU CAFÉ</small>
              <h2>Da sensação para a sua sacola.</h2>
            </div>
            <p>
              Compare os perfis, escolha a moagem e compre. Se preferir, o
              Bispo ajuda você a encontrar a xícara certa.
            </p>
          </div>
          <nav className={layers.filter} aria-label="Camadas dos cafés">
            {collections.map((collection) => (
              <a key={collection.name} href={`#${collectionId(collection.name)}`}>
                {collection.name}
              </a>
            ))}
          </nav>
          {collections.map((collection) => {
            const collectionProducts = products.filter(
              (product) => product.line === collection.name.toUpperCase(),
            );

            return (
              <div
                key={collection.name}
                id={collectionId(collection.name)}
                className={layers.catalogLayer}
                style={{ "--layer-tone": collection.tone } as React.CSSProperties}
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
                    <Image
                      src={p.image}
                      alt={`Embalagem Bispo ${p.name}`}
                      fill
                      sizes="(max-width: 600px) 100vw, (max-width: 1100px) 50vw, 33vw"
                      className={`${styles.productPhoto} ${review.editorialProductPhoto}`}
                    />
                  ) : (
                    <div className={tight.catalogFallback}>
                      <span>BISPO</span>
                      <b>{p.name}</b>
                      <small>NOVA COLHEITA · EM BREVE</small>
                    </div>
                  )}
                  <small>{p.tag}</small>
                </div>
                <div className={styles.productMeta}>
                  <p>{p.line}</p>
                  <h3>{p.name}</h3>
                  <span>{p.notes}</span>
                  <div className={styles.buyRow}>
                    <strong>
                      {p.price} <small>· {p.weight}</small>
                    </strong>
                    <AddToCartButton
                      product={{
                        id: p.name.toLowerCase().replaceAll(" ", "-"),
                        name: p.name,
                        line: p.line,
                        notes: p.notes,
                        priceCents: p.priceCents,
                        weightGrams: 500,
                        image: p.image,
                      }}
                    >
                      Quero esse →
                    </AddToCartButton>
                  </div>
                </div>
              </article>
                    ))}
                  </div>
                ) : (
                  <div className={layers.rareNote}>
                    <span>EDIÇÕES LIMITADAS · 250 G</span>
                    <strong>Os Raros aparecem quando a safra revela algo extraordinário.</strong>
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
                src="/brand/founders/jose-rezende.jpg"
                alt="José Rezende avaliando um café"
              />
              <figcaption>JOSÉ · ORIGEM E PROVA</figcaption>
            </figure>
            <figure className={founder.portrait}>
              <img
                src="/brand/founders/suzi-ninov.jpg"
                alt="Suzi Ninov avaliando um café"
              />
              <figcaption>SUZI · CRITÉRIO E CUIDADO</figcaption>
            </figure>
          </div>
          <div
            className={`${tight.foundersCopy} ${journey.foundersCopy} ${founder.copy}`}
          >
            <small>QUEM ESCOLHE O SEU CAFÉ</small>
            <h2>
              Antes da sua xícara,
              <br />
              <em>cada café passa por nós.</em>
            </h2>
            <p className={founder.intro}>
              José é o Bispo. José e Suzi são a Bispo Coffees: duas histórias
              próprias no café, unidas para escolher, provar e preservar a
              identidade de cada xícara.
            </p>
            <div className={founder.proofs}>
              <p>
                <b>José Rezende</b>
                <br />
                Desde 2003 entre produtores, prova e mercados internacionais.
              </p>
              <p>
                <b>Suzi Ninov</b>
                <br />
                Cofundadora, com trajetória própria no café, visão de produção,
                sustentabilidade e o cuidado que preserva cada escolha.
              </p>
            </div>
            <p className={founder.sharedStory}>
              Parceiros de vida e de projeto, constroem juntos a Bispo de
              verdade — do café verde levado ao mercado europeu à xícara
              servida no Brasil.
            </p>
            <div className={founder.trust} aria-label="Critérios Bispo">
              <span>Provado por nós</span>
              <span>Torra própria</span>
              <span>Brasil e Europa</span>
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
        <footer className={styles.footer}>
          <div className={styles.footerBrand}>
            <Image
              src="/brand/logo/bispo-logo-official-transparent.png"
              width={150}
              height={50}
              alt="Bispo Coffees"
              className={journey.footerLogo}
            />
            <p>Café para escolher, desejar, reencontrar e lembrar.</p>
          </div>
          <div className={styles.footerNav}>
            <strong>Explorar</strong>
            <Link href="/loja/descobrir">Descubra o seu café</Link>
            <Link href="/loja/sobre">Sobre a Bispo</Link>
          </div>
          <div className={styles.footerNav}>
            <strong>Comprar</strong>
            <a href="#cafes">Todos os cafés</a>
            <a href="#camadas">Escolher por sensação</a>
          </div>
          <div className={styles.footerBottom}>
            <span>Bispo Coffees · Brasil</span>
            <Link href="/bbos">Área interna</Link>
          </div>
        </footer>
      </main>
    </StorefrontCartProvider>
  );
}
