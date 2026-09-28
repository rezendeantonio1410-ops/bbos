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

type OriginSymbol = "place" | "weather" | "soil" | "care" | "roast" | "taste";

function OriginIcon({ kind }: { kind: OriginSymbol }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return <svg viewBox="0 0 52 52" aria-hidden="true" focusable="false" {...common}>
    {kind === "place" && <><circle cx="26" cy="26" r="20"/><path d="M6 26h40M26 6c-12 11-12 29 0 40M26 6c12 11 12 29 0 40"/><circle cx="31" cy="24" r="4" fill="currentColor" stroke="none"/></>}
    {kind === "weather" && <><circle cx="19" cy="17" r="8"/><path d="M19 4v3M19 27v3M6 17h3M29 17h3M9 7l2 2M29 7l-2 2M9 27l2-2M28 30c2-8 18-6 18 4 0 4-3 7-7 7H21c-5 0-7-3-7-6 0-4 4-7 8-6"/><path d="M27 45l-2 4M36 45l-2 4"/></>}
    {kind === "soil" && <><path d="M5 34h42M5 42h42M24 34V18M24 22c-11 1-15-6-14-12 8 0 13 5 14 12ZM24 21c1-10 8-14 16-13-1 8-6 14-16 13Z"/><circle cx="13" cy="39" r="1" fill="currentColor"/><circle cx="34" cy="38" r="1" fill="currentColor"/></>}
    {kind === "care" && <><path d="M8 31c7 0 10 3 16 7h12c5 0 7-4 4-6H28M8 31v15h-3M11 34l7-9 8 2 6 7M23 22v-9M23 17c-8 0-11-5-10-9 6 0 10 3 10 9ZM23 16c1-8 6-11 12-10 0 6-5 10-12 10Z"/></>}
    {kind === "roast" && <><path d="M25 45C10 45 7 33 13 25c1 5 4 7 6 7-4-10 4-17 10-25-1 8 2 11 5 14 9 9 7 24-9 24Z"/><path d="M26 44c-8-1-9-9-3-13 0 4 2 5 3 5-1-4 2-8 5-11 0 5 4 9 3 13-1 4-4 6-8 6Z"/></>}
    {kind === "taste" && <><path d="M6 19h31l-3 18c-7 5-18 5-25 0L6 19ZM37 22c12-2 12 12-2 12M8 44h28"/><path d="M16 8c-3 3-1 5 0 7M27 8c-3 3-1 5 0 7"/></>}
  </svg>;
}

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
          <figure className={origin.integratedAtlas}>
            <div className={origin.atlasHeading}><p className={origin.kicker}>UM MAPA · TRÊS ESCALAS</p><strong>Do mundo à xícara.</strong><span>Encontre a origem; depois observe o que acontece no campo.</span></div>
            <div className={origin.atlasZooms} aria-label="Localização progressiva do Norte do Paraná">
              <div className={origin.atlasZoom}>
                <div className={origin.atlasZoomLabel}><span>01 · MUNDO</span><strong>Latitude e longitude</strong></div>
                <Image src="/brand/story/mapa-mundi-parana.svg" alt="Mapa-múndi com Equador, meridiano de Greenwich, Trópico de Capricórnio e localização do Paraná" width={960} height={500} unoptimized />
                <p>Paralelos situam norte e sul; meridianos, leste e oeste. O Trópico atravessa o sul do Brasil.</p>
              </div>
              <div className={origin.atlasZoom}>
                <div className={origin.atlasZoomLabel}><span>02 · BRASIL</span><strong>Chegamos ao Sul</strong></div>
                <Image src="/brand/story/brasil-parana.svg" alt="Contorno oficial do Brasil e do Paraná, com o Trópico de Capricórnio na mesma projeção" width={500} height={385} unoptimized />
                <p>Dentro do Brasil, o Paraná é o recorte ampliado a seguir.</p>
              </div>
            </div>
            <div className={origin.atlasParanaLabel}><span>03 · PARANÁ EM DETALHE</span><strong>O Norte Central, o Norte Pioneiro e o Trópico</strong><small>Maringá · Londrina · Cornélio Procópio · Jacarezinho</small></div>
            <Image className={origin.atlasMap} src="/brand/story/parana-nortes.svg" alt="Mapa cartográfico do Paraná: limites do Norte Central e do Norte Pioneiro, quatro cidades e Trópico de Capricórnio; uma curva conceitual mostra a amplitude térmica entre dia e noite" width={960} height={520} unoptimized />
            <div className={origin.atlasMind} aria-label="Mapa mental do território e do café">
              <div className={origin.atlasMindHub}><span>O QUE O MAPA NOS ENSINA</span><strong>Uma origem, muitas relações</strong><small>Não há uma única variável que explique a xícara.</small></div>
              <div className={origin.atlasMindBranches}>
                <a href="#territorio" className={origin.atlasMindNode}><OriginIcon kind="place"/><span>LOCALIZAR</span><strong>Latitude · longitude</strong><small>O Trópico situa a região. Coordenadas não são nota de qualidade.</small></a>
                <a href="#territorio" className={origin.atlasMindNode}><svg viewBox="0 0 52 52" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 40h44M6 40 21 14l10 15 5-8 12 19"/><path d="M20 14l-5 9 5-3 3 2M36 21l-3 8 4-2"/><path d="M8 47h28M8 44v6M36 44v6"/></svg><span>RELEVO</span><strong>Altitude · paisagem</strong><small>Entre cerca de 600 e 800 m em parte das lavouras; posição e exposição variam.</small></a>
                <a href="#clima" className={origin.atlasMindNode}><svg viewBox="0 0 52 52" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="14" cy="17" r="7"/><path d="M14 3v3M14 28v3M1 17h3M25 17h3M4 7l3 3M23 7l-3 3M32 8a16 16 0 1 0 16 27 14 14 0 0 1-16-27Z"/><path d="M6 42c10 4 21 4 40 0M6 47c10 4 21 4 40 0"/></svg><span>CLIMA</span><strong>Dia · noite · água</strong><small>Amplitude térmica = máxima − mínima; água e manejo também importam.</small></a>
                <a href="#solo-argila" className={origin.atlasMindNode}><svg viewBox="0 0 52 52" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 28h48M2 36h48M2 44h48M26 29V10m0 9Q15 4 8 11q7 13 18 8Zm0-2q11-15 20-11-2 13-20 11Z"/><path d="M26 29 17 42m9-13 11 17m-11-17v19"/><circle cx="9" cy="32" r="1.5"/><circle cx="41" cy="40" r="1.5"/></svg><span>SOLO</span><strong>Basalto → terra roxa</strong><small>Argila, estrutura, água e raízes interagem; a cor não prevê sabor.</small></a>
                <a href="#pesquisa-solo" className={origin.atlasMindNode}><svg viewBox="0 0 52 52" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 32h31M4 39h31M4 46h31M10 36l4 1m10-1 5 1M13 43l3 1m13-1 3 1"/><circle cx="33" cy="19" r="12"/><path d="m42 28 8 8M26 20h14M30 16h6M29 24h8"/></svg><span>PESQUISA · DIEGO SIQUEIRA</span><strong>Olhar dentro da argila</strong><small>Tipo de argila, relevo e zonas de manejo: pesquisas em outras origens orientam perguntas, não respostas prontas.</small></a>
              </div>
              <p className={origin.atlasMindClose}><OriginIcon kind="care"/><span><strong>Suzi observa a lavoura. José interpreta o lote e a xícara.</strong> Pessoas conectam as camadas que o mapa sozinho não revela.</span></p>
            </div>
            <figcaption>Contornos do Brasil, Paraná, regiões e cidades: <a href="https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_municipais/municipio_2022/" target="_blank" rel="noopener noreferrer">malhas IBGE, 2022</a>. Norte Central é uma referência cartográfica para o Norte Novo histórico, sem coincidir necessariamente com seus limites. O mapa-múndi e a curva térmica são esquemáticos. Os estudos de solo citados foram conduzidos fora do Paraná e não preveem o sabor de um lote.</figcaption>
          </figure>
          <p>A Bispo Coffees nasce do encontro das trajetórias de <strong>Suzi Ninov e José Rezende</strong> — duas experiências construídas entre produtores, lavouras, desenvolvimento de qualidade, prova e mercados internacionais.</p>
          <p>No Paraná, próximo ao Trópico de Capricórnio, essa relação com o café ganhou uma perspectiva particular: aqui, a geografia nos ensinou cedo que qualidade não pode ser explicada por uma única variável.</p>
        </section>

        <section id="fundadores" className={origin.people} aria-label="Os fundadores">
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
              <div><span>JOSÉ REZENDE · ORIGEM, PROVA E TORRA</span><h3>Da origem para o mundo.</h3><p>José cresceu no café do Norte do Paraná. Desde 2006, estuda e desenvolve perfis de torra para cafés da região, combinando a leitura do grão com a prova da xícara. Essa experiência acompanha seu trabalho com produtores e profissionais do café em outros mercados.</p></div>
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
            <p>Lavouras, produtores e trabalhadores fizeram do Norte do Paraná uma referência cafeeira no século XX. O café impulsionou a expansão de Londrina e marcou a paisagem da região.</p>
            <p>Parte dessa paisagem tem os solos vermelhos que ficaram conhecidos como <strong>terra roxa</strong>, formados pelo intemperismo do basalto. A história da região também inclui diferentes povos, migrações, trabalho e mudanças no campo. É dessa realidade viva — e não apenas de uma cor no mapa — que falamos quando dizemos <strong>origem</strong>.</p>
          </div>
          <div className={origin.historyPath} aria-label="Três momentos da história cafeeira no Norte do Paraná">
            <div><OriginIcon kind="place"/><span>1929</span><strong>Londrina surge</strong></div>
            <div><OriginIcon kind="soil"/><span>ANOS 1950</span><strong>O café impulsiona a região</strong></div>
            <div><OriginIcon kind="taste"/><span>HOJE</span><strong>Uma origem em movimento</strong></div>
          </div>
          <figure className={origin.historyPhoto}>
            <img src="https://upload.wikimedia.org/wikipedia/commons/f/f8/Planta%C3%A7%C3%A3o_de_caf%C3%A9_1955.jpg" alt="Fotografia histórica em preto e branco de uma plantação de café no Paraná" loading="lazy" />
            <figcaption>Um registro histórico da cafeicultura paranaense, identificado no acervo como “Plantação de café 1955”. <a href="https://commons.wikimedia.org/wiki/File:Planta%C3%A7%C3%A3o_de_caf%C3%A9_1955.jpg" target="_blank" rel="noopener noreferrer">Imagem: Lincolnbs / Wikimedia Commons, domínio público</a>. O acervo a associa a Nova Londrina, não à cidade de Londrina.</figcaption>
          </figure>
        </section>

        <section id="territorio" className={origin.fieldReading} aria-labelledby="field-title">
          <div className={origin.fieldLead} id="clima"><p className={origin.kicker}>LEITURA DO TERRITÓRIO</p><h2 id="field-title">Do desenho à observação.</h2><p>O atlas reúne as perguntas. Compare agora duas lavouras na mesma faixa de latitude e veja por que a posição no mapa não basta.</p></div>
          <details className={origin.fieldCase}>
            <summary>Ver uma comparação visual: dois lotes na mesma latitude <span aria-hidden="true">↗</span></summary>
          <div className={origin.thinkingPaths} aria-label="Comparação conceitual de dois lotes de café">
            <div className={origin.thinkingCommon}>MESMA FAIXA DE LATITUDE</div>
            <div className={origin.thinkingBranches}>
              <div><span>LOTE A · HIPÓTESE</span><svg className={origin.lotScene} viewBox="0 0 270 115" role="img" aria-label="Cafeeiro e gotas de água no solo"><path d="M0 85Q65 70 135 85T270 83V115H0Z" fill="#9b7765"/><path d="M0 96Q70 85 135 97T270 95" fill="none" stroke="#c6a28a" strokeWidth="3"/><path d="M132 87V38M132 69Q103 39 80 54Q101 78 132 69ZM132 56Q160 27 181 43Q161 67 132 56Z" fill="#83a08e" stroke="#d3e3d2" strokeWidth="3"/><circle cx="112" cy="77" r="8" fill="#bb7b62"/><circle cx="149" cy="71" r="8" fill="#bb7b62"/><path d="M38 15q-10 19 0 19t0-19ZM211 10q-10 19 0 19t0-19ZM228 38q-10 19 0 19t0-19Z" fill="#bed9e0"/></svg><strong>Água disponível</strong><small>Maturação acompanhada no campo</small></div>
              <div><span>LOTE B · HIPÓTESE</span><svg className={origin.lotScene} viewBox="0 0 270 115" role="img" aria-label="Cafeeiro sob sol intenso e solo com pouca água"><path d="M0 85Q65 70 135 85T270 83V115H0Z" fill="#b89975"/><path d="M0 98l35 2 12-5 25 3 14 5 20-2M146 102l17-5 17 5 22-3 18 5" fill="none" stroke="#6e5d52" strokeWidth="2"/><path d="M132 87V38M132 69Q103 39 80 54Q101 78 132 69ZM132 56Q160 27 181 43Q161 67 132 56Z" fill="#86a08a" stroke="#d3e3d2" strokeWidth="3"/><circle cx="112" cy="77" r="8" fill="#bb7b62"/><circle cx="149" cy="71" r="8" fill="#bb7b62"/><circle cx="218" cy="28" r="16" fill="#dfc48a"/><path d="M218 2v-9M218 63v-9M193 28h-9M252 28h-9M200 10l-7-7M239 47l7 7M238 10l7-7" fill="none" stroke="#dfc48a" strokeWidth="3"/></svg><strong>Restrição de água</strong><small>Maturação sob outra condição</small></div>
            </div>
            <p className={origin.thinkingOutcome}>A posição no mapa se parece. <strong>As condições vividas pelo fruto podem ser diferentes.</strong></p>
          </div>
          <details className={origin.thinkingReveal}>
            <summary>O que mais comparar? Abra a leitura da Bispo <span aria-hidden="true">↗</span></summary>
            <div><p>Observe também <strong>altitude e relevo, solo, cultivar, temperatura, manejo, processamento e torra</strong>. Suzi acompanha como a planta se desenvolve com os produtores. José prova o lote e ajusta a torra. Só a combinação dessas leituras permite discutir o perfil do café.</p><p><strong>Este é um exercício de comparação, não o resultado de dois lotes reais.</strong> A falta de água pode limitar a planta; não há previsão sensorial válida apenas a partir deste desenho.</p></div>
          </details>

          </details>
          <div className={origin.fieldSources} id="solo-argila" aria-label="Pesquisa e referências">
          <details id="pesquisa-solo" className={origin.clayScience}>
              <summary>Como a pesquisa chega a essa leitura? <span aria-hidden="true">↗</span></summary>
              <div><p><strong>Já existem trabalhos publicados.</strong> Diego Silva Siqueira e pesquisadores da UNESP estudaram atributos do solo, relevo, produção e qualidade do café em áreas de Minas Gerais e São Paulo. Em 31,7 ha, teor de argila e ferro disponível ajudaram a distinguir ambientes de produção; outro estudo avaliou cor do solo e qualidade do grão em 39 ha.</p><p>Uma revisão científica de 2024, assinada também por Siqueira, apresenta a interação entre <strong>tipologia da argila, altitude e avaliação sensorial</strong> em amostras da Mantiqueira de Minas. Em determinada faixa do índice de tipologia, amostras de altitudes diferentes mostraram potencial sensorial semelhante. É uma evidência concreta de que a altitude precisa ser lida junto com o solo, sem transferir aqueles valores automaticamente para lavouras do Paraná.</p><p>O <strong>Terrus Café</strong> é uma aplicação dessa linha de pesquisa: Cooxupé, Quanticum e IFSuldeMinas trabalham no diagnóstico da tipologia da argila e no mapeamento de zonas de manejo do cafeeiro. As pesquisas avançaram; segue em estudo quanto cada mineral contribui para descritores específicos da xícara, em interação com cultivar, clima e processamento.</p><p>Fontes: <a href="https://www.alice.cnptia.embrapa.br/alice/bitstream/doc/1170171/1/Efeitos-das-caracteristicas-ambientais.pdf" target="_blank" rel="noopener noreferrer">Alves, Siqueira e coautores · Informe Agropecuário, 2024</a> · <a href="https://repositorio.unesp.br/entities/publication/26c95586-169b-4b88-8383-73ea435e74ef/full" target="_blank" rel="noopener noreferrer">Sanchez, Siqueira e coautores · UNESP, 2013</a> · <a href="https://www.scielo.br/j/pab/a/vvf9gsrK3gZrQRSXjWRNyph/?lang=pt" target="_blank" rel="noopener noreferrer">Carmo, Siqueira e coautores · Pesquisa Agropecuária Brasileira, 2016</a> · <a href="https://hubdocafe.cooxupe.com.br/tipologia-da-argila" target="_blank" rel="noopener noreferrer">Cooxupé · projeto Terrus Café</a>.</p></div>
            </details>
          <details className={origin.science}>
            <summary>Para quem quer ir mais fundo: a base técnica</summary>
            <p>Estudos de Londrina acompanharam soma térmica e água disponível na maturação de diferentes genótipos de arábica. Pesquisas em outras origens mostram que condições climáticas, sobretudo a temperatura no desenvolvimento da semente, podem modificar atributos químicos e sensoriais. Latitude e longitude situam a origem; não funcionam como nota automática de qualidade.</p>
            <p>Fontes: <a href="https://www.alice.cnptia.embrapa.br/alice/handle/doc/656690" target="_blank" rel="noopener noreferrer">IAPAR/Embrapa · clima e maturação</a> · <a href="https://pubmed.ncbi.nlm.nih.gov/22980845/" target="_blank" rel="noopener noreferrer">Food Chemistry · clima e perfil sensorial</a> · <a href="https://www.infoteca.cnptia.embrapa.br/infoteca/bitstream/doc/1133948/1/DOCUMENTO-440-JA2021.pdf" target="_blank" rel="noopener noreferrer">Embrapa · solos do Norte do Paraná</a> · <a href="https://portal.londrina.pr.gov.br/index.php/historia-cidade" target="_blank" rel="noopener noreferrer">Prefeitura · história de Londrina</a> · <a href="https://www.capricorniocoffees.com.br/origins?lang=pt" target="_blank" rel="noopener noreferrer">Capricornio · origens</a> · <a href="https://longitudecoffees.com/?lang=pt&amp;page_id=582" target="_blank" rel="noopener noreferrer">Longitude · trajetória</a>.</p>
          </details>
          </div>
        </section>

        <section className={origin.deepDive} aria-labelledby="layers-title">
          <div id="torra" className={origin.roastStory}>
            <div>
              <p className={origin.kicker}>A ÚLTIMA LEITURA DA ORIGEM</p>
              <h2>Na torra, cada lote pede uma leitura própria.</h2>
              <div className={origin.roastSignature}><span>JOSÉ REZENDE · O BISPO · DESDE 2006</span><p>José desenvolve e prova perfis para cada lote do Paraná. Em seu trabalho pelo mundo, mostra como ler o grão, ajustar o calor e revelar o potencial de cafés de altitudes mais baixas, inclusive nos arredores do Trópico de Capricórnio.</p></div>
              <p>Em lavouras entre aproximadamente 600 e 800 m, não basta importar uma receita desenvolvida para cafés acima de 1.600 m. Umidade, tamanho, densidade, processamento e composição do lote mudam a transferência de calor. O torrador acompanha tempo e energia, prova amostras e ajusta o perfil para preservar as qualidades daquele café.</p>
              <p>Há pesquisas em que um perfil mais quente e curto recebeu melhor avaliação para os cafés de menor altitude estudados; outras mostram que a torra altera compostos da bebida. <strong>Isso não estabelece uma temperatura universal para o Paraná.</strong> A escolha é guiada por testes e prova sensorial de cada lote.</p>
            </div>
            <div className={origin.roastSteps} aria-label="Decisões técnicas para definir a torra">


              <div><span>GRÃO VERDE</span><strong>Densidade · umidade · processo</strong><small>Antes do torrador: umidade no medidor, densidade no densímetro, tamanho nas peneiras e processamento na ficha do lote.</small></div>
              <div><span>TORRA</span><strong>Energia · tempo · desenvolvimento</strong><small>Acompanhar o desenvolvimento e provar o resultado.</small></div>
              <div><span>PROVA</span><strong>Doçura · corpo · acidez · aroma</strong><small>Escolher o perfil pela xícara, não só pela altitude.</small></div>
            </div>

          </div>
          <div id="acidez" className={origin.acidityStory}>
            <div><p className={origin.kicker}>COMPLEXIDADE NA XÍCARA</p><h2>E a acidez fosfórica?</h2><p>Alguns lotes da região podem apresentar uma acidez viva, limpa ou brilhante, às vezes descrita na prova como fosfórica. O ácido fosfórico é um dos compostos que pode ser medido na bebida, mas a sensação de acidez resulta do conjunto de ácidos, aromas, torra e preparo. Atribuir essa sensação a uma molécula específica em um café da Bispo exige análise do lote e avaliação sensorial compatível.</p></div>
            <div className={origin.acidityVisual} role="img" aria-label="Na prova, uma xícara representa a sensação de acidez. Na análise, um frasco representa os compostos medidos. As duas leituras ajudam a descrever o mesmo lote, mas a prova não identifica sozinha uma molécula.">
              <div className={origin.acidityCircleTaste}><OriginIcon kind="taste"/><span>PROVA</span><strong>A sensação na xícara</strong><small>Acidez · aroma · doçura</small></div>
              <div className={origin.acidityBridge} aria-hidden="true">↔</div>
              <div className={origin.acidityCircleLab}><svg viewBox="0 0 52 52" aria-hidden="true" focusable="false"><path d="M20 5h12M23 5v17L10 42c-2 3 0 5 4 5h24c4 0 6-2 4-5L29 22V5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M16 36h20" fill="none" stroke="currentColor" strokeWidth="2.5"/><circle cx="26" cy="39" r="2" fill="currentColor"/></svg><span>ANÁLISE</span><strong>Os compostos medidos</strong><small>Ácidos · concentrações</small></div>
              <p>Sentir e medir oferecem informações diferentes sobre o mesmo café. Nomear um ácido específico pede análise do lote.</p>
            </div>
          </div>
          <details className={origin.science}>
            <summary>Estudos para explorar essa leitura</summary>
            <p><a href="https://www.scielo.br/j/eagri/a/QPFYN8QGWFC85gc85SDkR5p/?format=html&amp;lang=pt" target="_blank" rel="noopener noreferrer">Londrina: altitude e solo</a> · <a href="https://www.alice.cnptia.embrapa.br/alice/handle/doc/656690" target="_blank" rel="noopener noreferrer">IAPAR/Embrapa: maturação e clima</a> · <a href="https://pubmed.ncbi.nlm.nih.gov/30361029/" target="_blank" rel="noopener noreferrer">Tipicidade e múltiplos fatores da origem</a> · <a href="https://coffeescience.ufla.br/index.php/Coffeescience/article/view/1878" target="_blank" rel="noopener noreferrer">Altitude e perfis de torra</a> · <a href="https://pubmed.ncbi.nlm.nih.gov/36984852/" target="_blank" rel="noopener noreferrer">Torra e preparo no Havaí</a> · <a href="https://pubmed.ncbi.nlm.nih.gov/37033739/" target="_blank" rel="noopener noreferrer">Ácidos e percepção na bebida</a>.</p>
          </details>
        </section>

        <section className={origin.career} aria-labelledby="career-title">
          <div className={origin.careerIntro}>
            <p className={origin.kicker}>DO PARANÁ PARA O MUNDO</p>
            <h2 id="career-title">As coordenadas mudaram. O compromisso com a origem permaneceu.</h2>
          </div>
          <figure className={origin.worldPhoto}>
            <Image src="/brand/story/bispo-parana-mundo.jpeg" alt="Mapa iluminado da Bispo Coffees, fotografado no espaço da marca: linhas partem do Paraná em direção a Barcelona e Londres" width={1536} height={1152} sizes="(max-width: 700px) 100vw, 1000px" />
            <figcaption><strong>Do Paraná para o mundo.</strong> O mapa no espaço da Bispo reúne visualmente a origem paranaense, Barcelona e a conexão com Londres. A fotografia mostra a forma como a marca conta seu percurso; as linhas não representam rotas de cada lote.</figcaption>
          </figure>
          <div className={origin.careerChapters} aria-label="Da Capricornio e da Longitude à Bispo">
            <article><div className={origin.careerMark}><OriginIcon kind="place"/><span>2015 · CAPRICORNIO COFFEES</span></div><h3>Uma latitude ganha voz</h3><p>Como cofundador da Capricornio Coffees, José ajudou a dar visibilidade a cafés de São Paulo e do Paraná próximos ao Trópico de Capricórnio.</p></article>
            <article><div className={origin.careerMark}><OriginIcon kind="taste"/><span>LONGITUDE → BISPO</span></div><h3>Dois caminhos, uma escolha</h3><p>José e Suzi fundaram o conceito da Longitude Coffees, reunindo origem, orientação a produtores e conexão com mercados internacionais. A visão compartilhada evoluiu para a Bispo Coffees, fundada pelos dois.</p></article>
          </div>
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
