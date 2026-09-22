"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { AddToCartButton, type StoreProduct } from "./StorefrontCart";
import styles from "./product-details.module.css";
import fixStyles from "./product-details-fix.module.css";

export type ProductStory = {
  promise: string;
  description: string;
  founderNote: string;
  bestFor: string;
  brew: string;
  sensory: { label: string; value: number }[];
};

type Props = {
  product: StoreProduct & {
    priceLabel: string;
    weightLabel: string;
    tag: string;
    tone: string;
  };
  story: ProductStory;
};

export default function ProductDetails({ product, story }: Props) {
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
      <button className={`${styles.open} ${fixStyles.open}`} type="button" onClick={() => setOpen(true)}>
        Conhecer este café →
      </button>
      {open && createPortal(
        <div className={styles.layer}>
          <button className={styles.backdrop} type="button" aria-label="Fechar detalhes" onClick={() => setOpen(false)} />
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby={`story-${product.id}`}>
            <header className={styles.header}>
              <span>LEITURA DO BISPO · {product.line}</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar detalhes"><X /></button>
            </header>

            <div className={styles.hero} style={{ "--tone": product.tone } as React.CSSProperties}>
              <div className={styles.productImage}>
                {product.image ? <img src={product.image} alt={`Embalagem do café ${product.name}`} /> : <div className={styles.fallback}>BISPO<br />{product.name}</div>}
              </div>
              <div className={styles.heroCopy}>
                <small>{product.tag}</small>
                <h2 id={`story-${product.id}`}>{product.name}</h2>
                <strong>{product.notes}</strong>
                <p>{story.promise}</p>
                <div className={styles.quickBuy}>
                  <span><b>{product.priceLabel}</b> · {product.weightLabel}</span>
                  <AddToCartButton product={product}>Comprar agora →</AddToCartButton>
                </div>
              </div>
            </div>

            <div className={styles.content}>
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
