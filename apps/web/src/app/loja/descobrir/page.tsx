"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import baseStyles from "./page.module.css";
import guideStyles from "./simple-guide.module.css";
import brand from "./brand.module.css";

const styles = { ...baseStyles, ...guideStyles };

type Mood = "comfort" | "intense" | "fresh" | "discover";
type Brew = "filter" | "espresso" | "press" | "any";
type Moment = "daily" | "pause" | "share";

const moods = [
  { id: "comfort" as const, name: "Doce e confortável", hint: "caramelo, chocolate, aconchego", image: "/sensory/aroma/doce/acucares-caramelizados/caramelo.webp", tone: "#c97b35" },
  { id: "intense" as const, name: "Intenso e encorpado", hint: "presença, textura, final longo", image: "/sensory/aroma/tostado/cacau-chocolate/chocolate-amargo.webp", tone: "#684335" },
  { id: "fresh" as const, name: "Frutado e fresco", hint: "leveza, brilho, fruta", image: "/sensory/aroma/frutado/citricos/tangerina.webp", tone: "#e6902e" },
  { id: "discover" as const, name: "Complexo e surpreendente", hint: "camadas que mudam na xícara", image: "/sensory/aroma/frutado/frutas-vermelhas/cereja.webp", tone: "#5c7d5f" },
];

const brews = [
  { id: "filter" as const, name: "Coado", hint: "clareza e delicadeza", icon: "◯" },
  { id: "espresso" as const, name: "Espresso ou moka", hint: "concentração e corpo", icon: "◒" },
  { id: "press" as const, name: "Prensa francesa", hint: "textura e presença", icon: "◉" },
  { id: "any" as const, name: "Quero versatilidade", hint: "um café que funciona de vários jeitos", icon: "✦" },
];

const moments = [
  { id: "daily" as const, name: "Todo dia", hint: "fácil de acertar e de repetir" },
  { id: "pause" as const, name: "Uma pausa especial", hint: "quero prestar atenção na xícara" },
  { id: "share" as const, name: "Receber ou presentear", hint: "quero uma escolha marcante" },
];

const products = {
  essencial: { name: "Essencial", line: "GOURMET", price: "R$ 52", profile: "Macio · Doce · Fácil", image: "/brand/products/essencial-treated.webp", copy: "Uma xícara tranquila e versátil para fazer parte da rotina.", id: "essencial" },
  intenso: { name: "Intenso", line: "GOURMET", price: "R$ 52", profile: "Corpo · Presença · Limpeza", image: "/brand/products/intenso-treated.webp", copy: "Mais intensidade, sem esconder a limpeza e o equilíbrio.", id: "intenso" },
  caramelo: { name: "Caramelo", line: "CLÁSSICOS", price: "R$ 68", profile: "Caramelo · Chocolate · Equilíbrio", image: "/brand/products/caramelo-treated.webp", copy: "Doçura reconhecível e conforto desde o primeiro gole.", id: "caramelo" },
  doce: { name: "Doce de Leite", line: "CLÁSSICOS", price: "R$ 68", profile: "Mascavo · Doce de leite · Alfajor", image: "/brand/products/doce-de-leite-treated.webp", copy: "Uma xícara gulosa, macia e cheia de referências afetivas.", id: "doce-de-leite" },
  singular: { name: "Singular", line: "ÉPICOS", price: "R$ 84", profile: "Frutado · Complexo · Evolutivo", image: "/brand/products/singular-treated.webp", copy: "Mais camadas para descobrir enquanto a xícara muda e esfria.", id: "singular" },
  sublime: { name: "Sublime", line: "ÉPICOS", price: "R$ 84", profile: "Rapadura · Caramelo · Doçura profunda", image: "/brand/products/sublime-treated.webp", copy: "Doçura profunda e corpo envolvente para um ritual sem pressa.", id: "sublime" },
};

export default function Page() {
  const [step, setStep] = useState(1);
  const [mood, setMood] = useState<Mood>();
  const [brew, setBrew] = useState<Brew>();
  const [moment, setMoment] = useState<Moment>();

  const recommendation = useMemo(() => {
    if (mood === "discover" || (mood === "fresh" && moment !== "daily")) return products.singular;
    if (mood === "intense") return brew === "filter" ? products.sublime : products.intenso;
    if (mood === "comfort") return moment === "share" ? products.doce : products.caramelo;
    if (mood === "fresh") return products.singular;
    return products.essencial;
  }, [brew, moment, mood]);

  const restart = () => { setStep(1); setMood(undefined); setBrew(undefined); setMoment(undefined); };

  if (step === 4) {
    return <Shell><section className={styles.simpleResult}>
      <div className={styles.resultCopy}>
        <small>LEITURA DO BISPO · SUA ESCOLHA</small>
        <h1>Eu começaria por este.</h1>
        <p>Você pediu uma experiência {moods.find((x) => x.id === mood)?.name.toLowerCase()}, preparada em {brews.find((x) => x.id === brew)?.name.toLowerCase()} e pensada para {moments.find((x) => x.id === moment)?.name.toLowerCase()}.</p>
        <div className={styles.bishopNote}><b>Bispo</b><span>Não existe resposta certa. Existe o café que faz mais sentido para a xícara que você quer agora.</span></div>
      </div>
      <article className={styles.simpleProduct}>
        <img src={recommendation.image} alt={`Embalagem do café ${recommendation.name}`} />
        <div><small>{recommendation.line}</small><h2>{recommendation.name}</h2><strong>{recommendation.profile}</strong><p>{recommendation.copy}</p><b>{recommendation.price} <small>· 500 g</small></b>
          <div className={styles.resultActions}><Link href={`/loja#${recommendation.id}`}>Ver e comprar →</Link><button type="button" onClick={restart}>Descobrir outro perfil</button></div>
        </div>
      </article>
    </section></Shell>;
  }

  return <Shell><section className={styles.simpleJourney}>
    <div className={styles.progress}><span>PASSO {step} DE 3</span><i><b style={{ width: `${step * 33.34}%` }} /></i></div>
    <div className={styles.simpleIntro}>
      <small>O BISPO AJUDA VOCÊ A ESCOLHER</small>
      <h1>{step === 1 ? "Que sensação você procura?" : step === 2 ? "Como você prepara seu café?" : "Para qual momento é essa xícara?"}</h1>
      <p>{step === 1 ? "Sem aroma versus sabor. Escolha apenas pelo que dá vontade agora." : step === 2 ? "Isso ajuda o Bispo a encontrar um perfil que funcione melhor na sua rotina." : "Última pergunta — depois eu mostro uma escolha e explico o porquê."}</p>
    </div>

    {step === 1 && <div className={styles.moodGrid}>{moods.map((item) => <button key={item.id} type="button" style={{ "--tone": item.tone } as React.CSSProperties} onClick={() => { setMood(item.id); setStep(2); }}><img src={item.image} alt="" /><span><b>{item.name}</b><small>{item.hint}</small></span></button>)}</div>}
    {step === 2 && <div className={styles.choiceGrid}>{brews.map((item) => <button key={item.id} type="button" onClick={() => { setBrew(item.id); setStep(3); }}><i>{item.icon}</i><span><b>{item.name}</b><small>{item.hint}</small></span></button>)}</div>}
    {step === 3 && <div className={styles.momentGrid}>{moments.map((item) => <button key={item.id} type="button" onClick={() => { setMoment(item.id); setStep(4); }}><b>{item.name}</b><small>{item.hint}</small><span>escolher →</span></button>)}</div>}

    <div className={styles.simpleFooter}>{step > 1 ? <button type="button" onClick={() => setStep(step - 1)}>← voltar uma pergunta</button> : <span />}<b>Leva menos de um minuto.</b></div>
  </section></Shell>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className={`${styles.page} ${brand.page}`}><header className={styles.header}><Link href="/loja" className={styles.brand}><img src="/brand/logo/bispo-logo-official-transparent.png" alt="Bispo Coffees" /></Link><div className={styles.headerCopy}><span>DESCUBRA O SEU CAFÉ</span></div><Link href="/loja" className={styles.close} aria-label="Fechar">×</Link></header>{children}</main>;
}
