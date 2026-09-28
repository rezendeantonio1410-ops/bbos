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
          <figure className={origin.originDiagram}>
            <Image src="/brand/story/geografia-origem.svg" alt="Ilustração conceitual: a linha do Trópico de Capricórnio situa o Paraná; relevo, cafeeiro, solo e xícara compõem a paisagem" width={1200} height={520} unoptimized />
            <figcaption>
              <strong>O mapa localiza. A origem ganha forma no campo.</strong>
              <div className={origin.originKeys}>
                <span><b>01 · Coordenadas</b> Latitude e longitude situam o lugar.</span>
                <span><b>02 · Ambiente</b> Relevo, temperatura e água mudam as condições da lavoura.</span>
                <span><b>03 · Terra e planta</b> Solo e variedade fazem parte dessa resposta.</span>
                <span><b>04 · Pessoas</b> Manejo e processamento completam o caminho até a xícara.</span>
              </div>
              <small>Esquema conceitual: o traçado não representa uma medição ou um mapa de lavoura.</small>
            </figcaption>
          </figure>
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
              <div><span>SUZI NINOV · CAMPO E DESENVOLVIMENTO</span><h3>O cuidado começa na planta.</h3><p>Criada em uma fazenda no interior do Rio Grande do Sul, Suzi encontrou no Paraná, há cerca de duas décadas, o café que passou a orientar seu trabalho. Ao lado de produtores, acompanha a nutrição, o manejo e o desenvolvimento da lavoura: tratar o cafeeiro como um ser vivo, cuidar do solo e buscar produtividade com qualidade. Essa experiência de campo também ajudou a fundar com José o conceito da Longitude Coffees, que evoluiu para a Bispo.</p></div>
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
          <figure className={origin.historyPhoto}>
            <img src="https://upload.wikimedia.org/wikipedia/commons/f/f8/Planta%C3%A7%C3%A3o_de_caf%C3%A9_1955.jpg" alt="Fotografia histórica em preto e branco de uma plantação de café no Paraná" loading="lazy" />
            <figcaption>Um registro histórico da cafeicultura paranaense, identificado no acervo como “Plantação de café 1955”. <a href="https://commons.wikimedia.org/wiki/File:Planta%C3%A7%C3%A3o_de_caf%C3%A9_1955.jpg" target="_blank" rel="noopener noreferrer">Imagem: Lincolnbs / Wikimedia Commons, domínio público</a>. O acervo a associa a Nova Londrina, não à cidade de Londrina.</figcaption>
          </figure>
        </section>

        <section className={origin.career} aria-labelledby="career-title">
          <div className={origin.careerIntro}>
            <p className={origin.kicker}>DO PARANÁ PARA O MUNDO</p>
            <h2 id="career-title">As coordenadas mudaram. O compromisso com a origem permaneceu.</h2>
            <p>José cresceu entre lavouras do Norte do Paraná e levou a experiência de origem e prova a outros mercados. Suzi construiu, ao longo de cerca de duas décadas no estado, uma trajetória própria de orientação a produtores e desenvolvimento da cafeicultura.</p>
          </div>
          <div className={origin.careerChapters}>
            <article><span>2003 → 2010</span><h3>José · do campo à prova</h3><p>José iniciou seu trabalho técnico com produtores em 2003. A formação como provador, a avaliação sensorial e a atuação internacional ampliaram sua leitura das origens brasileiras e ajudaram a levar cafés do Paraná a compradores de outros países.</p></article>
            <article><span>2015 · CAPRICORNIO COFFEES</span><h3>Latitude entra na conversa</h3><p>Como cofundador da Capricornio Coffees, José participou de um projeto que deu visibilidade a cafés de São Paulo e do Paraná próximos ao Trópico de Capricórnio. A discussão sobre <strong>latitude e altitude</strong> ajudou a ampliar o olhar para regiões produtoras antes pouco reconhecidas.</p></article>
            <article><span>2024 · JOSÉ E SUZI · LONGITUDE COFFEES</span><h3>Mais origens no mapa</h3><p>José e Suzi participaram da fundação do conceito da Longitude Coffees. A experiência reuniu a leitura das origens, a orientação a produtores e o desejo de aproximar cafés brasileiros de mercados internacionais.</p></article>
            <article><span>SUZI NINOV · BISPO COFFEES</span><h3>A origem também se constrói</h3><p>Desde meados dos anos 2000 no Paraná, Suzi construiu uma trajetória junto a produtores, do cuidado com a nutrição da planta ao uso responsável do solo. A experiência em desenvolvimento da lavoura e a visão que construiu com José na Longitude ganharam uma expressão própria na Bispo Coffees, fundada pelos dois.</p></article>
          </div>
          <p className={origin.careerSignature}>Capricornio faz parte do caminho de José. A Longitude reuniu José e Suzi em um conceito compartilhado. <strong>A Bispo Coffees é a assinatura que os dois construíram a partir dessa experiência.</strong></p>
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
            <figure className={origin.thermalDiagram}>
              <Image src="/brand/story/amplitude-termica.svg" alt="Curva conceitual de temperatura subindo durante o dia e caindo à noite, entre uma máxima e uma mínima" width={1000} height={360} unoptimized />
              <figcaption><strong>Amplitude do dia = temperatura máxima − temperatura mínima.</strong><span>A curva mostra o conceito; os valores reais variam entre regiões, estações e lavouras.</span></figcaption>
            </figure>
            <p>Temperatura e disponibilidade de água influenciam o tempo entre a florada e a maturação. Sozinhas, não determinam a qualidade: cultivar, solo, manejo e processamento também participam da história.</p>
            <p>Na prática, observamos a sequência de dias e noites durante o desenvolvimento do fruto. Uma diferença maior entre máxima e mínima não garante, por si só, um café melhor: calor excessivo, frio e falta de água também podem limitar a planta.</p>
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
            <p>Estudos de Londrina acompanharam soma térmica e água disponível na maturação de diferentes genótipos de arábica. Pesquisas em outras origens mostram que condições climáticas, sobretudo a temperatura no desenvolvimento da semente, podem modificar atributos químicos e sensoriais. Latitude e longitude situam a origem; não funcionam como nota automática de qualidade.</p>
            <p>Fontes: <a href="https://www.alice.cnptia.embrapa.br/alice/handle/doc/656690" target="_blank" rel="noopener noreferrer">IAPAR/Embrapa · clima e maturação</a> · <a href="https://pubmed.ncbi.nlm.nih.gov/22980845/" target="_blank" rel="noopener noreferrer">Food Chemistry · clima e perfil sensorial</a> · <a href="https://www.infoteca.cnptia.embrapa.br/infoteca/bitstream/doc/1133948/1/DOCUMENTO-440-JA2021.pdf" target="_blank" rel="noopener noreferrer">Embrapa · solos do Norte do Paraná</a> · <a href="https://portal.londrina.pr.gov.br/index.php/historia-cidade" target="_blank" rel="noopener noreferrer">Prefeitura · história de Londrina</a> · <a href="https://www.capricorniocoffees.com.br/origins?lang=pt" target="_blank" rel="noopener noreferrer">Capricornio · origens</a> · <a href="https://longitudecoffees.com/?lang=pt&amp;page_id=582" target="_blank" rel="noopener noreferrer">Longitude · trajetória</a>.</p>
          </details>
        </section>

        <section className={origin.deepDive} aria-labelledby="layers-title">
          <div className={origin.deepIntro}>
            <p className={origin.kicker}>DO TERRITÓRIO À XÍCARA</p>
            <h2 id="layers-title">O café não nasce pronto no mapa.</h2>
            <p>A latitude e a longitude dizem <em>onde</em> estamos. Para compreender <em>o que</em> aquele lugar pode expressar, precisamos seguir o fruto, a semente e as decisões feitas no campo e na torra.</p>
          </div>
          <figure className={origin.layersFigure}>
            <Image src="/brand/story/camadas-origem-torra.svg" alt="Corte conceitual de uma encosta cafeeira: Trópico de Capricórnio, clima, cafeeiros, manejo, terra roxa e basalto" width={1200} height={430} unoptimized />
            <figcaption>Um corte ilustrado da paisagem. O solo de origem basáltica aparece em parte da região; a figura não descreve uma propriedade específica.</figcaption>
          </figure>
          <div className={origin.layerGrid}>
            <article><span>01 · POSIÇÃO</span><h3>Coordenadas e relevo</h3><p>O Trópico de Capricórnio é uma referência geográfica. Latitude e longitude situam cada lavoura; a altitude e a posição no relevo ajudam a explicar as condições que ela encontra. Em um levantamento de Londrina, 41% dos cafezais mapeados estavam na faixa de 640 a 740 m. Isso descreve aquelas lavouras, não todas as origens do Paraná.</p></article>
            <article><span>02 · TEMPO</span><h3>Calor, frio e água</h3><p>A amplitude térmica compara máximas e mínimas de um período, mas o fruto responde à sequência de dias, noites e disponibilidade de água ao longo da maturação. A mesma diferença de temperatura pode acontecer sob condições muito distintas para a planta.</p></article>
            <article><span>03 · TERRA</span><h3>Basalto e solo vivo</h3><p>Em parte do Norte do Paraná, o intemperismo do basalto formou solos vermelhos associados à terra roxa. Profundidade, estrutura, acidez, água e disponibilidade de nutrientes precisam ser avaliadas na lavoura. A rocha de origem, por si, não transfere uma nota de sabor para o grão.</p></article>
            <article><span>04 · ESCOLHA</span><h3>O trabalho de Suzi e do produtor</h3><p>Variedade adequada, nutrição equilibrada, manejo, ponto de colheita e processamento são escolhas técnicas. É nesse trabalho contínuo com produtores que Suzi lê a resposta da planta e ajuda a construir qualidade, safra após safra.</p></article>
          </div>
          <div className={origin.roastStory}>
            <div>
              <p className={origin.kicker}>A ÚLTIMA LEITURA DA ORIGEM</p>
              <h2>Na torra, o grão pede uma curva própria.</h2>
              <p>Em lavouras entre aproximadamente 600 e 800 m, não basta importar uma receita desenvolvida para cafés acima de 1.600 m. Umidade, tamanho, densidade, processamento e composição do lote mudam a transferência de calor. O torrador acompanha tempo e energia, prova amostras e ajusta a curva para preservar as qualidades daquele café.</p>
              <p>Há pesquisas em que um perfil mais quente e curto recebeu melhor avaliação para os cafés de menor altitude estudados; outras mostram que a torra altera compostos da bebida. <strong>Isso não estabelece uma temperatura universal para o Paraná.</strong> A comparação certa é entre perfis testados no mesmo lote, com controle de cor e prova sensorial.</p>
            </div>
            <div className={origin.roastSteps} aria-label="Decisões técnicas para definir a torra">
              <div><span>GRÃO VERDE</span><strong>Densidade · umidade · processo</strong><small>Medir o lote antes de aplicar calor.</small></div>
              <div><span>TORRA</span><strong>Energia · tempo · desenvolvimento</strong><small>Registrar curvas e manter o resultado comparável.</small></div>
              <div><span>PROVA</span><strong>Doçura · corpo · acidez · aroma</strong><small>Escolher a curva pela xícara, não só pela altitude.</small></div>
            </div>
          </div>
          <div className={origin.acidityStory}>
            <div><p className={origin.kicker}>COMPLEXIDADE NA XÍCARA</p><h2>E a acidez fosfórica?</h2><p>Alguns lotes da região podem apresentar uma acidez viva, limpa ou brilhante, às vezes descrita na prova como fosfórica. O ácido fosfórico é um dos compostos que pode ser medido na bebida, mas a sensação de acidez resulta do conjunto de ácidos, aromas, torra e preparo. Atribuir essa sensação a uma molécula específica em um café da Bispo exige análise do lote e avaliação sensorial compatível.</p></div>
            <div className={origin.acidityEquation}><span>NA LAVOURA</span><strong>Ambiente + variedade + manejo</strong><span>NO GRÃO E NA TORRA</span><strong>Compostos + transformação</strong><span>NA XÍCARA</span><strong>Percepção sensorial</strong><small>O sabor percebido não identifica sozinho uma molécula.</small></div>
          </div>
          <details className={origin.science}>
            <summary>Estudos para explorar essa leitura</summary>
            <p><a href="https://www.scielo.br/j/eagri/a/QPFYN8QGWFC85gc85SDkR5p/?format=html&amp;lang=pt" target="_blank" rel="noopener noreferrer">Levantamento de altitude e solo dos cafezais de Londrina</a> · <a href="https://coffeescience.ufla.br/index.php/Coffeescience/article/view/1878" target="_blank" rel="noopener noreferrer">Altitude e diferentes perfis de torra, Coffee Science</a> · <a href="https://pubmed.ncbi.nlm.nih.gov/36984852/" target="_blank" rel="noopener noreferrer">Torra e preparo de cafés do Havaí</a> · <a href="https://pubmed.ncbi.nlm.nih.gov/37033739/" target="_blank" rel="noopener noreferrer">Ácidos e limiares sensoriais na bebida</a>.</p>
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
