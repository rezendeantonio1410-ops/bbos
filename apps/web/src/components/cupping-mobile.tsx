"use client";
import * as React from "react";
import Image from "next/image";
import {
  Apple,
  Check,
  Circle,
  Citrus,
  Clock3,
  Droplets,
  Grape,
  Info,
  Layers3,
  Milk,
  Plus,
  Sparkles,
  Waves,
} from "lucide-react";
import {
  deriveCuppingSensoryProfile,
  olfactoryLibrary,
  removeOlfactoryPerception,
  sensoryLibrary,
  toggleSensorySelection,
  upsertOlfactoryPerception,
  type CuppingSensorySelection,
  type OlfactoryStageSelection,
  type SensoryFamily,
} from "@bbos/shared";
import {
  CircularSensoryNavigator,
  type CircularSensoryItem,
} from "@/components/sensory-illustrated-wheel";

export function CuppingBispoLogo() {
  return (
    <div className="inline-flex items-center px-1 py-1">
      <Image
        src="/brand/logo/bispo-logo-official.jpg"
        alt="BISPO True Coffee"
        width={58}
        height={32}
        className="h-8 w-auto mix-blend-multiply object-contain"
        priority
      />
    </div>
  );
}

export function CuppingScorePicker({
  value,
  onChange,
  label,
  grid = false,
  maximum = 10,
}: {
  value?: number;
  onChange(value: number): void;
  label: string;
  grid?: boolean;
  maximum?: number;
}) {
  const scores = Array.from(
    { length: Math.round((maximum - 6) / 0.25) + 1 },
    (_, index) => 6 + index * 0.25,
  );
  return (
    <div
      aria-label={`Nota de ${label}`}
      className={
        grid
          ? "max-w-full"
          : "-mx-1 max-w-full snap-x overflow-x-auto overscroll-x-contain px-1 pb-2"
      }
    >
      <div
        className={
          grid ? "grid grid-cols-5 gap-2" : "flex min-w-max items-center gap-2"
        }
      >
        {scores.map((score) => (
          <button
            type="button"
            key={score}
            onClick={() => onChange(score)}
            aria-pressed={value === score}
            className={`${grid ? "min-h-11 min-w-0 px-1 text-xs" : "min-h-12 min-w-16 snap-center px-3 text-sm"} rounded-xl border font-black transition ${value === score ? "border-fuchsia-500 bg-fuchsia-500 text-white shadow-lg shadow-fuchsia-200" : "border-white/70 bg-white/80 text-slate-700"}`}
          >
            {score.toFixed(2).replace(".", ",")}
            {value === score && <Check size={14} className="mx-auto mt-1" />}
          </button>
        ))}
      </div>
    </div>
  );
}

export type MobileSelection = {
  context: "FRAGRANCE" | "AROMA" | "FLAVOR" | "AFTERTASTE" | "ACIDITY" | "BODY";
  family: string;
  subfamily?: string;
  descriptor?: string;
  level: number;
  intensity: number;
  imageKey?: string;
};

type ArtworkCrop = { x: number; y: number; width: number; height: number };
const approvedArtwork: Record<string, ArtworkCrop> = {
  Floral: { x: 18, y: 125, width: 55, height: 78 },
  Frutado: { x: 170, y: 125, width: 62, height: 78 },
  Vegetal: { x: 18, y: 215, width: 58, height: 79 },
  Doce: { x: 171, y: 215, width: 58, height: 79 },
  Caramelizado: { x: 18, y: 298, width: 60, height: 72 },
  "Cacau / Nozes": { x: 171, y: 298, width: 61, height: 72 },
  Especiarias: { x: 18, y: 379, width: 60, height: 66 },
  "Defeitos aromáticos": { x: 171, y: 377, width: 60, height: 69 },
  "Flores brancas": { x: 326, y: 136, width: 135, height: 172 },
  "Flores perfumadas": { x: 465, y: 136, width: 136, height: 172 },
  "Flores suaves": { x: 326, y: 316, width: 135, height: 153 },
  "Chás/Infusões": { x: 465, y: 316, width: 136, height: 153 },
  Cítricos: { x: 936, y: 135, width: 88, height: 288 },
  Jasmim: { x: 640, y: 138, width: 130, height: 91 },
  "Flor de laranjeira": { x: 640, y: 235, width: 132, height: 98 },
  Madressilva: { x: 640, y: 339, width: 132, height: 120 },
  Laranja: { x: 937, y: 138, width: 86, height: 54 },
  Lima: { x: 937, y: 198, width: 86, height: 54 },
  Limão: { x: 937, y: 255, width: 86, height: 54 },
  Tangerina: { x: 937, y: 313, width: 86, height: 54 },
  Grapefruit: { x: 937, y: 371, width: 86, height: 54 },
  "Taça de cupping": { x: 1239, y: 143, width: 48, height: 61 },
};

export function ApprovedSensoryArtwork({
  name,
  fallback,
  className = "",
}: {
  name: string;
  fallback?: string;
  className?: string;
}) {
  const crop =
    approvedArtwork[name] ??
    (fallback ? approvedArtwork[fallback] : undefined) ??
    approvedArtwork.Floral!;
  return (
    <svg
      viewBox={`${crop.x} ${crop.y} ${crop.width} ${crop.height}`}
      role="img"
      aria-label={`Ilustração sensorial: ${name}`}
      className={className}
      preserveAspectRatio="xMidYMid meet"
    >
      <image
        href="/sensory/reference/sensory-approved-master.png"
        width="1536"
        height="1024"
      />
    </svg>
  );
}

export function CuppingSensoryLibrary({
  context,
  value,
  onChange,
  training,
  onDepthChange,
  onRootReset,
  mode = training ? "educational" : "professional",
}: {
  context: MobileSelection["context"];
  value: MobileSelection[];
  onChange(value: MobileSelection[]): void;
  training: boolean;
  onDepthChange?(depth: number): void;
  onRootReset?(reset: () => void): void;
  mode?: "professional" | "educational";
}) {
  const [family, setFamily] = React.useState<SensoryFamily | null>(null);
  const [subfamily, setSubfamily] = React.useState<
    SensoryFamily["subfamilies"][number] | null
  >(null);
  const [pending, setPending] = React.useState<MobileSelection | null>(null);
  const olfactory = context === "AROMA" || context === "FRAGRANCE";
  const activeLibrary = context === "AROMA" || context === "FRAGRANCE" ? olfactoryLibrary : sensoryLibrary;
  const toggle = (selection: MobileSelection) =>
    onChange(toggleSensorySelection(value, selection));
  const wheelItems: CircularSensoryItem[] = (
    subfamily?.descriptors ?? family?.subfamilies ?? activeLibrary
  ).map((item) => ({
    name: item.name,
    imageKey: item.imageKey,
    color: ("color" in item && item.color) || family?.color || "#ef6b35",
    assetPath: "assetPath" in item ? item.assetPath : undefined,
    sensoryHint: "sensoryHint" in item ? item.sensoryHint : undefined,
  }));
  const contextSelections = value.filter((item) => item.context === context);
  const selectedNames = contextSelections
    .map((item) => item.descriptor)
    .filter((item): item is string => Boolean(item));
  if (pending?.descriptor && !selectedNames.includes(pending.descriptor))
    selectedNames.push(pending.descriptor);
  const level = subfamily ? "descriptor" : family ? "subfamily" : "family";
  React.useEffect(() => {
    setPending(null);
    setFamily(null);
    setSubfamily(null);
  }, [context]);
  React.useEffect(() => {
    onDepthChange?.(subfamily ? 2 : family ? 1 : 0);
  }, [family, onDepthChange, subfamily]);
  React.useEffect(() => {
    onRootReset?.(() => { setPending(null); setFamily(null); setSubfamily(null); });
  }, [onRootReset]);
  const contextLabel = context === "FLAVOR" ? "Sabor" : context === "FRAGRANCE" ? "Fragrância" : context === "AROMA" ? "Aroma" : context === "AFTERTASTE" ? "Finalização" : context === "ACIDITY" ? "Acidez" : "Corpo";
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-[radial-gradient(circle_at_12%_4%,rgba(255,202,120,.3),transparent_35%),radial-gradient(circle_at_90%_18%,rgba(232,116,191,.2),transparent_34%),rgba(255,255,255,.45)] p-2 shadow-[0_18px_50px_rgba(83,45,31,.08)] sm:p-3" data-sensory-mode={mode}>
      <div className="mb-2 flex items-center justify-between gap-3 px-2 pt-1">
        <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#714934]">{training ? "Treinamento sensorial" : "Cupping profissional"}</p><p className="mt-0.5 text-xs font-semibold text-[#6e5c51]">{contextLabel} · {family ? subfamily ? "Escolha uma percepção" : "Explore uma subfamília" : "Comece pela família"}</p></div>
        <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${mode === "educational" ? "bg-violet-100 text-violet-800" : "bg-orange-100 text-orange-800"}`}>{mode === "educational" ? "Aprender" : "Precisão"}</span>
      </div>
      {training && <span className="mb-2 ml-2 inline-flex rounded-full bg-cyan-50 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-cyan-800">Treinamento · suas escolhas são privadas</span>}
      {family && <button type="button" onClick={() => { setPending(null); setFamily(null); setSubfamily(null); }} className="mb-2 ml-2 inline-flex min-h-11 items-center rounded-full border border-orange-200 bg-white/85 px-4 text-xs font-black text-orange-800">↶ Voltar à roda</button>}
      <CircularSensoryNavigator
        items={wheelItems}
        level={level}
        title={subfamily?.name ?? family?.name ?? (context === "FLAVOR" ? "Sabor" : context === "FRAGRANCE" ? "Fragrância" : "Aroma")}
        breadcrumb={[family?.name, subfamily?.name].filter((item): item is string => Boolean(item))}
        selected={selectedNames}
        immersive={context === "FRAGRANCE" || context === "AROMA"}
        onBack={family ? () => { setPending(null); if (subfamily) setSubfamily(null); else setFamily(null); } : undefined}
        onItem={(wheelItem) => {
          setPending(null);
          if (!family) {
            setFamily(activeLibrary.find((item) => item.name === wheelItem.name) ?? null);
            return;
          }
          if (!subfamily) {
            setSubfamily(family.subfamilies.find((item) => item.name === wheelItem.name) ?? null);
            return;
          }
          const descriptor = subfamily.descriptors.find((item) => item.name === wheelItem.name);
          if (descriptor) {
            const existing = contextSelections.find((item) => item.descriptor === descriptor.name && item.family === family.name && item.subfamily === subfamily.name);
            const selection = existing ?? { context, family: family.name, subfamily: subfamily.name, descriptor: descriptor.name, level: 3, intensity: 3, imageKey: descriptor.imageKey };
            if (olfactory) setPending(selection);
            else toggle(selection);
          }
        }}
      />
      {olfactory && pending && (
        <section className="mt-4 rounded-[2rem] border border-amber-200 bg-white/90 p-4 shadow-sm" aria-label={`Intensidade de ${pending.descriptor}`}>
          <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-amber-800">{pending.family} › {pending.subfamily}</p><h3 className="mt-1 text-lg font-black text-slate-900">{pending.descriptor}</h3><p className="mt-1 text-xs text-slate-500">Quanto você percebe?</p></div><button type="button" onClick={() => setPending(null)} className="min-h-11 px-2 text-xs font-bold text-slate-500">Cancelar</button></div>
          <div className="mt-4 grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Intensidade do aroma">
            {["Muito baixa", "Baixa", "Média", "Marcante", "Muito marcante"].map((label, index) => {
              const intensity = index + 1;
              const active = pending.intensity === intensity;
              return <button type="button" role="radio" aria-checked={active} aria-label={`${label}: ${intensity} de 5`} key={label} onClick={() => setPending({ ...pending, intensity })} className={`min-h-14 rounded-xl border px-1 text-[9px] font-bold leading-3 transition active:scale-95 ${active ? "border-orange-500 bg-orange-500 text-white shadow-md" : "border-amber-100 bg-amber-50 text-slate-700"}`}><span className="mb-1 block text-base">{intensity}</span>{label}</button>;
            })}
          </div>
          <button type="button" onClick={() => { onChange(upsertOlfactoryPerception(contextSelections as OlfactoryStageSelection[], pending as OlfactoryStageSelection) as MobileSelection[]); setPending(null); }} className="mt-4 min-h-12 w-full rounded-xl bg-[#512b1a] px-4 text-sm font-black text-white shadow-md active:scale-[.99]">Adicionar à xícara</button>
        </section>
      )}
      {contextSelections.length > 0 && <div className="mt-4 rounded-3xl border border-orange-100 bg-white/70 p-3">
        <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-500">{context === "FLAVOR" ? "Sua xícara" : "Sua taça — Aroma"}</p><span className="text-[10px] font-bold text-orange-700">{contextSelections.length} aroma{contextSelections.length === 1 ? "" : "s"}</span></div>
        <div className="mt-3 space-y-2">{contextSelections.map((selection, index) => <div key={`${selection.family}-${selection.descriptor}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl border border-orange-100 bg-orange-50/70 p-3"><button type="button" onClick={() => olfactory ? setPending(selection) : undefined} className="min-h-11 flex-1 text-left"><strong className="block text-xs text-slate-800">{selection.descriptor ?? selection.subfamily ?? selection.family}</strong><span className="mt-1 block text-[10px] text-slate-500">{selection.family} › {selection.subfamily} · Intensidade {selection.intensity}/5</span></button><button type="button" onClick={() => onChange(olfactory ? removeOlfactoryPerception(contextSelections as OlfactoryStageSelection[], selection as OlfactoryStageSelection) as MobileSelection[] : toggleSensorySelection(value, selection))} aria-label={`Remover ${selection.descriptor ?? selection.family}`} className="min-h-11 rounded-xl px-3 text-xs font-black text-red-700">Remover</button></div>)}</div>
        {olfactory && <button type="button" onClick={() => { if (window.confirm("Remover todos os aromas desta taça?")) onChange([]); }} className="mt-3 min-h-11 w-full rounded-xl border border-red-100 text-xs font-bold text-red-700">Limpar todos</button>}
      </div>}
      {!olfactory && contextSelections.map((selection, index) => (
          <div
            key={`${selection.family}-${selection.descriptor}-${index}`}
            className="mt-3 grid gap-3 rounded-2xl bg-white/80 p-3 text-xs sm:grid-cols-[1fr_auto] sm:items-center"
          >
            <span>
              <b>
                {selection.descriptor ??
                  selection.subfamily ??
                  selection.family}
              </b>
              <small className="ml-2 text-slate-500">
                intensidade {selection.intensity}/5
              </small>
            </span>
            <input
              aria-label={`Intensidade de ${selection.descriptor}`}
              type="range"
              min="1"
              max="5"
              value={selection.intensity}
              className="w-full accent-fuchsia-500 sm:w-32"
              onChange={(event) =>
                onChange(
                  value.map((item) =>
                    item === selection
                      ? { ...item, intensity: Number(event.target.value) }
                      : item,
                  ),
                )
              }
            />
          </div>
        ))}
    </div>
  );
}

export function CuppingOlfactoryBowl({
  moment,
  selections,
  expanded,
  onToggle,
}: {
  moment: "FRAGRANCE" | "AROMA";
  selections: MobileSelection[];
  expanded: boolean;
  onToggle(): void;
}) {
  const current = selections.filter((item) => item.context === moment);
  const assetFor = (selection: MobileSelection) =>
    olfactoryLibrary
      .find((family) => family.name === selection.family)
      ?.subfamilies.find((subfamily) => subfamily.name === selection.subfamily)
      ?.descriptors.find((descriptor) => descriptor.name === selection.descriptor)
      ?.assetPath;
  return (
    <section className="overflow-hidden rounded-[2rem] border border-amber-100 bg-[radial-gradient(circle_at_50%_25%,#fff_0,#fff9ef_55%,#f3e8da_100%)] p-4 text-center transition-all">
      <button type="button" onClick={onToggle} aria-expanded={expanded} className="flex min-h-11 w-full items-center justify-between text-left"><span className="text-xs font-black uppercase tracking-[.12em] text-slate-700">Sua taça — {moment === "FRAGRANCE" ? "Fragrância" : "Aroma"}</span><span className="text-[10px] font-bold text-amber-800">{current.length} percepç{current.length === 1 ? "ão" : "ões"} · {expanded ? "Recolher" : "Expandir"}</span></button>
      {expanded && <>
      <p className="text-[10px] font-black uppercase tracking-[.16em] text-amber-800">{moment === "FRAGRANCE" ? "Café moído seco" : "Após a infusão"}</p>
      <div className="relative mx-auto mt-2 h-44 max-w-xs">
        <Image
          src={moment === "FRAGRANCE" ? "/sensory/aroma/stages/fragrancia-seca.webp" : "/sensory/aroma/stages/aroma-crosta.webp"}
          alt={moment === "FRAGRANCE" ? "Taça técnica de cupping sem alça com café moído seco" : "Taça técnica de cupping sem alça, cheia, com crosta de café após a infusão"}
          fill
          sizes="320px"
          className="object-contain"
          priority
        />
        {current.slice(0, 5).map((selection, index) => {
          const assetPath = assetFor(selection);
          return <span key={`${selection.family}-${selection.descriptor}`} className="absolute flex size-16 flex-col items-center justify-center rounded-full border border-white/90 bg-white/92 p-1 text-[8px] font-bold leading-3 text-slate-700 shadow-md" style={{ left: `${2 + (index % 2) * 74}%`, top: `${3 + index * 16}%` }}>{assetPath ? <Image src={assetPath} width={46} height={40} alt={selection.descriptor ?? "Percepção aromática"} className="h-9 w-11 object-contain" /> : null}<span>{selection.descriptor}</span></span>;
        })}
      </div>
      <p className="mt-1 text-[11px] text-slate-500">{current.length ? `${current.length} percepção${current.length === 1 ? "" : "ões"} registrada${current.length === 1 ? "" : "s"}` : "As percepções aparecerão ao redor da taça."}</p>
      </>}
    </section>
  );
}

export function BodyPerceptionSelector({
  kind,
  label,
  values,
  value,
  onChange,
}: {
  kind: "weight" | "texture";
  label: string;
  values: readonly string[];
  value?: string;
  onChange(value: string): void;
}) {
  return (
    <section className="rounded-[2rem] bg-gradient-to-br from-sky-50/90 to-stone-50/90 p-4 shadow-sm">
      <div className="flex items-center gap-2">
        {kind === "weight" ? (
          <Layers3 size={20} className="text-sky-700" />
        ) : (
          <Waves size={20} className="text-sky-700" />
        )}
        <h2 className="text-xs font-black uppercase tracking-[.14em] text-slate-600">
          {label}
        </h2>
      </div>
      <div
        className={`mt-4 grid gap-2 ${kind === "weight" ? "grid-cols-1" : "grid-cols-2"}`}
      >
        {values.map((item, index) => {
          const selected = value === item;
          return (
            <button
              type="button"
              key={item}
              aria-pressed={selected}
              onClick={() => onChange(item)}
              className={`relative min-h-14 rounded-2xl border px-4 text-left text-sm font-bold transition active:scale-[.99] ${selected ? "border-sky-500 bg-sky-500 text-white shadow-md" : "border-white bg-white/80 text-slate-700"}`}
            >
              <span className="flex items-center justify-between gap-3">
                <span>{item}</span>
                {kind === "weight" ? (
                  <span className="flex items-end gap-1" aria-hidden="true">
                    {Array.from({ length: 5 }, (_, bar) => (
                      <i
                        key={bar}
                        className={`block w-1.5 rounded-full ${bar <= index ? (selected ? "bg-white" : "bg-sky-400") : selected ? "bg-white/30" : "bg-slate-200"}`}
                        style={{ height: `${8 + bar * 3}px` }}
                      />
                    ))}
                  </span>
                ) : selected ? (
                  <Check size={17} />
                ) : (
                  <Sparkles size={16} className="text-slate-300" />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

const tactilePresentation = {
  Sedoso: {
    icon: Waves,
    reference: "fino · fluido · delicado",
    color: "border-sky-400 bg-sky-50 text-sky-900",
  },
  Cremoso: {
    icon: Droplets,
    reference: "envolvente · cremoso · macio",
    color: "border-amber-400 bg-amber-50 text-amber-900",
  },
  Aveludado: {
    icon: Layers3,
    reference: "macio · uniforme · aveludado",
    color: "border-violet-400 bg-violet-50 text-violet-900",
  },
  Suave: {
    icon: Sparkles,
    reference: "leve · delicado · pouca resistência",
    color: "border-cyan-300 bg-cyan-50 text-cyan-900",
  },
  Denso: {
    icon: Circle,
    reference: "espesso · pesado · concentrado",
    color: "border-stone-500 bg-stone-100 text-stone-900",
  },
} as const;

export function SensoryTactileCard({
  texture,
  selected,
  onClick,
}: {
  texture: string;
  selected: boolean;
  onClick(): void;
}) {
  const visual =
    tactilePresentation[texture as keyof typeof tactilePresentation] ??
    tactilePresentation.Suave;
  const Icon = visual.icon;
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`relative min-h-32 rounded-3xl border-2 p-4 text-left transition active:scale-[.98] ${selected ? `${visual.color} shadow-md ring-2 ring-white` : "border-white bg-white/80 text-slate-700"}`}
    >
      <Icon
        size={27}
        strokeWidth={1.8}
        className={selected ? "opacity-90" : "text-slate-400"}
      />
      <b className="mt-4 block text-sm">{texture}</b>
      <small className="mt-1 block text-[11px] leading-4 opacity-75">
        {visual.reference}
      </small>
      {selected && (
        <Check
          className="absolute right-3 top-3 rounded-full bg-white/80 p-1"
          size={22}
        />
      )}
    </button>
  );
}

export function BodyTextureSelector({
  values,
  selected,
  onChange,
}: {
  values: readonly string[];
  selected: string[];
  onChange(values: string[]): void;
}) {
  return (
    <section className="rounded-[2rem] bg-gradient-to-br from-sky-50/90 to-stone-50/90 p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Waves size={20} className="text-sky-700" />
        <h2 className="text-xs font-black uppercase tracking-[.14em] text-slate-600">
          Textura / sensação tátil
        </h2>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        Você pode reconhecer mais de uma sensação.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {values.map((texture) => (
          <SensoryTactileCard
            key={texture}
            texture={texture}
            selected={selected.includes(texture)}
            onClick={() =>
              onChange(
                selected.includes(texture)
                  ? selected.filter((item) => item !== texture)
                  : [...selected, texture],
              )
            }
          />
        ))}
      </div>
    </section>
  );
}

export function AftertastePersistenceSelector({
  value,
  onChange,
}: {
  value?: string;
  onChange(value: string): void;
}) {
  const options = [
    { label: "Curta", waves: 1 },
    { label: "Média", waves: 2 },
    { label: "Longa", waves: 3 },
    { label: "Muito longa", waves: 4 },
  ];
  return (
    <section className="rounded-[2rem] bg-gradient-to-br from-amber-50/90 to-rose-50/90 p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Clock3 className="text-amber-600" size={20} />
        <h2 className="text-xs font-black uppercase tracking-[.14em] text-slate-600">
          Persistência
        </h2>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        Por quanto tempo as sensações permanecem após provar o café?
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {options.map((option) => {
          const selected = value === option.label;
          return (
            <button
              type="button"
              key={option.label}
              aria-pressed={selected}
              onClick={() => onChange(option.label)}
              className={`relative min-h-24 rounded-3xl border p-4 text-left transition ${selected ? "border-orange-500 bg-orange-500 text-white shadow-lg shadow-orange-200" : "border-white/80 bg-white/80 text-slate-700"}`}
            >
              <span className="flex gap-1" aria-hidden="true">
                {Array.from({ length: option.waves }, (_, index) => (
                  <Waves
                    key={index}
                    size={17}
                    className={selected ? "text-white" : "text-orange-400"}
                  />
                ))}
              </span>
              <b className="mt-3 block text-sm">{option.label}</b>
              {selected && (
                <Check className="absolute right-3 top-3" size={18} />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

const acidityVisuals = {
  Cítrica: {
    icon: Citrus,
    reference: "limão · laranja · tangerina",
    color: "border-yellow-400 bg-yellow-50 text-yellow-900",
  },
  Málica: {
    icon: Apple,
    reference: "maçã verde · pera",
    color: "border-lime-400 bg-lime-50 text-lime-900",
  },
  Tartárica: {
    icon: Grape,
    reference: "uva · tamarindo",
    color: "border-violet-400 bg-violet-50 text-violet-900",
  },
  Láctica: {
    icon: Milk,
    reference: "cremosa · láctea",
    color: "border-sky-300 bg-sky-50 text-sky-900",
  },
  Fosfórica: {
    icon: Sparkles,
    reference: "brilhante · mineral · efervescente",
    color: "border-cyan-400 bg-cyan-50 text-cyan-900",
  },
  Acética: {
    icon: Droplets,
    reference: "viva · pungente",
    color: "border-orange-400 bg-orange-50 text-orange-900",
  },
  Outra: {
    icon: Plus,
    reference: "outra percepção",
    color: "border-slate-300 bg-slate-50 text-slate-800",
  },
} as const;

export function AcidityTypeSelector({
  values,
  selected,
  onChange,
}: {
  values: readonly string[];
  selected: string[];
  onChange(values: string[]): void;
}) {
  return (
    <section className="rounded-[2rem] bg-white/65 p-4">
      <h2 className="text-xs font-black uppercase tracking-[.14em] text-slate-600">
        Tipo de acidez
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Você pode escolher mais de uma percepção.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {values.map((type) => {
          const active = selected.includes(type);
          const visual =
            acidityVisuals[type as keyof typeof acidityVisuals] ??
            acidityVisuals.Outra;
          const Icon = visual.icon;
          return (
            <button
              type="button"
              key={type}
              aria-pressed={active}
              onClick={() =>
                onChange(
                  active
                    ? selected.filter((item) => item !== type)
                    : [...selected, type],
                )
              }
              className={`relative min-h-32 rounded-3xl border-2 p-4 text-left transition ${active ? `${visual.color} ring-2 ring-white shadow-lg` : "border-white/80 bg-white/80 text-slate-700"}`}
            >
              <Icon
                size={28}
                className={active ? "opacity-90" : "text-slate-400"}
              />
              <b className="mt-4 block text-sm">{type}</b>
              <small className="mt-1 block leading-4 opacity-75">
                {visual.reference}
              </small>
              {active && (
                <Check
                  className="absolute right-3 top-3 rounded-full bg-white/80 p-1"
                  size={22}
                />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function AcidityQualitySelector({
  values,
  value,
  onChange,
}: {
  values: readonly string[];
  value?: string;
  onChange(value: string): void;
}) {
  return (
    <section className="rounded-[2rem] bg-gradient-to-r from-cyan-50/90 to-lime-50/90 p-4">
      <h2 className="text-xs font-black uppercase tracking-[.14em] text-slate-600">
        Qualidade da acidez
      </h2>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {values.map((quality) => {
          const active = value === quality;
          return (
            <button
              type="button"
              key={quality}
              aria-pressed={active}
              onClick={() => onChange(quality)}
              className={`min-h-14 rounded-2xl border px-2 text-sm font-black ${active ? "border-cyan-500 bg-cyan-500 text-white" : "border-white bg-white/80 text-slate-700"}`}
            >
              {quality}
              {active && <Check className="ml-1 inline" size={14} />}
            </button>
          );
        })}
      </div>
    </section>
  );
}

const trainingCopy: Record<string, string> = {
  aroma:
    "Observe as lembranças despertadas pelo aroma antes de escolher referências.",
  sabor: "Perceba o que aparece na boca sem assumir que será igual ao aroma.",
  finalizacao: "Observe duração e caráter depois que o café deixa a boca.",
  acidez:
    "Tipo descreve a sensação; qualidade descreve sua expressão. Nenhum deles define a nota.",
  corpo: "Peso e textura são percepções táteis diferentes e podem coexistir.",
  equilibrio:
    "Observe como os atributos convivem, sem buscar uma nota sugerida.",
  cups: "Compare as cinco taças e toque somente naquela que apresentar diferença.",
  overall:
    "Registre sua impressão global sem usar as notas anteriores como âncora.",
};

export function CuppingTrainingHint({
  attribute,
  enabled,
}: {
  attribute: string;
  enabled: boolean;
}) {
  if (!enabled) return null;
  return (
    <details className="rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4 text-sm text-cyan-950">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 font-black">
        <Info size={18} /> Entenda este atributo
      </summary>
      <p className="mt-2 text-xs leading-5 text-cyan-900">
        {trainingCopy[attribute] ??
          "Observe a percepção com atenção antes de registrar."}
      </p>
    </details>
  );
}

export function BalanceIntegrationVisual() {
  return (
    <div
      className="relative mx-auto h-32 max-w-sm overflow-hidden rounded-[2rem] border border-white/80 bg-white/65"
      aria-label="Representação visual da integração dos atributos"
    >
      {["bg-fuchsia-200", "bg-orange-200", "bg-cyan-200", "bg-lime-200"].map(
        (color, index) => (
          <span
            key={color}
            className={`absolute size-20 rounded-full border border-white/80 ${color} opacity-75`}
            style={{
              left: `${18 + index * 16}%`,
              top: `${22 + (index % 2) * 15}%`,
            }}
          />
        ),
      )}
      <span className="absolute inset-0 grid place-items-center text-xs font-black uppercase tracking-[.14em] text-slate-600">
        Integração
      </span>
    </div>
  );
}

export function CuppingSensoryProfile({
  selections,
  acidityTypes,
  bodyTextures,
  aftertastePersistence,
  aftertasteCharacter,
}: {
  selections: CuppingSensorySelection[];
  acidityTypes: string[];
  bodyTextures: string[];
  aftertastePersistence?: string;
  aftertasteCharacter?: string;
}) {
  const groups = deriveCuppingSensoryProfile({
    selections,
    acidityTypes,
    bodyTextures,
    aftertastePersistence,
    aftertasteCharacter,
  });
  const visualGroups = groups.slice(0, 6).map((group) => {
    const primary = group.values[0] ?? group.label;
    const parts = primary.split(" › ");
    return {
      label: parts[0] ?? group.label,
      detail: parts.slice(1).join(" · ") || group.values.join(" · "),
      artwork: parts.at(-1) ?? group.label,
      fallback: parts.at(-2) ?? parts[0] ?? group.label,
    };
  });
  return (
    <section aria-label="Perfil sensorial da amostra">
      <h2 className="text-[11px] font-black uppercase tracking-[.08em] text-slate-700">
        Perfil sensorial da amostra
      </h2>
      {visualGroups.length ? (
        <div className="relative mt-3 h-72 overflow-hidden rounded-[1.5rem] bg-white/35">
          <div className="absolute left-1/2 top-1/2 grid size-28 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[conic-gradient(#e4a246_0_17%,#c785b3_17%_34%,#9dca68_34%_51%,#5e9c68_51%_68%,#9e7656_68%_84%,#dc805a_84%)] p-4 shadow-sm">
            <span className="grid size-20 place-items-center rounded-full bg-[#fffaf3] text-center text-xs font-black leading-4 text-slate-800">
              Perfil
              <br />
              sensorial
            </span>
          </div>
          {visualGroups.map((group, index) => {
            const positions = [
              "left-2 top-3",
              "right-2 top-3 text-right",
              "left-2 top-[39%]",
              "right-2 top-[39%] text-right",
              "bottom-3 left-2",
              "bottom-3 right-2 text-right",
            ];
            return (
              <div
                key={`${group.label}-${group.detail}`}
                className={`absolute w-[34%] ${positions[index]}`}
              >
                <ApprovedSensoryArtwork
                  name={group.artwork}
                  fallback={group.fallback}
                  className={`h-10 w-14 ${index % 2 ? "ml-auto" : ""}`}
                />
                <b className="block text-[11px] text-slate-800">
                  {group.label}
                </b>
                <small className="block text-[9px] leading-3 text-slate-500">
                  {group.detail}
                </small>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 rounded-2xl bg-white/60 p-4 text-xs leading-5 text-slate-500">
          O perfil aparecerá conforme você registrar suas percepções.
        </p>
      )}
    </section>
  );
}

export type CupState = {
  attribute: "UNIFORMITY" | "SWEETNESS" | "CLEAN_CUP";
  cupNumber: number;
  selected: boolean;
  defectType?: string;
  defectSeverity?: "TAINT" | "FAULT";
  defectDescription?: string;
  notes?: string;
};
export function FiveCupSelector({
  label,
  attribute,
  cups,
  onChange,
  defects,
}: {
  label: string;
  attribute: CupState["attribute"];
  cups: CupState[];
  onChange(cups: CupState[]): void;
  defects: readonly string[];
}) {
  const current = Array.from(
    { length: 5 },
    (_, i) =>
      cups.find(
        (cup) => cup.attribute === attribute && cup.cupNumber === i + 1,
      ) ?? { attribute, cupNumber: i + 1, selected: true },
  );
  const update = (cup: CupState) =>
    onChange([
      ...cups.filter(
        (item) =>
          !(item.attribute === attribute && item.cupNumber === cup.cupNumber),
      ),
      cup,
    ]);
  const guidance = {
    UNIFORMITY: {
      question: "As cinco taças estão consistentes entre si?",
      help: "Se perceber diferença em alguma taça, toque nela.",
    },
    SWEETNESS: {
      question: "A doçura está presente nas cinco taças?",
      help: "Toque somente nas taças em que a doçura não estiver presente.",
    },
    CLEAN_CUP: {
      question: "As cinco taças estão limpas, sem interferências?",
      help: "Toque somente na taça em que perceber algum problema.",
    },
  }[attribute];
  return (
    <section className="border-b border-dashed border-slate-300 pb-5 last:border-b-0">
      <div className="flex items-center justify-between">
        <h3 className="font-black text-slate-800">{label}</h3>
        <b className="text-fuchsia-700">
          {current.filter((cup) => cup.selected).length * 2}/10
        </b>
      </div>
      <p className="mt-3 text-sm font-bold text-slate-700">
        {guidance.question}
      </p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{guidance.help}</p>
      <div className="mt-4 grid grid-cols-5 gap-2">
        {current.map((cup) => (
          <button
            type="button"
            key={cup.cupNumber}
            onClick={() => {
              const selected = !cup.selected;
              update({
                ...cup,
                selected,
                defectType: selected ? undefined : cup.defectType,
                defectSeverity: selected ? undefined : cup.defectSeverity,
                defectDescription: selected ? undefined : cup.defectDescription,
              });
            }}
            aria-label={`${label}, xícara ${cup.cupNumber}, ${cup.selected ? "selecionada" : "desmarcada"}`}
            aria-pressed={cup.selected}
            className={`relative min-h-24 rounded-xl border px-1 transition active:scale-[.98] ${cup.selected ? "border-fuchsia-300 bg-white/75" : "border-orange-400 bg-orange-50"}`}
          >
            <ApprovedSensoryArtwork
              name="Taça de cupping"
              className="mx-auto h-14 w-full"
            />
            <small className="mt-1 block font-black">
              {String(cup.cupNumber).padStart(2, "0")}
            </small>
            {cup.selected && (
              <Check
                className="absolute right-1 top-1 rounded-full bg-fuchsia-600 p-0.5 text-white"
                size={14}
              />
            )}
          </button>
        ))}
      </div>
      {attribute === "CLEAN_CUP" &&
        current
          .filter((cup) => !cup.selected)
          .map((cup) => (
            <div
              key={cup.cupNumber}
              className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3"
            >
              <label className="text-xs font-bold text-rose-900">
                Que problema você percebeu na xícara {cup.cupNumber}?
                <select
                  value={cup.defectType ?? ""}
                  onChange={(e) =>
                    update({ ...cup, defectType: e.target.value })
                  }
                  className="mt-2 min-h-11 w-full rounded-xl border border-rose-200 bg-white px-3"
                >
                  <option value="">Selecione o defeito</option>
                  {defects.map((defect) => (
                    <option key={defect}>{defect}</option>
                  ))}
                </select>
              </label>
              <label className="mt-3 block text-xs font-bold text-rose-900">
                Severidade do defeito
                <select
                  value={cup.defectSeverity ?? ""}
                  onChange={(event) =>
                    update({
                      ...cup,
                      defectSeverity: event.target.value as "TAINT" | "FAULT",
                    })
                  }
                  className="mt-2 min-h-11 w-full rounded-xl border border-rose-200 bg-white px-3"
                >
                  <option value="">Selecione a severidade</option>
                  <option value="TAINT">TAINT · penalidade de 2 pontos</option>
                  <option value="FAULT">FAULT · penalidade de 4 pontos</option>
                </select>
              </label>
              {cup.defectType === "Outro" && (
                <input
                  value={cup.defectDescription ?? ""}
                  onChange={(e) =>
                    update({ ...cup, defectDescription: e.target.value })
                  }
                  className="mt-2 min-h-11 w-full rounded-xl border border-rose-200 px-3 text-xs"
                  placeholder="Descreva o defeito"
                />
              )}
            </div>
          ))}
    </section>
  );
}
