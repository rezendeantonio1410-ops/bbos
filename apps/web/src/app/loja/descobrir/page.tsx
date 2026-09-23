"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import baseStyles from "./page.module.css";
import guideStyles from "./simple-guide.module.css";
import trailStyles from "./journey-trail.module.css";
import sensoryStyles from "./sensory-system.module.css";
import brand from "./brand.module.css";
import { AddToCartButton, StorefrontCartProvider } from "../StorefrontCart";

const styles = {
  ...baseStyles,
  ...guideStyles,
  ...trailStyles,
  ...sensoryStyles,
};

type Mood = "comfort" | "intense" | "fresh" | "discover";
type Brew = "filter" | "espresso" | "moka" | "press" | "any";
type Moment = "morning" | "focus" | "active" | "pause" | "pleasure" | "share";

const moods = [
  {
    id: "comfort" as const,
    name: "Doce e confortável",
    hint: "caramelo · bolo · chocolate · aconchego",
    visual: "sweetSymbol",
  },
  {
    id: "intense" as const,
    name: "Intenso e encorpado",
    hint: "aroma da cozinha · corpo · presença",
    visual: "intenseSymbol",
  },
  {
    id: "fresh" as const,
    name: "Frutado e fresco",
    hint: "frutas · manhã luminosa · leveza",
    visual: "freshSymbol",
  },
  {
    id: "discover" as const,
    name: "Complexo e surpreendente",
    hint: "camadas · curiosidade · evolução",
    visual: "complexSymbol",
  },
];

const brews = [
  {
    id: "filter" as const,
    name: "Coado",
    hint: "clareza e delicadeza",
    mark: "filterMark",
    grind: "Média",
    particle: "600–900 µm",
    texture: "aparência próxima à areia média",
    note: "Comece no centro da faixa e ajuste: mais fino para acelerar a extração; mais grosso para desacelerar.",
  },
  {
    id: "espresso" as const,
    name: "Espresso",
    hint: "concentração e corpo",
    mark: "espressoMark",
    grind: "Fina",
    particle: "200–400 µm",
    texture: "aparência próxima ao açúcar refinado",
    note: "A regulagem depende da máquina e do tempo de extração. Faça pequenos ajustes no moinho.",
  },
  {
    id: "moka" as const,
    name: "Moka italiana",
    hint: "intensidade sem compactar",
    mark: "mokaMark",
    grind: "Média-fina",
    particle: "400–600 µm",
    texture: "mais grossa que o espresso e mais fina que o coado",
    note: "Preencha o cesto sem prensar. A moagem fina demais pode restringir a passagem da água.",
  },
  {
    id: "press" as const,
    name: "Prensa francesa",
    hint: "textura e presença",
    mark: "pressMark",
    grind: "Grossa",
    particle: "900–1.200 µm",
    texture: "aparência próxima ao sal grosso",
    note: "A moagem grossa reduz sedimentos e favorece uma extração limpa durante a infusão.",
  },
  {
    id: "any" as const,
    name: "Quero versatilidade",
    hint: "um café que funciona de vários jeitos",
    mark: "versatileMark",
    grind: "Ajustável ao método",
    particle: "moer somente a dose do preparo",
    texture: "em grãos até o momento de usar",
    note: "Mantenha o café em grãos e ajuste o moinho sempre que mudar o método.",
  },
];

const moments = [
  {
    id: "morning" as const,
    name: "Começar bem o dia",
    hint: "uma xícara para despertar o ritmo",
    visual: "morningMark",
    resultPhrase: "começar bem o dia",
  },
  {
    id: "focus" as const,
    name: "Focar e criar",
    hint: "estudar, programar, escrever ou trabalhar",
    visual: "focusMark",
    resultPhrase: "focar e criar",
  },
  {
    id: "active" as const,
    name: "Antes ou depois do treino",
    hint: "correr, pedalar ou treinar faz parte do ritual",
    visual: "activeMark",
    resultPhrase: "acompanhar o seu ritual de treino",
  },
  {
    id: "pause" as const,
    name: "Uma pausa só minha",
    hint: "quero prestar atenção na xícara",
    visual: "pauseMark",
    resultPhrase: "uma pausa só sua",
  },
  {
    id: "pleasure" as const,
    name: "Só para curtir",
    hint: "sem pressa, tarefa ou ocasião",
    visual: "pleasureMark",
    resultPhrase: "o puro prazer de tomar café",
  },
  {
    id: "share" as const,
    name: "Compartilhar com alguém",
    hint: "conversa, encontro ou presente",
    visual: "shareMark",
    resultPhrase: "compartilhar com alguém",
  },
];

const products = {
  essencial: {
    name: "Essencial",
    line: "GOURMET",
    price: "R$ 52",
    profile: "Macio · Doce · Fácil",
    image: "/brand/products/essencial-treated.webp",
    copy: "Uma xícara tranquila e versátil para fazer parte da rotina.",
    id: "essencial",
    priceCents: 5200,
  },
  intenso: {
    name: "Intenso",
    line: "GOURMET",
    price: "R$ 52",
    profile: "Corpo · Presença · Limpeza",
    image: "/brand/products/intenso-treated.webp",
    copy: "Mais intensidade, sem esconder a limpeza e o equilíbrio.",
    id: "intenso",
    priceCents: 5200,
  },
  caramelo: {
    name: "Caramelo",
    line: "CLÁSSICOS",
    price: "R$ 68",
    profile: "Caramelo · Chocolate · Equilíbrio",
    image: "/brand/products/caramelo-treated.webp",
    copy: "Doçura reconhecível e conforto desde o primeiro gole.",
    id: "caramelo",
    priceCents: 6800,
  },
  doce: {
    name: "Doce de Leite",
    line: "CLÁSSICOS",
    price: "R$ 68",
    profile: "Mascavo · Doce de leite · Alfajor",
    image: "/brand/products/doce-de-leite-treated.webp",
    copy: "Uma xícara gulosa, macia e cheia de referências afetivas.",
    id: "doce-de-leite",
    priceCents: 6800,
  },
  singular: {
    name: "Singular",
    line: "ÉPICOS",
    price: "R$ 84",
    profile: "Frutado · Complexo · Evolutivo",
    image: "/brand/products/singular-treated.webp",
    copy: "Frutado, complexo e evolutivo: uma xícara que muda enquanto esfria e recompensa a atenção.",
    id: "singular",
    priceCents: 8400,
  },
  sublime: {
    name: "Sublime",
    line: "ÉPICOS",
    price: "R$ 84",
    profile: "Rapadura · Caramelo · Doçura profunda",
    image: "/brand/products/sublime-treated.webp",
    copy: "Doçura profunda e corpo envolvente para um ritual sem pressa.",
    id: "sublime",
    priceCents: 8400,
  },
};

const lineColors = {
  GOURMET: { background: "#E9BB00", foreground: "#102018" },
  CLÁSSICOS: { background: "#F96D01", foreground: "#102018" },
  ÉPICOS: { background: "#5C7D5F", foreground: "#FFFFFF" },
  RAROS: { background: "#9D3B35", foreground: "#FFFFFF" },
} as const;

export default function Page() {
  const [step, setStep] = useState(1);
  const [mood, setMood] = useState<Mood>();
  const [brew, setBrew] = useState<Brew>();
  const [moment, setMoment] = useState<Moment>();

  const recommendation = useMemo(() => {
    if (mood === "discover" || (mood === "fresh" && moment !== "morning"))
      return products.singular;
    if (mood === "intense")
      return brew === "filter" ? products.sublime : products.intenso;
    if (mood === "comfort")
      return moment === "share" ? products.doce : products.caramelo;
    if (mood === "fresh") return products.singular;
    return products.essencial;
  }, [brew, moment, mood]);

  const restart = () => {
    setStep(1);
    setMood(undefined);
    setBrew(undefined);
    setMoment(undefined);
  };

  const selectedMood = moods.find((item) => item.id === mood);
  const selectedBrew = brews.find((item) => item.id === brew);
  const selectedMoment = moments.find((item) => item.id === moment);
  const lineColor = lineColors[recommendation.line as keyof typeof lineColors];

  const trail = (
    <ChoiceTrail
      step={step}
      mood={selectedMood?.name}
      brew={selectedBrew?.name}
      moment={selectedMoment?.name}
      coffee={step === 4 ? recommendation.name : undefined}
      onGoTo={(target) => setStep(target)}
    />
  );

  if (step === 4) {
    return (
      <Shell>
        <section className={styles.simpleResult}>
          <div className={styles.resultCopy}>
            <small>LEITURA DO BISPO · SUA ESCOLHA</small>
            <h1 className={styles.resultHeading}>
              Seu caminho indica {recommendation.name}.
            </h1>
            <p>
              Você pediu uma experiência {selectedMood?.name.toLowerCase()},
              preparada em {selectedBrew?.name.toLowerCase()} e pensada para{" "}
              {selectedMoment?.resultPhrase}.
            </p>
            {trail}
            <div className={styles.bishopNote}>
              <b>Bispo</b>
              <span>
                Não existe resposta certa. Existe o café que faz mais sentido
                para a xícara que você quer agora.
              </span>
            </div>
          </div>
          <article className={styles.simpleProduct}>
            <img
              src={recommendation.image}
              alt={`Embalagem do café ${recommendation.name}`}
            />
            <div>
              <small>INDICAMOS · {recommendation.line}</small>
              <h2>{recommendation.name}</h2>
              <strong>{recommendation.profile}</strong>
              <p>{recommendation.copy}</p>
              <div className={styles.matchReason}>
                <small>POR QUE ELE COMBINA</small>
                <span>{selectedMood?.name}</span>
                <i>+</i>
                <span>{selectedBrew?.name}</span>
                <i>+</i>
                <span>{selectedMoment?.name}</span>
              </div>
              {selectedBrew && (
                <div className={styles.grindGuide}>
                  <div>
                    <small>MOAGEM PARA {selectedBrew.name.toUpperCase()}</small>
                    <strong>{selectedBrew.grind}</strong>
                    <b>{selectedBrew.particle}</b>
                  </div>
                  <p>
                    <em>Referência visual:</em> {selectedBrew.texture}.{" "}
                    {selectedBrew.note}
                  </p>
                  <footer>
                    <span>CAFÉ EM GRÃOS</span> Para preservar aromas e sabor,
                    moa apenas a quantidade que será preparada.
                  </footer>
                </div>
              )}
              <b>
                {recommendation.price} <small>· 500 g</small>
              </b>
              <div className={styles.resultActions}>
                <AddToCartButton
                  product={{
                    id: recommendation.id,
                    name: recommendation.name,
                    line: recommendation.line,
                    notes: recommendation.profile,
                    priceCents: recommendation.priceCents,
                    weightGrams: 500,
                    image: recommendation.image,
                  }}
                  style={{
                    background: lineColor.background,
                    color: lineColor.foreground,
                  }}
                >
                  Adicionar à sacola →
                </AddToCartButton>
                <button type="button" onClick={restart}>
                  Descobrir outro perfil
                </button>
              </div>
            </div>
          </article>
        </section>
      </Shell>
    );
  }

  return (
    <Shell>
      <section className={styles.simpleJourney}>
        {trail}
        <div className={styles.simpleIntro}>
          <small>
            {step === 1
              ? "O BISPO AJUDA VOCÊ A ESCOLHER SEU CAFÉ"
              : step === 2
                ? "AGORA, O SEU RITUAL"
                : "A ÚLTIMA ESCOLHA"}
          </small>
          <h1>
            {step === 1
              ? "Qual lembrança de café chama você agora?"
              : step === 2
                ? "Como você prepara seu café?"
                : "Para qual momento é essa xícara?"}
          </h1>
          <p>
            {step === 1
              ? "Pense menos em notas técnicas. Escolha pela sensação que dá vontade de beber."
              : step === 2
                ? "O método muda textura, clareza e intensidade."
                : "O contexto também faz parte do sabor."}
          </p>
        </div>

        {step === 1 && (
          <div className={styles.moodGrid}>
            {moods.map((item) => (
              <button
                className={styles[item.visual]}
                key={item.id}
                type="button"
                onClick={() => {
                  setMood(item.id);
                  setStep(2);
                }}
              >
                <i className={styles.moodSymbol} aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                </i>
                <span>
                  <b>{item.name}</b>
                  <small>{item.hint}</small>
                </span>
              </button>
            ))}
          </div>
        )}
        {step === 2 && (
          <div className={styles.choiceGrid}>
            {brews.map((item) => (
              <button
                className={
                  item.id === "any" ? styles.versatileChoice : undefined
                }
                key={item.id}
                type="button"
                onClick={() => {
                  setBrew(item.id);
                  setStep(3);
                }}
              >
                <i
                  className={`${styles.methodMark} ${styles[item.mark]}`}
                  aria-hidden="true"
                />
                <span>
                  <b>{item.name}</b>
                  <small>{item.hint}</small>
                </span>
              </button>
            ))}
          </div>
        )}
        {step === 3 && (
          <div className={styles.momentGrid}>
            {moments.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setMoment(item.id);
                  setStep(4);
                }}
              >
                <i
                  className={`${styles.momentMark} ${styles[item.visual]}`}
                  aria-hidden="true"
                />
                <span>
                  <b>{item.name}</b>
                  <small>{item.hint}</small>
                </span>
              </button>
            ))}
          </div>
        )}

        <div className={styles.simpleFooter}>
          {step > 1 ? (
            <button type="button" onClick={() => setStep(step - 1)}>
              ← voltar uma pergunta
            </button>
          ) : (
            <span />
          )}
          <b>Leva menos de um minuto.</b>
        </div>
      </section>
    </Shell>
  );
}

function ChoiceTrail({
  step,
  mood,
  brew,
  moment,
  coffee,
  onGoTo,
}: {
  step: number;
  mood?: string;
  brew?: string;
  moment?: string;
  coffee?: string;
  onGoTo: (step: number) => void;
}) {
  const choices = [
    { number: 1, label: "Sensação", value: mood },
    { number: 2, label: "Preparo", value: brew },
    { number: 3, label: "Momento", value: moment },
  ];

  return (
    <nav
      className={`${styles.choiceTrail} ${step === 4 ? styles.resultTrail : ""}`}
      aria-label="O caminho das suas escolhas"
    >
      <small>SEU CAMINHO</small>
      <div>
        {choices.map((choice, index) => {
          const completed = Boolean(choice.value);
          const current = step === choice.number;
          const canReturn = completed && choice.number < step;
          return (
            <div
              key={choice.number}
              className={`${styles.trailStep} ${completed ? styles.trailDone : ""} ${current ? styles.trailCurrent : ""}`}
            >
              {canReturn ? (
                <button
                  type="button"
                  onClick={() => onGoTo(choice.number)}
                  aria-label={`Alterar ${choice.label.toLowerCase()}`}
                >
                  <b>{choice.number}</b>
                  <span>
                    <small>{choice.label}</small>
                    <strong>{choice.value}</strong>
                  </span>
                </button>
              ) : (
                <div>
                  <b>{completed ? "✓" : choice.number}</b>
                  <span>
                    <small>{choice.label}</small>
                    <strong>
                      {choice.value ||
                        (current ? "Escolha agora" : "Próxima escolha")}
                    </strong>
                  </span>
                </div>
              )}
              {index < choices.length - 1 && <i>→</i>}
            </div>
          );
        })}
        {step === 4 && (
          <div className={`${styles.trailStep} ${styles.trailCoffee}`}>
            <i>→</i>
            <div>
              <b>4</b>
              <span>
                <small>Seu café</small>
                <strong>{coffee}</strong>
              </span>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <StorefrontCartProvider>
      <main className={`${styles.page} ${brand.page}`}>
        <header className={styles.header}>
          <Link href="/loja" className={styles.brand}>
            <img
              src="/brand/logo/bispo-logo-official-transparent.png"
              alt="Bispo Coffees"
            />
          </Link>
          <div className={styles.headerCopy}>
            <b aria-hidden="true">B</b>
            <span>
              <strong>O Bispo ajuda você a escolher seu café</strong>
              <small>3 escolhas · menos de um minuto</small>
            </span>
          </div>
          <Link href="/loja" className={styles.close} aria-label="Fechar">
            ×
          </Link>
        </header>
        {children}
      </main>
    </StorefrontCartProvider>
  );
}
