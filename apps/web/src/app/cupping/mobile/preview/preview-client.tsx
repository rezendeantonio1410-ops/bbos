"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, RotateCcw, Sparkles } from "lucide-react";
import { CuppingSensoryLibrary, type MobileSelection } from "@/components/cupping-mobile";
import { CuppingAftertaste } from "@/components/cupping-aftertaste";
import { CuppingAcidity } from "@/components/cupping-acidity";
import { CuppingBody } from "@/components/cupping-body";
import type { OlfactoryStageSelection } from "@bbos/shared";
import { fetchSessionIdentity, getApiRoot } from "@/lib/auth-session";

const STORAGE_KEY = "bbos-cupping-sensory-preview-v2";
const stages = [
  { id: "fragrance", label: "Fragrância", context: "FRAGRANCE" as const },
  { id: "aroma", label: "Aroma", context: "AROMA" as const },
  { id: "flavor", label: "Sabor", context: "FLAVOR" as const },
  { id: "aftertaste", label: "Finalização" },
  { id: "acidity", label: "Acidez" },
  { id: "body", label: "Corpo" },
] as const;
type StageId = (typeof stages)[number]["id"];
type PreviewState = {
  selections: MobileSelection[];
  welcomeSeen?: boolean;
  aftertaste: { selections: OlfactoryStageSelection[]; persistence?: string; intensity?: number; characters: string[]; score?: number };
  acidity: { intensity?: string; types: string[]; references: string[]; characters: string[]; score?: number };
  body: { weight?: string; textures: string[]; score?: number; memory: string };
};
const initialState: PreviewState = { selections: [], aftertaste: { selections: [], characters: [] }, acidity: { types: [], references: [], characters: [] }, body: { textures: [], memory: "" } };

export default function PreviewClient() {
  const [stage, setStage] = React.useState<StageId>("fragrance");
  const [state, setState] = React.useState<PreviewState>(initialState);
  const [hydrated, setHydrated] = React.useState(false);
  const [welcomeStarted, setWelcomeStarted] = React.useState(false);
  const [sensoryDepth, setSensoryDepth] = React.useState(0);
  const [userName, setUserName] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<string | null>(null);
  const rootResetRef = React.useRef<() => void>(() => undefined);
  const registerRootReset = React.useCallback((reset: () => void) => { rootResetRef.current = reset; }, []);
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const nextState = { ...initialState, ...JSON.parse(raw) } as PreviewState;
        setState(nextState);
        setWelcomeStarted(nextState.welcomeSeen === true);
      }
    } catch { /* preview remains usable */ }
    setHydrated(true);
    void fetchSessionIdentity(getApiRoot(), { retryDelaysMs: [0], timeoutMs: 2500 })
      .then((identity) => setUserName(identity.name || null))
      .catch(() => setUserName(null));
  }, []);
  React.useEffect(() => { if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }, [hydrated, state]);
  const index = stages.findIndex((item) => item.id === stage);
  const current = stages[index] ?? stages[0];
  const sensoryContext = "context" in current ? current.context : undefined;
  const go = (next: number) => {
    if (next > index && sensoryDepth > 0) { rootResetRef.current(); setSensoryDepth(0); return; }
    setStage(stages[Math.max(0, Math.min(stages.length - 1, next))]?.id ?? stage);
  };
  const reset = () => { setState(initialState); setWelcomeStarted(false); setStage("fragrance"); window.localStorage.removeItem(STORAGE_KEY); };
  const welcomeSeen = welcomeStarted || state.welcomeSeen === true;
  const startEvaluation = () => {
    setWelcomeStarted(true);
    setStage("fragrance");
    setSensoryDepth(0);
    setFeedback(null);
    setState((old) => ({ ...old, welcomeSeen: true }));
  };
  const completeSensory = () => { setFeedback("Fragrância + Aroma registrado ✓"); setStage("flavor"); setSensoryDepth(0); window.setTimeout(() => setFeedback(null), 1000); };
  return <main className="mx-auto min-h-screen w-full max-w-6xl px-2 pb-12 pt-2 sm:px-6 sm:pt-20">
    <header className="rounded-2xl border border-white/80 bg-white/75 p-2 shadow-[0_12px_35px_rgba(83,45,31,.06)] backdrop-blur sm:rounded-[2rem] sm:p-7 sm:shadow-[0_18px_50px_rgba(83,45,31,.08)]">
      <div className="flex items-center justify-between gap-2 sm:hidden"><div className="flex items-center gap-2"><img src="/brand/logo/bispo-logo-official-transparent.png" alt="Bispo" className="h-4 w-auto object-contain" /><span className="text-[10px] font-black uppercase tracking-[.14em] text-orange-700">Preview · desenvolvimento</span></div><details className="relative"><summary className="min-h-9 cursor-pointer list-none rounded-full border border-orange-200 bg-white px-3 py-2 text-[10px] font-black text-orange-800">Ferramentas</summary><div className="absolute right-0 z-30 mt-2 w-[min(92vw,340px)] rounded-2xl border border-orange-100 bg-white p-3 shadow-xl"><div className="flex items-center justify-between gap-2"><span className="text-xs font-black text-[#432a1e]">Cupping sensorial</span><button type="button" onClick={reset} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-orange-200 px-3 text-[10px] font-black text-orange-800"><RotateCcw size={13} /> Limpar</button></div><p className="mt-2 text-[10px] leading-4 text-[#6f5c51]">As escolhas ficam somente neste navegador.</p><nav aria-label="Etapas sensoriais" className="mt-3 grid grid-cols-2 gap-1.5">{stages.map((item, itemIndex) => <button key={item.id} type="button" onClick={() => setStage(item.id)} aria-current={item.id === stage ? "step" : undefined} className={`min-h-10 rounded-xl border px-2 text-left text-[10px] font-black ${item.id === stage ? "border-orange-500 bg-orange-500 text-white" : itemIndex < index ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-orange-100 bg-orange-50/30 text-[#765e50]"}`}><span className="mr-1 text-[9px] opacity-70">{String(itemIndex + 1).padStart(2, "0")}</span>{item.label}</button>)}</nav></div></details></div>
      <div className="hidden flex-wrap items-start justify-between gap-4 sm:flex"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-orange-700">Preview local · desenvolvimento</p><h1 className="mt-1 text-3xl font-black tracking-tight text-[#432a1e] sm:text-4xl">Cupping sensorial</h1><p className="mt-2 max-w-2xl text-sm text-[#6f5c51]">Explore a roda, construa Sua Xícara e experimente as etapas recuperadas sem criar dados no servidor.</p></div><button type="button" onClick={reset} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-orange-200 bg-white px-4 text-xs font-black text-orange-800"><RotateCcw size={15} /> Limpar preview</button></div>
      <nav aria-label="Etapas sensoriais" className="mt-5 hidden grid-cols-2 gap-2 sm:grid sm:grid-cols-6">{stages.map((item, itemIndex) => <button key={item.id} type="button" onClick={() => setStage(item.id)} aria-current={item.id === stage ? "step" : undefined} className={`min-h-12 rounded-2xl border px-2 text-left text-xs font-black transition motion-reduce:transition-none ${item.id === stage ? "border-orange-500 bg-orange-500 text-white shadow-lg shadow-orange-200" : itemIndex < index ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-white bg-white/80 text-[#765e50]"}`}><span className="mr-1 text-[10px] opacity-70">{String(itemIndex + 1).padStart(2, "0")}</span>{item.label}</button>)}</nav>
    </header>
    <section className="mt-2 rounded-2xl border border-white/80 bg-white/45 p-1.5 sm:mt-5 sm:rounded-[2rem] sm:p-4"><div className="mb-2 hidden items-center gap-2 px-2 text-xs font-bold text-[#6f5c51] sm:flex"><Sparkles size={16} className="text-fuchsia-600" /> Preview sem sessão: as escolhas ficam somente neste navegador.</div>
      {!welcomeSeen ? <div className="mx-auto max-w-xl rounded-[1.5rem] border border-[#eaded1] bg-[#fffdfa] p-5 shadow-[0_12px_35px_rgba(83,45,31,.08)] sm:p-7"><p className="text-xs font-black uppercase tracking-[.16em] text-orange-700">Sessão de cupping</p><h2 className="mt-2 text-2xl font-black tracking-tight text-[#432a1e]">Olá{userName ? `, ${userName}` : "."}</h2><p className="mt-1 text-sm font-semibold text-[#6f5c51]">Você está na sessão Amostra 03.</p><p className="mt-4 text-sm leading-6 text-[#432a1e]">Observe, sinta e registre o que encontrar na xícara.</p><p className="text-sm leading-6 text-[#6f5c51]">Não há respostas certas — registre sua percepção.</p><div className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-[#765e50]"><span>Arábica · Natural</span><span>Etapa 1 de 6 · Fragrância + Aroma</span></div><button type="button" onClick={startEvaluation} onPointerUp={startEvaluation} className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#512b1a] px-5 text-sm font-black text-white shadow-lg shadow-[#512b1a]/15 transition hover:bg-[#432219]">Iniciar avaliação <ChevronRight size={18} /></button></div> : <><div className="mb-3 flex items-center justify-between rounded-xl bg-white/70 px-3 py-2 text-[11px] font-bold text-[#765e50]"><span>{userName ? `${userName} · ` : ""}Amostra 03</span><span>{index + 1} de {stages.length} · {current.label}</span></div>{feedback && <p role="status" className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">{feedback}</p>}{sensoryContext ? <CuppingSensoryLibrary context={sensoryContext} value={state.selections} onChange={(selections) => setState((old) => ({ ...old, selections }))} training mode="educational" onDepthChange={setSensoryDepth} onRootReset={registerRootReset} onComplete={completeSensory} /> : null}</>}
      {welcomeSeen && <>
      {stage === "aftertaste" && <CuppingAftertaste persistence={state.aftertaste.persistence} intensity={state.aftertaste.intensity} score={state.aftertaste.score} characters={state.aftertaste.characters} selections={state.aftertaste.selections} flavorSelections={state.selections.filter((item) => item.context === "FLAVOR") as OlfactoryStageSelection[]} onPersistence={(persistence) => setState((old) => ({ ...old, aftertaste: { ...old.aftertaste, persistence } }))} onIntensity={(intensity) => setState((old) => ({ ...old, aftertaste: { ...old.aftertaste, intensity } }))} onScore={(score) => setState((old) => ({ ...old, aftertaste: { ...old.aftertaste, score } }))} onCharacters={(characters) => setState((old) => ({ ...old, aftertaste: { ...old.aftertaste, characters } }))} onSelections={(selections) => setState((old) => ({ ...old, aftertaste: { ...old.aftertaste, selections } }))} onExplore={() => setStage("flavor")} />}
      {stage === "acidity" && <CuppingAcidity {...state.acidity} selectedTypes={state.acidity.types} characters={state.acidity.characters} onIntensity={(intensity) => setState((old) => ({ ...old, acidity: { ...old.acidity, intensity } }))} onTypes={(types) => setState((old) => ({ ...old, acidity: { ...old.acidity, types } }))} onReferences={(references) => setState((old) => ({ ...old, acidity: { ...old.acidity, references } }))} onCharacters={(characters) => setState((old) => ({ ...old, acidity: { ...old.acidity, characters } }))} onScore={(score) => setState((old) => ({ ...old, acidity: { ...old.acidity, score } }))} />}
      {stage === "body" && <CuppingBody weight={state.body.weight} selectedTextures={state.body.textures} score={state.body.score} memory={state.body.memory} onWeight={(weight) => setState((old) => ({ ...old, body: { ...old.body, weight } }))} onTextures={(textures) => setState((old) => ({ ...old, body: { ...old.body, textures } }))} onScore={(score) => setState((old) => ({ ...old, body: { ...old.body, score } }))} onMemory={(memory) => setState((old) => ({ ...old, body: { ...old.body, memory } }))} />}
      </>}
    </section>
    {welcomeSeen && <footer className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/75 p-3"><button type="button" onClick={() => go(index - 1)} disabled={index === 0} className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-xs font-black text-[#765e50] disabled:opacity-40"><ChevronLeft size={17} /> Anterior</button><span className="text-xs font-black text-[#765e50]">{index + 1} de {stages.length}</span><button type="button" onClick={() => go(index + 1)} disabled={index === stages.length - 1} className="inline-flex min-h-11 items-center gap-1 rounded-full bg-[#512b1a] px-4 text-xs font-black text-white disabled:opacity-40">Próxima <ChevronRight size={17} /></button></footer>}
  </main>;
}
