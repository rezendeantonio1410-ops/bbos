import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import styles from "../page.module.css";
import brand from "../brand-review.module.css";
import storyNav from "../story-navigation.module.css";
import premium from "../premium-overrides.module.css";
import MobileStoreMenu from "../MobileStoreMenu";
import journal from "./page.module.css";

export const metadata: Metadata = {
  title: "Caderno Bispo — cenas de origem, prova e ritual",
  description:
    "Um arquivo vivo do trabalho que acontece antes de cada café Bispo: campo, seleção, prova, preparo e pessoas.",
  alternates: { canonical: "/loja/caderno" },
  openGraph: {
    title: "Caderno Bispo — cenas de origem, prova e ritual",
    description:
      "Campo, seleção, prova, preparo e pessoas: o que acontece antes de um café se tornar Bispo.",
    url: "/loja/caderno",
    type: "website",
    images: ["/brand/editorial/real/jose-suzi-prova.jpg"],
  },
};

export const revalidate = 300;

const fieldScenes = [
  {
    image: "/brand/products/raros/alexandre-produtor.webp",
    alt: "Carlos Alexandre Siqueira na lavoura de café",
    eyebrow: "PESSOAS · SÃO JERÔNIMO DA SERRA",
    title: "Uma história cultivada com persistência.",
    text: "O lote começa na relação com quem planta. Conhecer a trajetória do produtor ajuda a compreender cada decisão de manejo e cada safra.",
  },
  {
    image: "/brand/products/raros/alexandre-lavoura.webp",
    alt: "Lavoura de café de Carlos Alexandre Siqueira",
    eyebrow: "LAVOURA · NORTE DO PARANÁ",
    title: "Acompanhar antes de escolher.",
    text: "A leitura acontece ao longo do ciclo: planta, solo, maturação e contexto. A qualidade não nasce apenas no dia da prova.",
  },
  {
    image: "/brand/products/raros/alexandre-secagem.webp",
    alt: "Café secando na propriedade de Carlos Alexandre Siqueira",
    eyebrow: "PÓS-COLHEITA · SAFRA 26/27",
    title: "O processo também deixa assinatura.",
    text: "Colheita e secagem preservam o trabalho construído no campo e definem parte importante do que a xícara poderá revelar.",
  },
];

const cupScenes = [
  {
    image: "/brand/editorial/real/suzi-prova.jpg",
    alt: "Suzi Ninov avaliando o aroma de um café",
    eyebrow: "SUZI · CRITÉRIO E CUIDADO",
    title: "Provar é comparar com memória e atenção.",
  },
  {
    image: "/brand/editorial/real/jose-prova.jpg",
    alt: "José Rezende avaliando um café em prova",
    eyebrow: "JOSÉ · ORIGEM E PROVA",
    title: "A qualidade precisa se confirmar na xícara.",
  },
  {
    image: "/brand/editorial/real/preparo-agua.jpg",
    alt: "Água sendo adicionada às xícaras durante uma prova de café",
    eyebrow: "MÉTODO · ÁGUA E TEMPO",
    title: "Repetir o gesto reduz o acaso.",
  },
];

const ritualScenes = [
  {
    image: "/brand/editorial/real/sublime-ritual.jpg",
    alt: "Café Sublime servido com método filtrado",
    eyebrow: "SUBLIME · FILTRADO",
    title: "Uma pausa que pede presença.",
    text: "O preparo deixa de ser tarefa e vira parte da experiência: água, tempo e atenção a serviço da xícara.",
  },
  {
    image: "/brand/editorial/real/singular-ritual.jpg",
    alt: "Café Singular em um ritual de preparo",
    eyebrow: "SINGULAR · DESCOBERTA",
    title: "O café muda enquanto esfria.",
    text: "Algumas xícaras entregam novas camadas quando recebem tempo. O ritual cria espaço para percebê-las.",
  },
  {
    image: "/brand/editorial/real/jose-preparo.jpg",
    alt: "José Rezende preparando café em método filtrado",
    eyebrow: "PREPARO · PRECISÃO",
    title: "Técnica para revelar, não para complicar.",
    text: "Boa moagem, proporção e temperatura tornam o preparo mais consistente — e deixam o café falar com clareza.",
  },
];

const relatedCoffees = [
  {
    name: "Sublime",
    note: "Cereja descascado, rapadura e caramelo.",
    image: "/brand/products/real/sublime-frontal.jpg",
    href: "/loja#sublime",
  },
  {
    name: "Singular",
    note: "Frutado, complexo e evolutivo.",
    image: "/brand/products/real/singular-frontal.jpg",
    href: "/loja#singular",
  },
  {
    name: "Raro · Carlos Alexandre",
    note: "Rastreabilidade absoluta e um lote que não se repete.",
    image: "/brand/products/real/raro-frontal.jpg",
    href: "/loja/cafes/carlos-alexandre-safra-2026",
  },
];

export default function CadernoPage() {
  return (
    <main className={`${styles.page} ${brand.storefront} ${journal.page}`}>
      <div className={styles.commerceBar}>
        <span>Frete grátis Sul + Sudeste em compras a partir de R$ 270</span>
        <Link href="/loja#cafes">Escolher cafés →</Link>
      </div>
      <header className={`${styles.header} ${storyNav.header}`}>
        <Link
          href="/loja"
          className={styles.brand}
          aria-label="Bispo Coffees — loja"
        >
          <Image
            src="/brand/logo/bispo-logo-official-transparent.png"
            width={176}
            height={58}
            alt="Bispo Coffees"
            priority
          />
        </Link>
        <nav
          className={`${styles.nav} ${storyNav.nav} ${premium.desktopNav}`}
          aria-label="Navegação principal"
        >
          <Link href="/loja#cafes">Cafés</Link>
          <Link href="/loja#camadas">Escolher</Link>
          <Link href="/loja/descobrir">Descobrir o meu</Link>
          <Link href="/loja/sobre">Sobre a Bispo</Link>
          <Link href="/loja/caderno" aria-current="page">
            Caderno
          </Link>
        </nav>
        <div className={journal.shopControl}>
          <Link className={journal.shopLink} href="/loja#cafes">
            Ver cafés ↗
          </Link>
          <MobileStoreMenu />
        </div>
      </header>

      <article>
        <section className={journal.hero}>
          <div className={journal.heroImage}>
            <Image
              src="/brand/editorial/real/sublime-ritual.jpg"
              alt="Café Sublime, xícara e método filtrado em um ritual de preparo"
              fill
              priority
              sizes="100vw"
            />
            <div className={journal.heroVeil} />
          </div>
          <div className={journal.heroCopy}>
            <p>CADERNO BISPO</p>
            <h1>Cenas de origem, prova e ritual.</h1>
            <span>
              Um arquivo vivo do que acontece antes de cada pacote: as pessoas,
              os gestos e as escolhas que transformam café em Bispo.
            </span>
            <nav aria-label="Capítulos do Caderno">
              <a href="#campo">Campo</a>
              <a href="#prova">Prova</a>
              <a href="#ritual">Ritual</a>
              <a href="#pessoas">Pessoas</a>
            </nav>
          </div>
        </section>

        <section className={journal.feature} aria-labelledby="cena-destaque">
          <div className={journal.featureCopy}>
            <p>CENA EM DESTAQUE · OUTUBRO 2026</p>
            <h2 id="cena-destaque">
              Escolher é repetir o gesto até reconhecer o que merece ficar.
            </h2>
            <span>
              Em uma mesa de prova, Suzi e José avaliam xícaras lado a lado. A
              escolha nasce da conversa entre origem, técnica e sensação — e
              continua sendo revisitada até ganhar clareza.
            </span>
          </div>
          <figure>
            <Image
              src="/brand/editorial/real/jose-suzi-prova.jpg"
              alt="José e Suzi comparando cafés durante uma prova"
              fill
              sizes="(max-width: 800px) 100vw, 58vw"
            />
            <figcaption>LONDRINA · PROVA E SELEÇÃO</figcaption>
          </figure>
        </section>

        <section
          id="campo"
          className={journal.chapter}
          aria-labelledby="campo-title"
        >
          <header className={journal.chapterLead}>
            <p>01 · CAMPO</p>
            <h2 id="campo-title">Toda xícara começa antes da xícara.</h2>
            <span>
              Produtor, lavoura, safra e pós-colheita formam o primeiro capítulo
              de cada escolha.
            </span>
          </header>
          <div className={journal.fieldGrid}>
            {fieldScenes.map((scene) => (
              <article key={scene.title}>
                <div className={journal.fieldImage}>
                  <Image
                    src={scene.image}
                    alt={scene.alt}
                    fill
                    sizes="(max-width: 760px) 100vw, 33vw"
                  />
                </div>
                <p>{scene.eyebrow}</p>
                <h3>{scene.title}</h3>
                <span>{scene.text}</span>
              </article>
            ))}
          </div>
          <Link
            className={journal.textLink}
            href="/loja/cafes/carlos-alexandre-safra-2026"
          >
            Conhecer o lote de Carlos Alexandre →
          </Link>
        </section>

        <section
          id="prova"
          className={`${journal.chapter} ${journal.darkChapter}`}
          aria-labelledby="prova-title"
        >
          <header className={journal.chapterLead}>
            <p>02 · PROVA</p>
            <h2 id="prova-title">Critério também é uma forma de cuidado.</h2>
            <span>
              Aroma, doçura, corpo, acidez e finalização são lidos em conjunto.
              A técnica organiza a atenção; a experiência reconhece o essencial.
            </span>
          </header>
          <div className={journal.cupGrid}>
            {cupScenes.map((scene, index) => (
              <figure
                className={index === 2 ? journal.cupWide : undefined}
                key={scene.title}
              >
                <Image
                  src={scene.image}
                  alt={scene.alt}
                  fill
                  sizes="(max-width: 760px) 100vw, 50vw"
                />
                <div />
                <figcaption>
                  <small>{scene.eyebrow}</small>
                  <strong>{scene.title}</strong>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section
          id="ritual"
          className={journal.chapter}
          aria-labelledby="ritual-title"
        >
          <header className={journal.chapterLead}>
            <p>03 · PREPARO E RITUAL</p>
            <h2 id="ritual-title">Desejo também mora no gesto.</h2>
            <span>
              O preparo aproxima técnica e prazer. É onde a escolha feita no
              campo e na prova finalmente passa a pertencer a quem bebe.
            </span>
          </header>
          <div className={journal.ritualGrid}>
            {ritualScenes.map((scene) => (
              <article key={scene.title}>
                <div className={journal.ritualImage}>
                  <Image
                    src={scene.image}
                    alt={scene.alt}
                    fill
                    sizes="(max-width: 760px) 100vw, 34vw"
                  />
                </div>
                <p>{scene.eyebrow}</p>
                <h3>{scene.title}</h3>
                <span>{scene.text}</span>
              </article>
            ))}
          </div>
        </section>

        <section
          id="pessoas"
          className={journal.people}
          aria-labelledby="pessoas-title"
        >
          <header className={journal.chapterLead}>
            <p>04 · PESSOAS</p>
            <h2 id="pessoas-title">
              Duas trajetórias. Uma escolha compartilhada.
            </h2>
            <span>
              Suzi e José têm histórias próprias, iniciadas muito antes da
              Bispo. Nas narrativas individuais, cada pessoa ocupa seu próprio
              quadro; na construção da marca, os dois aparecem juntos.
            </span>
          </header>
          <div className={journal.peopleGrid}>
            <figure>
              <Image
                src="/brand/founders/suzi-ninov.jpg"
                alt="Retrato de Suzi Ninov durante uma prova de café"
                fill
                sizes="(max-width: 760px) 100vw, 33vw"
              />
              <figcaption>
                <small>SUZI NINOV</small>
                <strong>Campo, critério e cuidado.</strong>
              </figcaption>
            </figure>
            <figure>
              <Image
                src="/brand/founders/jose-rezende.jpg"
                alt="Retrato de José Rezende durante uma prova de café"
                fill
                sizes="(max-width: 760px) 100vw, 33vw"
              />
              <figcaption>
                <small>JOSÉ REZENDE</small>
                <strong>Origem, prova e mercado.</strong>
              </figcaption>
            </figure>
            <figure className={journal.peopleTogether}>
              <Image
                src="/brand/editorial/real/jose-suzi-prova.jpg"
                alt="José Rezende e Suzi Ninov trabalhando juntos"
                fill
                sizes="(max-width: 760px) 100vw, 34vw"
              />
              <figcaption>
                <small>JOSÉ + SUZI</small>
                <strong>A Bispo se constrói no encontro.</strong>
              </figcaption>
            </figure>
          </div>
          <Link className={journal.textLink} href="/loja/sobre">
            Conhecer a trajetória dos fundadores →
          </Link>
        </section>

        <section
          className={journal.related}
          aria-labelledby="relacionado-title"
        >
          <header className={journal.chapterLead}>
            <p>05 · RELACIONADO À XÍCARA</p>
            <h2 id="relacionado-title">Se uma cena despertou curiosidade.</h2>
            <span>
              Três cafés ligados a estas histórias. Sem interromper a leitura —
              apenas um caminho discreto para continuar pela xícara.
            </span>
          </header>
          <div className={journal.relatedGrid}>
            {relatedCoffees.map((coffee) => (
              <Link href={coffee.href} key={coffee.name}>
                <div>
                  <Image
                    src={coffee.image}
                    alt={`Embalagem do café ${coffee.name}`}
                    fill
                    sizes="(max-width: 680px) 38vw, 14vw"
                  />
                </div>
                <span>
                  <small>{coffee.name}</small>
                  <strong>{coffee.note}</strong>
                  <i>Ver este café →</i>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <footer className={journal.footer}>
          <Image
            src="/brand/logo/bispo-logo-official-transparent.png"
            width={144}
            height={48}
            alt="Bispo Coffees"
          />
          <p>Caderno Bispo · Cenas de origem, prova e ritual.</p>
          <div>
            <Link href="/loja">Voltar à loja</Link>
            <Link href="/loja/sobre">Sobre a Bispo</Link>
            <Link href="/loja/origem">A geografia na xícara</Link>
          </div>
        </footer>
      </article>
    </main>
  );
}
