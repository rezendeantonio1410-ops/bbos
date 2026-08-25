"use client";

import * as React from "react";

type TraditionalQualityScoreProps = {
  value?: number;
  onChange(value: number): void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
  attribute: string;
  onConclude?(): void;
};

const round = (value: number, step: number) => Math.round(value / step) * step;

export function TraditionalQualityScore({ value, onChange, min = 6, max = 10, step = 0.25, label, attribute, onConclude }: TraditionalQualityScoreProps) {
  const adjust = (direction: number) => {
    const next = value === undefined ? min : round(value + direction * step, step);
    onChange(Math.min(max, Math.max(min, Number(next.toFixed(2)))));
  };
  const display = value === undefined ? "—" : value.toFixed(2).replace(".", ",");
  return <section className="mx-3 mb-3 rounded-3xl border border-[#eaded1] bg-[#fffdfa] p-4" aria-label={label}>
    <p className="text-[10px] font-black uppercase tracking-[.14em] text-[#855542]">NOTA DE QUALIDADE</p>
    <h3 className="mt-1 text-sm font-black text-[#2f211b]">{attribute}</h3>
    <p className="mt-1 text-[11px] text-slate-500">Considere o conjunto de fragrância e aroma, sua qualidade, limpeza, intensidade e complexidade.</p>
    <div className="mt-4 flex items-center justify-center gap-5">
      <button type="button" onClick={() => adjust(-1)} disabled={value !== undefined && value <= min} aria-label="Reduzir nota" className="grid size-11 place-items-center rounded-full border border-[#e4cfc0] text-xl font-semibold text-[#684333] disabled:opacity-35">−</button>
      <div className="min-w-24 text-center"><div className="text-4xl font-black tracking-tight text-[#3b2419]">{display}</div><p className="mt-1 text-[10px] font-semibold text-slate-500">{value === undefined ? "Avaliar" : value >= 9 ? "Excepcional" : value >= 8 ? "Excelente" : value >= 7 ? "Muito bom" : "Bom"}</p></div>
      <button type="button" onClick={() => adjust(1)} disabled={value !== undefined && value >= max} aria-label="Aumentar nota" className="grid size-11 place-items-center rounded-full border border-[#e4cfc0] text-xl font-semibold text-[#684333] disabled:opacity-35">+</button>
    </div>
    <div className="mt-4 grid grid-cols-4 gap-1.5" aria-label="Atalhos de qualidade">{[[6, "Bom"], [7, "Muito bom"], [8, "Excelente"], [9, "Excepcional"]].map(([score, description]) => <button key={score} type="button" onClick={() => onChange(score as number)} className={`rounded-xl border px-1 py-2 text-center text-[10px] ${value === score ? "border-[#b93a2f] bg-[#fff0ec] text-[#9f2c25]" : "border-[#eee2d8] bg-white text-slate-600"}`}><strong className="block text-xs">{score}</strong>{description}</button>)}</div>
    {onConclude && <button type="button" disabled={value === undefined} onClick={onConclude} className="mt-3 min-h-12 w-full rounded-2xl bg-[#512b1a] text-sm font-black text-white disabled:opacity-40">Concluir {attribute}</button>}
  </section>;
}
