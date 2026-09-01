"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "./page.module.css";

type Choice = {
  id: string;
  label: string;
  hint: string;
  tone: string;
};

type Answers = {
  flavor?: string;
  acidity?: string;
  body?: string;
  moment?: string;
};

const flavorChoices: Choice[] = [
  { id: "caramel", label: "Chocolate & caramelo", hint: "Doce, confortável, familiar", tone: "#C87324" },
  { id: "citrus", label: "Frutas cítricas", hint: "Fresco, vivo, luminoso", tone: "#E8A72B" },
  { id: "fruit", label: "Frutas maduras", hint: "Suculento, expressivo, alegre", tone: "#B6434B" },
  { id: "floral", label: "Floral & delicado", hint: "Elegante, leve, surpreendente", tone: "#8B776B" },
  { id: "nuts", label: "Castanhas & especiarias", hint: "Aconchegante, profundo, persistente", tone: "#73513B" },
];

const acidityChoices: Choice[] = [
  { id: "low", label: "Suave", hint: "Quase sem destaque de acidez", tone: "#D6C7A4" },
  { id: "balanced", label: "Equilibrada", hint: "Frescor presente, sem dominar", tone: "#E0A73A" },
  { id: "citrica", label: "Cítrica", hint: "Lembra laranja ou tangerina", tone: "#E58A2E" },
  { id: "malica", label: "Málica", hint: "Frescor que lembra maçã", tone: "#799A46" },
  { id: "vibrant", label: "Vibrante", hint: "Acidez evidente e cheia de energia", tone: "#B83A31" },
];

const bodyChoices: Choice[] = [
  { id: "light", label: "Leve", hint: "Fluido e delicado", tone: "#C7D8D5" },
  { id: "silky", label: "Sedoso", hint: "Macio e elegante", tone: "#95B3A8" },
  { id: "round", label: "Envolvente", hint: "Presente e confortável", tone: "#B87843" },
  { id: "structured", label: "Estruturado", hint: "Mais corpo e persistência", tone: "#5F4738" },
];

const momentChoices: Choice[] = [
  { id: "daily", label: "Meu dia a dia", hint: "Quero algo fácil de reencontrar", tone: "#F4D54A" },
  { id: "pause", label: "Minha pausa", hint: "Quero conforto e presença", tone: "#E78A38" },
  { id: "discover", label: "Quero descobrir", hint: "Quero perceber algo diferente", tone: "#387D50" },
  { id: "special", label: "Algo especial", hint: "Quero uma experiência fora da curva", tone: "#B83A31" },
];

const recommendations = {
  essencial: {
    name: "Essencial",
    line: "GOURMET",
    notes: "Equilibrado · Suave · Versátil",
    price: "R$ 48",
    tone: "#F4D54A",
    reason: "Você mostrou preferência por suavidade, equilíbrio e praticidade. Um caminho natural para o dia a dia.",
  },
  caramelo: {
    name: "Caramelo",
    line: "CLÁSSICOS",
    notes: "Caramelo · Chocolate · Corpo envolvente",
    price: "R$ 68",
    tone: "#E78A38",
    reason: "Seu mapa aponta para doçura, conforto e uma xícara equilibrada e envolvente.",
  },
  doce: {
    name: "Doce de Leite",
    line: "CLÁSSICOS",
    notes: "Mascavo · Doce de leite · Alfajor",
    price: "R$ 74",
    tone: "#D99B3C",
    reason: "Você busca doçura evidente, mas com mais complexidade, elegância e presença.",
  },
  tangerina: {
    name: "Tangerina",
    line: "CLÁSSICOS",
    notes: "Cítrico · Doce · Fresco",
    price: "R$ 68",
    tone: "#E8892F",
    reason: "Você indicou frescor, brilho e uma acidez agradável sem abrir mão da doçura.",
  },
  singular: {
    name: "Singular",
    line: "ÉPICOS",
    notes: "Frutado · Complexo · Evolutivo",
    price: "R$ 85",
    tone: "#387D50",
    reason: "Seu paladar pede descoberta: fruta, acidez e uma xícara que evolui enquanto esfria.",
  },
  raro: {
    name: "Microlote Raro",
    line: "RAROS",
    notes: "Floral · Frutas vermelhas · Único",
    price: "R$ 53",
    tone: "#B83A31",
    reason: "Você demonstrou curiosidade por perfis delicados, marcantes e menos previsíveis.",
  },
};

const steps = ["Sabor", "Acidez", "Corpo", "Momento"];

export default function DescobrirCafePage() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [finished, setFinished] = useState(false);

  const resultKey = useMemo(() => {
    if (!finished) return "caramelo";
    if (answers.moment === "special" || answers.flavor === "floral") return "raro";
    if (answers.moment === "discover" || answers.flavor === "fruit" || answers.acidity === "vibrant") return "singular";
    if (answers.flavor === "citrus" || answers.acidity === "citrica" || answers.acidity === "malica") return "tangerina";
    if (answers.flavor === "caramel" && (answers.body === "structured" || answers.acidity === "balanced")) return "doce";
    if (answers.flavor === "caramel" || answers.moment === "pause" || answers.body === "round") return "caramelo";
    return "essencial";
  }, [answers, finished]);

  const result = recommendations[resultKey as keyof typeof recommendations];

  function choose(group: keyof Answers, id: string) {
    const next = { ...answers, [group]: id };
    setAnswers(next);
    if (step < 3) {
      window.setTimeout(() => setStep((value) => value + 1), 170);
    } else {
      window.setTimeout(() => setFinished(true), 170);
    }
  }

  function reset() {
    setAnswers({});
    setStep(0);
    setFinished(false);
  }

  const currentChoices = [flavorChoices, acidityChoices, bodyChoices, momentChoices][step];
  const currentKey = ["flavor", "acidity", "body", "moment"][step] as keyof Answers;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/loja" className={styles.brand} aria-label="Voltar para a loja Bispo">
          <Image src="/brand/logo/bispo-logo-official-transparent.png" width={150} height={50} alt="Bispo Coffees" priority />
        </Link>
        <div className={styles.headerCopy}>
          <span>DESCUBRA O SEU CAFÉ</span>
          <small>Um mapa de preferência inspirado na linguagem sensorial do café.</small>
        </div>
        <Link className={styles.close} href="/loja" aria-label="Fechar">×</Link>
      </header>

      {!finished ? (
        <section className={styles.experience}>
          <div className={styles.progress} aria-label="Progresso">
            {steps.map((label, index) => (
              <div key={label} className={`${styles.progressItem} ${index <= step ? styles.active : ""}`}>
                <i>{index + 1}</i><span>{label}</span>
              </div>
            ))}
          </div>

          <div className={styles.intro}>
            <p>NÃO PRECISA ENTENDER DE CAFÉ.</p>
            <h1>{step === 0 ? "Só escolha o que chama você." : step === 1 ? "Quanto de frescor você gosta?" : step === 2 ? "Como você gosta de sentir o café?" : "O que você procura nesta xícara?"}</h1>
            <span>{step === 0 ? "Sua primeira reação já diz bastante sobre o seu paladar." : "Não existe resposta certa. Escolha pela sensação."}</span>
          </div>

          <div className={styles.stage}>
            {step === 0 && <FlavorWheel selected={answers.flavor} />}
            {step === 1 && <AcidityMandala selected={answers.acidity} />}
            {step === 2 && <BodyPulse selected={answers.body} />}
            {step === 3 && <MomentOrbit selected={answers.moment} />}

            <div className={styles.choices}>
              {currentChoices.map((choice) => (
                <button
                  key={choice.id}
                  className={answers[currentKey] === choice.id ? styles.selected : ""}
                  style={{ "--tone": choice.tone } as React.CSSProperties}
                  onClick={() => choose(currentKey, choice.id)}
                >
                  <i />
                  <strong>{choice.label}</strong>
                  <span>{choice.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.backRow}>
            {step > 0 ? <button onClick={() => setStep((value) => value - 1)}>← Voltar</button> : <Link href="/loja">← Voltar para a loja</Link>}
            <small>Leva menos de 1 minuto.</small>
          </div>
        </section>
      ) : (
        <section className={styles.resultPage}>
          <div className={styles.resultLead}>
            <p>SEU MAPA BISPO</p>
            <h1>Temos um café em mente.</h1>
            <span>Traduzimos suas escolhas em um perfil simples. Não é uma nota de cupping: é o seu mapa de preferência.</span>
          </div>

          <div className={styles.resultGrid}>
            <TastePortrait answers={answers} tone={result.tone} />
            <article className={styles.recommendation} style={{ "--tone": result.tone } as React.CSSProperties}>
              <div className={styles.resultBag}><span>BISPO</span><i /></div>
              <div className={styles.resultCopy}>
                <p>{result.line}</p>
                <h2>{result.name}</h2>
                <strong>{result.notes}</strong>
                <span>{result.reason}</span>
                <div className={styles.resultBuy}>
                  <b>{result.price} <small>· 500 g</small></b>
                  <button>Quero experimentar →</button>
                </div>
                <button className={styles.why} onClick={reset}>Refazer meu mapa</button>
              </div>
            </article>
          </div>

          <div className={styles.nextPaths}>
            <span>Quer ir além?</span>
            <Link href="/loja#linhas">Ver todas as linhas →</Link>
            <Link href="/loja#cafes">Ver todos os cafés →</Link>
          </div>
        </section>
      )}
    </main>
  );
}

function FlavorWheel({ selected }: { selected?: string }) {
  return (
    <div className={styles.flavorWheel} aria-hidden="true">
      <div className={styles.wheelOuter} />
      <div className={styles.wheelMid} />
      <div className={styles.wheelCup}><span>BISPO</span><small>paladar</small></div>
      <em className={`${styles.wheelLabel} ${styles.one} ${selected === "caramel" ? styles.emphasis : ""}`}>Doce</em>
      <em className={`${styles.wheelLabel} ${styles.two} ${selected === "citrus" ? styles.emphasis : ""}`}>Cítrico</em>
      <em className={`${styles.wheelLabel} ${styles.three} ${selected === "fruit" ? styles.emphasis : ""}`}>Frutado</em>
      <em className={`${styles.wheelLabel} ${styles.four} ${selected === "floral" ? styles.emphasis : ""}`}>Floral</em>
      <em className={`${styles.wheelLabel} ${styles.five} ${selected === "nuts" ? styles.emphasis : ""}`}>Profundo</em>
    </div>
  );
}

function AcidityMandala({ selected }: { selected?: string }) {
  return (
    <div className={styles.acidityMandala} aria-hidden="true">
      <div className={styles.acidityCore}><span>ACIDEZ</span><strong>{selected ? "seu ponto" : "frescor"}</strong></div>
      <i className={styles.ringOne} /><i className={styles.ringTwo} /><i className={styles.ringThree} />
      <b className={styles.acidLow}>suave</b><b className={styles.acidCitrus}>cítrica</b><b className={styles.acidMalic}>málica</b><b className={styles.acidVibrant}>vibrante</b>
    </div>
  );
}

function BodyPulse({ selected }: { selected?: string }) {
  return (
    <div className={styles.bodyPulse} aria-hidden="true">
      <span className={styles.pulseOne} /><span className={styles.pulseTwo} /><span className={styles.pulseThree} /><span className={styles.pulseFour} />
      <div><small>leve</small><strong>{selected === "structured" ? "estrutura" : selected === "round" ? "envolvência" : selected === "silky" ? "maciez" : "fluidez"}</strong><small>presente</small></div>
    </div>
  );
}

function MomentOrbit({ selected }: { selected?: string }) {
  return (
    <div className={styles.momentOrbit} aria-hidden="true">
      <div className={styles.orbitCore}>SUA<br />XÍCARA</div>
      <i /><i /><i /><i />
      <span className={styles.morning}>dia a dia</span><span className={styles.pause}>pausa</span><span className={styles.discover}>descoberta</span><span className={styles.special}>especial</span>
    </div>
  );
}

function TastePortrait({ answers, tone }: { answers: Answers; tone: string }) {
  const sweetness = answers.flavor === "caramel" ? 92 : answers.flavor === "fruit" ? 75 : 60;
  const acidity = answers.acidity === "vibrant" ? 95 : answers.acidity === "citrica" || answers.acidity === "malica" ? 78 : answers.acidity === "balanced" ? 58 : 35;
  const body = answers.body === "structured" ? 92 : answers.body === "round" ? 76 : answers.body === "silky" ? 58 : 40;
  const discovery = answers.moment === "special" ? 96 : answers.moment === "discover" ? 82 : 48;
  return (
    <div className={styles.portrait} style={{ "--tone": tone } as React.CSSProperties}>
      <div className={styles.portraitCircle}>
        <div><span>SEU</span><strong>PALADAR</strong></div>
      </div>
      {[['Doçura', sweetness], ['Acidez', acidity], ['Corpo', body], ['Descoberta', discovery]].map(([label, value]) => (
        <div className={styles.metric} key={String(label)}><span>{label}</span><i><b style={{ width: `${value}%` }} /></i></div>
      ))}
    </div>
  );
}
