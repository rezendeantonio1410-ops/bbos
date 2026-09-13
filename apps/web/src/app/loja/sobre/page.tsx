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
          <h2>Duas trajetórias. Uma forma muito humana de escolher café.</h2>
          <span>
            José Rezende e Suzi Ninov unem origem, prova, produção,
            sustentabilidade e mercado para fazer uma escolha complexa chegar
            simples à sua xícara.
          </span>
        </div>
        <div className={authority.peopleMarks}>
          <article className={authority.personPrimary}>
            <small>ORIGEM · QUALIDADE · MERCADO</small>
            <strong>José Rezende</strong>
            <span>Uma vida conectando produtores, café e pessoas.</span>
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
            <span>Olhar atento para o que existe antes da xícara.</span>
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

        <div className={authority.storyChapters}>
          <article>
            <small>01 · RAÍZES</small>
            <h3>Do campo para o mundo</h3>
            <p>
              José cresceu em uma família de produtores de café no Norte do
              Paraná. Desde 2003, constrói uma trajetória que atravessa prova
              profissional, certificações, desenvolvimento de origens,
              proximidade com produtores e abertura de mercados para cafés
              brasileiros.
            </p>
          </article>
          <article>
            <small>02 · ENCONTRO</small>
            <h3>Critério que se completa</h3>
            <p>
              Suzi soma à história uma visão conectada à produção e à
              sustentabilidade. Seu olhar amplia o cuidado: entender a origem,
              reconhecer o potencial e preservar o valor de cada escolha até o
              café chegar às pessoas.
            </p>
          </article>
          <article>
            <small>03 · BISPO COFFEES</small>
            <h3>Complexo para nós. Simples para você.</h3>
            <p>
              A Bispo nasce da parceria dos dois. A experiência de campo e
              mercado encontra a atenção ao processo para selecionar cafés com
              identidade, traduzi-los por sensação e ajudar cada pessoa a
              encontrar uma xícara que combine com ela.
            </p>
          </article>
        </div>

        <div className={authority.documentaryNote}>
          <p>
            A expansão internacional da operação, hoje também presente em
            Barcelona, torna visível um percurso que já estava no trabalho:
            levar a origem brasileira para novos mercados com verdade,
            proximidade e critério.
          </p>
          <b>BRASIL → EUROPA → MUNDO</b>
        </div>
        <Link className={authority.peopleLink} href="/loja#cafes">
          Conhecer os cafés escolhidos por nós →
        </Link>
      </section>
      <section className={styles.valueStrip}>
        <span>José + Suzi.</span>
        <span>Origem brasileira.</span>
        <span>Presença em Barcelona.</span>
        <span>Do campo à xícara.</span>
      </section>
    </main>
  );
}
