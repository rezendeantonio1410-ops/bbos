"use client";

import * as React from "react";
import Image from "next/image";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Coffee, RotateCcw, Trash2 } from "lucide-react";
import {
  olfactoryLibrary,
  isQualityDeviation,
  removeOlfactoryPerception,
  upsertOlfactoryPerception,
  type OlfactoryStageSelection,
  type SensoryDescriptor,
  type SensoryFamily,
  type SensorySubfamily,
} from "@bbos/shared";

type OlfactoryTemplateProps = {
  context: "FRAGRANCE" | "AROMA" | "FLAVOR" | "AFTERTASTE";
  value: OlfactoryStageSelection[];
  onChange(value: OlfactoryStageSelection[]): void;
  onDepthChange?(depth: number): void;
  onSaveDraft?(): void;
  library?: SensoryFamily[];
};

const familyAngles = [-68, -23, 22, 67, 112, 157, 202, 247];
const haptic = () => {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(8);
};
const subfamilyHints: Record<string, string> = {
  "Flores perfumadas": "Aromas florais intensos, doces e perfumados, com lembranças de rosa, lavanda e violeta.",
  "Frutas vermelhas": "Frutas maduras, frescas e suculentas, com lembranças de morango, cereja e framboesa.",
  "Cítricos": "Aromas vivos e luminosos que lembram limão, lima, tangerina e bergamota.",
  "Frutas tropicais": "Percepções doces e exuberantes de manga, abacaxi, maracujá e mamão.",
  "Outras frutas": "Referências de pomar e frutas de polpa delicada, maduras e frescas.",
  "Frutas secas": "Notas densas e concentradas que lembram uva-passa, figo e ameixa seca.",
  "Fermentação indesejada": "Fermentações excessivas ou deterioradas que se afastam de uma expressão limpa do café.",
  "Mofo / Umidade": "Referências úmidas e abafadas percebidas no café ou nos grãos.",
  Terroso: "Sensações secas ou úmidas que remetem à terra e à poeira.",
  "Queimado / Fumaça": "Referências associadas a calor excessivo, carbonização ou presença de fumaça.",
  "Químico / Contaminação": "Referências associadas a contaminações externas ou compostos químicos indesejados.",
};

function SensoryPhoto({
  src,
  name,
  color,
  sizes = "96px",
  className = "",
  showFallbackText = true,
}: {
  src?: string;
  name: string;
  color: string;
  sizes?: string;
  className?: string;
  showFallbackText?: boolean;
}) {
  if (src) {
    return (
      <span className={`relative block overflow-hidden bg-[#f7efe5] ${className}`}>
        <Image src={src} alt={name} fill sizes={sizes} className="object-cover" />
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label={`Referência visual temporária de ${name}`}
      className={`grid place-items-center overflow-hidden ${showFallbackText ? "bg-[radial-gradient(circle_at_35%_30%,#fff_0,rgba(255,255,255,.68)_22%,transparent_23%),linear-gradient(145deg,var(--photo-light),var(--photo-color))]" : "bg-[linear-gradient(145deg,var(--photo-light),var(--photo-muted))]"} ${className}`}
      style={{ "--photo-color": color, "--photo-light": `${color}35`, "--photo-muted": `${color}78` } as React.CSSProperties}
    >
      {showFallbackText && <span className="max-w-[80%] text-center text-[10px] font-black leading-3 text-white drop-shadow-sm">{name}</span>}
    </span>
  );
}

function FamilyWheel({ context, library, counts, onSelect }: { context: OlfactoryTemplateProps["context"]; library: SensoryFamily[]; counts: Record<string, number>; onSelect(family: SensoryFamily): void }) {
  const [entering, setEntering] = React.useState<string | null>(null);
  const timer = React.useRef<number | null>(null);
  React.useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);
  const enter = (family: SensoryFamily) => {
    if (entering) return;
    haptic();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onSelect(family);
      return;
    }
    setEntering(family.name);
    timer.current = window.setTimeout(() => onSelect(family), 190);
  };
  const wheelGradient = `conic-gradient(from -90deg, ${library.map((family, index) => {
    const start = index * 12.5;
    const end = (index + 1) * 12.5 - 0.4;
    return `${family.color} ${start}% ${end}%, #fffaf3 ${end}% ${(index + 1) * 12.5}%`;
  }).join(", ")})`;
  return (
    <section aria-label={`Roda de famílias de ${context === "FRAGRANCE" || context === "AROMA" ? "aromas" : "sabor"}`}>
      <div className="relative mx-auto aspect-square w-full max-w-[390px] rounded-full border-[7px] border-[#fffaf3] shadow-[0_18px_45px_rgba(76,44,28,.16)]" style={{ background: wheelGradient }}>
        {library.map((family, index) => {
          const angle = familyAngles[index] ?? 0;
          return (
            <button
              key={family.name}
              type="button"
              onClick={() => enter(family)}
              aria-label={`Explorar ${family.name}`}
              className={`absolute left-1/2 top-1/2 z-10 flex h-[31%] w-[30%] -translate-x-1/2 -translate-y-1/2 touch-manipulation flex-col items-center justify-center rounded-[48%] px-1 text-center text-white outline-none transition-[filter,opacity] duration-200 active:brightness-110 focus-visible:ring-4 focus-visible:ring-white/80 motion-reduce:transition-none ${entering === family.name ? "brightness-110 drop-shadow-[0_0_12px_rgba(255,255,255,.75)]" : entering ? "opacity-65" : ""}`}
              style={{ transform: `translate(-50%,-50%) rotate(${angle}deg) translateY(-111%) rotate(${-angle}deg) scale(${entering === family.name ? 1.045 : 1})`, transition: "transform 190ms ease, filter 190ms ease, opacity 190ms ease" }}
            >
              <SensoryPhoto src={family.assetPath} name={family.name} color={family.color} sizes="82px" className={`${family.name === "Desvios de Qualidade" ? "size-[49%]" : "size-[54%]"} min-h-12 rounded-full border-2 border-white/85 shadow-md transition-transform duration-200 motion-reduce:transition-none ${entering === family.name ? "scale-105" : ""}`} />
              <span className={`mt-1.5 font-black drop-shadow-sm ${family.name === "Desvios de Qualidade" ? "max-w-[105px] text-[9px] leading-[10px]" : "max-w-[92px] text-[10px] leading-[11px]"}`}>{family.name}</span>
              {counts[family.name] ? <span aria-label={`${counts[family.name]} percepções em ${family.name}`} className="absolute right-[9%] top-[5%] grid min-h-5 min-w-5 place-items-center rounded-full border-2 border-white bg-[#5a321f] px-1 text-[9px] font-black text-white shadow-md">{counts[family.name]}</span> : null}
              <ChevronRight size={13} strokeWidth={3} className="mt-0.5" />
            </button>
          );
        })}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 grid size-[31%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[6px] border-[#fffaf3] bg-[#5a321f] text-center text-white shadow-[inset_0_0_22px_rgba(0,0,0,.2)]">
          <span><b className="block text-sm tracking-[.12em]">{context === "FRAGRANCE" || context === "AROMA" ? "AROMA" : context === "AFTERTASTE" ? "FINAL" : "SABOR"}</b><small className="mt-1 block px-3 text-[8px] leading-3 text-amber-100">roda sensorial</small></span>
        </div>
      </div>
      <p className="mx-auto mt-5 max-w-xs text-center text-xs leading-5 text-[#705f54]">Toque em uma família da roda para explorar os {context === "FRAGRANCE" || context === "AROMA" ? "aromas" : "sabores"}.</p>
    </section>
  );
}

function SubfamilyArc({
  family,
  selected,
  onSelect,
  onBack,
  onContinue,
}: {
  family: SensoryFamily;
  selected: SensorySubfamily | null;
  onSelect(value: SensorySubfamily): void;
  onBack(): void;
  onContinue(): void;
}) {
  const visibleSubfamilies = family.subfamilies;
  const count = visibleSubfamilies.length;
  const spread = 140;
  const start = -70;
  const center = { x: -8, y: 194 };
  const point = (radius: number, angle: number) => {
    const radians = (angle * Math.PI) / 180;
    return [center.x + radius * Math.cos(radians), center.y + radius * Math.sin(radians)] as const;
  };
  const sector = (inner: number, outer: number, from: number, to: number) => {
    const [x1, y1] = point(outer, from);
    const [x2, y2] = point(outer, to);
    const [x3, y3] = point(inner, to);
    const [x4, y4] = point(inner, from);
    return `M${x1} ${y1}A${outer} ${outer} 0 0 1 ${x2} ${y2}L${x3} ${y3}A${inner} ${inner} 0 0 0 ${x4} ${y4}Z`;
  };
  const openSelected = () => {
    if (selected) onContinue();
  };
  return (
    <section>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.16em]" style={{ color: family.color }}>Família selecionada</p>
        <h2 className="mt-1 text-2xl font-black text-[#3f281c]">{family.name}</h2>
        <p className="mt-1 text-sm font-semibold text-[#76675e]">Selecione uma subfamília</p>
      </div>
      <div className="relative mx-auto mt-5 h-[390px] w-full max-w-[400px] overflow-hidden rounded-[2rem] border border-[#eadbcd] bg-[radial-gradient(circle_at_18%_50%,#fff_0,#fff9f1_52%,#f4e8dc_100%)] shadow-[0_14px_40px_rgba(75,45,28,.1)]">
        <svg viewBox="0 0 400 400" className="absolute inset-0 size-full overflow-visible" aria-label={`Subfamílias de ${family.name}`}>
          {visibleSubfamilies.map((subfamily, index) => {
            const step = spread / count;
            const from = start + index * step + 0.8;
            const to = start + (index + 1) * step - 0.8;
            const middle = (from + to) / 2;
            const [photoX, photoY] = point(157, middle);
            const hasLongDeviationLabel =
              subfamily.name === "Queimado / Fumaça" ||
              subfamily.name === "Químico / Contaminação";
            const [textX, textY] = point(hasLongDeviationLabel ? 91 : 105, middle);
            const labelLines = hasLongDeviationLabel
              ? subfamily.name.split(" / ")
              : [subfamily.name];
            const color = subfamily.color ?? family.color;
            const active = selected?.name === subfamily.name;
            const activate = () => {
              haptic();
              if (active) openSelected();
              else onSelect(subfamily);
            };
            return (
              <g key={subfamily.name} role="button" tabIndex={0} aria-label={active ? `Abrir descritores de ${subfamily.name}` : `Selecionar ${subfamily.name}`} aria-pressed={active} className="cursor-pointer touch-manipulation outline-none focus-visible:[filter:brightness(1.12)] active:[filter:brightness(1.1)]" onClick={activate} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activate(); } }}>
                <path d={sector(58, 184, from, to)} fill={active ? color : `${color}b8`} stroke={active ? "#5a321f" : "#fffaf3"} strokeWidth={active ? 4 : 3} className="transition hover:brightness-105" />
                <foreignObject x={photoX - 28} y={photoY - 28} width="56" height="56" className="pointer-events-none overflow-visible">
                  <SensoryPhoto src={subfamily.assetPath} name={subfamily.name} color={color} sizes="56px" showFallbackText={false} className={`size-14 rounded-full border-[3px] border-white shadow-lg ${active ? "ring-4 ring-white/55" : ""}`} />
                </foreignObject>
                <foreignObject x={textX - 52} y={textY - 24} width="104" height="48" className="pointer-events-none overflow-visible">
                  <span className={`flex h-full flex-col items-center justify-center px-1 text-center font-black text-white drop-shadow-sm ${hasLongDeviationLabel ? "text-[8px] leading-[9px]" : "text-[9px] leading-[10px]"}`}>
                    {labelLines.map((line) => <span key={line} className="block">{line}</span>)}
                  </span>
                </foreignObject>
                {active && <circle cx={photoX + 21} cy={photoY - 21} r="11" fill="#5a321f" stroke="white" strokeWidth="2" />}
                {active && <path d={`M${photoX + 16} ${photoY - 21}l4 4 7-8`} fill="none" stroke="white" strokeWidth="2.5" />}
              </g>
            );
          })}
          <circle cx={center.x} cy={center.y} r="56" fill="#5a321f" stroke="#fffaf3" strokeWidth="5" />
        </svg>
        <button
          type="button"
          onClick={openSelected}
          disabled={!selected}
          aria-label={selected ? `Ver descritores de ${selected.name}` : "Selecione uma subfamília no arco"}
          className="absolute bottom-3 right-2 top-3 z-10 flex w-[47%] touch-manipulation flex-col items-center justify-center rounded-[1.65rem] px-2 text-center outline-none transition active:scale-[.97] active:bg-white/55 focus-visible:ring-4 focus-visible:ring-[#5a321f]/25 disabled:cursor-default disabled:active:scale-100 disabled:active:bg-transparent"
        >
          <span key={selected?.name ?? family.name} data-sensory-motion className="flex flex-col items-center motion-safe:animate-[sensoryReveal_220ms_ease-out]">
            <SensoryPhoto src={selected?.assetPath ?? family.assetPath} name={selected?.name ?? family.name} color={selected?.color ?? family.color} sizes="165px" className="size-[clamp(7.5rem,34vw,9.5rem)] rounded-full border-4 border-white shadow-[0_18px_34px_rgba(71,39,22,.2)]" />
            <strong className="mt-4 max-w-[150px] text-base leading-5 text-[#42291d]">{selected?.name ?? "Escolha no arco"}</strong>
            <p className="mt-2 max-w-[155px] text-[10px] leading-4 text-[#78685e]">{selected ? subfamilyHints[selected.name] ?? `Referências aromáticas de ${selected.name.toLocaleLowerCase("pt-BR")}.` : "Toque em uma subfamília para conhecer suas referências."}</p>
          </span>
          {selected && <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-black text-[#5a321f]">Toque para explorar <ChevronRight size={14} /></span>}
        </button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button type="button" onClick={onBack} className="inline-flex min-h-12 items-center justify-center gap-1 rounded-xl border border-[#ddcbbb] bg-white/80 text-sm font-black text-[#553321]"><ChevronLeft size={19} /> Voltar</button>
        <button type="button" onClick={openSelected} disabled={!selected} className="inline-flex min-h-12 touch-manipulation items-center justify-center gap-1 rounded-xl bg-[#572f1d] px-3 text-sm font-black text-white shadow-lg active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40">Ver descritores <ChevronRight size={17} /></button>
      </div>
    </section>
  );
}

function DescriptorGrid({
  context,
  family,
  subfamily,
  selectedNames,
  pending,
  onBack,
  onWheel,
  onSelect,
  onPending,
  onAdd,
  adding,
  addedLabel,
}: {
  context: OlfactoryTemplateProps["context"];
  family: SensoryFamily;
  subfamily: SensorySubfamily;
  selectedNames: string[];
  pending: OlfactoryStageSelection | null;
  onBack(): void;
  onWheel(): void;
  onSelect(descriptor: SensoryDescriptor): void;
  onPending(selection: OlfactoryStageSelection): void;
  onAdd(): void;
  adding: boolean;
  addedLabel: string;
}) {
  const intensityTrack = React.useRef<HTMLDivElement | null>(null);
  const draggingIntensity = React.useRef(false);
  const enhancedFamily = context === "FLAVOR" || context === "AFTERTASTE" || family.name === "Frutado" || family.name === "Doce" || family.name === "Floral" || family.name === "Chocolate / Cacau";
  const updateIntensityFromPointer = (clientX: number) => {
    if (!pending || !intensityTrack.current) return;
    const bounds = intensityTrack.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(0.999, (clientX - bounds.left) / bounds.width));
    onPending({ ...pending, intensity: Math.floor(ratio * 5) + 1 });
  };
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2"><button type="button" onClick={onBack} className="inline-flex min-h-12 items-center gap-1 rounded-full px-2 text-sm font-black text-[#553321]"><ChevronLeft size={19} /> {family.name}</button><button type="button" onClick={onWheel} className="inline-flex min-h-12 items-center gap-1 rounded-full border border-[#ddcbbb] bg-white/85 px-4 text-xs font-black text-[#553321] shadow-sm"><RotateCcw size={15} /> Voltar à roda</button></div>
      <p className="mt-1 text-xs font-bold text-[#987b68]">{family.name} › {subfamily.name}</p>
      <h2 className="mt-2 text-2xl font-black text-[#3f281c]">Isso se parece com...</h2>
      <p className="mt-1 text-sm text-[#76675e]">Selecione uma ou mais referências {context === "FRAGRANCE" || context === "AROMA" ? "aromáticas" : "de sabor"}.</p>
      <div className="mt-5 grid grid-cols-3 gap-x-3 gap-y-5">
        {subfamily.descriptors.map((descriptor, index) => {
          const selected = selectedNames.includes(descriptor.name);
          const active = pending?.descriptor === descriptor.name;
          return (
            <button key={descriptor.name} data-sensory-motion type="button" aria-pressed={selected} onClick={() => { haptic(); onSelect(descriptor); }} className="group flex min-h-32 touch-manipulation flex-col items-center rounded-2xl text-center opacity-0 outline-none transition-transform duration-200 active:scale-[.97] focus-visible:ring-4 focus-visible:ring-[#d94b32]/20 motion-safe:animate-[sensoryRise_240ms_ease-out_forwards] motion-reduce:opacity-100 motion-reduce:transition-none" style={{ animationDelay: `${Math.min(index * 55, 440)}ms` }}>
              <span className={`relative rounded-full border-[3px] p-1 transition ${selected ? "shadow-[0_0_0_4px_rgba(221,98,91,.16)]" : "border-white shadow-md"} ${active ? "ring-2 ring-[#5a321f]/35 ring-offset-2" : ""}`} style={{ borderColor: selected ? family.color : "white" }}>
                <SensoryPhoto src={descriptor.assetPath} name={descriptor.name} color={descriptor.color ?? subfamily.color ?? family.color} sizes="104px" showFallbackText={family.name !== "Desvios de Qualidade"} className="size-[clamp(5.4rem,25vw,6.8rem)] rounded-full" />
                {selected && <span className="absolute right-0 top-0 grid size-7 place-items-center rounded-full bg-[#d94b32] text-white shadow"><Check size={16} strokeWidth={3} /></span>}
              </span>
              <span className="mt-2 max-w-full text-[11px] font-black leading-3 text-[#4a3327]">{descriptor.name}</span>
            </button>
          );
        })}
      </div>
      {pending && (
        <div className="mt-6 rounded-[1.75rem] border border-[#ead7c6] bg-white p-4 shadow-[0_16px_42px_rgba(69,39,22,.12)]">
          <div className="flex items-center gap-3">
            <SensoryPhoto src={subfamily.descriptors.find((item) => item.name === pending.descriptor)?.assetPath} name={pending.descriptor ?? "Aroma"} color={family.color} sizes="76px" className={`size-20 shrink-0 rounded-full transition-[transform,opacity] motion-reduce:transition-none ${adding && enhancedFamily ? "scale-75 opacity-20" : "scale-100 opacity-100"}`} />
            <div><p className="text-[10px] font-bold text-[#987b68]">{family.name} › {subfamily.name}</p><h3 className="mt-1 text-xl font-black text-[#41291d]">{pending.descriptor}</h3><p className="mt-1 text-xs text-[#76675e]">Ajuste a intensidade antes de adicionar esta percepção.</p></div>
          </div>
          <p className="mt-5 text-sm font-black text-[#4a3327]">Quanto você percebe?</p>
          <div
            ref={intensityTrack}
            className={`relative mt-3 grid grid-cols-5 gap-1 ${enhancedFamily ? "touch-none" : ""}`}
            role="radiogroup"
            aria-label={`Intensidade ${context === "FRAGRANCE" || context === "AROMA" ? "do aroma" : "do sabor"}`}
            onPointerDown={(event) => {
              if (!enhancedFamily) return;
              draggingIntensity.current = true;
              event.currentTarget.setPointerCapture(event.pointerId);
              updateIntensityFromPointer(event.clientX);
            }}
            onPointerMove={(event) => {
              if (enhancedFamily && draggingIntensity.current) updateIntensityFromPointer(event.clientX);
            }}
            onPointerUp={(event) => {
              if (!enhancedFamily) return;
              draggingIntensity.current = false;
              if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onPointerCancel={() => { draggingIntensity.current = false; }}
          >
            <span className="pointer-events-none absolute left-[10%] right-[10%] top-[22px] h-px bg-[#d9c6b6]" />
            {["Sutil", "Leve", "Médio", "Intenso", "Marcante"].map((label, index) => {
              const intensity = index + 1;
              const active = pending.intensity === intensity;
              return <button key={label} type="button" role="radio" aria-checked={active} aria-label={`${label}, ${intensity} de 5`} onClick={() => { if (!enhancedFamily) onPending({ ...pending, intensity }); }} onKeyDown={(event) => { if (enhancedFamily && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onPending({ ...pending, intensity }); } }} className="relative z-10 flex min-h-14 touch-manipulation flex-col items-center justify-start pt-2 text-[8px] font-black leading-3 text-[#66544a] active:scale-95"><span className={`mb-2 block rounded-full border-[3px] border-[#fffaf4] shadow-[0_0_0_1px_#d4c0ae] transition ${active ? "size-7 bg-[#c73f2c] shadow-[0_0_0_4px_rgba(199,63,44,.16)]" : "size-5 bg-[#cbb8a7]"}`} />{label}</button>;
            })}
          </div>
          <button type="button" onClick={onAdd} disabled={adding} className={`mt-4 min-h-13 w-full rounded-xl bg-[#c73f2c] px-4 text-sm font-black text-white shadow-lg transition-transform active:scale-[.98] disabled:opacity-80 motion-reduce:transition-none ${adding ? "scale-[.98]" : ""}`}>{adding ? "Adicionando…" : "Adicionar à xícara"}</button>
        </div>
      )}
      {addedLabel && <p role="status" data-sensory-motion className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-center text-xs font-black text-emerald-800 motion-safe:animate-[sensoryReveal_220ms_ease-out]">✓ {addedLabel} adicionado à sua xícara</p>}
    </section>
  );
}

function CupSummary({ context, library, value, onChange, onEdit, onSaveDraft, counterPulse }: {
  context: OlfactoryTemplateProps["context"];
  library: SensoryFamily[];
  value: OlfactoryStageSelection[];
  onChange(value: OlfactoryStageSelection[]): void;
  onEdit(value: OlfactoryStageSelection): void;
  onSaveDraft?(): void;
  counterPulse: number;
}) {
  const intensityLabels = ["", "Sutil", "Leve", "Médio", "Intenso", "Marcante"];
  const sensoryAttributes = value.filter((selection) => !isQualityDeviation(selection));
  const qualityDeviations = value.filter(isQualityDeviation);
  const groupedSensoryAttributes = sensoryAttributes.reduce<Record<string, OlfactoryStageSelection[]>>((groups, selection) => {
    (groups[selection.family] ??= []).push(selection);
    return groups;
  }, {});
  const renderSelections = (selections: OlfactoryStageSelection[], deviation = false) => selections.map((selection, index) => {
    const descriptor = library.find((item) => item.name === selection.family)?.subfamilies.find((item) => item.name === selection.subfamily)?.descriptors.find((item) => item.name === selection.descriptor);
    return <article key={`${selection.family}-${selection.subfamily}-${selection.descriptor}`} data-sensory-motion className={`flex items-center gap-3 rounded-2xl p-2.5 motion-safe:animate-[sensoryRise_220ms_ease-out] ${deviation ? "border border-[#d6cec5] bg-[#f4f1ed]" : "bg-[#fff8f1]"}`} style={{ animationDelay: `${Math.min(index * 35, 140)}ms` }}><SensoryPhoto src={descriptor?.assetPath} name={selection.descriptor ?? "Aroma"} color={descriptor?.color ?? "#9b6a4d"} sizes="52px" className="size-13 shrink-0 rounded-full" /><button type="button" onClick={() => onEdit(selection)} className="min-h-11 min-w-0 flex-1 text-left"><strong className="block text-xs text-[#432c20]">{selection.descriptor}</strong><span className="mt-1 block text-[9px] leading-3 text-[#88766b]">{selection.family} › {selection.subfamily}</span><span className="mt-1 flex items-center gap-1" aria-label={`Intensidade ${selection.intensity} de 5`}>{Array.from({ length: 5 }, (_, pointIndex) => <i key={pointIndex} className={`block size-2 rounded-full ${pointIndex < selection.intensity ? deviation ? "bg-[#6f6a62]" : "bg-[#c73f2c]" : "bg-[#dfd2c7]"}`} />)}<small className="ml-1 text-[9px] font-bold not-italic text-[#765e50]">{intensityLabels[selection.intensity] ?? `${selection.intensity}/5`}</small></span></button><button type="button" onClick={() => onChange(removeOlfactoryPerception(value, selection))} aria-label={`Remover ${selection.descriptor}`} className="grid size-11 shrink-0 place-items-center rounded-full text-[#a13c31]"><Trash2 size={17} /></button></article>;
  });
  return (
    <section className="mt-6 rounded-[1.8rem] border border-[#e8d7c7] bg-white/85 p-4 shadow-[0_12px_36px_rgba(69,39,22,.08)]">
      <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#8a6b58]">Sua xícara ({context === "FRAGRANCE" ? "fragrância" : context === "AROMA" ? "aroma" : context === "AFTERTASTE" ? "finalização" : "sabor"})</p><p className="mt-1 text-xs text-[#76675e]">{sensoryAttributes.length ? sensoryAttributes.length >= 3 ? `Seu perfil ${context === "FRAGRANCE" || context === "AROMA" ? "aromático" : "de sabor"} está tomando forma` : `${sensoryAttributes.length} percepção${sensoryAttributes.length === 1 ? " encontrada" : "ões encontradas"}` : "Suas percepções aparecerão aqui."}</p></div><span key={counterPulse} data-sensory-motion className="grid size-9 place-items-center rounded-full bg-[#5a321f] text-sm font-black text-white motion-safe:animate-[counterPulse_260ms_ease-out]">{sensoryAttributes.length}</span></div>
      {sensoryAttributes.length > 0 && <div className="mt-4 space-y-4">{Object.entries(groupedSensoryAttributes).map(([familyName, familySelections]) => <div key={familyName}><p className="mb-2 text-[9px] font-black uppercase tracking-[.14em] text-[#8a6b58]">{familyName}</p><div className="space-y-2">{renderSelections(familySelections)}</div></div>)}</div>}
      {qualityDeviations.length > 0 && <div className="mt-5 border-t border-[#ddd4cb] pt-4"><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#66615b]">Desvios de qualidade</p><div className="mt-3 space-y-2">{renderSelections(qualityDeviations, true)}</div></div>}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" disabled={!value.length} onClick={() => { if (window.confirm("Remover todas as percepções desta xícara?")) onChange([]); }} className="inline-flex min-h-12 items-center justify-center gap-1 rounded-xl border border-[#e5d5c7] text-xs font-black text-[#7b5b49] disabled:opacity-40"><RotateCcw size={15} /> Limpar tudo</button>
        <button type="button" onClick={onSaveDraft} className="min-h-12 rounded-xl bg-[#5a321f] px-3 text-xs font-black text-white">Salvar rascunho</button>
      </div>
    </section>
  );
}

export function CuppingOlfactoryTemplate({ context, value, onChange, onDepthChange, onSaveDraft, library = olfactoryLibrary }: OlfactoryTemplateProps) {
  const [family, setFamily] = React.useState<SensoryFamily | null>(null);
  const [subfamily, setSubfamily] = React.useState<SensorySubfamily | null>(null);
  const [descriptorView, setDescriptorView] = React.useState(false);
  const [pending, setPending] = React.useState<OlfactoryStageSelection | null>(null);
  const [selectedDescriptors, setSelectedDescriptors] = React.useState<OlfactoryStageSelection[]>([]);
  const [adding, setAdding] = React.useState(false);
  const [addedLabel, setAddedLabel] = React.useState("");
  const [counterPulse, setCounterPulse] = React.useState(0);
  const [quickCupOpen, setQuickCupOpen] = React.useState(false);
  const addTimer = React.useRef<number | null>(null);
  const messageTimer = React.useRef<number | null>(null);
  React.useEffect(() => () => {
    if (addTimer.current) window.clearTimeout(addTimer.current);
    if (messageTimer.current) window.clearTimeout(messageTimer.current);
  }, []);
  React.useEffect(() => onDepthChange?.(descriptorView ? 2 : family ? 1 : 0), [descriptorView, family, onDepthChange]);
  const selectedNames = [...value, ...selectedDescriptors].map((item) => item.descriptor).filter((item): item is string => Boolean(item));
  const familyCounts = value.reduce<Record<string, number>>((counts, selection) => {
    counts[selection.family] = (counts[selection.family] ?? 0) + 1;
    return counts;
  }, {});
  const goToWheel = () => { setFamily(null); setSubfamily(null); setDescriptorView(false); setPending(null); };
  const updateActiveDescriptor = (selection: OlfactoryStageSelection) => {
    setPending(selection);
    setSelectedDescriptors((current) => upsertOlfactoryPerception(current, selection));
  };
  const edit = (selection: OlfactoryStageSelection) => {
    const nextFamily = library.find((item) => item.name === selection.family) ?? null;
    const nextSubfamily = nextFamily?.subfamilies.find((item) => item.name === selection.subfamily) ?? null;
    setFamily(nextFamily); setSubfamily(nextSubfamily); setDescriptorView(Boolean(nextSubfamily)); setPending(selection);
  };
  return (
    <div>
      <div className="sticky top-[calc(env(safe-area-inset-top)+.5rem)] z-30 mb-3 flex items-center justify-between gap-2 rounded-2xl border border-[#e6d6c8] bg-[#fffaf5]/95 p-2 shadow-[0_8px_24px_rgba(69,39,22,.1)] backdrop-blur">
        <button type="button" onClick={goToWheel} disabled={!family} className="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-xs font-black text-[#573321] disabled:opacity-40"><RotateCcw size={15} /> Voltar à roda</button>
        <button type="button" onClick={() => setQuickCupOpen((open) => !open)} aria-expanded={quickCupOpen} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#5a321f] px-3 text-xs font-black text-white shadow-sm"><Coffee size={16} /> Sua Xícara · {value.length} <ChevronDown className={`transition-transform ${quickCupOpen ? "rotate-180" : ""}`} size={15} /></button>
      </div>
      {quickCupOpen && <div className="mb-4 rounded-[1.8rem] border border-[#e8d7c7] bg-[#fffdf9] p-1 shadow-lg"><CupSummary context={context} library={library} value={value} onChange={onChange} onEdit={(selection) => { edit(selection); setQuickCupOpen(false); }} onSaveDraft={onSaveDraft} counterPulse={counterPulse} /><button type="button" onClick={() => setQuickCupOpen(false)} className="mb-3 ml-3 min-h-11 rounded-full px-4 text-xs font-black text-[#5a321f]">Retornar à exploração</button></div>}
      {!family && <FamilyWheel context={context} library={library} counts={familyCounts} onSelect={(next) => { setFamily(next); setSubfamily(null); setPending(null); }} />}
      {family && !descriptorView && <SubfamilyArc family={family} selected={subfamily} onSelect={(next) => { setSubfamily(next); setPending(null); }} onBack={() => { setFamily(null); setSubfamily(null); }} onContinue={() => { if (subfamily) setDescriptorView(true); }} />}
      {family && subfamily && descriptorView && <DescriptorGrid context={context} family={family} subfamily={subfamily} selectedNames={selectedNames} pending={pending} adding={adding} addedLabel={addedLabel} onWheel={goToWheel} onBack={() => { setDescriptorView(false); setPending(null); }} onSelect={(descriptor) => {
        const existing = [...selectedDescriptors, ...value].find((item) => item.family === family.name && item.subfamily === subfamily.name && item.descriptor === descriptor.name);
        updateActiveDescriptor(existing ?? { context, family: family.name, subfamily: subfamily.name, descriptor: descriptor.name, level: 3, intensity: 3, imageKey: descriptor.imageKey, perceptionType: family.name === "Desvios de Qualidade" ? "QUALITY_DEVIATION" : "SENSORY_ATTRIBUTE" });
      }} onPending={updateActiveDescriptor} onAdd={() => {
        if (!pending || adding) return;
        haptic();
        setAdding(true);
        const selection = { ...pending, context };
        const playfulFamily = context === "FLAVOR" || context === "AFTERTASTE" || family.name === "Frutado" || family.name === "Doce" || family.name === "Floral" || family.name === "Chocolate / Cacau";
        addTimer.current = window.setTimeout(() => {
          onChange(upsertOlfactoryPerception(value, selection));
          setSelectedDescriptors((current) => removeOlfactoryPerception(current, selection));
          setPending(null);
          setAdding(false);
          setAddedLabel(selection.descriptor ?? "Percepção");
          setCounterPulse((current) => current + 1);
          messageTimer.current = window.setTimeout(() => setAddedLabel(""), 1100);
        }, playfulFamily ? 360 : 180);
      }} />}
      <CupSummary context={context} library={library} value={value} onChange={onChange} onEdit={edit} onSaveDraft={onSaveDraft} counterPulse={counterPulse} />
      <style jsx global>{`
        @keyframes sensoryReveal { from { opacity: 0; transform: scale(.96); } to { opacity: 1; transform: scale(1); } }
        @keyframes sensoryRise { from { opacity: 0; transform: translateY(7px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes counterPulse { 0% { transform: scale(1); } 55% { transform: scale(1.12); } 100% { transform: scale(1); } }
        @media (prefers-reduced-motion: reduce) {
          [data-sensory-motion] { animation: none !important; transition: none !important; opacity: 1 !important; }
        }
      `}</style>
    </div>
  );
}
