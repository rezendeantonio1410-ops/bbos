import Image from "next/image";
import Link from "next/link";
import { Search, UserRound } from "lucide-react";
import styles from "./sales.module.css";
import tight from "./sales-tight.module.css";
import review from "./hero-review.module.css";
import journey from "./conversion-review.module.css";
import founder from "./founder-trust.module.css";
import layers from "./layers.module.css";
import brand from "./brand-review.module.css";
import ScrollToTopOnLoad from "./ScrollToTopOnLoad";
import SensoryConcierge from "./SensoryConcierge";
import EditorialHero from "./EditorialHero";
import ProductDetails, { type ProductStory } from "./ProductDetails";
import { loadStorefrontImages } from "@/lib/storefront-images";
import {
  AddToCartButton,
  CartButton,
  StorefrontCartProvider,
} from "./StorefrontCart";

const products = [
  {
    name: "Essencial",
    line: "GOURMET",
    notes: "Macio · Doce · Fácil",
    price: "R$ 52",
    priceCents: 5200,
    weight: "500 g",
    tone: "#E9BB00",
    image: "/brand/products/essencial-treated.webp",
    tag: "para todo dia",
    story: {
      promise: "Um café fácil de gostar: macio, doce e equilibrado para acompanhar a rotina sem cansar o paladar.",
      description: "A doçura aparece com delicadeza e o corpo é leve o bastante para mais de uma xícara. É uma escolha segura para quem está começando no café especial ou quer simplicidade bem-feita todos os dias.",
      founderNote: "Escolhemos o Essencial para ser aquela xícara honesta e confortável que funciona de manhã, à tarde e com diferentes preparos.",
      bestFor: "rotina, café da manhã e quem prefere uma xícara macia",
      brew: "coado, cafeteira elétrica ou prensa francesa",
      sensory: [{ label: "Doçura", value: 72 }, { label: "Corpo", value: 48 }, { label: "Frescor", value: 38 }, { label: "Intensidade", value: 44 }],
    } satisfies ProductStory,
  },
  {
    name: "Intenso",
    line: "GOURMET",
    notes: "Corpo · Presença · Limpeza",
    price: "R$ 52",
    priceCents: 5200,
    weight: "500 g",
    tone: "#E9BB00",
    image: "/brand/products/intenso-treated.webp",
    tag: "mais corpo",
    story: {
      promise: "Mais presença no primeiro gole, com corpo marcante e uma finalização limpa.",
      description: "É a escolha para quem associa uma boa xícara à intensidade. A sensação é mais encorpada e direta, mas sem deixar o sabor pesado ou confuso.",
      founderNote: "Aqui buscamos presença com limpeza. Ele entrega intensidade sem esconder a qualidade da xícara.",
      bestFor: "quem gosta de café forte, leite e manhãs de mais energia",
      brew: "espresso, moka italiana ou prensa francesa",
      sensory: [{ label: "Doçura", value: 55 }, { label: "Corpo", value: 86 }, { label: "Frescor", value: 34 }, { label: "Intensidade", value: 88 }],
    } satisfies ProductStory,
  },
  {
    name: "Caramelo",
    line: "CLÁSSICOS",
    notes: "Caramelo · Chocolate · Equilíbrio",
    price: "R$ 68",
    priceCents: 6800,
    weight: "500 g",
    tone: "#F96D01",
    image: "/brand/products/caramelo-treated.webp",
    tag: "conforto",
    story: {
      promise: "Doçura reconhecível, chocolate e equilíbrio: uma xícara acolhedora que convida ao próximo gole.",
      description: "O perfil lembra caramelo e chocolate sem precisar procurar demais. O corpo é redondo, a doçura permanece e o conjunto funciona tanto puro quanto acompanhado.",
      founderNote: "O Caramelo traduz muito do que acreditamos: sabor fácil de reconhecer, equilíbrio e vontade de repetir a xícara.",
      bestFor: "pausas confortáveis, receber pessoas e acompanhar doces",
      brew: "coado, espresso ou prensa francesa",
      sensory: [{ label: "Doçura", value: 88 }, { label: "Corpo", value: 70 }, { label: "Frescor", value: 42 }, { label: "Intensidade", value: 66 }],
    } satisfies ProductStory,
  },
  {
    name: "Doce de Leite",
    line: "CLÁSSICOS",
    notes: "Mascavo · Doce de leite · Alfajor",
    price: "R$ 68",
    priceCents: 6800,
    weight: "500 g",
    tone: "#F96D01",
    image: "/brand/products/doce-de-leite-treated.webp",
    tag: "doçura",
    story: {
      promise: "Uma xícara gulosa e macia, com lembranças de açúcar mascavo, doce de leite e alfajor.",
      description: "A experiência começa na doçura e termina com sensação cremosa e prolongada. É um café para quem procura conforto, mas quer um perfil com personalidade própria.",
      founderNote: "Este é o nosso convite para perceber que o café pode ser naturalmente doce e cheio de referências afetivas.",
      bestFor: "uma pausa especial, sobremesas e quem valoriza doçura",
      brew: "coado ou prensa francesa, valorizando textura e doçura",
      sensory: [{ label: "Doçura", value: 94 }, { label: "Corpo", value: 76 }, { label: "Frescor", value: 36 }, { label: "Intensidade", value: 64 }],
    } satisfies ProductStory,
  },
  {
    name: "Tangerina",
    line: "CLÁSSICOS",
    notes: "Cítrico · Doce · Fresco",
    price: "R$ 68",
    priceCents: 6800,
    weight: "500 g",
    tone: "#F96D01",
    image: null,
    tag: "frescor",
    story: {
      promise: "Cítrico, doce e fresco: um perfil luminoso para quem gosta de uma xícara viva.",
      description: "A lembrança de tangerina traz brilho sem perder a doçura. É uma porta de entrada acessível para sabores frutados e uma escolha especialmente agradável em preparos filtrados.",
      founderNote: "Queríamos um frutado claro e alegre, capaz de apresentar frescor sem transformar a xícara em algo difícil.",
      bestFor: "dias quentes, coados e quem quer explorar perfis frutados",
      brew: "coado ou preparo gelado",
      sensory: [{ label: "Doçura", value: 72 }, { label: "Corpo", value: 45 }, { label: "Frescor", value: 90 }, { label: "Intensidade", value: 58 }],
    } satisfies ProductStory,
  },
  {
    name: "Singular",
    line: "ÉPICOS",
    notes: "Frutado · Complexo · Evolutivo",
    price: "R$ 84",
    priceCents: 8400,
    weight: "500 g",
    tone: "#5C7D5F",
    image: "/brand/products/singular-treated.webp",
    tag: "descoberta",
    story: {
      promise: "Frutado, complexo e evolutivo: uma xícara que muda enquanto esfria e recompensa a atenção.",
      description: "Há mais camadas para perceber e novas sensações aparecem ao longo da xícara. É indicado para quem já gosta de café especial ou quer descobrir até onde uma origem bem trabalhada pode chegar.",
      founderNote: "O Singular fica na memória porque não entrega tudo de uma vez. É um café para provar com curiosidade.",
      bestFor: "degustação, presentes e momentos de descoberta",
      brew: "coado, com água e proporção controladas",
      sensory: [{ label: "Doçura", value: 78 }, { label: "Corpo", value: 58 }, { label: "Frescor", value: 84 }, { label: "Intensidade", value: 72 }],
    } satisfies ProductStory,
  },
  {
    name: "Sublime",
    line: "ÉPICOS",
    notes: "Rapadura · Caramelo · Doçura profunda",
    price: "R$ 84",
    priceCents: 8400,
    weight: "500 g",
    tone: "#5C7D5F",
    image: "/brand/products/sublime-treated.webp",
    tag: "experiência",
    story: {
      promise: "Rapadura, caramelo e doçura profunda em uma xícara longa, densa e contemplativa.",
      description: "O perfil combina doçura intensa e corpo envolvente, com final persistente. É uma experiência mais profunda para quem procura concentração de sabor sem abrir mão do equilíbrio.",
      founderNote: "O Sublime representa profundidade: uma doçura que ocupa a boca, permanece e ainda preserva elegância.",
      bestFor: "rituais sem pressa, presentes e quem busca profundidade",
      brew: "prensa francesa, espresso ou coado mais concentrado",
      sensory: [{ label: "Doçura", value: 92 }, { label: "Corpo", value: 88 }, { label: "Frescor", value: 40 }, { label: "Intensidade", value: 82 }],
    } satisfies ProductStory,
  },
  {
    name: "Raro",
    line: "RAROS",
    notes: "86,5 pontos · Origem única · Safra limitada",
    price: "R$ 52",
    priceCents: 5200,
    weight: "250 g",
    tone: "#8E2721",
    image: null,
    tag: "poucas unidades",
    story: {
      promise: "Um pequeno lote de Carlos Alexandre Siqueira, eleito por José e Suzi entre os cafés provados ao longo das últimas safras.",
      description: "Produzido a 990 metros no Sítio Nossa Senhora Aparecida, este lote alcançou 86,5 pontos. A combinação entre o solo mineral do Norte do Paraná, manejo cuidadoso e evolução técnica se revela em uma xícara limpa, equilibrada e de acidez viva.",
      sensoryDescription: "A avaliação registra acidez de 8,5, corpo e equilíbrio de 8,25 e sabor de 8,0. A doçura, a uniformidade e a limpeza alcançam a nota máxima, 10, formando uma xícara precisa, consistente e sem interferências. A finalização, avaliada em 7,75, sustenta a experiência após o gole; a fragrância, em 7,5, completa um conjunto de 86,5 pontos, marcado por densidade, elegância e clareza.",
      founderNote: "A Suzi acompanha o trabalho do Alexandre há três anos. José e Suzi provaram seus cafés ao longo das últimas safras e, para a safra atual, escolheram este pequeno lote como uma raridade Bispo.",
      bestFor: "degustar com atenção, presentear e conhecer a expressão do Norte do Paraná",
      brew: "coado, com água filtrada e preparo cuidadoso",
      sensory: [{ label: "Fragrância", value: 75 }, { label: "Acidez", value: 85 }, { label: "Corpo", value: 83 }, { label: "Equilíbrio", value: 83 }],
      rareDetails: {
        producer: "Carlos Alexandre Siqueira",
        farm: "Sítio Nossa Senhora Aparecida",
        place: "São Jerônimo da Serra · Norte do Paraná",
        altitude: "990 m",
        area: "6 hectares",
        score: "86,5 pontos",
        relationship: "A Suzi acompanha o trabalho do Alexandre há três anos. José e Suzi provaram seus cafés ao longo das últimas safras e, nesta safra, elegeram um pequeno lote pela qualidade e pela identidade encontrada na xícara.",
        history: [
          "Filho de cafeicultores, Alexandre cresceu entre os cafezais e sonhava em ter sua própria terra. Aos 22 anos, começou a trabalhar em parceria com produtores vizinhos, aprendendo cada etapa, do plantio à colheita. Em 2019, reuniu recursos para comprar as partes dos irmãos na propriedade do pai e realizar esse sonho.",
          "Desde então, vem renovando a pequena propriedade com variedades mais resilientes, manejo nutricional, adubação verde e mecanização. Ao lado de cooperativas e agrônomos, busca produzir melhor sem perder o respeito pela terra que atravessa gerações de sua família.",
        ],
        varieties: "Catuaí Amarelo, Catuaí Vermelho, IPR 107 e IPR 100",
        gallery: [
          { src: "/brand/products/raros/alexandre-produtor.webp", alt: "Carlos Alexandre Siqueira em seu cafezal", caption: "Carlos Alexandre · produtor" },
          { src: "/brand/products/raros/alexandre-lavoura.webp", alt: "Lavoura do Sítio Nossa Senhora Aparecida", caption: "Sítio Nossa Senhora Aparecida · 990 m" },
          { src: "/brand/products/raros/alexandre-colheita.webp", alt: "Cerejas maduras de café recém-colhidas", caption: "Colheita selecionada" },
          { src: "/brand/products/raros/alexandre-secagem.webp", alt: "Cerejas de café durante a secagem", caption: "Cuidado depois da colheita" },
        ],
      },
    } satisfies ProductStory,
  },
];
const collections = [
  {
    name: "Gourmet",
    eyebrow: "Para começar",
    copy: "Perfis macios e doces para a xícara de todos os dias.",
    tone: "#E9BB00",
  },
  {
    name: "Clássicos",
    eyebrow: "A linha de conforto",
    copy: "Doçura reconhecível, corpo e equilíbrio.",
    tone: "#F96D01",
  },
  {
    name: "Épicos",
    eyebrow: "Para explorar",
    copy: "Lotes de maior complexidade e leitura sensorial mais longa.",
    tone: "#5C7D5F",
  },
  {
    name: "Raros",
    eyebrow: "Edições limitadas",
    copy: "Microlotes selecionados em volumes pequenos e safras específicas.",
    tone: "#FF0000",
  },
] as const;

const collectionId = (name: string) =>
  `camada-${name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()}`;

export const dynamic = "force-dynamic";

export default async function LojaPage() {
  const storefrontImages = await loadStorefrontImages();
  const catalogProducts = products.map((product) => ({
    ...product,
    image: storefrontImages[product.name]?.primary ?? product.image,
  }));
  return (
    <StorefrontCartProvider>
      <main className={`${styles.page} ${brand.storefront}`}>
        <ScrollToTopOnLoad />
        <div className={styles.commerceBar}>
          <span>Frete grátis Sul + Sudeste em compras a partir de R$ 270</span>
          <a href="#cafes">Comprar cafés →</a>
        </div>
        <header className={`${styles.header} ${journey.header}`}>
          <a
            href="#top"
            className={styles.brand}
            aria-label="Bispo Coffees — início"
          >
            <Image
              src="/brand/logo/bispo-logo-official-transparent.png"
              width={176}
              height={58}
              alt="Bispo Coffees"
              priority
            />
          </a>
          <nav className={styles.nav} aria-label="Navegação principal">
            <a href="#cafes">Cafés</a>
            <a href="#camadas">Escolher</a>
            <Link href="/loja/descobrir">Descobrir o meu</Link>
            <Link href="/loja/sobre">Sobre a Bispo</Link>
          </nav>
          <div className={`${styles.actions} ${journey.actions}`}>
            <a
              className={journey.actionLink}
              href="#cafes"
              aria-label="Buscar cafés"
            >
              <Search aria-hidden="true" />
            </a>
            <Link
              className={journey.actionLink}
              href="/login"
              aria-label="Minha conta"
            >
              <UserRound aria-hidden="true" />
            </Link>
            <CartButton />
          </div>
        </header>

        <EditorialHero productImages={storefrontImages} />

        <section id="camadas" className={layers.section}>
          <div className={layers.intro}>
            <div>
              <small>OS CAMINHOS DO BISPO</small>
              <h2>Quatro camadas. Escolha o seu momento.</h2>
            </div>
            <p>
              Do cotidiano aos microlotes, compare os perfis e escolha com
              clareza.
            </p>
          </div>
          <div className={layers.grid}>
            {collections.map((collection, index) => (
              <a
                key={collection.name}
                href={`#${collectionId(collection.name)}`}
                className={layers.card}
                style={
                  { "--layer-tone": collection.tone } as React.CSSProperties
                }
              >
                <span className={layers.number}>0{index + 1}</span>
                <i />
                <strong>{collection.name}</strong>
                <p>{collection.copy}</p>
              </a>
            ))}
          </div>
        </section>

        <section
          className={brand.editorialBridge}
          aria-label="A experiência Bispo"
        >
          <article
            className={brand.editorialLead}
            data-photo-slot="sectional-origin-new-photo"
          >
            <Image
              src="/brand/story/jose-origem.jpeg"
              alt="A leitura da origem pela Bispo Coffees"
              fill
              sizes="(max-width: 800px) 100vw, 58vw"
            />
            <div>
              <small>DA ORIGEM À XÍCARA</small>
              <h2>O café começa muito antes do primeiro gole.</h2>
              <p>
                Relação, prova e escolha. Cada lote chega com uma história que
                José e Suzi fazem questão de preservar.
              </p>
            </div>
          </article>
          <aside
            className={brand.photoManifest}
            data-photo-slot="sectional-ritual-new-photo"
          >
            <span>SELEÇÃO BISPO</span>
            <strong>Da origem, à torra, à xícara.</strong>
            <p>
              Cada lote é escolhido por José e Suzi, torrado pela Bispo e
              apresentado pelo seu perfil sensorial.
            </p>
          </aside>
        </section>

        <section
          id="cafes"
          className={`${styles.productsSection} ${journey.productsSection}`}
        >
          <div className={styles.sectionHeader}>
            <div>
              <small>ESCOLHA O SEU CAFÉ</small>
              <h2>Escolha pelo perfil.</h2>
            </div>
            <p>
              Compare os perfis, escolha a moagem e compre. Se preferir, o Bispo
              ajuda você a encontrar a xícara certa.
            </p>
          </div>
          <nav className={layers.filter} aria-label="Camadas dos cafés">
            {collections.map((collection) => (
              <a
                key={collection.name}
                href={`#${collectionId(collection.name)}`}
              >
                {collection.name}
              </a>
            ))}
          </nav>
          {collections.map((collection) => {
            const collectionProducts = catalogProducts.filter(
              (product) => product.line === collection.name.toUpperCase(),
            );

            return (
              <div
                key={collection.name}
                id={collectionId(collection.name)}
                className={layers.catalogLayer}
                style={
                  { "--layer-tone": collection.tone } as React.CSSProperties
                }
              >
                <header className={layers.catalogHeader}>
                  <div>
                    <small>{collection.eyebrow}</small>
                    <h3>{collection.name}</h3>
                  </div>
                  <p>{collection.copy}</p>
                </header>
                {collectionProducts.length ? (
                  <div
                    className={`${styles.productGrid} ${
                      collectionProducts.length === 1
                        ? layers.oneProduct
                        : collectionProducts.length === 2
                          ? layers.twoProducts
                          : ""
                    }`}
                  >
                    {collectionProducts.map((p) => (
                      <article
                        key={p.name}
                        id={p.name.toLowerCase().replaceAll(" ", "-")}
                        className={`${styles.productCard} ${journey.productCard}`}
                        style={{ "--tone": p.tone } as React.CSSProperties}
                      >
                        <div
                          className={styles.productVisual}
                          data-photo-slot={`product-${p.name.toLowerCase().replaceAll(" ", "-")}`}
                        >
                          {p.image ? (
                            <img
                              src={p.image}
                              alt={`Embalagem Bispo ${p.name}`}
                              className={`${styles.productPhoto} ${review.editorialProductPhoto}`}
                            />
                          ) : p.name === "Raro" ? (
                            <div className={layers.rarePackagePlaceholder} aria-label="Espaço reservado para a embalagem do café Raro">
                              <small>EDIÇÃO LIMITADA</small>
                              <span>BISPO</span>
                              <b>Raro</b>
                              <em>250 g</em>
                            </div>
                          ) : (
                            <div className={tight.catalogFallback}>
                              <span>BISPO</span>
                              <b>{p.name}</b>
                              <small>NOVA COLHEITA · EM BREVE</small>
                            </div>
                          )}
                          <small>{p.tag}</small>
                        </div>
                        <div className={styles.productMeta}>
                          <p>{p.line}</p>
                          <h3>{p.name}</h3>
                          <span>{p.notes}</span>
                          <ProductDetails
                            product={{
                              id: p.name === "Raro" ? "raros" : p.name.toLowerCase().replaceAll(" ", "-"),
                              name: p.name,
                              line: p.line,
                              notes: p.notes,
                              priceCents: p.priceCents,
                              weightGrams: Number.parseInt(p.weight, 10),
                              image: p.image,
                              priceLabel: p.price,
                              weightLabel: p.weight,
                              tag: p.tag,
                              tone: p.tone,
                            }}
                            story={p.story}
                          />
                          <div className={styles.buyRow}>
                            <strong>
                              {p.price} <small>· {p.weight}</small>
                            </strong>
                            <AddToCartButton
                              product={{
                                id: p.name === "Raro" ? "raros" : p.name.toLowerCase().replaceAll(" ", "-"),
                                name: p.name,
                                line: p.line,
                                notes: p.notes,
                                priceCents: p.priceCents,
                                weightGrams: Number.parseInt(p.weight, 10),
                                image: p.image,
                                story: p.story,
                              }}
                            >
                              Quero esse →
                            </AddToCartButton>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className={layers.rareNote}>
                    <span>EDIÇÕES LIMITADAS · 250 G</span>
                    <strong>
                      Os Raros aparecem quando a safra revela algo
                      extraordinário.
                    </strong>
                    <Link href="/loja/descobrir">Descobrir meu perfil →</Link>
                  </div>
                )}
              </div>
            );
          })}
          <div className={styles.allProducts}>
            <a href="#camadas">Voltar às quatro camadas ↑</a>
            <Link href="/loja/descobrir">
              Não sabe qual escolher? Descubra o seu →
            </Link>
          </div>
        </section>

        <section
          className={founder.section}
          data-photo-slot="founders-jose-suzi"
        >
          <div className={founder.photos}>
            <figure className={founder.portrait}>
              <img
                src="/brand/founders/jose-rezende.jpg"
                alt="José Rezende avaliando um café"
              />
              <figcaption>JOSÉ · ORIGEM E PROVA</figcaption>
            </figure>
            <figure className={founder.portrait}>
              <img
                src="/brand/founders/suzi-ninov.jpg"
                alt="Suzi Ninov avaliando um café"
              />
              <figcaption>SUZI · CRITÉRIO E CUIDADO</figcaption>
            </figure>
          </div>
          <div
            className={`${tight.foundersCopy} ${journey.foundersCopy} ${founder.copy}`}
          >
            <small>QUEM ESCOLHE O SEU CAFÉ</small>
            <h2>
              Antes da sua xícara,
              <br />
              <em>cada café passa por nós.</em>
            </h2>
            <p className={founder.intro}>
              José e Suzi trazem duas histórias próprias no café, unidas para
              escolher, provar e preservar a identidade de cada xícara.
            </p>
            <div className={founder.proofs}>
              <p>
                <b>José Rezende</b>
                <br />
                Origem, prova e mercados construídos ao lado de produtores desde
                2003.
              </p>
              <p>
                <b>Suzi Ninov</b>
                <br />
                Cofundadora, com trajetória própria no café, visão de produção,
                sustentabilidade e o cuidado que preserva cada escolha.
              </p>
            </div>
            <p className={founder.sharedStory}>
              Parceiros de vida e de projeto, constroem juntos a Bispo — do
              campo brasileiro aos mercados do mundo, e de volta à sua xícara.
            </p>
            <div className={founder.trust} aria-label="Critérios Bispo">
              <span>Provado por nós</span>
              <span>Torra própria</span>
              <span>Brasil e Europa</span>
            </div>
            <div className={founder.actions}>
              <a className={founder.primary} href="#cafes">
                Ver os cafés escolhidos →
              </a>
              <Link className={founder.secondary} href="/loja/sobre">
                Conhecer nossa história
              </Link>
            </div>
          </div>
        </section>

        <SensoryConcierge />

        <section className={styles.valueStrip}>
          <span>Perfis claros.</span>
          <span>Torra própria.</span>
          <span>Constância de xícara.</span>
          <span>Frete grátis Sul + Sudeste · R$ 270+</span>
        </section>
        <footer className={styles.footer}>
          <div className={styles.footerBrand}>
            <Image
              src="/brand/logo/bispo-logo-official-transparent.png"
              width={150}
              height={50}
              alt="Bispo Coffees"
              className={journey.footerLogo}
            />
            <p>Sourcing Brazilian Coffees for the World.</p>
          </div>
          <div className={styles.footerNav}>
            <strong>Explorar</strong>
            <Link href="/loja/descobrir">Descubra o seu café</Link>
            <Link href="/loja/sobre">Sobre a Bispo</Link>
          </div>
          <div className={styles.footerNav}>
            <strong>Comprar</strong>
            <a href="#cafes">Todos os cafés</a>
            <a href="#camadas">Escolher por sensação</a>
          </div>
          <div className={styles.footerBottom}>
            <span>Bispo Coffees · Brasil</span>
            <Link href="/bbos">Área interna</Link>
          </div>
        </footer>
      </main>
    </StorefrontCartProvider>
  );
}
