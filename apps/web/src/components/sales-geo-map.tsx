"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import brazilMap from "@svg-maps/brazil";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { SalesSummaryData } from "@bbos/shared";

/**
 * Interactive sales map: Brazil by state (svg-maps, CC BY 4.0), then the real
 * municipality outlines of the chosen state (IBGE mesh served by the BBOS API).
 * Hover/tap shows a card; click zooms in; everything is also in a table.
 */
export type SalesMetric = "revenue" | "volumeKg" | "orders" | "customers";

type Shapes = { state: string; width: number; height: number; municipalities: Array<{ code: string; name: string; path: string; cx: number; cy: number }> };
type Totals = { revenue: number; orders: number; customers: number; volumeKg: number };

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const integer = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const kilos = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
export const metricLabel: Record<SalesMetric, string> = { revenue: "Valor", volumeKg: "Volume (kg)", orders: "Pedidos", customers: "Clientes" };
export const formatMetric = (metric: SalesMetric, value: number) =>
  metric === "revenue" ? money.format(value) : metric === "volumeKg" ? `${kilos.format(value)} kg` : integer.format(value);

const SCALE = ["#CFE4D8", "#9CC8B1", "#5E9C82", "#2F6B57", "#173F32"];
const EMPTY = "#EEF2EE";
export const cityKey = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();

function colorFor(value: number, max: number) {
  if (!(value > 0) || !(max > 0)) return EMPTY;
  const t = Math.sqrt(value / max);
  return SCALE[Math.min(SCALE.length - 1, Math.floor(t * SCALE.length))]!;
}

type Hover = { title: string; totals: Totals | null; x: number; y: number; hint: string; href?: string; hrefLabel?: string };

export function SalesGeoMap({ summary, metric, compact = false }: { summary: SalesSummaryData; metric: SalesMetric; compact?: boolean }) {
  const [state, setState] = useState<string | null>(null);
  const [shapes, setShapes] = useState<Shapes | null>(null);
  const [shapesError, setShapesError] = useState("");
  const [hover, setHover] = useState<Hover | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const byState = useMemo(() => new Map(summary.byState.map((item) => [item.state, item])), [summary.byState]);
  const citiesOfState = useMemo(
    () => new Map(summary.byCity.filter((item) => item.state === state).map((item) => [cityKey(item.city), item])),
    [summary.byCity, state],
  );
  const stateMax = Math.max(0, ...summary.byState.map((item) => item[metric]));
  const cityMax = Math.max(0, ...[...citiesOfState.values()].map((item) => item[metric]));

  useEffect(() => {
    if (!state) {
      setShapes(null);
      return;
    }
    const controller = new AbortController();
    setShapes(null);
    setShapesError("");
    void fetch(`/api/dashboard/geo/states/${state}`, { credentials: "include", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return (await response.json()) as Shapes;
      })
      .then((data) => !controller.signal.aborted && setShapes(data))
      .catch(() => !controller.signal.aborted && setShapesError("O mapa dos municípios do IBGE não respondeu agora. A tabela abaixo continua com os números."));
    return () => controller.abort();
  }, [state]);

  const place = (event: { clientX: number; clientY: number }, info: Omit<Hover, "x" | "y">) => {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    setHover({ ...info, x: Math.min(event.clientX - box.left + 14, box.width - 260), y: Math.max(8, event.clientY - box.top - 20) });
  };

  const openState = (code: string) => {
    setState(code);
    setSelectedCity(null);
    setHover(null);
  };

  const stateName = state ? (byState.get(state)?.name ?? state) : null;
  const tableRows = state
    ? [...citiesOfState.values()].map((item) => ({ key: item.city, label: item.city, totals: item as Totals }))
    : summary.byState.map((item) => ({ key: item.state, label: item.name, totals: item as Totals }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--bbos-text-secondary)]">
        <button type="button" onClick={() => openState("")} className={state ? "underline underline-offset-2 hover:text-[var(--bbos-text-primary)]" : "font-semibold text-[var(--bbos-text-primary)]"} disabled={!state}>
          Brasil
        </button>
        {state && (
          <>
            <span aria-hidden>›</span>
            <span className="font-semibold text-[var(--bbos-text-primary)]">{stateName}</span>
            <button type="button" onClick={() => setState(null)} className="ml-2 inline-flex items-center gap-1 font-semibold text-[var(--bbos-coffee-green)]">
              <ArrowLeft size={14} /> voltar ao Brasil
            </button>
          </>
        )}
      </div>

      <div ref={boxRef} className="relative overflow-hidden rounded-xl border bg-white" onMouseLeave={() => setHover(null)}>
        {!state ? (
          <svg viewBox={brazilMap.viewBox} role="img" aria-label={`Mapa do Brasil por ${metricLabel[metric].toLowerCase()}`} className={`mx-auto block h-auto w-full p-3 ${compact ? "max-h-[340px] max-w-[360px]" : "max-w-[560px]"}`}>
            {(brazilMap.locations as Array<{ id: string; name: string; path: string }>).map((location) => {
              const code = location.id.toUpperCase();
              const totals = byState.get(code);
              const value = totals?.[metric] ?? 0;
              const interactive = Boolean(totals);
              return (
                <path
                  key={location.id}
                  d={location.path}
                  fill={colorFor(value, stateMax)}
                  stroke="#ffffff"
                  strokeWidth={1.2}
                  className={interactive ? "cursor-pointer outline-none transition hover:brightness-110 focus-visible:stroke-[#0E191D]" : undefined}
                  tabIndex={interactive ? 0 : -1}
                  role={interactive ? "button" : undefined}
                  aria-label={interactive ? `${location.name}: ${formatMetric(metric, value)}. Abrir municípios.` : undefined}
                  onMouseMove={(event) =>
                    place(event, {
                      title: location.name,
                      totals: totals ?? null,
                      hint: interactive ? "Clique para ver os municípios" : "Sem vendas no período",
                    })
                  }
                  onClick={() => interactive && openState(code)}
                  onKeyDown={(event) => interactive && (event.key === "Enter" || event.key === " ") && openState(code)}
                />
              );
            })}
          </svg>
        ) : shapes ? (
          <svg viewBox={`0 0 ${shapes.width} ${shapes.height}`} role="img" aria-label={`Municípios de ${stateName}`} className={`mx-auto block h-auto w-full p-2 ${compact ? "max-h-[340px]" : ""}`}>
            {shapes.municipalities.map((municipality) => {
              const totals = citiesOfState.get(cityKey(municipality.name));
              const value = totals?.[metric] ?? 0;
              const selected = selectedCity === cityKey(municipality.name);
              return (
                <path
                  key={municipality.code}
                  d={municipality.path}
                  fill={colorFor(value, cityMax)}
                  stroke={selected ? "#0E191D" : "#ffffff"}
                  strokeWidth={selected ? 2 : 0.5}
                  className={totals ? "cursor-pointer outline-none hover:brightness-110 focus-visible:stroke-[#0E191D]" : undefined}
                  tabIndex={totals ? 0 : -1}
                  role={totals ? "button" : undefined}
                  aria-label={totals ? `${municipality.name}: ${formatMetric(metric, value)}` : undefined}
                  onMouseMove={(event) =>
                    place(event, {
                      title: municipality.name,
                      totals: totals ?? null,
                      hint: totals ? "Clique para fixar" : "Sem vendas no período",
                      href: totals ? `/clientes?busca=${encodeURIComponent(municipality.name)}` : undefined,
                      hrefLabel: `Ver clientes de ${municipality.name}`,
                    })
                  }
                  onClick={() => totals && setSelectedCity(cityKey(municipality.name))}
                  onKeyDown={(event) => totals && (event.key === "Enter" || event.key === " ") && setSelectedCity(cityKey(municipality.name))}
                />
              );
            })}
            {[...citiesOfState.values()]
              .slice(0, 6)
              .map((item) => {
                const shape = shapes.municipalities.find((m) => cityKey(m.name) === cityKey(item.city));
                return shape ? (
                  <text key={shape.code} x={shape.cx} y={shape.cy} textAnchor="middle" fontSize={12} fontWeight={600} fill="#1C2421" stroke="#ffffff" strokeWidth={3} paintOrder="stroke" pointerEvents="none">
                    {shape.name}
                  </text>
                ) : null;
              })}
          </svg>
        ) : (
          <div className="grid min-h-[280px] place-items-center p-6 text-center text-sm text-[var(--bbos-text-secondary)]">
            {shapesError || (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" /> Carregando os municípios de {stateName}…
              </span>
            )}
          </div>
        )}

        {hover && (
          <div role="status" className="pointer-events-none absolute z-10 w-[240px] rounded-xl border bg-white p-3 text-xs shadow-lg" style={{ left: Math.max(8, hover.x), top: hover.y }}>
            <p className="text-sm font-semibold">{hover.title}</p>
            {hover.totals ? (
              <dl className="mt-1.5 space-y-1">
                {(["revenue", "orders", "customers", "volumeKg"] as SalesMetric[]).map((key) => (
                  <div key={key} className="flex justify-between gap-3">
                    <dt className="text-[var(--bbos-text-secondary)]">{metricLabel[key]}</dt>
                    <dd className={`tabular-nums ${key === metric ? "font-semibold" : ""}`}>{formatMetric(key, hover.totals![key])}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            <p className="mt-2 text-[11px] text-[var(--bbos-text-secondary)]">{hover.hint}</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--bbos-text-secondary)]" aria-hidden>
          <span>sem venda</span>
          <i className="inline-block h-2.5 w-6 rounded-sm border" style={{ background: EMPTY }} />
          {SCALE.map((color) => (
            <i key={color} className="inline-block h-2.5 w-6 rounded-sm" style={{ background: color }} />
          ))}
          <span>mais {metricLabel[metric].toLowerCase()}</span>
        </div>
        {state && selectedCity && citiesOfState.get(selectedCity) && (
          <Link href={`/clientes?busca=${encodeURIComponent(citiesOfState.get(selectedCity)!.city)}`} className="rounded-lg bg-[var(--bbos-action-primary)] px-3 py-2 text-xs font-semibold text-white">
            Ver clientes de {citiesOfState.get(selectedCity)!.city} →
          </Link>
        )}
      </div>

      <details className="rounded-xl border bg-white">
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold">Ver em tabela ({tableRows.length})</summary>
        <table className="w-full text-left text-xs">
          <thead className="bg-[var(--bbos-surface-subtle)] text-[var(--bbos-text-secondary)]">
            <tr>
              <th className="px-3 py-2 font-medium">{state ? "Município" : "Estado"}</th>
              <th className="px-3 py-2 text-right font-medium">Valor</th>
              <th className="px-3 py-2 text-right font-medium">Pedidos</th>
              <th className="px-3 py-2 text-right font-medium">Clientes</th>
              <th className="px-3 py-2 text-right font-medium">kg</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eef1ed]">
            {tableRows.map((row) => (
              <tr key={row.key}>
                <td className="px-3 py-1.5">
                  {!state ? (
                    <button type="button" className="underline underline-offset-2" onClick={() => openState(row.key)}>
                      {row.label}
                    </button>
                  ) : (
                    row.label
                  )}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">{money.format(row.totals.revenue)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{row.totals.orders}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{row.totals.customers}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{kilos.format(row.totals.volumeKg)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      {summary.unlocated.orders > 0 && (
        <p className="text-[11px] text-[var(--bbos-text-secondary)]">
          {summary.unlocated.orders} pedido(s) ({money.format(summary.unlocated.revenue)}) de clientes sem cidade no cadastro não aparecem no mapa.{" "}
          <Link href="/clientes" className="font-semibold underline">Completar cadastros</Link>
        </p>
      )}
      <p className="text-[10px] text-[var(--bbos-text-secondary)]">Contornos: estados por svg-maps (CC BY 4.0); municípios pela malha oficial do IBGE.</p>
    </div>
  );
}
