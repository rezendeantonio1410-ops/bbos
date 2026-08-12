import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  acidityQualityOptions,
  acidityReferences,
  aftertastePersistenceOptions,
  buildAcidityPersistence,
  buildBodyPersistence,
  bodyTextureOptions,
  bodyWeightOptions,
  canContinueSensoryStep,
  canEditCuppingEvaluation,
  canReopenCuppingEvaluation,
  createFiveCupStates,
  cuppingReviewIssues,
  cupsScore,
  deriveCuppingSensoryProfile,
  invitationState,
  isValidCuppingScore,
  olfactoryLibrary,
  olfactorySelectionsFromStage,
  priorScoresInitiallyExpanded,
  sensoryLibrary,
  sensoryVisualKey,
  selectBodyWeight,
  toggleAcidityType,
  toggleBodyTexture,
  toggleSensorySelection,
  withOlfactorySelections,
  totalCuppingScore,
  usesGeneralSensoryLibrary,
  validateCleanCup,
  validateCleanCupState,
} from "../dist/cupping-mobile.js";
import { Traditional100ScoringEngine } from "../dist/cupping-scoring.js";
test("score aceita somente 6–10 em passos de 0,25", () => {
  for (let value = 6; value <= 10; value += 0.25)
    assert.equal(isValidCuppingScore(value), true);
  for (const value of [5.75, 10.25, 8.13, 8.4])
    assert.equal(isValidCuppingScore(value), false);
});
test("cinco xícaras valem de zero a dez", () => {
  for (let selected = 0; selected <= 5; selected++)
    assert.equal(
      cupsScore(Array.from({ length: 5 }, (_, i) => i < selected)),
      selected * 2,
    );
});
test("xícara limpa removida exige tipo e severidade", () => {
  assert.equal(
    validateCleanCup(Array.from({ length: 5 }, () => ({ selected: true }))),
    true,
  );
  assert.equal(
    validateCleanCup([
      { selected: false },
      ...Array.from({ length: 4 }, () => ({ selected: true })),
    ]),
    false,
  );
  assert.equal(
    validateCleanCup([
      { selected: false, defectType: "Mofo" },
      ...Array.from({ length: 4 }, () => ({ selected: true })),
    ]),
    false,
  );
  assert.equal(
    validateCleanCup([
      { selected: false, defectType: "Mofo", defectSeverity: "TAINT" },
      ...Array.from({ length: 4 }, () => ({ selected: true })),
    ]),
    true,
  );
});
test("Finalização não usa roda geral e aceita as quatro persistências", () => {
  assert.equal(usesGeneralSensoryLibrary("finalizacao"), false);
  assert.deepEqual(aftertastePersistenceOptions, [
    "Curta",
    "Média",
    "Longa",
    "Muito longa",
  ]);
});
test("Acidez não usa roda geral e mantém qualidade separada", () => {
  assert.equal(usesGeneralSensoryLibrary("acidez"), false);
  assert.deepEqual(acidityQualityOptions, ["Baixa", "Média", "Alta"]);
});
test("Fragrância e sabor preservam a biblioteca sensorial", () => {
  assert.equal(usesGeneralSensoryLibrary("aroma"), true);
  assert.equal(usesGeneralSensoryLibrary("sabor"), true);
});
test("biblioteca preserva as oito famílias sensoriais aprovadas", () => {
  assert.deepEqual(
    sensoryLibrary.map((family) => family.name),
    [
      "Floral",
      "Frutado",
      "Vegetal",
      "Doce",
      "Caramelizado",
      "Cacau / Nozes",
      "Especiarias",
      "Defeitos aromáticos",
    ],
  );
});
test("navegação mantém família, subfamília e descritor existentes", () => {
  const frutado = sensoryLibrary.find((family) => family.name === "Frutado");
  const vermelhas = frutado?.subfamilies.find(
    (subfamily) => subfamily.name === "Frutas vermelhas",
  );
  assert.ok(
    vermelhas?.descriptors.some((descriptor) => descriptor.name === "Morango"),
  );
  assert.ok(
    vermelhas?.descriptors.some(
      (descriptor) => descriptor.name === "Framboesa",
    ),
  );
  assert.ok(
    vermelhas?.descriptors.some((descriptor) => descriptor.name === "Amora"),
  );
});
test("Acidez aceita um ou múltiplos tipos e alterna sem afetar outras variáveis", () => {
  const one = toggleAcidityType([], "Cítrica");
  assert.deepEqual(one, ["Cítrica"]);
  const multiple = toggleAcidityType(one, "Málica");
  assert.deepEqual(multiple, ["Cítrica", "Málica"]);
  assert.deepEqual(toggleAcidityType(multiple, "Cítrica"), ["Málica"]);
});
test("Cítrica + Málica e qualidade persistem em campos separados", () =>
  assert.deepEqual(buildAcidityPersistence(["Cítrica", "Málica"], "Alta"), {
    acidityType: "Cítrica + Málica",
    acidityTypes: ["Cítrica", "Málica"],
    acidityQuality: "Alta",
  }));
test("Fosfórica aparece na lista aprovada", () => {
  assert.deepEqual(acidityReferences, [
    "Cítrica",
    "Málica",
    "Tartárica",
    "Láctica",
    "Fosfórica",
    "Acética",
    "Outra",
  ]);
});
test("Fosfórica pode ser selecionada sozinha ou com Cítrica", () => {
  const phosphoric = toggleAcidityType([], "Fosfórica");
  assert.deepEqual(phosphoric, ["Fosfórica"]);
  assert.deepEqual(toggleAcidityType(phosphoric, "Cítrica"), [
    "Fosfórica",
    "Cítrica",
  ]);
});
test("Fosfórica combina com múltiplos tipos e persiste separada da qualidade", () => {
  const types = ["Cítrica", "Málica", "Fosfórica"];
  assert.deepEqual(buildAcidityPersistence(types, "Média"), {
    acidityType: "Cítrica + Málica + Fosfórica",
    acidityTypes: types,
    acidityQuality: "Média",
  });
});
test("qualidade e pontuação permanecem independentes dos tipos de acidez", () => {
  const persisted = buildAcidityPersistence(["Fosfórica"], "Alta");
  assert.equal(persisted.acidityQuality, "Alta");
  assert.equal("score" in persisted, false);
  assert.equal(canContinueSensoryStep(undefined), false);
});
test("peso preserva seleção única e opções aprovadas", () => {
  assert.deepEqual(bodyWeightOptions, [
    "Muito leve",
    "Leve",
    "Médio",
    "Encorpado",
    "Muito encorpado",
  ]);
  assert.equal(selectBodyWeight("Leve"), "Leve");
  assert.equal(selectBodyWeight("Médio"), "Médio");
});
test("textura permite uma ou múltiplas seleções", () => {
  assert.deepEqual(bodyTextureOptions, [
    "Sedoso",
    "Cremoso",
    "Aveludado",
    "Suave",
    "Denso",
  ]);
  const creamy = toggleBodyTexture([], "Cremoso");
  assert.deepEqual(creamy, ["Cremoso"]);
  assert.deepEqual(toggleBodyTexture(creamy, "Aveludado"), [
    "Cremoso",
    "Aveludado",
  ]);
});
test("Cremoso + Aveludado persiste independentemente do peso", () => {
  assert.deepEqual(buildBodyPersistence("Médio", ["Cremoso", "Aveludado"]), {
    bodyWeight: "Médio",
    bodyType: "Cremoso + Aveludado",
    bodyTextures: ["Cremoso", "Aveludado"],
  });
});
test("selecionar textura não atribui nota técnica", () => {
  const persisted = buildBodyPersistence("Médio", ["Sedoso", "Cremoso"]);
  assert.equal("score" in persisted, false);
  assert.equal(canContinueSensoryStep(undefined), false);
  assert.equal(canContinueSensoryStep(8.25), true);
});
test("Finalização e acidez exigem nota técnica válida para continuar", () => {
  assert.equal(canContinueSensoryStep(null), false);
  assert.equal(canContinueSensoryStep(undefined), false);
  assert.equal(canContinueSensoryStep(8.13), false);
  assert.equal(canContinueSensoryStep(8.25), true);
});
test("Clean Cup 5/5 vale 10 e não exige defeito", () =>
  assert.equal(
    validateCleanCupState(
      10,
      Array.from({ length: 5 }, () => ({ selected: true })),
    ),
    true,
  ));
test("Clean Cup 10 legado sem defeitos pode finalizar", () =>
  assert.equal(validateCleanCupState(10, []), true));
test("Clean Cup 4/5 exige defeito apenas na xícara desmarcada", () => {
  const clean = Array.from({ length: 4 }, () => ({ selected: true }));
  assert.equal(
    validateCleanCupState(8, [{ selected: false }, ...clean]),
    false,
  );
  assert.equal(
    validateCleanCupState(8, [
      { selected: false, defectType: "Mofo", defectSeverity: "TAINT" },
      ...clean,
    ]),
    true,
  );
});
test("Clean Cup 3/5 exige dois defeitos", () => {
  const cups = [
    { selected: false, defectType: "Mofo", defectSeverity: "TAINT" },
    { selected: false },
    ...Array.from({ length: 3 }, () => ({ selected: true })),
  ];
  assert.equal(validateCleanCupState(6, cups), false);
  cups[1] = { selected: false, defectType: "Rio", defectSeverity: "FAULT" };
  assert.equal(validateCleanCupState(6, cups), true);
});
test("remarcar xícara remove obrigatoriedade e restaura os dois pontos", () => {
  const cups = [
    { selected: true },
    ...Array.from({ length: 4 }, () => ({ selected: true })),
  ];
  assert.equal(cupsScore(cups.map(({ selected }) => selected)), 10);
  assert.equal(validateCleanCupState(10, cups), true);
});
test("total soma os dez atributos", () =>
  assert.equal(
    totalCuppingScore({
      fragranceAroma: 8.25,
      flavor: 8.5,
      aftertaste: 8.25,
      acidity: 8.25,
      body: 8.25,
      balance: 8.25,
      uniformity: 10,
      sweetness: 10,
      cleanCup: 10,
      overall: 8.5,
    }),
    88.25,
  ));
test("convite válido, expirado, revogado e escopo", () => {
  const now = new Date("2026-08-11");
  assert.equal(
    invitationState(
      { expiresAt: new Date("2026-08-12"), participantId: "p1" },
      "p1",
      now,
    ),
    "VALID",
  );
  assert.equal(
    invitationState(
      { expiresAt: new Date("2026-08-10"), participantId: "p1" },
      "p1",
      now,
    ),
    "EXPIRED",
  );
  assert.equal(
    invitationState(
      {
        expiresAt: new Date("2026-08-12"),
        revokedAt: now,
        participantId: "p1",
      },
      "p1",
      now,
    ),
    "REVOKED",
  );
  assert.equal(
    invitationState(
      { expiresAt: new Date("2026-08-12"), participantId: "p1" },
      "p2",
      now,
    ),
    "FORBIDDEN",
  );
});
test("avaliação finalizada bloqueia edição normal", () => {
  assert.equal(canEditCuppingEvaluation("DRAFT"), true);
  assert.equal(canEditCuppingEvaluation("COMPLETED"), false);
});
test("reabertura exige papel autorizado e mesma empresa", () => {
  assert.equal(canReopenCuppingEvaluation("ADMIN", true), true);
  assert.equal(canReopenCuppingEvaluation("INDUSTRIAL", true), true);
  assert.equal(canReopenCuppingEvaluation("SALES", true), false);
  assert.equal(canReopenCuppingEvaluation("ADMIN", false), false);
});
const engine = new Traditional100ScoringEngine();
const base = {
  fragranceAroma: 8.25,
  flavor: 8.5,
  aftertaste: 8.25,
  acidity: 8.25,
  body: 8.25,
  balance: 8.25,
  uniformity: 10,
  sweetness: 10,
  cleanCup: 10,
  overall: 8.5,
};
test("Traditional 100 sem defeitos", () =>
  assert.deepEqual(engine.calculate({ attributes: base }), {
    rawScore: 88.25,
    defectPenalty: 0,
    finalScore: 88.25,
    taints: 0,
    faults: 0,
  }));
test("Traditional 100 com 1 TAINT", () =>
  assert.equal(
    engine.calculate({
      attributes: base,
      defects: [{ cupNumber: 1, defectType: "Mofo", defectSeverity: "TAINT" }],
    }).finalScore,
    86.25,
  ));
test("Traditional 100 com 1 FAULT", () =>
  assert.equal(
    engine.calculate({
      attributes: base,
      defects: [{ cupNumber: 1, defectType: "Rio", defectSeverity: "FAULT" }],
    }).finalScore,
    84.25,
  ));
test("Traditional 100 com múltiplos defeitos", () =>
  assert.deepEqual(
    engine.calculate({
      attributes: base,
      defects: [
        { cupNumber: 1, defectType: "Mofo", defectSeverity: "TAINT" },
        { cupNumber: 2, defectType: "Rio", defectSeverity: "FAULT" },
      ],
    }),
    {
      rawScore: 88.25,
      defectPenalty: 6,
      finalScore: 82.25,
      taints: 1,
      faults: 1,
    },
  ));
test("Clean Cup reduz rawScore e defeito aplica penalização adicional", () =>
  assert.deepEqual(
    engine.calculate({
      attributes: { ...base, cleanCup: 8 },
      defects: [{ cupNumber: 1, defectType: "Mofo", defectSeverity: "TAINT" }],
    }),
    {
      rawScore: 86.25,
      defectPenalty: 2,
      finalScore: 84.25,
      taints: 1,
      faults: 0,
    },
  ));
test("revisão recalcula sem perder atributos", () => {
  const revised = { ...base, flavor: 8.25 };
  assert.equal(engine.calculate({ attributes: revised }).finalScore, 88);
  assert.equal(revised.fragranceAroma, 8.25);
  assert.equal(engine.calculate({ attributes: base }).finalScore, 88.25);
});

test("camadas sensoriais mantêm representações distintas", () => {
  assert.notEqual(sensoryVisualKey("laranja"), sensoryVisualKey("lima"));
  assert.notEqual(sensoryVisualKey("jasmim"), sensoryVisualKey("madressilva"));
});

test("perfil sensorial deriva percepções sem usar pontuações", () => {
  const profile = deriveCuppingSensoryProfile({
    selections: [
      {
        context: "AROMA",
        family: "Floral",
        subfamily: "Flores brancas",
        descriptor: "Jasmim",
      },
      {
        context: "FLAVOR",
        family: "Frutado",
        subfamily: "Cítricos",
        descriptor: "Laranja",
      },
    ],
    acidityTypes: ["Málica", "Fosfórica"],
    bodyTextures: ["Cremoso", "Aveludado"],
    aftertastePersistence: "Longa",
    aftertasteCharacter: "Doce",
  });
  assert.deepEqual(profile, [
    {
      label: "Percepções",
      values: [
        "Floral › Flores brancas › Jasmim",
        "Frutado › Cítricos › Laranja",
      ],
    },
    { label: "Acidez", values: ["Málica", "Fosfórica"] },
    { label: "Corpo", values: ["Cremoso", "Aveludado"] },
    { label: "Finalização", values: ["Longa", "Doce"] },
  ]);
  assert.equal(JSON.stringify(profile).includes("8.25"), false);
});

test("cinco taças começam marcadas e valem dez pontos", () => {
  const cups = createFiveCupStates();
  assert.equal(cups.length, 5);
  assert.equal(
    cups.every((cup) => cup.selected),
    true,
  );
  assert.equal(cupsScore(cups.map((cup) => cup.selected)), 10);
});

test("notas anteriores começam recolhidas na avaliação geral", () => {
  assert.equal(priorScoresInitiallyExpanded, false);
});

test("revisão lista pendências com deep-link e as remove após correção", () => {
  const incomplete = cuppingReviewIssues(
    { ...base, body: undefined, cleanCup: 8 },
    false,
  );
  assert.equal(
    incomplete.some((issue) => issue.key === "body" && issue.route === "corpo"),
    true,
  );
  assert.equal(
    incomplete.some(
      (issue) => issue.key === "cleanCup" && issue.route === "cups",
    ),
    true,
  );
  assert.deepEqual(cuppingReviewIssues(base, true), []);
});

test("revisão identifica exatamente a taça limpa pendente", () => {
  const issues = cuppingReviewIssues({ ...base, cleanCup: 8 }, false, [4]);
  assert.equal(
    issues.find((issue) => issue.key === "cleanCup")?.message,
    "Verifique a taça nº 04",
  );
});

test("contrato visual aprovado preserva navegação, assets e cinco taças", async () => {
  const source = await readFile(
    new URL(
      "../../../apps/web/src/components/cupping-mobile.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const wheelSource = await readFile(
    new URL(
      "../../../apps/web/src/components/sensory-illustrated-wheel.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(
    wheelSource,
    /min-h-11 items-center gap-1[\s\S]+<ChevronLeft[\s\S]+breadcrumb\.at/,
  );
  assert.match(wheelSource, /CircularSensoryNavigator/);
  assert.match(wheelSource, /wedge\(72,184,start,end\)/);
  assert.match(wheelSource, /level === "descriptor" \? "seleção múltipla"/);
  assert.match(source, /family\?\.name/);
  assert.match(source, /subfamily\.name/);
  assert.match(source, /sensory-approved-master\.png/);
  for (const descriptor of [
    "Jasmim",
    "Flor de laranjeira",
    "Madressilva",
    "Laranja",
    "Lima",
    "Limão",
    "Tangerina",
    "Grapefruit",
  ])
    assert.equal(
      source.includes(`${descriptor}: { x:`) ||
        source.includes(`${JSON.stringify(descriptor)}: { x:`),
      true,
    );
  assert.match(source, /Array\.from\(\s*\{ length: 5 \}/);
  assert.match(source, /Taça de cupping/);
});

test("Sabor preserva rodas e cores cognitivas distintas por subfamília", () => {
  const fruit = sensoryLibrary.find((family) => family.name === "Frutado");
  assert.ok(fruit);
  const red = fruit.subfamilies.find((item) => item.name === "Frutas vermelhas");
  const yellow = fruit.subfamilies.find((item) => item.name === "Frutas amarelas");
  assert.ok(red);
  assert.ok(yellow);
  assert.notEqual(red.color, yellow.color);
  assert.deepEqual(red.descriptors.map((item) => item.name), [
    "Morango",
    "Cereja",
    "Framboesa",
    "Amora",
  ]);
  assert.equal(new Set(red.descriptors.map((item) => item.assetPath)).size, 4);
  assert.equal(red.descriptors.every((item) => item.assetPath?.endsWith(".webp")), true);
});

test("seleção sensorial múltipla persiste entre subfamílias e pode ser removida", () => {
  const strawberry = { context: "FLAVOR", family: "Frutado", subfamily: "Frutas vermelhas", descriptor: "Morango", intensity: 3 };
  const lemon = { context: "FLAVOR", family: "Frutado", subfamily: "Cítricos", descriptor: "Limão", intensity: 4 };
  const first = toggleSensorySelection([], strawberry);
  const second = toggleSensorySelection(first, lemon);
  assert.deepEqual(second, [strawberry, lemon]);
  assert.deepEqual(toggleSensorySelection(second, strawberry), [lemon]);
  assert.equal(second[0].intensity, 3);
});

test("Aroma usa taxonomia independente da árvore de Sabor", () => {
  assert.notStrictEqual(olfactoryLibrary, sensoryLibrary);
  assert.equal(olfactoryLibrary.some((family) => family.name === "Tostado"), true);
  assert.equal(olfactoryLibrary.some((family) => family.name === "Frutado"), true);
  assert.equal(olfactoryLibrary.some((family) => family.name === "Terroso / Outras referências"), true);
  assert.equal(sensoryLibrary.some((family) => family.name === "Tostado"), false);
});

test("Fragrância e Aroma persistem origens separadas no stageData", () => {
  const fragrance = [{ context: "FRAGRANCE", family: "Doce", subfamily: "Confeitaria", descriptor: "Baunilha", level: 3, intensity: 4 }];
  const aroma = [{ context: "AROMA", family: "Frutado", subfamily: "Cítricos", descriptor: "Limão", level: 3, intensity: 3 }];
  const withFragrance = withOlfactorySelections({}, "FRAGRANCE", fragrance);
  const withBoth = withOlfactorySelections(withFragrance, "AROMA", aroma);
  assert.deepEqual(olfactorySelectionsFromStage(withBoth, "FRAGRANCE"), fragrance);
  assert.deepEqual(olfactorySelectionsFromStage(withBoth, "AROMA"), aroma);
});

test("taxonomia olfativa fechada preserva famílias e descritores aprovados", () => {
  assert.deepEqual(olfactoryLibrary.map((family) => family.name), [
    "Frutado", "Floral", "Tostado", "Doce", "Especiarias", "Vegetal", "Terroso / Outras referências",
  ]);
  const citrus = olfactoryLibrary.find((family) => family.name === "Frutado").subfamilies.find((item) => item.name === "Cítricos");
  assert.deepEqual(citrus.descriptors.map((item) => item.name), ["Limão", "Lima", "Tangerina", "Bergamota"]);
  assert.equal(new Set(citrus.descriptors.map((item) => item.assetPath)).size, 4);
  const whiteFlowers = olfactoryLibrary.find((family) => family.name === "Floral").subfamilies.find((item) => item.name === "Flores brancas");
  const criticalFlowers = whiteFlowers.descriptors.filter((item) => ["Flor de café", "Jasmim", "Flor de laranjeira"].includes(item.name));
  assert.equal(new Set(criticalFlowers.map((item) => item.assetPath)).size, 3);
});

test("Fragrância/Aroma usa taça seca e taça com crosta sem alterar Sabor", async () => {
  const component = await readFile(new URL("../../../apps/web/src/components/cupping-mobile.tsx", import.meta.url), "utf8");
  const page = await readFile(new URL("../../../apps/web/src/app/cupping/mobile/session/[sessionId]/sample/[sampleId]/[step]/page.tsx", import.meta.url), "utf8");
  assert.match(component, /fragrancia-seca\.webp/);
  assert.match(component, /aroma-crosta\.webp/);
  assert.match(component, /Taça técnica de cupping sem alça/);
  assert.match(page, /1 · Fragrância/);
  assert.match(page, /2 · Aroma/);
  assert.match(page, /Pontuação técnica · Fragrância \/ Aroma/);
  assert.match(page, /step !== "aroma"/);
});

test("Avaliação Geral mantém notas recolhidas e revisão usa mensagens próprias", async () => {
  const source = await readFile(
    new URL(
      "../../../apps/web/src/app/cupping/mobile/session/[sessionId]/sample/[sampleId]/[step]/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(source, /Ver notas anteriores/);
  assert.match(source, /showPriorScores &&/);
  assert.match(source, /Complete os itens abaixo antes de finalizar/);
  assert.match(source, /Corrigir ›/);
  assert.doesNotMatch(source, /Convite inválido/);
});
