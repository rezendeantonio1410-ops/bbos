import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Search, UserRound } from "lucide-react";
import { AddToCartButton, CartButton, StorefrontCartProvider } from "../../StorefrontCart";
import { microlots } from "../../microlots";
import styles from "./microlot.module.css";

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return microlots.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const lot = microlots.find((item) => item.slug === slug);
  if (!lot) return {};
  return {
    title: `${lot.product.name} · ${lot.product.story.rareDetails?.producer} | Bispo Coffees`,
    description: lot.product.story.promise,
  };
}

export default async function MicrolotPage({ params }: PageProps) {
  const { slug } = await params;
  const lot = microlots.find((item) => item.slug === slug);
  if (!lot) notFound();

  const { product } = lot;
  const details = product.story.rareDetails;
  if (!details) notFound();
  const producerPhoto = details.gallery[0];
  const farmPhoto = details.gallery[1];
  if (!producerPhoto || !farmPhoto) notFound();
  const cartProduct = {
    id: "raros",
    name: product.name,
    line: product.line,
    notes: product.notes,
    priceCents: product.priceCents,
    weightGrams: product.weightGrams,
    image: product.image,
    story: product.story,
  };

  return (
    <StorefrontCartProvider>
      <main className={styles.page}>
        <div className={styles.commerceBar}>Frete grátis Sul + Sudeste em compras a partir de R$ 270</div>
        <header className={styles.header}>
          <Link href="/loja" className={styles.brand} aria-label="Bispo Coffees — loja">
            <Image src="/brand/logo/bispo-logo-official-transparent.png" width={176} height={58} alt="Bispo Coffees" priority />
          </Link>
          <nav aria-label="Navegação do microlote">
            <a href="#perfil">Perfil</a>
            <a href="#origem">Origem</a>
            <a href="#historia">História</a>
            <a href="#preparo">Preparo</a>
          </nav>
          <div className={styles.actions}>
            <Link href="/loja#cafes" aria-label="Buscar cafés"><Search /></Link>
            <Link href="/login" aria-label="Minha conta"><UserRound /></Link>
            <CartButton />
          </div>
        </header>

        <section className={styles.hero}>
          <div className={styles.visualColumn}>
            <Link href="/loja#camada-raros" className={styles.back}><ArrowLeft /> Voltar aos cafés</Link>
            <div className={styles.packageStage}>
              <span className={styles.edition}>EDIÇÃO LIMITADA</span>
              <div className={styles.packagePlaceholder} aria-label="Espaço reservado para a fotografia da embalagem do Raro">
                <small>EDIÇÃO LIMITADA</small>
                <span>BISPO</span>
                <b>Raro</b>
                <em>250 g</em>
              </div>
              <p>Espaço reservado para a fotografia oficial da embalagem.</p>
            </div>
            <div className={styles.heroPhotos}>
              <figure>
                <Image src={producerPhoto.src} alt={producerPhoto.alt} fill sizes="(max-width: 760px) 50vw, 18vw" />
                <figcaption>O produtor</figcaption>
              </figure>
              <figure>
                <Image src={farmPhoto.src} alt={farmPhoto.alt} fill sizes="(max-width: 760px) 50vw, 18vw" />
                <figcaption>A propriedade</figcaption>
              </figure>
            </div>
          </div>

          <div className={styles.purchaseColumn}>
            <p className={styles.eyebrow}>BISPO RAROS · {lot.harvest}</p>
            <h1>{product.name}</h1>
            <p className={styles.subtitle}>Carlos Alexandre Siqueira · São Jerônimo da Serra</p>
            <p className={styles.promise}>{product.story.promise}</p>
            <div className={styles.highlights}>
              <span><b>86,5</b> pontos</span>
              <span><b>990 m</b> altitude</span>
              <span><b>6 ha</b> propriedade</span>
            </div>
            <div className={styles.purchaseBox}>
              <div><strong>{product.price}</strong><span>{product.weight}</span></div>
              <p>Moagem e quantidade podem ser escolhidas na sacola.</p>
              <AddToCartButton product={cartProduct} className={styles.buy}>Adicionar à sacola →</AddToCartButton>
              <small>Torra própria · Poucas unidades nesta edição</small>
            </div>
          </div>
        </section>

        <nav className={styles.storyNav} aria-label="Conteúdo do lote">
          <a href="#perfil">A xícara</a>
          <a href="#origem">Rastreabilidade</a>
          <a href="#historia">Quem produz</a>
          <a href="#escolha">Escolha Bispo</a>
          <a href="#preparo">Como preparar</a>
        </nav>

        <section id="perfil" className={styles.sensorySection}>
          <div className={styles.sectionLead}>
            <small>PERFIL SENSORIAL</small>
            <h2>Uma xícara precisa, limpa e viva.</h2>
            <p>{product.story.sensoryDescription}</p>
          </div>
          <div className={styles.scorePanel}>
            <header><span>Avaliação completa</span><strong>86,5</strong></header>
            <div className={styles.scoreGrid}>
              {lot.fullScore.map((score) => (
                <div key={score.label}>
                  <span>{score.label}</span>
                  <i><b style={{ width: `${score.value * 10}%` }} /></i>
                  <strong>{String(score.value).replace(".", ",")}</strong>
                </div>
              ))}
            </div>
            <small>A pontuação registra tecnicamente a prova. O texto traduz como essa xícara se apresenta.</small>
          </div>
        </section>

        <section id="origem" className={styles.originSection}>
          <div className={styles.originImage}>
            <Image src={farmPhoto.src} alt={farmPhoto.alt} fill sizes="(max-width: 800px) 100vw, 50vw" />
          </div>
          <div className={styles.originCopy}>
            <small>RASTREABILIDADE</small>
            <h2>O lugar também está na xícara.</h2>
            <p>{lot.regionStory}</p>
            <dl>
              <div><dt>Produtor</dt><dd>{details.producer}</dd></div>
              <div><dt>Propriedade</dt><dd>{details.farm}</dd></div>
              <div><dt>Município</dt><dd>São Jerônimo da Serra · PR</dd></div>
              <div><dt>Região</dt><dd>Norte do Paraná</dd></div>
              <div><dt>Altitude</dt><dd>{details.altitude}</dd></div>
              <div><dt>Área</dt><dd>{details.area}</dd></div>
              <div className={styles.wide}><dt>Variedades cultivadas</dt><dd>{details.varieties}</dd></div>
            </dl>
            <span className={styles.location}><MapPin /> São Jerônimo da Serra · Paraná · Brasil</span>
          </div>
        </section>

        <section id="historia" className={styles.producerSection}>
          <div className={styles.producerCopy}>
            <small>A HISTÓRIA DE QUEM PRODUZ</small>
            <h2>Alexandre transformou herança em futuro.</h2>
            {details.history.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>
          <figure className={styles.producerPortrait}>
            <Image src={producerPhoto.src} alt={producerPhoto.alt} fill sizes="(max-width: 800px) 100vw, 42vw" />
            <figcaption><b>{details.producer}</b><span>{details.farm}</span></figcaption>
          </figure>
        </section>

        <section className={styles.farmWork}>
          <div>
            <small>TRABALHO NA PROPRIEDADE</small>
            <h2>Qualidade construída safra após safra.</h2>
          </div>
          <ol>
            {lot.farmWork.map((item, index) => <li key={item}><span>0{index + 1}</span>{item}</li>)}
          </ol>
        </section>

        <section id="escolha" className={styles.curatorship}>
          <div className={styles.founderPhotos}>
            <Image src="/brand/founders/jose-rezende.jpg" alt="José Rezende" width={180} height={240} />
            <Image src="/brand/founders/suzi-ninov.jpg" alt="Suzi Ninov" width={180} height={240} />
          </div>
          <div>
            <small>A ESCOLHA BISPO</small>
            <h2>Três anos de acompanhamento. Um pequeno lote escolhido.</h2>
            <blockquote>“{product.story.founderNote}”</blockquote>
            <p>José e Suzi · curadoria Bispo</p>
          </div>
        </section>

        <section className={styles.gallery} aria-label="Imagens da produção">
          {details.gallery.slice(1).map((photo) => (
            <figure key={photo.src}>
              <Image src={photo.src} alt={photo.alt} fill sizes="(max-width: 720px) 100vw, 33vw" />
              <figcaption>{photo.caption}</figcaption>
            </figure>
          ))}
        </section>

        <section id="preparo" className={styles.brewSection}>
          <div>
            <small>PARA PREPARAR</small>
            <h2>Comece simples. Depois ajuste ao seu gosto.</h2>
            <p>Este lote foi escolhido para mostrar clareza e evolução na xícara. Prefira preparos filtrados e prove também enquanto o café esfria.</p>
          </div>
          <dl>
            <div><dt>Método</dt><dd>V60, Chemex ou outro coado</dd></div>
            <div><dt>Proporção inicial</dt><dd>1 parte de café para 15–16 de água</dd></div>
            <div><dt>Água</dt><dd>Filtrada, logo abaixo da fervura</dd></div>
            <div><dt>Moagem</dt><dd>Média; ajuste pelo tempo e pela sua percepção</dd></div>
          </dl>
        </section>

        <footer className={styles.footer}>
          <Image src="/brand/logo/bispo-logo-official-transparent.png" width={150} height={50} alt="Bispo Coffees" />
          <p>Sourcing Brazilian Coffees for the World.</p>
          <Link href="/loja">Voltar à loja</Link>
        </footer>

        <div className={styles.stickyBuy}>
          <div><span>{product.name} · {product.weight}</span><strong>{product.price}</strong></div>
          <AddToCartButton product={cartProduct} className={styles.stickyButton}>Adicionar à sacola →</AddToCartButton>
        </div>
      </main>
    </StorefrontCartProvider>
  );
}
