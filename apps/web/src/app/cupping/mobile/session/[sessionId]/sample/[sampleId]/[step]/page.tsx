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
  buildAftertastePersistence,
  buildAcidityPersistence,
  buildBodyPersistence,
  olfactorySelectionsFromStage,
  normalizeFlavorSelection,
  sensoryLibrary,
  withOlfactorySelections,
  canContinueSensoryStep,
  cleanCupDefects,
  cuppingReviewIssues,
  cupsScore,
  priorScoresInitiallyExpanded,
  Traditional100ScoringEngine,
  validateCleanCupState,
  CUPPING_SESSION_STEPS,
  type CuppingAttribute,
  type OlfactoryStageSelection,
} from "@bbos/shared";
import { cacheCuppingSession, fetchCurrentCuppingSession, getCuppingToken, readCachedCuppingSession, recoverCuppingToken, saveCurrentCuppingEvaluation } from "@/lib/cupping-mobile-access";
import {
  BalanceIntegrationVisual,
  ApprovedSensoryArtwork,
  CuppingScorePicker,
  CuppingSensoryProfile,
  CuppingTrainingHint,
  FiveCupSelector,
  type CupState,
  type MobileSelection,
} from "@/components/cupping-mobile";
import { CuppingOlfactoryTemplate } from "@/components/cupping-olfactory-template";
import { CuppingAftertaste } from "@/components/cupping-aftertaste";
import { CuppingAcidity } from "@/components/cupping-acidity";
import { CuppingBody } from "@/components/cupping-body";
const steps = CUPPING_SESSION_STEPS.map((item) => item.id) as unknown as readonly [
  "aroma",
  "sabor",
  "finalizacao",
  "acidez",
  "corpo",
  "sample_consistency",
  "overall",
  "result",
];
type RouteStep = (typeof steps)[number] | "equilibrio" | "review";
type StepMeta = [
  string,
  string,
  CuppingAttribute,
  "AROMA" | "FLAVOR" | "AFTERTASTE" | "ACIDITY" | "BODY" | null,
];
const copy: Partial<Record<RouteStep, StepMeta>> = {
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
  acidez: ["Acidez", "Como a acidez se apresenta na xícara?", "acidity", null],
  corpo: ["Corpo", "Como o café ocupa a boca?", "body", "BODY"],
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
  Record<RouteStep, CuppingAttribute>
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
  route: RouteStep;
}> = [
  { key: "fragranceAroma", label: "Fragrância / Aroma", route: "aroma" },
  { key: "flavor", label: "Sabor", route: "sabor" },
  { key: "aftertaste", label: "Finalização", route: "finalizacao" },
  { key: "acidity", label: "Acidez", route: "acidez" },
  { key: "body", label: "Corpo", route: "corpo" },
  { key: "balance", label: "Equilíbrio", route: "equilibrio" },
  { key: "uniformity", label: "Uniformidade", route: "sample_consistency" },
  { key: "sweetness", label: "Doçura", route: "sample_consistency" },
  { key: "cleanCup", label: "Xícara Limpa", route: "sample_consistency" },
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
      defectWeight: cup.defect?.defectSeverity === "FAULT" ? 4 : cup.defect?.defectSeverity === "TAINT" ? 2 : undefined,
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
  const [syncAttempt, setSyncAttempt] = React.useState(0);
  const [error, setError] = React.useState("");
  const decisionRef = React.useRef<HTMLDivElement>(null);
  const [showPriorScores, setShowPriorScores] = React.useState(
    priorScoresInitiallyExpanded,
  );
  const [olfactoryMoment, setOlfactoryMoment] = React.useState<
    "FRAGRANCE" | "AROMA"
  >("FRAGRANCE");
  const [exploreAftertaste, setExploreAftertaste] = React.useState(false);
  const loaded = React.useRef(false);
  const finalized = React.useRef(false);
  React.useEffect(() => {
    const local = localStorage.getItem(key);
    const token = recoverCuppingToken(sessionId);
    const cachedContext = readCachedCuppingSession<any>(sessionId);
    if (cachedContext) setContext(cachedContext);
    if (local) {
      try {
        const stored = JSON.parse(local) as Draft;
        setDraft({ ...initial, ...stored, scores: { ...initial.scores, ...stored.scores }, cups: mergeCups(stored.cups) });
      } catch {}
    }
    if (local || cachedContext) loaded.current = true;
    fetchCurrentCuppingSession(sessionId, token)
      .then((data) => {
        setContext(data);
        cacheCuppingSession(sessionId, data);
        const evaluation = data?.session?.evaluations?.find(
          (item: any) => item.sampleId === sampleId,
        );
        finalized.current = evaluation?.status === "COMPLETED";
        if (!local && evaluation) setDraft(draftFromEvaluation(evaluation));
        loaded.current = true;
      })
      .catch(() => {
        loaded.current = true;
        setSaveState("Sem conexão · rascunho neste dispositivo");
      });
  }, [key, sampleId, sessionId]);
  React.useEffect(() => {
    const synchronize = () => setSyncAttempt((current) => current + 1);
    window.addEventListener("online", synchronize);
    window.addEventListener("offline", synchronize);
    return () => {
      window.removeEventListener("online", synchronize);
      window.removeEventListener("offline", synchronize);
    };
  }, []);
  React.useEffect(() => {
    if (!loaded.current || finalized.current) return;
    localStorage.setItem(key, JSON.stringify(draft));
    setSaveState(navigator.onLine ? "Salvando…" : "Rascunho offline");
    const timer = setTimeout(async () => {
      if (!navigator.onLine) return;
      const token = getCuppingToken(sessionId);
      try {
      const response = await saveCurrentCuppingEvaluation(sessionId, draft, false, token);
      setSaveState(response.ok ? "Salvo" : "Alterações não salvas");
      } catch {
        setSaveState("Sem conexão · rascunho neste dispositivo");
      }
    }, 650);
    return () => clearTimeout(timer);
  }, [draft, key, sampleId, sessionId, syncAttempt]);
  React.useEffect(() => {
    let frame = 0;
    frame = window.requestAnimationFrame(() => {
      const target = decisionRef.current;
      if (!target) return;
      const headerOffset = 12;
      // Safari/iOS may retain the previous scroll position across route changes;
      // use an immediate, deterministic position after the new DOM is mounted.
      window.scrollTo({
        top: Math.max(0, target.getBoundingClientRect().top + window.scrollY - headerOffset),
        behavior: "auto",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [step, olfactoryMoment]);
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
  const aciditySensoryReferences = Array.isArray(draft.stageData.acidityReferences)
    ? draft.stageData.acidityReferences.filter((value: unknown): value is string => typeof value === "string")
    : [];
  const acidityCharacters = Array.isArray(draft.stageData.acidityCharacters)
    ? draft.stageData.acidityCharacters.filter((value: unknown): value is string => typeof value === "string")
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
  ) as OlfactoryStageSelection[];
  const persistedAromaSelections = olfactorySelectionsFromStage(
    draft.stageData,
    "AROMA",
  ) as OlfactoryStageSelection[];
  const aromaSelections = persistedAromaSelections.length
    ? persistedAromaSelections
    : draft.selections.filter((item) => item.context === "AROMA") as OlfactoryStageSelection[];
  const flavorSelections = draft.selections.filter(
    (item) => item.context === "FLAVOR",
  ).map(normalizeFlavorSelection) as OlfactoryStageSelection[];
  const aftertasteCharacters = Array.isArray(draft.stageData.aftertasteCharacters)
    ? draft.stageData.aftertasteCharacters.filter((value: unknown): value is string => typeof value === "string")
    : draft.stageData.aftertasteCharacter ? [draft.stageData.aftertasteCharacter] : [];
  const aftertasteSelections = Array.isArray(draft.stageData.aftertasteSelections)
    ? draft.stageData.aftertasteSelections as OlfactoryStageSelection[] : [];
  const aftertasteIntensity = typeof draft.stageData.aftertasteIntensity === "number"
    ? draft.stageData.aftertasteIntensity : undefined;
  const updateAftertaste = (next: { persistence?: string; intensity?: number; characters?: string[]; selections?: OlfactoryStageSelection[] }) => {
    const persistence = buildAftertastePersistence(
      next.persistence ?? draft.aftertastePersistence,
      next.intensity ?? aftertasteIntensity,
      next.characters ?? aftertasteCharacters,
      next.selections ?? aftertasteSelections,
    );
    update({
      aftertastePersistence: persistence.aftertastePersistence,
      stageData: {
        ...draft.stageData,
        aftertasteIntensity: persistence.aftertasteIntensity,
        aftertasteCharacters: persistence.aftertasteCharacters,
        aftertasteSelections: persistence.aftertasteSelections,
        aftertasteCharacter: persistence.aftertasteCharacters[0],
      },
    });
  };
  const canContinue =
    step === "aroma" && olfactoryMoment === "FRAGRANCE"
      ? true
      : step === "sample_consistency"
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
  const renderCupSelector = (label: string, attribute: CupState["attribute"], scoreKey: "uniformity" | "sweetness" | "cleanCup") => (
    <FiveCupSelector
      label={label}
      attribute={attribute}
      cups={draft.cups}
      onChange={(cups) => update({ cups, scores: { ...draft.scores, [scoreKey]: cupsScore(Array.from({ length: 5 }, (_, i) => cups.find((cup) => cup.attribute === attribute && cup.cupNumber === i + 1)?.selected ?? true)) } })}
      defects={cleanCupDefects}
    />
  );
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
    const token = getCuppingToken(sessionId);
    const response = await saveCurrentCuppingEvaluation(sessionId, draft, true, token);
    if (response.ok) {
      localStorage.removeItem(key);
      router.replace(`/cupping/mobile/session/${sessionId}?completed=1`);
    } else
      setError(
        (await response.json().catch(() => null))?.message ??
          "Não foi possível finalizar.",
      );
  }
  return (
    <main className={`mx-auto min-h-screen w-full overflow-x-clip px-[clamp(.75rem,3vw,2rem)] pb-[calc(12rem+env(safe-area-inset-bottom))] pt-[clamp(4.5rem,8vw,6rem)] ${step === "aroma" || step === "sabor" ? "max-w-[430px]" : step === "finalizacao" || step === "acidez" || step === "corpo" ? "max-w-[1180px]" : "max-w-3xl"}`}>
      <header ref={decisionRef}>
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
        <div tabIndex={-1} className={`${step === "aroma" ? "mt-3 rounded-2xl border border-[#eadfd4] bg-white/65 px-3 py-3" : "mt-5"} flex items-start justify-between gap-3 outline-none`}>
          <div className="min-w-0">
            <p className={`font-black uppercase tracking-[.16em] ${step === "aroma" ? "text-[9px] text-[#8b654f]" : "text-xs text-fuchsia-600"}`}>
              {sample?.sampleCode ?? "Amostra"} · {sample?.lot?.origin ?? "Origem não informada"} · {context?.session?.code ?? "Sessão"}
            </p>
            {index >= 0 && <p className="mt-1 text-[10px] font-black uppercase tracking-[.14em] text-slate-500">Etapa {index + 1} de {steps.length} · {CUPPING_SESSION_STEPS[index]?.label}</p>}
            <h1 className={`${step === "aroma" ? "mt-1 text-2xl text-[#432a1d]" : "mt-2 text-3xl"} font-black`}>
              {step === "aroma" ? (olfactoryMoment === "FRAGRANCE" ? "Fragrância" : "Aroma") : meta?.[0] ??
                (step === "sample_consistency"
                  ? "Consistência da amostra"
                  : step === "review"
                    ? "Revisar avaliação"
                    : "Resultado da Prova")}
            </h1>
            <p className={`${step === "aroma" ? "mt-1 text-xs" : "mt-2 text-sm"} text-slate-600`}>
              {step === "aroma" ? "O que esse café te lembra?" : meta?.[1] ?? (step === "sample_consistency" ? "Observe as mesmas cinco xícaras." : "Confira cada percepção antes de concluir.")}
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
            <CuppingOlfactoryTemplate
              context={olfactoryMoment}
              value={olfactoryMoment === "FRAGRANCE" ? fragranceSelections : aromaSelections}
              onChange={(selections) => update({ stageData: withOlfactorySelections(draft.stageData, olfactoryMoment, selections.map((selection) => ({ ...selection, context: olfactoryMoment }))) })}
              onSaveDraft={() => setDraft((current) => ({ ...current, stageData: { ...current.stageData } }))}
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
            {step === "sabor" && (
              <>
                <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white/70 p-1.5" aria-label="Etapas sensoriais">
                  <span className="grid min-h-12 place-items-center rounded-xl text-[10px] font-black text-slate-500">1 · Fragrância</span>
                  <span className="grid min-h-12 place-items-center rounded-xl text-[10px] font-black text-slate-500">2 · Aroma</span>
                  <span className="grid min-h-12 place-items-center rounded-xl bg-[#572f1d] text-[10px] font-black text-white shadow-sm">3 · Sabor</span>
                </div>
                <CuppingOlfactoryTemplate
                  context="FLAVOR"
                  library={sensoryLibrary}
                  value={flavorSelections}
                  onChange={(selections) => update({
                    selections: [
                      ...draft.selections.filter((item) => item.context !== "FLAVOR"),
                      ...selections,
                    ],
                  })}
                  onSaveDraft={() => setDraft((current) => ({ ...current, selections: [...current.selections] }))}
                />
              </>
            )}{" "}
            {step === "finalizacao" && (
              <>
                {exploreAftertaste ? (
                  <div className="rounded-[2rem] border border-[#ead9ca] bg-white/80 p-3">
                    <button type="button" onClick={() => setExploreAftertaste(false)} className="mb-3 min-h-11 rounded-full px-3 text-sm font-black text-[#633d2a]">‹ Voltar à Finalização</button>
                    <CuppingOlfactoryTemplate context="AFTERTASTE" library={sensoryLibrary} value={aftertasteSelections} onChange={(selections) => updateAftertaste({ selections })} onSaveDraft={() => setDraft((current) => ({ ...current, stageData: { ...current.stageData } }))} />
                  </div>
                ) : (
                  <CuppingAftertaste
                    persistence={draft.aftertastePersistence}
                    intensity={aftertasteIntensity}
                    characters={aftertasteCharacters}
                    selections={aftertasteSelections}
                    flavorSelections={flavorSelections}
                    onPersistence={(persistence) => updateAftertaste({ persistence })}
                    onIntensity={(intensity) => updateAftertaste({ intensity })}
                    onCharacters={(characters) => updateAftertaste({ characters })}
                    onSelections={(selections) => updateAftertaste({ selections })}
                    onExplore={() => setExploreAftertaste(true)}
                  />
                )}
              </>
            )}{" "}
            {step === "acidez" && (
              <CuppingAcidity
                intensity={draft.stageData.acidityIntensity}
                selectedTypes={acidityTypes}
                references={aciditySensoryReferences}
                characters={acidityCharacters}
                score={draft.scores.acidity}
                onIntensity={(acidityIntensity) => update({ stageData: { ...draft.stageData, acidityIntensity } })}
                onTypes={(nextTypes) => {
                  const persistence = buildAcidityPersistence(nextTypes, draft.stageData.acidityQuality);
                  update({ acidityType: persistence.acidityType, stageData: { ...draft.stageData, acidityTypes: persistence.acidityTypes, acidityQuality: persistence.acidityQuality } });
                }}
                onReferences={(acidityReferences) => update({ stageData: { ...draft.stageData, acidityReferences } })}
                onCharacters={(acidityCharacters) => update({ stageData: { ...draft.stageData, acidityCharacters } })}
                onScore={(value) => setScore("acidity", value)}
              />
            )}{" "}
            {step === "corpo" && (
              <CuppingBody
                weight={draft.stageData.bodyWeight}
                selectedTextures={bodyTextures}
                score={draft.scores.body}
                memory={draft.affectiveMemory}
                onWeight={(bodyWeight) => update({ stageData: { ...draft.stageData, bodyWeight } })}
                onTextures={(nextTextures) => {
                  const persistence = buildBodyPersistence(draft.stageData.bodyWeight, nextTextures);
                  update({ bodyType: persistence.bodyType, stageData: { ...draft.stageData, bodyWeight: persistence.bodyWeight, bodyTextures: persistence.bodyTextures } });
                }}
                onScore={(value) => setScore("body", value)}
                onMemory={(affectiveMemory) => update({ affectiveMemory })}
              />
            )}
            {step !== "acidez" && step !== "corpo" && <div className={`${step === "finalizacao" ? "rounded-[1.5rem] border border-[#ead9ca] bg-white/80 p-[clamp(1rem,2.5vw,1.5rem)] shadow-sm" : "rounded-3xl bg-white/55 p-4"}`}>
              <p className="mb-3 text-xs font-black uppercase tracking-[.14em] text-slate-600">
                Pontuação técnica
              </p>
              <CuppingScorePicker
                label={meta[0]}
                value={draft.scores[meta[2]]}
                onChange={(value) => setScore(meta[2], value)}
                grid={step === "finalizacao"}
                maximum={step === "finalizacao" ? 9.5 : 10}
              />
            </div>}
            {step !== "corpo" && <Memory
              value={draft.affectiveMemory ?? ""}
              onChange={(affectiveMemory) => update({ affectiveMemory })}
            />}
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
        {step === "sample_consistency" && <div className="space-y-5 rounded-[1.5rem] bg-white/45 p-3"><h2 className="px-2 text-lg font-black text-[#432a1e]">Consistência da amostra</h2><p className="px-2 text-sm text-slate-600">Observe as mesmas cinco xícaras.</p>{renderCupSelector("Uniformidade", "UNIFORMITY", "uniformity")}{renderCupSelector("Doçura", "SWEETNESS", "sweetness")}{renderCupSelector("Xícara limpa", "CLEAN_CUP", "cleanCup")}</div>}
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
              <p className="text-xs font-black uppercase tracking-[.14em] text-slate-600">Considerando tudo o que encontrou, como você avalia este café?</p>
              <p className="mt-2 text-sm text-slate-600">Pense no conjunto da experiência na xícara.</p>
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
      {!canContinue && step === "sample_consistency" && (
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
        <footer className={`fixed inset-x-0 bottom-0 z-40 mx-auto flex items-center gap-2 border-t border-slate-200/70 bg-[#fffaf4]/95 px-[clamp(.75rem,3vw,2rem)] pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur ${step === "aroma" || step === "sabor" ? "max-w-[430px]" : step === "finalizacao" ? "max-w-[1180px]" : "max-w-3xl"}`}>
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
                {step === "aroma" && olfactoryMoment === "FRAGRANCE" ? "Ir para Aroma" : step === "aroma" ? "Continuar para Sabor" : step === "finalizacao" ? "Continuar para Acidez" : step === "overall" ? "Concluir avaliação" : "Continuar"} <ChevronRight size={18} />
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
  const acidityReferences = Array.isArray(draft.stageData.acidityReferences)
    ? draft.stageData.acidityReferences.filter((value): value is string => typeof value === "string")
    : [];
  const acidityCharacters = Array.isArray(draft.stageData.acidityCharacters)
    ? draft.stageData.acidityCharacters.filter((value): value is string => typeof value === "string")
    : [];
  const bodyTextures = Array.isArray(draft.stageData.bodyTextures)
    ? draft.stageData.bodyTextures
    : (draft.bodyType?.split(" + ").filter(Boolean) ?? []);
  const fragranceSelections = olfactorySelectionsFromStage(draft.stageData, "FRAGRANCE") as OlfactoryStageSelection[];
  const persistedAromaSelections = olfactorySelectionsFromStage(draft.stageData, "AROMA") as OlfactoryStageSelection[];
  const aromaSelections = persistedAromaSelections.length
    ? persistedAromaSelections
    : draft.selections.filter((selection) => selection.context === "AROMA") as OlfactoryStageSelection[];
  const aromaProfileSelections = [...fragranceSelections, ...aromaSelections];
  const flavorSelections = draft.selections.filter((selection) => selection.context === "FLAVOR");
  const aftertasteSelections = Array.isArray(draft.stageData.aftertasteSelections)
    ? draft.stageData.aftertasteSelections as OlfactoryStageSelection[]
    : [];
  const descriptors = [...aromaProfileSelections, ...flavorSelections, ...aftertasteSelections].map((selection) => selection.descriptor).filter((value): value is string => Boolean(value));
  const dominantProfile = [...new Set(draft.selections.map((selection) => selection.family).filter(Boolean))].slice(0, 4).join(" · ") || "Nenhuma percepção registrada";
  const synthesis = descriptors.length
    ? `Café de perfil ${dominantProfile.toLowerCase()}, com destaque para ${[...new Set(descriptors)].slice(0, 3).join(", ")}.`
    : "Registre percepções sensoriais para construir a síntese deste café.";
  const scoreRows: Array<[string, number | undefined]> = [
    ["Fragrância + Aroma", values.fragranceAroma],
    ["Sabor", values.flavor],
    ["Finalização", values.aftertaste],
    ["Acidez", values.acidity],
    ["Corpo", values.body],
    ["Uniformidade", values.uniformity],
    ["Doçura", values.sweetness],
    ["Xícara Limpa", values.cleanCup],
    ["Avaliação Geral", values.overall],
  ];
  const cupRows = ["UNIFORMITY", "SWEETNESS", "CLEAN_CUP"] as const;
  const registeredDefects = draft.cups.filter((cup) => cup.attribute === "CLEAN_CUP" && !cup.selected && cup.defectType && cup.defectSeverity);
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
        <p className="text-left text-xs font-black uppercase tracking-[.08em] text-slate-600">Amostra 03 · Arábica · Natural</p>
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
      <section className="rounded-2xl border border-slate-200 bg-white/70 p-4 text-left">
        <h3 className="text-xs font-black uppercase tracking-[.1em] text-slate-600">Síntese sensorial</h3>
        <p className="mt-2 text-sm leading-6 text-slate-700">{synthesis}</p>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white/70 p-4 text-left">
        <h3 className="text-xs font-black uppercase tracking-[.1em] text-slate-600">Fragrância + Aroma</h3>
        <p className="mt-1 text-xs text-slate-500">Este foi o perfil aromático encontrado.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {aromaProfileSelections.length ? aromaProfileSelections.map((selection, index) => <div key={`${selection.context}-${selection.family}-${selection.descriptor}-${index}`} className="flex items-center gap-2 rounded-xl bg-white/80 p-2"><ApprovedSensoryArtwork name={selection.descriptor ?? selection.family} fallback={selection.family} className="h-10 w-10 shrink-0" /><span className="min-w-0 text-xs font-bold text-slate-700">{selection.descriptor ?? selection.family}<small className="ml-1 font-normal text-slate-500">{selection.intensity}/5</small></span></div>) : <p className="col-span-2 text-xs text-slate-500">Nenhuma percepção aromática registrada.</p>}
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white/70 p-4 text-left">
        <h3 className="text-xs font-black uppercase tracking-[.1em] text-slate-600">Sabor</h3>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {flavorSelections.length ? flavorSelections.map((selection, index) => <div key={`${selection.family}-${selection.descriptor}-${index}`} className="rounded-xl bg-white/80 p-2 text-xs font-bold text-slate-700">{selection.descriptor ?? selection.family}<small className="ml-1 font-normal text-slate-500">{selection.intensity}/5</small></div>) : <p className="col-span-2 text-xs text-slate-500">Nenhuma percepção de sabor registrada.</p>}
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white/70 p-4 text-left">
        <h3 className="text-xs font-black uppercase tracking-[.1em] text-slate-600">Acidez · Corpo · Finalização</h3>
        <div className="mt-3 grid gap-3 text-xs text-slate-700 sm:grid-cols-3"><div><b className="block text-[10px] uppercase text-slate-500">Acidez</b>{[...acidityTypes, ...acidityReferences, ...acidityCharacters].filter(Boolean).join(" · ") || "—"}</div><div><b className="block text-[10px] uppercase text-slate-500">Corpo</b>{bodyTextures.join(" · ") || "—"}</div><div><b className="block text-[10px] uppercase text-slate-500">Finalização</b>{[...aftertasteSelections.map((selection) => selection.descriptor), draft.aftertastePersistence, draft.stageData.aftertasteCharacter].filter(Boolean).join(" · ") || "—"}</div></div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white/70 p-4 text-left">
        <h3 className="text-xs font-black uppercase tracking-[.1em] text-slate-600">Consistência das xícaras</h3>
        <div className="mt-3 space-y-2">{cupRows.map((attribute) => <div key={attribute} className="flex items-center justify-between gap-2 text-xs"><span className="font-bold">{attribute === "UNIFORMITY" ? "Uniformidade" : attribute === "SWEETNESS" ? "Doçura" : "Xícara Limpa"}</span><span className="flex gap-1">{draft.cups.filter((cup) => cup.attribute === attribute).map((cup) => <span key={cup.cupNumber} aria-label={`Xícara ${cup.cupNumber} ${cup.selected ? "conforme" : "divergente"}`} className={cup.selected ? "text-emerald-600" : "text-orange-600"}>{cup.selected ? "✓" : "×"}</span>)}</span><b>{values[attribute === "UNIFORMITY" ? "uniformity" : attribute === "SWEETNESS" ? "sweetness" : "cleanCup"]}/10</b></div>)}</div>
      </section>
      {registeredDefects.length > 0 && <section className="rounded-2xl border border-orange-200 bg-orange-50/70 p-4 text-left"><h3 className="text-xs font-black uppercase tracking-[.1em] text-orange-800">Defeitos registrados</h3><div className="mt-2 space-y-1 text-xs text-orange-950">{registeredDefects.map((cup) => <p key={cup.cupNumber}>Xícara {String(cup.cupNumber).padStart(2, "0")} · {cup.defectType} · {cup.defectSeverity} · peso {cup.defectWeight ?? (cup.defectSeverity === "FAULT" ? 4 : 2)}</p>)}</div></section>}
      <section className="rounded-2xl border border-slate-200 bg-white/70 p-4 text-left">
        <h3 className="text-xs font-black uppercase tracking-[.1em] text-slate-600">Atributos técnicos</h3>
        <div className="mt-3 space-y-2">{scoreRows.map(([label, score]) => <div key={label} className="flex items-center gap-2 text-xs"><span className="w-32 shrink-0 font-bold text-slate-600">{label}</span><span className="h-2 flex-1 rounded-full bg-slate-100"><span className="block h-2 rounded-full bg-fuchsia-400" style={{ width: `${score == null ? 0 : Math.min(100, score * 10)}%` }} /></span><b className="w-10 text-right">{score == null ? "—" : score.toFixed(2).replace(".", ",")}</b></div>)}</div>
      </section>
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
