"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudOff,
} from "lucide-react";
import {
  acidityQualityOptions,
  acidityReferences,
  aftertasteCharacterOptions,
  buildAcidityPersistence,
  buildBodyPersistence,
  bodyTextureOptions,
  bodyWeightOptions,
  olfactorySelectionsFromStage,
  withOlfactorySelections,
  canContinueSensoryStep,
  cleanCupDefects,
  cuppingReviewIssues,
  cupsScore,
  priorScoresInitiallyExpanded,
  Traditional100ScoringEngine,
  usesGeneralSensoryLibrary,
  validateCleanCupState,
  type CuppingAttribute,
} from "@bbos/shared";
import {
  AcidityQualitySelector,
  AcidityTypeSelector,
  AftertastePersistenceSelector,
  BodyPerceptionSelector,
  BodyTextureSelector,
  BalanceIntegrationVisual,
  CuppingScorePicker,
  CuppingSensoryLibrary,
  CuppingOlfactoryBowl,
  CuppingSensoryProfile,
  CuppingTrainingHint,
  FiveCupSelector,
  type CupState,
  type MobileSelection,
} from "@/components/cupping-mobile";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
const steps = [
  "aroma",
  "sabor",
  "finalizacao",
  "acidez",
  "corpo",
  "equilibrio",
  "cups",
  "overall",
  "review",
  "result",
] as const;
type StepMeta = [
  string,
  string,
  CuppingAttribute,
  "AROMA" | "FLAVOR" | "AFTERTASTE" | "ACIDITY" | "BODY" | null,
];
const copy: Partial<Record<(typeof steps)[number], StepMeta>> = {
  aroma: [
    "Fragrância / Aroma",
    "O que esse aroma te lembra?",
    "fragranceAroma",
    "AROMA",
  ],
  sabor: ["Sabor", "O que você percebe na boca?", "flavor", "FLAVOR"],
  finalizacao: [
    "Finalização",
    "O que fica depois que o café vai embora?",
    "aftertaste",
    null,
  ],
  acidez: ["Acidez", "Que tipo de acidez você percebe?", "acidity", null],
  corpo: ["Corpo", "Que sensação de peso e textura aparece?", "body", "BODY"],
  equilibrio: ["Equilíbrio", "Como os atributos se integram?", "balance", null],
  overall: [
    "Avaliação geral",
    "Considerando toda a experiência, qual é sua avaliação geral?",
    "overall",
    null,
  ],
};
type Draft = {
  scores: Partial<Record<CuppingAttribute, number>>;
  selections: MobileSelection[];
  cups: CupState[];
  stageData: Record<string, any>;
  affectiveMemory?: string;
  finalImpression?: string;
  acidityType?: string;
  bodyType?: string;
  aftertastePersistence?: string;
};
const defaultCups: CupState[] = (
  ["UNIFORMITY", "SWEETNESS", "CLEAN_CUP"] as const
).flatMap((attribute) =>
  Array.from({ length: 5 }, (_, index) => ({
    attribute,
    cupNumber: index + 1,
    selected: true,
  })),
);
const initial: Draft = {
  scores: { uniformity: 10, sweetness: 10, cleanCup: 10 },
  selections: [],
  cups: defaultCups,
  stageData: {},
};
function mergeCups(saved: CupState[] | undefined) {
  return defaultCups.map(
    (fallback) =>
      saved?.find(
        (cup) =>
          cup.attribute === fallback.attribute &&
          cup.cupNumber === fallback.cupNumber,
      ) ?? fallback,
  );
}
const requiredScoreByStep: Partial<
  Record<(typeof steps)[number], CuppingAttribute>
> = {
  aroma: "fragranceAroma",
  sabor: "flavor",
  finalizacao: "aftertaste",
  acidez: "acidity",
  corpo: "body",
  equilibrio: "balance",
  overall: "overall",
};
const reviewAttributes: Array<{
  key: CuppingAttribute;
  label: string;
  route: (typeof steps)[number];
}> = [
  { key: "fragranceAroma", label: "Fragrância / Aroma", route: "aroma" },
  { key: "flavor", label: "Sabor", route: "sabor" },
  { key: "aftertaste", label: "Finalização", route: "finalizacao" },
  { key: "acidity", label: "Acidez", route: "acidez" },
  { key: "body", label: "Corpo", route: "corpo" },
  { key: "balance", label: "Equilíbrio", route: "equilibrio" },
  { key: "uniformity", label: "Uniformidade", route: "cups" },
  { key: "sweetness", label: "Doçura", route: "cups" },
  { key: "cleanCup", label: "Xícara Limpa", route: "cups" },
  { key: "overall", label: "Avaliação Geral", route: "overall" },
];

function draftFromEvaluation(evaluation: any): Draft {
  const scores: Draft["scores"] = {};
  const fields: Array<[CuppingAttribute, string]> = [
    ["fragranceAroma", "fragrance"],
    ["flavor", "flavor"],
    ["aftertaste", "finish"],
    ["acidity", "acidity"],
    ["body", "body"],
    ["balance", "balance"],
    ["uniformity", "uniformity"],
    ["sweetness", "sweetness"],
    ["cleanCup", "cleanliness"],
    ["overall", "overall"],
  ];
  for (const [clientKey, serverKey] of fields)
    if (evaluation?.[serverKey] != null)
      scores[clientKey] = Number(evaluation[serverKey]);
  const savedCups: CupState[] = (evaluation?.cupEvaluations ?? []).map(
    (cup: any) => ({
      attribute: cup.attribute,
      cupNumber: cup.cupNumber,
      selected: cup.selected,
      notes: cup.notes ?? undefined,
      defectType: cup.defect?.defectType,
      defectSeverity: cup.defect?.defectSeverity,
      defectDescription: cup.defect?.defectDescription ?? undefined,
    }),
  );
  return {
    ...initial,
    scores: { ...initial.scores, ...scores },
    selections: evaluation?.descriptorSelections ?? [],
    cups: mergeCups(savedCups),
    stageData:
      evaluation?.stageData && typeof evaluation.stageData === "object"
        ? evaluation.stageData
        : {},
    affectiveMemory: evaluation?.affectiveMemory ?? undefined,
    finalImpression: evaluation?.finalImpression ?? undefined,
    acidityType: evaluation?.acidityType ?? undefined,
    bodyType: evaluation?.bodyType ?? undefined,
    aftertastePersistence: evaluation?.aftertastePersistence ?? undefined,
  };
}
export default function CuppingStepPage() {
  const { sessionId, sampleId, step } = useParams<{
    sessionId: string;
    sampleId: string;
    step: string;
  }>();
  const router = useRouter();
  const key = `cupping-draft:${sessionId}:${sampleId}`;
  const [draft, setDraft] = React.useState<Draft>(initial);
  const [context, setContext] = React.useState<any>(null);
  const [saveState, setSaveState] = React.useState("Salvo");
  const [error, setError] = React.useState("");
  const [showPriorScores, setShowPriorScores] = React.useState(
    priorScoresInitiallyExpanded,
  );
  const [olfactoryMoment, setOlfactoryMoment] = React.useState<
    "FRAGRANCE" | "AROMA"
  >("FRAGRANCE");
  const [, setOlfactoryDepth] = React.useState(0);
  const [bowlExpanded, setBowlExpanded] = React.useState(true);
  const loaded = React.useRef(false);
  const finalized = React.useRef(false);
  React.useEffect(() => {
    const local = localStorage.getItem(key);
    const token = sessionStorage.getItem(`cupping-token:${sessionId}`);
    fetch(`${API}/cupping/mobile/sessions/${sessionId}`, {
      headers: { authorization: `Bearer ${token ?? ""}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setContext(data);
        const evaluation = data?.session?.evaluations?.find(
          (item: any) => item.sampleId === sampleId,
        );
        finalized.current = evaluation?.status === "COMPLETED";
        if (local) {
          const stored = JSON.parse(local) as Draft;
          setDraft({
            ...initial,
            ...stored,
            scores: { ...initial.scores, ...stored.scores },
            cups: mergeCups(stored.cups),
          });
        } else if (evaluation) setDraft(draftFromEvaluation(evaluation));
        loaded.current = true;
      });
  }, [key, sampleId, sessionId]);
  React.useEffect(() => {
    if (!loaded.current || finalized.current) return;
    localStorage.setItem(key, JSON.stringify(draft));
    setSaveState(navigator.onLine ? "Salvando…" : "Rascunho offline");
    const timer = setTimeout(async () => {
      if (!navigator.onLine) return;
      const token = sessionStorage.getItem(`cupping-token:${sessionId}`);
      const response = await fetch(
        `${API}/cupping/mobile/sessions/${sessionId}/samples/${sampleId}/evaluation`,
        {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token ?? ""}`,
          },
          body: JSON.stringify(draft),
        },
      );
      setSaveState(response.ok ? "Salvo" : "Alterações não salvas");
    }, 650);
    return () => clearTimeout(timer);
  }, [draft, key, sampleId, sessionId]);
  const index = steps.indexOf(step as any);
  const meta = copy[step as (typeof steps)[number]];
  const update = (patch: Partial<Draft>) =>
    setDraft((current) => ({ ...current, ...patch }));
  const setScore = (attribute: CuppingAttribute, value: number) =>
    update({ scores: { ...draft.scores, [attribute]: value } });
  const next = steps[Math.min(index + 1, steps.length - 1)];
  const previous = steps[Math.max(index - 1, 0)];
  const sample = context?.session?.samples?.find(
    (item: any) => item.sample.id === sampleId,
  )?.sample;
  const cupValues = (attribute: CupState["attribute"]) =>
    Array.from(
      { length: 5 },
      (_, i) =>
        draft.cups.find(
          (c) => c.attribute === attribute && c.cupNumber === i + 1,
        )?.selected ?? true,
    );
  const cupScores = {
    uniformity: cupsScore(cupValues("UNIFORMITY")),
    sweetness: cupsScore(cupValues("SWEETNESS")),
    cleanCup: cupsScore(cupValues("CLEAN_CUP")),
  };
  const requiredScore = requiredScoreByStep[step as (typeof steps)[number]];
  const cleanCupStates = Array.from(
    { length: 5 },
    (_, index) =>
      draft.cups.find(
        (cup) => cup.attribute === "CLEAN_CUP" && cup.cupNumber === index + 1,
      ) ?? {
        attribute: "CLEAN_CUP" as const,
        cupNumber: index + 1,
        selected: true,
      },
  );
  const cleanCupsValid = validateCleanCupState(
    cupScores.cleanCup,
    cleanCupStates,
  );
  const invalidCleanCupNumbers = cleanCupStates
    .filter(
      (cup) =>
        !cup.selected &&
        (!cup.defectType ||
          !cup.defectSeverity ||
          (cup.defectType === "Outro" && !cup.defectDescription?.trim())),
    )
    .map((cup) => cup.cupNumber);
  const acidityTypes = Array.isArray(draft.stageData.acidityTypes)
    ? draft.stageData.acidityTypes.filter(
        (value: unknown): value is string => typeof value === "string",
      )
    : draft.acidityType
      ? draft.acidityType.split(" + ").filter(Boolean)
      : [];
  const bodyTextures = Array.isArray(draft.stageData.bodyTextures)
    ? draft.stageData.bodyTextures.filter(
        (value: unknown): value is string => typeof value === "string",
      )
    : draft.bodyType
      ? draft.bodyType.split(" + ").filter(Boolean)
      : [];
  const fragranceSelections = olfactorySelectionsFromStage(
    draft.stageData,
    "FRAGRANCE",
  ) as MobileSelection[];
  const persistedAromaSelections = olfactorySelectionsFromStage(
    draft.stageData,
    "AROMA",
  ) as MobileSelection[];
  const aromaSelections = persistedAromaSelections.length
    ? persistedAromaSelections
    : draft.selections.filter((item) => item.context === "AROMA");
  const canContinue =
    step === "aroma" && olfactoryMoment === "FRAGRANCE"
      ? true
      : step === "cups"
      ? cleanCupsValid
      : requiredScore
        ? canContinueSensoryStep(draft.scores[requiredScore])
        : true;
  let scoring: ReturnType<Traditional100ScoringEngine["calculate"]> | null =
    null;
  try {
    scoring = new Traditional100ScoringEngine().calculate({
      attributes: { ...draft.scores, ...cupScores } as Record<
        CuppingAttribute,
        number
      >,
      defects: draft.cups
        .filter(
          (cup) =>
            cup.attribute === "CLEAN_CUP" &&
            !cup.selected &&
            cup.defectType &&
            cup.defectSeverity,
        )
        .map((cup) => ({
          cupNumber: cup.cupNumber,
          defectType: cup.defectType!,
          defectSeverity: cup.defectSeverity!,
          defectDescription: cup.defectDescription,
        })),
    });
  } catch {}
  const complete = scoring != null && cleanCupsValid;
  function continueToNext() {
    if (step === "aroma" && olfactoryMoment === "FRAGRANCE") {
      setOlfactoryMoment("AROMA");
      setError("");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (!canContinue) {
      setError("Selecione uma pontuação para continuar.");
      return;
    }
    setError("");
    router.push(
      `/cupping/mobile/session/${sessionId}/sample/${sampleId}/${next}`,
    );
  }
  async function finalize() {
    if (!complete) {
      setError("Revise os campos obrigatórios antes de finalizar.");
      return;
    }
    if (!confirm("Finalizar e bloquear a edição normal desta avaliação?"))
      return;
    const token = sessionStorage.getItem(`cupping-token:${sessionId}`);
    const response = await fetch(
      `${API}/cupping/mobile/sessions/${sessionId}/samples/${sampleId}/finalize`,
      { method: "POST", headers: { authorization: `Bearer ${token ?? ""}` } },
    );
    if (response.ok) {
      localStorage.removeItem(key);
      router.replace(
        `/cupping/mobile/session/${sessionId}/sample/${sampleId}/result`,
      );
    } else
      setError(
        (await response.json().catch(() => null))?.message ??
          "Não foi possível finalizar.",
      );
  }
  return (
    <main className="mx-auto min-h-screen max-w-3xl overflow-x-hidden px-4 pb-[calc(11rem+env(safe-area-inset-bottom))] pt-20">
      <header>
        <Link
          href={
            index
              ? `/cupping/mobile/session/${sessionId}/sample/${sampleId}/${previous}`
              : `/cupping/mobile/session/${sessionId}`
          }
          className="inline-flex min-h-11 items-center gap-1 rounded-full bg-white/80 px-4 text-xs font-black"
        >
          <ChevronLeft size={16} />
          Voltar
        </Link>
        <div className="mt-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[.16em] text-fuchsia-600">
              {sample?.sampleCode ?? "Amostra"} · {index + 1}/10
            </p>
            <h1 className="mt-2 text-3xl font-black">
              {step === "aroma" ? (olfactoryMoment === "FRAGRANCE" ? "Fragrância" : "Aroma") : meta?.[0] ??
                (step === "cups"
                  ? "As cinco xícaras"
                  : step === "review"
                    ? "Revisar avaliação"
                    : "Resultado da Prova")}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {step === "aroma" ? (olfactoryMoment === "FRAGRANCE" ? "O que o café moído seco te lembra?" : "O que a infusão e a crosta te lembram?") : meta?.[1] ?? "Confira cada percepção antes de concluir."}
            </p>
          </div>
          <span className="shrink-0 pt-1 text-xs font-bold text-slate-500">
            {saveState.includes("offline") ? (
              <CloudOff className="inline" size={15} />
            ) : (
              <Cloud className="inline" size={15} />
            )}{" "}
            {saveState}
          </span>
        </div>
      </header>
      <section className="mt-7 space-y-5">
        {meta && step !== "overall" && step !== "aroma" && (
          <CuppingTrainingHint
            attribute={step}
            enabled={context?.session?.mode === "TRAINING"}
          />
        )}
        {step === "aroma" && (
          <>
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white/70 p-1.5" role="tablist" aria-label="Momento olfativo">
              {(["FRAGRANCE", "AROMA"] as const).map((moment) => (
                <button key={moment} type="button" role="tab" aria-selected={olfactoryMoment === moment} onClick={() => setOlfactoryMoment(moment)} className={`min-h-12 rounded-xl text-xs font-black ${olfactoryMoment === moment ? "bg-[#572f1d] text-white shadow-sm" : "text-slate-600"}`}>{moment === "FRAGRANCE" ? "1 · Fragrância" : "2 · Aroma"}</button>
              ))}
            </div>
            {context?.session?.mode === "TRAINING" && (
              <details className="rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4 text-sm text-cyan-950">
                <summary className="min-h-11 cursor-pointer font-black">ⓘ Entenda esta etapa</summary>
                <p className="mt-2 text-xs leading-5">{olfactoryMoment === "FRAGRANCE" ? "Percepção olfativa do café moído antes da infusão." : "Percepção olfativa liberada pelo café após o contato com a água."}</p>
              </details>
            )}
            <CuppingOlfactoryBowl moment={olfactoryMoment} selections={[...fragranceSelections, ...aromaSelections]} expanded={bowlExpanded} onToggle={() => setBowlExpanded((value) => !value)} />
            <CuppingSensoryLibrary
              context={olfactoryMoment}
              value={olfactoryMoment === "FRAGRANCE" ? fragranceSelections : aromaSelections}
              onChange={(selections) => update({ stageData: withOlfactorySelections(draft.stageData, olfactoryMoment, selections.map((selection) => ({ ...selection, context: olfactoryMoment }))) })}
              training={false}
              onDepthChange={(depth) => {
                setOlfactoryDepth(depth);
                if (depth > 0) setBowlExpanded(false);
              }}
            />
            {olfactoryMoment === "AROMA" && (
              <>
                <div className="rounded-3xl bg-white/55 p-4">
                  <p className="mb-3 text-xs font-black uppercase tracking-[.14em] text-slate-600">Pontuação técnica · Fragrância / Aroma</p>
                  <CuppingScorePicker label="Fragrância / Aroma" value={draft.scores.fragranceAroma} onChange={(value) => setScore("fragranceAroma", value)} />
                </div>
                <Memory value={draft.affectiveMemory ?? ""} onChange={(affectiveMemory) => update({ affectiveMemory })} />
              </>
            )}
          </>
        )}
        {meta && step !== "aroma" && step !== "equilibrio" && step !== "overall" && (
          <>
            {meta[3] && usesGeneralSensoryLibrary(step) && (
              <CuppingSensoryLibrary
                context={meta[3]}
                value={draft.selections}
                onChange={(selections) => update({ selections })}
                training={context?.session?.mode === "TRAINING"}
              />
            )}{" "}
            {step === "finalizacao" && (
              <>
                <AftertastePersistenceSelector
                  value={draft.aftertastePersistence}
                  onChange={(aftertastePersistence) =>
                    update({ aftertastePersistence })
                  }
                />
                <Choice
                  label="Caráter da finalização · opcional"
                  values={[...aftertasteCharacterOptions]}
                  value={draft.stageData.aftertasteCharacter}
                  optional
                  onChange={(aftertasteCharacter) =>
                    update({
                      stageData: { ...draft.stageData, aftertasteCharacter },
                    })
                  }
                />
              </>
            )}{" "}
            {step === "acidez" && (
              <>
                <AcidityTypeSelector
                  values={acidityReferences}
                  selected={acidityTypes}
                  onChange={(nextTypes) => {
                    const persistence = buildAcidityPersistence(
                      nextTypes,
                      draft.stageData.acidityQuality,
                    );
                    update({
                      acidityType: persistence.acidityType,
                      stageData: {
                        ...draft.stageData,
                        acidityTypes: persistence.acidityTypes,
                        acidityQuality: persistence.acidityQuality,
                      },
                    });
                  }}
                />
                <AcidityQualitySelector
                  values={acidityQualityOptions}
                  value={draft.stageData.acidityQuality}
                  onChange={(acidityQuality) =>
                    update({
                      stageData: { ...draft.stageData, acidityQuality },
                    })
                  }
                />
              </>
            )}{" "}
            {step === "corpo" && (
              <>
                <BodyPerceptionSelector
                  kind="weight"
                  label="Peso / intensidade"
                  values={bodyWeightOptions}
                  value={draft.stageData.bodyWeight}
                  onChange={(bodyWeight) =>
                    update({ stageData: { ...draft.stageData, bodyWeight } })
                  }
                />
                <BodyTextureSelector
                  values={bodyTextureOptions}
                  selected={bodyTextures}
                  onChange={(nextTextures) => {
                    const persistence = buildBodyPersistence(
                      draft.stageData.bodyWeight,
                      nextTextures,
                    );
                    update({
                      bodyType: persistence.bodyType,
                      stageData: {
                        ...draft.stageData,
                        bodyWeight: persistence.bodyWeight,
                        bodyTextures: persistence.bodyTextures,
                      },
                    });
                  }}
                />
              </>
            )}
            <div className="rounded-3xl bg-white/55 p-4">
              <p className="mb-3 text-xs font-black uppercase tracking-[.14em] text-slate-600">
                Pontuação técnica
              </p>
              <CuppingScorePicker
                label={meta[0]}
                value={draft.scores[meta[2]]}
                onChange={(value) => setScore(meta[2], value)}
              />
            </div>
            <Memory
              value={draft.affectiveMemory ?? ""}
              onChange={(affectiveMemory) => update({ affectiveMemory })}
            />
          </>
        )}
        {step === "equilibrio" && (
          <>
            <BalanceIntegrationVisual />
            <AttributeSummary
              scores={{
                fragranceAroma: draft.scores.fragranceAroma,
                flavor: draft.scores.flavor,
                aftertaste: draft.scores.aftertaste,
                acidity: draft.scores.acidity,
                body: draft.scores.body,
              }}
            />
            <Choice
              label="Como se integram?"
              values={[
                "Harmônico",
                "Um atributo sobressai",
                "Contrastes agradáveis",
                "Desequilibrado",
              ]}
              value={draft.stageData.balanceFeeling}
              onChange={(value) =>
                update({
                  stageData: { ...draft.stageData, balanceFeeling: value },
                })
              }
            />
            <CuppingScorePicker
              label="Equilíbrio"
              value={draft.scores.balance}
              onChange={(value) => setScore("balance", value)}
            />
            <Memory
              value={draft.affectiveMemory ?? ""}
              onChange={(affectiveMemory) => update({ affectiveMemory })}
            />
          </>
        )}
        {step === "cups" && (
          <div className="space-y-5 rounded-[1.5rem] bg-white/45 p-3">
            <FiveCupSelector
              label="Uniformidade"
              attribute="UNIFORMITY"
              cups={draft.cups}
              onChange={(cups) =>
                update({
                  cups,
                  scores: {
                    ...draft.scores,
                    uniformity: cupsScore(
                      Array.from(
                        { length: 5 },
                        (_, i) =>
                          cups.find(
                            (c) =>
                              c.attribute === "UNIFORMITY" &&
                              c.cupNumber === i + 1,
                          )?.selected ?? true,
                      ),
                    ),
                  },
                })
              }
              defects={cleanCupDefects}
            />
            <FiveCupSelector
              label="Doçura"
              attribute="SWEETNESS"
              cups={draft.cups}
              onChange={(cups) =>
                update({
                  cups,
                  scores: {
                    ...draft.scores,
                    sweetness: cupsScore(
                      Array.from(
                        { length: 5 },
                        (_, i) =>
                          cups.find(
                            (c) =>
                              c.attribute === "SWEETNESS" &&
                              c.cupNumber === i + 1,
                          )?.selected ?? true,
                      ),
                    ),
                  },
                })
              }
              defects={cleanCupDefects}
            />
            <FiveCupSelector
              label="Xícara limpa"
              attribute="CLEAN_CUP"
              cups={draft.cups}
              onChange={(cups) =>
                update({
                  cups,
                  scores: {
                    ...draft.scores,
                    cleanCup: cupsScore(
                      Array.from(
                        { length: 5 },
                        (_, i) =>
                          cups.find(
                            (c) =>
                              c.attribute === "CLEAN_CUP" &&
                              c.cupNumber === i + 1,
                          )?.selected ?? true,
                      ),
                    ),
                  },
                })
              }
              defects={cleanCupDefects}
            />
          </div>
        )}
        {step === "overall" && (
          <>
            <CuppingTrainingHint
              attribute="overall"
              enabled={context?.session?.mode === "TRAINING"}
            />
            <CuppingSensoryProfile
              selections={draft.selections}
              acidityTypes={acidityTypes}
              bodyTextures={bodyTextures}
              aftertastePersistence={draft.aftertastePersistence}
              aftertasteCharacter={draft.stageData.aftertasteCharacter}
            />
            <div className="rounded-3xl bg-white/55 p-4">
              <p className="mb-3 text-xs font-black uppercase tracking-[.14em] text-slate-600">
                Sua avaliação geral
              </p>
              <CuppingScorePicker
                label="Avaliação geral"
                value={draft.scores.overall}
                onChange={(value) => setScore("overall", value)}
                grid
              />
            </div>
            <label className="block rounded-3xl bg-white/80 p-4 text-xs font-bold">
              Impressão final <span className="font-normal">(opcional)</span>
              <textarea
                maxLength={300}
                value={draft.finalImpression ?? ""}
                onChange={(e) => update({ finalImpression: e.target.value })}
                className="mt-2 min-h-20 w-full rounded-2xl border border-white bg-slate-50 p-3 font-normal"
                placeholder="Descreva sua impressão sobre o café..."
              />
            </label>
            <button
              type="button"
              aria-expanded={showPriorScores}
              onClick={() => setShowPriorScores((visible) => !visible)}
              className="min-h-11 w-full rounded-2xl border border-fuchsia-200 bg-white/70 px-4 text-sm font-black text-fuchsia-700"
            >
              {showPriorScores
                ? "Ocultar notas anteriores"
                : "Ver notas anteriores"}
            </button>
            {showPriorScores && (
              <AttributeSummary scores={{ ...draft.scores, ...cupScores }} />
            )}
          </>
        )}
        {step === "review" && (
          <Review
            sessionId={sessionId}
            sampleId={sampleId}
            draft={draft}
            cupScores={cupScores}
            cleanCupsValid={cleanCupsValid}
            invalidCleanCupNumbers={invalidCleanCupNumbers}
          />
        )}{" "}
        {step === "result" && (
          <Result
            scoring={scoring}
            draft={draft}
            cupScores={cupScores}
            sessionId={sessionId}
          />
        )}
      </section>
      {!canContinue && requiredScore && !(step === "aroma" && olfactoryMoment === "FRAGRANCE") && (
        <p className="mt-5 rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-800">
          Selecione uma pontuação para continuar.
        </p>
      )}
      {!canContinue && step === "cups" && (
        <p className="mt-5 rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-800">
          Informe o tipo e a severidade de cada defeito para continuar.
        </p>
      )}
      {error && (
        <p className="mt-5 rounded-2xl bg-rose-100 p-3 text-sm font-bold text-rose-800">
          {error}
        </p>
      )}
      {step !== "result" && (
        <footer className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-3xl items-center gap-2 border-t border-slate-200/70 bg-[#fffaf4]/95 px-4 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-slate-900 text-sm font-black text-white">
            N
          </span>
          {step === "review" || step === "result" ? (
            <>
              <Link
                href={`/cupping/mobile/session/${sessionId}/sample/${sampleId}/review`}
                className="flex min-h-12 flex-1 items-center justify-center rounded-2xl border border-fuchsia-200 font-black text-fuchsia-700"
              >
                Revisar avaliação
              </Link>
              <button
                onClick={finalize}
                disabled={!complete}
                className="min-h-12 flex-1 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-orange-400 px-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Finalizar avaliação
              </button>
            </>
          ) : (
            <>
              <Link
                href={`/cupping/mobile/session/${sessionId}/sample/${sampleId}/review`}
                className="flex min-h-12 flex-[.75] items-center justify-center rounded-2xl border border-fuchsia-200 px-2 text-sm font-black text-fuchsia-700"
              >
                Revisar
              </Link>
              <button
                type="button"
                onClick={continueToNext}
                disabled={!canContinue}
                className="flex min-h-12 flex-1 items-center justify-center gap-1 rounded-2xl bg-gradient-to-r from-fuchsia-500 via-rose-500 to-orange-400 px-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {step === "aroma" && olfactoryMoment === "FRAGRANCE" ? "Ir para Aroma" : "Continuar"} <ChevronRight size={18} />
              </button>
            </>
          )}
        </footer>
      )}
    </main>
  );
}
function Choice({
  label,
  values,
  value,
  onChange,
  optional = false,
}: {
  label: string;
  values: string[];
  value?: string;
  onChange(value: string): void;
  optional?: boolean;
}) {
  return (
    <div className="rounded-3xl bg-white/70 p-4">
      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {values.map((item) => (
          <button
            type="button"
            key={item}
            onClick={() => onChange(optional && value === item ? "" : item)}
            aria-pressed={value === item}
            className={`min-h-14 rounded-2xl border px-3 text-sm font-bold ${value === item ? "border-cyan-500 bg-cyan-500 text-white" : "border-white bg-white/80"}`}
          >
            {item}
            {value === item && (
              <CheckCircle2 className="ml-1 inline" size={14} />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
function Memory({
  value,
  onChange,
}: {
  value: string;
  onChange(value: string): void;
}) {
  return (
    <label className="block rounded-3xl bg-white/70 p-4 text-xs font-black">
      Isso te lembra algo?
      <textarea
        maxLength={300}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 min-h-20 w-full rounded-2xl border border-white bg-white p-3 font-normal"
        placeholder="Memória afetiva opcional"
      />
    </label>
  );
}
function AttributeSummary({
  scores,
}: {
  scores: Partial<Record<CuppingAttribute, number>>;
}) {
  const labels = Object.fromEntries(
    reviewAttributes.map((item) => [item.key, item.label]),
  );
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {Object.entries(scores)
        .filter(([, v]) => v != null)
        .map(([key, value]) => (
          <div key={key} className="rounded-2xl bg-white/80 p-3">
            <small className="block font-bold capitalize text-slate-500">
              {labels[key] ?? key}
            </small>
            <b className="text-xl">
              {Number(value).toFixed(2).replace(".", ",")}
            </b>
          </div>
        ))}
    </div>
  );
}
function Review({
  sessionId,
  sampleId,
  draft,
  cupScores,
  cleanCupsValid,
  invalidCleanCupNumbers,
}: {
  sessionId: string;
  sampleId: string;
  draft: Draft;
  cupScores: any;
  cleanCupsValid: boolean;
  invalidCleanCupNumbers: number[];
}) {
  const values = { ...draft.scores, ...cupScores };
  const issues = cuppingReviewIssues(
    values,
    cleanCupsValid,
    invalidCleanCupNumbers,
  );
  return (
    <div className="space-y-4">
      {issues.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-orange-200 bg-orange-50/60">
          <div className="border-b border-orange-200 p-4">
            <p className="font-black text-orange-700">
              <span className="mr-2 inline-grid size-5 place-items-center rounded-full bg-orange-500 text-xs text-white">
                ×
              </span>
              {issues.length}{" "}
              {issues.length === 1 ? "item precisa" : "itens precisam"} da sua
              atenção
            </p>
            <p className="ml-7 mt-1 text-xs text-slate-600">
              Complete os itens abaixo antes de finalizar.
            </p>
          </div>
          <div>
            {issues.map((issue) => (
              <Link
                key={`${issue.key}-${issue.message}`}
                href={`/cupping/mobile/session/${sessionId}/sample/${sampleId}/${issue.route}`}
                className="flex min-h-16 items-center justify-between border-b border-orange-100 bg-white/65 px-4 last:border-b-0"
              >
                <span>
                  <b className="block text-sm">{issue.label}</b>
                  <small className="text-slate-600">{issue.message}</small>
                </span>
                <span className="text-xs font-black text-fuchsia-700">
                  Corrigir ›
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-lime-300 bg-lime-50/70 p-4 text-lime-800">
          <b>
            <span className="mr-2 inline-grid size-5 place-items-center rounded-full bg-lime-600 text-xs text-white">
              ✓
            </span>
            Tudo certo!
          </b>
          <p className="ml-7 mt-1 text-xs text-slate-600">
            Todos os atributos obrigatórios foram preenchidos.
          </p>
        </div>
      )}
      <div>
        <p className="mb-2 text-[10px] font-black uppercase tracking-[.1em] text-slate-600">
          Resumo da avaliação
        </p>
        {reviewAttributes.map(({ key, label, route }) => (
          <Link
            key={key}
            href={`/cupping/mobile/session/${sessionId}/sample/${sampleId}/${route}`}
            className="flex min-h-10 items-center justify-between border-b border-slate-200/70 px-1 text-sm"
          >
            <b className="font-semibold">
              <span
                className={`mr-2 inline-grid size-4 place-items-center rounded-full text-[9px] text-white ${values[key] == null ? "bg-orange-500" : "bg-lime-600"}`}
              >
                {values[key] == null ? "!" : "✓"}
              </span>
              {label}
            </b>
            <span>
              {values[key] == null
                ? "—"
                : Number(values[key]).toFixed(2).replace(".", ",")}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
function Result({
  scoring,
  draft,
  cupScores,
  sessionId,
}: {
  scoring: ReturnType<Traditional100ScoringEngine["calculate"]> | null;
  draft: Draft;
  cupScores: any;
  sessionId: string;
}) {
  const values = { ...draft.scores, ...cupScores };
  const pending = reviewAttributes.filter(({ key }) => values[key] == null);
  const acidityTypes = Array.isArray(draft.stageData.acidityTypes)
    ? draft.stageData.acidityTypes
    : (draft.acidityType?.split(" + ").filter(Boolean) ?? []);
  const bodyTextures = Array.isArray(draft.stageData.bodyTextures)
    ? draft.stageData.bodyTextures
    : (draft.bodyType?.split(" + ").filter(Boolean) ?? []);
  return (
    <div className="space-y-5 text-center">
      <div>
        <span className="mx-auto grid size-20 place-items-center rounded-full bg-lime-100 text-5xl text-lime-700">
          ✓
        </span>
        <h2 className="mt-4 text-2xl font-black">Avaliação completa!</h2>
        <p className="mx-auto mt-2 max-w-xs text-sm italic text-slate-600">
          Todos os atributos obrigatórios
          <br />
          foram preenchidos.
        </p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white/75 p-6">
        <p className="text-xs font-black uppercase tracking-[.08em] text-slate-600">
          Sua pontuação final
        </p>
        <strong className="mt-2 block text-5xl font-black text-slate-800">
          {scoring?.finalScore.toFixed(2).replace(".", ",") ?? "—"}
        </strong>
        <span className="text-xs font-bold text-slate-600">PONTOS</span>
        <small className="mt-1 block text-[10px] uppercase tracking-wide text-slate-500">
          Traditional 100
        </small>
      </div>
      {pending.length > 0 && (
        <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
          <b>Atributos pendentes</b>
          <p className="mt-1">
            {pending.map((item) => item.label).join(" · ")}
          </p>
        </div>
      )}
      <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 text-left">
        <CuppingSensoryProfile
          selections={draft.selections}
          acidityTypes={acidityTypes}
          bodyTextures={bodyTextures}
          aftertastePersistence={draft.aftertastePersistence}
          aftertasteCharacter={draft.stageData.aftertasteCharacter}
        />
      </div>
      <Link
        href={`/cupping/mobile/session/${sessionId}`}
        className="flex min-h-12 items-center justify-center rounded-2xl bg-gradient-to-r from-fuchsia-500 via-rose-500 to-orange-400 font-black text-white"
      >
        Voltar ao laboratório
      </Link>
      <details className="rounded-2xl bg-white/60 p-4 text-left text-xs">
        <summary className="cursor-pointer text-center font-black text-fuchsia-700">
          Ver detalhes da avaliação
        </summary>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <p>
            <b>Soma sensorial</b>
            <br />
            {scoring?.rawScore.toFixed(2).replace(".", ",") ?? "—"}
          </p>
          <p>
            <b>Penalidade</b>
            <br />-{scoring?.defectPenalty.toFixed(2).replace(".", ",") ?? "—"}
          </p>
        </div>
        <div className="mt-4">
          <AttributeSummary scores={{ ...draft.scores, ...cupScores }} />
        </div>
        <b className="mt-4 block">Defeitos por xícara</b>
        <div className="mt-2 space-y-1 text-slate-600">
          {draft.cups
            .filter((cup) => cup.attribute === "CLEAN_CUP" && !cup.selected)
            .map((cup) => (
              <p key={cup.cupNumber}>
                Xícara {cup.cupNumber}: {cup.defectType ?? "Pendente"} ·{" "}
                {cup.defectSeverity ?? "severidade pendente"}
                {cup.defectDescription ? ` · ${cup.defectDescription}` : ""}
              </p>
            ))}
          {!draft.cups.some(
            (cup) => cup.attribute === "CLEAN_CUP" && !cup.selected,
          ) && <p>Nenhum defeito registrado.</p>}
        </div>
      </details>
    </div>
  );
}
