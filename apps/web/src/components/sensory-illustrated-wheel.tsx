"use client";

import * as React from "react";
import { ChevronLeft, Coffee } from "lucide-react";

export type CircularSensoryItem = {
  name: string;
  imageKey: string;
  color: string;
  assetPath?: string;
  sensoryHint?: string;
};

const fruitColors: Record<string, string> = {
  laranja: "#f47a24", lima: "#79a942", limao: "#e1c82e", tangerina: "#ef7b21",
  grapefruit: "#e87775", abacaxi: "#d8a62d", kiwi: "#6d963d", maracuja: "#8b5128",
  mamao: "#ef8b45", banana: "#e2bd2d", manga: "#e9a522", morango: "#d94853",
  cereja: "#b9273c", framboesa: "#c83f64", amora: "#63355f", uva: "#755294",
};

function Pictogram({ item }: { item: CircularSensoryItem }) {
  if (item.assetPath)
    return <svg viewBox="0 0 54 54" aria-hidden="true"><image href={item.assetPath} width="54" height="54" preserveAspectRatio="xMidYMid meet" /></svg>;
  const key = item.imageKey.toLowerCase();
  const name = item.name.toLowerCase();
  const color = fruitColors[name] ?? item.color;
  if (/flor|jasmim|rosa|violeta|lavanda|camomila|madressilva/.test(`${key} ${name}`)) {
    return <svg viewBox="0 0 48 48" aria-hidden="true"><g fill="none" stroke={color} strokeWidth="2"><path d="M24 23c-12-2-13-13-5-14 2-8 12-6 11 2 8-3 12 7 5 12 6 6-2 14-9 8-5 8-15 1-9-6-8-4-3-12 7-10Z"/><circle cx="24" cy="22" r="4" fill={color}/><path d="M24 30v12m0-6c-6-5-10-2-10-2m10 4c5-5 9-2 9-2"/></g></svg>;
  }
  if (/abacaxi/.test(name)) return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="m24 12-7-8 7 5 7-5-5 9" fill="#6c9a45"/><path d="M13 20c2-9 20-9 22 0l-3 21H16Z" fill="#ddb137" stroke="#9d7420" strokeWidth="1.5"/><path d="m15 23 18 13m0-13L15 36m0-7h18" stroke="#fff2a8"/></svg>;
  if (/kiwi/.test(name)) return <svg viewBox="0 0 48 48" aria-hidden="true"><ellipse cx="24" cy="25" rx="17" ry="13" fill="#7e4f2e"/><ellipse cx="24" cy="25" rx="14" ry="10" fill="#8ebd45"/><ellipse cx="24" cy="25" rx="4" ry="3" fill="#f7e5af"/><g fill="#25251d">{Array.from({length:10},(_,i)=><circle key={i} cx={24+Math.cos(i*.628)*8} cy={25+Math.sin(i*.628)*6} r=".8"/>)}</g></svg>;
  if (/maracuja/.test(name)) return <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="16" fill="#6b3423"/><circle cx="24" cy="24" r="12" fill="#f0b625"/><g fill="#3e241b">{Array.from({length:14},(_,i)=><circle key={i} cx={24+Math.cos(i*2.4)*8} cy={24+Math.sin(i*2.4)*8} r="1.2"/>)}</g></svg>;
  if (/banana/.test(name)) return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M9 13c5 21 21 28 33 13-14 6-23 1-28-15Z" fill="#e5bd2c" stroke="#9a7b13" strokeWidth="1.5"/></svg>;
  if (/manga|mamao|pessego|damasco|melao/.test(name)) return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M27 8c13 5 13 27-2 33C9 40 8 20 21 10Z" fill={color}/><path d="M25 10c2-5 7-6 10-5" stroke="#55763b" strokeWidth="2" fill="none"/></svg>;
  if (/laranja|lima|limao|tangerina|grapefruit|citric/.test(`${key} ${name}`)) return <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="25" r="16" fill={color}/><circle cx="24" cy="25" r="12" fill="#fff5c9"/><g stroke={color} strokeWidth="1.5">{Array.from({length:8},(_,i)=><path key={i} d={`M24 25 L${24+Math.cos(i*Math.PI/4)*11} ${25+Math.sin(i*Math.PI/4)*11}`}/>)}</g><path d="M25 9c3-5 8-4 10-3" stroke="#5a8c43" strokeWidth="2" fill="none"/></svg>;
  if (/frut|morango|cereja|amora|uva|pera|maca|mirtilo/.test(`${key} ${name}`)) return <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="19" cy="25" r="10" fill={color}/><circle cx="30" cy="27" r="9" fill={color} opacity=".85"/><path d="M23 16c0-6 5-8 9-8" stroke="#56854b" strokeWidth="2" fill="none"/><path d="M29 8c5-2 8 0 9 3-5 2-8 0-9-3" fill="#6a9e51"/></svg>;
  if (/cacau|chocolate|noz|castanha|avel|amendo/.test(`${key} ${name}`)) return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 6c15 5 17 28 0 37C7 34 9 11 24 6Z" fill="#8a5438"/><path d="M24 9v30M15 15c6 4 12 4 18 0M13 25c7 4 15 4 22 0" stroke="#d9aa78" strokeWidth="1.5" fill="none"/></svg>;
  if (/veget|herb|folha|cha|verde/.test(`${key} ${name}`)) return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M39 8C18 9 8 19 11 39c18 2 29-10 28-31Z" fill="#78a85d"/><path d="M14 36c8-9 14-14 23-24M23 27l-1-10m7 3h8" stroke="#e8f1dc" strokeWidth="1.5" fill="none"/></svg>;
  if (/espec|canela|cravo|cardamomo|pimenta|gengibre|anis/.test(`${key} ${name}`)) return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="m24 6 3 13 12-7-8 11 13 3-13 2 7 12-11-8-3 13-2-13-12 7 8-11-13-3 13-2-7-12 11 8Z" fill="#bb6b32"/><circle cx="24" cy="25" r="5" fill="#f0c37e"/></svg>;
  if (/doce|mel|acucar|caramel|baunilha|confeitaria|malte/.test(`${key} ${name}`)) return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5c8 11 13 17 13 25a13 13 0 1 1-26 0c0-8 5-14 13-25Z" fill="#d79632"/><path d="M17 30c3 5 10 7 15 1" stroke="#fff1bd" strokeWidth="2" fill="none"/></svg>;
  if (/defeito|ferment|mofo|quim|terroso|papel|queim|borracha|animal/.test(`${key} ${name}`)) return <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="16" fill="#7a817f"/><path d="M17 17l14 14m0-14L17 31" stroke="white" strokeWidth="3"/></svg>;
  return <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="15" fill={color} opacity=".22"/><path d="M14 29c5-13 15-17 22-10-2 12-12 18-22 10Z" fill={color}/></svg>;
}

function polar(radius: number, angle: number) {
  const radians = (angle - 90) * Math.PI / 180;
  return [200 + radius * Math.cos(radians), 200 + radius * Math.sin(radians)] as const;
}
function wedge(inner: number, outer: number, start: number, end: number) {
  const [a,b]=polar(outer,start), [c,d]=polar(outer,end), [e,f]=polar(inner,end), [g,h]=polar(inner,start);
  return `M${a} ${b}A${outer} ${outer} 0 ${end-start>180?1:0} 1 ${c} ${d}L${e} ${f}A${inner} ${inner} 0 ${end-start>180?1:0} 0 ${g} ${h}Z`;
}

export function CircularSensoryNavigator({ items, level, title, breadcrumb, selected, onItem, onBack, immersive = false }: {
  items: CircularSensoryItem[]; level: "family"|"subfamily"|"descriptor"; title: string; breadcrumb: string[];
  selected: string[]; onItem(item: CircularSensoryItem): void; onBack?(): void; immersive?: boolean;
}) {
  const count = items.length;
  return <section className="w-full" aria-label={`${title}: navegação sensorial circular`}>
    {onBack && <button type="button" onClick={onBack} className="mb-2 inline-flex min-h-11 items-center gap-1 px-1 text-sm font-bold text-slate-800"><ChevronLeft size={19}/> {breadcrumb.at(-1) ?? "Voltar"}</button>}
    <p className="mb-3 min-h-5 text-xs font-semibold text-slate-500">{breadcrumb.length ? breadcrumb.join(" › ") : "Roda de famílias sensoriais"}</p>
    {immersive && level === "descriptor" ? (
      <div className="relative mx-auto aspect-square w-full max-w-[410px] rounded-full bg-[radial-gradient(circle,#fffaf4_0_21%,rgba(255,250,244,.6)_22%,rgba(255,255,255,.15)_62%,transparent_63%)]" role="group">
        {items.map((item, index) => {
          const active = selected.includes(item.name);
          const angle = index * 360 / count;
          return <button type="button" key={item.name} aria-pressed={active} aria-label={item.name} onClick={() => onItem(item)} className={`absolute left-1/2 top-1/2 flex size-[31%] min-h-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-2 bg-white/92 p-2 text-center shadow-[0_9px_24px_rgba(80,45,25,.12)] transition active:scale-95 ${active ? "ring-4 ring-orange-200" : ""}`} style={{ transform: `translate(-50%,-50%) rotate(${angle}deg) translateY(-128%) rotate(${-angle}deg)`, borderColor: active ? "#f45b19" : `${item.color}99` }}>
            <span className="relative block size-[62%] min-h-16 w-full"><Pictogram item={item}/></span>
            <span className="mt-1 block max-w-full text-[10px] font-black leading-[11px] text-slate-800">{item.name}</span>
            {active && <span className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-orange-500 text-sm font-black text-white" aria-hidden="true">✓</span>}
          </button>;
        })}
        <div className="pointer-events-none absolute left-1/2 top-1/2 grid size-[28%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-amber-100 bg-[#fffaf4] text-center shadow-inner"><span><Coffee size={28} className="mx-auto text-[#512b1a]"/><b className="mt-1 block px-2 text-[10px] leading-3">{title}</b><small className="mt-1 block text-[8px] uppercase text-slate-500">{selected.length} selecionado{selected.length === 1 ? "" : "s"}</small></span></div>
      </div>
    ) : <div className="relative mx-auto aspect-square w-full max-w-[380px]">
      <svg viewBox="0 0 400 400" className="absolute inset-0 size-full overflow-visible" role="group">
        {items.map((item,index)=>{const start=index*360/count+.7,end=(index+1)*360/count-.7,mid=(start+end)/2,[x,y]=polar(132,mid);const active=selected.includes(item.name);return <g key={item.name} role="button" tabIndex={0} aria-label={item.name} aria-pressed={level==="descriptor"?active:undefined} className="cursor-pointer outline-none" onClick={()=>onItem(item)} onKeyDown={(event)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();onItem(item)}}}>
          <path d={wedge(72,184,start,end)} fill={active?item.color:`${item.color}d9`} stroke={active?"#5b2b13":"#fffaf4"} strokeWidth={active?3:2}/>
          <foreignObject x={x-(immersive && level === "subfamily" ? 36 : 27)} y={y-(immersive && level === "subfamily" ? 51 : 43)} width={immersive && level === "subfamily" ? 72 : 54} height={immersive && level === "subfamily" ? 72 : 54} className="pointer-events-none"><Pictogram item={item}/></foreignObject>
          <foreignObject x={x-47} y={y+12} width="94" height={item.sensoryHint && count <= 5 ? 38 : 28} className="pointer-events-none overflow-visible"><div className="flex h-full items-start justify-center px-1 text-center text-[9px] font-bold leading-[10px] text-[#3b2d27]"><span>{item.name}{item.sensoryHint && count <= 5 ? <small className="mt-0.5 block text-[6.5px] font-medium leading-[8px] opacity-70">{item.sensoryHint}</small> : null}</span></div></foreignObject>
          {active&&<g><circle cx={x+21} cy={y-26} r="10" fill="#f45b19"/><path d={`M${x+16} ${y-26}l4 4 7-8`} fill="none" stroke="white" strokeWidth="2"/></g>}
        </g>})}
        <circle cx="200" cy="200" r="69" fill="#fffaf4" stroke="#eadfd4" strokeWidth="2"/>
      </svg>
      <div className="pointer-events-none absolute left-1/2 top-1/2 flex size-[31%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center text-center">
        <Coffee size={30} strokeWidth={1.7} className="text-[#512b1a]"/>
        <b className="mt-1 max-w-[92px] text-[10px] leading-3 text-slate-800">{title}</b>
        <small className="mt-1 text-[8px] uppercase tracking-wide text-slate-500">{level === "descriptor" ? "seleção múltipla" : "toque para explorar"}</small>
      </div>
    </div>}
  </section>;
}

export function SensoryWheelHint({ mode }: { mode: "CUPPING" | "TRAINING" }) {
  return <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-bold text-stone-600">{mode === "TRAINING" ? "TREINAMENTO SENSORIAL" : "CUPPING OFICIAL"}</span>;
}
