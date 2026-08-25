"use client";

import * as React from "react";
import type { SensoryFamily } from "@bbos/shared";
import { TraditionalQualityScore } from "@/components/traditional-quality-score";
import { SensorySubfamilyArc } from "@/components/fruited-subfamily-reference-view";

export type ReferenceSelection = {
  context: "FRAGRANCE" | "AROMA" | "FLAVOR";
  family: string;
  subfamily?: string;
  descriptor?: string;
  level: number;
  intensity: number;
  imageKey?: string;
  assetPath?: string;
};

type Props = {
  context: ReferenceSelection["context"];
  families: SensoryFamily[];
  value: ReferenceSelection[];
  onChange(value: ReferenceSelection[]): void;
  mode: "professional" | "educational";
  onDepthChange?(depth: number): void;
  onComplete?(): void;
};

const colors: Record<string, string> = { Frutado: "#c92825", Floral: "#c95a84", Vegetal: "#719d4d", Doce: "#e8a128", Especiarias: "#c46b27", "Cacau / Nozes": "#704326", "Defeitos aromáticos": "#5574a5", Fermentado: "#4f948d" };
const iconFor = (name: string) => /flor|jasmim|hibisco/i.test(name) ? "✿" : /cítric|laranja|lima|limão|tangerina/i.test(name) ? "🍊" : /frut|morango|cereja|amora|framboesa|mirtilo/i.test(name) ? "🍓" : /doce|caramel/i.test(name) ? "🍬" : "✦";
const familyImage: Record<string, string> = {
  Frutado: "/sensory/aroma/frutado/frutas-vermelhas/morango.webp",
  Floral: "/sensory/aroma/floral/flores-brancas/jasmim.webp",
  Doce: "/sensory/aroma/doce/acucares-caramelizados/caramelo.webp",
  "Cacau / Nozes": "/sensory/aroma/tostado/cacau-chocolate/cacau.png",
  Especiarias: "/sensory/aroma/descriptors/especiarias/canela.png",
  Vegetal: "/sensory/aroma/descriptors/vegetal/ervas-frescas.png",
  Fermentado: "/sensory/aroma/descriptors/fermentado/vinho-tinto.webp",
  Outros: "/sensory/aroma/desvios/terroso.png",
};

const compositionImages: Record<string, string[]> = {
  Frutado: [
    "/sensory/aroma/frutado/frutas-vermelhas/morango.webp",
  ],
};

const subfamilyImages: Record<string, string> = {
  "Frutas vermelhas": "/sensory/aroma/frutado/frutas-vermelhas/morango.webp",
  Cítricos: "/sensory/aroma/frutado/citricos/tangerina.webp",
  "Frutas tropicais": "/sensory/aroma/frutado/tropicais/abacaxi.png",
  "Outras frutas": "/sensory/aroma/frutado/frutas-vermelhas/uva-vermelha.png",
  "Frutas secas": "/sensory/aroma/frutado/frutas-secas/uva-passa.png",
};

function subfamilyImage(name: string, fallback: { name: string; imageKey?: string }) {
  return subfamilyImages[name] ?? imageFor(fallback);
}

function imageFor(item: { name: string; imageKey?: string; assetPath?: string }) {
  return item.assetPath ?? `/sensory/aroma/${item.imageKey ?? item.name.toLowerCase().replaceAll(" ", "-")}.webp`;
}

function familyPath(index: number, count: number) {
  const start = index * 360 / count + .8; const end = (index + 1) * 360 / count - .8; const point = (r: number, angle: number) => { const a = (angle - 90) * Math.PI / 180; return [200 + r * Math.cos(a), 200 + r * Math.sin(a)] as const; };
  const [a,b] = point(182,start), [c,d] = point(182,end), [e,f] = point(72,end), [g,h] = point(72,start);
  return { d: `M${a} ${b}A182 182 0 0 1 ${c} ${d}L${e} ${f}A72 72 0 0 0 ${g} ${h}Z`, center: point(126, (start + end) / 2) };
}

function subfamilyPath(index: number, count: number) {
  const center = [235, 214] as const; const inner = 90; const outer = 205; const start = 112 + index * 136 / count + 1.2; const end = 112 + (index + 1) * 136 / count - 1.2;
  const point = (r: number, angle: number) => { const a = angle * Math.PI / 180; return [center[0] + r * Math.cos(a), center[1] + r * Math.sin(a)] as const; };
  const [a,b] = point(outer,start), [c,d] = point(outer,end), [e,f] = point(inner,end), [g,h] = point(inner,start);
  return { d: `M${a} ${b}A${outer} ${outer} 0 0 1 ${c} ${d}L${e} ${f}A${inner} ${inner} 0 0 0 ${g} ${h}Z`, label: point((inner + outer) / 2, (start + end) / 2) };
}

export function SensoryReferenceFlow({ context, families, value, onChange, mode, onDepthChange, onComplete }: Props) {
  const [family, setFamily] = React.useState<SensoryFamily | null>(null);
  const [subfamily, setSubfamily] = React.useState<SensoryFamily["subfamilies"][number] | null>(null);
  const [pending, setPending] = React.useState<ReferenceSelection | null>(null);
  const [qualityScore, setQualityScore] = React.useState<number | undefined>(undefined);
  const [cupOpen, setCupOpen] = React.useState(false);
  const selections = value.filter((item) => item.context === context);
  const chosen = selections.map((item) => item.descriptor).filter(Boolean) as string[];
  const accent = family?.color ?? colors[family?.name ?? ""] ?? "#c92825";
  React.useEffect(() => { onDepthChange?.(subfamily ? 2 : family ? 1 : 0); }, [family, onDepthChange, subfamily]);
  const selectDescriptor = (item: SensoryFamily["subfamilies"][number]["descriptors"][number]) => {
    const existing = selections.find((selection) => selection.family === family?.name && selection.subfamily === subfamily?.name && selection.descriptor === item.name);
    const selection: ReferenceSelection = existing ?? { context, family: family?.name ?? "", subfamily: subfamily?.name, descriptor: item.name, level: 3, intensity: 3, imageKey: item.imageKey, assetPath: item.assetPath };
    if (!existing) onChange([...value, selection]);
    setPending(selection);
  };
  const updateIntensity = (intensity: number) => {
    if (!pending?.descriptor) return;
    const next = { ...pending, intensity };
    onChange(value.map((item) => item.context === context && item.family === next.family && item.subfamily === next.subfamily && item.descriptor === next.descriptor ? next : item));
    setPending(next);
  };
  const removeSelection = (target: ReferenceSelection | string | undefined) => onChange(value.filter((item) => typeof target === "string" ? !(item.context === context && item.descriptor === target) : !(item.context === context && item.family === target?.family && item.subfamily === target?.subfamily && item.descriptor === target?.descriptor)));
  const title = context === "FLAVOR" ? "Sabor" : context === "FRAGRANCE" ? "Fragrância" : "Aroma";
  const descriptors = subfamily?.descriptors ?? [];
  const composition = compositionImages[family?.name ?? ""] ?? [];
  const depth = subfamily ? "level-3" : family ? "level-2" : "level-1";
  if (family && !subfamily) return <SensorySubfamilyArc family={family} familyColor={accent} helperText={family.name === "Frutado" ? "Notas que lembram frutas vermelhas como morango, cereja, framboesa, amora, entre outras." : undefined} onSelect={setSubfamily} onBack={() => setFamily(null)} qualityScore={qualityScore} onQualityChange={setQualityScore} onComplete={onComplete} />;
  return <div className="mx-auto min-h-[690px] w-full max-w-[390px] overflow-x-hidden overflow-y-visible bg-[#fbfaf7] text-[#211b18]" data-reference-sensory-flow data-mode={mode} data-level={depth}>
    <div className="px-4 pb-2 pt-3"><div className="flex items-center justify-between text-[10px]"><span>‹</span><strong>Amostra 03</strong><span>Sessão<br /><small>24/05/2024</small></span></div><p className="text-center text-[9px] text-slate-500">Arábica · Natural</p></div>
    {!family && <div className="px-3 pb-3 pt-4 text-center"><div className="text-3xl">♨</div><h2 className="mt-1 text-2xl font-black">{title}</h2><p className="mt-3 text-sm font-semibold">O que esse café te lembra?</p><p className="mt-1 text-xs text-slate-500">Escolha uma família para começar.</p><div className="mx-auto mt-5 aspect-square w-full max-w-[340px]"><svg viewBox="0 0 400 400" className="size-full">{families.map((item, index) => { const sector = familyPath(index, families.length); return <g key={item.name} onPointerUp={(event) => { event.stopPropagation(); setFamily(item); }} onClick={() => setFamily(item)} className="cursor-pointer" role="button" tabIndex={0}><path d={sector.d} fill={item.color ?? colors[item.name] ?? "#c92825"} stroke="#fffaf7" strokeWidth="2" /><image href={familyImage[item.name]} x={sector.center[0] - 29} y={sector.center[1] - 33} width="58" height="50" preserveAspectRatio="xMidYMid meet" style={{ mixBlendMode: "multiply" }} /><text x={sector.center[0]} y={sector.center[1] + 27} textAnchor="middle" fill="white" fontSize="9" fontWeight="700">{item.name}</text></g>; })}<circle cx="200" cy="200" r="72" fill="#45291d" /><text x="200" y="207" textAnchor="middle" fill="white" fontSize="34">♨</text></svg></div><div className="mx-3 mt-3 rounded-2xl bg-[#f2ede5] p-3 text-xs">☝ Toque em uma família da roda para explorar os aromas.</div><div className="mx-3 mt-3 rounded-2xl border border-[#eaded1] bg-[#f5ede2] p-3 text-left"><strong className="text-xs">Sua xícara ({title.toLowerCase()})</strong><p className="mt-1 text-[11px] text-slate-500">{selections.length ? `${selections.length} aromas adicionados` : "0 aromas adicionados"}</p></div></div>}
    {family && !subfamily && <><div className="px-4 py-3" style={{ background: accent, color: "white" }}><div className="text-lg">{iconFor(family.name)} <strong>{family.name.toUpperCase()}</strong></div><div className="text-xs">Selecione uma subfamília</div></div><div className="relative px-1 py-3"><svg viewBox="0 0 520 430" className="block w-full" style={{ touchAction: "manipulation" }}><g>{family.subfamilies.map((item, index) => { const segment = subfamilyPath(index, family.subfamilies.length); const select = (event: React.SyntheticEvent) => { event.stopPropagation(); setSubfamily(item); }; const [x, y] = segment.label; return <g key={item.name} onPointerUp={select} onClick={select} className="cursor-pointer" role="button" tabIndex={0}><path d={segment.d} fill={item.color ?? accent} fillOpacity={.72} stroke="white" strokeWidth="2" /><image href={subfamilyImage(item.name, item)} x={x - 17} y={y - 28} width="34" height="34" preserveAspectRatio="xMidYMid meet" style={{ mixBlendMode: "multiply" }} /><text x={x} y={y + 17} textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="700">{item.name}</text></g>; })}</g></svg>{composition.length > 0 && <div className="pointer-events-none absolute right-[7%] top-[23%] h-[45%] w-[43%]">{composition.map((src, index) => <img key={src} src={src} alt="" className={`absolute object-contain mix-blend-multiply drop-shadow-[0_14px_12px_rgba(65,35,20,.22)] ${index === 0 ? "left-[24%] top-[2%] z-30 size-24" : index === 1 ? "left-[5%] top-[30%] z-10 size-20" : index === 2 ? "left-[43%] top-[33%] z-20 size-20" : "left-[28%] top-[52%] z-40 size-18"}`} />)}</div>}<p className="mx-auto mt-[-1.1rem] max-w-[185px] text-center text-[11px] leading-4 text-slate-700">{family.name === "Frutado" ? "Notas que lembram frutas vermelhas como morango, cereja, framboesa, amora, entre outras." : `Explore notas da família ${family.name.toLowerCase()}.`}</p></div><div className="px-3 pb-3"><button type="button" onClick={() => setFamily(null)} className="min-h-12 w-full rounded-xl border border-slate-200 bg-white text-xs font-bold">← Voltar</button></div></>}
    {family && subfamily && <><div className="px-4 py-3 text-white" style={{ background: accent }}><div className="text-xs font-bold">{family.name} › {subfamily.name} › Descritores</div></div><h2 className="px-4 pt-4 text-center text-base font-black">Isso se parece com...</h2><div className="grid grid-cols-3 gap-y-3 px-3 py-3">{descriptors.slice(0, 9).map((item) => { const active = chosen.includes(item.name); return <button key={item.name} type="button" onClick={() => selectDescriptor(item)} className={`flex flex-col items-center gap-1 text-center ${active ? "text-red-700" : "text-slate-900"}`}><span className={`relative grid size-20 place-items-center rounded-full border-2 bg-transparent ${active ? "border-red-600" : "border-slate-200"}`}><img src={imageFor(item)} alt="" className="size-16 object-contain mix-blend-multiply drop-shadow-[0_8px_8px_rgba(50,30,20,.18)]" />{active && <span className="absolute right-0 top-0 grid size-5 place-items-center rounded-full bg-red-600 text-[10px] font-black text-white">✓</span>}</span><span className="text-[11px] font-semibold">{item.name}</span></button>; })}</div>{pending && <section className="mx-3 rounded-2xl border border-slate-200 bg-white p-3"><div className="flex items-center gap-2"><img src={imageFor({ name: pending.descriptor ?? "descritor", imageKey: pending.imageKey, assetPath: pending.assetPath })} alt="" className="size-10 object-contain mix-blend-multiply" /><div><strong>{pending.descriptor}</strong><p className="text-[10px] text-slate-500">Aroma que lembra {pending.descriptor?.toLowerCase()} fresco.</p></div></div><p className="mt-3 text-xs font-bold">Quanto você percebe?</p><div className="mt-2 grid grid-cols-5 gap-1">{[1,2,3,4,5].map((intensity) => <button key={intensity} type="button" onClick={() => updateIntensity(intensity)} className={`min-h-9 rounded-full border text-xs ${pending.intensity === intensity ? "border-red-600 bg-red-600 text-white" : "border-slate-200"}`}>{intensity}</button>)}</div></section>}<div className="grid grid-cols-2 gap-2 px-3 py-3"><button type="button" onClick={() => setSubfamily(null)} className="min-h-11 rounded-xl border border-slate-200 bg-white text-xs font-bold">← Voltar</button><button type="button" onClick={() => { setFamily(null); setSubfamily(null); setPending(null); }} className="min-h-11 rounded-xl border border-slate-200 bg-white text-xs font-bold">↻ Explorar outra família</button></div></>}
    {selections.length > 0 && <><div className={`fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[390px] px-2 pb-2 ${cupOpen ? "" : "pointer-events-none"}`}><div className={`pointer-events-auto rounded-3xl border border-[#eaded1] bg-[#fffdfa]/95 p-3 shadow-[0_-12px_30px_rgba(68,38,24,.16)] backdrop-blur ${cupOpen ? "" : "hidden"}`}><div className="flex items-center justify-between"><strong className="text-xs">Sua xícara · {selections.length}</strong><button type="button" onClick={() => setCupOpen(false)} className="min-h-10 rounded-full px-3 text-xs font-bold">Fechar</button></div><div className="mt-2 max-h-[42vh] space-y-1 overflow-y-auto">{selections.map((item) => <div key={`${item.family}-${item.subfamily}-${item.descriptor}`} className="flex items-center justify-between rounded-xl bg-[#f5ede2] px-2 py-1.5 text-[10px]"><button type="button" onClick={() => setPending(item)} className="flex-1 text-left">{item.descriptor} <small className="text-slate-500">{item.intensity}/5</small></button><button type="button" onClick={() => removeSelection(item.descriptor)} aria-label={`Remover ${item.descriptor}`} className="rounded-full px-2 text-slate-500">×</button></div>)}</div></div></div><button type="button" onClick={() => setCupOpen(true)} className="fixed bottom-2 left-1/2 z-30 min-h-12 w-[min(94vw,374px)] -translate-x-1/2 rounded-2xl border border-[#eaded1] bg-[#f5ede2] px-4 text-left text-xs font-black text-[#4b3023] shadow-[0_8px_20px_rgba(68,38,24,.16)]">☕ Sua xícara · {selections.length}</button><div className="h-14" /><TraditionalQualityScore value={qualityScore} onChange={setQualityScore} onConclude={onComplete} label="Nota de qualidade de fragrância e aroma" attribute="Fragrância + Aroma" /></>}
  </div>;
}
