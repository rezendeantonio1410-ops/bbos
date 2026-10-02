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
    line: "CLÁSSICOS",
    name: "Caramelo",
    title: "Doce. Confortável.",
    italic: "Equilibrado.",
    copy: "Caramelo e chocolate. Doce na medida. Daqueles cafés que pedem outra xícara.",
    image: "/brand/editorial/real/jose-preparo.jpg",
    product: realProductImages.Caramelo,
    notes: "Caramelo · Chocolate · Equilíbrio",
    price: "R$ 68,00",
    priceCents: 6800,
    tone: "#C86424",
    crop: "center 52%",
  },
  {
    line: "ÉPICOS",
    name: "Singular",
    title: "Novas camadas.",
    italic: "Uma origem única.",
    copy: "Frutado, complexo e evolutivo. Para quem encontra prazer na descoberta.",
    image: "/brand/editorial/real/singular-ritual.jpg",
    product: realProductImages.Singular,
    notes: "Frutado · Complexo · Evolutivo",
    price: "R$ 84,00",
    priceCents: 8400,
    tone: "#5C7D5F",
    crop: "center 50%",
  },
  {
    line: "ÉPICOS",
    name: "Sublime",
    title: "Escolhido por quem",
    italic: "vive o café.",
    copy: "A Bispo acompanha a origem, a produção e a prova para escolher o que chega à sua xícara.",
    image: "/brand/editorial/real/sublime-ritual.jpg",
    product: realProductImages.Sublime,
    notes: "Rapadura · Caramelo · Doçura profunda",
    price: "R$ 84,00",
    priceCents: 8400,
    tone: "#5C7D5F",
    crop: "center 50%",
  },
  {
    line: "GOURMET",
    name: "Essencial",
    title: "O cuidado de sempre.",
    italic: "Já moído.",
    copy: "Macio e equilibrado, pronto para preparar com facilidade.",
    image: "/brand/editorial/real/preparo-agua.jpg",
    product: realProductImages.Essencial,
    notes: "Macio · Doce · Fácil",
    price: "R$ 52,00",
    priceCents: 5200,
    tone: "#C39A24",
    crop: "center 54%",
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
            alt={
              index === active
                ? `${item.name}: uma cena real da experiência Bispo Coffees`
                : ""
            }
            fill
            priority={index === 0}
            sizes="(max-width: 960px) 100vw, 54vw"
            style={{ objectPosition: item.crop }}
          />
        ))}
        <div className={styles.mediaShade} />
        <div className={styles.mediaSignature}>
          <span>ESCOLHIDO NA ORIGEM</span>
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
            <span>100% Arábica · Torra própria · 500 g</span>
          </div>
        </div>
        <div className={styles.buyRow}>
          <div>
            <small>a partir de</small>
            <strong>{scene.price}</strong>
          </div>
          <AddToCartButton
            product={{
              id: scene.name.toLowerCase(),
              name: scene.name,
              line: scene.line,
              notes: scene.notes,
              priceCents: scene.priceCents,
              weightGrams: 500,
              image: scene.product,
            }}
          >
            Quero este café <span>→</span>
          </AddToCartButton>
        </div>
        <Link className={styles.assist} href="/loja/descobrir">
          Prefere outra sensação? Descubra o café que combina com você →
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
