import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import styles from "../page.module.css";
import brand from "../brand-review.module.css";
import storyNav from "../story-navigation.module.css";
import premium from "../premium-overrides.module.css";
import MobileStoreMenu from "../MobileStoreMenu";
import journal from "./page.module.css";
import RealFilm from "./RealFilm";

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
    images: ["/brand/editorial/real/suzi-jose-escolha.jpg"],
  },
};

export const revalidate = 300;

const fieldScenes = [
  {
    image: "/brand/editorial/real/caderno-carlos-alexandre-colheita.jpg",
    alt: "Carlos Alexandre Siqueira segurando uma peneira com cerejas maduras de café",
    eyebrow: "PESSOAS · SÃO JERÔNIMO DA SERRA",
    title: "Uma história cultivada com persistência.",
    text: "O lote começa na relação com quem planta. Conhecer a trajetória do produtor ajuda a compreender cada decisão de manejo e cada safra.",
  },
  {
    image: "/brand/editorial/real/caderno-suzi-carlos-acompanhamento.jpg",
    alt: "Suzi Ninov e Carlos Alexandre acompanhando uma lavoura de café",
    eyebrow: "LAVOURA · NORTE DO PARANÁ",
    title: "Acompanhar antes de escolher.",
    text: "A leitura acontece ao longo do ciclo: planta, solo, maturação e contexto. A qualidade não nasce apenas no dia da prova.",
    landscape: true,
  },
  {
    image: "/brand/editorial/real/caderno-frutos-maturacao.jpg",
    alt: "Frutos de café em diferentes pontos de maturação na mão",
    eyebrow: "FRUTO · MATURAÇÃO",
    title: "O ponto começa a aparecer no fruto.",
    text: "Cor, uniformidade e estágio de maturação ajudam a orientar a colheita e a leitura do potencial construído na planta.",
  },
];

const cupScenes = [
  {
    image: "/brand/editorial/real/suzi-criterio-caderno.jpg",
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
    image: "/brand/editorial/real/suzi-aroma.jpg",
    alt: "Suzi Ninov percebendo o aroma do café durante o ritual de prova",
    eyebrow: "SUZI · PRESENÇA SENSORIAL",
    title: "O aroma antecipa a experiência.",
    text: "Antes do primeiro gole, o café já comunica temperatura, frescor e intenção. Perceber também faz parte do preparo.",
  },
  {
    image: "/brand/editorial/real/jose-preparo.jpg",
    alt: "José Rezende preparando café em método filtrado",
    eyebrow: "JOSÉ · PREPARO E PRECISÃO",
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

const phaseScenes = [
  {
    kind: "video" as const,
    media: "/brand/editorial/real/phases/florada.mp4",
    poster: "/brand/editorial/real/phases/florada-poster.jpg",
    alt: "Abelha entre flores de café durante a florada",
    number: "01",
    title: "Florada",
    text: "O ciclo recomeça em poucos dias decisivos.",
  },
  {
    kind: "video" as const,
    media: "/brand/editorial/real/phases/fruto.mp4",
    poster: "/brand/editorial/real/phases/fruto-poster.jpg",
    alt: "Frutos verdes se desenvolvendo no cafeeiro",
    number: "02",
    title: "Fruto",
    text: "Primeiro verde; depois, cor, açúcar e maturação.",
  },
  {
    kind: "image" as const,
    media: "/brand/editorial/real/phases/maturacao.jpg",
    alt: "Cerejas maduras de café ainda no cafeeiro",
    number: "03",
    title: "Maturação",
    text: "A doçura que chega à xícara começa na planta.",
  },
  {
    kind: "image" as const,
    media: "/brand/products/raros/alexandre-colheita.webp",
    alt: "Peneira com cerejas maduras de café recém-colhidas",
    number: "04",
    title: "Colheita",
    text: "O ponto e o método definem o que segue adiante.",
  },
  {
    kind: "image" as const,
    media: "/brand/editorial/real/phases/secagem.jpg",
    alt: "Suzi Ninov observando o café em etapa de secagem",
    number: "05",
    title: "Pós-colheita",
    text: "Secagem e tempo preservam a identidade do lote.",
  },
  {
    kind: "video" as const,
    media: "/brand/editorial/real/phases/torra.mp4",
    poster: "/brand/editorial/real/phases/torra-poster.jpg",
    alt: "Grãos de café em movimento após a torra",
    number: "06",
    title: "Torra",
    text: "O calor interpreta o que o campo construiu.",
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
            <RealFilm
              className={journal.heroFilm}
              videoClassName={journal.heroVideo}
              controlClassName={journal.filmControl}
              desktopSrc="/brand/story/origem-arrival/campo-desktop.mp4"
              mobileSrc="/brand/story/origem-arrival/campo-mobile.mp4"
              poster="/brand/story/origem-arrival/campo-dia.jpg"
              label="Imagens reais de uma lavoura de café no Norte do Paraná"
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
              src="/brand/editorial/real/suzi-jose-escolha.jpg"
              alt="Suzi Ninov e José Rezende escolhendo cafés durante uma prova"
              fill
              sizes="(max-width: 800px) 100vw, 58vw"
            />
            <figcaption>LONDRINA · PROVA E SELEÇÃO</figcaption>
          </figure>
        </section>

        <section
          className={journal.fieldFilmSection}
          aria-labelledby="territorio-em-movimento"
        >
          <header className={journal.fieldFilmLead}>
            <p>CADERNO DE CAMPO · REGISTRO REAL</p>
            <h2 id="territorio-em-movimento">
              A origem muda quando deixa de ser cenário.
            </h2>
            <span>
              Caminhar a lavoura, observar a planta e ouvir quem produz fazem
              parte da escolha. Estas imagens registram Suzi em campo, lendo a
              lavoura de perto — presença antes da prova.
            </span>
          </header>
          <figure className={journal.fieldFilmFrame}>
            <RealFilm
              className={journal.fieldFilm}
              videoClassName={journal.fieldFilmVideo}
              controlClassName={`${journal.filmControl} ${journal.fieldFilmControl}`}
              desktopSrc="/brand/editorial/real/caderno-campo-encontro.mp4"
              poster="/brand/editorial/real/caderno-campo-poster.jpg"
              label="Suzi Ninov observando a lavoura no Norte do Paraná"
              clipStart={0}
              clipEnd={4}
            />
            <div className={journal.fieldFilmVeil} />
            <figcaption>
              <small>NORTE DO PARANÁ · CAMPO E ENCONTRO</small>
              <strong>O café começa em relações que precisam de tempo.</strong>
            </figcaption>
          </figure>
          <div className={journal.fieldFilmNotes}>
            <article>
              <small>01</small>
              <strong>Observar</strong>
              <span>A planta, o solo e o ritmo de cada lugar.</span>
            </article>
            <article>
              <small>02</small>
              <strong>Escutar</strong>
              <span>Quem produz sabe o que nenhuma planilha conta sozinha.</span>
            </article>
            <article>
              <small>03</small>
              <strong>Voltar</strong>
              <span>Qualidade consistente nasce de acompanhamento.</span>
            </article>
          </div>
        </section>

        <section
          className={journal.phaseSection}
          aria-labelledby="safra-em-movimento"
        >
          <header className={journal.phaseLead}>
            <div>
              <p>DO CAMPO À TORRA · MATÉRIA VIVA</p>
              <h2 id="safra-em-movimento">A safra muda de estado.</h2>
            </div>
            <span>
              Registros reais de diferentes momentos e propriedades tornam
              visível o percurso que normalmente chega escondido dentro do
              pacote.
            </span>
          </header>
          <div className={journal.phaseTrack}>
            {phaseScenes.map((scene) => (
              <article id={`fase-${scene.number}`} key={scene.number}>
                <div className={journal.phaseMedia}>
                  {scene.kind === "video" ? (
                    <RealFilm
                      className={journal.phaseFilm}
                      videoClassName={journal.phaseVideo}
                      desktopSrc={scene.media}
                      poster={scene.poster}
                      label={scene.alt}
                      loop={false}
                      showControl={false}
                    />
                  ) : (
                    <Image
                      src={scene.media}
                      alt={scene.alt}
                      fill
                      sizes="(max-width: 680px) 72vw, 18vw"
                    />
                  )}
                </div>
                <small>{scene.number}</small>
                <h3>{scene.title}</h3>
                <span>{scene.text}</span>
              </article>
            ))}
          </div>
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
                <div
                  className={`${journal.fieldImage} ${
                    scene.landscape ? journal.fieldImageLandscape : ""
                  }`}
                >
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
            {cupScenes.map((scene) => (
              <figure key={scene.title}>
                <Image
                  src={scene.image}
                  alt={scene.alt}
                  fill
                  sizes="(max-width: 760px) 100vw, 33vw"
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
                src="/brand/editorial/real/suzi-jose-escolha.jpg"
                alt="Suzi Ninov e José Rezende trabalhando juntos na escolha dos cafés"
                fill
                sizes="(max-width: 760px) 100vw, 88vw"
              />
              <figcaption>
                <small>SUZI + JOSÉ</small>
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
