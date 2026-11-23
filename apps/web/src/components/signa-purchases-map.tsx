"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import brazilMap from "@svg-maps/brazil";
import { MapPinned } from "lucide-react";
import type { SignaStatePurchase } from "@/lib/signa-region-map";

type Metric = "revenue" | "volumeKg";
type StateShape = { id: string; name: string; path: string };
type MapData = { viewBox: string; locations: StateShape[] };

const map = brazilMap as unknown as MapData;
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const kg = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

// Coffee-green scale: light leaf → deep roasted green.
const LOW = [207, 227, 214];
const HIGH = [24, 86, 54];
function shade(intensity: number) {
  const t = Math.max(0, Math.min(1, intensity));
  const mix = LOW.map((low, index) => Math.round(low + ((HIGH[index] ?? low) - low) * t));
  return `rgb(${mix.join(",")})`;
}
const formatMetric = (metric: Metric, value: number) =>
  metric === "revenue" ? brl.format(value) : `${kg.format(value)} kg`;

/**
 * Real-geography purchases map for the partner portal: choropleth by value
 * or volume, animated bubbles where there are purchases, hover/tap details
 * with top cities and a ranking. Respects prefers-reduced-motion.
 * State outlines: svg-maps by Victor Cazanave (CC BY 4.0).
 */
export function SignaPurchasesMap({ states }: { states: SignaStatePurchase[] }) {
  const [metric, setMetric] = useState<Metric>("revenue");
  const [active, setActive] = useState<string | null>(null);
  const [centers, setCenters] = useState<Record<string, { x: number; y: number }>>({});
  const pathRefs = useRef<Record<string, SVGPathElement | null>>({});

  const byUf = useMemo(() => new Map(states.map((state) => [state.uf, state])), [states]);
  const max = useMemo(() => Math.max(1e-9, ...states.map((state) => state[metric])), [states, metric]);
  const total = useMemo(() => states.reduce((sum, state) => sum + state[metric], 0), [states, metric]);
  const selected = (active && byUf.get(active)) || states[0] || null;
  const selectedName = map.locations.find((location) => location.id.toUpperCase() === selected?.uf)?.name;

  useEffect(() => {
    const next: Record<string, { x: number; y: number }> = {};
    for (const [uf, element] of Object.entries(pathRefs.current)) {
      if (!element) continue;
      const box = element.getBBox();
      next[uf] = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    }
    // Small manual nudges where the bounding-box center falls off the land.
    if (next.RJ) next.RJ = { x: next.RJ.x + 4, y: next.RJ.y - 2 };
    if (next.PE) next.PE = { x: next.PE.x + 18, y: next.PE.y };
    setCenters(next);
  }, []);

  return (
    <section aria-label="Mapa de compras por estado" className="overflow-hidden rounded-2xl border border-[#cfe0d8] bg-gradient-to-br from-[#f4faf6] via-white to-[#eef5f1] shadow-sm">
      <style>{`
        @keyframes signa-map-in { from { opacity: 0; transform: translateY(6px) scale(.985); } to { opacity: 1; transform: none; } }
        @keyframes signa-map-pulse { 0% { transform: scale(1); opacity: .55; } 70% { transform: scale(2.1); opacity: 0; } 100% { opacity: 0; } }
        .signa-state { transform-box: fill-box; transform-origin: center; transition: transform .25s ease, filter .25s ease, fill .4s ease; }
        .signa-state:hover, .signa-state:focus-visible, .signa-state[data-active="true"] { transform: translateY(-3px) scale(1.035); filter: drop-shadow(0 6px 8px rgba(14,25,29,.28)); outline: none; }
        .signa-bubble-pulse { transform-box: fill-box; transform-origin: center; }
        @media (prefers-reduced-motion: no-preference) {
          .signa-state { animation: signa-map-in .6s ease both; }
          .signa-bubble-pulse { animation: signa-map-pulse 2.4s ease-out infinite; }
        }
      `}</style>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#dbe8e1] px-4 py-4 sm:px-5">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.16em] text-[#25734c]"><MapPinned size={14} aria-hidden /> Mapa de compras</p>
          <h4 className="mt-1 text-lg font-semibold text-[#0E191D]">Onde estão os clientes da Signa</h4>
          <p className="text-xs text-slate-500">Por UF dos clientes finais informados · toque em um estado para ver os detalhes</p>
        </div>
        <div role="group" aria-label="Medida do mapa" className="flex rounded-full bg-[#e3eee8] p-1 text-xs font-semibold">
          {([["revenue", "Valor"], ["volumeKg", "Volume (kg)"]] as const).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={metric === value} onClick={() => setMetric(value)}
              className={`rounded-full px-3 py-1.5 transition ${metric === value ? "bg-[#0E191D] text-white shadow" : "text-[#0E191D]"}`}>{label}</button>
          ))}
        </div>
      </div>

      {states.length === 0 ? (
        <p className="p-6 text-sm text-slate-500">Ainda não há compras com cidade/UF do cliente final. Cadastre o CEP dos clientes finais para vê-los no mapa.</p>
      ) : (
        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,1fr)]">
          <div className="relative">
            <svg viewBox={map.viewBox} role="img" aria-label="Mapa do Brasil com compras por estado" className="h-auto w-full max-h-[560px]" data-testid="signa-purchases-map">
              <defs>
                <radialGradient id="signa-map-glow" cx="50%" cy="45%" r="60%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity=".9" />
                  <stop offset="100%" stopColor="#e7f1eb" stopOpacity="0" />
                </radialGradient>
                <filter id="signa-land-shadow" x="-10%" y="-10%" width="120%" height="120%">
                  <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#0E191D" floodOpacity=".12" />
                </filter>
              </defs>
              <rect x="0" y="0" width="100%" height="100%" fill="url(#signa-map-glow)" />
              <g filter="url(#signa-land-shadow)">
                {map.locations.map((location, index) => {
                  const uf = location.id.toUpperCase();
                  const data = byUf.get(uf);
                  const value = data?.[metric] ?? 0;
                  const label = data
                    ? `${location.name}: ${formatMetric(metric, value)}, ${data.orders} pedido(s), ${data.customers} cliente(s)`
                    : `${location.name}: sem compras`;
                  return (
                    <path
                      key={uf}
                      ref={(element) => { pathRefs.current[uf] = element; }}
                      d={location.path}
                      className="signa-state cursor-pointer"
                      data-active={selected?.uf === uf ? "true" : "false"}
                      style={{ animationDelay: `${index * 18}ms` }}
                      fill={data ? shade(0.25 + 0.75 * Math.sqrt(value / max)) : "#e6ece9"}
                      stroke="#ffffff"
                      strokeWidth={1.2}
                      tabIndex={data ? 0 : -1}
                      aria-label={label}
                      onMouseEnter={() => data && setActive(uf)}
                      onFocus={() => data && setActive(uf)}
                      onClick={() => data && setActive(uf)}
                    >
                      <title>{label}</title>
                    </path>
                  );
                })}
              </g>
              {states.map((state) => {
                const center = centers[state.uf];
                if (!center) return null;
                const radius = 5 + 14 * Math.sqrt(state[metric] / max);
                return (
                  <g key={state.uf} pointerEvents="none">
                    <circle className="signa-bubble-pulse" cx={center.x} cy={center.y} r={radius} fill="#f5c26b" />
                    <circle cx={center.x} cy={center.y} r={radius} fill="#f5c26b" fillOpacity=".85" stroke="#0E191D" strokeOpacity=".35" />
                    <text x={center.x} y={center.y + 3.5} textAnchor="middle" fontSize="10" fontWeight="700" fill="#0E191D">{state.uf}</text>
                  </g>
                );
              })}
            </svg>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-10 rounded-full" style={{ background: `linear-gradient(90deg, ${shade(0.25)}, ${shade(1)})` }} />menor → maior {metric === "revenue" ? "valor" : "volume"}</span>
              <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-[#f5c26b]" />compras no estado</span>
              <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-[#e6ece9]" />sem compras</span>
            </div>
          </div>

          <div className="space-y-4">
            {selected && (
              <div className="rounded-xl bg-[#0E191D] p-4 text-white shadow-lg" aria-live="polite">
                <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#9fd3b4]">{selected.uf}</p>
                <p className="text-xl font-semibold">{selectedName ?? selected.uf}</p>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-[11px] text-white/60">Valor</dt><dd className="font-semibold tabular-nums">{brl.format(selected.revenue)}</dd></div>
                  <div><dt className="text-[11px] text-white/60">Volume</dt><dd className="font-semibold tabular-nums">{kg.format(selected.volumeKg)} kg</dd></div>
                  <div><dt className="text-[11px] text-white/60">Pedidos</dt><dd className="font-semibold">{selected.orders}</dd></div>
                  <div><dt className="text-[11px] text-white/60">Clientes</dt><dd className="font-semibold">{selected.customers}</dd></div>
                </dl>
                {selected.cities.length > 0 && <ul className="mt-3 space-y-1.5 border-t border-white/10 pt-3 text-xs">
                  {selected.cities.map((city) => (
                    <li key={city.city} className="grid grid-cols-[1fr_auto] items-center gap-2">
                      <span className="truncate">{city.city}</span>
                      <span className="tabular-nums text-white/80">{brl.format(city.revenue)}</span>
                      <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-[#f5c26b]" style={{ width: `${Math.max(6, (city.revenue / Math.max(1, selected.revenue)) * 100)}%` }} /></span>
                    </li>
                  ))}
                </ul>}
              </div>
            )}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Ranking por {metric === "revenue" ? "valor" : "volume"}</p>
              <ol className="space-y-2">
                {[...states].sort((a, b) => b[metric] - a[metric]).slice(0, 6).map((state, index) => (
                  <li key={state.uf}>
                    <button type="button" onClick={() => setActive(state.uf)} className={`grid w-full grid-cols-[22px_34px_1fr_auto] items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-[#e3eee8] ${selected?.uf === state.uf ? "bg-[#e3eee8]" : ""}`}>
                      <span className="text-xs font-bold text-slate-400">{index + 1}</span>
                      <span className="font-semibold text-[#0E191D]">{state.uf}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-[#e6ece9]"><span className="block h-full rounded-full bg-[#25734c]" style={{ width: `${Math.max(4, (state[metric] / max) * 100)}%` }} /></span>
                      <span className="text-xs tabular-nums text-slate-600">{total ? Math.round((state[metric] / total) * 100) : 0}%</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}
      <p className="border-t border-[#dbe8e1] px-4 py-2 text-[10px] text-slate-400 sm:px-5">Valores de pedidos, não de notas fiscais ou pagamentos. Contornos dos estados: svg-maps (Victor Cazanave), licença CC BY 4.0.</p>
    </section>
  );
}
