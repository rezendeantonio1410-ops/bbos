"use client";

import * as React from "react";
import { geoCentroid, geoGraticule10, geoNaturalEarth1, geoPath } from "d3-geo";
import { feature, mesh } from "topojson-client";
import { ORIGIN, destinationNote, type Destination } from "@/lib/export-map";
import { countryName, flag } from "@/lib/exports";

/**
 * World map of the export area: routes from Londrina to each destination.
 * Dashed green = sample on the way (animated), solid green = delivered,
 * amber = deal (contract or export order). Countries with activity are tinted.
 * The map shapes (Natural Earth 1:50m, world-atlas) are served from
 * /maps/countries-50m.json so they don't weigh on the page bundle.
 */

type CountryFeature = GeoJSON.Feature<GeoJSON.Geometry, { name: string }> & { id?: string };
type WorldShapes = { countries: CountryFeature[]; borders: GeoJSON.MultiLineString };

// ISO 3166 alpha-2 → numeric (world-atlas ids) for the countries the team trades with.
const ISO_NUMERIC: Record<string, string> = {
  US: "840", DE: "276", JP: "392", IT: "380", BE: "056", KR: "410", NL: "528", GB: "826", FR: "250", CA: "124",
  AU: "036", CN: "156", TW: "158", SA: "682", AE: "784", CH: "756", SE: "752", NO: "578", DK: "208", ES: "724",
  PT: "620", RU: "643", CL: "152", AR: "032", MX: "484", HK: "344", SG: "702", FI: "246", AT: "040", PL: "616",
  IE: "372", NZ: "554", ZA: "710", TR: "792", GR: "300", IL: "376", QA: "634", KW: "414", TH: "764", MY: "458",
  ID: "360", PH: "608", VN: "704", IN: "356", CO: "170", PE: "604", UY: "858", CZ: "203", HU: "348", RO: "642",
};
const BRAZIL = "076";

let shapesPromise: Promise<WorldShapes> | null = null;
function loadShapes() {
  shapesPromise ??= fetch("/maps/countries-50m.json", { cache: "force-cache" })
    .then((response) => response.json())
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- world-atlas TopoJSON
    .then((topology: any) => {
      const collection = feature(topology, topology.objects.countries) as unknown as GeoJSON.FeatureCollection<GeoJSON.Geometry, { name: string }>;
      return {
        countries: (collection.features as CountryFeature[]).filter((country) => country.id !== "010"),
        borders: mesh(topology, topology.objects.countries, (a, b) => a !== b) as GeoJSON.MultiLineString,
      };
    });
  return shapesPromise;
}

type Filter = "all" | "sample" | "deal";
const WIDTH = 960;
const HEIGHT = 470;

export function ExportWorldMap({ destinations }: { destinations: Destination[] }) {
  const [shapes, setShapes] = React.useState<WorldShapes | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [filter, setFilter] = React.useState<Filter>("all");
  React.useEffect(() => {
    let alive = true;
    loadShapes().then((value) => alive && setShapes(value)).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, []);

  const view = React.useMemo(() => {
    if (!shapes) return null;
    const projection = geoNaturalEarth1().fitExtent([[10, 10], [WIDTH - 10, HEIGHT - 10]], { type: "FeatureCollection", features: shapes.countries });
    const path = geoPath(projection);
    const byNumeric = new Map(shapes.countries.map((country) => [String(country.id), country]));
    const active = new Set(destinations.map((d) => ISO_NUMERIC[d.country]).filter(Boolean));
    const points = destinations.map((d) => {
      const country = byNumeric.get(ISO_NUMERIC[d.country] ?? "");
      const coords = d.coords ?? (country ? (geoCentroid(country) as [number, number]) : null);
      const xy = coords ? projection(coords) : null;
      return { d, coords, xy };
    });
    const origin = projection(ORIGIN.coords);
    return { path, active, points, origin };
  }, [shapes, destinations]);

  return (
    <section className="rounded-[var(--bbos-radius-card,14px)] border border-[var(--bbos-border)] bg-white p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-[16.5px] font-semibold">Para onde a Bispo já mandou café</h2>
        <span className="text-xs text-[var(--bbos-text-secondary)]">amostras e negócios por destino</span>
        <div role="group" aria-label="Mostrar" className="ml-auto inline-flex gap-0.5 rounded-xl border border-[var(--bbos-border)] p-1">
          {([["all", "Tudo"], ["sample", "Amostras"], ["deal", "Negócios"]] as Array<[Filter, string]>).map(([key, label]) => (
            <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}
              className={`min-h-8 rounded-lg px-3 text-[12.5px] font-semibold ${filter === key ? "bg-[var(--bbos-nav-active)] text-[var(--bbos-nav-active-text)]" : "text-[var(--bbos-text-secondary)]"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-hidden rounded-xl bg-[#f3f6f8]">
        {failed ? (
          <p className="p-10 text-center text-sm text-[var(--bbos-text-secondary)]">Não foi possível carregar o mapa agora.</p>
        ) : !view ? (
          <div className="aspect-[960/470] w-full animate-pulse bg-[#eef3f6]" />
        ) : (
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block h-auto w-full" role="img" aria-label="Mapa-múndi com as rotas de amostras e negócios saindo de Londrina">
            <path d={view.path({ type: "Sphere" }) ?? undefined} fill="#eef3f6" />
            <path d={view.path(geoGraticule10()) ?? undefined} fill="none" stroke="#dfe7ec" strokeWidth={0.5} />
            {shapes!.countries.map((country) => {
              const id = String(country.id);
              const fill = view.active.has(id) ? "#a9cbb8" : id === BRAZIL ? "#e8d9c2" : "#dfe4df";
              return <path key={id + country.properties.name} d={view.path(country) ?? undefined} fill={fill} />;
            })}
            <path d={view.path(shapes!.borders) ?? undefined} fill="none" stroke="#fff" strokeWidth={0.6} />
            {view.points.map(({ d, coords }) => coords && (
              <g key={`routes-${d.key}`}>
                {filter !== "deal" && (d.samplesOnTheWay > 0 || d.samplesDelivered > 0) && (
                  <path d={view.path({ type: "LineString", coordinates: [ORIGIN.coords, coords] }) ?? undefined} fill="none"
                    stroke="var(--bbos-success)" strokeWidth={2.4} strokeLinecap="round"
                    className={d.samplesOnTheWay > 0 ? "export-route-moving" : undefined}
                    strokeDasharray={d.samplesOnTheWay > 0 ? "7 6" : undefined} />
                )}
                {filter !== "sample" && d.deals > 0 && (
                  <path d={view.path({ type: "LineString", coordinates: [ORIGIN.coords, coords] }) ?? undefined} fill="none"
                    stroke="var(--bbos-warning)" strokeWidth={2} strokeOpacity={0.85} transform="translate(0,6)" />
                )}
              </g>
            ))}
            {view.points.map(({ d, xy }) => {
              if (!xy) return null;
              const hidden = (filter === "sample" && !(d.samplesOnTheWay + d.samplesDelivered)) || (filter === "deal" && !d.deals);
              if (hidden) return null;
              return (
                <g key={`pin-${d.key}`} transform={`translate(${xy[0]},${xy[1]})`}>
                  <circle r={13} fill="rgba(30,122,79,.18)" />
                  <circle r={6} fill="var(--bbos-success)" stroke="#fff" strokeWidth={2} />
                  <text x={12} y={-10} fontSize={13} fontWeight={700} fill="var(--bbos-text-primary)" stroke="#fff" strokeWidth={3} paintOrder="stroke">{d.city || countryName(d.country)}</text>
                  <text x={12} y={5} fontSize={11.5} fill="var(--bbos-text-secondary)" stroke="#fff" strokeWidth={3} paintOrder="stroke">{destinationNote(d)}</text>
                </g>
              );
            })}
            {view.origin && (
              <g transform={`translate(${view.origin[0]},${view.origin[1]})`}>
                <circle r={7} fill="var(--bbos-text-primary)" stroke="#fff" strokeWidth={2} />
                <text x={11} y={4} fontSize={13} fontWeight={700} fill="var(--bbos-text-primary)" stroke="#fff" strokeWidth={3} paintOrder="stroke">{ORIGIN.name}</text>
              </g>
            )}
          </svg>
        )}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--bbos-text-secondary)]">
        <Legend style="dashed" color="var(--bbos-success)">amostra a caminho</Legend>
        <Legend style="solid" color="var(--bbos-success)">amostra entregue</Legend>
        <Legend style="solid" color="var(--bbos-warning)">pedido ou contrato</Legend>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-full bg-[var(--bbos-text-primary)]" />Londrina (origem)</span>
      </div>
      {destinations.length > 0 ? (
        <div className="mt-3 grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
          {destinations.map((d) => (
            <div key={d.key} className="flex items-center gap-2.5 rounded-xl border border-[var(--bbos-border)] px-3 py-2">
              <span className="text-xl" aria-hidden>{flag(d.country)}</span>
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-semibold">{countryName(d.country)}{d.city ? ` · ${d.city}` : ""}</p>
                <p className="text-xs text-[var(--bbos-text-secondary)]">{destinationNote(d)}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-[var(--bbos-text-secondary)]">Cadastre uma amostra ou um contrato para o destino aparecer no mapa.</p>
      )}
      <style>{`.export-route-moving{animation:export-route 1.6s linear infinite}@keyframes export-route{to{stroke-dashoffset:-26}}@media (prefers-reduced-motion:reduce){.export-route-moving{animation:none}}`}</style>
    </section>
  );
}

function Legend({ color, style, children }: { color: string; style: "solid" | "dashed"; children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5"><i className="inline-block w-5 border-t-[2.4px]" style={{ borderColor: color, borderStyle: style }} />{children}</span>;
}
