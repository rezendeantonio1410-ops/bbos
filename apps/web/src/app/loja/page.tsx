import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";
import { productImages } from "./product-images";

const moments=[
  {name:"TODO DIA",need:"Quero acertar sem pensar",copy:"Equilíbrio, conforto e uma xícara fácil de reconhecer.",tone:"#E5C94A"},
  {name:"CONFORTO",need:"Quero algo acolhedor",copy:"Doçura, caramelo, chocolate e prazer sem complicação.",tone:"#D9863A"},
  {name:"FRESCOR",need:"Quero algo vivo",copy:"Fruta, leveza e frescor para acordar o paladar.",tone:"#3D7D58"},
  {name:"DESCOBERTA",need:"Quero algo novo",copy:"Complexidade, surpresa e cafés que ficam na memória.",tone:"#B33E35"}
];

const products=[
  {name:"Essencial",line:"GOURMET",notes:"Macio · Doce · Fácil",price:"R$ 48",weight:"500 g",cup:"≈ R$ 1,92 por xícara*",tone:"#F4D54A",image:productImages["Essencial"],tag:"para todo dia"},
  {name:"Intenso",line:"GOURMET",notes:"Presença · Corpo · Conforto",price:"R$ 48",weight:"500 g",cup:"≈ R$ 1,92 por xícara*",tone:"#E2B52E",image:productImages["Intenso"],tag:"mais presença"},
  {name:"Caramelo",line:"CLÁSSICOS",notes:"Caramelo · Chocolate · Equilíbrio",price:"R$ 68",weight:"500 g",cup:"≈ R$ 2,72 por xícara*",tone:"#E78A38",image:productImages["Caramelo"],tag:"conforto"},
  {name:"Doce de Leite",line:"CLÁSSICOS",notes:"Mascavo · Doce de leite · Alfajor",price:"R$ 74",weight:"500 g",cup:"≈ R$ 2,96 por xícara*",tone:"#D9A333",image:productImages["Doce de Leite"],tag:"doçura"},
  {name:"Tangerina",line:"CLÁSSICOS",notes:"Cítrico · Doce · Fresco",price:"R$ 74",weight:"500 g",cup:"≈ R$ 2,96 por xícara*",tone:"#E88A2E",image:productImages["Tangerina"],tag:"frescor"},
  {name:"Singular",line:"ÉPICOS",notes:"Frutado · Complexo · Evolutivo",price:"R$ 85",weight:"500 g",cup:"≈ R$ 3,40 por xícara*",tone:"#387D50",image:productImages["Singular"],tag:"descoberta"},
  {name:"Sublime",line:"ÉPICOS",notes:"Expressivo · Elegante · Descoberta",price:"R$ 85",weight:"500 g",cup:"≈ R$ 3,40 por xícara*",tone:"#4B8960",image:productImages["Sublime"],tag:"experiência"},
  {name:"Raros",line:"RAROS",notes:"Floral · Delicado · Memorável",price:"R$ 53",weight:"250 g",cup:"≈ R$ 4,24 por xícara*",tone:"#B83A31",image:null,tag:"surpresa"}
];

export default function LojaPage(){return <main className={styles.page}>
  <div className={styles.commerceBar}><span>Frete grátis Sul + Sudeste em compras a partir de R$ 270</span><a href="#cafes">Escolher cafés →</a></div>

  <header className={styles.header}>
    <a href="#top" className={styles.brand}><Image src="/brand/logo/bispo-logo-official-transparent.png" width={176} height={58} alt="Bispo Coffees" priority/></a>
    <nav className={styles.nav}><a href="#cafes">Cafés</a><a href="#momentos">Escolher por sensação</a><Link href="/loja/descobrir">Descobrir o meu</Link><Link href="/loja/sobre">Sobre a Bispo</Link></nav>
    <div className={styles.actions}><button aria-label="Buscar">⌕</button><button aria-label="Minha conta">○</button><button aria-label="Sacola">□</button></div>
  </header>

  <section id="top" className={styles.hero}>
    <div className={styles.heroCopy}>
      <p className={styles.eyebrow}>CAFÉ PARA ESCOLHER, REENCONTRAR E LEMBRAR</p>
      <h1>O café certo.<br/><em>Hoje.</em><br/>E de novo amanhã.</h1>
      <p className={styles.subcopy}>Você não precisa entender de café para beber muito bem. Escolha pelo que quer sentir — a Bispo ajuda a encontrar a sua xícara.</p>
      <div className={styles.heroButtons}><a className={styles.primaryCta} href="#cafes">Comprar cafés <span>→</span></a><Link className={styles.secondaryCta} href="/loja/descobrir">Descobrir o meu <span>→</span></Link></div>
      <p className={styles.heroProof}>Perfis claros · torra própria · constância de xícara · cafés brasileiros</p>
    </div>

    <div className={styles.heroStage} aria-label="Cafés Bispo e xícara">
      <div className={styles.heroGlow}/><div className={styles.heroSteam}/><div className={styles.heroCup}><span>BISPO</span></div>
      {[products[2],products[4],products[5]].map((p,i)=>p.image&&<img key={p.name} className={`${styles.heroProduct} ${styles[`heroProduct${i+1}`]}`} src={p.image} alt={`Embalagem Bispo ${p.name}`}/>)}
      <div className={styles.heroSensory}><small>O QUE VOCÊ QUER SENTIR HOJE?</small><b>conforto · frescor · descoberta</b><Link href="/loja/descobrir">eu te ajudo a escolher →</Link></div>
    </div>
  </section>

  <section className={styles.shopNow}>
    <div><small>COMECE POR AQUI</small><h2>Escolha uma personalidade.</h2><p>Sem ficha técnica primeiro. Comece pela vontade.</p></div>
    <div className={styles.quickChoices}><a href="#cafes"><span>01</span><b>Quero um café fácil para todo dia</b></a><a href="#cafes"><span>02</span><b>Quero doçura e conforto</b></a><a href="#cafes"><span>03</span><b>Quero frescor e fruta</b></a><Link href="/loja/descobrir"><span>04</span><b>Não sei. Me ajuda a descobrir</b></Link></div>
  </section>

  <section id="cafes" className={styles.productsSection}>
    <div className={styles.sectionIntro}><p>CAFÉS BISPO</p><h2>Talvez o seu esteja aqui.</h2><span>Produtos reais, perfis fáceis de entender e uma escolha que começa pela sensação.</span></div>
    <div className={styles.productGrid}>{products.map(p=><article key={p.name} className={styles.productCard}><div className={styles.productVisual} style={{"--tone":p.tone} as React.CSSProperties}>{p.image?<img src={p.image} alt={`Embalagem Bispo ${p.name}`} className={styles.productPhoto}/>:<div className={styles.productBag}><span>BISPO</span><i/></div>}<small className={styles.productTag}>{p.tag}</small></div><div className={styles.productMeta}><p>{p.line}</p><h3>{p.name}</h3><span>{p.notes}</span><div className={styles.buyRow}><div><strong>{p.price} <small>· {p.weight}</small></strong><em>{p.cup}</em></div><button aria-label={`Escolher ${p.name}`}>Escolher →</button></div></div></article>)}</div>
    <p className={styles.priceNote}>*Referência de 20 g de café por preparo. Frete grátis para Sul e Sudeste a partir de R$ 270.</p>
  </section>

  <section id="momentos" className={styles.momentsSection}>
    <div className={styles.sectionIntro}><p>ESCOLHA PELO MOMENTO</p><h2>O que você quer sentir hoje?</h2><span>Seu paladar não precisa falar difícil. A gente traduz.</span></div>
    <div className={styles.momentGrid}>{moments.map(m=><a key={m.name} href="#cafes" className={styles.momentCard} style={{"--tone":m.tone} as React.CSSProperties}><i/><small>{m.need}</small><strong>{m.name}</strong><span>{m.copy}</span><b>ver cafés →</b></a>)}</div>
  </section>

  <section className={styles.discovery}>
    <div className={styles.discoveryCopy}><p>SE AINDA ESTIVER EM DÚVIDA</p><h2>Você sente.<br/>A Bispo traduz.</h2><span>Uma jornada visual e simples transforma aroma, sabor e frescor em uma recomendação de café feita para você.</span><Link href="/loja/descobrir">Descobrir meu café →</Link></div>
    <div className={styles.discoveryCup}><div className={styles.discoverySteam}/><div className={styles.discoveryCupBody}><b>SUA XÍCARA</b><small>toque · escolha · descubra</small></div><span>doce</span><span>frutado</span><span>fresco</span></div>
  </section>

  <section className={styles.promiseSection}>
    <div><small>O VALOR ESTÁ NO QUE SE REPETE</small><h2>Safras mudam.<br/>A promessa da xícara, não.</h2></div>
    <div className={styles.promiseGrid}><span><b>Perfil definido</b><small>Você sabe o que esperar.</small></span><span><b>Prova e controle</b><small>A escolha é feita antes da embalagem.</small></span><span><b>Constância</b><small>O café que você gostou precisa continuar reconhecível.</small></span></div>
  </section>

  <section className={styles.rareSection}>
    <div><p>RAROS · A EXCEÇÃO</p><h2>Alguns cafés não foram feitos para se repetir.</h2><span>Nos Raros, a regra muda. Quando aparece algo extraordinário, não tentamos enquadrar. Deixamos o café brilhar.</span></div><a href="#cafes">Quero ser surpreendido →</a>
  </section>

  <section className={styles.foundersSection}>
    <div className={styles.foundersLead}><p>POR QUE CONFIAR NA BISPO?</p><h2>Experiência que aparece na xícara.</h2><span>O nome vem de José Rezende, o Bispo. A construção é de José e Suzi — duas trajetórias ligadas à origem, qualidade e transformação.</span></div>
    <div className={styles.founderCards}><article><small>SUZI NINOV</small><h3>Qualidade começa na planta e nas pessoas.</h3><p>Produtores, nutrição de plantas, produtividade e transformação de pessoas.</p></article><article><small>JOSÉ REZENDE · BISPO</small><h3>Qualidade precisa chegar inteira à xícara.</h3><p>Produção, certificação, controle de qualidade, prova, constância e mercado internacional.</p></article></div>
    <Link href="/loja/sobre" className={styles.foundersLink}>Conheça a história completa →</Link>
  </section>

  <section className={styles.valueStrip}><span>Perfil claro.</span><span>Prova e controle.</span><span>Torra com propósito.</span><span>Frete grátis Sul + Sudeste · R$ 270+</span></section>

  <footer className={styles.footer}>
    <div className={styles.footerBrand}><Image src="/brand/logo/bispo-logo-official-transparent.png" width={150} height={50} alt="Bispo Coffees"/><p>Café para escolher, reencontrar e lembrar.</p></div>
    <div className={styles.footerNav}><strong>Explorar</strong><Link href="/loja/descobrir">Descubra o seu café</Link><Link href="/loja/sobre">Sobre a Bispo</Link></div>
    <div className={styles.footerNav}><strong>Comprar</strong><a href="#cafes">Todos os cafés</a><a href="#momentos">Escolher por sensação</a><a href="#top">Voltar ao início</a></div>
    <div className={styles.footerBottom}><span>Bispo Coffees · Brasil</span><Link href="/bbos">Área interna</Link></div>
  </footer>
</main>}
