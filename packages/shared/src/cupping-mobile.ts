export const CUPPING_SCORE_MIN = 6;
export const CUPPING_SCORE_MAX = 10;
export const CUPPING_SCORE_STEP = 0.25;
export const CUPPING_ATTRIBUTES = [
  "fragranceAroma",
  "flavor",
  "aftertaste",
  "acidity",
  "body",
  "balance",
  "uniformity",
  "sweetness",
  "cleanCup",
  "overall",
] as const;
export type CuppingAttribute = (typeof CUPPING_ATTRIBUTES)[number];

export function isValidCuppingScore(value: unknown) {
  const score = Number(value);
  return (
    Number.isFinite(score) &&
    score >= 6 &&
    score <= 10 &&
    Number.isInteger(score * 4)
  );
}
export const canContinueSensoryStep = (score: unknown) =>
  isValidCuppingScore(score);
export function cupsScore(cups: boolean[]) {
  if (cups.length !== 5)
    throw new Error("Cada atributo deve possuir exatamente cinco xícaras.");
  return cups.filter(Boolean).length * 2;
}
export function validateCleanCup(
  cups: Array<{
    selected: boolean;
    defectType?: string;
    defectSeverity?: "TAINT" | "FAULT";
    defectDescription?: string;
  }>,
) {
  if (cups.length !== 5) return false;
  return cups.every(
    (cup) =>
      cup.selected ||
      Boolean(
        cup.defectType &&
        cup.defectSeverity &&
        (cup.defectType !== "Outro" || cup.defectDescription?.trim()),
      ),
  );
}
export function validateCleanCupState(
  score: number,
  cups: Array<{
    selected: boolean;
    defectType?: string;
    defectSeverity?: "TAINT" | "FAULT";
    defectDescription?: string;
  }>,
) {
  if (score === 10 && cups.length === 0) return true;
  if (cups.length !== 5) return false;
  return (
    cupsScore(cups.map((cup) => cup.selected)) === score &&
    validateCleanCup(cups)
  );
}
export function totalCuppingScore(values: Record<CuppingAttribute, number>) {
  if (
    ![
      "fragranceAroma",
      "flavor",
      "aftertaste",
      "acidity",
      "body",
      "balance",
      "overall",
    ].every((key) => isValidCuppingScore(values[key as CuppingAttribute]))
  )
    throw new Error("Pontuação técnica inválida.");
  if (
    ![values.uniformity, values.sweetness, values.cleanCup].every(
      (value) =>
        Number.isInteger(value) && value >= 0 && value <= 10 && value % 2 === 0,
    )
  )
    throw new Error("Pontuação de xícaras inválida.");
  return Number(
    CUPPING_ATTRIBUTES.reduce((sum, key) => sum + values[key], 0).toFixed(2),
  );
}
export function invitationState(
  input: { expiresAt: Date; revokedAt?: Date | null; participantId: string },
  requestedParticipantId: string,
  now = new Date(),
) {
  if (input.revokedAt) return "REVOKED" as const;
  if (input.expiresAt <= now) return "EXPIRED" as const;
  if (input.participantId !== requestedParticipantId)
    return "FORBIDDEN" as const;
  return "VALID" as const;
}
export const canEditCuppingEvaluation = (status: string) =>
  status !== "COMPLETED";
export const canReopenCuppingEvaluation = (
  role: string,
  sameCompany: boolean,
) => sameCompany && ["ADMIN", "INDUSTRIAL"].includes(role);

export type SensoryDescriptor = {
  name: string;
  imageKey: string;
  color?: string;
  assetPath?: string;
  sensoryHint?: string;
  officialHint?: string;
  trainingDescription?: string;
};
export type SensorySubfamily = {
  name: string;
  imageKey: string;
  color?: string;
  assetPath?: string;
  descriptors: SensoryDescriptor[];
};
export type SensoryFamily = {
  name: string;
  imageKey: string;
  color: string;
  subfamilies: SensorySubfamily[];
};
export type SensorySelectionIdentity = {
  context: string;
  family: string;
  subfamily?: string;
  descriptor?: string;
};
export type OlfactoryMoment = "FRAGRANCE" | "AROMA";
export type OlfactoryStageSelection = SensorySelectionIdentity & {
  context: OlfactoryMoment;
  intensity: number;
  level: number;
  imageKey?: string;
};
export function olfactorySelectionsFromStage(
  stageData: Record<string, unknown>,
  moment: OlfactoryMoment,
) {
  const key = moment === "FRAGRANCE" ? "fragranceSelections" : "aromaSelections";
  const value = stageData[key];
  return Array.isArray(value) ? (value as OlfactoryStageSelection[]) : [];
}
export function withOlfactorySelections(
  stageData: Record<string, unknown>,
  moment: OlfactoryMoment,
  selections: OlfactoryStageSelection[],
) {
  const key = moment === "FRAGRANCE" ? "fragranceSelections" : "aromaSelections";
  return { ...stageData, [key]: selections };
}
export function toggleSensorySelection<T extends SensorySelectionIdentity>(
  selections: T[],
  selection: T,
) {
  const matches = (item: T) =>
    item.context === selection.context &&
    item.family === selection.family &&
    item.subfamily === selection.subfamily &&
    item.descriptor === selection.descriptor;
  return selections.some(matches)
    ? selections.filter((item) => !matches(item))
    : [...selections, selection];
}
const flavorDescriptorPresentation: Record<
  string,
  Pick<SensoryDescriptor, "assetPath" | "sensoryHint">
> = {
  Morango: {
    assetPath: "/sensory/descriptors/flavor/red-fruits/morango.webp",
    sensoryHint: "maduro · suculento · doce",
  },
  Framboesa: {
    assetPath: "/sensory/descriptors/flavor/red-fruits/framboesa.webp",
    sensoryHint: "frutada · fresca · delicadamente ácida",
  },
  Cereja: {
    assetPath: "/sensory/descriptors/flavor/red-fruits/cereja.webp",
    sensoryHint: "doce · brilhante · carnuda",
  },
  Amora: {
    assetPath: "/sensory/descriptors/flavor/red-fruits/amora.webp",
    sensoryHint: "escura · madura · intensa",
  },
};
const names = (
  items: string,
  prefix: string,
  color?: string,
): SensoryDescriptor[] =>
  items.split("|").map((name) => ({
    name,
    imageKey: `${prefix}-${name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")}`,
    trainingDescription: `Explore a memória sensorial de ${name.toLowerCase()}.`,
    color,
    ...flavorDescriptorPresentation[name],
  }));
const sub = (
  name: string,
  list: string,
  key: string,
  color?: string,
): SensorySubfamily => ({
  name,
  imageKey: key,
  color,
  descriptors: names(list, key, color),
});

export const sensoryLibrary: SensoryFamily[] = [
  {
    name: "Floral",
    imageKey: "floral",
    color: "#d978b5",
    subfamilies: [
      sub(
        "Flores brancas",
        "Jasmim|Flor de laranjeira|Madressilva|Flor de café",
        "flores-brancas",
      ),
      sub("Flores perfumadas", "Rosa|Violeta|Lavanda", "flores-perfumadas"),
      sub("Flores suaves", "Camomila", "flores-suaves"),
      sub("Chás/Infusões", "Chá preto|Chá verde|Earl Grey", "chas"),
    ],
  },
  {
    name: "Frutado",
    imageKey: "frutado",
    color: "#ef6f78",
    subfamilies: [
      sub("Cítricos", "Laranja|Lima|Limão|Tangerina|Grapefruit", "citricos", "#f2b632"),
      sub("Tropicais", "Abacaxi|Kiwi|Maracujá|Mamão|Banana", "tropicais", "#e3a522"),
      sub(
        "Frutas amarelas",
        "Manga|Melão|Pêssego|Carambola|Damasco",
        "frutas-amarelas", "#efbd78",
      ),
      sub(
        "Frutas vermelhas",
        "Morango|Cereja|Framboesa|Amora",
        "frutas-vermelhas", "#cf405e",
      ),
      sub(
        "Frutas escuras/roxas",
        "Mirtilo|Uva|Ameixa|Groselha-preta",
        "frutas-escuras", "#704264",
      ),
      sub("Frutas frescas", "Maçã verde|Maçã vermelha|Pera", "frutas-frescas", "#91ad69"),
      sub(
        "Frutas secas",
        "Uva-passa|Ameixa seca|Figo seco|Tâmara",
        "frutas-secas", "#8d5344",
      ),
    ],
  },
  {
    name: "Vegetal",
    imageKey: "vegetal",
    color: "#76aa68",
    subfamilies: [
      sub("Verde/Fresco", "Grama cortada|Folha verde|Broto vegetal", "verde"),
      sub("Herbal", "Ervas frescas|Hortelã|Alecrim|Manjericão", "herbal"),
      sub("Seco", "Feno|Palha|Folha seca", "vegetal-seco"),
      sub("Leguminoso", "Ervilha fresca|Vagem|Feijão verde", "leguminoso"),
      sub("Amadeirado", "Madeira seca|Cedro", "amadeirado"),
    ],
  },
  {
    name: "Doce",
    imageKey: "doce",
    color: "#e8ae54",
    subfamilies: [
      sub("Mel", "Mel floral|Mel silvestre", "mel"),
      sub("Baunilha", "Baunilha / Fava de baunilha", "baunilha"),
      sub("Açúcar", "Açúcar mascavo", "acucar"),
      sub("Cana/Rapadura", "Cana-de-açúcar|Rapadura|Caldo de cana", "cana"),
      sub("Maltado", "Malte|Cereal maltado", "malte"),
    ],
  },
  {
    name: "Caramelizado",
    imageKey: "caramelizado",
    color: "#cf8545",
    subfamilies: [
      sub("Caramelo", "Caramelo claro|Caramelo intenso", "caramelo"),
      sub("Confeitaria", "Toffee|Doce de leite", "confeitaria"),
      sub("Melaço", "Melaço", "melaco"),
      sub("Açúcar tostado", "Açúcar queimado", "acucar-tostado"),
    ],
  },
  {
    name: "Cacau / Nozes",
    imageKey: "cacau-nozes",
    color: "#8f624c",
    subfamilies: [
      sub(
        "Cacau",
        "Cacau seco|Nibs de cacau|Chocolate ao leite|Chocolate amargo",
        "cacau",
      ),
      sub(
        "Nozes/Castanhas",
        "Avelã|Amêndoa|Amendoim|Noz|Castanha-do-pará|Castanha de caju",
        "nozes",
      ),
    ],
  },
  {
    name: "Especiarias",
    imageKey: "especiarias",
    color: "#d46742",
    subfamilies: [
      sub("Doces", "Canela|Cravo|Noz-moscada", "especiarias-doces"),
      sub("Aromáticas", "Cardamomo|Anis-estrelado", "especiarias-aromaticas"),
      sub("Picantes", "Pimenta-preta|Pimenta-branca|Gengibre", "picantes"),
    ],
  },
  {
    name: "Defeitos aromáticos",
    imageKey: "defeitos",
    color: "#667070",
    subfamilies: [
      sub(
        "Fermentado indesejado",
        "Vinagre|Álcool excessivo|Fermentação excessiva",
        "fermentado",
      ),
      sub("Mofo/Umidade", "Mofo|Bolor|Porão úmido", "mofo"),
      sub("Terroso", "Terra úmida|Terra seca", "terroso"),
      sub("Químico/Medicinal", "Medicinal|Fenólico|Solvente", "quimico"),
      sub("Papel/Madeira", "Papelão|Papel|Madeira seca", "papel"),
      sub("Queimado/Fumaça", "Cinza|Carbonizado|Fumaça", "queimado"),
      sub("Borracha/Petróleo", "Borracha|Petróleo", "borracha"),
      sub(
        "Animal/Orgânico",
        "Couro|Animal|Matéria orgânica degradada",
        "animal",
      ),
    ],
  },
];

const olfactoryAssets: Record<string, string> = {
  Limão: "/sensory/aroma/frutado/citricos/limao.webp",
  Lima: "/sensory/aroma/frutado/citricos/lima.webp",
  Tangerina: "/sensory/aroma/frutado/citricos/tangerina.webp",
  Bergamota: "/sensory/aroma/frutado/citricos/bergamota.webp",
  Morango: "/sensory/aroma/frutado/frutas-vermelhas/morango.webp",
  Framboesa: "/sensory/aroma/frutado/frutas-vermelhas/framboesa.webp",
  Cereja: "/sensory/aroma/frutado/frutas-vermelhas/cereja.webp",
  "Flor de café": "/sensory/aroma/floral/flores-brancas/flor-de-cafe.webp",
  Jasmim: "/sensory/aroma/floral/flores-brancas/jasmim.webp",
  "Flor de laranjeira": "/sensory/aroma/floral/flores-brancas/flor-de-laranjeira.webp",
  Caramelo: "/sensory/aroma/doce/acucares-caramelizados/caramelo.webp",
  Mel: "/sensory/aroma/doce/acucares-caramelizados/mel.webp",
  "Avelã torrada": "/sensory/aroma/tostado/nozes/avela-torrada.webp",
  "Chocolate amargo": "/sensory/aroma/tostado/cacau-chocolate/chocolate-amargo.webp",
};
const olfactorySub = (name: string, list: string, key: string, color: string) => {
  const result = sub(name, list, `olfactory-${key}`, color);
  result.descriptors = result.descriptors.map((descriptor) => ({
    ...descriptor,
    assetPath: olfactoryAssets[descriptor.name],
  }));
  result.assetPath = result.descriptors.find((descriptor) => descriptor.assetPath)?.assetPath;
  return result;
};

// Taxonomia BBOS olfativa: independente da árvore gustativa de Sabor.
export const olfactoryLibrary: SensoryFamily[] = [
  { name: "Frutado", imageKey: "olfactory-frutado", color: "#df5c55", subfamilies: [
    olfactorySub("Cítricos", "Limão|Lima|Tangerina|Bergamota", "citricos", "#e8b52d"),
    olfactorySub("Frutas vermelhas", "Morango|Framboesa|Cereja|Groselha vermelha", "frutas-vermelhas", "#ce4056"),
    olfactorySub("Frutas escuras", "Groselha preta|Amora|Mirtilo|Ameixa", "frutas-escuras", "#673b62"),
    olfactorySub("Frutas amarelas", "Pêssego|Damasco|Nectarina", "frutas-amarelas", "#efbd78"),
    olfactorySub("Tropicais", "Manga|Abacaxi|Maracujá|Mamão", "tropicais", "#dda526"),
    olfactorySub("Frutas de pomar", "Maçã|Pera", "pomar", "#91aa66"),
    olfactorySub("Frutas secas", "Uva-passa|Figo seco|Ameixa seca", "frutas-secas", "#885142"),
  ]},
  { name: "Floral", imageKey: "olfactory-floral", color: "#c66aa8", subfamilies: [
    olfactorySub("Flores brancas", "Flor de café|Jasmim|Flor de laranjeira|Madressilva", "flores-brancas", "#d889bb"),
    olfactorySub("Flores perfumadas", "Rosa|Violeta|Lavanda", "flores-perfumadas", "#a86aa4"),
  ]},
  { name: "Tostado", imageKey: "olfactory-tostado", color: "#79503e", subfamilies: [
    olfactorySub("Frutos secos / Nozes", "Avelã torrada|Amêndoa torrada|Noz", "nozes", "#a27752"),
    olfactorySub("Cacau / Chocolate", "Cacau|Chocolate amargo|Chocolate ao leite", "cacau", "#74452f"),
    olfactorySub("Cereais / Torra", "Malte|Pão torrado|Café torrado", "cereais", "#9d6b3d"),
  ]},
  { name: "Doce", imageKey: "olfactory-doce", color: "#d69938", subfamilies: [
    olfactorySub("Açúcares caramelizados", "Caramelo|Açúcar mascavo|Mel", "acucares", "#c7822e"),
    olfactorySub("Confeitaria", "Baunilha|Doce de leite|Toffee", "confeitaria", "#dfad65"),
  ]},
  { name: "Especiarias", imageKey: "olfactory-especiarias", color: "#b95f3d", subfamilies: [
    olfactorySub("Picantes", "Pimenta-preta|Pimenta-branca", "picantes", "#8e4937"),
    olfactorySub("Especiarias aromáticas", "Cravo", "aromaticas", "#b96a42"),
  ]},
  { name: "Vegetal", imageKey: "olfactory-vegetal", color: "#71975e", subfamilies: [
    olfactorySub("Verde / Fresco", "Grama fresca", "verde", "#78a65f"),
    olfactorySub("Vegetais verdes", "Pimentão verde", "vegetais", "#58844e"),
  ]},
  { name: "Terroso / Outras referências", imageKey: "olfactory-terroso", color: "#6f6a5a", subfamilies: [
    olfactorySub("Terroso", "Terra|Mofo", "terroso", "#77644c"),
    olfactorySub("Animal", "Couro", "animal", "#805d49"),
    olfactorySub("Lácteo", "Manteiga", "lacteo", "#d5bd75"),
  ]},
];
export const aftertastePersistenceOptions = [
  "Curta",
  "Média",
  "Longa",
  "Muito longa",
] as const;
export const aftertasteCharacterOptions = [
  "Limpa",
  "Doce",
  "Frutada",
  "Seca",
  "Adstringente",
  "Outro",
] as const;
export const acidityReferences = [
  "Cítrica",
  "Málica",
  "Tartárica",
  "Láctica",
  "Fosfórica",
  "Acética",
  "Outra",
] as const;
export const acidityQualityOptions = ["Baixa", "Média", "Alta"] as const;
export const bodyWeightOptions = [
  "Muito leve",
  "Leve",
  "Médio",
  "Encorpado",
  "Muito encorpado",
] as const;
export const bodyTextureOptions = [
  "Sedoso",
  "Cremoso",
  "Aveludado",
  "Suave",
  "Denso",
] as const;
export const usesGeneralSensoryLibrary = (step: string) =>
  step === "aroma" || step === "sabor";
export function toggleAcidityType(selected: string[], type: string) {
  return selected.includes(type)
    ? selected.filter((item) => item !== type)
    : [...selected, type];
}
export function buildAcidityPersistence(types: string[], quality?: string) {
  return {
    acidityType: types.join(" + ") || undefined,
    acidityTypes: [...types],
    acidityQuality: quality,
  };
}
export function selectBodyWeight(weight: string) {
  return weight;
}
export function toggleBodyTexture(selected: string[], texture: string) {
  return selected.includes(texture)
    ? selected.filter((item) => item !== texture)
    : [...selected, texture];
}
export function buildBodyPersistence(
  weight: string | undefined,
  textures: string[],
) {
  return {
    bodyWeight: weight,
    bodyType: textures.join(" + ") || undefined,
    bodyTextures: [...textures],
  };
}
export type CuppingSensorySelection = {
  context: string;
  family: string;
  subfamily?: string;
  descriptor?: string;
};
export type CuppingSensoryProfileGroup = {
  label: string;
  values: string[];
};
export function deriveCuppingSensoryProfile(input: {
  selections?: CuppingSensorySelection[];
  acidityTypes?: string[];
  bodyTextures?: string[];
  aftertastePersistence?: string;
  aftertasteCharacter?: string;
}) {
  const paths = (input.selections ?? []).map((selection) =>
    [selection.family, selection.subfamily, selection.descriptor]
      .filter(Boolean)
      .join(" › "),
  );
  const groups: CuppingSensoryProfileGroup[] = [
    { label: "Percepções", values: [...new Set(paths)] },
    { label: "Acidez", values: [...new Set(input.acidityTypes ?? [])] },
    { label: "Corpo", values: [...new Set(input.bodyTextures ?? [])] },
    {
      label: "Finalização",
      values: [input.aftertastePersistence, input.aftertasteCharacter].filter(
        (value): value is string => Boolean(value),
      ),
    },
  ];
  return groups.filter((group) => group.values.length > 0);
}
export function sensoryVisualKey(imageKey: string) {
  let hash = 0;
  for (const character of imageKey)
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return `${imageKey}:${hash % 7}`;
}
export const priorScoresInitiallyExpanded = false;
export function createFiveCupStates() {
  return Array.from({ length: 5 }, (_, index) => ({
    cupNumber: index + 1,
    selected: true,
  }));
}
const reviewDefinitions = [
  ["fragranceAroma", "Fragrância / Aroma", "aroma"],
  ["flavor", "Sabor", "sabor"],
  ["aftertaste", "Finalização", "finalizacao"],
  ["acidity", "Acidez", "acidez"],
  ["body", "Corpo", "corpo"],
  ["balance", "Equilíbrio", "equilibrio"],
  ["uniformity", "Uniformidade", "cups"],
  ["sweetness", "Doçura", "cups"],
  ["cleanCup", "Xícara limpa", "cups"],
  ["overall", "Avaliação geral", "overall"],
] as const;
export function cuppingReviewIssues(
  scores: Partial<Record<CuppingAttribute, number>>,
  cleanCupValid: boolean,
  invalidCleanCupNumbers: number[] = [],
) {
  const issues = reviewDefinitions
    .filter(([key]) => scores[key] == null)
    .map(([key, label, route]) => ({
      key,
      label,
      route,
      message: "Pontuação técnica não informada",
    }));
  if (!cleanCupValid && !issues.some((issue) => issue.key === "cleanCup"))
    issues.push({
      key: "cleanCup",
      label: "Xícara limpa",
      route: "cups",
      message: invalidCleanCupNumbers.length
        ? `Verifique ${invalidCleanCupNumbers.length === 1 ? "a taça" : "as taças"} nº ${invalidCleanCupNumbers.map((number) => String(number).padStart(2, "0")).join(" e ")}`
        : "Verifique as taças com interferência",
    });
  return issues;
}
export const cleanCupDefects = [
  "Fenólico leve",
  "Fenólico",
  "Rio",
  "Riado",
  "Mofo",
  "Terroso",
  "Fermentação indesejada",
  "Medicinal",
  "Químico",
  "Papelão",
  "Borracha",
  "Outro",
] as const;
