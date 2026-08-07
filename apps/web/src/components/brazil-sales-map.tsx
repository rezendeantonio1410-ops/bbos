"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, MapPinned } from "lucide-react";
import { Card } from "@bbos/ui";

export type BrazilSalesStatus =
  "on-track" | "attention" | "off-track" | "no-data";
export type BrazilStateSales = {
  stateCode: string;
  stateName: string;
  region: "Norte" | "Nordeste" | "Centro-Oeste" | "Sudeste" | "Sul";
  sales: number;
  revenue: number;
  volumeKg: number;
  target: number;
  achievement: number;
  marginPercent: number;
  growthPercent: number;
  customers: number;
  status: BrazilSalesStatus;
  path: string;
};
export type BrazilSalesMapProps = {
  onStateHover?: (state: BrazilStateSales | null) => void;
  onStateClick?: (state: BrazilStateSales) => void;
  onRegionClick?: (region: BrazilStateSales["region"]) => void;
};

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const color = (status: BrazilSalesStatus) =>
  status === "on-track"
    ? "#6f9a7a"
    : status === "attention"
      ? "#d6a24b"
      : status === "off-track"
        ? "#c96b62"
        : "#e5e7e6";
const statusFrom = (
  achievement: number,
  hasData: boolean,
): BrazilSalesStatus =>
  !hasData
    ? "no-data"
    : achievement >= 100
      ? "on-track"
      : achievement >= 85
        ? "attention"
        : "off-track";

const stateGeometry: Array<
  Omit<
    BrazilStateSales,
    | "sales"
    | "revenue"
    | "volumeKg"
    | "target"
    | "achievement"
    | "marginPercent"
    | "growthPercent"
    | "customers"
    | "status"
  >
> = [
  {
    stateCode: "AC",
    stateName: "Acre",
    region: "Norte",
    path: "M42 226 L92 220 L104 252 L58 267 L35 249 Z",
  },
  {
    stateCode: "AM",
    stateName: "Amazonas",
    region: "Norte",
    path: "M82 126 L187 104 L224 145 L205 219 L105 234 L82 207 Z",
  },
  {
    stateCode: "RR",
    stateName: "Roraima",
    region: "Norte",
    path: "M153 48 L201 61 L214 112 L181 128 L144 96 Z",
  },
  {
    stateCode: "AP",
    stateName: "Amapá",
    region: "Norte",
    path: "M300 74 L329 88 L326 139 L299 146 L286 112 Z",
  },
  {
    stateCode: "PA",
    stateName: "Pará",
    region: "Norte",
    path: "M211 116 L294 101 L314 148 L287 205 L227 218 L204 180 Z",
  },
  {
    stateCode: "RO",
    stateName: "Rondônia",
    region: "Norte",
    path: "M104 231 L170 218 L183 266 L130 286 L96 264 Z",
  },
  {
    stateCode: "TO",
    stateName: "Tocantins",
    region: "Norte",
    path: "M244 211 L281 210 L293 278 L262 303 L236 272 Z",
  },
  {
    stateCode: "MA",
    stateName: "Maranhão",
    region: "Nordeste",
    path: "M303 150 L347 147 L363 194 L332 226 L293 208 Z",
  },
  {
    stateCode: "PI",
    stateName: "Piauí",
    region: "Nordeste",
    path: "M339 196 L375 180 L390 238 L354 263 L328 228 Z",
  },
  {
    stateCode: "CE",
    stateName: "Ceará",
    region: "Nordeste",
    path: "M377 171 L421 170 L427 203 L392 220 Z",
  },
  {
    stateCode: "RN",
    stateName: "Rio Grande do Norte",
    region: "Nordeste",
    path: "M423 184 L465 189 L462 210 L428 207 Z",
  },
  {
    stateCode: "PB",
    stateName: "Paraíba",
    region: "Nordeste",
    path: "M407 211 L462 211 L459 231 L405 231 Z",
  },
  {
    stateCode: "PE",
    stateName: "Pernambuco",
    region: "Nordeste",
    path: "M379 231 L456 233 L450 253 L390 257 Z",
  },
  {
    stateCode: "AL",
    stateName: "Alagoas",
    region: "Nordeste",
    path: "M414 257 L449 255 L445 275 L417 272 Z",
  },
  {
    stateCode: "SE",
    stateName: "Sergipe",
    region: "Nordeste",
    path: "M410 274 L443 277 L435 295 L410 291 Z",
  },
  {
    stateCode: "BA",
    stateName: "Bahia",
    region: "Nordeste",
    path: "M333 254 L408 248 L414 313 L374 350 L326 321 Z",
  },
  {
    stateCode: "MT",
    stateName: "Mato Grosso",
    region: "Centro-Oeste",
    path: "M173 263 L242 247 L262 304 L234 348 L168 332 Z",
  },
  {
    stateCode: "MS",
    stateName: "Mato Grosso do Sul",
    region: "Centro-Oeste",
    path: "M178 334 L232 349 L228 407 L183 414 L160 373 Z",
  },
  {
    stateCode: "GO",
    stateName: "Goiás",
    region: "Centro-Oeste",
    path: "M251 301 L315 293 L331 345 L285 374 L236 348 Z",
  },
  {
    stateCode: "DF",
    stateName: "Distrito Federal",
    region: "Centro-Oeste",
    path: "M289 326 L302 326 L302 338 L289 338 Z",
  },
  {
    stateCode: "MG",
    stateName: "Minas Gerais",
    region: "Sudeste",
    path: "M304 337 L371 320 L403 359 L370 393 L318 386 L283 370 Z",
  },
  {
    stateCode: "ES",
    stateName: "Espírito Santo",
    region: "Sudeste",
    path: "M403 338 L428 342 L423 382 L397 379 Z",
  },
  {
    stateCode: "RJ",
    stateName: "Rio de Janeiro",
    region: "Sudeste",
    path: "M371 391 L419 384 L424 405 L381 411 Z",
  },
  {
    stateCode: "SP",
    stateName: "São Paulo",
    region: "Sudeste",
    path: "M246 376 L319 384 L374 397 L347 430 L278 426 L235 405 Z",
  },
  {
    stateCode: "PR",
    stateName: "Paraná",
    region: "Sul",
    path: "M240 413 L300 429 L343 432 L324 461 L260 458 L226 438 Z",
  },
  {
    stateCode: "SC",
    stateName: "Santa Catarina",
    region: "Sul",
    path: "M260 461 L324 464 L334 480 L280 486 L250 476 Z",
  },
  {
    stateCode: "RS",
    stateName: "Rio Grande do Sul",
    region: "Sul",
    path: "M249 482 L301 489 L321 524 L282 552 L238 521 Z",
  },
];

const stateData: Record<
  string,
  {
    sales: number;
    target: number;
    margin: number;
    growth: number;
    volumeKg: number;
    customers: number;
  }
> = {
  SP: {
    sales: 98760,
    target: 105000,
    margin: 20.8,
    growth: 11.2,
    volumeKg: 1310,
    customers: 142,
  },
  MG: {
    sales: 84200,
    target: 80000,
    margin: 22.1,
    growth: 14.2,
    volumeKg: 1120,
    customers: 118,
  },
  RJ: {
    sales: 48600,
    target: 52000,
    margin: 19.7,
    growth: 8.1,
    volumeKg: 640,
    customers: 71,
  },
  ES: {
    sales: 25740,
    target: 23000,
    margin: 23.4,
    growth: 16.5,
    volumeKg: 310,
    customers: 39,
  },
  PR: {
    sales: 36800,
    target: 45000,
    margin: 18.2,
    growth: -2.1,
    volumeKg: 492,
    customers: 54,
  },
  SC: {
    sales: 23200,
    target: 28000,
    margin: 15.7,
    growth: -1.4,
    volumeKg: 320,
    customers: 37,
  },
  RS: {
    sales: 14400,
    target: 17000,
    margin: 17.1,
    growth: 3.2,
    volumeKg: 198,
    customers: 26,
  },
  GO: {
    sales: 28620,
    target: 34000,
    margin: 19.1,
    growth: 18.5,
    volumeKg: 390,
    customers: 42,
  },
  DF: {
    sales: 18000,
    target: 16000,
    margin: 24.2,
    growth: 20.1,
    volumeKg: 220,
    customers: 31,
  },
  MT: {
    sales: 8000,
    target: 10000,
    margin: 16.8,
    growth: -4.2,
    volumeKg: 112,
    customers: 18,
  },
  BA: {
    sales: 18400,
    target: 22000,
    margin: 18.7,
    growth: 6.1,
    volumeKg: 246,
    customers: 28,
  },
  PE: {
    sales: 9200,
    target: 9000,
    margin: 21.2,
    growth: 13.4,
    volumeKg: 118,
    customers: 17,
  },
  CE: {
    sales: 7600,
    target: 8000,
    margin: 20.4,
    growth: 9.2,
    volumeKg: 94,
    customers: 14,
  },
  PA: {
    sales: 5600,
    target: 7000,
    margin: 17.9,
    growth: 4.1,
    volumeKg: 72,
    customers: 11,
  },
  AM: {
    sales: 4400,
    target: 4000,
    margin: 22.8,
    growth: 15.6,
    volumeKg: 54,
    customers: 9,
  },
};

const states: BrazilStateSales[] = stateGeometry.map((state) => {
  const data = stateData[state.stateCode];
  const achievement = data ? (data.sales / data.target) * 100 : 0;
  return {
    ...state,
    sales: data?.sales ?? 0,
    revenue: data?.sales ?? 0,
    volumeKg: data?.volumeKg ?? 0,
    target: data?.target ?? 0,
    achievement,
    marginPercent: data?.margin ?? 0,
    growthPercent: data?.growth ?? 0,
    customers: data?.customers ?? 0,
    status: statusFrom(achievement, Boolean(data)),
  };
});

export function BrazilSalesPanel({
  onStateHover,
  onStateClick,
  onRegionClick,
}: BrazilSalesMapProps) {
  const [mode, setMode] = useState<"brasil" | "states">("brasil");
  const [hovered, setHovered] = useState<BrazilStateSales | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<
    BrazilStateSales["region"] | null
  >(null);
  const [pointer, setPointer] = useState({ x: 180, y: 90 });
  const regions = useMemo(
    () =>
      (["Sudeste", "Sul", "Centro-Oeste", "Nordeste", "Norte"] as const).map(
        (region) => {
          const items = states.filter((state) => state.region === region);
          const sales = items.reduce((sum, state) => sum + state.sales, 0);
          const target = items.reduce((sum, state) => sum + state.target, 0);
          const achievement = target ? (sales / target) * 100 : 0;
          const marginPercent = sales
            ? items.reduce(
                (sum, state) => sum + state.marginPercent * state.sales,
                0,
              ) / sales
            : 0;
          return {
            region,
            sales,
            target,
            achievement,
            marginPercent,
            share:
              (sales / states.reduce((sum, state) => sum + state.sales, 0)) *
              100,
            status: statusFrom(achievement, sales > 0),
          };
        },
      ),
    [],
  );
  const selectRegion = (region: BrazilStateSales["region"]) => {
    setSelectedRegion(region);
    onRegionClick?.(region);
  };
  const hover = (state: BrazilStateSales | null) => {
    setHovered(state);
    onStateHover?.(state);
  };
  return (
    <Card className="h-full min-h-[340px] border-0 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-forest-700">
            <MapPinned size={14} />
            Vendas por Região — Brasil
          </div>
          <p className="mt-1 text-xs text-stone-500">
            Performance comercial nacional
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-stone-100 p-0.5 text-[9px]">
            <button
              onClick={() => {
                setMode("brasil");
                setSelectedRegion(null);
              }}
              className={`rounded-md px-2.5 py-1.5 ${mode === "brasil" ? "bg-white font-bold shadow-sm" : "text-stone-500"}`}
            >
              Brasil
            </button>
            <button
              onClick={() => setMode("states")}
              className={`rounded-md px-2.5 py-1.5 ${mode === "states" ? "bg-white font-bold shadow-sm" : "text-stone-500"}`}
            >
              Estados
            </button>
          </div>
          <Link
            href="/vendas?view=geografia"
            className="flex items-center gap-1 text-[9px] font-bold text-forest-700"
          >
            Ver detalhes <ArrowRight size={10} />
          </Link>
        </div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[40%_60%]">
        <div className="order-2 overflow-hidden rounded-xl border lg:order-1">
          <div className="grid grid-cols-[1fr_72px_44px_64px_46px_48px] bg-stone-50 px-3 py-2 text-[8px] font-bold uppercase text-stone-400">
            <span>Região</span>
            <span>Vendas</span>
            <span>% Part.</span>
            <span>Meta</span>
            <span>Ating.</span>
            <span>Margem</span>
          </div>
          {regions.map((item) => (
            <button
              key={item.region}
              onMouseEnter={() => setSelectedRegion(item.region)}
              onMouseLeave={() => setSelectedRegion(null)}
              onClick={() => selectRegion(item.region)}
              className={`grid w-full grid-cols-[1fr_72px_44px_64px_46px_48px] items-center border-t px-3 py-2.5 text-left text-[9px] transition ${selectedRegion === item.region ? "bg-forest-50" : "hover:bg-stone-50"}`}
            >
              <span className="flex items-center gap-2 font-semibold">
                <i
                  className="size-1.5 rounded-full"
                  style={{ background: color(item.status) }}
                />
                {item.region}
              </span>
              <strong>{brl.format(item.sales)}</strong>
              <span>{number.format(item.share)}%</span>
              <span>{brl.format(item.target)}</span>
              <strong>{number.format(item.achievement)}%</strong>
              <span>{number.format(item.marginPercent)}%</span>
            </button>
          ))}
        </div>
        <div className="relative order-1 min-h-72 overflow-hidden rounded-xl bg-[#f8faf9] lg:order-2">
          <svg
            data-testid="brazil-sales-map"
            viewBox="0 20 500 550"
            preserveAspectRatio="xMidYMid meet"
            className="h-full min-h-72 w-full"
            role="img"
            aria-label="Mapa do Brasil por estado"
            onMouseMove={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setPointer({
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
              });
            }}
          >
            <g stroke="#fff" strokeWidth="2" strokeLinejoin="round">
              {states.map((state) => (
                <path
                  key={state.stateCode}
                  data-state-code={state.stateCode}
                  d={state.path}
                  fill={
                    selectedRegion && state.region !== selectedRegion
                      ? "#eceeed"
                      : color(state.status)
                  }
                  className={`${state.sales ? "cursor-pointer" : "cursor-default"} transition-opacity hover:opacity-80`}
                  role={state.sales ? "button" : undefined}
                  tabIndex={state.sales ? 0 : undefined}
                  aria-label={`${state.stateName}: ${state.sales ? `${number.format(state.achievement)}% da meta` : "sem dados"}`}
                  onMouseEnter={() => hover(state)}
                  onMouseLeave={() => hover(null)}
                  onFocus={() => hover(state)}
                  onBlur={() => hover(null)}
                  onClick={() => {
                    if (state.sales) onStateClick?.(state);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && state.sales)
                      onStateClick?.(state);
                  }}
                />
              ))}
            </g>
            {mode === "states" && (
              <g
                fill="#283033"
                fontSize="9"
                fontWeight="700"
                textAnchor="middle"
                pointerEvents="none"
              >
                <text x="300" y="414">
                  SP
                </text>
                <text x="349" y="365">
                  MG
                </text>
                <text x="398" y="399">
                  RJ
                </text>
                <text x="394" y="359">
                  ES
                </text>
                <text x="280" y="447">
                  PR
                </text>
                <text x="290" y="477">
                  SC
                </text>
                <text x="278" y="520">
                  RS
                </text>
                <text x="275" y="338">
                  GO
                </text>
                <text x="295" y="335">
                  DF
                </text>
                <text x="201" y="300">
                  MT
                </text>
                <text x="197" y="381">
                  MS
                </text>
                <text x="366" y="292">
                  BA
                </text>
                <text x="414" y="248">
                  PE
                </text>
                <text x="400" y="194">
                  CE
                </text>
                <text x="270" y="169">
                  PA
                </text>
                <text x="153" y="173">
                  AM
                </text>
              </g>
            )}
          </svg>
          {hovered && (
            <div
              role="tooltip"
              className="pointer-events-none absolute z-20 w-48 rounded-xl border bg-white/95 p-3 text-[9px] shadow-xl backdrop-blur"
              style={{
                left: Math.min(pointer.x + 10, 270),
                top: Math.max(pointer.y - 35, 8),
              }}
            >
              <div className="flex items-center justify-between">
                <strong className="text-xs">{hovered.stateName}</strong>
                <span
                  className="size-2 rounded-full"
                  style={{ background: color(hovered.status) }}
                />
              </div>
              {hovered.sales ? (
                <div className="mt-2 grid grid-cols-2 gap-y-1 text-stone-500">
                  <span>Vendas</span>
                  <strong className="text-right text-stone-900">
                    {brl.format(hovered.sales)}
                  </strong>
                  <span>Meta</span>
                  <strong className="text-right text-stone-900">
                    {brl.format(hovered.target)}
                  </strong>
                  <span>Atingimento</span>
                  <strong className="text-right text-stone-900">
                    {number.format(hovered.achievement)}%
                  </strong>
                  <span>Margem</span>
                  <strong className="text-right text-stone-900">
                    {number.format(hovered.marginPercent)}%
                  </strong>
                  <span>Clientes</span>
                  <strong className="text-right text-stone-900">
                    {hovered.customers}
                  </strong>
                </div>
              ) : (
                <p className="mt-2 text-stone-500">Sem vendas no período.</p>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 border-t pt-3 text-[8px] text-stone-500">
        {[
          ["#6f9a7a", "Acima da meta"],
          ["#d6a24b", "Atenção"],
          ["#c96b62", "Abaixo da meta"],
          ["#e5e7e6", "Sem dados"],
        ].map(([tone, label]) => (
          <span key={label} className="flex items-center gap-1.5">
            <i className="size-1.5 rounded-full" style={{ background: tone }} />
            {label}
          </span>
        ))}
      </div>
    </Card>
  );
}
