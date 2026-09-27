import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import styles from "../page.module.css";
import brand from "../brand-review.module.css";
import origin from "./page.module.css";

export const metadata: Metadata = {
  title: "A geografia também está na xícara | Bispo Coffees",
  description: "Suzi Ninov e José Rezende contam como a origem, os solos e o clima do Paraná ajudam a compreender cada café.",
};

export default function OrigemPage() {
  return (
    <main className={`${styles.page} ${brand.storefront} ${origin.page}`}>
      <div className={styles.commerceBar}>
        <span>Frete grátis Sul + Sudeste em compras a partir de R$ 270</span>
        <Link href="/loja#cafes">Escolher cafés →</Link>
      </div>
      <header className={styles.header}>
        <Link href="/loja" className={styles.brand} aria-label="Bispo Coffees — loja">
          <Image src="/brand/logo/bispo-logo-official-transparent.png" width={176} height={58} alt="Bispo Coffees" priority />
        </Link>
        <nav className={styles.nav} aria-label="Navegação principal">
          <Link href="/loja#cafes">Cafés</Link>
          <Link href="/loja#camadas">Escolher</Link>
          <Link href="/loja/descobrir">Descobrir o meu</Link>
          <Link href="/loja/sobre">Sobre a Bispo</Link>
        </nav>
        <Link className={origin.headerShop} href="/loja#cafes">Ver cafés ↗</Link>
      </header>

      <nav className={origin.storyTabs} aria-label="Conheça a Bispo">
        <Link href="/loja/sobre">Suzi e José</Link>
        <span aria-current="page">A geografia na xícara</span>
      </nav>

      <article>
        <section className={origin.intro}>
          <p className={origin.kicker}>NOSSA ORIGEM · NORTE DO PARANÁ</p>
          <h1>A geografia também está na xícara.</h1>
          <h2>Antes de escolher cafés, aprendemos a entender de onde eles vêm.</h2>
          <p>A Bispo Coffees nasce do encontro das trajetórias de <strong>Suzi Ninov e José Rezende</strong> — duas experiências construídas entre produtores, lavouras, desenvolvimento de qualidade, prova e mercados internacionais.</p>
          <p>No Paraná, próximo ao Trópico de Capricórnio, essa relação com o café ganhou uma perspectiva particular: aqui, a geografia nos ensinou cedo que qualidade não pode ser explicada por uma única variável.</p>
          <p className={origin.variables}>Latitude. Altitude. Temperatura. Solo. Variedade. Manejo. Maturação. Processamento. Pessoas.</p>
          <p>Cada uma deixa sua marca. <strong>É a combinação entre elas que constrói uma origem.</strong></p>
        </section>

        <section className={origin.people} aria-label="Os fundadores">
          <div className={origin.peopleIntro}>
            <p className={origin.kicker}>DOIS OLHARES, UMA ESCOLHA</p>
            <h2>O lugar importa. Quem o interpreta também.</h2>
          </div>
          <div className={origin.peopleGrid}>
            <article>
              <div className={origin.portrait}><Image src="/brand/story/suzi-fragrancia.jpeg" alt="Suzi Ninov avaliando o café" fill sizes="(max-width: 700px) 100vw, 50vw" /></div>
              <div><span>SUZI NINOV · CAMPO E DESENVOLVIMENTO</span><h3>O cuidado começa na planta.</h3><p>Suzi trabalha junto aos produtores, acompanha o cultivo e ajuda a transformar decisões de manejo em qualidade que se pode reconhecer na xícara.</p></div>
            </article>
            <article>
              <div className={origin.portrait}><Image src="/brand/story/jose-origem.jpeg" alt="José Rezende observando um cafeeiro" fill sizes="(max-width: 700px) 100vw, 50vw" /></div>
              <div><span>JOSÉ REZENDE · ORIGEM E PROVA</span><h3>Da origem para o mundo.</h3><p>José cresceu no café do Norte do Paraná. Entre produtores, avaliação sensorial e mercados internacionais, aprendeu a ler o ambiente e reconhecer sua expressão na xícara.</p></div>
            </article>
          </div>
          <p className={origin.peopleEnd}>Juntos, compreendem o caminho do grão antes de escolher o café que leva o nome Bispo.</p>
        </section>

        <section className={origin.landscape} aria-labelledby="climate-title">
          <div className={origin.landscapeImage}>
            <Image src="/brand/story/parana-dia-amanhecer.webp" alt="Representação conceitual de um cafezal entre a tarde iluminada e o amanhecer com névoa" fill sizes="100vw" />
            <span className={origin.dayLabel}>CALOR DO DIA</span><span className={origin.nightLabel}>FRESCOR DA MANHÃ</span>
          </div>
          <div className={origin.landscapeText}>
            <p className={origin.kicker}>UM LUGAR · DOIS MOMENTOS</p>
            <h2 id="climate-title">A temperatura muda. A planta responde.</h2>
            <p><strong>Amplitude térmica</strong> é a diferença entre a temperatura mais alta e a mais baixa de um período. O contraste entre dias quentes e noites frescas compõe o ambiente em que o fruto se desenvolve.</p>
            <p>Temperatura e disponibilidade de água influenciam o tempo entre a florada e a maturação. Sozinhas, não determinam a qualidade: cultivar, solo, manejo e processamento também participam da história.</p>
            <small>Imagem conceitual; não representa uma medição ou uma lavoura específica.</small>
          </div>
        </section>

        <section className={origin.territory}>
          <p className={origin.kicker}>23°26′ S · TRÓPICO DE CAPRICÓRNIO</p>
          <h2>Entre a linha do trópico e os solos do Paraná.</h2>
          <figure className={origin.soilImage}>
            <Image src="/brand/story/parana-solo-basalto.webp" alt="Representação conceitual de solo vermelho e argiloso junto a um cafezal" fill sizes="(max-width: 700px) 100vw, 1200px" />
            <figcaption>Solo vermelho, planta e fruto · imagem conceitual</figcaption>
          </figure>
          <div className={origin.territoryGrid}>
            <div><strong>Latitude</strong><p>O Norte do Paraná fica próximo ao Trópico de Capricórnio. A latitude se soma à altitude, ao relevo e ao clima na formação dos ambientes de cultivo.</p></div>
            <div><strong>Solo</strong><p>Em parte da região, o basalto deu origem a solos vermelhos e argilosos. Não há um único solo para todo o Norte do Paraná: cada área pede leitura e cuidado próprios.</p></div>
            <div><strong>Tempo</strong><p>O fruto responde ao conjunto de temperatura, água e decisões de quem cultiva. É esse percurso que Suzi e José procuram compreender antes da escolha.</p></div>
          </div>
          <p className={origin.extremes}><strong>Ao norte, o Havaí. Ao sul, o Paraná.</strong> São exemplos distantes que nos convidam a olhar além da altitude. Seus climas e sistemas de cultivo são diferentes; nenhum fator, isoladamente, explica uma grande xícara.</p>
          <details className={origin.science}>
            <summary>Para quem quer ir mais fundo: a base técnica</summary>
            <p>Pesquisas conduzidas em Londrina com diferentes genótipos de arábica estudaram soma térmica e água disponível durante a maturação. Estudos de solos mostram a presença de materiais derivados de basalto em parte do Norte do Paraná, além de áreas de origem arenítica.</p>
            <p>Fontes: <a href="https://www.alice.cnptia.embrapa.br/alice/handle/doc/656690" target="_blank" rel="noopener noreferrer">IAPAR/Embrapa · clima e maturação</a> · <a href="https://www.infoteca.cnptia.embrapa.br/infoteca/bitstream/doc/1133948/1/DOCUMENTO-440-JA2021.pdf" target="_blank" rel="noopener noreferrer">Embrapa · solos do Norte do Paraná</a>.</p>
          </details>
        </section>

        <section className={origin.close}>
          <p>Na Bispo, origem é o que aprendemos a compreender antes de escolher.</p>
          <h2>O perfil sensorial conta o que o lugar, o tempo e as pessoas construíram.</h2>
          <Link href="/loja#cafes">Conhecer os cafés escolhidos por Suzi e José →</Link>
        </section>
      </article>
    </main>
  );
}
