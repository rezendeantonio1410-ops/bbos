import Image from "next/image";
import Link from "next/link";
import { Search, ShoppingBag, UserRound } from "lucide-react";
import styles from "./sales.module.css";
import tight from "./sales-tight.module.css";
import review from "./hero-review.module.css";
import journey from "./conversion-review.module.css";
import ScrollToTopOnLoad from "./ScrollToTopOnLoad";

const products = [
  {
    name: "Essencial",
    line: "GOURMET",
    notes: "Macio · Doce · Fácil",
    price: "R$ 52",
    weight: "500 g",
    tone: "#E6C838",
    image: "/essencial.jpeg",
    tag: "para todo dia",
  },
  {
    name: "Caramelo",
    line: "CLÁSSICOS",
    notes: "Caramelo · Chocolate · Equilíbrio",
    price: "R$ 68",
    weight: "500 g",
    tone: "#D97830",
    image: "/caramelo.jpeg",
    tag: "conforto",
  },
  {
    name: "Doce de Leite",
    line: "CLÁSSICOS",
    notes: "Mascavo · Doce de leite · Alfajor",
    price: "R$ 68",
    weight: "500 g",
    tone: "#C89725",
    image: null,
    tag: "doçura",
  },
  {
    name: "Tangerina",
    line: "CLÁSSICOS",
    notes: "Cítrico · Doce · Fresco",
    price: "R$ 68",
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
    weight: "500 g",
    tone: "#3B7651",
    image: "/singular.jpeg",
    tag: "descoberta",
  },
  {
    name: "Sublime",
    line: "ÉPICOS",
    notes: "Expressivo · Elegante · Profundo",
    price: "R$ 84",
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

export default function LojaPage() {
  return (
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
          <a href="#cafes">Cafés</a>
          <a href="#escolher">Escolher</a>
          <Link href="/loja/descobrir">Descobrir o meu</Link>
          <Link href="/loja/sobre">Sobre a Bispo</Link>
        </nav>
        <div className={`${styles.actions} ${journey.actions}`}>
          <button type="button" aria-label="Buscar cafés">
            <Search aria-hidden="true" />
          </button>
          <button type="button" aria-label="Minha conta">
            <UserRound aria-hidden="true" />
          </button>
          <button type="button" aria-label="Sacola de compras">
            <ShoppingBag aria-hidden="true" />
          </button>
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
            Caramelo e chocolate. Doce na medida. Daqueles cafés que pedem outra
            xícara.
          </p>
          <div
            className={`${tight.productDesireStage} ${review.productDesireStage}`}
            data-photo-slot="hero-product-real-caramelo"
          >
            <div className={tight.productAura} />
            <div className={`${tight.productShot} ${review.productShot}`}>
              <Image
                src="/caramelo.jpeg"
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
            <a
              className={`${tight.sensoryCta} ${review.sensoryCta}`}
              href="#caramelo"
            >
              Quero o Caramelo <span>→</span>
            </a>
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
        <div className={styles.productGrid}>
          {products.map((p) => (
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
                    className={styles.productPhoto}
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
                  <button type="button" aria-label={`Escolher ${p.name}`}>
                    Quero esse →
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
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
            <small>Perfis claros tornam a próxima escolha mais simples.</small>
          </span>
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
            extraordinários e experiências que talvez nunca se repitam da mesma
            forma.
          </p>
        </div>
        <a href="#cafes">Conhecer os Raros →</a>
      </section>

      <section className={tight.founders} data-photo-slot="founders-jose-suzi">
        <div
          className={tight.foundersPhoto}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
            overflow: "hidden",
          }}
        >
          <img
            src="/brand/founders/jose-rezende.jpg"
            alt="José Rezende — Bispo Coffees"
            style={{
              width: "100%",
              height: "100%",
              minHeight: "420px",
              objectFit: "cover",
              objectPosition: "center",
              display: "block",
            }}
          />
          <img
            src="/brand/founders/suzi-ninov.jpg"
            alt="Suzi Ninov — Bispo Coffees"
            style={{
              width: "100%",
              height: "100%",
              minHeight: "420px",
              objectFit: "cover",
              objectPosition: "center",
              display: "block",
            }}
          />
        </div>
        <div className={`${tight.foundersCopy} ${journey.foundersCopy}`}>
          <small>BRASIL → BARCELONA → MUNDO</small>
          <h2>
            Duas histórias.
            <br />
            <em>Uma mesma obsessão pelo café.</em>
          </h2>
          <p>
            <b>José Rezende — o Bispo</b>
            <br />
            Da lavoura à prova e ao mercado internacional, uma vida dedicada a
            reconhecer qualidade na xícara.
          </p>
          <p>
            <b>Suzi Ninov</b>
            <br />
            Próxima do produtor e da origem, conecta qualidade às pessoas e ao
            trabalho que tornam cada café possível.
          </p>
          <p className={journey.internationalProof}>
            <b>Uma história que atravessou fronteiras</b>
            <br />
            Da Bispo Coffees no Brasil à Bispo Coffees Europe SL, em Barcelona:
            uma operação internacional construída na prática, café por café.
          </p>
          <Link href="/loja/sobre">
            Conheça José, Suzi e a história da Bispo →
          </Link>
        </div>
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
  );
}
