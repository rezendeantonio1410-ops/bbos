import Image from "next/image";
import Link from "next/link";
import { Search, UserRound } from "lucide-react";
import styles from "./sales.module.css";
import tight from "./sales-tight.module.css";
import review from "./hero-review.module.css";
import journey from "./conversion-review.module.css";
import founder from "./founder-trust.module.css";
import layers from "./layers.module.css";
import ScrollToTopOnLoad from "./ScrollToTopOnLoad";
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
    tone: "#E6C838",
    image: "/brand/products/essencial-treated.webp",
    tag: "para todo dia",
  },
  {
    name: "Caramelo",
    line: "CLÁSSICOS",
    notes: "Caramelo · Chocolate · Equilíbrio",
    price: "R$ 68",
    priceCents: 6800,
    weight: "500 g",
    tone: "#D97830",
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
    tone: "#C89725",
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
    tone: "#E48725",
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
    tone: "#3B7651",
    image: "/brand/products/singular-treated.webp",
    tag: "descoberta",
  },
  {
    name: "Sublime",
    line: "ÉPICOS",
    notes: "Expressivo · Elegante · Profundo",
    price: "R$ 84",
    priceCents: 8400,
    weight: "500 g",
    tone: "#4D8060",
    image: null,
    tag: "experiência",
  },
];
const moments = [
  {
    title: "Todo dia",
    copy: "Macio, doce e fácil de reencontrar.",
    tone: "#E6C838",
  },
  {
    title: "Conforto",
    copy: "Caramelo, chocolate e uma xícara acolhedora.",
    tone: "#D97830",
  },
  {
    title: "Frescor",
    copy: "Fruta, leveza e uma xícara mais viva.",
    tone: "#3B7651",
  },
];

const collections = [
  {
    name: "Gourmet",
    eyebrow: "Cotidiano sofisticado",
    copy: "Cafés fáceis de gostar e feitos para acompanhar todos os dias.",
    tone: "#E6C838",
  },
  {
    name: "Clássicos",
    eyebrow: "Conforto e identidade",
    copy: "Sabores familiares, doces e presentes — com a leitura do Bispo.",
    tone: "#D97830",
  },
  {
    name: "Épicos",
    eyebrow: "Complexidade e descoberta",
    copy: "Cafés expressivos para quem deseja explorar novas camadas da xícara.",
    tone: "#3B7651",
  },
  {
    name: "Raros",
    eyebrow: "Pequenos lotes",
    copy: "Experiências excepcionais, selecionadas em quantidades limitadas.",
    tone: "#263C32",
  },
] as const;

const collectionId = (name: string) =>
  `camada-${name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()}`;

export default function LojaPage() {
  return (
    <StorefrontCartProvider>
      <main className={styles.page}>
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
            <a href="#camadas">Cafés</a>
            <a href="#escolher">Escolher</a>
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

        <section
          id="top"
          className={`${styles.hero} ${tight.hero} ${review.hero}`}
        >
          <div
            className={`${styles.heroMedia} ${tight.heroMedia} ${review.heroMedia}`}
            data-photo-slot="hero-chemex-ceramic-nature"
          >
            <Image
              src="/brand/visuals/bispo-hero-chemex-v2.png"
              alt="Café Bispo preparado em Chemex"
              fill
              priority
              sizes="(max-width: 960px) 100vw, 52vw"
            />
          </div>
          <div
            className={`${styles.heroCopy} ${tight.heroCopy} ${review.heroCopy}`}
          >
            <div className={tight.sensoryTopline}>
              <span>CLÁSSICOS</span>
              <i />
              <b>CARAMELO</b>
            </div>
            <h1 className={tight.sensoryTitle}>
              Doce. Confortável.
              <br />
              <em>Equilibrado.</em>
            </h1>
            <p className={`${styles.subcopy} ${tight.shortCopy}`}>
              Caramelo e chocolate. Doce na medida. Daqueles cafés que pedem
              outra xícara.
            </p>
            <div
              className={`${tight.productDesireStage} ${review.productDesireStage}`}
              data-photo-slot="hero-product-real-caramelo"
            >
              <div className={tight.productAura} />
              <div className={`${tight.productShot} ${review.productShot}`}>
                <Image
                  src="/brand/products/caramelo-treated.webp"
                  alt="Embalagem real do café Caramelo, Bispo Coffees"
                  fill
                  sizes="(max-width: 600px) 148px, 202px"
                />
              </div>
              <div className={`${tight.flavorWhisper} ${tight.flavorTop}`}>
                <b>caramelo</b>
                <span>doçura envolvente</span>
              </div>
              <div className={`${tight.flavorWhisper} ${tight.flavorMiddle}`}>
                <b>chocolate</b>
                <span>corpo presente</span>
              </div>
              <div className={`${tight.flavorWhisper} ${tight.flavorBottom}`}>
                <b>equilíbrio</b>
                <span>acidez delicada</span>
              </div>
            </div>
            <div className={tight.sensoryPromise}>
              <span>100% Arábica</span>
              <span>Torra própria</span>
              <span>Selecionado na origem</span>
            </div>
            <div className={`${tight.sensoryBuyRow} ${review.sensoryBuyRow}`}>
              <div>
                <small>500 g · em grãos</small>
                <strong>R$ 68,00</strong>
              </div>
              <AddToCartButton
                className={`${tight.sensoryCta} ${review.sensoryCta}`}
                product={{
                  id: "caramelo",
                  name: "Caramelo",
                  line: "CLÁSSICOS",
                  notes: "Caramelo · Chocolate · Equilíbrio",
                  priceCents: 6800,
                  weightGrams: 500,
                  image: "/brand/products/caramelo-treated.webp",
                }}
              >
                Quero o Caramelo <span>→</span>
              </AddToCartButton>
            </div>
            <Link
              className={`${tight.sensoryAssist} ${review.sensoryAssist}`}
              href="/loja/descobrir"
            >
              <span>Não é o seu perfil?</span> Descubra o café que combina com
              você <b>→</b>
            </Link>
          </div>
        </section>

        <section id="camadas" className={layers.section}>
          <div className={layers.intro}>
            <small>OS CAMINHOS DO BISPO</small>
            <h2>Quatro camadas. Uma escolha para cada momento.</h2>
            <p>
              Do café que acompanha o cotidiano aos lotes que aparecem poucas
              vezes. Não é uma escala de qualidade — é uma jornada de sabor,
              ocasião e descoberta.
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
                <small>{collection.eyebrow}</small>
                <strong>{collection.name}</strong>
                <p>{collection.copy}</p>
                <b>Conhecer esta camada →</b>
              </a>
            ))}
          </div>
          <p className={layers.signature}>
            Você escolhe pelo momento. <b>O Bispo conduz pela xícara.</b>
          </p>
        </section>

        <section
          className={`${tight.valueBridge} ${journey.valueBridge}`}
          aria-label="Por que Bispo"
        >
          <small>POR QUE A BISPO ENTREGA MAIS</small>
          <h2>
            Você não precisa entender de café
            <br />
            para beber um café extraordinário.
          </h2>
          <p>
            A parte técnica acontece antes. Para você, fica o que importa:{" "}
            <b>reconhecer o que gosta e escolher bem.</b>
          </p>
          <div>
            <span>
              <b>Selecionado</b>
              <small>na origem</small>
            </span>
            <i />
            <span>
              <b>Provado</b>
              <small>por nós</small>
            </span>
            <i />
            <span>
              <b>Torrado</b>
              <small>para o perfil</small>
            </span>
          </div>
        </section>

        <section
          id="escolher"
          className={`${styles.choiceSection} ${journey.choiceSection}`}
        >
          <div className={styles.choiceIntro}>
            <small>COMECE PELO QUE VOCÊ QUER SENTIR</small>
            <h2>Qual xícara combina com o seu momento?</h2>
            <p>Você escolhe a sensação. A Bispo cuida do resto.</p>
          </div>
          <div className={styles.choiceGrid}>
            {moments.map((m) => (
              <a
                key={m.title}
                href="#cafes"
                className={styles.choiceCard}
                style={{ "--tone": m.tone } as React.CSSProperties}
              >
                <i />
                <span>{m.copy}</span>
                <strong>{m.title}</strong>
                <b>encontrar meu café →</b>
              </a>
            ))}
            <Link
              href="/loja/descobrir"
              className={`${styles.choiceCard} ${styles.discoveryChoice}`}
            >
              <i />
              <span>Quero provar algo fora do óbvio.</span>
              <strong>Me surpreenda</strong>
              <b>começar descoberta →</b>
            </Link>
          </div>
        </section>

        <section
          id="cafes"
          className={`${styles.productsSection} ${journey.productsSection}`}
        >
          <div className={styles.sectionHeader}>
            <div>
              <small>CAFÉS BISPO</small>
              <h2>
                Você sente primeiro.
                <br />
                Depois escolhe o nome.
              </h2>
            </div>
            <p>
              Perfis claros para você reconhecer o que gosta — e saber o que
              esperar da próxima xícara.
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
                      <small>EMBALAGEM EM PREPARAÇÃO</small>
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
            <a href="#cafes">Explorar todos os cafés →</a>
            <Link href="/loja/descobrir">
              Não sabe qual escolher? Descubra o seu →
            </Link>
          </div>
        </section>

        <section className={`${styles.desireBand} ${journey.desireBand}`}>
          <div>
            <small>POR QUE BISPO</small>
            <h2>
              Você só precisa gostar da xícara.
              <br />O conhecimento fica com a gente.
            </h2>
          </div>
          <div className={styles.valueCards}>
            <span>
              <b>Escolhido pelo que entrega</b>
              <small>Selecionamos cafés pelo resultado real na xícara.</small>
            </span>
            <span>
              <b>Provado e torrado por nós</b>
              <small>Buscamos doçura, equilíbrio e identidade.</small>
            </span>
            <span>
              <b>Gostou? Você reencontra</b>
              <small>
                Perfis claros tornam a próxima escolha mais simples.
              </small>
            </span>
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
              José e Suzi unem campo, prova, produção e mercado para fazer a
              escolha difícil antes. Você recebe um café fácil de reconhecer,
              desejar e reencontrar.
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
                Produção, sustentabilidade e o cuidado que preserva cada
                escolha.
              </p>
            </div>
            <p className={founder.sharedStory}>
              Duas trajetórias, uma escolha construída em conjunto — do café
              verde exportado para a Europa aos mesmos padrões agora servidos no
              Brasil.
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

        <section className={`${styles.discovery} ${journey.discovery}`}>
          <div className={styles.discoveryCopy}>
            <small>AINDA NÃO SABE QUAL?</small>
            <h2>
              Você sente.
              <br />A Bispo traduz.
            </h2>
            <p>
              Escolha o que quer sentir. A gente transforma isso em uma
              recomendação simples, visual e fácil de comprar.
            </p>
            <Link href="/loja/descobrir">Descobrir o meu café →</Link>
          </div>
          <div className={styles.discoveryVisual}>
            <div className={styles.ring}>
              <i />
              <i />
              <i />
              <i />
              <b>
                SUA
                <br />
                XÍCARA
              </b>
            </div>
            <span>doce</span>
            <span>frutado</span>
            <span>fresco</span>
            <span>intenso</span>
          </div>
        </section>

        <section className={`${styles.rareSection} ${journey.rareSection}`}>
          <div>
            <small>RAROS · PEQUENOS LOTES, GRANDES XÍCARAS</small>
            <h2>Alguns cafés existem para ser lembrados.</h2>
            <p>
              Microlotes de produção limitada, escolhidos por perfis
              extraordinários e experiências que talvez nunca se repitam da
              mesma forma.
            </p>
          </div>
          <a href="#cafes">Conhecer os Raros →</a>
        </section>

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
            <a href="#escolher">Escolher por sensação</a>
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
