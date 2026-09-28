import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import styles from "../page.module.css";
import brand from "../brand-review.module.css";
import origin from "./page.module.css";
import storyNav from "../story-navigation.module.css";

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
      <header className={`${styles.header} ${storyNav.header}`}>
        <Link href="/loja" className={styles.brand} aria-label="Bispo Coffees — loja">
          <Image src="/brand/logo/bispo-logo-official-transparent.png" width={176} height={58} alt="Bispo Coffees" priority />
        </Link>
        <nav className={`${styles.nav} ${storyNav.nav}`} aria-label="Navegação principal">
          <Link href="/loja#cafes">Cafés</Link>
          <Link href="/loja#camadas">Escolher</Link>
          <Link href="/loja/descobrir">Descobrir o meu</Link>
          <Link href="/loja/sobre">Sobre a Bispo</Link>
          <Link href="/loja/origem" aria-current="page">A geografia na xícara</Link>
        </nav>
        <Link className={origin.headerShop} href="/loja#cafes">Ver cafés ↗</Link>
      </header>

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

        <section className={origin.memory} aria-labelledby="memory-title">
          <div className={origin.memoryLead}>
            <p className={origin.kicker}>LONDRINA · PARANÁ · CAFÉ</p>
            <h2 id="memory-title">Esta história começou muito antes da Bispo.</h2>
          </div>
          <div className={origin.memoryBody}>
            <p>O café acompanhou a formação de Londrina e transformou o Norte do Paraná ao longo do século XX. A cidade surgiu em 1929; nas décadas seguintes, lavouras, produtores e trabalhadores fizeram da região uma referência cafeeira. Nos anos 1950, a produção de café impulsionou sua expansão.</p>
            <p>Parte dessa paisagem tem os solos vermelhos que ficaram conhecidos como <strong>terra roxa</strong>, formados pelo intemperismo do basalto. A história da região também inclui diferentes povos, migrações, trabalho e mudanças no campo. É dessa realidade viva — e não apenas de uma cor no mapa — que falamos quando dizemos <strong>origem</strong>.</p>
          </div>
        </section>

        <section className={origin.career} aria-labelledby="career-title">
          <div className={origin.careerIntro}>
            <p className={origin.kicker}>DO PARANÁ PARA O MUNDO</p>
            <h2 id="career-title">As coordenadas mudaram. O compromisso com a origem permaneceu.</h2>
            <p>Na trajetória de José, o Norte do Paraná foi ponto de partida para trabalhar com produtores, provar cafés e abrir caminhos em outros mercados. Na trajetória de Suzi, o conhecimento agronômico encontrou no campo uma forma de acompanhar cada decisão que constrói qualidade.</p>
          </div>
          <div className={origin.careerChapters}>
            <article><span>2003 → 2010</span><h3>José · do campo à prova</h3><p>José iniciou seu trabalho técnico com produtores em 2003. A formação como provador, a avaliação sensorial e a atuação internacional ampliaram sua leitura das origens brasileiras e ajudaram a levar cafés do Paraná a compradores de outros países.</p></article>
            <article><span>2015 · CAPRICORNIO COFFEES</span><h3>Latitude entra na conversa</h3><p>Como cofundador da Capricornio Coffees, José participou de um projeto que deu visibilidade a cafés de São Paulo e do Paraná próximos ao Trópico de Capricórnio. A discussão sobre <strong>latitude e altitude</strong> ajudou a ampliar o olhar para regiões produtoras antes pouco reconhecidas.</p></article>
            <article><span>2024 · LONGITUDE COFFEES</span><h3>Mais origens no mapa</h3><p>José iniciou a Longitude Coffees para aproximar cafés brasileiros de mercados internacionais. O nome trouxe outra coordenada para sua trajetória e reforçou a atenção à diversidade dos territórios produtores do Brasil.</p></article>
            <article><span>SUZI NINOV · BISPO COFFEES</span><h3>A origem também se constrói</h3><p>Suzi trabalha com a planta, o solo, o desenvolvimento produtivo e a orientação a produtores. Na Bispo, essa experiência encontra a de José: os dois acompanham, interpretam e selecionam cafés cuja identidade possa ser percebida na xícara.</p></article>
          </div>
          <p className={origin.careerSignature}>Capricornio e Longitude fazem parte do caminho de José. <strong>A Bispo Coffees é a assinatura construída por José e Suzi.</strong></p>
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
            <div><strong>Latitude</strong><p>Localiza um lugar ao norte ou ao sul do Equador. O Norte do Paraná fica próximo ao Trópico de Capricórnio; sua latitude se soma à altitude, ao relevo e ao clima.</p></div>
            <div><strong>Longitude</strong><p>Localiza um lugar a leste ou a oeste. Junto da latitude, ajuda a situar no mapa cada origem e a contar de onde vem o café.</p></div>
            <div><strong>Terra roxa</strong><p>Em parte da região, o basalto deu origem a solos vermelhos e argilosos. Há também áreas com solos de origem arenítica; cada lavoura pede leitura própria.</p></div>
            <div><strong>Tempo</strong><p>O fruto responde ao conjunto de temperatura, água e decisões de quem cultiva. É esse percurso que Suzi e José procuram compreender antes da escolha.</p></div>
          </div>
          <p className={origin.extremes}><strong>Ao norte, o Havaí. Ao sul, o Paraná.</strong> São exemplos distantes que nos convidam a olhar além da altitude. Seus climas e sistemas de cultivo são diferentes; nenhum fator, isoladamente, explica uma grande xícara.</p>
          <details className={origin.science}>
            <summary>Para quem quer ir mais fundo: a base técnica</summary>
            <p>Pesquisas conduzidas em Londrina com diferentes genótipos de arábica estudaram soma térmica e água disponível durante a maturação. Estudos de solos mostram a presença de materiais derivados de basalto em parte do Norte do Paraná, além de áreas de origem arenítica.</p>
            <p>Fontes: <a href="https://www.alice.cnptia.embrapa.br/alice/handle/doc/656690" target="_blank" rel="noopener noreferrer">IAPAR/Embrapa · clima e maturação</a> · <a href="https://www.infoteca.cnptia.embrapa.br/infoteca/bitstream/doc/1133948/1/DOCUMENTO-440-JA2021.pdf" target="_blank" rel="noopener noreferrer">Embrapa · solos do Norte do Paraná</a> · <a href="https://portal.londrina.pr.gov.br/index.php/historia-cidade" target="_blank" rel="noopener noreferrer">Prefeitura · história de Londrina</a> · <a href="https://www.capricorniocoffees.com.br/origins?lang=pt" target="_blank" rel="noopener noreferrer">Capricornio · origens</a> · <a href="https://longitudecoffees.com/?lang=pt&amp;page_id=582" target="_blank" rel="noopener noreferrer">Longitude · trajetória</a>.</p>
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
