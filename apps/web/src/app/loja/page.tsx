import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";
import playful from "./playful.module.css";
import DocumentaryHero from "./DocumentaryHero";
import { productImages } from "./product-images";

const lines=[
  {name:"GOURMET",need:"Todo dia",copy:"O essencial bem escolhido.",tone:"#F4D54A"},
  {name:"CLÁSSICOS",need:"Quero conforto",copy:"Conforto com personalidade.",tone:"#E78A38"},
  {name:"ÉPICOS",need:"Quero descobrir",copy:"Cafés para perceber algo novo.",tone:"#387D50"},
  {name:"RAROS",need:"Quero algo raro",copy:"Microlotes. Poucos. Únicos.",tone:"#B83A31"}
];

const products=[
  {name:"Essencial",line:"GOURMET",notes:"Macio · Doce · Fácil",price:"R$ 48",weight:"500 g",cup:"≈ R$ 1,92 por xícara*",tone:"#F4D54A",image:productImages["Essencial"]},
  {name:"Intenso",line:"GOURMET",notes:"Presença · Corpo · Conforto",price:"R$ 48",weight:"500 g",cup:"≈ R$ 1,92 por xícara*",tone:"#E2B52E",image:productImages["Intenso"]},
  {name:"Caramelo",line:"CLÁSSICOS",notes:"Caramelo · Chocolate · Equilíbrio",price:"R$ 68",weight:"500 g",cup:"≈ R$ 2,72 por xícara*",tone:"#E78A38",image:productImages["Caramelo"]},
  {name:"Doce de Leite",line:"CLÁSSICOS",notes:"Mascavo · Doce de leite · Alfajor",price:"R$ 74",weight:"500 g",cup:"≈ R$ 2,96 por xícara*",tone:"#D9A333",image:productImages["Doce de Leite"]},
  {name:"Tangerina",line:"CLÁSSICOS",notes:"Cítrico · Doce · Fresco",price:"R$ 74",weight:"500 g",cup:"≈ R$ 2,96 por xícara*",tone:"#E88A2E",image:productImages["Tangerina"]},
  {name:"Singular",line:"ÉPICOS",notes:"Frutado · Complexo · Evolutivo",price:"R$ 85",weight:"500 g",cup:"≈ R$ 3,40 por xícara*",tone:"#387D50",image:productImages["Singular"]},
  {name:"Sublime",line:"ÉPICOS",notes:"Expressivo · Elegante · Descoberta",price:"R$ 85",weight:"500 g",cup:"≈ R$ 3,40 por xícara*",tone:"#4B8960",image:productImages["Sublime"]},
  {name:"Raros",line:"RAROS",notes:"Floral · Delicado · Memorável",price:"R$ 53",weight:"250 g",cup:"≈ R$ 4,24 por xícara*",tone:"#B83A31",image:null}
];

export default function LojaPage(){return <main className={styles.page}>
  <div className={styles.commerceBar}><span>Frete grátis Sul + Sudeste em compras a partir de R$ 270</span><a href="#cafes">Escolher cafés →</a></div>

  <header className={styles.header}>
    <a href="#top" className={styles.brand}><Image src="/brand/logo/bispo-logo-official-transparent.png" width={176} height={58} alt="Bispo Coffees" priority/></a>
    <nav className={styles.nav}>
      <a href="#cafes">Cafés</a><a href="#linhas">Linhas</a><Link href="/loja/descobrir">Descobrir o meu</Link><Link href="/loja/aprender">Aprender</Link><Link href="/loja/sobre">Sobre a Bispo</Link>
    </nav>
    <div className={styles.actions}><button aria-label="Buscar">⌕</button><button aria-label="Minha conta">○</button><button aria-label="Sacola">□</button></div>
  </header>

  <section id="top" className={styles.hero}>
    <div className={styles.heroCopy}>
      <p className={styles.eyebrow}>CAFÉS BRASILEIROS <span>origem · prova · consistência</span></p>
      <h1>Antes da xícara,<br/>há uma escolha.</h1>
      <p className={styles.subcopy}>Escolhidos na origem, provados e torrados para entregar consistência, personalidade e prazer na sua xícara.</p>
      <div className={styles.heroButtons}><a className={styles.primaryCta} href="#cafes">Comprar cafés <span>→</span></a><Link className={styles.secondaryCta} href="/loja/descobrir">Descobrir o meu <span>→</span></Link></div>
      <p className={styles.heroProof}>Você não precisa entender de café para escolher bem.</p>
      <div className={styles.colorSignal} aria-hidden="true">{lines.map(line=><i key={line.name} style={{background:line.tone}}/>)}</div>
    </div>
    <DocumentaryHero/>
  </section>

  <section className={playful.bridge}>
    <div className={playful.bridgeLead}><small>DO CAMPO À XÍCARA.</small><strong>Do Brasil para o mundo.<br/>Agora, para a sua xícara.</strong></div>
    <div className={playful.bridgeTrail}><span><i>01</i><b>origem</b><small>perto de quem produz</small></span><span><i>02</i><b>prova</b><small>antes de cada escolha</small></span><span><i>03</i><b>consistência</b><small>xícara após xícara</small></span></div>
  </section>

  <section id="linhas" className={styles.linesSection}>
    <div className={styles.sectionIntro}><p>ESCOLHA PELO QUE VOCÊ PROCURA</p><h2>Qual Bispo combina com hoje?</h2><span>Primeiro a sensação. Depois, se quiser, você aprofunda.</span></div>
    <div className={styles.lineGrid}>{lines.map(line=><a key={line.name} href="#cafes" className={styles.lineCard} style={{"--tone":line.tone} as React.CSSProperties}><div className={styles.bag}><span>BISPO</span><i/></div><div><small className={styles.needLabel}>{line.need}</small><strong>{line.name}</strong><span>{line.copy}</span></div></a>)}</div>
  </section>

  <section id="cafes" className={styles.productsSection}>
    <div className={styles.sectionIntro}><p>NOSSOS CAFÉS</p><h2>Comece por um perfil.</h2><span>As fotos atuais são provisórias e já mostram os produtos reais da Bispo.</span></div>
    <div className={styles.productGrid}>{products.map(p=><article key={p.name} className={styles.productCard}><div className={styles.productVisual} style={{"--tone":p.tone} as React.CSSProperties}>{p.image?<img src={p.image} alt={`Embalagem Bispo ${p.name}`} style={{width:"68%",height:"92%",objectFit:"contain",filter:"drop-shadow(0 16px 18px rgba(14,25,29,.10))"}}/>:<div className={styles.productBag}><span>BISPO</span><i/></div>}</div><div className={styles.productMeta}><p>{p.line}</p><h3>{p.name}</h3><span>{p.notes}</span><div className={styles.buyRow}><div><strong>{p.price} <small>· {p.weight}</small></strong><em className={styles.cupPrice}>{p.cup}</em></div><button aria-label={`Adicionar ${p.name}`}>+ Adicionar</button></div></div></article>)}</div>
    <p className={styles.priceNote}>*Referência de 20 g de café por preparo. Frete grátis para Sul e Sudeste a partir de R$ 270.</p>
  </section>

  <section className={styles.authoritySection}>
    <div className={styles.authorityLead}><p>CONHECIMENTO ANTES DO RÓTULO</p><h2>Café é escolha antes de ser produto.</h2></div>
    <div className={styles.authorityCopy}><p>A Bispo Coffees nasce da experiência de José Rezende, o Bispo, filho de produtores de café e dedicado à qualidade desde 2003. A mesma lógica usada para provar, selecionar e apresentar cafés ao mercado agora ajuda você a escolher melhor para a sua própria xícara.</p><div className={styles.authorityFacts}><span><b>2003</b><small>trabalho com qualidade na origem</small></span><span><b>2010</b><small>Q-Grader e café brasileiro no mundo</small></span><span><b>Hoje</b><small>origem + prova + torra + escolha</small></span></div><Link href="/loja/sobre">Conheça a história da Bispo →</Link></div>
  </section>

  <section id="descobrir" className={styles.discovery}>
    <div className={styles.discoveryCopy}><p>NÃO SABE QUAL ESCOLHER?</p><h2>Descubra o seu paladar.</h2><span>Escolha por aromas, sabores e sensações. A experiência sensorial da Bispo traduzida para uma jornada simples, intuitiva e divertida.</span><Link href="/loja/descobrir">Descobrir meu café →</Link></div>
    <div className={styles.discoveryPreview}><div className={styles.miniWheel}><i/><i/><i/><i/><b>BISPO</b></div><div className={styles.miniMandala}><i/><i/><i/><span>frescor</span></div></div>
  </section>

  <section className={styles.valueStrip}><span>Escolhido na origem.</span><span>Provado antes da escolha.</span><span>Torra fresca.</span><span>Frete grátis Sul + Sudeste · R$ 270+</span></section>

  <footer className={styles.footer}>
    <div className={styles.footerBrand}><Image src="/brand/logo/bispo-logo-official-transparent.png" width={150} height={50} alt="Bispo Coffees"/><p>Cafés brasileiros escolhidos com experiência de origem, prova e mercado. Café para beber, perceber e lembrar.</p></div>
    <div className={styles.footerNav}><strong>Explorar</strong><Link href="/loja/descobrir">Descubra o seu café</Link><Link href="/loja/aprender">Aprender sobre café</Link><Link href="/loja/sobre">Sobre a Bispo Coffees</Link></div>
    <div className={styles.footerNav}><strong>Comprar</strong><a href="#cafes">Todos os cafés</a><a href="#linhas">Linhas Bispo</a><a href="#top">Voltar ao início</a></div>
    <div className={styles.footerBottom}><span>Bispo Coffees · Brasil</span><Link href="/bbos">Área interna</Link></div>
  </footer>
</main>}
