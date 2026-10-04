import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import styles from "../page.module.css";
import authority from "../authority.module.css";
import brand from "../brand-review.module.css";
import storyBrand from "./brand.module.css";
import storyNav from "../story-navigation.module.css";
import premium from "../premium-overrides.module.css";
import MobileStoreMenu from "../MobileStoreMenu";

export const metadata: Metadata = {
  title: "Suzi Ninov e José Rezende — fundadores da Bispo Coffees",
  description:
    "Duas histórias que começaram muito antes da Bispo Coffees e hoje se encontram no campo, na qualidade, na prova, na torra e no mercado.",
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
      jobTitle: "Empresário e cofundador da Bispo Coffees",
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
      jobTitle: "Empresária e cofundadora da Bispo Coffees",
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

export default function SobrePage() {
  return (
    <main className={`${styles.page} ${brand.storefront} ${storyBrand.page}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(founderStructuredData),
        }}
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
        <nav
          className={`${styles.nav} ${storyNav.nav} ${premium.desktopNav}`}
          aria-label="Navegação principal"
        >
          <Link href="/loja#cafes">Cafés</Link>
          <Link href="/loja#camadas">Escolher</Link>
          <Link href="/loja/descobrir">Descobrir o meu</Link>
          <Link href="/loja/sobre" aria-current="page">
            Sobre a Bispo
          </Link>
          <Link href="/loja/origem">A geografia na xícara</Link>
        </nav>
        <div className={storyBrand.shopControl}>
          <Link
            className={storyBrand.shopLink}
            href="/loja#cafes"
            aria-label="Ver cafés"
          >
            Ver cafés ↗
          </Link>
          <MobileStoreMenu />
        </div>
      </header>

      <section className={authority.peopleLayer}>
        <div className={authority.peopleLead}>
          <p>DOIS FUNDADORES · UMA ESCOLHA</p>
          <h1>A Bispo é o encontro de Suzi e José.</h1>
          <span>
            Muito antes de existir a Bispo, Suzi e José já tinham histórias
            próprias no campo, na cafeicultura e no mercado. A marca leva um
            apelido da trajetória de José, mas nasce do encontro entre duas
            experiências inteiras.
          </span>
        </div>
        <div className={authority.peopleMarks}>
          <article className={authority.personCard}>
            <small>EMPRESÁRIA · COFUNDADORA · CAMPO DESDE 2007</small>
            <strong>Suzi Ninov</strong>
            <span>
              Empresária e cofundadora da Bispo Coffees. Conecta manejo,
              fertilidade, produtividade e qualidade em cada escolha.
            </span>
          </article>
          <div className={authority.thread}>
            <i />
            <i />
            <i />
            <i />
          </div>
          <article className={authority.personCard}>
            <small>EMPRESÁRIO · COFUNDADOR · CAMPO DESDE 2003</small>
            <strong>José Rezende</strong>
            <span>
              Empresário e cofundador da Bispo Coffees. Q-Grader, conecta
              produtores, prova, torra e mercado.
            </span>
          </article>
        </div>

        <div className={authority.fieldStory}>
          <figure className={authority.fieldShot}>
            <Image
              src="/brand/editorial/real/suzi-cuidado-na-planta.jpg"
              alt="Suzi Ninov observando uma planta de café na lavoura"
              fill
              sizes="(max-width: 560px) 82vw, 50vw"
            />
            <i className={authority.fieldVeil} />
            <figcaption className={authority.fieldCaption}>
              <span>SUZI · CAMPO</span>
              <strong>O cuidado reconhece o potencial antes da xícara.</strong>
            </figcaption>
          </figure>
          <figure className={authority.fieldShot}>
            <Image
              src="/brand/founders/jose-rezende.jpg"
              alt="José Rezende avaliando o aroma de um café em prova"
              fill
              sizes="(max-width: 560px) 82vw, 50vw"
            />
            <i className={authority.fieldVeil} />
            <figcaption className={authority.fieldCaption}>
              <span>JOSÉ · PROVA</span>
              <strong>A qualidade se confirma na xícara.</strong>
            </figcaption>
          </figure>
        </div>

        <blockquote className={authority.storyManifesto}>
          <small>A AUTORIDADE VEM ANTES DA MARCA</small>
          <p>
            José e Suzi não chegam ao café quando a embalagem fica pronta. O
            trabalho começa no campo, passa pela planta, pelo processamento,
            pela prova e pela torra — e só então encontra o mercado. A Bispo é a
            continuidade desse percurso, não uma história criada para vender.
          </p>
        </blockquote>

        <ol
          className={authority.milestoneRail}
          aria-label="Marcos da trajetória dos fundadores"
        >
          <li>
            <b>MUITO ANTES DA BISPO</b>
            <span>
              Suzi cresce em um sítio no Rio Grande do Sul. José cresce em
              uma família de produtores no Norte do Paraná.
            </span>
          </li>
          <li>
            <b>2003 · 2007</b>
            <span>
              José inicia o trabalho continuado com produtores. Suzi passa a
              atuar com cafeicultura no Paraná.
            </span>
          </li>
          <li>
            <b>2010 · 2017</b>
            <span>
              José se torna Q-Grader e cofundador da Capricornio. O trabalho de
              campo de Suzi contribui para uma conquista nacional de qualidade.
            </span>
          </li>
          <li>
            <b>2024 · BISPO</b>
            <span>
              Duas trajetórias anteriores à marca se encontram em uma escolha
              compartilhada.
            </span>
          </li>
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
            <h3>Do campo à construção empresarial</h3>
            <p>
              Empresária e cofundadora da Bispo Coffees, Suzi foi criada no
              campo, no Rio Grande do Sul, e trabalha com cafeicultura no Paraná
              desde 2007. Sua história profissional começou muito antes da
              marca: ao lado de produtores, construiu experiência na leitura da
              planta, no manejo da fertilidade, na nutrição e no uso responsável
              dos recursos do solo.
            </p>
            <p>
              Esse acompanhamento também se traduziu em reconhecimento
              nacional: em 2017, um dos cafés desenvolvidos junto a produtores
              atendidos por Suzi alcançou o primeiro lugar em sua categoria em
              um concurso de qualidade. Mais do que uma premiação isolada, o
              resultado expressa a continuidade entre manejo, nutrição,
              produtividade e qualidade na xícara.
            </p>
            <blockquote className={authority.suziPrinciple}>
              <p>
                “Produtividade precisa vir acompanhada de rentabilidade para o
                produtor e responsabilidade ambiental, sempre com atenção às
                próximas gerações.”
              </p>
              <cite>Suzi Ninov</cite>
            </blockquote>
          </article>
          <article>
            <small>03 · O MÉTODO BISPO</small>
            <h3>Campo, prova e mercado na mesma decisão</h3>
            <p>
              Suzi lê a planta, o solo, o manejo e a relação com o produtor.
              José lê a origem, o processamento, a prova, a torra e o mercado. A
              seleção acontece quando essas duas leituras concordam. É isso que
              permite explicar por que um lote está na Bispo e o que ele pode
              entregar na xícara.
            </p>
            <p>
              A experiência construída por Suzi e José entre lavouras, prova,
              sustentabilidade e mercados internacionais chega agora à xícara.
              Cafés brasileiros escolhidos com o mesmo rigor aplicado às origens
              apresentadas ao mundo — torrados para revelar identidade, não para
              escondê-la.
            </p>
          </article>
        </div>

        <section
          className={authority.evidence}
          aria-labelledby="rastro-publico"
        >
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
              <small>JOSÉ · 2011–2018</small>
              <strong>Da assistência na origem ao mercado.</strong>
              <p>
                Registros externos acompanham José na assistência técnica, na
                prova, na criação da Capricornio e na conexão com compradores.
              </p>
              <div className={authority.evidenceLinks}>
                <a
                  href="https://revistacafeicultura.com.br/do-tropico-de-capricornio-para-as-xicaras-mais-nobres/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Revista Cafeicultura ↗
                </a>
                <a
                  href="https://www.sistemafaep.org.br/wp-content/uploads/2018/06/BI-1437_2.pdf"
                  target="_blank"
                  rel="noreferrer"
                >
                  Sistema FAEP ↗
                </a>
                <a
                  href="https://www.laminita.com/farms-mills/juarez-colatino-barros"
                  target="_blank"
                  rel="noreferrer"
                >
                  Hacienda La Minita ↗
                </a>
              </div>
            </article>
            <article>
              <small>SUZI · CAMPO E QUALIDADE</small>
              <strong>Do acompanhamento técnico ao reconhecimento.</strong>
              <p>
                Em 2017, um café desenvolvido com acompanhamento técnico de
                Suzi conquistou o primeiro lugar nacional em sua categoria.
              </p>
              <div className={authority.evidenceLinks}>
                <a
                  href="https://www.yarabrasil.com.br/sobre-yara/concurso-nossocafe/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Registro da premiação · 2017 ↗
                </a>
              </div>
            </article>
            <article>
              <small>SUZI + JOSÉ · EUROPA</small>
              <strong>As duas trajetórias apresentadas juntas.</strong>
              <p>
                Cafés do Paraná são apresentados no mercado europeu como parte
                de um projeto conduzido por Suzi e José.
              </p>
              <div className={authority.evidenceLinks}>
                <a
                  href="https://kolibricoffee.com/product/parana/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Kolibri Coffee Roasters ↗
                </a>
                <a
                  href="https://thissideup.coffee/coffee-passport-sr-brazil-piraju"
                  target="_blank"
                  rel="noreferrer"
                >
                  Trajetória na This Side Up ↗
                </a>
              </div>
            </article>
          </div>
        </section>
        <Link className={authority.peopleLink} href="/loja#cafes">
          Conhecer os cafés escolhidos por nós →
        </Link>
      </section>
      <section className={styles.valueStrip}>
        <span>Suzi + José.</span>
        <span>Origem brasileira.</span>
        <span>Padrão Brasil e Europa.</span>
        <span>Do campo à xícara.</span>
      </section>
    </main>
  );
}
