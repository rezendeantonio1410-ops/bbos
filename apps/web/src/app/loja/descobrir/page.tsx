"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import styles from "./page.module.css";

const R = "https://raw.githubusercontent.com/rezendeantonio1410-ops/bbos/staging/cupping-mobile-v2/apps/web/public";
const img = (p: string) => R + p;

type Descriptor = { id: string; name: string; image: string };
type Sub = { id: string; name: string; color: string; image: string; d: Descriptor[] };
type Family = { id: string; name: string; color: string; image: string; subs: Sub[] };

const data: Family[] = [
  {
    id: "fruit", name: "Frutado", color: "#d94b52", image: img("/sensory/aroma/frutado/frutas-vermelhas/morango.webp"),
    subs: [
      { id: "red", name: "Frutas vermelhas", color: "#c73f51", image: img("/sensory/aroma/frutado/frutas-vermelhas/cereja.webp"), d: [
        { id: "strawberry", name: "Morango", image: img("/sensory/aroma/frutado/frutas-vermelhas/morango.webp") },
        { id: "cherry", name: "Cereja", image: img("/sensory/aroma/frutado/frutas-vermelhas/cereja.webp") },
        { id: "raspberry", name: "Framboesa", image: img("/sensory/aroma/frutado/frutas-vermelhas/framboesa.webp") },
      ]},
      { id: "citrus", name: "Cítricos", color: "#e6902e", image: img("/sensory/aroma/frutado/citricos/tangerina.webp"), d: [
        { id: "tangerine", name: "Tangerina", image: img("/sensory/aroma/frutado/citricos/tangerina.webp") },
        { id: "lemon", name: "Limão", image: img("/sensory/aroma/frutado/citricos/limao.webp") },
        { id: "bergamot", name: "Bergamota", image: img("/sensory/aroma/frutado/citricos/bergamota.webp") },
      ]},
    ],
  },
  {
    id: "sweet", name: "Doce", color: "#c97b35", image: img("/sensory/aroma/doce/acucares-caramelizados/caramelo.webp"),
    subs: [
      { id: "caramelized", name: "Caramelizados", color: "#c97b35", image: img("/sensory/aroma/doce/acucares-caramelizados/caramelo.webp"), d: [
        { id: "caramel", name: "Caramelo", image: img("/sensory/aroma/doce/acucares-caramelizados/caramelo.webp") },
        { id: "honey", name: "Mel", image: img("/sensory/aroma/doce/acucares-caramelizados/mel.webp") },
        { id: "brown-sugar", name: "Açúcar mascavo", image: img("/sensory/aroma/doce/acucares-caramelizados/acucar-mascavo.png") },
      ]},
      { id: "confectionery", name: "Confeitaria", color: "#d6a05b", image: img("/sensory/aroma/doce/confeitaria/doce-de-leite.png"), d: [
        { id: "dulce", name: "Doce de leite", image: img("/sensory/aroma/doce/confeitaria/doce-de-leite.png") },
        { id: "vanilla", name: "Baunilha", image: img("/sensory/aroma/doce/confeitaria/baunilha.png") },
        { id: "toffee", name: "Toffee", image: img("/sensory/aroma/doce/confeitaria/toffee.png") },
      ]},
    ],
  },
  {
    id: "cocoa", name: "Chocolate / Cacau", color: "#79503d", image: img("/sensory/aroma/tostado/cacau-chocolate/chocolate-amargo.webp"),
    subs: [
      { id: "chocolate", name: "Chocolate", color: "#684335", image: img("/sensory/aroma/tostado/cacau-chocolate/chocolate-amargo.webp"), d: [
        { id: "cocoa-note", name: "Cacau", image: img("/sensory/aroma/tostado/cacau-chocolate/cacau.png") },
        { id: "dark", name: "Chocolate amargo", image: img("/sensory/aroma/tostado/cacau-chocolate/chocolate-amargo.webp") },
        { id: "milk", name: "Chocolate ao leite", image: img("/sensory/aroma/tostado/cacau-chocolate/chocolate-ao-leite.png") },
      ]},
      { id: "nuts", name: "Castanhas", color: "#9a7050", image: img("/sensory/aroma/tostado/nozes/avela-torrada.webp"), d: [
        { id: "hazelnut", name: "Avelã", image: img("/sensory/aroma/tostado/nozes/avela-torrada.webp") },
        { id: "almond", name: "Amêndoa", image: img("/sensory/aroma/tostado/nozes/amendoa-torrada.png") },
        { id: "walnut", name: "Noz", image: img("/sensory/aroma/tostado/nozes/noz.png") },
      ]},
    ],
  },
  {
    id: "floral", name: "Floral", color: "#b96b9d", image: img("/sensory/aroma/floral/flores-brancas/jasmim.webp"),
    subs: [
      { id: "white", name: "Flores brancas", color: "#b96b9d", image: img("/sensory/aroma/floral/flores-brancas/jasmim.webp"), d: [
        { id: "jasmine", name: "Jasmim", image: img("/sensory/aroma/floral/flores-brancas/jasmim.webp") },
        { id: "orange-flower", name: "Flor de laranjeira", image: img("/sensory/aroma/floral/flores-brancas/flor-de-laranjeira.webp") },
        { id: "coffee-flower", name: "Flor de café", image: img("/sensory/aroma/floral/flores-brancas/flor-de-cafe.webp") },
      ]},
      { id: "perfumed", name: "Flores perfumadas", color: "#aa6a91", image: img("/sensory/aroma/floral/flores-perfumadas/rosa.png"), d: [
        { id: "rose", name: "Rosa", image: img("/sensory/aroma/floral/flores-perfumadas/rosa.png") },
        { id: "lavender", name: "Lavanda", image: img("/sensory/aroma/floral/flores-perfumadas/lavanda.png") },
        { id: "violet", name: "Violeta", image: img("/sensory/aroma/floral/flores-perfumadas/violeta.png") },
      ]},
    ],
  },
];

const acids = [
  { id: "soft", name: "Macio", hint: "suave e confortável", color: "#eadfc8" },
  { id: "balanced", name: "Equilibrado", hint: "frescor na medida", color: "#efd39c" },
  { id: "fresh", name: "Fresco", hint: "leve e brilhante", color: "#efad58" },
  { id: "juicy", name: "Suculento", hint: "como morder uma maçã", color: "#b8cc78" },
  { id: "alive", name: "Vivo", hint: "mais energia", color: "#88aa63" },
];

const productMap = {
  fruitFresh: { name: "Tangerina", line: "CLÁSSICOS", price: "R$ 74", perCup: "≈ R$ 2,96/xícara", profile: "Cítrico · Refrescante · Delicado" },
  fruitExplorer: { name: "Singular", line: "ÉPICOS", price: "R$ 84", perCup: "≈ R$ 3,36/xícara", profile: "Frutado · Complexo · Evolutivo" },
  sweetSoft: { name: "Doce de Leite", line: "CLÁSSICOS", price: "R$ 74", perCup: "≈ R$ 2,96/xícara", profile: "Açúcar mascavo · Alfajor · Doçura" },
  sweetDaily: { name: "Caramelo", line: "CLÁSSICOS", price: "R$ 68", perCup: "≈ R$ 2,72/xícara", profile: "Caramelo · Chocolate · Equilíbrio" },
  cocoaBody: { name: "Sublime", line: "ÉPICOS", price: "R$ 84", perCup: "≈ R$ 3,36/xícara", profile: "Rapadura · Caramelo · Corpo" },
  gentle: { name: "Essencial", line: "GOURMET", price: "R$ 48", perCup: "≈ R$ 1,92/xícara", profile: "Suavidade · Praticidade · Equilíbrio" },
  intense: { name: "Intenso", line: "GOURMET", price: "R$ 48", perCup: "≈ R$ 1,92/xícara", profile: "Corpo · Presença · Limpeza" },
};

type Phase = "aroma-family" | "aroma-sub" | "aroma-desc" | "flavor-family" | "flavor-sub" | "flavor-desc" | "acid" | "profile" | "desire" | "product";

export default function Page() {
  const [phase, setPhase] = useState<Phase>("aroma-family");
  const [af, setAf] = useState("");
  const [as, setAs] = useState("");
  const [ad, setAd] = useState<string[]>([]);
  const [ff, setFf] = useState("");
  const [fs, setFs] = useState("");
  const [fd, setFd] = useState<string[]>([]);
  const [acid, setAcid] = useState("");

  const isFlavor = phase.startsWith("flavor");
  const famId = isFlavor ? ff : af;
  const subId = isFlavor ? fs : as;
  const fam = data.find((x) => x.id === famId);
  const sub = fam?.subs.find((x) => x.id === subId);

  const allDescriptors = useMemo(() => data.flatMap((x) => x.subs.flatMap((s) => s.d)), []);
  const names = (ids: string[]) => allDescriptors.filter((x) => ids.includes(x.id)).map((x) => x.name);
  const acidName = acids.find((x) => x.id === acid)?.name || "Equilibrado";

  const score: Record<string, number> = { fruit: 0, sweet: 0, cocoa: 0, floral: 0 };
  if (af in score) score[af] = (score[af] ?? 0) + 2;
  if (ff in score) score[ff] = (score[ff] ?? 0) + 2;
  const dominant = Object.keys(score).sort((a, b) => (score[b] ?? 0) - (score[a] ?? 0))[0] || "fruit";

  const recommendation = (() => {
    if (acid === "soft" && dominant === "fruit") return productMap.gentle;
    if (dominant === "fruit" && ["fresh", "juicy", "alive"].includes(acid)) return fs === "citrus" || as === "citrus" ? productMap.fruitFresh : productMap.fruitExplorer;
    if (dominant === "sweet") return ["soft", "balanced"].includes(acid) ? productMap.sweetSoft : productMap.sweetDaily;
    if (dominant === "cocoa") return acid === "alive" ? productMap.intense : productMap.cocoaBody;
    if (dominant === "floral") return productMap.fruitExplorer;
    return productMap.gentle;
  })();

  const profile = dominant === "fruit" ? `frutado, aromático e ${acidName.toLowerCase()}` : dominant === "sweet" ? `doce, confortável e ${acidName.toLowerCase()}` : dominant === "cocoa" ? `profundo, envolvente e ${acidName.toLowerCase()}` : `floral, delicado e ${acidName.toLowerCase()}`;

  const chooseFamily = (id: string) => {
    if (isFlavor) { setFf(id); setFs(""); setFd([]); setPhase("flavor-sub"); }
    else { setAf(id); setAs(""); setAd([]); setPhase("aroma-sub"); }
  };

  const chooseSub = (id: string) => {
    if (isFlavor) { setFs(id); setPhase("flavor-desc"); }
    else { setAs(id); setPhase("aroma-desc"); }
  };

  const chooseDesc = (id: string) => {
    if (isFlavor) {
      const next = fd.includes(id) ? fd.filter((x) => x !== id) : [...fd, id].slice(-2);
      setFd(next);
      if (next.length === 2) window.setTimeout(() => setPhase("acid"), 520);
    } else {
      const next = ad.includes(id) ? ad.filter((x) => x !== id) : [...ad, id].slice(-2);
      setAd(next);
      if (next.length === 2) window.setTimeout(() => setPhase("flavor-family"), 520);
    }
  };

  const backMap: Partial<Record<Phase, Phase>> = {
    "aroma-sub": "aroma-family", "aroma-desc": "aroma-sub", "flavor-family": "aroma-desc",
    "flavor-sub": "flavor-family", "flavor-desc": "flavor-sub", acid: "flavor-desc",
  };

  if (phase === "profile") {
    return <Shell><section className={`${styles.resultScene} ${styles[dominant]}`}><div className={styles.quizReveal}>
      <small>ACHO QUE ENTENDI VOCÊ.</small>
      <h1>Hoje, sua xícara pede...</h1>
      <div className={styles.profileWords}><b>{profile}</b></div>
      <p>{dominant === "fruit" ? "Você foi atrás de aromas expressivos, confirmou a fruta no sabor e escolheu quanto de vida queria na xícara." : dominant === "sweet" ? "Você procurou doçura e conforto desde o aroma. Sua xícara pede algo gostoso de reencontrar." : dominant === "cocoa" ? "Você construiu uma xícara profunda, familiar e envolvente." : "Você escolheu delicadeza, perfume e uma xícara que convida a prestar atenção."}</p>
      <div className={styles.summary}><span>AROMA · {names(ad).join(" + ")}</span><span>SABOR · {names(fd).join(" + ")}</span><span>FRESCOR · {acidName}</span></div>
      <div className={styles.bispoVoice}><b>Bispo</b><span>Já consigo imaginar essa xícara. Quero te mostrar antes de falar em café.</span></div>
      <button className={styles.humanCta} onClick={() => setPhase("desire")}>Quero sentir essa xícara</button>
    </div></section></Shell>;
  }

  if (phase === "desire") {
    return <Shell><section className={`${styles.desireScene} ${styles[dominant]}`}>
      <div className={styles.cupWorld}><div className={styles.steam}/><div className={styles.cup}/><div className={styles.sensoryCloud}>{[...names(ad), ...names(fd)].slice(0, 4).map((x) => <span key={x}>{x}</span>)}</div></div>
      <div className={styles.desireCopy}>
        <small>ANTES DO CAFÉ, A SENSAÇÃO.</small>
        <h1>Imagine o primeiro gole.</h1>
        <div className={styles.desireRhythm}>
          <b>{dominant === "fruit" ? "Fruta primeiro." : dominant === "sweet" ? "Doçura primeiro." : dominant === "cocoa" ? "Aroma profundo." : "Perfume primeiro."}</b>
          <b>{dominant === "fruit" ? "Doçura junto." : dominant === "sweet" ? "Textura macia." : dominant === "cocoa" ? "Textura envolvente." : "Delicadeza no gole."}</b>
          <b>{["fresh", "juicy", "alive"].includes(acid) ? "Frescor que chama o próximo gole." : "Um final confortável que fica."}</b>
        </div>
        <p>Não pense em marca nem embalagem. Pense apenas nessa xícara chegando quente, aromática, do jeito que você acabou de construir.</p>
        <div className={styles.bispoVoice}><b>Bispo</b><span>{dominant === "fruit" ? "É uma xícara que eu beberia prestando atenção na fruta que aparece primeiro." : dominant === "sweet" ? "É uma xícara para quem gosta daquela sensação de conforto logo no primeiro gole." : dominant === "cocoa" ? "É uma xícara que pede calma: chocolate, profundidade e um final que permanece." : "É uma xícara delicada, dessas que fazem a gente chegar mais perto para sentir o aroma."}</span></div>
        <button className={styles.humanCta} onClick={() => setPhase("product")}>É essa sensação que eu quero</button>
      </div>
    </section></Shell>;
  }

  if (phase === "product") {
    return <Shell><section className={styles.productScene}>
      <div className={styles.productIntro}><small>AGORA SIM. TENHO UM CAFÉ EM MENTE.</small><h1>Se eu estivesse escolhendo para você hoje...</h1><p>Eu começaria por este.</p></div>
      <article className={styles.productCard}>
        <div><small>{recommendation.line}</small><h2>{recommendation.name}</h2><strong>{recommendation.profile}</strong><p>Ele segue a direção sensorial que você construiu nesta sessão. Não é um rótulo para sempre — é o café que eu colocaria na sua frente hoje.</p></div>
        <div className={styles.price}><b>{recommendation.price} <small>· pacote</small></b><span>{recommendation.perCup}</span><button>Quero provar esse</button></div>
      </article>
      <div className={styles.feedback}><b>Bispo</b><span>Cheguei perto do que você estava imaginando?</span><div><button>Sim, é por aí</button><button onClick={() => window.location.reload()}>Quero descobrir outro lado meu</button></div></div>
    </section></Shell>;
  }

  const title = phase === "aroma-family" ? "O que chama você no aroma?" : phase === "aroma-sub" ? `Dentro de ${fam?.name.toLowerCase()}, para onde você iria?` : phase === "aroma-desc" ? "Quais dois aromas puxam você primeiro?" : phase === "flavor-family" ? "Agora imagine o primeiro gole." : phase === "flavor-sub" ? "No sabor, que caminho dá mais vontade?" : phase === "flavor-desc" ? "Quais dois sabores você procuraria na xícara?" : "Só mais uma coisa: como você gosta do frescor?";
  const selected = isFlavor ? fd : ad;
  const whisper = phase === "aroma-family" ? "Não precisa entender de café. Escolha pelo desejo." : phase === "aroma-sub" ? "Boa pista. Agora vamos chegar mais perto do aroma." : phase === "aroma-desc" ? (ad.length === 0 ? "Escolha o primeiro sem pensar demais." : ad.length === 1 ? `${names(ad)[0]}. Boa pista. Escolha só mais um.` : `${names(ad).join(" e ")}... já consigo imaginar o aroma.`) : phase === "flavor-family" ? `No aroma você me mostrou ${names(ad).join(" e ")}. Agora quero saber o que dá vontade no primeiro gole.` : phase === "flavor-sub" ? "Ótimo. Estamos deixando de falar de café e começando a imaginar a xícara." : phase === "flavor-desc" ? (fd.length === 0 ? "Escolha o primeiro sabor que te chama." : fd.length === 1 ? `${names(fd)[0]}. Agora só mais um.` : `${names(fd).join(" e ")}. Agora ficou interessante.`) : "Já sei bastante sobre você. Um toque aqui fecha a xícara.";

  return <Shell><section className={styles.experience}>
    {phase !== "aroma-family" && <button className={styles.back} onClick={() => setPhase(backMap[phase] || "aroma-family")}>← quero rever</button>}
    <div className={styles.intro}>
      <p>{phase.startsWith("aroma") ? "AROMA" : phase.startsWith("flavor") ? "SABOR" : "ACIDEZ"} · BISPO VAI COM VOCÊ</p>
      <h1>{title}</h1>
      <span>{phase.endsWith("family") ? "Um toque basta. Escolha pelo primeiro impulso." : phase.endsWith("sub") ? "Toque no caminho que mais te atrai." : phase.endsWith("desc") ? "Não pense demais. Os dois primeiros costumam dizer bastante." : "Toque na sensação que combina com a xícara que você imaginou."}</span>
    </div>
    <div className={styles.journeyStage}>
      {phase.endsWith("family") && <Wheel items={data} pick={chooseFamily}/>} 
      {phase.endsWith("sub") && fam && <Wheel items={fam.subs} pick={chooseSub}/>} 
      {phase.endsWith("desc") && sub && <div className={styles.descriptorGrid}>{sub.d.map((x) => { const on = selected.includes(x.id); return <button key={x.id} className={`${styles.descriptorTile} ${on ? styles.selected : ""}`} style={{ "--tone": fam?.color } as CSSProperties} onClick={() => chooseDesc(x.id)}><span><img src={x.image} alt={x.name}/>{on && <i>✓</i>}</span><strong>{x.name}</strong></button>; })}</div>}
      {phase === "acid" && <div className={styles.acidMandala}><div className={styles.acidCore}><strong>SUA XÍCARA</strong><small>toque no frescor</small></div>{acids.map((x) => <button key={x.id} className={styles.acidPetal} style={{ "--tone": x.color } as CSSProperties} onClick={() => { setAcid(x.id); window.setTimeout(() => setPhase("profile"), 320); }}><b>{x.name}</b><span>{x.hint}</span></button>)}</div>}
    </div>
    <Trail a={names(ad)} f={names(fd)}/>
    <div className={styles.bispoWhisper}><strong>Bispo</strong><span>{whisper}</span></div>
  </section></Shell>;
}

function Wheel({ items, pick }: { items: Array<{ id: string; name: string; color: string; image: string }>; pick: (id: string) => void }) {
  return <div className={styles.familyWheel}>{items.slice(0, 4).map((x, i) => <button key={x.id} className={`${styles.wheelSector} ${styles[`sector${i}`]}`} style={{ "--tone": x.color } as CSSProperties} onClick={() => pick(x.id)}><img src={x.image} alt={x.name}/><span>{x.name}</span></button>)}<div className={styles.wheelCore}><strong>SUA XÍCARA</strong><small>toque e explore</small></div></div>;
}

function Trail({ a, f }: { a: string[]; f: string[] }) {
  if (!a.length && !f.length) return null;
  return <div className={styles.memoryTrail}><small>SUA XÍCARA</small>{a.map((x) => <span key={`a-${x}`}>{x}</span>)}{f.map((x) => <span key={`f-${x}`}>{x}</span>)}</div>;
}

function Shell({ children }: { children: ReactNode }) {
  return <main className={styles.page}><header className={styles.header}><Link href="/loja" className={styles.brand}><img src="/brand/bispo-logo-black.svg" alt="Bispo"/></Link><div className={styles.headerCopy}><span>DESCUBRA O SEU CAFÉ</span></div><Link href="/loja" className={styles.close}>×</Link></header>{children}</main>;
}
