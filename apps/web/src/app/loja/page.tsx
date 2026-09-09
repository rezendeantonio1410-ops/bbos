import Image from "next/image";
import Link from "next/link";
import styles from "./sales.module.css";
import tight from "./sales-tight.module.css";
import { productImages } from "./product-images";
import ScrollToTopOnLoad from "./ScrollToTopOnLoad";

// Hero asset validated as a real JPEG blob in Git; keep this path stable.
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
  return <main className={styles.page}>
    <ScrollToTopOnLoad/>
    <div className={styles.commerceBar}><span>Frete grátis Sul + Sudeste em compras a partir de R$ 270</span><a href="#cafes">Comprar cafés →</a></div>
    <header className={styles.header}>
      <a href="#top" className={styles.brand}><Image src="/brand/logo/bispo-logo-official-transparent.png" width={176} height={58} alt="Bispo Coffees" priority/></a>
      <nav className={styles.nav}><a href="#cafes">Cafés</a><a href="#escolher">Escolher</a><Link href="/loja/descobrir">Descobrir o meu</Link><Link href="/loja/sobre">Sobre a Bispo</Link></nav>
      <div className={styles.actions}><button aria-label="Buscar">⌕</button><button aria-label="Minha conta">○</button><button aria-label="Sacola">□</button></div>
    </header>

    <section id="top" className={`${styles.hero} ${tight.hero}`}>
      <div className={`${styles.heroMedia} ${tight.heroMedia}`} data-photo-slot="hero-chemex-ceramic-nature">
        <img src="/brand/visuals/bispo-hero-approved-intact.jpg" alt="Chemex servindo café em xícara de cerâmica, com luz natural e natureza ao fundo" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",objectPosition:"center center",zIndex:0,display:"block"}}/>
        <div className={`${styles.heroSceneLabel} ${tight.heroSceneLabel}`}><b>É daqui que começa a vontade.</b></div>
      </div>
      <div className={`${styles.heroCopy} ${tight.heroCopy}`}>
        <div className={tight.sensoryTopline}><span>CLÁSSICOS</span><i/><b>CARAMELO</b></div>
        <h1 className={tight.sensoryTitle}>Doce. Confortável.<br/><em>Equilibrado.</em></h1>
        <p className={`${styles.subcopy} ${tight.shortCopy}`}>Caramelo e chocolate. Doce na medida. Daqueles cafés que pedem outra xícara.</p>
        <div className={tight.productDesireStage} data-photo-slot="hero-product-real-caramelo" aria-label="Espaço reservado para a fotografia real do café Caramelo"><div className={tight.productAura}/><div className={tight.productShot}><div className={tight.productPlaceholder}><small>PRODUTO REAL</small><b>CARAMELO</b><span>foto entra aqui</span></div></div><div className={`${tight.flavorWhisper} ${tight.flavorTop}`}><b>caramelo</b><span>doçura envolvente</span></div><div className={`${tight.flavorWhisper} ${tight.flavorMiddle}`}><b>chocolate</b><span>corpo presente</span></div><div className={`${tight.flavorWhisper} ${tight.flavorBottom}`}><b>equilíbrio</b><span>acidez delicada</span></div></div>
        <div className={tight.sensoryPromise}><span>100% Arábica</span><span>Torra própria</span><span>Selecionado na origem</span></div>
        <div className={tight.sensoryBuyRow}><div><small>500 g · em grãos</small><strong>R$ 68,00</strong></div><a className={tight.sensoryCta} href="#cafes">Quero este café <span>→</span></a></div>
        <Link className={tight.sensoryAssist} href="/loja/descobrir">Não é o seu perfil? Descubra o café que combina com você →</Link>
      </div>
    </section>
    <section className={tight.valueBridge} aria-label="Valor Bispo"><small>O SEGUNDO SEGUINTE É DO VALOR</small><h2>Você não precisa entender de café<br/>para beber um café extraordinário.</h2><p>Seleção, prova e torra acontecem antes. Na sua frente, fica apenas uma escolha simples: <b>o que você quer sentir na xícara?</b></p><div><span><b>Selecionado</b><small>pelo que entrega</small></span><i/><span><b>Provado</b><small>antes de chegar até você</small></span><i/><span><b>Torrado</b><small>para revelar identidade</small></span></div></section>
    <section id="escolher" className={styles.choiceSection}><div className={styles.choiceIntro}><small>COMECE PELO QUE VOCÊ QUER SENTIR</small><h2>Qual xícara combina com o seu momento?</h2><p>Você escolhe a sensação. A Bispo faz a parte difícil.</p></div><div className={styles.choiceGrid}>{moments.map(m=><a key={m.title} href="#cafes" className={styles.choiceCard} style={{"--tone":m.tone} as React.CSSProperties}><i/><span>{m.copy}</span><strong>{m.title}</strong><b>encontrar meu café →</b></a>)}<Link href="/loja/descobrir" className={`${styles.choiceCard} ${styles.discoveryChoice}`}><i/><span>Quero provar algo fora do óbvio.</span><strong>Me surpreenda</strong><b>começar descoberta →</b></Link></div></section>
    <section id="cafes" className={styles.productsSection}><div className={styles.sectionHeader}><div><small>CAFÉS BISPO</small><h2>Você sente primeiro.<br/>Depois escolhe o nome.</h2></div><p>Perfis claros e produtos reais para você reconhecer o que gosta — e saber o que esperar da próxima xícara.</p></div><div className={styles.productGrid}>{products.map(p=><article key={p.name} className={styles.productCard} style={{"--tone":p.tone} as React.CSSProperties}><div className={styles.productVisual} data-photo-slot={`product-${p.name.toLowerCase().replaceAll(" ","-")}`}>{p.image&&<img src={p.image} alt={`Embalagem Bispo ${p.name}`} className={styles.productPhoto}/>}<small>{p.tag}</small></div><div className={styles.productMeta}><p>{p.line}</p><h3>{p.name}</h3><span>{p.notes}</span><div className={styles.buyRow}><strong>{p.price} <small>· {p.weight}</small></strong><button aria-label={`Escolher ${p.name}`}>Quero esse →</button></div></div></article>)}</div><div className={styles.allProducts}><a href="#cafes">Ver todos os cafés →</a><Link href="/loja/descobrir">Ainda em dúvida? Descubra o seu →</Link></div></section>
    <section className={styles.desireBand}><div><small>POR QUE BISPO</small><h2>Você só precisa gostar da xícara.<br/>O conhecimento fica com a gente.</h2></div><div className={styles.valueCards}><span><b>Escolhido antes de chegar até você</b><small>Selecionamos pelo que o café realmente entrega na xícara.</small></span><span><b>Torrado e provado para entregar o perfil</b><small>Buscamos doçura, equilíbrio e identidade — sem esconder o café.</small></span><span><b>Gostou? Você consegue reencontrar</b><small>Perfis claros transformam técnica em uma escolha simples para você.</small></span></div></section>
    <section className={styles.discovery}><div className={styles.discoveryCopy}><small>AINDA NÃO SABE QUAL?</small><h2>Você sente.<br/>A Bispo traduz.</h2><p>Conte o que você gosta de sentir na xícara. Nós transformamos isso em uma recomendação simples e visual.</p><Link href="/loja/descobrir">Descobrir o meu café →</Link></div><div className={styles.discoveryVisual}><div className={styles.ring}><i/><i/><i/><i/><b>SUA<br/>XÍCARA</b></div><span>doce</span><span>frutado</span><span>fresco</span></div></section>
    <section className={styles.rareSection}><div><small>RAROS · QUANDO O CAFÉ MUDA A REGRA</small><h2>Alguns cafés existem para ser lembrados.</h2><p>Microlotes para quando você quer sair do conhecido e provar uma xícara que talvez nunca se repita.</p></div><a href="#cafes">Quero ser surpreendido →</a></section>
    <section className={tight.founders} data-photo-slot="founders-jose-suzi"><div className={tight.foundersPhoto}><div><small>FOTO REAL DOS FUNDADORES</small><b>José + Suzi</b><span>torrefação · prova · origem</span></div></div><div className={tight.foundersCopy}><small>POR TRÁS DE CADA XÍCARA</small><h2>Duas histórias.<br/><em>Uma mesma obsessão pelo café.</em></h2><p><b>José Rezende — o Bispo</b><br/>Uma trajetória construída entre lavoura, qualidade, prova e mercado de cafés brasileiros. O olhar que seleciona e protege aquilo que o café deve entregar na xícara.</p><p><b>Suzi Ninov</b><br/>Uma história próxima do produtor, da lavoura, nutrição e produtividade. O olhar que conecta qualidade à origem e às pessoas que tornam cada café possível.</p><Link href="/loja/sobre">Conheça José, Suzi e a história da Bispo →</Link></div></section>
    <section className={styles.valueStrip}><span>Perfis claros.</span><span>Torra própria.</span><span>Constância de xícara.</span><span>Frete grátis Sul + Sudeste · R$ 270+</span></section>
    <footer className={styles.footer}><div className={styles.footerBrand}><Image src="/brand/logo/bispo-logo-official-transparent.png" width={150} height={50} alt="Bispo Coffees"/><p>Café para escolher, desejar, reencontrar e lembrar.</p></div><div className={styles.footerNav}><strong>Explorar</strong><Link href="/loja/descobrir">Descubra o seu café</Link><Link href="/loja/sobre">Sobre a Bispo</Link></div><div className={styles.footerNav}><strong>Comprar</strong><a href="#cafes">Todos os cafés</a><a href="#escolher">Escolher por sensação</a></div><div className={styles.footerBottom}><span>Bispo Coffees · Brasil</span><Link href="/bbos">Área interna</Link></div></footer>
  </main>
}
