import Image from "next/image";
import Link from "next/link";
import styles from "../page.module.css";
import authority from "../authority.module.css";

export default function SobrePage() {
  return (
    <main className={styles.page}>
      <div className={styles.commerceBar}>
        <span>Frete grátis Sul + Sudeste em compras a partir de R$ 270</span>
        <Link href="/loja#cafes">Escolher cafés →</Link>
      </div>
      <header className={styles.header}>
        <Link href="/loja" className={styles.brand}>
          <Image
            src="/brand/logo/bispo-logo-official-transparent.png"
            width={176}
            height={58}
            alt="Bispo Coffees"
            priority
          />
        </Link>
        <nav className={styles.nav}>
          <Link href="/loja#cafes">Cafés</Link>
          <Link href="/loja#linhas">Linhas</Link>
          <Link href="/loja/descobrir">Descobrir o meu</Link>
          <Link href="/loja/aprender">Aprender</Link>
          <Link href="/loja/sobre">Sobre a empresa</Link>
        </nav>
        <div className={styles.actions}>
          <button aria-label="Buscar">⌕</button>
          <button aria-label="Minha conta">○</button>
          <button aria-label="Sacola">□</button>
        </div>
      </header>

      <section className={authority.peopleLayer}>
        <div className={authority.peopleLead}>
          <p>SOBRE A BISPO COFFEES</p>
          <h2>Duas trajetórias que escolheram caminhar juntas.</h2>
          <span>
            A Bispo Coffees nasce de duas histórias completas no café — e de uma
            parceria construída no campo, na prova e nas escolhas de cada dia.
          </span>
        </div>
        <div className={authority.peopleMarks}>
          <article className={authority.personPrimary}>
            <small>ORIGEM · QUALIDADE · MERCADO</small>
            <strong>José Rezende</strong>
            <span>
              Origem, prova e uma vida conectando produtores a mercados.
            </span>
          </article>
          <div className={authority.thread}>
            <i />
            <i />
            <i />
            <i />
          </div>
          <article className={authority.personSecondary}>
            <small>PRODUÇÃO · SUSTENTABILIDADE · CRITÉRIO</small>
            <strong>Suzi Ninov</strong>
            <span>Planta, solo e conhecimento transformados em qualidade.</span>
          </article>
        </div>

        <div className={authority.fieldStory}>
          <figure className={authority.fieldShot}>
            <Image
              src="/brand/story/jose-origem.jpeg"
              alt="José Rezende examinando um cafeeiro na origem"
              fill
              sizes="(max-width: 560px) 82vw, (max-width: 900px) 50vw, 62vw"
            />
            <i className={authority.fieldVeil} />
            <figcaption className={authority.fieldCaption}>
              <span>JOSÉ · ORIGEM</span>
              <strong>A qualidade começa perto de quem produz.</strong>
            </figcaption>
          </figure>
          <figure className={authority.fieldShot}>
            <Image
              src="/brand/story/suzi-fragrancia.jpeg"
              alt="Suzi Ninov avaliando a fragrância do café"
              fill
              sizes="(max-width: 560px) 82vw, (max-width: 900px) 50vw, 38vw"
            />
            <i className={authority.fieldVeil} />
            <figcaption className={authority.fieldCaption}>
              <span>SUZI · CRITÉRIO</span>
              <strong>O cuidado reconhece o potencial antes da xícara.</strong>
            </figcaption>
          </figure>
        </div>

        <blockquote className={authority.storyManifesto}>
          <small>UMA HISTÓRIA COMPARTILHADA</small>
          <p>
            José conhece o café pela origem, pela prova e pelo mercado. Suzi o
            conhece pela planta, pelo solo e pelas pessoas. A Bispo nasce do
            encontro entre essas duas autoridades — diferentes, inteiras e
            complementares — e de uma convicção comum: qualidade só existe
            quando conhecimento, confiança e presença percorrem todo o caminho.
          </p>
        </blockquote>

        <div className={authority.storyChapters}>
          <article>
            <small>01 · JOSÉ REZENDE</small>
            <h3>Da origem brasileira aos mercados do mundo</h3>
            <p>
              Filho de produtores, José cresceu entre lavouras do Norte do
              Paraná e fez do café o fio de sua vida. Desde 2003, atua ao lado
              de produtores em qualidade, produtividade, processamento e acesso
              a mercados. Tornou-se provador profissional em 2004, aprofundou a
              metodologia SCA e conquistou a certificação Q-Grader em 2010.
            </p>
            <p>
              Sua trajetória atravessa o Norte Novo e o Norte Pioneiro do
              Paraná, formação de provadores, iniciativas de indicação
              geográfica, certificação Fairtrade e projetos com organizações de
              produtores também em São Paulo. Como cofundador da Capricornio
              Coffees, ajudou a apresentar cafés brasileiros a compradores de
              diferentes continentes sem perder a proximidade com a origem.
            </p>
          </article>
          <article>
            <small>02 · SUZI NINOV</small>
            <h3>A ciência do cultivo com atenção às pessoas</h3>
            <p>
              Criada no campo, no Rio Grande do Sul, Suzi encontrou no Paraná
              sua vocação para a cafeicultura. Sua experiência agronômica une
              nutrição, produtividade e sustentabilidade a uma compreensão
              profunda da planta e dos recursos finitos do solo. Para ela, um
              café de alta qualidade começa no respeito ao organismo vivo e a
              quem o cultiva.
            </p>
            <p>
              Ao longo da carreira no agronegócio, tornou-se referência para
              produtores e organizações, levando conhecimento técnico até a
              prática. Em 2017, um dos cafeicultores acompanhados por ela
              conquistou o prêmio de melhor café do Brasil. Na Bispo, Suzi é
              fundadora e protagonista: sua leitura da produção sustenta cada
              escolha que chega à xícara.
            </p>
          </article>
          <article>
            <small>03 · BISPO COFFEES</small>
            <h3>Duas autoridades, uma assinatura</h3>
            <p>
              José e Suzi chegam à mesma decisão por conhecimentos diferentes.
              Ele lê a origem, a prova e o mercado; ela lê a planta, o solo e o
              processo. Juntos, selecionam cafés com identidade, traduzem anos
              de experiência em sensações claras e aproximam quem produz de quem
              bebe.
            </p>
            <p>
              “Bispo” é como José é conhecido há anos, mas a marca só é inteira
              porque carrega também a história, o critério e a presença de Suzi.
              O nome é singular; a construção é dos dois. O complexo fica com
              eles. Para você, fica o prazer de reconhecer uma xícara que vale
              reencontrar.
            </p>
          </article>
        </div>

        <div className={authority.documentaryNote}>
          <p>
            A experiência construída por José e Suzi entre lavouras, prova,
            sustentabilidade e mercados internacionais chega agora à xícara.
            Cafés brasileiros escolhidos com o mesmo rigor aplicado às origens
            apresentadas ao mundo — torrados para revelar identidade, não para
            escondê-la.
          </p>
          <b>DO CAFÉ VERDE À SUA XÍCARA</b>
        </div>
        <Link className={authority.peopleLink} href="/loja#cafes">
          Conhecer os cafés escolhidos por nós →
        </Link>
      </section>
      <section className={styles.valueStrip}>
        <span>José + Suzi.</span>
        <span>Origem brasileira.</span>
        <span>Padrão Brasil e Europa.</span>
        <span>Do campo à xícara.</span>
      </section>
    </main>
  );
}
