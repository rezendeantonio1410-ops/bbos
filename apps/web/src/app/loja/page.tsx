import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";
import playful from "./playful.module.css";

const lines = [
  { name: "GOURMET", copy: "O essencial bem escolhido.", tone: "#F4D54A" },
  { name: "CLÁSSICOS", copy: "Conforto com personalidade.", tone: "#E78A38" },
  { name: "ÉPICOS", copy: "Feito para descobrir.", tone: "#387D50" },
  { name: "RAROS", copy: "Poucos. Únicos.", tone: "#B83A31" },
];

const products = [
  { name: "Caramelo", line: "CLÁSSICOS", notes: "Caramelo · Chocolate", price: "R$ 68", tone: "#E78A38" },
  { name: "Doce de Leite", line: "CLÁSSICOS", notes: "Mascavo · Doce de leite · Alfajor", price: "R$ 74", tone: "#D9A333" },
  { name: "Tangerina", line: "CLÁSSICOS", notes: "Cítrico · Doce · Fresco", price: "R$ 68", tone: "#E88A2E" },
  { name: "Singular", line: "ÉPICOS", notes: "Frutado · Complexo · Evolutivo", price: "R$ 85", tone: "#387D50" },
];

const moments = [
  { title: "Começar devagar", cue: "macio · doce · fácil", line: "GOURMET", tone: "#F4D54A", mark: "☀" },
  { title: "Uma pausa boa", cue: "caramelo · chocolate · conforto", line: "CLÁSSICOS", tone: "#E78A38", mark: "◐" },
  { title: "Quero perceber algo novo", cue: "fruta · frescor · evolução", line: "ÉPICOS", tone: "#387D50", mark: "✦" },
  { title: "Hoje merece algo raro", cue: "floral · delicado · memorável", line: "RAROS", tone: "#B83A31", mark: "◇" },
];

export default function LojaPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a href="#top" className={styles.brand} aria-label="Bispo Coffees">
          <Image src="/brand/logo/bispo-logo-official-transparent.png" width={176} height={58} alt="Bispo Coffees" priority />
        </a>
        <nav className={styles.nav} aria-label="Navegação principal">
          <a href="#cafes">Cafés</a>
          <a href="#linhas">Linhas</a>
          <Link href="/loja/descobrir">Descobrir o meu</Link>
          <a href="#aprender">Aprender</a>
        </nav>
        <div className={styles.actions} aria-label="Ações">
          <button aria-label="Buscar">⌕</button><button aria-label="Minha conta">○</button><button aria-label="Sacola">□</button>
        </div>
      </header>

      <section id="top" className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>BISPO · JOSÉ REZENDE <span>Café, desde 2003.</span></p>
          <h1>Antes da xícara,<br />há uma escolha.</h1>
          <p className={styles.subcopy}>Cafés brasileiros selecionados com critério, consistência e experiência.</p>
          <div className={styles.heroButtons}>
            <a className={styles.primaryCta} href="#cafes">Comprar cafés <span>→</span></a>
            <Link className={styles.secondaryCta} href="/loja/descobrir">Descobrir o meu <span>→</span></Link>
          </div>
          <div className={styles.colorSignal} aria-hidden="true">{lines.map((line) => <i key={line.name} style={{ background: line.tone }} />)}</div>
        </div>

        <div className={styles.authorityVisual} aria-label="Seleção na origem">
          <div className={styles.visualWords}><span>origem</span><span>escolha</span><span>xícara</span></div>
          <div className={styles.branch} aria-hidden="true">
            <b className={styles.leafOne} /><b className={styles.leafTwo} /><b className={styles.leafThree} />
            <i className={styles.cherryOne} /><i className={styles.cherryTwo} /><i className={styles.cherryThree} />
          </div>
          <div className={styles.signature}><strong>Bispo</strong><span>José Rezende</span></div>
        </div>
      </section>

      <section id="linhas" className={styles.linesSection}>
        <div className={styles.sectionIntro}><p>QUATRO CAMINHOS</p><h2>Qual Bispo é o seu?</h2><span>Do café para todos os dias ao extraordinário.</span></div>
        <div className={styles.lineGrid}>
          {lines.map((line) => (
            <a key={line.name} href="#cafes" className={styles.lineCard} style={{ "--tone": line.tone } as React.CSSProperties}>
              <div className={styles.bag}><span>BISPO</span><i /></div><div><strong>{line.name}</strong><span>{line.copy}</span></div>
            </a>
          ))}
        </div>
      </section>

      <section id="cafes" className={styles.productsSection}>
        <div className={styles.sectionIntro}><p>OS MAIS ESCOLHIDOS</p><h2>Comece por um perfil.</h2></div>
        <div className={styles.productGrid}>
          {products.map((product) => (
            <article key={product.name} className={styles.productCard}>
              <div className={styles.productVisual} style={{ "--tone": product.tone } as React.CSSProperties}><div className={styles.productBag}><span>BISPO</span><i /></div></div>
              <div className={styles.productMeta}>
                <p>{product.line}</p><h3>{product.name}</h3><span>{product.notes}</span>
                <div className={styles.buyRow}><strong>{product.price} <small>· 500 g</small></strong><button>+ Adicionar</button></div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={playful.momentSection} aria-label="Escolha pelo momento">
        <div className={playful.momentLead}>
          <p>NEM TODO MUNDO ESCOLHE CAFÉ PELO NOME.</p>
          <h2>Às vezes, você escolhe um momento.</h2>
          <span>Passe o olhar. Veja qual sensação encontra você primeiro.</span>
        </div>
        <div className={playful.momentRail}>
          {moments.map((moment, index) => (
            <Link key={moment.title} href="/loja/descobrir" className={playful.momentCard} style={{ "--moment": moment.tone } as React.CSSProperties}>
              <div className={playful.momentTop}><span>{String(index + 1).padStart(2, "0")}</span><b>{moment.mark}</b></div>
              <div className={playful.orbit} aria-hidden="true"><i /><i /><i /></div>
              <div className={playful.momentCopy}><small>{moment.line}</small><strong>{moment.title}</strong><span>{moment.cue}</span><em>me mostre →</em></div>
            </Link>
          ))}
        </div>
        <div className={playful.senseLine} aria-hidden="true"><span>sentir</span><i /><span>reconhecer</span><i /><span>escolher</span><i /><span>provar</span></div>
      </section>

      <section className={styles.peopleLayer} aria-label="Quem sustenta a escolha Bispo">
        <div className={styles.peopleLead}>
          <p>ANTES DA MARCA, EXISTEM TRAJETÓRIAS.</p>
          <h2>Duas experiências.<br />Um mesmo critério.</h2>
          <span>Qualidade se constrói no campo, na prova, na relação com produtores e na consistência de cada escolha.</span>
        </div>
        <div className={styles.peopleMarks}>
          <article className={styles.personPrimary}><small>SELEÇÃO · QUALIDADE · MERCADO</small><strong>José Rezende</strong><span>Bispo</span></article>
          <div className={styles.thread} aria-hidden="true"><i /><i /><i /><i /></div>
          <article className={styles.personSecondary}><small>CAMPO · PRODUÇÃO · SUSTENTABILIDADE</small><strong>Suzi Ninov</strong><span>Uma presença essencial em cada etapa.</span></article>
        </div>
        <a className={styles.peopleLink} href="#aprender">Conhecer quem está por trás da escolha →</a>
      </section>

      <section id="descobrir" className={styles.discovery}>
        <div className={styles.discoveryCopy}>
          <p>NÃO SABE QUAL ESCOLHER?</p><h2>Descubra o seu paladar.</h2>
          <span>Uma experiência curta inspirada na lógica sensorial do cupping — traduzida para escolhas simples.</span>
          <Link href="/loja/descobrir">Descobrir meu café →</Link>
        </div>
        <div className={styles.discoveryPreview} aria-hidden="true">
          <div className={styles.miniWheel}><i /><i /><i /><i /><b>BISPO</b></div>
          <div className={styles.miniMandala}><i /><i /><i /><span>acidez</span></div>
          <div className={styles.discoveryWords}><span>doçura</span><span>acidez</span><span>corpo</span><span>momento</span></div>
        </div>
      </section>

      <section id="aprender" className={styles.valueStrip}><span>Escolhido na origem.</span><span>Consistência, compra após compra.</span><span>Torra fresca.</span><span>Brasil → mundo → sua xícara.</span></section>
    </main>
  );
}
