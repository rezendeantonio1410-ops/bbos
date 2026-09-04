import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";
import { productImages } from "./product-images";

const lines=[
  {name:"TODO DIA",need:"Quero acertar sem pensar",copy:"Equilíbrio, conforto e uma xícara que você reconhece.",tone:"#E5C94A",anchor:"Essencial"},
  {name:"CONFORTO",need:"Quero algo acolhedor",copy:"Doçura, caramelo, chocolate e prazer fácil de reencontrar.",tone:"#D9863A",anchor:"Caramelo"},
  {name:"DESCOBERTA",need:"Quero sentir algo novo",copy:"Fruta, frescor e complexidade sem perder a identidade.",tone:"#3D7D58",anchor:"Tangerina"},
  {name:"RAROS",need:"Quero ser surpreendido",copy:"Aqui a regra muda: cada microlote pode ser único.",tone:"#B33E35",anchor:"Raros"}
];

const products=[
  {name:"Essencial",line:"GOURMET",notes:"Macio · Doce · Fácil",price:"R$ 48",weight:"500 g",cup:"≈ R$ 1,92 por xícara*",tone:"#F4D54A",image:productImages["Essencial"],promise:"constante"},
  {name:"Intenso",line:"GOURMET",notes:"Presença · Corpo · Conforto",price:"R$ 48",weight:"500 g",cup:"≈ R$ 1,92 por xícara*",tone:"#E2B52E",image:productImages["Intenso"],promise:"constante"},
  {name:"Caramelo",line:"CLÁSSICOS",notes:"Caramelo · Chocolate · Equilíbrio",price:"R$ 68",weight:"500 g",cup:"≈ R$ 2,72 por xícara*",tone:"#E78A38",image:productImages["Caramelo"],promise:"constante"},
  {name:"Doce de Leite",line:"CLÁSSICOS",notes:"Mascavo · Doce de leite · Alfajor",price:"R$ 74",weight:"500 g",cup:"≈ R$ 2,96 por xícara*",tone:"#D9A333",image:productImages["Doce de Leite"],promise:"constante"},
  {name:"Tangerina",line:"CLÁSSICOS",notes:"Cítrico · Doce · Fresco",price:"R$ 74",weight:"500 g",cup:"≈ R$ 2,96 por xícara*",tone:"#E88A2E",image:productImages["Tangerina"],promise:"constante"},
  {name:"Singular",line:"ÉPICOS",notes:"Frutado · Complexo · Evolutivo",price:"R$ 85",weight:"500 g",cup:"≈ R$ 3,40 por xícara*",tone:"#387D50",image:productImages["Singular"],promise:"constante"},
  {name:"Sublime",line:"ÉPICOS",notes:"Expressivo · Elegante · Descoberta",price:"R$ 85",weight:"500 g",cup:"≈ R$ 3,40 por xícara*",tone:"#4B8960",image:productImages["Sublime"],promise:"constante"},
  {name:"Raros",line:"RAROS",notes:"Floral · Delicado · Memorável",price:"R$ 53",weight:"250 g",cup:"≈ R$ 4,24 por xícara*",tone:"#B83A31",image:null,promise:"surpresa"}
];

export default function LojaPage(){return <main className={styles.page}>
  <div className={styles.commerceBar}><span>Frete grátis Sul + Sudeste em compras a partir de R$ 270</span><a href="#cafes">Escolher cafés →</a></div>

  <header className={styles.header}>
    <a href="#top" className={styles.brand}><Image src="/brand/logo/bispo-logo-official-transparent.png" width={176} height={58} alt="Bispo Coffees" priority/></a>
    <nav className={styles.nav}>
      <a href="#cafes">Cafés</a><a href="#momentos">Momentos</a><Link href="/loja/descobrir">Descobrir o meu</Link><Link href="/loja/aprender">Aprender</Link><Link href="/loja/sobre">Nossa história</Link>
    </nav>
    <div className={styles.actions}><button aria-label="Buscar">⌕</button><button aria-label="Minha conta">○</button><button aria-label="Sacola">□</button></div>
  </header>

  <section id="top" className={styles.hero}>
    <div className={styles.heroCopy}>
      <p className={styles.eyebrow}>SER DIFERENTE EM UM MUNDO DE IGUAIS <span>escolha · constância · surpresa</span></p>
      <h1>Descubra o café que é seu.<br/><em>E reencontre esse sabor amanhã.</em></h1>
      <p className={styles.subcopy}>Você escolhe a sensação. A Bispo cuida para o perfil continuar reconhecível, safra após safra. Nos Raros, a regra muda: quando aparece algo extraordinário, a gente deixa a surpresa brilhar.</p>
      <div className={styles.heroButtons}><Link className={styles.primaryCta} href="/loja/descobrir">Descobrir meu café <span>→</span></Link><a className={styles.secondaryCta} href="#cafes">Comprar agora <span>→</span></a></div>
      <div className={styles.heroProofGrid}><span><b>Perfil prometido</b><small>o café que você escolheu continua sendo ele</small></span><span><b>Mais de 25 anos</b><small>da planta ao mercado, cuidando da qualidade</small></span><span><b>Raros</b><small>a exceção feita para surpreender</small></span></div>
    </div>

    <div className={styles.heroStage} aria-label="Cafés Bispo e xícara">
      <div className={styles.heroGlow}/><div className={styles.heroSteam}/><div className={styles.heroCup}><span>BISPO</span></div>
      {products.slice(2,5).map((p,i)=>p.image&&<img key={p.name} className={`${styles.heroProduct} ${styles[`heroProduct${i+1}`]}`} src={p.image} alt={`Embalagem Bispo ${p.name}`}/>)}
      <div className={styles.heroSensory}><small>HOJE EU QUERO...</small><b>doçura · conforto · frescor</b><Link href="/loja/descobrir">montar minha xícara →</Link></div>
    </div>
  </section>

  <section className={styles.promiseBand}>
    <strong>Safras mudam. A nossa promessa de xícara, não.</strong>
    <span>Constância não acontece por acaso. É escolha, prova e ajuste antes de o café chegar até você.</span>
  </section>

  <section id="momentos" className={styles.linesSection}>
    <div className={styles.sectionIntro}><p>ESCOLHA PELO MOMENTO</p><h2>O que você quer sentir hoje?</h2><span>Primeiro a vontade. Depois, se quiser, a gente fala de origem, processo e técnica.</span></div>
    <div className={styles.lineGrid}>{lines.map(line=><a key={line.name} href="#cafes" className={styles.lineCard} style={{"--tone":line.tone} as React.CSSProperties}><div className={styles.feelingCard}><i/><small>{line.need}</small><strong>{line.name}</strong><span>{line.copy}</span><b>ver cafés →</b></div></a>)}</div>
  </section>

  <section id="cafes" className={styles.productsSection}>
    <div className={styles.sectionIntro}><p>CAFÉS BISPO</p><h2>Escolha uma personalidade.</h2><span>As fotos atuais são provisórias, mas os produtos e os perfis são reais.</span></div>
    <div className={styles.productGrid}>{products.map(p=><article key={p.name} className={styles.productCard}><div className={styles.productVisual} style={{"--tone":p.tone} as React.CSSProperties}>{p.image?<img src={p.image} alt={`Embalagem Bispo ${p.name}`} className={styles.productPhoto}/>:<div className={styles.productBag}><span>BISPO</span><i/></div>}<small className={`${styles.promiseTag} ${p.promise==="surpresa"?styles.surpriseTag:""}`}>{p.promise==="surpresa"?"cada lote é uma surpresa":"perfil Bispo · constante"}</small></div><div className={styles.productMeta}><p>{p.line}</p><h3>{p.name}</h3><span>{p.notes}</span><div className={styles.buyRow}><div><strong>{p.price} <small>· {p.weight}</small></strong><em className={styles.cupPrice}>{p.cup}</em></div><button aria-label={`Adicionar ${p.name}`}>+ Adicionar</button></div></div></article>)}</div>
    <p className={styles.priceNote}>*Referência de 20 g de café por preparo. Frete grátis para Sul e Sudeste a partir de R$ 270.</p>
  </section>

  <section className={styles.discovery}>
    <div className={styles.discoveryCopy}><p>NÃO PRECISA ENTENDER DE CAFÉ</p><h2>Você sente. A gente traduz.</h2><span>Aroma, sabor e frescor viram uma recomendação simples. Sem prova, sem nota técnica, sem complicação.</span><Link href="/loja/descobrir">Descobrir meu café →</Link></div>
    <div className={styles.discoveryCup}><div className={styles.discoverySteam}/><div className={styles.discoveryCupBody}><b>SUA XÍCARA</b><small>toque · escolha · descubra</small></div><span>doce</span><span>frutado</span><span>fresco</span></div>
  </section>

  <section className={styles.foundersSection}>
    <div className={styles.foundersLead}><p>POR TRÁS DA XÍCARA</p><h2>Duas trajetórias. Uma mesma exigência.</h2><span>Da planta à pessoa. Da origem à xícara.</span></div>
    <div className={styles.founderCards}>
      <article><small>SUZI NINOV</small><h3>Qualidade começa antes da colheita.</h3><p>Uma trajetória próxima de produtores, ajudando a produzir mais e melhor, com nutrição de plantas, desenvolvimento e transformação de pessoas.</p></article>
      <article><small>JOSÉ REZENDE · BISPO</small><h3>Qualidade precisa chegar inteira à xícara.</h3><p>Produção, certificação, controle de qualidade, prova e mercado internacional. Décadas cuidando para que o perfil prometido continue reconhecível.</p></article>
    </div>
    <Link href="/loja/sobre" className={styles.foundersLink}>Conheça os fundadores e a jornada da Bispo →</Link>
  </section>

  <section className={styles.rareSection}>
    <div><p>RAROS</p><h2>Aqui, a constância dá lugar à descoberta.</h2><span>Quando encontramos um café que merece existir sem ser enquadrado em um perfil, não tentamos fazer ele parecer com nada. Deixamos ele brilhar.</span></div><a href="#cafes">Ver Raros →</a>
  </section>

  <section className={styles.valueStrip}><span>Perfil definido.</span><span>Prova e controle.</span><span>Torra com propósito.</span><span>Frete grátis Sul + Sudeste · R$ 270+</span></section>

  <footer className={styles.footer}>
    <div className={styles.footerBrand}><Image src="/brand/logo/bispo-logo-official-transparent.png" width={150} height={50} alt="Bispo Coffees"/><p>Café para escolher, reencontrar e lembrar.</p></div>
    <div className={styles.footerNav}><strong>Explorar</strong><Link href="/loja/descobrir">Descubra o seu café</Link><Link href="/loja/aprender">Aprender sobre café</Link><Link href="/loja/sobre">Nossa história</Link></div>
    <div className={styles.footerNav}><strong>Comprar</strong><a href="#cafes">Todos os cafés</a><a href="#momentos">Escolher por momento</a><a href="#top">Voltar ao início</a></div>
    <div className={styles.footerBottom}><span>Bispo Coffees · Brasil</span><Link href="/bbos">Área interna</Link></div>
  </footer>
</main>}
