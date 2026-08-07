"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, MapPinned } from "lucide-react";
import { Card } from "@bbos/ui";

type CountrySales = {
  id: string;
  name: string;
  sales: number;
  target: number;
  achievement: number;
  margin: number;
  growth: number;
  volume: number;
  orders: number;
  path: string;
};
const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

const countries: CountrySales[] = [
  {
    id: "BR",
    name: "Brasil",
    sales: 248600,
    target: 260000,
    achievement: 95.6,
    margin: 21.4,
    growth: 12.6,
    volume: 3280,
    orders: 92,
    path: "M315 245 L342 226 L377 232 L396 255 L385 294 L362 326 L342 309 L330 277 Z",
  },
  {
    id: "ES",
    name: "Espanha",
    sales: 52400,
    target: 50000,
    achievement: 104.8,
    margin: 24.7,
    growth: 18.4,
    volume: 610,
    orders: 19,
    path: "M435 151 L450 149 L454 158 L443 164 L433 160 Z",
  },
  {
    id: "FR",
    name: "França",
    sales: 28400,
    target: 32000,
    achievement: 88.8,
    margin: 22.1,
    growth: 7.2,
    volume: 325,
    orders: 11,
    path: "M449 132 L463 128 L471 139 L464 151 L451 149 L445 140 Z",
  },
  {
    id: "IT",
    name: "Itália",
    sales: 32600,
    target: 36000,
    achievement: 90.6,
    margin: 23.2,
    growth: 9.8,
    volume: 370,
    orders: 13,
    path: "M474 143 L482 145 L486 158 L495 167 L489 173 L479 162 L475 151 Z",
  },
  {
    id: "US",
    name: "Estados Unidos",
    sales: 74400,
    target: 90000,
    achievement: 82.7,
    margin: 20.1,
    growth: 7.4,
    volume: 890,
    orders: 27,
    path: "M105 142 L166 128 L211 141 L224 166 L201 185 L155 181 L121 169 Z",
  },
];

const statusColor = (achievement?: number) =>
  achievement === undefined
    ? "#e7e7e3"
    : achievement >= 100
      ? "#6f9a7a"
      : achievement >= 85
        ? "#d2a14a"
        : "#c96b62";

const baseShapes = [
  "M55 76 L112 48 L176 55 L216 83 L205 119 L169 129 L113 140 L76 125 L43 99 Z",
  "M203 79 L228 69 L246 83 L235 111 L211 121 Z",
  "M117 176 L150 181 L174 201 L162 219 L137 210 Z",
  "M261 206 L302 215 L327 239 L319 278 L337 317 L318 365 L292 337 L276 292 L258 254 Z",
  "M426 119 L461 102 L512 111 L529 133 L513 154 L478 153 L450 166 L422 149 Z",
  "M441 173 L488 164 L526 187 L536 233 L514 291 L476 309 L453 273 L432 222 Z",
  "M508 104 L583 74 L663 84 L728 111 L772 143 L747 179 L688 181 L635 160 L589 175 L539 153 Z",
  "M659 175 L716 174 L744 201 L716 224 L680 211 Z",
  "M711 278 L758 266 L795 284 L787 319 L748 329 L716 309 Z",
  "M810 300 L823 293 L834 304 L826 316 Z",
];

export function WorldSalesMap({ onOpen }: { onOpen: () => void }) {
  const [hovered, setHovered] = useState<CountrySales | null>(null);
  const [selected, setSelected] = useState<CountrySales | null>(null);
  const [pointer, setPointer] = useState({ x: 50, y: 40 });
  const total = countries.reduce((sum, item) => sum + item.sales, 0);
  const ranking = [...countries].sort((a, b) => b.sales - a.sales);
  const choose = (country: CountrySales) => {
    setSelected(country);
    setHovered(country);
  };
  return (
    <Card className="relative h-full min-h-[330px] overflow-hidden border-0 bg-forest-950 p-5 text-white shadow-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.14em] text-coffee-300">
            <MapPinned size={14} strokeWidth={1.7} />
            Vendas por Região
          </div>
          <p className="mt-1 text-xs text-white/50">
            Performance geográfica por país
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-white/10 p-0.5 text-[9px]">
            <button
              onClick={() => setSelected(null)}
              className={`rounded-md px-2.5 py-1.5 ${!selected ? "bg-white text-forest-950" : "text-white/60"}`}
            >
              Mundo
            </button>
            <button
              onClick={() => selected ?? choose(ranking[0]!)}
              className={`rounded-md px-2.5 py-1.5 ${selected ? "bg-white text-forest-950" : "text-white/60"}`}
            >
              País
            </button>
          </div>
          <Link
            href="/vendas?view=geografia"
            className="flex items-center gap-1 text-[9px] font-bold text-coffee-300"
          >
            Ver detalhes <ArrowRight size={10} />
          </Link>
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-[35%_65%]">
        <div className="order-2 space-y-1.5 md:order-1">
          {ranking.map((country, index) => (
            <button
              key={country.id}
              onClick={() => choose(country)}
              onMouseEnter={() => setHovered(country)}
              onMouseLeave={() => setHovered(null)}
              className={`w-full rounded-lg border p-2.5 text-left transition ${selected?.id === country.id ? "border-white/30 bg-white/10" : "border-white/[.07] bg-white/[.035] hover:bg-white/[.07]"}`}
            >
              <div className="flex items-center gap-2">
                <span className="w-4 text-[9px] font-bold text-white/30">
                  {index + 1}
                </span>
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: statusColor(country.achievement) }}
                />
                <p className="min-w-0 flex-1 truncate text-[10px] font-semibold">
                  {country.name}
                </p>
                <p className="text-[10px] font-bold">
                  {brl.format(country.sales)}
                </p>
              </div>
              <div className="mt-1 flex justify-between pl-8 text-[8px] text-white/40">
                <span>
                  {number.format((country.sales / total) * 100)}% participação
                </span>
                <span>{number.format(country.achievement)}% meta</span>
              </div>
            </button>
          ))}
        </div>
        <div className="relative order-1 min-h-56 overflow-hidden rounded-xl bg-white/[.025] md:order-2">
          <svg
            data-testid="world-sales-map"
            viewBox="0 0 880 410"
            preserveAspectRatio="xMidYMid meet"
            className="h-full min-h-56 w-full"
            role="img"
            aria-label="Mapa-múndi de vendas por país"
            onMouseMove={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setPointer({
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
              });
            }}
          >
            <g fill="#e7e7e3" stroke="#fafaf9" strokeWidth="1.2" opacity=".92">
              {baseShapes.map((path, index) => (
                <path key={index} d={path} />
              ))}
            </g>
            <g fill="none" stroke="#c8c7c2" strokeWidth=".65" opacity=".7">
              <path d="M150 181 L160 213 M292 216 L315 245 M477 166 L485 205 M584 105 L590 173 M689 181 L684 211" />
              <path d="M72 126 L105 142 M166 128 L169 91 M318 279 L384 294 M454 158 L476 163" />
            </g>
            {countries.map((country) => (
              <path
                key={country.id}
                d={country.path}
                fill={statusColor(country.achievement)}
                stroke="#fff"
                strokeWidth="1.4"
                className="cursor-pointer transition-opacity hover:opacity-80"
                role="button"
                tabIndex={0}
                aria-label={`${country.name}: ${number.format(country.achievement)}% da meta`}
                onMouseEnter={() => setHovered(country)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(country)}
                onBlur={() => setHovered(null)}
                onClick={() => choose(country)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") choose(country);
                }}
              />
            ))}
          </svg>
          {hovered && (
            <div
              role="tooltip"
              className="pointer-events-none absolute z-20 w-52 rounded-xl border border-white/10 bg-forest-950/95 p-3 text-[9px] shadow-2xl backdrop-blur"
              style={{
                left: Math.min(pointer.x + 12, 330),
                top: Math.max(pointer.y - 40, 8),
              }}
            >
              <div className="flex items-center justify-between">
                <strong className="text-xs">{hovered.name}</strong>
                <span
                  className="size-2 rounded-full"
                  style={{ background: statusColor(hovered.achievement) }}
                />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-white/55">
                <span>Vendas</span>
                <strong className="text-right text-white">
                  {brl.format(hovered.sales)}
                </strong>
                <span>Meta</span>
                <strong className="text-right text-white">
                  {brl.format(hovered.target)}
                </strong>
                <span>Atingimento</span>
                <strong className="text-right text-white">
                  {number.format(hovered.achievement)}%
                </strong>
                <span>Margem</span>
                <strong className="text-right text-white">
                  {number.format(hovered.margin)}%
                </strong>
                <span>Crescimento</span>
                <strong className="text-right text-white">
                  +{number.format(hovered.growth)}%
                </strong>
                <span>Volume / pedidos</span>
                <strong className="text-right text-white">
                  {number.format(hovered.volume)} kg • {hovered.orders}
                </strong>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
        <div className="flex flex-wrap gap-3 text-[8px] text-white/45">
          {[
            ["#6f9a7a", "Acima da meta"],
            ["#d2a14a", "Atenção"],
            ["#c96b62", "Abaixo da meta"],
            ["#e7e7e3", "Sem dados"],
          ].map(([color, label]) => (
            <span key={label} className="flex items-center gap-1.5">
              <i
                className="size-1.5 rounded-full"
                style={{ background: color }}
              />
              {label}
            </span>
          ))}
        </div>
        <button
          onClick={onOpen}
          className="text-[9px] font-bold text-coffee-300"
        >
          Mundo → País → Região → Estado → Cidade → Cliente
        </button>
      </div>
    </Card>
  );
}
