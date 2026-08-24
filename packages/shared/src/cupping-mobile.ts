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

export type CuppingProgressState =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "COMPLETED";
export type CuppingProgressEvaluation = {
  sampleId: string;
  participantId: string;
  status: string;
};

const progressSummary = (states: CuppingProgressState[]) => {
  const completed = states.filter((state) => state === "COMPLETED").length;
  const inProgress = states.filter((state) => state === "IN_PROGRESS").length;
  const total = states.length;
  return {
    total,
    completed,
    inProgress,
    notStarted: total - completed - inProgress,
    percent: total ? Math.round((completed / total) * 100) : 0,
    state: (total > 0 && completed === total
      ? "COMPLETED"
      : completed > 0 || inProgress > 0
        ? "IN_PROGRESS"
        : "NOT_STARTED") as CuppingProgressState,
  };
};

export function buildCuppingSessionProgress(
  sampleIds: string[],
  participantIds: string[],
  evaluations: CuppingProgressEvaluation[],
) {
  const stateFor = (sampleId: string, participantId: string) => {
    const evaluation = evaluations.find(
      (item) =>
        item.sampleId === sampleId && item.participantId === participantId,
    );
    return (!evaluation
      ? "NOT_STARTED"
      : evaluation.status === "COMPLETED"
        ? "COMPLETED"
        : "IN_PROGRESS") as CuppingProgressState;
  };
  const matrix = participantIds.flatMap((participantId) =>
    sampleIds.map((sampleId) => ({
      participantId,
      sampleId,
      state: stateFor(sampleId, participantId),
    })),
  );
  return {
    matrix,
    overall: progressSummary(matrix.map((item) => item.state)),
    participants: participantIds.map((participantId) => ({
      participantId,
      ...progressSummary(
        matrix
          .filter((item) => item.participantId === participantId)
          .map((item) => item.state),
      ),
    })),
    samples: sampleIds.map((sampleId) => ({
      sampleId,
      ...progressSummary(
        matrix
          .filter((item) => item.sampleId === sampleId)
          .map((item) => item.state),
      ),
    })),
  };
}

export function nextPendingCuppingSample(
  sampleIds: string[],
  participantId: string,
  evaluations: CuppingProgressEvaluation[],
  currentSampleId?: string,
) {
  const completed = new Set(
    evaluations
      .filter(
        (item) =>
          item.participantId === participantId && item.status === "COMPLETED",
      )
      .map((item) => item.sampleId),
  );
  const currentIndex = currentSampleId ? sampleIds.indexOf(currentSampleId) : -1;
  const ordered = [
    ...sampleIds.slice(currentIndex + 1),
    ...sampleIds.slice(0, currentIndex + 1),
  ];
  return ordered.find((sampleId) => !completed.has(sampleId)) ?? null;
}

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
  assetPath?: string;
  subfamilies: SensorySubfamily[];
};
export type SensorySelectionIdentity = {
  context: string;
  family: string;
  subfamily?: string;
  descriptor?: string;
};
export type OlfactoryMoment = "FRAGRANCE" | "AROMA";
export type OlfactoryPerceptionType =
  | "SENSORY_ATTRIBUTE"
  | "QUALITY_DEVIATION";
export type OlfactoryStageSelection = SensorySelectionIdentity & {
  context: OlfactoryMoment | "FLAVOR" | "AFTERTASTE";
  intensity: number;
  level: number;
  imageKey?: string;
  perceptionType?: OlfactoryPerceptionType;
};
const legacyOlfactorySelection = (
  selection: OlfactoryStageSelection,
): OlfactoryStageSelection => {
  if (selection.family === "Outros") {
    if (selection.descriptor === "Manteiga")
      return {
        ...selection,
        family: "Fermentado",
        subfamily: "Láctico",
        perceptionType: "SENSORY_ATTRIBUTE",
      };
    const target = selection.descriptor === "Mofo"
      ? "Mofo / Umidade"
      : selection.descriptor === "Couro"
        ? "Químico / Contaminação"
        : "Terroso";
    return {
      ...selection,
      family: "Desvios de Qualidade",
      subfamily: target,
      perceptionType: "QUALITY_DEVIATION",
    };
  }
  if (
    selection.family === "Fermentado" &&
    ["Vinagre", "Acético", "Fermentação intensa"].includes(
      selection.descriptor ?? "",
    )
  )
    return {
      ...selection,
      family: "Desvios de Qualidade",
      subfamily: "Fermentação indesejada",
      descriptor: selection.descriptor === "Vinagre"
        ? "Avinagrado / Acético"
        : selection.descriptor === "Acético"
          ? "Avinagrado / Acético"
          : "Fermentação excessiva",
      perceptionType: "QUALITY_DEVIATION",
    };
  if (selection.family === "Fermentado") {
    const positiveFermentationAliases: Record<string, string> = {
      "Láctico": "Iogurte natural",
      "Vínico": "Vinho tinto",
      "Alcoólico limpo": "Rum",
      "Frutado fermentado limpo": "Cereja fermentada",
    };
    const descriptor = positiveFermentationAliases[selection.descriptor ?? ""];
    if (descriptor)
      return {
        ...selection,
        descriptor,
        perceptionType: "SENSORY_ATTRIBUTE",
      };
  }
  if (selection.family === "Desvios de Qualidade") {
    if (selection.subfamily === "Fenólico / Medicinal")
      return {
        ...selection,
        subfamily: "Fermentação indesejada",
        descriptor: ["Medicinal", "Farmacêutico"].includes(selection.descriptor ?? "")
          ? "Medicinal / Farmacêutico"
          : selection.descriptor,
        perceptionType: "QUALITY_DEVIATION",
      };
    if (selection.subfamily === "Químico / Solvente")
      return {
        ...selection,
        subfamily: "Químico / Contaminação",
        descriptor: selection.descriptor === "Petróleo" ? "Combustível / Petróleo" : selection.descriptor,
        perceptionType: "QUALITY_DEVIATION",
      };
    if (["Papel / Madeira / Envelhecido", "Animal / Orgânico indesejado"].includes(selection.subfamily ?? ""))
      return { ...selection, subfamily: "Químico / Contaminação", perceptionType: "QUALITY_DEVIATION" };
    if (selection.subfamily === "Fermentação indesejada" && ["Medicinal", "Farmacêutico"].includes(selection.descriptor ?? ""))
      return { ...selection, descriptor: "Medicinal / Farmacêutico", perceptionType: "QUALITY_DEVIATION" };
    if (selection.subfamily === "Fermentação indesejada" && ["Avinagrado", "Acético excessivo"].includes(selection.descriptor ?? ""))
      return { ...selection, descriptor: "Avinagrado / Acético", perceptionType: "QUALITY_DEVIATION" };
    if (selection.subfamily === "Mofo / Umidade" && selection.descriptor === "Bolor")
      return { ...selection, descriptor: "Mofo", perceptionType: "QUALITY_DEVIATION" };
    if (selection.subfamily === "Mofo / Umidade" && selection.descriptor === "Umidade")
      return { ...selection, descriptor: "Porão úmido", perceptionType: "QUALITY_DEVIATION" };
    if (selection.subfamily === "Queimado / Fumaça" && selection.descriptor === "Cinza")
      return { ...selection, descriptor: "Cinzas", perceptionType: "QUALITY_DEVIATION" };
    if (selection.subfamily === "Químico / Contaminação" && selection.descriptor === "Químico")
      return { ...selection, descriptor: "Produto químico", perceptionType: "QUALITY_DEVIATION" };
  }
  return selection.family === "Desvios de Qualidade"
    ? { ...selection, perceptionType: "QUALITY_DEVIATION" }
    : selection;
};
export function olfactorySelectionsFromStage(
  stageData: Record<string, unknown>,
  moment: OlfactoryMoment,
) {
  const key = moment === "FRAGRANCE" ? "fragranceSelections" : "aromaSelections";
  const value = stageData[key];
  return Array.isArray(value)
    ? (value as OlfactoryStageSelection[]).map(legacyOlfactorySelection)
    : [];
}
export function withOlfactorySelections(
  stageData: Record<string, unknown>,
  moment: OlfactoryMoment,
  selections: OlfactoryStageSelection[],
) {
  const key = moment === "FRAGRANCE" ? "fragranceSelections" : "aromaSelections";
  return { ...stageData, [key]: selections };
}
export function normalizeFlavorSelection<T extends SensorySelectionIdentity>(selection: T): T {
  if (selection.context !== "FLAVOR") return selection;
  if (selection.family === "Cacau / Nozes")
    return {
      ...selection,
      family: "Chocolate / Cacau",
      subfamily: selection.subfamily === "Nozes/Castanhas" ? "Frutos secos / Nozes" : selection.subfamily,
      descriptor: selection.descriptor === "Avelã" ? "Avelã torrada" : selection.descriptor === "Amêndoa" ? "Amêndoa torrada" : selection.descriptor,
    };
  if (selection.family === "Defeitos aromáticos")
    return { ...selection, family: "Desvios de Qualidade" };
  return selection;
}
export const isQualityDeviation = (
  selection: Pick<OlfactoryStageSelection, "family" | "perceptionType">,
) =>
  selection.perceptionType === "QUALITY_DEVIATION" ||
  selection.family === "Desvios de Qualidade";
export function upsertOlfactoryPerception(
  selections: OlfactoryStageSelection[],
  perception: OlfactoryStageSelection,
) {
  const index = selections.findIndex(
    (item) =>
      item.context === perception.context &&
      item.family === perception.family &&
      item.subfamily === perception.subfamily &&
      item.descriptor === perception.descriptor,
  );
  if (index < 0) return [...selections, perception];
  return selections.map((item, itemIndex) =>
    itemIndex === index ? perception : item,
  );
}
export function removeOlfactoryPerception(
  selections: OlfactoryStageSelection[],
  perception: Pick<
    OlfactoryStageSelection,
    "context" | "family" | "subfamily" | "descriptor"
  >,
) {
  return selections.filter(
    (item) =>
      !(
        item.context === perception.context &&
        item.family === perception.family &&
        item.subfamily === perception.subfamily &&
        item.descriptor === perception.descriptor
      ),
  );
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
const flavorAsset = (name: string) => ({
  Jasmim: "/sensory/aroma/floral/flores-brancas/jasmim.webp", "Flor de laranjeira": "/sensory/aroma/floral/flores-brancas/flor-de-laranjeira.webp", Madressilva: "/sensory/aroma/floral/flores-brancas/madressilva.png", "Flor de café": "/sensory/aroma/floral/flores-brancas/flor-de-cafe.webp",
  Rosa: "/sensory/aroma/floral/flores-perfumadas/rosa.png", Violeta: "/sensory/aroma/floral/flores-perfumadas/violeta.png", Lavanda: "/sensory/aroma/floral/flores-perfumadas/lavanda.png", Camomila: "/sensory/flavor/generated/camomila.webp", "Chá preto": "/sensory/flavor/generated/cha-preto.webp", "Chá verde": "/sensory/flavor/generated/cha-verde.webp", "Earl Grey": "/sensory/flavor/generated/earl-grey.webp",
  Laranja: "/sensory/flavor/generated/laranja.webp", Lima: "/sensory/aroma/frutado/citricos/lima.webp", Limão: "/sensory/aroma/frutado/citricos/limao.webp", Tangerina: "/sensory/aroma/frutado/citricos/tangerina.webp", Grapefruit: "/sensory/flavor/generated/grapefruit.webp",
  Abacaxi: "/sensory/flavor/generated/abacaxi.webp", Kiwi: "/sensory/flavor/generated/kiwi.webp", Maracujá: "/sensory/aroma/frutado/tropicais/maracuja.png", Mamão: "/sensory/aroma/frutado/tropicais/mamao.png", Banana: "/sensory/flavor/generated/banana.webp", Manga: "/sensory/aroma/frutado/tropicais/manga.png", Melão: "/sensory/flavor/generated/melao.webp", Pêssego: "/sensory/aroma/frutado/outras-frutas/pessego.png", Carambola: "/sensory/flavor/generated/carambola.webp", Damasco: "/sensory/aroma/frutado/outras-frutas/damasco.png",
  Morango: "/sensory/descriptors/flavor/red-fruits/morango.webp", Cereja: "/sensory/descriptors/flavor/red-fruits/cereja.webp", Framboesa: "/sensory/descriptors/flavor/red-fruits/framboesa.webp", Amora: "/sensory/descriptors/flavor/red-fruits/amora.webp", Mirtilo: "/sensory/aroma/frutado/frutas-vermelhas/mirtilo.png", Uva: "/sensory/flavor/generated/uva.webp", Ameixa: "/sensory/aroma/frutado/outras-frutas/ameixa.png", "Groselha-preta": "/sensory/flavor/generated/groselha-preta.webp", "Maçã verde": "/sensory/flavor/generated/maca-verde.webp", "Maçã vermelha": "/sensory/flavor/generated/maca-vermelha.webp", Pera: "/sensory/aroma/frutado/outras-frutas/pera.png", "Uva-passa": "/sensory/aroma/frutado/frutas-secas/uva-passa.png", "Ameixa seca": "/sensory/aroma/frutado/frutas-secas/ameixa-seca.png", "Figo seco": "/sensory/aroma/frutado/frutas-secas/figo-seco.png", Tâmara: "/sensory/flavor/generated/tamara.webp",
  "Grama cortada": "/sensory/flavor/generated/grama-cortada.webp", "Folha verde": "/sensory/aroma/descriptors/vegetal/folha-verde.png", "Broto vegetal": "/sensory/flavor/generated/broto-vegetal.webp", "Ervas frescas": "/sensory/aroma/descriptors/vegetal/ervas-frescas.png", Hortelã: "/sensory/flavor/generated/hortela.webp", Alecrim: "/sensory/flavor/generated/alecrim.webp", Manjericão: "/sensory/flavor/generated/manjericao.webp", Feno: "/sensory/flavor/generated/feno.webp", Palha: "/sensory/flavor/generated/palha.webp", "Folha seca": "/sensory/flavor/generated/folha-seca.webp", "Ervilha fresca": "/sensory/aroma/descriptors/vegetal/ervilha-fresca.png", Vagem: "/sensory/aroma/descriptors/vegetal/vagem.png", "Feijão verde": "/sensory/flavor/generated/feijao-verde.webp", "Madeira seca": "/sensory/flavor/generated/madeira-seca.webp", Cedro: "/sensory/flavor/generated/cedro.webp",
  "Mel floral": "/sensory/flavor/generated/mel-floral.webp", "Mel silvestre": "/sensory/flavor/generated/mel-silvestre.webp", "Baunilha / Fava de baunilha": "/sensory/flavor/generated/baunilha-fava.webp", "Açúcar mascavo": "/sensory/aroma/doce/acucares-caramelizados/acucar-mascavo.png", "Cana-de-açúcar": "/sensory/flavor/generated/cana-de-acucar.webp", Rapadura: "/sensory/flavor/generated/rapadura.webp", "Caldo de cana": "/sensory/flavor/generated/caldo-de-cana.webp", Malte: "/sensory/aroma/tostado/cereais/malte.png", "Cereal maltado": "/sensory/flavor/generated/cereal-maltado.webp",
  "Caramelo claro": "/sensory/flavor/generated/caramelo-claro.webp", "Caramelo intenso": "/sensory/flavor/generated/caramelo-intenso.webp", Toffee: "/sensory/aroma/doce/confeitaria/toffee.png", "Doce de leite": "/sensory/aroma/doce/confeitaria/doce-de-leite.png", Melaço: "/sensory/flavor/generated/melaco.webp", "Açúcar queimado": "/sensory/flavor/generated/acucar-queimado.webp",
  "Cacau seco": "/sensory/aroma/tostado/cacau-chocolate/cacau.png", "Nibs de cacau": "/sensory/flavor/generated/nibs-de-cacau.webp", "Chocolate ao leite": "/sensory/aroma/tostado/cacau-chocolate/chocolate-ao-leite.png", "Chocolate amargo": "/sensory/aroma/tostado/cacau-chocolate/chocolate-amargo.webp", "Avelã torrada": "/sensory/aroma/tostado/nozes/avela-torrada.webp", "Amêndoa torrada": "/sensory/aroma/tostado/nozes/amendoa-torrada.png", Amendoim: "/sensory/flavor/generated/amendoim.webp", Noz: "/sensory/aroma/tostado/nozes/noz.png", "Castanha-do-pará": "/sensory/flavor/generated/castanha-do-para.webp", "Castanha de caju": "/sensory/flavor/generated/castanha-de-caju.webp",
  Canela: "/sensory/aroma/descriptors/especiarias/canela.png", Cravo: "/sensory/aroma/descriptors/especiarias/cravo.png", "Noz-moscada": "/sensory/aroma/descriptors/especiarias/noz-moscada.png", Cardamomo: "/sensory/aroma/descriptors/especiarias/cardamomo.png", "Anis-estrelado": "/sensory/flavor/generated/anis-estrelado.webp", "Pimenta-preta": "/sensory/aroma/descriptors/especiarias/pimenta-preta.png", "Pimenta-branca": "/sensory/aroma/descriptors/especiarias/pimenta-branca.png", Gengibre: "/sensory/flavor/generated/gengibre.webp",
  Vinagre: "/sensory/aroma/descriptors/fermentacao-indesejada/avinagrado-acetico.png", "Álcool excessivo": "/sensory/aroma/descriptors/fermentacao-indesejada/alcoolico-excessivo.png", "Fermentação excessiva": "/sensory/aroma/descriptors/fermentacao-indesejada/fermentacao-excessiva.png", Mofo: "/sensory/aroma/descriptors/mofo-umidade/mofo.png", Bolor: "/sensory/aroma/descriptors/mofo-umidade/porao-umido.png", "Porão úmido": "/sensory/aroma/descriptors/mofo-umidade/porao-umido.png", "Terra úmida": "/sensory/aroma/descriptors/terroso/terra-umida.png", "Terra seca": "/sensory/aroma/descriptors/terroso/terra-seca.png", Medicinal: "/sensory/aroma/descriptors/fermentacao-indesejada/medicinal-farmaceutico.png", Fenólico: "/sensory/aroma/descriptors/fermentacao-indesejada/fenolico.png", Solvente: "/sensory/aroma/descriptors/quimico-contaminacao/solvente.png", Papelão: "/sensory/flavor/generated/papelao.webp", Papel: "/sensory/flavor/generated/papel.webp", Cinza: "/sensory/aroma/descriptors/queimado-fumaca/cinzas.png", Carbonizado: "/sensory/aroma/descriptors/queimado-fumaca/carbonizado.png", Fumaça: "/sensory/aroma/descriptors/queimado-fumaca/fumaca.png", Borracha: "/sensory/aroma/descriptors/quimico-contaminacao/borracha.png", Petróleo: "/sensory/aroma/descriptors/quimico-contaminacao/combustivel-petroleo.png", Couro: "/sensory/flavor/generated/couro.webp", Animal: "/sensory/aroma/desvios/animal-organico-indesejado.png", "Matéria orgânica degradada": "/sensory/aroma/desvios/animal-organico-indesejado.png",
} as Record<string, string>)[name];
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
    assetPath: flavorAsset(name),
    ...flavorDescriptorPresentation[name],
  }));
const sub = (
  name: string,
  list: string,
  key: string,
  color?: string,
): SensorySubfamily => {
  const descriptors = names(list, key, color);
  return { name, imageKey: key, color, descriptors, assetPath: descriptors[0]?.assetPath };
};

const sensoryLibraryTaxonomy: SensoryFamily[] = [
  {
    name: "Floral",
    imageKey: "floral",
    color: "#d978b5",
    assetPath: "/sensory/aroma/floral/flores-brancas/jasmim.webp",
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
    assetPath: "/sensory/descriptors/flavor/red-fruits/morango.webp",
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
    assetPath: "/sensory/aroma/families/vegetal.png",
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
    assetPath: "/sensory/aroma/doce/acucares-caramelizados/mel.webp",
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
    assetPath: "/sensory/aroma/doce/acucares-caramelizados/caramelo.webp",
    subfamilies: [
      sub("Caramelo", "Caramelo claro|Caramelo intenso", "caramelo"),
      sub("Confeitaria", "Toffee|Doce de leite", "confeitaria"),
      sub("Melaço", "Melaço", "melaco"),
      sub("Açúcar tostado", "Açúcar queimado", "acucar-tostado"),
    ],
  },
  {
    name: "Chocolate / Cacau",
    imageKey: "cacau-nozes",
    color: "#8f624c",
    assetPath: "/sensory/aroma/tostado/cacau-chocolate/chocolate-amargo.webp",
    subfamilies: [
      sub(
        "Cacau",
        "Cacau seco|Nibs de cacau|Chocolate ao leite|Chocolate amargo",
        "cacau",
      ),
      sub(
        "Frutos secos / Nozes",
        "Avelã torrada|Amêndoa torrada|Amendoim|Noz|Castanha-do-pará|Castanha de caju",
        "nozes",
      ),
    ],
  },
  {
    name: "Especiarias",
    imageKey: "especiarias",
    color: "#d46742",
    assetPath: "/sensory/aroma/families/especiarias.png",
    subfamilies: [
      sub("Doces", "Canela|Cravo|Noz-moscada", "especiarias-doces"),
      sub("Aromáticas", "Cardamomo|Anis-estrelado", "especiarias-aromaticas"),
      sub("Picantes", "Pimenta-preta|Pimenta-branca|Gengibre", "picantes"),
    ],
  },
  {
    name: "Desvios de Qualidade",
    imageKey: "defeitos",
    color: "#667070",
    assetPath: "/sensory/aroma/desvios/fermentacao-indesejada.png",
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

const flavorFamilyOrder = [
  "Floral",
  "Frutado",
  "Doce",
  "Caramelizado",
  "Chocolate / Cacau",
  "Especiarias",
  "Vegetal",
  "Desvios de Qualidade",
] as const;
export const sensoryLibrary: SensoryFamily[] = flavorFamilyOrder.map(
  (name) => sensoryLibraryTaxonomy.find((family) => family.name === name)!,
);

const olfactoryAssets: Record<string, string> = {
  Limão: "/sensory/aroma/frutado/citricos/limao.webp",
  Lima: "/sensory/aroma/frutado/citricos/lima.webp",
  Tangerina: "/sensory/aroma/frutado/citricos/tangerina.webp",
  Bergamota: "/sensory/aroma/frutado/citricos/bergamota.webp",
  Morango: "/sensory/aroma/frutado/frutas-vermelhas/morango.webp",
  Framboesa: "/sensory/aroma/frutado/frutas-vermelhas/framboesa.webp",
  Cereja: "/sensory/aroma/frutado/frutas-vermelhas/cereja.webp",
  Amora: "/sensory/descriptors/flavor/red-fruits/amora.webp",
  Mirtilo: "/sensory/aroma/frutado/frutas-vermelhas/mirtilo.png",
  Groselha: "/sensory/aroma/frutado/frutas-vermelhas/groselha.png",
  Romã: "/sensory/aroma/frutado/frutas-vermelhas/roma.png",
  Cranberry: "/sensory/aroma/frutado/frutas-vermelhas/cranberry.png",
  "Uva vermelha": "/sensory/aroma/frutado/frutas-vermelhas/uva-vermelha.png",
  Manga: "/sensory/aroma/frutado/tropicais/manga.png",
  Abacaxi: "/sensory/aroma/frutado/tropicais/abacaxi.png",
  Maracujá: "/sensory/aroma/frutado/tropicais/maracuja.png",
  Mamão: "/sensory/aroma/frutado/tropicais/mamao.png",
  "Groselha preta": "/sensory/aroma/frutado/outras-frutas/groselha-preta.png",
  Ameixa: "/sensory/aroma/frutado/outras-frutas/ameixa.png",
  Pêssego: "/sensory/aroma/frutado/outras-frutas/pessego.png",
  Damasco: "/sensory/aroma/frutado/outras-frutas/damasco.png",
  Nectarina: "/sensory/aroma/frutado/outras-frutas/nectarina.png",
  Maçã: "/sensory/aroma/frutado/outras-frutas/maca.png",
  Pera: "/sensory/aroma/frutado/outras-frutas/pera.png",
  "Uva-passa": "/sensory/aroma/frutado/frutas-secas/uva-passa.png",
  "Figo seco": "/sensory/aroma/frutado/frutas-secas/figo-seco.png",
  "Ameixa seca": "/sensory/aroma/frutado/frutas-secas/ameixa-seca.png",
  "Flor de café": "/sensory/aroma/floral/flores-brancas/flor-de-cafe.webp",
  Jasmim: "/sensory/aroma/floral/flores-brancas/jasmim.webp",
  "Flor de laranjeira": "/sensory/aroma/floral/flores-brancas/flor-de-laranjeira.webp",
  Madressilva: "/sensory/aroma/floral/flores-brancas/madressilva.png",
  Rosa: "/sensory/aroma/floral/flores-perfumadas/rosa.png",
  Lavanda: "/sensory/aroma/floral/flores-perfumadas/lavanda.png",
  Violeta: "/sensory/aroma/floral/flores-perfumadas/violeta.png",
  Caramelo: "/sensory/aroma/doce/acucares-caramelizados/caramelo.webp",
  "Açúcar mascavo": "/sensory/aroma/doce/acucares-caramelizados/acucar-mascavo.png",
  Mel: "/sensory/aroma/doce/acucares-caramelizados/mel.webp",
  Baunilha: "/sensory/aroma/doce/confeitaria/baunilha.png",
  "Doce de leite": "/sensory/aroma/doce/confeitaria/doce-de-leite.png",
  Toffee: "/sensory/aroma/doce/confeitaria/toffee.png",
  "Avelã torrada": "/sensory/aroma/tostado/nozes/avela-torrada.webp",
  "Amêndoa torrada": "/sensory/aroma/tostado/nozes/amendoa-torrada.png",
  Noz: "/sensory/aroma/tostado/nozes/noz.png",
  Cacau: "/sensory/aroma/tostado/cacau-chocolate/cacau.png",
  "Chocolate amargo": "/sensory/aroma/tostado/cacau-chocolate/chocolate-amargo.webp",
  "Chocolate ao leite": "/sensory/aroma/tostado/cacau-chocolate/chocolate-ao-leite.png",
  Malte: "/sensory/aroma/tostado/cereais/malte.png",
  "Pão torrado": "/sensory/aroma/tostado/cereais/pao-torrado.png",
  "Café torrado": "/sensory/aroma/tostado/cereais/cafe-torrado.png",
  "Pimenta-preta": "/sensory/aroma/descriptors/especiarias/pimenta-preta.png",
  "Pimenta-branca": "/sensory/aroma/descriptors/especiarias/pimenta-branca.png",
  Cravo: "/sensory/aroma/descriptors/especiarias/cravo.png",
  Canela: "/sensory/aroma/descriptors/especiarias/canela.png",
  "Noz-moscada": "/sensory/aroma/descriptors/especiarias/noz-moscada.png",
  Cardamomo: "/sensory/aroma/descriptors/especiarias/cardamomo.png",
  "Grama fresca": "/sensory/aroma/descriptors/vegetal/grama-fresca.png",
  "Folha verde": "/sensory/aroma/descriptors/vegetal/folha-verde.png",
  "Ervas frescas": "/sensory/aroma/descriptors/vegetal/ervas-frescas.png",
  "Pimentão verde": "/sensory/aroma/descriptors/vegetal/pimentao-verde.png",
  "Ervilha fresca": "/sensory/aroma/descriptors/vegetal/ervilha-fresca.png",
  Vagem: "/sensory/aroma/descriptors/vegetal/vagem.png",
  "Iogurte natural": "/sensory/aroma/descriptors/fermentado/iogurte-natural.webp",
  "Leite fermentado": "/sensory/aroma/descriptors/fermentado/leite-fermentado.webp",
  Kefir: "/sensory/aroma/descriptors/fermentado/kefir.webp",
  "Creme azedo": "/sensory/aroma/descriptors/fermentado/creme-azedo.webp",
  "Vinho tinto": "/sensory/aroma/descriptors/fermentado/vinho-tinto.webp",
  "Vinho branco": "/sensory/aroma/descriptors/fermentado/vinho-branco.webp",
  "Uva vínica": "/sensory/aroma/descriptors/fermentado/uva-vinica.webp",
  "Vinho licoroso": "/sensory/aroma/descriptors/fermentado/vinho-licoroso.webp",
  Rum: "/sensory/aroma/descriptors/fermentado/rum.webp",
  "Conhaque / Brandy": "/sensory/aroma/descriptors/fermentado/conhaque-brandy.webp",
  Whisky: "/sensory/aroma/descriptors/fermentado/whisky.webp",
  Licor: "/sensory/aroma/descriptors/fermentado/licor.webp",
  "Cereja fermentada": "/sensory/aroma/descriptors/fermentado/cereja-fermentada.webp",
  "Uva fermentada": "/sensory/aroma/descriptors/fermentado/uva-fermentada.webp",
  "Frutas vermelhas fermentadas": "/sensory/aroma/descriptors/fermentado/frutas-vermelhas-fermentadas.webp",
  "Frutas tropicais fermentadas": "/sensory/aroma/descriptors/fermentado/frutas-tropicais-fermentadas.webp",
  "Fermentado azedo": "/sensory/aroma/descriptors/fermentacao-indesejada/fermentado-azedo.png",
  "Avinagrado / Acético": "/sensory/aroma/descriptors/fermentacao-indesejada/avinagrado-acetico.png",
  "Alcoólico excessivo": "/sensory/aroma/descriptors/fermentacao-indesejada/alcoolico-excessivo.png",
  "Fermentação excessiva": "/sensory/aroma/descriptors/fermentacao-indesejada/fermentacao-excessiva.png",
  Fenólico: "/sensory/aroma/descriptors/fermentacao-indesejada/fenolico.png",
  "Medicinal / Farmacêutico": "/sensory/aroma/descriptors/fermentacao-indesejada/medicinal-farmaceutico.png",
  Mofo: "/sensory/aroma/descriptors/mofo-umidade/mofo.png",
  "Porão úmido": "/sensory/aroma/descriptors/mofo-umidade/porao-umido.png",
  "Papel / Papelão úmido": "/sensory/aroma/descriptors/mofo-umidade/papel-papelao-umido.png",
  "Madeira úmida": "/sensory/aroma/descriptors/mofo-umidade/madeira-umida.png",
  "Saco de juta úmido": "/sensory/aroma/descriptors/mofo-umidade/saco-juta-umido.png",
  "Terra úmida": "/sensory/aroma/descriptors/terroso/terra-umida.png",
  "Terra seca": "/sensory/aroma/descriptors/terroso/terra-seca.png",
  Poeira: "/sensory/aroma/descriptors/terroso/poeira.png",
  "Queimado excessivo": "/sensory/aroma/descriptors/queimado-fumaca/queimado-excessivo.png",
  Fumaça: "/sensory/aroma/descriptors/queimado-fumaca/fumaca.png",
  Cinzas: "/sensory/aroma/descriptors/queimado-fumaca/cinzas.png",
  Carbonizado: "/sensory/aroma/descriptors/queimado-fumaca/carbonizado.png",
  "Combustível / Petróleo": "/sensory/aroma/descriptors/quimico-contaminacao/combustivel-petroleo.png",
  Plástico: "/sensory/aroma/descriptors/quimico-contaminacao/plastico.png",
  Borracha: "/sensory/aroma/descriptors/quimico-contaminacao/borracha.png",
  Solvente: "/sensory/aroma/descriptors/quimico-contaminacao/solvente.png",
  "Produto químico": "/sensory/aroma/descriptors/quimico-contaminacao/produto-quimico.png",
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
const qualityDeviationAssets: Record<string, string> = {
  "Fermentação indesejada": "/sensory/aroma/desvios/fermentacao-indesejada.png",
  "Mofo / Umidade": "/sensory/aroma/desvios/mofo-umidade.png",
  Terroso: "/sensory/aroma/desvios/terroso.png",
  "Queimado / Fumaça": "/sensory/aroma/desvios/queimado-fumaca.png",
  "Químico / Contaminação": "/sensory/aroma/desvios/quimico-solvente.png",
};
const qualityDeviationSub = (name: string, list: string, key: string, color: string) => ({
  ...olfactorySub(name, list, key, color),
  assetPath: qualityDeviationAssets[name],
});

// Taxonomia BBOS olfativa: independente da árvore gustativa de Sabor.
export const olfactoryLibrary: SensoryFamily[] = [
  { name: "Floral", imageKey: "olfactory-floral", color: "#c66aa8", assetPath: olfactoryAssets["Flor de café"], subfamilies: [
    olfactorySub("Flores brancas", "Flor de café|Jasmim|Flor de laranjeira|Madressilva", "flores-brancas", "#d889bb"),
    olfactorySub("Flores perfumadas", "Rosa|Lavanda|Violeta", "flores-perfumadas", "#a86aa4"),
  ]},
  { name: "Frutado", imageKey: "olfactory-frutado", color: "#df5c55", assetPath: olfactoryAssets.Morango, subfamilies: [
    olfactorySub("Frutas vermelhas", "Morango|Cereja|Framboesa|Amora|Mirtilo|Groselha|Romã|Cranberry|Uva vermelha", "frutas-vermelhas", "#ce4056"),
    olfactorySub("Cítricos", "Limão|Lima|Tangerina|Bergamota", "citricos", "#e8b52d"),
    olfactorySub("Frutas tropicais", "Manga|Abacaxi|Maracujá|Mamão", "tropicais", "#dda526"),
    olfactorySub("Outras frutas", "Groselha preta|Ameixa|Pêssego|Damasco|Nectarina|Maçã|Pera", "outras-frutas", "#91aa66"),
    olfactorySub("Frutas secas", "Uva-passa|Figo seco|Ameixa seca", "frutas-secas", "#885142"),
  ]},
  { name: "Doce", imageKey: "olfactory-doce", color: "#d69938", assetPath: olfactoryAssets.Caramelo, subfamilies: [
    olfactorySub("Açúcares caramelizados", "Caramelo|Açúcar mascavo|Mel", "acucares", "#c7822e"),
    olfactorySub("Confeitaria", "Baunilha|Doce de leite|Toffee", "confeitaria", "#dfad65"),
  ]},
  { name: "Chocolate / Cacau", imageKey: "olfactory-chocolate-cacau", color: "#74452f", assetPath: olfactoryAssets["Chocolate amargo"], subfamilies: [
    olfactorySub("Cacau / Chocolate", "Cacau|Chocolate amargo|Chocolate ao leite", "cacau", "#74452f"),
    olfactorySub("Frutos secos / Nozes", "Avelã torrada|Amêndoa torrada|Noz", "nozes", "#a27752"),
    olfactorySub("Cereais / Torrado", "Malte|Pão torrado|Café torrado", "cereais", "#9d6b3d"),
  ]},
  { name: "Especiarias", imageKey: "olfactory-especiarias", color: "#b95f3d", assetPath: "/sensory/aroma/families/especiarias.png", subfamilies: [
    olfactorySub("Picantes", "Pimenta-preta|Pimenta-branca", "picantes", "#8e4937"),
    olfactorySub("Especiarias aromáticas", "Cravo|Canela|Noz-moscada|Cardamomo", "aromaticas", "#b96a42"),
  ]},
  { name: "Vegetal", imageKey: "olfactory-vegetal", color: "#71975e", assetPath: "/sensory/aroma/families/vegetal.png", subfamilies: [
    olfactorySub("Verde / Fresco", "Grama fresca|Folha verde|Ervas frescas", "verde", "#78a65f"),
    olfactorySub("Vegetais verdes", "Pimentão verde|Ervilha fresca|Vagem", "vegetais", "#58844e"),
  ]},
  { name: "Fermentado", imageKey: "olfactory-fermentado", color: "#8d586f", assetPath: "/sensory/aroma/families/fermentado.png", subfamilies: [
    olfactorySub("Láctico", "Iogurte natural|Leite fermentado|Kefir|Creme azedo", "lactico", "#b68491"),
    olfactorySub("Vínico", "Vinho tinto|Vinho branco|Uva vínica|Vinho licoroso", "vinico", "#95546f"),
    olfactorySub("Alcoólico limpo", "Rum|Conhaque / Brandy|Whisky|Licor", "alcoolico-limpo", "#8c6578"),
    olfactorySub("Frutado fermentado limpo", "Cereja fermentada|Uva fermentada|Frutas vermelhas fermentadas|Frutas tropicais fermentadas", "frutado-fermentado-limpo", "#a05f78"),
  ]},
  { name: "Desvios de Qualidade", imageKey: "olfactory-desvios-qualidade", color: "#6f6a62", assetPath: qualityDeviationAssets["Fermentação indesejada"], subfamilies: [
    qualityDeviationSub("Fermentação indesejada", "Fermentado azedo|Avinagrado / Acético|Alcoólico excessivo|Fermentação excessiva|Fenólico|Medicinal / Farmacêutico", "fermentacao-indesejada", "#786365"),
    qualityDeviationSub("Mofo / Umidade", "Mofo|Porão úmido|Papel / Papelão úmido|Madeira úmida|Saco de juta úmido", "mofo-umidade", "#68716b"),
    qualityDeviationSub("Terroso", "Terra úmida|Terra seca|Poeira", "terroso", "#776d5d"),
    qualityDeviationSub("Queimado / Fumaça", "Queimado excessivo|Fumaça|Cinzas|Carbonizado", "queimado-fumaca", "#625e59"),
    qualityDeviationSub("Químico / Contaminação", "Combustível / Petróleo|Plástico|Borracha|Solvente|Produto químico", "quimico-contaminacao", "#62696c"),
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
  "Floral",
  "Chocolate / Cacau",
  "Especiada",
  "Seca",
  "Adstringente",
  "Outro",
] as const;
export const aftertasteIntensityOptions = [
  "Sutil",
  "Leve",
  "Média",
  "Intensa",
  "Marcante",
] as const;
export function buildAftertastePersistence(
  persistence: string | undefined,
  intensity: number | undefined,
  characters: string[],
  selections: OlfactoryStageSelection[],
) {
  return {
    aftertastePersistence: persistence,
    aftertasteIntensity: intensity,
    aftertasteCharacters: [...new Set(characters)],
    aftertasteSelections: selections.map((selection) => ({
      ...selection,
      context: "AFTERTASTE" as const,
    })),
  };
}
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
