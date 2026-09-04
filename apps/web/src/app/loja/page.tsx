import Image from "next/image";
import Link from "next/link";
import styles from "./sales.module.css";
import tight from "./sales-tight.module.css";
import { productImages } from "./product-images";

const products=[
  {name:"Essencial",line:"GOURMET",notes:"Macio · Doce · Fácil",price:"R$ 48",weight:"500 g",tone:"#E6C838",image:productImages["Essencial"],tag:"para todo dia"},
  {name:"Caramelo",line:"CLÁSSICOS",notes:"Caramelo · Chocolate · Equilíbrio",price:"R$ 68",weight:"500 g",tone:"#D97830",image:productImages["Caramelo"],tag:"conforto"},
  {name:"Doce de Leite",line:"CLÁSSICOS",notes:"Mascavo · Doce de leite · Alfajor",price:"R$ 74",weight:"500 g",tone:"#C89725",image:productImages["Doce de Leite"],tag:"doçura"},
  {name:"Tangerina",line:"CLÁSSICOS",notes:"Cítrico · Doce · Fresco",price:"R$ 74",weight:"500 g",tone:"#E48725",image:productImages["Tangerina"],tag:"frescor"},
  {name:"Singular",line:"ÉPICOS",notes:"Frutado · Complexo · Evolutivo",price:"R$ 85",weight:"500 g",tone:"#3B7651",image:productImages["Singular"],tag:"descoberta"},
  {name:"Sublime",line:"ÉPICOS",notes:"Expressivo · Elegante · Profundo",price:"R$ 85",weight:"500 g",tone:"#4D8060",image:productImages["Sublime"],tag:"experiência"}
];

const moments=[
  {title:"Todo dia",copy:"Quero equilíbrio e facilidade.",tone:"#E6C838"},
  {title:"Conforto",copy:"Quero doçura, caramelo e chocolate.",tone:"#D97830"},
  {title:"Frescor",copy:"Quero fruta, leveza e vivacidade.",tone:"#3B7651"}
];

export default function LojaPage(){
  const heroProduct={name:"Caramelo",line:"CLÁSSICOS",notes:"Caramelo · Chocolate · Equilíbrio",price:"R$ 68",weight:"500 g",tone:"#D97830",image:productImages["Caramelo"],tag:"conforto"};
  return <main className={styles.page}>
    <div className={styles.commerceBar}><span>Frete grátis Sul + Sudeste em compras a partir de R$ 270</span><a href="#cafes">Comprar cafés →</a></div>

    <header className={styles.header}>
      <a href="#top" className={styles.brand}><Image src="/brand/logo/bispo-logo-official-transparent.png" width={176} height={58} alt="Bispo Coffees" priority/></a>
      <nav className={styles.nav}><a href="#cafes">Cafés</a><a href="#escolher">Escolher</a><Link href="/loja/descobrir">Descobrir o meu</Link><Link href="/loja/sobre">Sobre a Bispo</Link></nav>
      <div className={styles.actions}><button aria-label="Buscar">⌕</button><button aria-label="Minha conta">○</button><button aria-label="Sacola">□</button></div>
    </header>

    <section id="top" className={`${styles.hero} ${tight.hero}`}>
      <div className={`${styles.heroMedia} ${tight.heroMedia}`}>
        <video className={`${styles.heroVideo} ${tight.heroVideo}`} autoPlay muted loop playsInline preload="metadata" poster="/WhatsApp Image 2026-09-02 at 17.53.29.jpeg">
          <source src="/WhatsApp Video 2026-09-02 at 17.34.18.mp4" type="video/mp4"/>
        </video>
        <div className={styles.heroShade}/>
        <div className={`${styles.heroProductCard} ${tight.heroProductCard}`}>
          {heroProduct.image&&<img src={heroProduct.image} alt="Embalagem Bispo Caramelo"/>}
          <div><small>{heroProduct.line}</small><b>{heroProduct.name}</b><span>{heroProduct.notes}</span><strong>{heroProduct.price} · {heroProduct.weight}</strong><a href="#cafes" className={tight.heroBuy}>Quero esse →</a></div>
        </div>
        <div className={`${styles.heroSceneLabel} ${tight.heroSceneLabel}`}><span>CAFÉ CAINDO. AROMA SUBINDO.</span><b>É daqui que começa a vontade.</b></div>
      </div>

      <div className={`${styles.heroCopy} ${tight.heroCopy}`}>
        <div className={tight.sensoryTopline}><span>CLÁSSICOS</span><i/> <b>CARAMELO</b></div>
        <h1 className={tight.sensoryTitle}>Doce. Confortável.<br/><em>Equilibrado.</em></h1>
        <p className={`${styles.subcopy} ${tight.shortCopy}`}>Se você gosta de cafés doces, cremosos e fáceis de amar, comece por aqui.</p>

        <div className={tight.sensoryStage} aria-label="Experiência sensorial do café Caramelo">
          <div className={tight.sensoryHalo} aria-hidden="true"><i/><i/><i/></div>
          <div className={tight.sensoryCore}><small>NA XÍCARA</small><b>Caramelo</b><span>+ chocolate</span></div>
          <div className={`${tight.sensoryNote} ${tight.noteOne}`}><i/><span><b>Doçura</b><small>envolvente</small></span></div>
          <div className={`${tight.sensoryNote} ${tight.noteTwo}`}><i/><span><b>Corpo</b><small>presente</small></span></div>
          <div className={`${tight.sensoryNote} ${tight.noteThree}`}><i/><span><b>Acidez</b><small>equilibrada</small></span></div>
        </div>

        <div className={tight.sensoryPromise}><span>100% Arábica</span><span>Torra média</span><span>Selecionado na origem</span></div>
        <div className={tight.sensoryBuyRow}>
          <div><small>500 g · em grãos</small><strong>R$ 68,00</strong></div>
          <a className={tight.sensoryCta} href="#cafes">Quero este café <span>→</span></a>
        </div>
        <Link className={tight.sensoryAssist} href="/loja/descobrir">Não é o seu perfil? A Bispo te ajuda a descobrir →</Link>
      </div>
    </section>

    <section id="escolher" className={styles.choiceSection}>
      <div className={styles.choiceIntro}><small>COMECE PELA VONTADE</small><h2>O que você quer sentir hoje?</h2><p>Menos ficha técnica. Mais sensação.</p></div>
      <div className={styles.choiceGrid}>{moments.map(m=><a key={m.title} href="#cafes" className={styles.choiceCard} style={{"--tone":m.tone} as React.CSSProperties}><i/><span>{m.copy}</span><strong>{m.title}</strong><b>ver cafés →</b></a>)}<Link href="/loja/descobrir" className={`${styles.choiceCard} ${styles.discoveryChoice}`}><i/><span>Não sei ainda.</span><strong>Me ajuda a descobrir</strong><b>começar experiência →</b></Link></div>
    </section>

    <section id="cafes" className={styles.productsSection}>
      <div className={styles.sectionHeader}><div><small>CAFÉS BISPO</small><h2>Escolha com os olhos.<br/>Confirme com o paladar.</h2></div><p>Seis perfis principais para começar. Simples de comparar, fáceis de desejar.</p></div>
      <div className={styles.productGrid}>{products.map(p=><article key={p.name} className={styles.productCard} style={{"--tone":p.tone} as React.CSSProperties}>
        <div className={styles.productVisual}>{p.image&&<img src={p.image} alt={`Embalagem Bispo ${p.name}`} className={styles.productPhoto}/>}<small>{p.tag}</small></div>
        <div className={styles.productMeta}><p>{p.line}</p><h3>{p.name}</h3><span>{p.notes}</span><div className={styles.buyRow}><strong>{p.price} <small>· {p.weight}</small></strong><button aria-label={`Escolher ${p.name}`}>Quero esse →</button></div></div>
      </article>)}</div>
      <div className={styles.allProducts}><a href="#cafes">Ver todos os cafés →</a><Link href="/loja/descobrir">Ainda em dúvida? Descubra o seu →</Link></div>
    </section>

    <section className={styles.desireBand}>
      <div><small>O VALOR ESTÁ NA EXPERIÊNCIA</small><h2>Você escolhe a sensação.<br/>A Bispo protege a identidade.</h2></div>
      <div className={styles.valueCards}><span><b>Escolha simples</b><small>Você não precisa ser especialista para beber muito bem.</small></span><span><b>Perfil constante</b><small>O café que você gostou precisa continuar reconhecível.</small></span><span><b>Raros surpreendem</b><small>Quando aparece algo extraordinário, deixamos o café brilhar.</small></span></div>
    </section>

    <section className={styles.discovery}>
      <div className={styles.discoveryCopy}><small>DESCUBRA O SEU CAFÉ</small><h2>Você sente.<br/>A Bispo traduz.</h2><p>Aroma, sabor e frescor viram uma recomendação simples, visual e feita para você.</p><Link href="/loja/descobrir">Começar agora →</Link></div>
      <div className={styles.discoveryVisual}><div className={styles.ring}><i/><i/><i/><i/><b>SUA<br/>XÍCARA</b></div><span>doce</span><span>frutado</span><span>fresco</span></div>
    </section>

    <section className={styles.rareSection}><div><small>RAROS · A EXCEÇÃO</small><h2>Alguns cafés não foram feitos para se repetir.</h2><p>Nos Raros, a constância dá lugar à descoberta. Microlotes que chegam para surpreender — e depois podem nunca mais voltar.</p></div><a href="#cafes">Quero ser surpreendido →</a></section>

    <section className={styles.institutional}>
      <div><small>POR TRÁS DA XÍCARA</small><h2>Experiência real.<br/>Sem transformar a Home em biografia.</h2></div>
      <div><p><b>José Rezende, o Bispo,</b> empresta à marca um nome construído no café e uma trajetória ligada à produção, certificação, qualidade, prova, constância e mercado internacional.</p><p><b>Suzi Ninov</b> traz uma história próxima de produtores, nutrição de plantas, produtividade e transformação de pessoas.</p><Link href="/loja/sobre">Conheça a história completa →</Link></div>
    </section>

    <section className={styles.valueStrip}><span>Perfis claros.</span><span>Torra própria.</span><span>Constância de xícara.</span><span>Frete grátis Sul + Sudeste · R$ 270+</span></section>

    <footer className={styles.footer}><div className={styles.footerBrand}><Image src="/brand/logo/bispo-logo-official-transparent.png" width={150} height={50} alt="Bispo Coffees"/><p>Café para escolher, desejar, reencontrar e lembrar.</p></div><div className={styles.footerNav}><strong>Explorar</strong><Link href="/loja/descobrir">Descubra o seu café</Link><Link href="/loja/sobre">Sobre a Bispo</Link></div><div className={styles.footerNav}><strong>Comprar</strong><a href="#cafes">Todos os cafés</a><a href="#escolher">Escolher por sensação</a></div><div className={styles.footerBottom}><span>Bispo Coffees · Brasil</span><Link href="/bbos">Área interna</Link></div></footer>
  </main>
}
