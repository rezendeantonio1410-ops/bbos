import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import {
  acidityQualityOptions,
  acidityReferences,
  aftertastePersistenceOptions,
  aftertasteIntensityOptions,
  buildAftertastePersistence,
  buildAcidityPersistence,
  buildBodyPersistence,
  buildCuppingSessionProgress,
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
  isQualityDeviation,
  isValidCuppingScore,
  nextPendingCuppingSample,
  normalizeFlavorSelection,
  olfactoryLibrary,
  olfactorySelectionsFromStage,
  priorScoresInitiallyExpanded,
  removeOlfactoryPerception,
  sensoryLibrary,
  sensoryVisualKey,
  selectBodyWeight,
  toggleAcidityType,
  toggleBodyTexture,
  toggleSensorySelection,
  upsertOlfactoryPerception,
  withOlfactorySelections,
  totalCuppingScore,
  usesGeneralSensoryLibrary,
  validateCleanCup,
  validateCleanCupState,
} from "../dist/cupping-mobile.js";

test("progresso 1x1 distingue não iniciada, andamento e concluída", () => {
  assert.equal(buildCuppingSessionProgress(["s1"], ["p1"], []).overall.state, "NOT_STARTED");
  assert.equal(buildCuppingSessionProgress(["s1"], ["p1"], [{ sampleId: "s1", participantId: "p1", status: "DRAFT" }]).overall.state, "IN_PROGRESS");
  const completed = buildCuppingSessionProgress(["s1"], ["p1"], [{ sampleId: "s1", participantId: "p1", status: "COMPLETED" }]);
  assert.equal(completed.overall.state, "COMPLETED");
  assert.equal(completed.overall.percent, 100);
});
test("matriz de múltiplas amostras e provadores calcula progresso parcial real", () => {
  const progress = buildCuppingSessionProgress(["s1", "s2"], ["p1", "p2"], [
    { sampleId: "s1", participantId: "p1", status: "COMPLETED" },
    { sampleId: "s2", participantId: "p1", status: "DRAFT" },
    { sampleId: "s1", participantId: "p2", status: "COMPLETED" },
  ]);
  assert.deepEqual(progress.overall, { total: 4, completed: 2, inProgress: 1, notStarted: 1, percent: 50, state: "IN_PROGRESS" });
  assert.equal(progress.samples.find((item) => item.sampleId === "s1").percent, 100);
  assert.equal(progress.participants.find((item) => item.participantId === "p1").completed, 1);
});
test("mobile avança à próxima amostra pendente e isola outro provador", () => {
  const evaluations = [
    { sampleId: "s1", participantId: "p1", status: "COMPLETED" },
    { sampleId: "s2", participantId: "p2", status: "COMPLETED" },
  ];
  assert.equal(nextPendingCuppingSample(["s1", "s2"], "p1", evaluations, "s1"), "s2");
  assert.equal(nextPendingCuppingSample(["s1", "s2"], "p2", evaluations, "s2"), "s1");
});
test("mobile encerra somente quando todas as amostras do provador concluíram", () => {
  const evaluations = ["s1", "s2"].map((sampleId) => ({ sampleId, participantId: "p1", status: "COMPLETED" }));
  assert.equal(nextPendingCuppingSample(["s1", "s2"], "p1", evaluations, "s1"), null);
});
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
test("Finalização persiste três dimensões independentes e múltiplas seleções", () => {
  const residual = [
    { context: "FLAVOR", family: "Frutado", subfamily: "Frutas vermelhas", descriptor: "Morango", level: 3, intensity: 4 },
    { context: "FLAVOR", family: "Chocolate / Cacau", subfamily: "Cacau", descriptor: "Chocolate amargo", level: 3, intensity: 3 },
  ];
  const persisted = buildAftertastePersistence("Longa", 4, ["Doce", "Frutada", "Limpa"], residual);
  assert.equal(persisted.aftertastePersistence, "Longa");
  assert.equal(persisted.aftertasteIntensity, 4);
  assert.deepEqual(persisted.aftertasteCharacters, ["Doce", "Frutada", "Limpa"]);
  assert.deepEqual(persisted.aftertasteSelections.map((item) => [item.context, item.descriptor, item.intensity]), [["AFTERTASTE", "Morango", 4], ["AFTERTASTE", "Chocolate amargo", 3]]);
  assert.deepEqual(aftertasteIntensityOptions, ["Sutil", "Leve", "Média", "Intensa", "Marcante"]);
});
test("Finalização fica isolada entre amostras e provadores após reload", () => {
  const sampleATaster1 = JSON.parse(JSON.stringify(buildAftertastePersistence("Longa", 4, ["Limpa"], [])));
  const sampleBTaster1 = JSON.parse(JSON.stringify(buildAftertastePersistence("Curta", 2, ["Seca"], [])));
  const sampleATaster2 = JSON.parse(JSON.stringify(buildAftertastePersistence("Média", 3, ["Doce"], [])));
  assert.deepEqual([sampleATaster1.aftertastePersistence, sampleBTaster1.aftertastePersistence, sampleATaster2.aftertastePersistence], ["Longa", "Curta", "Média"]);
  assert.deepEqual([sampleATaster1.aftertasteIntensity, sampleBTaster1.aftertasteIntensity, sampleATaster2.aftertasteIntensity], [4, 2, 3]);
});
test("Finalização possui composição responsiva mobile e tablet sem lógica duplicada", async () => {
  const source = await readFile(new URL("../../../apps/web/src/components/cupping-aftertaste.tsx", import.meta.url), "utf8");
  assert.match(source, /md:grid-cols-\[minmax\(0,.78fr\)_minmax\(0,1.22fr\)\]/);
  assert.match(source, /min-\[430px\]:grid-cols-3/);
  assert.match(source, /md:grid-cols-2/);
  assert.match(source, /clamp\(/);
  assert.match(source, /onPointerDown/);
  assert.match(source, /setPointerCapture/);
  assert.match(source, /touch-none/);
  assert.match(source, /role="radiogroup" aria-label="Persistência da finalização"|aria-label={`Persistência/);
  assert.doesNotMatch(source, /overflow-x-auto|w-screen|min-w-\[/);
  assert.equal((source.match(/function CuppingAftertaste/g) ?? []).length, 1);
});
test("Acidez não usa roda geral e mantém qualidade separada", () => {
  assert.equal(usesGeneralSensoryLibrary("acidez"), false);
  assert.deepEqual(acidityQualityOptions, ["Baixa", "Média", "Alta"]);
});
test("Acidez sensorial possui intensidade tátil, multisseleção e nota independente", async () => {
  const source = await readFile(new URL("../../../apps/web/src/components/cupping-acidity.tsx", import.meta.url), "utf8");
  assert.match(source, /"Baixa", "Suave", "Média", "Viva", "Intensa"/);
  for (const type of ["Cítrica", "Málica", "Tartárica", "Láctica", "Fosfórica"]) assert.match(source, new RegExp(type));
  assert.match(source, /onPointerDown/);
  assert.match(source, /setPointerCapture/);
  assert.match(source, /onTypes\(\[\.\.\.selectedTypes, type\.name\]\)/);
  assert.match(source, /onReferences\(toggle\(references/);
  assert.match(source, /onCharacters\(toggle\(selectedCharacters/);
  assert.match(source, /Array\.from\(\{ length: 15 \}/);
  assert.match(source, /Voltar à bússola/);
  assert.match(source, /Sua Xícara · \{references\.length\}/);
  assert.match(source, /countFor/);
  assert.match(source, /selectedTypes\.join\(" \+ "\)/);
  assert.match(source, /aspect-square/);
  assert.match(source, /conic-gradient/);
  assert.match(source, /sectorArc/);
  assert.match(source, /countFor\(type\) > 0/);
  assert.match(source, /acidArcIn/);
  assert.match(source, /referências selecionadas/);
  assert.match(source, /md:grid-cols-2/);
  assert.match(source, /min-\[430px\]:grid-cols-3/);
  assert.match(source, /clamp\(/);
  assert.doesNotMatch(source, /overflow-x-auto|w-screen/);
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
      "Doce",
      "Caramelizado",
      "Chocolate / Cacau",
      "Especiarias",
      "Vegetal",
      "Desvios de Qualidade",
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
test("Corpo sensorial usa fluxo tátil, texturas fotográficas e nota independente", async () => {
  const source = await readFile(new URL("../../../apps/web/src/components/cupping-body.tsx", import.meta.url), "utf8");
  assert.match(source, /"Leve", "Médio-leve", "Médio", "Médio-alto", "Encorpado"/);
  for (const texture of ["Sedoso", "Cremoso", "Aveludado", "Licoroso", "Suculento", "Aquoso"]) assert.match(source, new RegExp(texture));
  assert.match(source, /onPointerDown/);
  assert.match(source, /setPointerCapture/);
  assert.match(source, /selectedTextures\.includes/);
  assert.match(source, /selectedTextures\.filter/);
  assert.match(source, /Array\.from\(\{ length: 15 \}/);
  assert.match(source, /texture-atlas-source\.png/);
  assert.match(source, /md:grid-cols-2/);
  assert.match(source, /clamp\(/);
  assert.doesNotMatch(source, /overflow-x-auto|w-screen/);
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

test("Sabor possui fotografias locais em família, subfamília e 111 descritores", async () => {
  const descriptors = sensoryLibrary.flatMap((family) => family.subfamilies.flatMap((subfamily) => subfamily.descriptors));
  assert.equal(descriptors.length, 111);
  for (const family of sensoryLibrary) {
    assert.ok(family.assetPath, `${family.name} deve possuir fotografia`);
    await access(new URL(`../../../apps/web/public${family.assetPath}`, import.meta.url));
    for (const subfamily of family.subfamilies) {
      assert.ok(subfamily.assetPath, `${family.name} > ${subfamily.name} deve possuir fotografia`);
      for (const descriptor of subfamily.descriptors) {
        assert.ok(descriptor.assetPath, `${descriptor.name} deve possuir fotografia`);
        await access(new URL(`../../../apps/web/public${descriptor.assetPath}`, import.meta.url));
      }
    }
  }
});

test("Sabor preserva seis descritores com intensidades independentes entre famílias", () => {
  const expected = [
    ["Frutado", "Frutas vermelhas", "Morango", 4],
    ["Frutado", "Frutas vermelhas", "Framboesa", 3],
    ["Frutado", "Frutas vermelhas", "Cereja", 2],
    ["Chocolate / Cacau", "Frutos secos / Nozes", "Avelã torrada", 3],
    ["Chocolate / Cacau", "Frutos secos / Nozes", "Amêndoa torrada", 2],
    ["Especiarias", "Doces", "Canela", 2],
  ];
  const selected = expected.reduce((cup, [family, subfamily, descriptor, intensity]) => upsertOlfactoryPerception(cup, {
    context: "FLAVOR", family, subfamily, descriptor, level: 3, intensity,
  }), []);
  assert.equal(selected.length, 6);
  assert.deepEqual(selected.map((item) => [item.family, item.subfamily, item.descriptor, item.intensity]), expected);
  assert.equal(upsertOlfactoryPerception(selected, { ...selected[0], intensity: 5 }).find((item) => item.descriptor === "Framboesa").intensity, 3);
});

test("Fragrância, Aroma e Sabor isolam Morango e sobrevivem ao reload", () => {
  const draft = {
    stageData: withOlfactorySelections(withOlfactorySelections({}, "FRAGRANCE", [
      { context: "FRAGRANCE", family: "Frutado", subfamily: "Frutas vermelhas", descriptor: "Morango", level: 3, intensity: 2 },
    ]), "AROMA", [
      { context: "AROMA", family: "Frutado", subfamily: "Frutas vermelhas", descriptor: "Morango", level: 3, intensity: 4 },
    ]),
    selections: [{ context: "FLAVOR", family: "Frutado", subfamily: "Frutas vermelhas", descriptor: "Morango", level: 3, intensity: 3 }],
  };
  const restored = JSON.parse(JSON.stringify(draft));
  assert.equal(olfactorySelectionsFromStage(restored.stageData, "FRAGRANCE")[0].intensity, 2);
  assert.equal(olfactorySelectionsFromStage(restored.stageData, "AROMA")[0].intensity, 4);
  assert.equal(restored.selections.find((item) => item.context === "FLAVOR").intensity, 3);
});

test("Sabor fica isolado entre duas amostras serializadas", () => {
  const sampleA = JSON.parse(JSON.stringify({ selections: [{ context: "FLAVOR", family: "Frutado", subfamily: "Frutas vermelhas", descriptor: "Morango", level: 3, intensity: 4 }] }));
  const sampleB = JSON.parse(JSON.stringify({ selections: [{ context: "FLAVOR", family: "Frutado", subfamily: "Frutas vermelhas", descriptor: "Morango", level: 3, intensity: 2 }] }));
  assert.equal(sampleA.selections[0].intensity, 4);
  assert.equal(sampleB.selections[0].intensity, 2);
});

test("aliases históricos de Sabor preservam registros antigos", () => {
  assert.deepEqual(normalizeFlavorSelection({ context: "FLAVOR", family: "Cacau / Nozes", subfamily: "Nozes/Castanhas", descriptor: "Avelã", intensity: 3 }),
    { context: "FLAVOR", family: "Chocolate / Cacau", subfamily: "Frutos secos / Nozes", descriptor: "Avelã torrada", intensity: 3 });
  assert.equal(normalizeFlavorSelection({ context: "FLAVOR", family: "Defeitos aromáticos", descriptor: "Mofo" }).family, "Desvios de Qualidade");
});

test("Aroma usa taxonomia independente da árvore de Sabor", () => {
  assert.notStrictEqual(olfactoryLibrary, sensoryLibrary);
  assert.equal(olfactoryLibrary.some((family) => family.name === "Chocolate / Cacau"), true);
  assert.equal(olfactoryLibrary.some((family) => family.name === "Frutado"), true);
  assert.equal(olfactoryLibrary.some((family) => family.name === "Fermentado"), true);
  assert.equal(olfactoryLibrary.some((family) => family.name === "Outros"), false);
  assert.equal(olfactoryLibrary.some((family) => family.name === "Desvios de Qualidade"), true);
  assert.equal(sensoryLibrary.some((family) => family.name === "Fermentado"), false);
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
    "Floral", "Frutado", "Doce", "Chocolate / Cacau", "Especiarias", "Vegetal", "Fermentado", "Desvios de Qualidade",
  ]);
  const citrus = olfactoryLibrary.find((family) => family.name === "Frutado").subfamilies.find((item) => item.name === "Cítricos");
  assert.deepEqual(citrus.descriptors.map((item) => item.name), ["Limão", "Lima", "Tangerina", "Bergamota"]);
  assert.equal(new Set(citrus.descriptors.map((item) => item.assetPath)).size, 4);
  const whiteFlowers = olfactoryLibrary.find((family) => family.name === "Floral").subfamilies.find((item) => item.name === "Flores brancas");
  const criticalFlowers = whiteFlowers.descriptors.filter((item) => ["Flor de café", "Jasmim", "Flor de laranjeira"].includes(item.name));
  assert.equal(new Set(criticalFlowers.map((item) => item.assetPath)).size, 3);
});

test("Desvios de Qualidade substitui Outros sem misturar Láctico", () => {
  assert.equal(olfactoryLibrary.length, 8);
  const fermented = olfactoryLibrary.find((family) => family.name === "Fermentado");
  const deviations = olfactoryLibrary.find((family) => family.name === "Desvios de Qualidade");
  assert.ok(fermented.subfamilies.some((item) => item.name === "Láctico"));
  assert.equal(deviations.subfamilies.some((item) => item.descriptors.some((descriptor) => descriptor.name === "Láctico")), false);
  const descriptors = deviations.subfamilies.flatMap((item) => item.descriptors.map((descriptor) => descriptor.name));
  for (const expected of ["Fermentado azedo", "Mofo", "Fenólico", "Medicinal / Farmacêutico", "Queimado excessivo", "Plástico"])
    assert.ok(descriptors.includes(expected), `${expected} deve estar em Desvios de Qualidade`);
  assert.ok(deviations.subfamilies.some((item) => item.name === "Terroso"));
});

test("desvio aceita intensidade, adição e remoção com tipo explícito", () => {
  const deviation = { context: "AROMA", family: "Desvios de Qualidade", subfamily: "Mofo / Umidade", descriptor: "Mofo", level: 3, intensity: 2, perceptionType: "QUALITY_DEVIATION" };
  const cup = upsertOlfactoryPerception([], deviation);
  assert.equal(cup.length, 1);
  assert.equal(cup[0].intensity, 2);
  assert.equal(isQualityDeviation(cup[0]), true);
  assert.deepEqual(removeOlfactoryPerception(cup, deviation), []);
});

test("dados históricos de Outros são migrados semanticamente na leitura", () => {
  const historical = withOlfactorySelections({}, "AROMA", [
    { context: "AROMA", family: "Outros", subfamily: "Lácteo", descriptor: "Manteiga", level: 3, intensity: 3 },
    { context: "AROMA", family: "Outros", subfamily: "Terroso", descriptor: "Mofo", level: 3, intensity: 2 },
    { context: "AROMA", family: "Fermentado", subfamily: "Ácido fermentado", descriptor: "Vinagre", level: 3, intensity: 4 },
  ]);
  const restored = olfactorySelectionsFromStage(JSON.parse(JSON.stringify(historical)), "AROMA");
  assert.deepEqual(restored.map((item) => [item.family, item.subfamily, item.descriptor, item.perceptionType]), [
    ["Fermentado", "Láctico", "Manteiga", "SENSORY_ATTRIBUTE"],
    ["Desvios de Qualidade", "Mofo / Umidade", "Mofo", "QUALITY_DEVIATION"],
    ["Desvios de Qualidade", "Fermentação indesejada", "Avinagrado / Acético", "QUALITY_DEVIATION"],
  ]);
});

test("Sua Xícara separa atributos sensoriais de desvios de qualidade", async () => {
  const source = await readFile(new URL("../../../apps/web/src/components/cupping-olfactory-template.tsx", import.meta.url), "utf8");
  assert.match(source, /sensoryAttributes/);
  assert.match(source, /qualityDeviations/);
  assert.match(source, /Desvios de qualidade/);
});

test("Aroma percorre família, subfamília e descritores aprovados", async () => {
  const fruity = olfactoryLibrary.find((family) => family.name === "Frutado");
  assert.ok(fruity);
  assert.deepEqual(fruity.subfamilies.map((item) => item.name), [
    "Frutas vermelhas", "Cítricos", "Frutas tropicais", "Outras frutas", "Frutas secas",
  ]);
  const red = fruity.subfamilies.find((item) => item.name === "Frutas vermelhas");
  assert.deepEqual(red.descriptors.map((item) => item.name), [
    "Morango", "Cereja", "Framboesa", "Amora", "Mirtilo", "Groselha", "Romã", "Cranberry", "Uva vermelha",
  ]);
  for (const subfamily of fruity.subfamilies) {
    assert.ok(subfamily.assetPath, `${subfamily.name} deve ter uma fotografia principal`);
    for (const descriptor of subfamily.descriptors) {
      assert.ok(descriptor.assetPath, `${subfamily.name} > ${descriptor.name} deve ter fotografia local`);
      await access(new URL(`../../../apps/web/public${descriptor.assetPath}`, import.meta.url));
    }
    assert.equal(
      new Set(subfamily.descriptors.map((descriptor) => descriptor.assetPath)).size,
      subfamily.descriptors.length,
      `${subfamily.name} deve usar uma fotografia distinta por descritor`,
    );
  }
});

test("Frutado cobre seleção, intensidade e xícara em todas as subfamílias", () => {
  const fruity = olfactoryLibrary.find((family) => family.name === "Frutado");
  const samples = [
    ["Frutas vermelhas", "Morango"],
    ["Cítricos", "Limão"],
    ["Frutas tropicais", "Manga"],
    ["Outras frutas", "Pêssego"],
    ["Frutas secas", "Figo seco"],
  ];
  let cup = [];
  for (const [subfamilyName, descriptorName] of samples) {
    const subfamily = fruity.subfamilies.find((item) => item.name === subfamilyName);
    assert.ok(subfamily.descriptors.some((item) => item.name === descriptorName));
    cup = upsertOlfactoryPerception(cup, {
      context: "AROMA", family: "Frutado", subfamily: subfamilyName,
      descriptor: descriptorName, level: 3, intensity: 3,
    });
  }
  assert.equal(cup.length, 5);
  assert.deepEqual(cup.map((item) => item.descriptor), ["Morango", "Limão", "Manga", "Pêssego", "Figo seco"]);
  assert.equal(upsertOlfactoryPerception(cup, { ...cup[2], intensity: 5 }).find((item) => item.descriptor === "Manga").intensity, 5);
});

test("Doce usa fotografias locais distintas e o mesmo fluxo de percepção", async () => {
  const sweet = olfactoryLibrary.find((family) => family.name === "Doce");
  assert.deepEqual(sweet.subfamilies.map((item) => item.name), ["Açúcares caramelizados", "Confeitaria"]);
  assert.deepEqual(sweet.subfamilies[0].descriptors.map((item) => item.name), ["Caramelo", "Açúcar mascavo", "Mel"]);
  assert.deepEqual(sweet.subfamilies[1].descriptors.map((item) => item.name), ["Baunilha", "Doce de leite", "Toffee"]);
  for (const subfamily of sweet.subfamilies) {
    assert.ok(subfamily.assetPath, `${subfamily.name} deve ter uma fotografia principal`);
    assert.equal(new Set(subfamily.descriptors.map((item) => item.assetPath)).size, subfamily.descriptors.length);
    for (const descriptor of subfamily.descriptors) {
      assert.ok(descriptor.assetPath, `${descriptor.name} deve ter fotografia local`);
      await access(new URL(`../../../apps/web/public${descriptor.assetPath}`, import.meta.url));
    }
  }

  const selected = [
    ["Açúcares caramelizados", "Caramelo", 2],
    ["Açúcares caramelizados", "Açúcar mascavo", 3],
    ["Açúcares caramelizados", "Mel", 4],
    ["Confeitaria", "Baunilha", 3],
    ["Confeitaria", "Doce de leite", 5],
    ["Confeitaria", "Toffee", 2],
  ].reduce((cup, [subfamily, descriptor, intensity]) => upsertOlfactoryPerception(cup, {
    context: "FRAGRANCE", family: "Doce", subfamily, descriptor, level: 3, intensity,
  }), []);
  assert.equal(selected.length, 6);
  const edited = upsertOlfactoryPerception(selected, { ...selected[1], intensity: 5 });
  assert.equal(edited.find((item) => item.descriptor === "Açúcar mascavo").intensity, 5);
  assert.equal(removeOlfactoryPerception(edited, selected[0]).length, 5);
});

test("Floral usa fotografias reais distintas e preserva capas aprovadas", async () => {
  const floral = olfactoryLibrary.find((family) => family.name === "Floral");
  assert.deepEqual(floral.subfamilies.map((item) => item.name), ["Flores brancas", "Flores perfumadas"]);
  const white = floral.subfamilies[0];
  const perfumed = floral.subfamilies[1];
  assert.deepEqual(white.descriptors.map((item) => item.name), ["Flor de café", "Jasmim", "Flor de laranjeira", "Madressilva"]);
  assert.deepEqual(perfumed.descriptors.map((item) => item.name), ["Rosa", "Lavanda", "Violeta"]);
  assert.equal(white.assetPath, white.descriptors.find((item) => item.name === "Flor de café").assetPath);
  assert.equal(perfumed.assetPath, perfumed.descriptors.find((item) => item.name === "Rosa").assetPath);
  for (const subfamily of floral.subfamilies) {
    assert.equal(new Set(subfamily.descriptors.map((item) => item.assetPath)).size, subfamily.descriptors.length);
    for (const descriptor of subfamily.descriptors) {
      assert.ok(descriptor.assetPath, `${descriptor.name} deve ter fotografia local`);
      await access(new URL(`../../../apps/web/public${descriptor.assetPath}`, import.meta.url));
    }
  }

  const jasmine = { context: "FRAGRANCE", family: "Floral", subfamily: "Flores brancas", descriptor: "Jasmim", level: 3, intensity: 3 };
  const rose = { context: "FRAGRANCE", family: "Floral", subfamily: "Flores perfumadas", descriptor: "Rosa", level: 3, intensity: 4 };
  const cup = upsertOlfactoryPerception(upsertOlfactoryPerception([], jasmine), rose);
  assert.equal(cup.length, 2);
  assert.equal(upsertOlfactoryPerception(cup, { ...rose, intensity: 5 }).find((item) => item.descriptor === "Rosa").intensity, 5);
  assert.deepEqual(removeOlfactoryPerception(cup, jasmine), [rose]);
});

test("Chocolate / Cacau cobre as três subfamílias com fotografias reais", async () => {
  const chocolate = olfactoryLibrary.find((family) => family.name === "Chocolate / Cacau");
  assert.deepEqual(chocolate.subfamilies.map((item) => item.name), [
    "Cacau / Chocolate", "Frutos secos / Nozes", "Cereais / Torrado",
  ]);
  assert.deepEqual(chocolate.subfamilies[0].descriptors.map((item) => item.name), ["Cacau", "Chocolate amargo", "Chocolate ao leite"]);
  assert.deepEqual(chocolate.subfamilies[1].descriptors.map((item) => item.name), ["Avelã torrada", "Amêndoa torrada", "Noz"]);
  assert.deepEqual(chocolate.subfamilies[2].descriptors.map((item) => item.name), ["Malte", "Pão torrado", "Café torrado"]);
  for (const subfamily of chocolate.subfamilies) {
    assert.ok(subfamily.assetPath, `${subfamily.name} deve ter fotografia principal`);
    assert.equal(new Set(subfamily.descriptors.map((item) => item.assetPath)).size, subfamily.descriptors.length);
    for (const descriptor of subfamily.descriptors) {
      assert.ok(descriptor.assetPath, `${descriptor.name} deve ter fotografia local`);
      await access(new URL(`../../../apps/web/public${descriptor.assetPath}`, import.meta.url));
    }
  }

  const cacao = { context: "FRAGRANCE", family: "Chocolate / Cacau", subfamily: "Cacau / Chocolate", descriptor: "Cacau", level: 3, intensity: 3 };
  const malt = { context: "FRAGRANCE", family: "Chocolate / Cacau", subfamily: "Cereais / Torrado", descriptor: "Malte", level: 3, intensity: 4 };
  const cup = upsertOlfactoryPerception(upsertOlfactoryPerception([], cacao), malt);
  assert.equal(cup.length, 2);
  assert.equal(upsertOlfactoryPerception(cup, { ...cacao, intensity: 5 }).find((item) => item.descriptor === "Cacau").intensity, 5);
  assert.deepEqual(removeOlfactoryPerception(cup, cacao), [malt]);
});

test("Desvios de Qualidade possui cinco subfamílias visíveis com capas locais", async () => {
  const deviations = olfactoryLibrary.find((family) => family.name === "Desvios de Qualidade");
  assert.ok(deviations);
  assert.deepEqual(deviations.subfamilies.map((item) => item.name), [
    "Fermentação indesejada", "Mofo / Umidade", "Terroso", "Queimado / Fumaça", "Químico / Contaminação",
  ]);
  assert.deepEqual(deviations.subfamilies[0].descriptors.map((item) => item.name), [
    "Fermentado azedo", "Avinagrado / Acético", "Alcoólico excessivo", "Fermentação excessiva", "Fenólico", "Medicinal / Farmacêutico",
  ]);
  assert.deepEqual(deviations.subfamilies[1].descriptors.map((item) => item.name), ["Mofo", "Porão úmido", "Papel / Papelão úmido", "Madeira úmida", "Saco de juta úmido"]);
  assert.deepEqual(deviations.subfamilies[2].descriptors.map((item) => item.name), ["Terra úmida", "Terra seca", "Poeira"]);
  assert.deepEqual(deviations.subfamilies[3].descriptors.map((item) => item.name), ["Queimado excessivo", "Fumaça", "Cinzas", "Carbonizado"]);
  assert.deepEqual(deviations.subfamilies[4].descriptors.map((item) => item.name), ["Combustível / Petróleo", "Plástico", "Borracha", "Solvente", "Produto químico"]);
  for (const subfamily of deviations.subfamilies) {
    assert.ok(subfamily.assetPath, `${subfamily.name} deve ter uma capa local`);
    await access(new URL(`../../../apps/web/public${subfamily.assetPath}`, import.meta.url));
  }
});

test("Fermentado positivo possui quatro referências fotográficas por subfamília", async () => {
  const fermented = olfactoryLibrary.find((family) => family.name === "Fermentado");
  assert.ok(fermented);
  const expected = {
    "Láctico": ["Iogurte natural", "Leite fermentado", "Kefir", "Creme azedo"],
    "Vínico": ["Vinho tinto", "Vinho branco", "Uva vínica", "Vinho licoroso"],
    "Alcoólico limpo": ["Rum", "Conhaque / Brandy", "Whisky", "Licor"],
    "Frutado fermentado limpo": ["Cereja fermentada", "Uva fermentada", "Frutas vermelhas fermentadas", "Frutas tropicais fermentadas"],
  };
  assert.deepEqual(fermented.subfamilies.map((item) => item.name), Object.keys(expected));
  const assets = [];
  for (const subfamily of fermented.subfamilies) {
    assert.deepEqual(subfamily.descriptors.map((item) => item.name), expected[subfamily.name]);
    assert.ok(subfamily.assetPath, `${subfamily.name} deve ter fotografia principal`);
    for (const descriptor of subfamily.descriptors) {
      assert.ok(descriptor.assetPath, `${descriptor.name} deve ter fotografia local`);
      assets.push(descriptor.assetPath);
      await access(new URL(`../../../apps/web/public${descriptor.assetPath}`, import.meta.url));
    }
  }
  assert.equal(new Set(assets).size, 16, "cada descritor deve possuir fotografia própria");
});

test("Fermentado preserva multisseleção, intensidades e famílias diferentes no reload", () => {
  const selections = [
    ["Fermentado", "Láctico", "Iogurte natural", 3],
    ["Fermentado", "Láctico", "Kefir", 2],
    ["Fermentado", "Vínico", "Vinho tinto", 3],
    ["Desvios de Qualidade", "Mofo / Umidade", "Mofo", 3],
    ["Desvios de Qualidade", "Mofo / Umidade", "Porão úmido", 2],
  ].reduce((cup, [family, subfamily, descriptor, intensity]) => upsertOlfactoryPerception(cup, {
    context: "FRAGRANCE", family, subfamily, descriptor, level: 3, intensity,
  }), []);
  assert.equal(selections.length, 5);
  assert.deepEqual(selections.map((item) => [item.descriptor, item.intensity]), [
    ["Iogurte natural", 3], ["Kefir", 2], ["Vinho tinto", 3], ["Mofo", 3], ["Porão úmido", 2],
  ]);

  const fragranceDraft = withOlfactorySelections({}, "FRAGRANCE", selections);
  const aromaDraft = withOlfactorySelections(fragranceDraft, "AROMA", [
    { context: "AROMA", family: "Fermentado", subfamily: "Láctico", descriptor: "Creme azedo", level: 3, intensity: 4 },
  ]);
  const restored = JSON.parse(JSON.stringify(aromaDraft));
  const restoredFragrance = olfactorySelectionsFromStage(restored, "FRAGRANCE");
  assert.deepEqual(restoredFragrance.map((item) => [item.family, item.subfamily, item.descriptor, item.intensity]),
    selections.map((item) => [item.family, item.subfamily, item.descriptor, item.intensity]));
  assert.equal(restoredFragrance.find((item) => item.descriptor === "Mofo").perceptionType, "QUALITY_DEVIATION");
  assert.deepEqual(olfactorySelectionsFromStage(restored, "AROMA").map((item) => [item.descriptor, item.intensity]), [["Creme azedo", 4]]);
});

test("Fermentado mantém seis percepções com intensidades individuais", () => {
  const expected = [
    ["Láctico", "Iogurte natural", 3],
    ["Láctico", "Kefir", 2],
    ["Vínico", "Vinho tinto", 3],
    ["Alcoólico limpo", "Rum", 2],
    ["Alcoólico limpo", "Conhaque / Brandy", 3],
    ["Frutado fermentado limpo", "Cereja fermentada", 4],
  ];
  const selected = expected.reduce((cup, [subfamily, descriptor, intensity]) => upsertOlfactoryPerception(cup, {
    context: "FRAGRANCE", family: "Fermentado", subfamily, descriptor, level: 3, intensity,
  }), []);
  assert.equal(selected.length, 6);
  assert.deepEqual(selected.map((item) => [item.subfamily, item.descriptor, item.intensity]), expected);
});

test("Fermentado isola intensidades entre Fragrância e Aroma após serialização", () => {
  const fragrance = [
    { context: "FRAGRANCE", family: "Fermentado", subfamily: "Alcoólico limpo", descriptor: "Rum", level: 3, intensity: 2 },
    { context: "FRAGRANCE", family: "Fermentado", subfamily: "Láctico", descriptor: "Kefir", level: 3, intensity: 3 },
  ];
  const aroma = [
    { context: "AROMA", family: "Fermentado", subfamily: "Alcoólico limpo", descriptor: "Rum", level: 3, intensity: 4 },
    { context: "AROMA", family: "Fermentado", subfamily: "Láctico", descriptor: "Kefir", level: 3, intensity: 1 },
  ];
  const draft = withOlfactorySelections(withOlfactorySelections({}, "FRAGRANCE", fragrance), "AROMA", aroma);
  const restored = JSON.parse(JSON.stringify(draft));
  assert.deepEqual(olfactorySelectionsFromStage(restored, "FRAGRANCE").map((item) => [item.descriptor, item.intensity]), [["Rum", 2], ["Kefir", 3]]);
  assert.deepEqual(olfactorySelectionsFromStage(restored, "AROMA").map((item) => [item.descriptor, item.intensity]), [["Rum", 4], ["Kefir", 1]]);
});

test("descritores genéricos históricos de Fermentado são restaurados sem perda", () => {
  const historical = withOlfactorySelections({}, "FRAGRANCE", [
    { context: "FRAGRANCE", family: "Fermentado", subfamily: "Láctico", descriptor: "Láctico", level: 3, intensity: 3 },
    { context: "FRAGRANCE", family: "Fermentado", subfamily: "Vínico", descriptor: "Vínico", level: 3, intensity: 2 },
    { context: "FRAGRANCE", family: "Fermentado", subfamily: "Alcoólico limpo", descriptor: "Alcoólico limpo", level: 3, intensity: 4 },
    { context: "FRAGRANCE", family: "Fermentado", subfamily: "Frutado fermentado limpo", descriptor: "Frutado fermentado limpo", level: 3, intensity: 5 },
  ]);
  assert.deepEqual(olfactorySelectionsFromStage(historical, "FRAGRANCE").map((item) => [item.descriptor, item.intensity]), [
    ["Iogurte natural", 3], ["Vinho tinto", 2], ["Rum", 4], ["Cereja fermentada", 5],
  ]);
});

test("interface mostra Desvios de Qualidade sem paginação", async () => {
  const component = await readFile(new URL("../../../apps/web/src/components/cupping-olfactory-template.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(component, /deviationPage|1 \/ 2|Grupos de subfamílias de Desvios de Qualidade/);
  assert.match(component, /const visibleSubfamilies = family\.subfamilies/);
});

test("aliases históricos de Desvios são migrados sem perda", () => {
  const historical = withOlfactorySelections({}, "FRAGRANCE", [
    { context: "FRAGRANCE", family: "Desvios de Qualidade", subfamily: "Fenólico / Medicinal", descriptor: "Medicinal", level: 3, intensity: 2 },
    { context: "FRAGRANCE", family: "Desvios de Qualidade", subfamily: "Químico / Solvente", descriptor: "Petróleo", level: 3, intensity: 4 },
    { context: "FRAGRANCE", family: "Desvios de Qualidade", subfamily: "Fermentação indesejada", descriptor: "Acético excessivo", level: 3, intensity: 4 },
    { context: "FRAGRANCE", family: "Desvios de Qualidade", subfamily: "Mofo / Umidade", descriptor: "Bolor", level: 3, intensity: 3 },
    { context: "FRAGRANCE", family: "Desvios de Qualidade", subfamily: "Queimado / Fumaça", descriptor: "Cinza", level: 3, intensity: 3 },
    { context: "FRAGRANCE", family: "Desvios de Qualidade", subfamily: "Químico / Contaminação", descriptor: "Químico", level: 3, intensity: 3 },
  ]);
  const restored = olfactorySelectionsFromStage(historical, "FRAGRANCE");
  assert.deepEqual(restored.map((item) => [item.subfamily, item.descriptor]), [
    ["Fermentação indesejada", "Medicinal / Farmacêutico"],
    ["Químico / Contaminação", "Combustível / Petróleo"],
    ["Fermentação indesejada", "Avinagrado / Acético"],
    ["Mofo / Umidade", "Mofo"],
    ["Queimado / Fumaça", "Cinzas"],
    ["Químico / Contaminação", "Produto químico"],
  ]);
});

test("adicionar, editar intensidade e remover aroma preserva os demais", () => {
  const strawberry = { context: "AROMA", family: "Frutado", subfamily: "Frutas vermelhas", descriptor: "Morango", level: 3, intensity: 3 };
  const jasmine = { context: "AROMA", family: "Floral", subfamily: "Flores brancas", descriptor: "Jasmim", level: 3, intensity: 2 };
  const multiple = upsertOlfactoryPerception(upsertOlfactoryPerception([], strawberry), jasmine);
  assert.equal(multiple.length, 2);
  const edited = upsertOlfactoryPerception(multiple, { ...strawberry, intensity: 5 });
  assert.equal(edited.find((item) => item.descriptor === "Morango").intensity, 5);
  assert.equal(edited.find((item) => item.descriptor === "Jasmim").intensity, 2);
  assert.deepEqual(removeOlfactoryPerception(edited, strawberry), [jasmine]);
});

test("seleção múltipla global preserva famílias, subfamílias e intensidades independentes sem duplicar", () => {
  const strawberry = { context: "AROMA", family: "Frutado", subfamily: "Frutas vermelhas", descriptor: "Morango", level: 3, intensity: 5 };
  const cherry = { context: "AROMA", family: "Frutado", subfamily: "Frutas vermelhas", descriptor: "Cereja", level: 3, intensity: 3 };
  const phenolic = { context: "AROMA", family: "Desvios de Qualidade", subfamily: "Fermentação indesejada", descriptor: "Fenólico", level: 3, intensity: 1, perceptionType: "QUALITY_DEVIATION" };
  let cup = upsertOlfactoryPerception([], strawberry);
  cup = upsertOlfactoryPerception(cup, cherry);
  cup = upsertOlfactoryPerception(cup, phenolic);
  assert.equal(cup.length, 3);
  assert.deepEqual(cup.map((item) => [item.descriptor, item.intensity]), [["Morango", 5], ["Cereja", 3], ["Fenólico", 1]]);
  cup = upsertOlfactoryPerception(cup, { ...cherry, intensity: 4 });
  assert.equal(cup.length, 3);
  assert.equal(cup.find((item) => item.descriptor === "Cereja").intensity, 4);
  cup = removeOlfactoryPerception(cup, strawberry);
  assert.deepEqual(cup.map((item) => item.descriptor), ["Cereja", "Fenólico"]);
});

test("Mofo, Porão úmido e Madeira úmida coexistem com intensidades independentes", () => {
  const base = { context: "AROMA", family: "Desvios de Qualidade", subfamily: "Mofo / Umidade", level: 3, perceptionType: "QUALITY_DEVIATION" };
  const mold = { ...base, descriptor: "Mofo", intensity: 3 };
  const cellar = { ...base, descriptor: "Porão úmido", intensity: 4 };
  const wood = { ...base, descriptor: "Madeira úmida", intensity: 2 };
  let selected = upsertOlfactoryPerception([], mold);
  selected = upsertOlfactoryPerception(selected, cellar);
  selected = upsertOlfactoryPerception(selected, wood);
  assert.deepEqual(selected.map((item) => [item.descriptor, item.intensity]), [
    ["Mofo", 3], ["Porão úmido", 4], ["Madeira úmida", 2],
  ]);
  for (const active of [mold, cellar, wood])
    assert.equal(selected.find((item) => item.descriptor === active.descriptor).intensity, active.intensity);
});

test("troca de família, momento e reload preserva seleções e intensidades", () => {
  const aroma = [
    { context: "AROMA", family: "Desvios de Qualidade", subfamily: "Mofo / Umidade", descriptor: "Mofo", level: 3, intensity: 3, perceptionType: "QUALITY_DEVIATION" },
    { context: "AROMA", family: "Desvios de Qualidade", subfamily: "Mofo / Umidade", descriptor: "Porão úmido", level: 3, intensity: 4, perceptionType: "QUALITY_DEVIATION" },
    { context: "AROMA", family: "Desvios de Qualidade", subfamily: "Mofo / Umidade", descriptor: "Madeira úmida", level: 3, intensity: 2, perceptionType: "QUALITY_DEVIATION" },
    { context: "AROMA", family: "Frutado", subfamily: "Frutas vermelhas", descriptor: "Morango", level: 3, intensity: 5, perceptionType: "SENSORY_ATTRIBUTE" },
  ];
  const fragrance = [
    { context: "FRAGRANCE", family: "Floral", subfamily: "Flores perfumadas", descriptor: "Lavanda", level: 3, intensity: 1, perceptionType: "SENSORY_ATTRIBUTE" },
  ];
  let stage = withOlfactorySelections({}, "AROMA", aroma);
  stage = withOlfactorySelections(stage, "FRAGRANCE", fragrance);
  const reload = JSON.parse(JSON.stringify(stage));
  assert.deepEqual(olfactorySelectionsFromStage(reload, "AROMA"), aroma);
  assert.deepEqual(olfactorySelectionsFromStage(reload, "FRAGRANCE"), fragrance);
});

test("todos os descritores olfativos ativos possuem fotografia local própria", async () => {
  const descriptors = olfactoryLibrary.flatMap((family) => family.subfamilies.flatMap((subfamily) => subfamily.descriptors));
  assert.equal(descriptors.every((descriptor) => Boolean(descriptor.assetPath)), true);
  assert.equal(new Set(descriptors.map((descriptor) => descriptor.assetPath)).size, descriptors.length);
  for (const descriptor of descriptors) await access(new URL(`../../../apps/web/public${descriptor.assetPath}`, import.meta.url));
});

test("as oito famílias da roda inicial possuem fotografia local", async () => {
  assert.equal(olfactoryLibrary.length, 8);
  assert.equal(olfactoryLibrary.every((family) => Boolean(family.assetPath)), true);
  for (const family of olfactoryLibrary) await access(new URL(`../../../apps/web/public${family.assetPath}`, import.meta.url));
});

test("autosave e restauração mantêm Aroma isolado entre amostras", () => {
  const strawberry = [{ context: "AROMA", family: "Frutado", subfamily: "Frutas vermelhas", descriptor: "Morango", level: 3, intensity: 4 }];
  const caramel = [{ context: "AROMA", family: "Doce", subfamily: "Açúcares caramelizados", descriptor: "Caramelo", level: 3, intensity: 3 }];
  const sampleOne = withOlfactorySelections({}, "AROMA", strawberry);
  const sampleTwo = withOlfactorySelections({}, "AROMA", caramel);
  assert.deepEqual(olfactorySelectionsFromStage(JSON.parse(JSON.stringify(sampleOne)), "AROMA"), strawberry);
  assert.deepEqual(olfactorySelectionsFromStage(JSON.parse(JSON.stringify(sampleTwo)), "AROMA"), caramel);
  assert.notDeepEqual(sampleOne, sampleTwo);
});

test("interface Aroma exige intensidade, adiciona à xícara e continua para Sabor", async () => {
  const component = await readFile(new URL("../../../apps/web/src/components/cupping-mobile.tsx", import.meta.url), "utf8");
  const page = await readFile(new URL("../../../apps/web/src/app/cupping/mobile/session/[sessionId]/sample/[sampleId]/[step]/page.tsx", import.meta.url), "utf8");
  assert.match(component, /Quanto você percebe\?/);
  assert.match(component, /Adicionar à xícara/);
  assert.match(component, /Limpar todos/);
  assert.match(page, /cupping-draft:\$\{sessionId\}:\$\{sampleId\}/);
  assert.match(page, /Continuar para Sabor/);
});

test("interface separa coleção selecionada do descritor ativo", async () => {
  const component = await readFile(new URL("../../../apps/web/src/components/cupping-olfactory-template.tsx", import.meta.url), "utf8");
  assert.match(component, /const \[selectedDescriptors, setSelectedDescriptors\]/);
  assert.match(component, /const selectedNames = \[\.\.\.value, \.\.\.selectedDescriptors\]/);
  assert.match(component, /const active = pending\?\.descriptor === descriptor\.name/);
  assert.match(component, /aria-pressed=\{selected\}/);
  assert.match(component, /setSelectedDescriptors\(\(current\) => upsertOlfactoryPerception\(current, selection\)\)/);
  assert.match(component, /onChange\(upsertOlfactoryPerception\(value, selection\)\)/);
});
test("navegação sensorial global preserva famílias e expõe revisão rápida", async () => {
  const source = await readFile(new URL("../../../apps/web/src/components/cupping-olfactory-template.tsx", import.meta.url), "utf8");
  assert.match(source, /Voltar à roda/);
  assert.match(source, /Sua Xícara · \{value\.length\}/);
  assert.match(source, /familyCounts/);
  assert.match(source, /groupedSensoryAttributes/);
  assert.match(source, /Retornar à exploração/);
  assert.match(source, /const goToWheel/);
  assert.match(source, /onEdit=\{\(selection\) => \{ edit\(selection\)/);
  assert.match(source, /removeOlfactoryPerception\(value, selection\)/);
});

test("acesso mobile persiste token, recupera fragmento e usa API same-origin", async () => {
  const access = await readFile(new URL("../../../apps/web/src/lib/cupping-mobile-access.ts", import.meta.url), "utf8");
  const invite = await readFile(new URL("../../../apps/web/src/app/cupping/mobile/invite/[token]/page.tsx", import.meta.url), "utf8");
  const nextConfig = await readFile(new URL("../../../apps/web/next.config.ts", import.meta.url), "utf8");
  assert.match(access, /localStorage\.setItem\(tokenKey\(sessionId\), token\)/);
  assert.match(access, /window\.location\.hash/);
  assert.match(access, /export const CUPPING_API = "\/api"/);
  assert.match(invite, /#access=\$\{encodeURIComponent\(data\.accessToken\)\}/);
  assert.match(nextConfig, /API_INTERNAL_URL/);
});

test("sessão carregada não é bloqueada por falha transitória e rascunho sincroniza ao reconectar", async () => {
  const session = await readFile(new URL("../../../apps/web/src/app/cupping/mobile/session/[sessionId]/page.tsx", import.meta.url), "utf8");
  const evaluation = await readFile(new URL("../../../apps/web/src/app/cupping/mobile/session/[sessionId]/sample/[sampleId]/[step]/page.tsx", import.meta.url), "utf8");
  const access = await readFile(new URL("../../../apps/web/src/lib/cupping-mobile-access.ts", import.meta.url), "utf8");
  assert.match(session, /!loading && !data && accessError/);
  assert.match(session, /Sem conexão — você pode continuar/);
  assert.match(evaluation, /localStorage\.setItem\(key, JSON\.stringify\(draft\)\)/);
  assert.match(evaluation, /addEventListener\("online", synchronize\)/);
  assert.match(evaluation, /Sem conexão · rascunho neste dispositivo/);
  assert.match(access, /transientStatus = new Set\(\[502, 503, 504\]\)/);
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
