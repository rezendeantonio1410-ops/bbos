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
            A Bispo Coffees nasceu do encontro entre experiência e cuidado — e
            de uma parceria construída todos os dias, dentro e fora do café.
          </span>
        </div>
        <div className={authority.peopleMarks}>
          <article className={authority.personPrimary}>
            <small>ORIGEM · QUALIDADE · MERCADO</small>
            <strong>José Rezende</strong>
            <span>
              Raízes no campo e uma vida conectando origens e pessoas.
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
            <span>Presença, sensibilidade e cuidado em cada escolha.</span>
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
            Há encontros que somam competências. O de José e Suzi construiu
            também uma direção comum. Entre o campo, a prova, a produção e os
            mercados, os dois aprenderam a olhar para o café pelo mesmo
            princípio: nenhuma qualidade existe sem pessoas, confiança e
            presença. É dessa convivência — feita de escuta, critério e decisões
            compartilhadas — que nasce a Bispo Coffees.
          </p>
        </blockquote>

        <div className={authority.storyChapters}>
          <article>
            <small>01 · RAÍZES</small>
            <h3>Uma vida formada pelo café</h3>
            <p>
              José cresceu em uma família de produtores de café no Norte do
              Paraná, entre os paralelos 22 e 23. Desde 2003, sua trajetória
              atravessa consultoria, prova profissional, certificações,
              sustentabilidade e desenvolvimento de origens. Tornou-se provador
              profissional em 2004, aprofundou a metodologia SCA em 2007 e
              conquistou a certificação Q-Grader em 2010. Do contato direto com
              produtores à exportação, construiu mercados para cafés brasileiros
              sem se afastar de onde tudo começa: o campo.
            </p>
          </article>
          <article>
            <small>02 · ENCONTRO</small>
            <h3>O cuidado que dá sentido ao processo</h3>
            <p>
              Suzi traz uma visão conectada à produção, à sustentabilidade e às
              relações que sustentam o negócio. Seu olhar atento amplia o
              critério técnico: compreender a origem, reconhecer o potencial e
              cuidar para que o valor de cada café seja preservado. Ela
              transforma intenção em presença diária e ajuda a manter pessoas,
              processos e propósito seguindo na mesma direção.
            </p>
          </article>
          <article>
            <small>03 · BISPO COFFEES</small>
            <h3>Uma escolha construída a dois</h3>
            <p>
              A Bispo nasce de uma parceria que atravessa trabalho, escolhas e
              caminhos. José e Suzi se completam porque observam por ângulos
              diferentes e decidem com o mesmo compromisso. Juntos, selecionam
              cafés com identidade, traduzem conhecimento em sensações simples e
              aproximam quem produz de quem bebe. O complexo fica com eles; para
              você, fica o prazer de encontrar uma xícara que combine com o seu
              momento.
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
