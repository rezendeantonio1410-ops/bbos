"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import Link from "next/link";
import { AddToCartButton, type StoreProduct, type StoreProductStory } from "./StorefrontCart";
import styles from "./product-details.module.css";
import fixStyles from "./product-details-fix.module.css";

export type ProductStory = StoreProductStory & {
  description: string;
  sensory: { label: string; value: number }[];
  sensoryDescription?: string;
  rareDetails?: {
    producer: string;
    farm: string;
    place: string;
    altitude: string;
    area: string;
    score: string;
    relationship: string;
    history: string[];
    varieties: string;
    gallery: { src: string; alt: string; caption: string }[];
  };
};

type Props = {
  product: StoreProduct & {
    priceLabel: string;
    weightLabel: string;
    tag: string;
    tone: string;
  };
  story: ProductStory;
  detailHref?: string;
  detailLabel?: string;
};

export default function ProductDetails({ product, story, detailHref, detailLabel = "Conhecer este café →" }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", close);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {detailHref ? (
        <Link className={`${styles.open} ${fixStyles.open} ${fixStyles.storyCta} ${fixStyles.readMore}`} href={detailHref}>
          {detailLabel}
        </Link>
      ) : (
        <button className={`${styles.open} ${fixStyles.open} ${fixStyles.storyCta} ${fixStyles.readMore}`} type="button" onClick={() => setOpen(true)}>
          {detailLabel}
        </button>
      )}
      {!detailHref && open && createPortal(
        <div className={styles.layer}>
          <button className={styles.backdrop} type="button" aria-label="Fechar detalhes" onClick={() => setOpen(false)} />
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby={`story-${product.id}`}>
            <header className={styles.header}>
              <span>LEITURA DO BISPO · {product.line}</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar detalhes"><X /></button>
            </header>

            <div className={styles.hero} style={{ "--tone": product.tone } as React.CSSProperties}>
              <div className={styles.productImage}>
                {product.image ? <img src={product.image} alt={`Embalagem do café ${product.name}`} /> : <div className={styles.fallback}><small>EDIÇÃO LIMITADA</small><b>BISPO</b><span>{product.name}</span><em>{product.weightLabel}</em></div>}
              </div>
              <div className={styles.heroCopy}>
                <small>{product.tag}</small>
                <h2 id={`story-${product.id}`}>{product.name}</h2>
                <strong>{product.notes}</strong>
                <p>{story.promise}</p>
                <div className={styles.quickBuy}>
                  <span><b>{product.priceLabel}</b> · {product.weightLabel}</span>
                  <AddToCartButton product={{ ...product, story }}>Comprar agora →</AddToCartButton>
                </div>
              </div>
            </div>

            <div className={styles.content}>
              {story.rareDetails && (
                <section className={styles.rareIntro}>
                  <div className={styles.rareLead}>
                    <small>RARO · SAFRA ATUAL</small>
                    <h3>Uma raridade escolhida ao longo do tempo.</h3>
                    <p>{story.rareDetails.relationship}</p>
                    <span>Poucas unidades disponíveis nesta edição.</span>
                  </div>
                  <dl className={styles.traceability}>
                    <div><dt>Produtor</dt><dd>{story.rareDetails.producer}</dd></div>
                    <div><dt>Propriedade</dt><dd>{story.rareDetails.farm}</dd></div>
                    <div><dt>Origem</dt><dd>{story.rareDetails.place}</dd></div>
                    <div><dt>Altitude</dt><dd>{story.rareDetails.altitude}</dd></div>
                    <div><dt>Área</dt><dd>{story.rareDetails.area}</dd></div>
                    <div className={styles.score}><dt>Pontuação</dt><dd>{story.rareDetails.score}</dd></div>
                  </dl>
                </section>
              )}

              <article className={styles.reading}>
                <small>COMO É NA XÍCARA</small>
                <h3>Sem complicar o café.</h3>
                <p>{story.description}</p>
                <dl>
                  <div><dt>Combina com</dt><dd>{story.bestFor}</dd></div>
                  <div><dt>Para preparar</dt><dd>{story.brew}</dd></div>
                  <div><dt>O que você recebe</dt><dd>1 pacote de {product.weightLabel}, torrado pela Bispo.</dd></div>
                </dl>
              </article>

              <aside className={styles.sensory}>
                <small>PERFIL SENSORIAL</small>
                {story.sensory.map((item) => (
                  <div className={styles.meter} key={item.label}>
                    <span>{item.label}</span><i><b style={{ width: `${item.value}%` }} /></i>
                  </div>
                ))}
                <p>As barras são um guia de sensação — não uma nota de qualidade.</p>
              </aside>

              {story.sensoryDescription && (
                <article className={styles.sensoryReading}>
                  <small>LEITURA SENSORIAL COMPLETA</small>
                  <h3>A xícara em detalhes.</h3>
                  <p>{story.sensoryDescription}</p>
                </article>
              )}

              {story.rareDetails && (
                <article className={styles.producerStory}>
                  <div>
                    <small>A HISTÓRIA DE QUEM PRODUZ</small>
                    <h3>Alexandre transformou herança em futuro.</h3>
                    {story.rareDetails.history.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                    <dl>
                      <div><dt>Variedades cultivadas</dt><dd>{story.rareDetails.varieties}</dd></div>
                      <div><dt>O que move esta safra</dt><dd>Qualidade de xícara, renda mais estável e um legado para a próxima geração.</dd></div>
                    </dl>
                  </div>
                  {story.rareDetails.gallery[0] && (
                    <div className={styles.producerPortrait}>
                      <img src={story.rareDetails.gallery[0].src} alt={story.rareDetails.gallery[0].alt} />
                      <span>{story.rareDetails.gallery[0].caption}</span>
                    </div>
                  )}
                </article>
              )}

              {story.rareDetails && (
                <div className={styles.rareGallery}>
                  {story.rareDetails.gallery.slice(1).map((photo) => (
                    <figure key={photo.src}>
                      <img src={photo.src} alt={photo.alt} />
                      <figcaption>{photo.caption}</figcaption>
                    </figure>
                  ))}
                </div>
              )}

              <blockquote className={styles.founders}>
                <img src="/brand/founders/jose-rezende.jpg" alt="José Rezende" />
                <img src="/brand/founders/suzi-ninov.jpg" alt="Suzi Ninov" />
                <div><small>POR QUE ELE ESTÁ AQUI</small><p>“{story.founderNote}”</p><cite>José e Suzi · curadoria Bispo</cite></div>
              </blockquote>

              <figure className={styles.origin}>
                <img src="/brand/story/jose-origem.jpeg" alt="Seleção de café na origem pela Bispo" />
                <figcaption><small>DA ORIGEM À XÍCARA</small><b>Escolhido, provado e torrado para preservar sua identidade.</b></figcaption>
              </figure>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
