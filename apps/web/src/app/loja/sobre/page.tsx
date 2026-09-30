import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import styles from "../page.module.css";
import authority from "../authority.module.css";
import brand from "../brand-review.module.css";
import storyBrand from "./brand.module.css";
import storyNav from "../story-navigation.module.css";
import { loadStorefrontMedia } from "@/lib/storefront-media";

export const metadata: Metadata = {
  title: "José Rezende e Suzi Ninov — fundadores",
  description: "Conheça José Rezende e Suzi Ninov: campo, qualidade, prova, torra e mercado internacional antes de cada escolha da Bispo Coffees.",
  alternates: { canonical: "/loja/sobre" },
};

export const revalidate = 300;

const founderStructuredData = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Bispo Coffees",
  url: "https://loja.bispocoffees.com.br",
  founder: [
    {
      "@type": "Person",
      name: "José Antônio Rezende da Silva",
      alternateName: ["José Rezende", "Bispo"],
      knowsAbout: [
        "café especial",
        "avaliação sensorial",
        "torra de café",
        "qualidade na origem",
        "mercado internacional de café",
      ],
    },
    {
      "@type": "Person",
      name: "Suzete Ninov",
      alternateName: "Suzi Ninov",
      knowsAbout: [
        "cafeicultura",
        "nutrição de plantas",
        "fertilidade do solo",
        "manejo sustentável",
        "qualidade do café",
      ],
    },
  ],
};

export default async function SobrePage() {
  const media = await loadStorefrontMedia();
  return (
    <main className={`${styles.page} ${brand.storefront} ${storyBrand.page}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(founderStructuredData) }}
      />
      <div className={styles.commerceBar}>
        <span>Frete grátis Sul + Sudeste em compras a partir de R$ 270</span>
        <Link href="/loja#cafes">Escolher cafés →</Link>
      </div>
      <header className={`${styles.header} ${storyNav.header}`}>
        <Link href="/loja" className={styles.brand}>
          <Image
            src="/brand/logo/bispo-logo-official-transparent.png"
            width={176}
            height={58}
            alt="Bispo Coffees"
            priority
          />
        </Link>
        <nav className={`${styles.nav} ${storyNav.nav}`} aria-label="Navegação principal">
          <Link href="/loja#cafes">Cafés</Link>
          <Link href="/loja#camadas">Escolher</Link>
          <Link href="/loja/descobrir">Descobrir o meu</Link>
          <Link href="/loja/sobre" aria-current="page">Sobre a Bispo</Link>
          <Link href="/loja/origem">A geografia na xícara</Link>
        </nav>
        <div className={styles.actions}>
          <Link href="/loja#cafes" aria-label="Ver cafés">Ver cafés</Link>
        </div>
      </header>

      <section className={authority.peopleLayer}>
        <div className={authority.peopleLead}>
          <p>O BISPO · A BISPO</p>
          <h1>O Bispo é José. A Bispo é José e Suzi.</h1>
          <span>
            O apelido nasceu da trajetória de José no café. A marca nasce do
            encontro dessa história com a experiência própria de Suzi — dois
            fundadores, duas leituras e uma escolha compartilhada.
          </span>
        </div>
        <div className={authority.peopleMarks}>
          <article className={authority.personPrimary}>
            <small>CAMPO DESDE 2003 · MERCADO INTERNACIONAL DESDE 2015</small>
            <strong>José Rezende</strong>
            <span>
              Q-Grader e cofundador da Capricornio Coffees, conecta produtores,
              prova, torra e mercado.
            </span>
          </article>
          <div className={authority.thread}>
            <i />
            <i />
            <i />
            <i />
          </div>
          <article className={authority.personSecondary}>
            <small>PARANÁ DESDE 2006 · PLANTA · NUTRIÇÃO · PRODUÇÃO</small>
            <strong>Suzi Ninov</strong>
            <span>
              Cofundadora, conecta manejo, fertilidade, produtividade e
              qualidade em cada escolha.
            </span>
          </article>
        </div>

        <div className={authority.fieldStory}>
          <figure className={authority.fieldShot}>
            <Image
              src={media.slots["about.jose.field"]?.url ?? "/brand/story/jose-origem.jpeg"}
              alt={media.slots["about.jose.field"]?.altText ?? "José Rezende examinando um cafeeiro na origem"}
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
              src={media.slots["about.suzi.cupping"]?.url ?? "/brand/story/suzi-fragrancia.jpeg"}
              alt={media.slots["about.suzi.cupping"]?.altText ?? "Suzi Ninov avaliando a fragrância do café"}
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
          <small>A AUTORIDADE VEM ANTES DA MARCA</small>
          <p>
            José e Suzi não chegam ao café quando a embalagem fica pronta. O
            trabalho começa no campo, passa pela planta, pelo processamento,
            pela prova e pela torra — e só então encontra o mercado. A Bispo é
            a continuidade desse percurso, não uma história criada para vender.
          </p>
        </blockquote>

        <ol className={authority.milestoneRail} aria-label="Marcos da trajetória dos fundadores">
          <li><b>2003</b><span>José inicia o trabalho continuado com produtores.</span></li>
          <li><b>2006</b><span>Suzi chega ao Paraná e aproxima nutrição, solo e café.</span></li>
          <li><b>2010</b><span>José conquista a certificação Q-Grader.</span></li>
          <li><b>2015</b><span>José cofunda a Capricornio e amplia o acesso ao mercado internacional.</span></li>
          <li><b>2024</b><span>José e Suzi reúnem suas leituras no projeto Longitude.</span></li>
        </ol>

        <div className={authority.storyChapters}>
          <article>
            <small>01 · JOSÉ REZENDE</small>
            <h3>Da lavoura ao mercado internacional</h3>
            <p>
              Filho de produtores, José cresceu entre lavouras do Norte do
              Paraná. Desde 2003, trabalha com cafeicultores em qualidade,
              produtividade e processamento. Tornou-se provador profissional em
              2004 e Q-Grader em 2010. Também participou de formação de
              provadores, capacitação para certificação Fairtrade e iniciativas
              de indicação geográfica.
            </p>
            <p>
              Em 2015, cofundou a Capricornio Coffees para desenvolver e levar
              ao mercado cafés do Paraná e de São Paulo próximos ao Trópico de
              Capricórnio. A atuação uniu assistência na origem, seleção de
              qualidade e diálogo direto com importadores e torrefadores. É aí
              que sua experiência de campo se torna também experiência de
              mercado internacional.
            </p>
          </article>
          <article>
            <small>02 · SUZI NINOV</small>
            <h3>A qualidade antes da prova</h3>
            <p>
              Criada no campo, no Rio Grande do Sul, Suzi trabalha desde 2006 no
              Paraná. Sua atuação técnica acontece ao lado de produtores, na
              leitura da planta, no manejo da fertilidade, na nutrição e no uso
              responsável dos recursos do solo. Qualidade e produtividade são
              tratadas como resultado de acompanhamento, não de uma intervenção
              isolada na colheita.
            </p>
            <p>
              Em 2017, um cafeicultor acompanhado por Suzi conquistou um prêmio
              nacional de qualidade. Em 2024, ela reuniu sua experiência à de
              José no projeto Longitude. Hoje, uma torrefação europeia apresenta
              os dois nominalmente como responsáveis por um café do Paraná. Na
              Bispo, a leitura de Suzi participa da decisão — não aparece apenas
              como apoio à história de José.
            </p>
          </article>
          <article>
            <small>03 · O MÉTODO BISPO</small>
            <h3>Campo, prova e mercado na mesma decisão</h3>
            <p>
              Suzi lê a planta, o solo, o manejo e a relação com o produtor.
              José lê a origem, o processamento, a prova, a torra e o mercado.
              A seleção acontece quando essas duas leituras concordam. É isso
              que permite explicar por que um lote está na Bispo e o que ele
              pode entregar na xícara.
            </p>
            <p>
              “Bispo” é como José é conhecido há anos, mas a marca só é inteira
              porque carrega também o conhecimento e a presença de Suzi. O nome
              é singular; o critério é dos dois. O complexo fica com eles. Para
              quem compra, ficam uma escolha clara e uma xícara que vale
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
        <section className={authority.evidence} aria-labelledby="rastro-publico">
          <header>
            <small>RASTRO PÚBLICO</small>
            <h2 id="rastro-publico">A trajetória aparece fora da Bispo.</h2>
            <p>
              Registros de imprensa, universidade, importador e torrefação
              ajudam a conferir datas, funções e presença internacional.
            </p>
          </header>
          <div className={authority.evidenceGrid}>
            <article>
              <small>2015 · FUNDAÇÃO</small>
              <strong>José entre os fundadores da Capricornio.</strong>
              <p>A imprensa setorial registra a criação da exportadora e a proposta dos cafés do Trópico de Capricórnio.</p>
              <a href="https://revistacafeicultura.com.br/do-tropico-de-capricornio-para-as-xicaras-mais-nobres/" target="_blank" rel="noreferrer">Revista Cafeicultura ↗</a>
            </article>
            <article>
              <small>2018 · PRODUTORES</small>
              <strong>Qualidade ligada a orientação e valor.</strong>
              <p>A FAEP registra José como Q-Grader e um programa de longo prazo que orientava produtores e remunerava qualidade.</p>
              <a href="https://www.sistemafaep.org.br/wp-content/uploads/2018/06/BI-1437_2.pdf" target="_blank" rel="noreferrer">Sistema FAEP ↗</a>
            </article>
            <article>
              <small>2011–2015 · CAMPO AO MERCADO</small>
              <strong>“Bispo” citado por um produtor parceiro.</strong>
              <p>A Hacienda La Minita registra a assistência técnica de José desde 2011 e o acesso ao mercado de maior valor pela Capricornio em 2015.</p>
              <a href="https://www.laminita.com/farms-mills/juarez-colatino-barros" target="_blank" rel="noreferrer">Hacienda La Minita ↗</a>
            </article>
            <article>
              <small>EUROPA · JOSÉ + SUZI</small>
              <strong>Os dois apresentados juntos na origem.</strong>
              <p>A Kolibri vende na Europa um café do Paraná e identifica o projeto como conduzido por José e Suzi.</p>
              <div className={authority.evidenceLinks}>
                <a href="https://kolibricoffee.com/product/parana/" target="_blank" rel="noreferrer">Kolibri Coffee Roasters ↗</a>
                <a href="https://thissideup.coffee/coffee-passport-sr-brazil-piraju" target="_blank" rel="noreferrer">Trajetória na This Side Up ↗</a>
              </div>
            </article>
          </div>
        </section>
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
