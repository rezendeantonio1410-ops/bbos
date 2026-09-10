"use client";

import type { SensoryFamily } from "@bbos/shared";
import { TraditionalQualityScore } from "@/components/traditional-quality-score";

type Props = {
  family: SensoryFamily;
  familyColor?: string;
  helperText?: string;
  heroAsset?: string;
  onSelect(subfamily: SensoryFamily["subfamilies"][number]): void;
  onBack(): void;
  qualityScore?: number;
  onQualityChange(value: number): void;
  onComplete?(): void;
};

const paths = [
  "M170 22 L302 122 Q264 145 238 176 L92 110 Q124 57 170 22Z",
  "M92 110 L238 176 Q224 201 219 228 L54 190 Q63 145 92 110Z",
  "M54 190 L219 228 Q218 258 224 284 L49 292 Q43 240 54 190Z",
  "M49 292 L224 284 Q235 312 254 337 L74 390 Q54 345 49 292Z",
  "M74 390 L254 337 Q274 361 302 382 L174 502 Q103 458 74 390Z",
];

const compositions: Record<string, string[]> = {
  "Frutas vermelhas": [
    "/sensory/aroma/frutado/frutas-vermelhas/morango.webp",
    "/sensory/aroma/frutado/frutas-vermelhas/framboesa.webp",
    "/sensory/descriptors/flavor/red-fruits/amora.webp",
  ],
  Cítricos: [
    "/sensory/aroma/frutado/citricos/tangerina.webp",
    "/sensory/aroma/frutado/citricos/limao.webp",
  ],
  "Frutas tropicais": [
    "/sensory/aroma/frutado/tropicais/abacaxi.png",
    "/sensory/aroma/frutado/tropicais/manga.png",
  ],
  "Outras frutas": [
    "/sensory/aroma/frutado/frutas-vermelhas/uva-vermelha.png",
  ],
  "Frutas secas": [
    "/sensory/aroma/frutado/frutas-secas/uva-passa.png",
    "/sensory/aroma/frutado/frutas-secas/figo-seco.png",
    "/sensory/aroma/frutado/frutas-secas/ameixa-seca.png",
  ],
};

const fallbackImages: Record<string, string> = {
  "Frutas vermelhas": "/sensory/aroma/frutado/frutas-vermelhas/morango.webp",
  Cítricos: "/sensory/aroma/frutado/citricos/tangerina.webp",
  "Frutas tropicais": "/sensory/aroma/frutado/tropicais/abacaxi.png",
  "Outras frutas": "/sensory/aroma/frutado/frutas-vermelhas/uva-vermelha.png",
  "Frutas secas": "/sensory/aroma/frutado/frutas-secas/uva-passa.png",
};

const colors = ["#c81418", "#f2dfbd", "#f0dfb9", "#b9cf9b", "#b89987"];
const labelPos: Array<readonly [number, number]> = [[178, 92], [126, 165], [128, 246], [145, 337], [190, 425]];

export function SensorySubfamilyArc({ family, familyColor, onSelect, onBack, qualityScore, onQualityChange, onComplete }: Props) {
  const accent = familyColor ?? family.color ?? "#c81418";
  const headerImage = fallbackImages[family.subfamilies[0]?.name ?? ""] ?? family.subfamilies[0]?.assetPath;
  return <div data-sensory-subfamily-arc className="mx-auto w-full max-w-[390px] overflow-x-hidden bg-[#fbfaf7] text-[#211b18]">
    <div className="px-4 pb-2 pt-3"><div className="flex items-center justify-between text-[10px]"><span className="text-xl">‹</span><strong>Amostra 03</strong><span>Sessão<br /><small>24/05/2024</small></span></div><p className="text-center text-[9px] text-slate-500">Arábica · Natural</p></div>
    <div className="flex items-center gap-3 px-5 py-4 text-white" style={{ background: accent }}><img src={headerImage} alt="" className="size-12 object-contain mix-blend-multiply" /><div><div className="text-xl font-black">{family.name.toUpperCase()}</div><div className="text-sm">Selecione uma subfamília</div></div></div>
    <div className="px-2 pt-2"><svg viewBox="0 0 390 520" className="block h-auto w-full" role="group" aria-label={`Subfamílias ${family.name}`}>{family.subfamilies.slice(0, 5).map((item, index) => { const [x, y] = labelPos[index] ?? [0, 0]; const assets = compositions[item.name] ?? [item.assetPath ?? fallbackImages[item.name]]; return <g key={item.name} role="button" tabIndex={0} aria-label={item.name} className="cursor-pointer touch-manipulation outline-none active:brightness-105" onClick={() => onSelect(item)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(item); } }}><path d={paths[index]} fill={item.color ?? colors[index]} stroke="#fffaf7" strokeWidth="3" />{assets.filter(Boolean).slice(0, 3).map((src, assetIndex) => <image key={`${item.name}-${assetIndex}`} href={src} x={x - 33 + (assetIndex % 2) * 18} y={y - 33 + Math.floor(assetIndex / 2) * 12} width={assetIndex === 0 ? 66 : 48} height={assetIndex === 0 ? 66 : 48} preserveAspectRatio="xMidYMid meet" style={{ mixBlendMode: "multiply" }} />)}</g>; })}</svg></div>
    <button type="button" onClick={onBack} className="mx-4 mt-2 min-h-12 w-[calc(100%-2rem)] rounded-2xl border border-slate-200 bg-white text-sm font-bold">← Voltar</button>
    <TraditionalQualityScore value={qualityScore} onChange={onQualityChange} onConclude={onComplete} label="Nota de qualidade de fragrância e aroma" attribute="Fragrância + Aroma" />
  </div>;
}
