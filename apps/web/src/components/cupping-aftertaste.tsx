"use client";

import * as React from "react";
import Image from "next/image";
import { Check, ChevronRight, Droplets, Flower2, Leaf, Sparkles } from "lucide-react";
import { CuppingScorePicker } from "@/components/cupping-mobile";
import {
  aftertasteCharacterOptions,
  aftertasteIntensityOptions,
  aftertastePersistenceOptions,
  sensoryLibrary,
  type OlfactoryStageSelection,
} from "@bbos/shared";

type Props = {
  persistence?: string;
  intensity?: number;
  score?: number;
  characters: string[];
  selections: OlfactoryStageSelection[];
  flavorSelections: OlfactoryStageSelection[];
  onPersistence(value: string): void;
  onIntensity(value: number): void;
  onScore?(value: number): void;
  onCharacters(value: string[]): void;
  onSelections(value: OlfactoryStageSelection[]): void;
  onExplore(): void;
};

const haptic = () => {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(7);
};
const unique = <T extends string>(values: T[]) => [...new Set(values)];
const photoFor = (selection: OlfactoryStageSelection) => sensoryLibrary
  .find((family) => family.name === selection.family)?.subfamilies
  .find((subfamily) => subfamily.name === selection.subfamily)?.descriptors
  .find((descriptor) => descriptor.name === selection.descriptor)?.assetPath;

export function CuppingAftertaste({ persistence, intensity, score, characters, selections, flavorSelections, onPersistence, onIntensity, onScore, onCharacters, onSelections, onExplore }: Props) {
  const [phase, setPhase] = React.useState<1 | 2 | 3>(persistence ? 2 : 1);
  React.useEffect(() => {
    if (intensity != null || characters.length > 0 || selections.length > 0) setPhase(3);
    else if (persistence) setPhase(2);
  }, [characters.length, intensity, persistence, selections.length]);
  const persistenceIndex = Math.max(0, aftertastePersistenceOptions.indexOf(persistence as never));
  const trailIntensity = intensity ?? 3;
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const selectPersistenceAt = React.useCallback((clientX: number) => {
    const bounds = trackRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const ratio = Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width));
    const index = Math.min(3, Math.max(0, Math.round(ratio * 3)));
    const next = aftertastePersistenceOptions[index];
            if (next && next !== persistence) {
              haptic();
              onPersistence(next);
              setPhase(2);
    }
  }, [onPersistence, persistence]);
  const toggleSelection = (selection: OlfactoryStageSelection) => {
    haptic();
    const exists = selections.some((item) => item.family === selection.family && item.subfamily === selection.subfamily && item.descriptor === selection.descriptor);
    onSelections(exists ? selections.filter((item) => !(item.family === selection.family && item.subfamily === selection.subfamily && item.descriptor === selection.descriptor)) : [...selections, { ...selection, context: "AFTERTASTE" }]);
  };
  const toggleCharacter = (character: string) => {
    haptic();
    setPhase(3);
    onCharacters(characters.includes(character) ? characters.filter((item) => item !== character) : unique([...characters, character]));
  };
  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-[minmax(0,.78fr)_minmax(0,1.22fr)] md:items-start lg:gap-5">
      <section className="min-w-0 overflow-hidden rounded-[clamp(1.4rem,4vw,2rem)] border border-[#eadbcf] bg-[radial-gradient(circle_at_25%_20%,#fffdfa_0,#fbf3ea_48%,#efe0d4_100%)] p-[clamp(1rem,3vw,1.6rem)] shadow-[0_18px_50px_rgba(75,43,27,.11)] md:col-span-2">
        <div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#9b735d]">Etapa 03 de 08</p><h2 className="mt-1 text-2xl font-black text-[#432a1e]">Finalização</h2></div><span className="text-[10px] font-bold text-[#85695a]">aftertaste</span></div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/70"><span className="block h-full w-[30%] rounded-full bg-gradient-to-r from-[#6d3d29] to-[#d18d62]" /></div>
        <p className="mt-5 text-sm font-semibold leading-6 text-[#6f5c51]">Por quanto tempo as sensações permanecem depois da xícara?</p>

        <div className="relative mt-4 min-h-[clamp(12rem,29vw,16rem)] w-full overflow-hidden rounded-[clamp(1.2rem,3vw,1.7rem)] border border-white/80 bg-[radial-gradient(ellipse_at_22%_25%,#fff_0,#fffaf5_48%,#f3e4d8_100%)] px-[clamp(1rem,4vw,3rem)] pb-5 pt-6" aria-label={`Rastro sensorial ${persistence ?? "não selecionado"}`}>
          <div className="pointer-events-none absolute inset-x-[7%] top-[32%] h-[42%] overflow-hidden">
            <span className="absolute inset-y-[30%] left-0 rounded-full bg-[linear-gradient(90deg,rgba(109,61,41,.7)_0%,rgba(190,111,76,.52)_42%,rgba(225,171,135,.18)_78%,transparent_100%)] blur-[5px] transition-[width,opacity,filter] duration-500 motion-reduce:transition-none" style={{ width: `${18 + persistenceIndex * 27}%`, opacity: .28 + trailIntensity * .1, filter: `blur(${Math.max(2, 7 - trailIntensity)}px)`, height: `${22 + trailIntensity * 8}%` }} />
            <span className="absolute left-[3%] top-[42%] h-[18%] rounded-full bg-[linear-gradient(90deg,rgba(255,219,188,.8),rgba(197,111,73,.2),transparent)] blur-md transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${15 + persistenceIndex * 25}%` }} />
            <span className="absolute left-[10%] top-[28%] h-[8%] rounded-full bg-[#8c4b3444] blur-sm transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${10 + persistenceIndex * 20}%` }} />
          </div>
          {selections.slice(0, 4).map((selection, index) => {
            const asset = photoFor(selection);
            return asset ? <span key={`${selection.family}-${selection.descriptor}`} className="absolute size-[clamp(2.25rem,7vw,3.75rem)] overflow-hidden rounded-full border-2 border-white/80 opacity-70 shadow-md transition motion-reduce:transition-none" style={{ left: `${34 + index * 14}%`, top: `${22 + (index % 2) * 38}%`, transform: `scale(${.88 + trailIntensity * .035})` }}><Image src={asset} alt={selection.descriptor ?? "Percepção residual"} fill sizes="(min-width: 768px) 60px, 40px" className="object-cover" /></span> : null;
          })}
          <div ref={trackRef} className="absolute inset-x-[9%] bottom-8 h-24 touch-none select-none" onPointerDown={(event) => { setDragging(true); event.currentTarget.setPointerCapture(event.pointerId); selectPersistenceAt(event.clientX); }} onPointerMove={(event) => { if (dragging) selectPersistenceAt(event.clientX); }} onPointerUp={(event) => { setDragging(false); event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={() => setDragging(false)}>
            <div className="absolute inset-x-0 top-7 h-1 rounded-full bg-[#d9c0ad] shadow-inner" />
            <div className="absolute left-0 top-7 h-1 rounded-full bg-gradient-to-r from-[#8d5037] to-[#c98260] transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${persistenceIndex * 33.333}%` }} />
            {aftertastePersistenceOptions.map((option, index) => <button key={option} type="button" role="radio" aria-checked={persistence === option} aria-label={`Persistência ${option}`} onClick={(event) => { event.stopPropagation(); haptic(); onPersistence(option); }} className="absolute top-0 min-h-16 w-[clamp(3.6rem,16vw,7rem)] -translate-x-1/2 touch-manipulation text-center" style={{ left: `${index * 33.333}%` }}><span className={`mx-auto mt-[1.08rem] block rounded-full border-[3px] border-[#fffaf5] transition-all duration-200 motion-reduce:transition-none ${persistence === option ? "size-5 bg-[#8b4c34] shadow-[0_4px_12px_rgba(91,49,31,.3)]" : "size-3.5 bg-[#c7aa96]"}`} /><span className={`mt-3 block text-[clamp(.58rem,2vw,.72rem)] font-black leading-3 ${persistence === option ? "text-[#673723]" : "text-[#806b60]"}`}>{option}</span></button>)}
            <div aria-hidden="true" className={`pointer-events-none absolute top-0 size-[clamp(3.4rem,8vw,4.8rem)] -translate-x-1/2 -translate-y-[36%] rounded-full border-[clamp(4px,.55vw,6px)] border-[#f5ece4] bg-[radial-gradient(circle_at_48%_42%,#3e1f15_0_43%,#74432d_44%_49%,#fffdf9_51%_69%,#ded0c5_71%_75%,transparent_77%)] shadow-[0_12px_24px_rgba(68,38,22,.22),inset_0_2px_3px_rgba(255,255,255,.8)] transition-[left,transform,box-shadow] duration-300 motion-reduce:transition-none ${dragging ? "scale-105 shadow-[0_17px_28px_rgba(68,38,22,.3)]" : ""}`} style={{ left: `${persistenceIndex * 33.333}%` }}><span className="absolute left-[24%] top-[20%] h-[15%] w-[25%] rotate-[-18deg] rounded-full bg-white/35 blur-[1px]" /></div>
          </div>
        </div>
      </section>

      <section className="min-w-0 rounded-[1.5rem] border border-[#ead9ca] bg-white/80 p-[clamp(.85rem,2vw,1.2rem)] shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#8b6a58]">Intensidade</p><h3 className="mt-1 text-lg font-black text-[#432a1e]">Quão presente ela permanece?</h3>
        <div className="relative mt-2 grid grid-cols-5 gap-0.5" role="radiogroup" aria-label="Intensidade da finalização"><span className="pointer-events-none absolute left-[10%] right-[10%] top-5 h-px bg-[#dcc8b8]" />{aftertasteIntensityOptions.map((label, index) => { const value = index + 1; const active = intensity === value; return <button key={label} type="button" role="radio" aria-checked={active} onClick={() => { haptic(); onIntensity(value); }} className="relative z-10 flex min-h-14 min-w-0 touch-manipulation flex-col items-center px-0.5 pt-2 text-[clamp(.5rem,2.2vw,.68rem)] font-black leading-3 text-[#67554b] active:scale-95"><span className={`mb-1.5 rounded-full border-[3px] border-[#fffaf5] transition active:scale-90 motion-reduce:transition-none ${active ? "size-6 bg-[#b55438] shadow-[0_0_0_4px_rgba(181,84,56,.15)]" : "size-4 bg-[#cdb8a8]"}`} />{label}</button>; })}</div>
      </section>

      {onScore && phase >= 3 && <section className="min-w-0 rounded-[1.8rem] border border-[#ead9ca] bg-white/80 p-[clamp(1rem,2.5vw,1.5rem)] shadow-sm"><CuppingScorePicker label="Qualidade da finalização" value={score} onChange={onScore} /></section>}

      <section className="min-w-0 rounded-[1.8rem] border border-[#ead9ca] bg-white/80 p-[clamp(1rem,2.5vw,1.5rem)] shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#8b6a58]">O que permaneceu?</p><p className="mt-1 text-sm text-[#706057]">Percepções de Sabor sugeridas, sem seleção automática.</p>
        {phase >= 2 && (flavorSelections.length ? <div className="mt-4 grid grid-cols-2 gap-2 min-[430px]:grid-cols-3 md:grid-cols-2 lg:grid-cols-3">{flavorSelections.map((selection) => { const selected = selections.some((item) => item.family === selection.family && item.subfamily === selection.subfamily && item.descriptor === selection.descriptor); const asset = photoFor(selection); return <button key={`${selection.family}-${selection.subfamily}-${selection.descriptor}`} type="button" aria-pressed={selected} onClick={() => { toggleSelection(selection); setPhase(3); }} className={`group flex min-h-[5.5rem] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl border p-2 text-center text-xs font-black transition active:scale-[.96] motion-reduce:transition-none ${selected ? "-translate-y-0.5 border-[#b55438] bg-[#fff0e9] text-[#773925] shadow-[0_8px_18px_rgba(126,65,40,.15)]" : "border-[#e8d8ca] bg-white text-[#655248] shadow-sm"}`}>{asset && <span className="relative size-11 shrink-0 overflow-hidden rounded-full border-2 border-white shadow-sm"><Image src={asset} alt="" fill sizes="44px" className="object-cover" />{selected && <span className="absolute right-0 top-0 grid size-4 place-items-center rounded-full bg-[#9d4f34] text-white"><Check size={10} /></span>}</span>}<span className="min-w-0 break-words">{selection.descriptor}</span></button>; })}</div> : <p className="mt-4 rounded-xl bg-[#f8f0e8] p-3 text-xs text-[#78685e]">Adicione percepções em Sabor para vê-las aqui.</p>)}
        <button type="button" onClick={onExplore} className="mt-3 inline-flex min-h-12 items-center gap-1 rounded-full border border-[#d9c1ae] px-4 text-xs font-black text-[#633d2a]"><Sparkles size={15} /> Outra percepção <ChevronRight size={15} /></button>
      </section>

      <section className="min-w-0 rounded-[1.8rem] border border-[#ead9ca] bg-white/80 p-[clamp(1rem,2.5vw,1.5rem)] shadow-sm"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#8b6a58]">Caráter da finalização</p><div className="mt-3 grid grid-cols-2 gap-2 min-[430px]:grid-cols-3 md:grid-cols-2 lg:grid-cols-3">{aftertasteCharacterOptions.map((character) => { const selected = characters.includes(character); const Icon = character === "Limpa" ? Droplets : character === "Floral" ? Flower2 : character === "Frutada" ? Leaf : Sparkles; return <button key={character} type="button" aria-pressed={selected} onClick={() => toggleCharacter(character)} className={`flex min-h-11 min-w-0 items-center gap-2 rounded-full border px-3 text-left text-[clamp(.66rem,2vw,.76rem)] font-black transition active:scale-[.96] motion-reduce:transition-none ${selected ? "-translate-y-0.5 border-[#7d4831] bg-[#7d4831] text-white shadow-[0_7px_15px_rgba(78,44,29,.18)]" : "border-[#e7d6c8] bg-[#fffaf5] text-[#665249] shadow-sm"}`}><Icon size={14} className="shrink-0 opacity-75" /><span className="min-w-0 flex-1 break-words">{character}</span>{selected && <Check size={14} className="shrink-0" />}</button>; })}</div></section>

      <section className="min-w-0 rounded-[1.5rem] border border-[#dfcbbb] bg-[#fff8f1] px-[clamp(1rem,2vw,1.25rem)] py-4"><div className="flex items-center justify-between gap-3"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#8b6a58]">Finalização</p><span className="size-2 rounded-full bg-[#b45d3e] shadow-[0_0_0_4px_rgba(180,93,62,.1)]" /></div><dl className="mt-2 grid min-w-0 grid-cols-[minmax(5.5rem,auto)_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs"><dt className="font-bold text-[#8a7568]">Persistência</dt><dd className="min-w-0 break-words font-black text-[#443027]">{persistence ?? "—"}</dd><dt className="font-bold text-[#8a7568]">Intensidade</dt><dd className="min-w-0 break-words font-black text-[#443027]">{intensity ? aftertasteIntensityOptions[intensity - 1] : "—"}</dd><dt className="font-bold text-[#8a7568]">Permanece</dt><dd className="min-w-0 break-words font-black text-[#443027]">{selections.map((item) => item.descriptor).filter(Boolean).join(" · ") || "—"}</dd><dt className="font-bold text-[#8a7568]">Caráter</dt><dd className="min-w-0 break-words font-black text-[#443027]">{characters.join(" · ") || "—"}</dd></dl></section>
    </div>
  );
}
