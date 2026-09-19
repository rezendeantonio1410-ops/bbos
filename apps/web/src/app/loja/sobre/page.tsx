import Image from "next/image";
import Link from "next/link";
import styles from "../page.module.css";
import authority from "../authority.module.css";
import brand from "../brand-review.module.css";
import storyBrand from "./brand.module.css";

export default function SobrePage() {
  return (
    <main className={`${styles.page} ${brand.storefront} ${storyBrand.page}`}>
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
          <h2>José e Suzi. Duas histórias, uma Bispo Coffees.</h2>
          <span>
            Duas histórias próprias no café, uma parceria de vida e uma marca
            construída pelos dois — com conhecimento, sensibilidade e presença.
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
            <span>
              Cofundadora, com história própria no café, visão e critério em
              cada escolha.
            </span>
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
            Duas trajetórias próprias no café encontraram uma direção comum.
            José traz a experiência da origem, da prova e dos mercados. Suzi,
            sua história na produção, na sustentabilidade e no cuidado. É desse
            encontro — feito de escolhas compartilhadas — que nasce a Bispo
            Coffees.
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
            <h3>Uma história própria dentro do café</h3>
            <p>
              Suzi construiu sua relação com o café por meio da produção, da
              sustentabilidade e das relações que sustentam o negócio. Seu olhar
              amplia o critério técnico: compreender a origem, reconhecer o
              potencial e preservar o valor de cada café. Como cofundadora, ela
              participa da direção, das escolhas e da identidade da Bispo.
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
            Durante anos, José e Suzi conectaram produtores brasileiros ao
            mercado europeu por meio do café verde. Desde setembro de 2026, a
            Bispo também disponibiliza aos brasileiros cafés escolhidos com os
            mesmos critérios e padrões aplicados aos cafés destinados à Europa.
            Uma experiência construída entre origem e mercado que agora chega,
            torrada, diretamente à sua xícara.
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
