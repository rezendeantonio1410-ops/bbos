"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { AddToCartButton } from "./StorefrontCart";
import styles from "./EditorialHero.module.css";
import type { StorefrontImageSelection } from "@/lib/storefront-images";
import { realProductImages } from "./real-product-images";

const scenes = [
  {
    id: "caramelo",
    line: "CLÁSSICOS",
    name: "Caramelo",
    title: "Doce. Confortável.",
    italic: "Equilibrado.",
    copy: "Caramelo e chocolate. Doce na medida. Daqueles cafés que pedem outra xícara.",
    image: "/brand/editorial/real/suzi-jose-conversa-118.jpg",
    alt: "Suzi Ninov e José Rezende conversando durante uma prova de cafés Bispo",
    signature: "SUZI + JOSÉ · ESCOLHA E PROVA",
    product: realProductImages.Caramelo,
    notes: "Caramelo · Chocolate · Equilíbrio",
    price: "R$ 68,00",
    priceCents: 6800,
    weightGrams: 500,
    tone: "#C86424",
    crop: "46% center",
  },
  {
    id: "intenso",
    line: "GOURMET",
    name: "Intenso",
    title: "Mais corpo.",
    italic: "Presença limpa.",
    copy: "Uma xícara encorpada e direta, sem amargor agressivo e sem perder a limpeza.",
    image: "/brand/editorial/real/jose-preparo-73.jpg",
    alt: "José Rezende preparando um café Bispo no método coado",
    signature: "JOSÉ · PREPARO E PRECISÃO",
    product: realProductImages.Intenso,
    notes: "Corpo · Presença · Limpeza",
    price: "R$ 55,00",
    priceCents: 5500,
    weightGrams: 500,
    tone: "#A77924",
    crop: "center 46%",
  },
  {
    id: "doce-de-leite",
    line: "CLÁSSICOS",
    name: "Doce de Leite",
    title: "Doçura que lembra",
    italic: "casa.",
    copy: "Açúcar mascavo, doce de leite e alfajor em uma xícara macia e prolongada.",
    image: "/brand/editorial/real/jose-prova.jpg",
    alt: "José Rezende avaliando uma xícara durante uma prova de cafés Bispo",
    signature: "DOÇURA · PROVA E MEMÓRIA",
    product: realProductImages["Doce de Leite"],
    notes: "Mascavo · Doce de leite · Alfajor",
    price: "R$ 68,00",
    priceCents: 6800,
    weightGrams: 500,
    tone: "#B66B35",
    crop: "center 48%",
  },
  {
    id: "tangerina",
    line: "CLÁSSICOS",
    name: "Tangerina",
    title: "Um café vivo.",
    italic: "Fresco e luminoso.",
    copy: "Cítrico, doce e alegre: uma porta de entrada para descobrir os cafés frutados.",
    image: "/brand/editorial/real/caderno-frutos-maturacao.jpg",
    alt: "Frutos de café em diferentes estágios de maturação",
    signature: "CAMPO · FRUTO E FRESCOR",
    product: realProductImages.Tangerina,
    notes: "Cítrico · Doce · Fresco",
    price: "R$ 68,00",
    priceCents: 6800,
    weightGrams: 500,
    tone: "#E47928",
    crop: "center 58%",
  },
  {
    id: "singular",
    line: "ÉPICOS",
    name: "Singular",
    title: "Novas camadas.",
    italic: "Uma origem única.",
    copy: "Frutado, complexo e evolutivo. Para quem encontra prazer na descoberta.",
    image: "/brand/editorial/real/suzi-jose-servir-60.jpg",
    alt: "José Rezende servindo café para Suzi Ninov durante uma prova Bispo",
    signature: "SUZI + JOSÉ · PROVA E RITUAL",
    product: realProductImages.Singular,
    notes: "Frutado · Complexo · Evolutivo",
    price: "R$ 84,00",
    priceCents: 8400,
    weightGrams: 500,
    tone: "#5C7D5F",
    crop: "center 50%",
  },
  {
    id: "sublime",
    line: "ÉPICOS",
    name: "Sublime",
    title: "Escolhido por quem",
    italic: "vive o café.",
    copy: "Suzi prova cada perfil com rigor e sensibilidade para escolher o que merece chegar à sua xícara.",
    image: "/brand/editorial/real/suzi-aroma.jpg",
    alt: "Suzi Ninov avaliando o aroma de cafés em uma prova Bispo",
    signature: "SUZI · PROVA E CRITÉRIO",
    product: realProductImages.Sublime,
    notes: "Rapadura · Caramelo · Doçura profunda",
    price: "R$ 84,00",
    priceCents: 8400,
    weightGrams: 500,
    tone: "#5C7D5F",
    crop: "center 48%",
  },
  {
    id: "essencial",
    line: "GOURMET",
    name: "Essencial",
    title: "O cuidado de sempre.",
    italic: "Já moído.",
    copy: "Macio e equilibrado, pronto para preparar com facilidade.",
    image: "/brand/editorial/real/preparo-agua.jpg",
    alt: "Água sendo servida para preparar café Bispo",
    signature: "CUIDADO EM CADA PREPARO",
    product: realProductImages.Essencial,
    notes: "Macio · Doce · Fácil",
    price: "R$ 55,00",
    priceCents: 5500,
    weightGrams: 500,
    tone: "#C39A24",
    crop: "center 54%",
  },
  {
    id: "raro",
    line: "RAROS",
    name: "Raro",
    title: "Poucas sacas.",
    italic: "Uma história inteira.",
    copy: "O microlote de Carlos Alexandre traduz o Norte do Paraná em uma xícara limpa e viva.",
    image: "/brand/editorial/real/caderno-carlos-alexandre-colheita.jpg",
    alt: "Carlos Alexandre exibindo a colheita de um microlote no Norte do Paraná",
    signature: "CARLOS ALEXANDRE · ORIGEM E SAFRA",
    product: realProductImages.Raro,
    notes: "86,5 pontos · Origem única · Safra limitada",
    price: "R$ 54,00",
    priceCents: 5400,
    weightGrams: 250,
    tone: "#8E2721",
    crop: "center 72%",
  },
] as const;

export default function EditorialHero({
  productImages = {},
}: {
  productImages?: StorefrontImageSelection;
}) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const selectedScene = scenes[active] ?? scenes[0]!;
  const scene = {
    ...selectedScene,
    product:
      realProductImages[selectedScene.name] ??
      productImages[selectedScene.name]?.hero ??
      productImages[selectedScene.name]?.primary ??
      selectedScene.product,
  };
  const preparations = Math.floor(scene.weightGrams / 20);
  const pricePerPreparation =
    scene.line === "GOURMET"
      ? null
      : (scene.priceCents / 100 / preparations).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        });

  useEffect(() => {
    if (paused || interacted) return;
    const timer = window.setInterval(
      () => setActive((current) => (current + 1) % scenes.length),
      8200,
    );
    return () => window.clearInterval(timer);
  }, [interacted, paused]);

  const move = (direction: number) => {
    setInteracted(true);
    setActive(
      (current) => (current + direction + scenes.length) % scenes.length,
    );
  };

  return (
    <section
      id="top"
      className={styles.hero}
      style={{ "--scene-tone": scene.tone } as React.CSSProperties}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carrossel"
      aria-label="Cafés escolhidos pela Bispo"
    >
      <div className={styles.media} data-photo-slot={`hero-${active + 1}`}>
        {scenes.map((item, index) => (
          <Image
            key={item.name}
            className={`${styles.sceneImage} ${index === active ? styles.activeImage : ""}`}
            src={item.image}
            alt={index === active ? item.alt : ""}
            fill
            priority={index === 0}
            sizes="(max-width: 960px) 100vw, 54vw"
            style={{ objectPosition: item.crop }}
          />
        ))}
        <div className={styles.mediaShade} />
        <div className={styles.mediaSignature}>
          <span>{scene.signature}</span>
        </div>
        <div className={styles.controls}>
          <button onClick={() => move(-1)} aria-label="Cena anterior">
            <ArrowLeft />
          </button>
          <span>
            {String(active + 1).padStart(2, "0")} /{" "}
            {String(scenes.length).padStart(2, "0")}
          </span>
          <button onClick={() => move(1)} aria-label="Próxima cena">
            <ArrowRight />
          </button>
        </div>
      </div>

      <div className={styles.copy} aria-live="polite">
        <div className={styles.topline}>
          <span>{scene.line}</span>
          <i />
          <b>{scene.name}</b>
        </div>
        <h1>
          {scene.title}
          <br />
          <em>{scene.italic}</em>
        </h1>
        <p className={styles.intro}>{scene.copy}</p>
        <div className={styles.productStage}>
          <div className={styles.productImage}>
            <img src={scene.product} alt={`Café ${scene.name}`} />
          </div>
          <div className={styles.productReading}>
            <small>LEITURA SENSORIAL</small>
            <strong>{scene.notes}</strong>
            <span>100% Arábica · Torra própria · {scene.weightGrams} g</span>
          </div>
        </div>
        <div className={styles.buyRow}>
          <div>
            <small>a partir de</small>
            <strong>{scene.price}</strong>
            {pricePerPreparation ? (
              <span className={styles.preparationValue}>
                {preparations} preparos de 20 g · ≈ {pricePerPreparation} cada
              </span>
            ) : null}
          </div>
          <AddToCartButton
            product={{
              id: scene.id,
              name: scene.name,
              line: scene.line,
              notes: scene.notes,
              priceCents: scene.priceCents,
              weightGrams: scene.weightGrams,
              image: scene.product,
            }}
          >
            Quero este café <span>→</span>
          </AddToCartButton>
        </div>
        <Link className={styles.assist} href="/loja/descobrir">
          Ainda não é o seu? Encontre o café que combina com você →
        </Link>
        <div className={styles.dots} aria-label="Escolher cena">
          {scenes.map((item, index) => (
            <button
              key={item.name}
              className={index === active ? styles.activeDot : ""}
              onClick={() => {
                setInteracted(true);
                setActive(index);
              }}
              aria-label={`Mostrar ${item.name}`}
              aria-current={index === active ? "true" : undefined}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
