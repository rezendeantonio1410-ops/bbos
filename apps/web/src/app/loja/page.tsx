import Image from "next/image";
import Link from "next/link";
import styles from "./sales.module.css";
import tight from "./sales-tight.module.css";
import { productImages } from "./product-images";

const products=[
  {name:"Essencial",line:"GOURMET",notes:"Macio · Doce · Fácil",price:"R$ 52",weight:"500 g",tone:"#E6C838",image:productImages["Essencial"],tag:"para todo dia"},
  {name:"Caramelo",line:"CLÁSSICOS",notes:"Caramelo · Chocolate · Equilíbrio",price:"R$ 68",weight:"500 g",tone:"#D97830",image:productImages["Caramelo"],tag:"conforto"},
  {name:"Doce de Leite",line:"CLÁSSICOS",notes:"Mascavo · Doce de leite · Alfajor",price:"R$ 68",weight:"500 g",tone:"#C89725",image:productImages["Doce de Leite"],tag:"doçura"},
  {name:"Tangerina",line:"CLÁSSICOS",notes:"Cítrico · Doce · Fresco",price:"R$ 68",weight:"500 g",tone:"#E48725",image:productImages["Tangerina"],tag:"frescor"},
  {name:"Singular",line:"ÉPICOS",notes:"Frutado · Complexo · Evolutivo",price:"R$ 84",weight:"500 g",tone:"#3B7651",image:productImages["Singular"],tag:"descoberta"},
  {name:"Sublime",line:"ÉPICOS",notes:"Expressivo · Elegante · Profundo",price:"R$ 84",weight:"500 g",tone:"#4D8060",image:productImages["Sublime"],tag:"experiência"}
];

const moments=[
  {title:"Todo dia",copy:"Macio, doce e fácil de reencontrar.",tone:"#E6C838"},
  {title:"Conforto",copy:"Caramelo, chocolate e uma xícara acolhedora.",tone:"#D97830"},
  {title:"Frescor",copy:"Fruta, leveza e uma xícara mais viva.",tone:"#3B7651"}
];

export default function LojaPage(){
  const caramelo=products[1];
  return <main className={styles.page}>
    <div className={styles.commerceBar}><span>Frete grátis Sul + Sudeste em compras a partir de R$ 270</span><a href="#cafes">Comprar cafés →</a></div>
    <header className={styles.header}>
      <a href="#top" className={styles.brand}><Image src="/brand/logo/bispo-logo-official-transparent.png" width={176} height={58} alt="Bispo Coffees" priority/></a>
      <nav className={styles.nav}><a href="#cafes">Cafés</a><a href="#escolher">Escolher</a><Link href="/loja/descobrir">Descobrir o meu</Link><Link href="/loja/sobre">Sobre a Bispo</Link></nav>
      <div className={styles.actions}><button aria-label="Buscar">⌕</button><button aria-label="Minha conta">○</button><button aria-label="Sacola">□</button></div>
    </header>

    <section id="top" className={`${styles.hero} ${tight.hero}`}>
      <div className={`${styles.heroMedia} ${tight.heroMedia}`} data-photo-slot="hero-ritual">
        <video className={`${styles.heroVideo} ${tight.heroVideo}`} autoPlay muted loop playsInline preload="metadata" poster="/WhatsApp Image 2026-09-02 at 17.53.29.jpeg">
          <source src="/WhatsApp Video 2026-09-02 at 17.34.18.mp4" type="video/mp4"/>
        </video>
        <div className={styles.heroShade}/>
        <div className={`${styles.heroSceneLabel} ${tight.heroSceneLabel}`}><span>UM CAFÉ QUE COMEÇA PELOS SENTIDOS</span><b>É daqui que começa a vontade.</b></div>
      </div>

      <div className={`${styles.heroCopy} ${tight.heroCopy}`}>
        <div className={tight.sensoryTopline}><span>CLÁSSICOS</span><i/><b>CARAMELO</b></div>
        <h1 className={tight.sensoryTitle}>Doce. Confortável.<br/><em>Equilibrado.</em></h1>
        <p className={`${styles.subcopy} ${tight.shortCopy}`}>Caramelo e chocolate. Doce na medida. Daqueles cafés que pedem outra xícara.</p>

        <div className={tight.productDesireStage} data-photo-slot="hero-product" aria-label="Café Caramelo em destaque">
          <div className={tight.productAura}/>
          <div className={tight.productShot}>
            {caramelo.image ? <img src={caramelo.image} alt="Embalagem real do café Bispo Caramelo"/> : <div className={tight.productPlaceholder}><small>FOTO REAL</small><b>CARAMELO</b><span>entra aqui</span></div>}
          </div>
          <div className={`${tight.flavorWhisper} ${tight.flavorTop}`}><b>caramelo</b><span>doçura envolvente</span></div>
          <div className={`${tight.flavorWhisper} ${tight.flavorMiddle}`}><b>chocolate</b><span>corpo presente</span></div>
          <div className={`${tight.flavorWhisper} ${tight.flavorBottom}`}><b>equilíbrio</b><span>acidez delicada</span></div>
        </div>

        <div className={tight.sensoryPromise}><span>100% Arábica</span><span>Torra média</span><span>Selecionado na origem</span></div>
        <div className={tight.sensoryBuyRow}><div><small>500 g · em grãos</small><strong>R$ 68,00</strong></div><a className={tight.sensoryCta} href="#cafes">Quero este café <span>→</span></a></div>
        <Link className={tight.sensoryAssist} href="/loja/descobrir">Não é o seu perfil? Descubra o café que combina com você →</Link>
      </div>
    </section>

    <section id="escolher" className={styles.choiceSection}>
      <div className={styles.choiceIntro}><small>COMECE PELO QUE VOCÊ QUER SENTIR</small><h2>Qual xícara combina com o seu momento?</h2><p>Você escolhe a sensação. A Bispo faz a parte difícil.</p></div>
      <div className={styles.choiceGrid}>{moments.map(m=><a key={m.title} href="#cafes" className={styles.choiceCard} style={{"--tone":m.tone} as React.CSSProperties}><i/><span>{m.copy}</span><strong>{m.title}</strong><b>encontrar meu café →</b></a>)}<Link href="/loja/descobrir" className={`${styles.choiceCard} ${styles.discoveryChoice}`}><i/><span>Quero provar algo fora do óbvio.</span><strong>Me surpreenda</strong><b>começar descoberta →</b></Link></div>
    </section>

    <section id="cafes" className={styles.productsSection}>
      <div className={styles.sectionHeader}><div><small>CAFÉS BISPO</small><h2>Você sente primeiro.<br/>Depois escolhe o nome.</h2></div><p>Perfis claros, produtos reais e uma promessa simples: você saber o que esperar da próxima xícara.</p></div>
      <div className={styles.productGrid}>{products.map(p=><article key={p.name} className={styles.productCard} style={{"--tone":p.tone} as React.CSSProperties}>
        <div className={styles.productVisual} data-photo-slot={`product-${p.name.toLowerCase().replaceAll(" ","-")}`}>{p.image&&<img src={p.image} alt={`Embalagem Bispo ${p.name}`} className={styles.productPhoto}/>}<small>{p.tag}</small></div>
        <div className={styles.productMeta}><p>{p.line}</p><h3>{p.name}</h3><span>{p.notes}</span><div className={styles.buyRow}><strong>{p.price} <small>· {p.weight}</small></strong><button aria-label={`Escolher ${p.name}`}>Quero esse →</button></div></div>
      </article>)}</div>
      <div className={styles.allProducts}><a href="#cafes">Ver todos os cafés →</a><Link href="/loja/descobrir">Ainda em dúvida? Descubra o seu →</Link></div>
    </section>

    <section className={styles.desireBand}>
      <div><small>POR QUE BISPO</small><h2>Você só precisa gostar da xícara.<br/>O conhecimento fica com a gente.</h2></div>
      <div className={styles.valueCards}><span><b>Escolhido antes de chegar até você</b><small>Selecionamos cafés pelo que realmente entregam na xícara — não apenas pelo que está escrito na ficha.</small></span><span><b>Torrado e provado para entregar o perfil</b><small>A torra existe para revelar doçura, equilíbrio e identidade, não para esconder o café.</small></span><span><b>Gostou? Você consegue reencontrar</b><small>Transformamos conhecimento técnico em perfis simples para você reconhecer o que ama.</small></span></div>
    </section>

    <section className={styles.discovery}>
      <div className={styles.discoveryCopy}><small>AINDA NÃO SABE QUAL?</small><h2>Você sente.<br/>A Bispo traduz.</h2><p>Conte o que você gosta de sentir na xícara. Nós transformamos isso em uma recomendação simples e visual.</p><Link href="/loja/descobrir">Descobrir o meu café →</Link></div>
      <div className={styles.discoveryVisual}><div className={styles.ring}><i/><i/><i/><i/><b>SUA<br/>XÍCARA</b></div><span>doce</span><span>frutado</span><span>fresco</span></div>
    </section>

    <section className={styles.rareSection}><div><small>RAROS · QUANDO O CAFÉ MUDA A REGRA</small><h2>Alguns cafés existem para ser lembrados.</h2><p>Microlotes para quando você quer sair do conhecido e provar uma xícara que talvez nunca se repita.</p></div><a href="#cafes">Quero ser surpreendido →</a></section>

    <section className={styles.institutional} data-photo-slot="brand-story">
      <div><small>POR TRÁS DA XÍCARA</small><h2>Antes de chegar até você,<br/>alguém precisa saber escolher.</h2></div>
      <div><p><b>José Rezende, o Bispo,</b> construiu sua trajetória entre lavoura, prova, qualidade e mercado de cafés brasileiros.</p><p><b>Suzi Ninov</b> soma uma história próxima de produtores, nutrição, produtividade e transformação no campo.</p><Link href="/loja/sobre">Conheça quem está por trás da Bispo →</Link></div>
    </section>

    <section className={styles.valueStrip}><span>Perfis claros.</span><span>Torra própria.</span><span>Constância de xícara.</span><span>Frete grátis Sul + Sudeste · R$ 270+</span></section>
    <footer className={styles.footer}><div className={styles.footerBrand}><Image src="/brand/logo/bispo-logo-official-transparent.png" width={150} height={50} alt="Bispo Coffees"/><p>Café para escolher, desejar, reencontrar e lembrar.</p></div><div className={styles.footerNav}><strong>Explorar</strong><Link href="/loja/descobrir">Descubra o seu café</Link><Link href="/loja/sobre">Sobre a Bispo</Link></div><div className={styles.footerNav}><strong>Comprar</strong><a href="#cafes">Todos os cafés</a><a href="#escolher">Escolher por sensação</a></div><div className={styles.footerBottom}><span>Bispo Coffees · Brasil</span><Link href="/bbos">Área interna</Link></div></footer>
  </main>
}
