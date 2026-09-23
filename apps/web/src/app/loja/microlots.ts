import type { ProductStory } from "./ProductDetails";

export type Microlot = {
  slug: string;
  harvest: string;
  product: {
    name: string;
    line: string;
    notes: string;
    price: string;
    priceCents: number;
    weight: string;
    weightGrams: number;
    tone: string;
    image: string | null;
    tag: string;
    story: ProductStory;
  };
  fullScore: { label: string; value: number }[];
  regionStory: string;
  farmWork: string[];
};

export const alexandreMicrolot: Microlot = {
  slug: "carlos-alexandre-safra-2026",
  harvest: "Safra atual · edição limitada",
  product: {
    name: "Raro",
    line: "RAROS",
    notes: "86,5 pontos · Origem única · Safra limitada",
    price: "R$ 52",
    priceCents: 5200,
    weight: "250 g",
    weightGrams: 250,
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
      sensory: [
        { label: "Fragrância", value: 75 },
        { label: "Acidez", value: 85 },
        { label: "Corpo", value: 83 },
        { label: "Equilíbrio", value: 83 },
      ],
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
    },
  },
  fullScore: [
    { label: "Fragrância", value: 7.5 },
    { label: "Sabor", value: 8 },
    { label: "Finalização", value: 7.75 },
    { label: "Acidez", value: 8.5 },
    { label: "Corpo", value: 8.25 },
    { label: "Equilíbrio", value: 8.25 },
    { label: "Geral", value: 8.25 },
    { label: "Doçura", value: 10 },
    { label: "Uniformidade", value: 10 },
    { label: "Xícara limpa", value: 10 },
  ],
  regionStory: "O Norte do Paraná reúne solos de origem vulcânica, ricos em minerais. Quando esse potencial encontra nutrição equilibrada, acompanhamento técnico e cuidado na propriedade, surgem cafés densos, elegantes e com acidez viva.",
  farmWork: [
    "Renovação dos cafezais com variedades modernas e mais resilientes.",
    "Manejo nutricional e adubação verde para fortalecer solo e plantas.",
    "Mecanização e acompanhamento de cooperativas e profissionais de agronomia.",
    "Busca contínua por mais qualidade de xícara e renda estável para a família.",
  ],
};

export const microlots = [alexandreMicrolot];

