import { getBrazilianMunicipalities } from "./brazilian-municipalities";

/**
 * Real municipality outlines for one state, from IBGE's free official mesh API
 * (servicodados.ibge.gov.br, "malhas"), projected to SVG paths on the server so
 * the browser only draws. Cached in memory; outlines do not change.
 */
export type MunicipalityShape = { code: string; name: string; path: string; cx: number; cy: number };
export type StateShapes = { state: string; width: number; height: number; municipalities: MunicipalityShape[] };

const STATE_CODES: Record<string, string> = {
  AC: "12", AL: "27", AP: "16", AM: "13", BA: "29", CE: "23", DF: "53", ES: "32", GO: "52", MA: "21",
  MT: "51", MS: "50", MG: "31", PA: "15", PB: "25", PR: "41", PE: "26", PI: "22", RJ: "33", RN: "24",
  RS: "43", RO: "11", RR: "14", SC: "42", SP: "35", SE: "28", TO: "17",
};

type Position = [number, number];
type Feature = { properties?: { codarea?: string | number }; geometry?: { type: string; coordinates: unknown } };

const polygonsOf = (geometry: Feature["geometry"]): Position[][][] => {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates as Position[][]];
  if (geometry.type === "MultiPolygon") return geometry.coordinates as Position[][][];
  return [];
};

/** Equirectangular projection corrected by the state's mid latitude, fitted to `width`. */
export function projectFeatures(features: Feature[], names: Map<string, string>, width = 900): Omit<StateShapes, "state"> {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const feature of features)
    for (const polygon of polygonsOf(feature.geometry))
      for (const ring of polygon)
        for (const [lon, lat] of ring) {
          if (lon < minX) minX = lon;
          if (lon > maxX) maxX = lon;
          if (lat < minY) minY = lat;
          if (lat > maxY) maxY = lat;
        }
  if (!Number.isFinite(minX)) return { width, height: 0, municipalities: [] };
  const k = Math.cos((((minY + maxY) / 2) * Math.PI) / 180);
  const scale = width / Math.max(1e-9, (maxX - minX) * k);
  const height = Math.round((maxY - minY) * scale);
  const point = (lon: number, lat: number): Position => [(lon - minX) * k * scale, (maxY - lat) * scale];

  const municipalities = features.flatMap((feature) => {
    const code = String(feature.properties?.codarea ?? "");
    if (!code) return [];
    let path = "";
    let sumX = 0, sumY = 0, count = 0;
    for (const polygon of polygonsOf(feature.geometry))
      for (const ring of polygon) {
        const points = ring.map(([lon, lat]) => point(lon, lat));
        if (points.length < 3) continue;
        path += `M${points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L")}Z`;
        for (const [x, y] of points) {
          sumX += x;
          sumY += y;
          count += 1;
        }
      }
    if (!path) return [];
    return [{ code, name: names.get(code) ?? code, path, cx: Math.round(sumX / count), cy: Math.round(sumY / count) }];
  });
  return { width, height, municipalities };
}

const cache = new Map<string, StateShapes>();

export async function getStateShapes(state: string, fetchImpl: typeof fetch = fetch): Promise<StateShapes | null> {
  const uf = state.toUpperCase();
  const code = STATE_CODES[uf];
  if (!code) return null;
  const cached = cache.get(uf);
  if (cached) return cached;
  const response = await fetchImpl(
    `https://servicodados.ibge.gov.br/api/v3/malhas/estados/${code}?formato=application/vnd.geo%2Bjson&qualidade=minima&intrarregiao=municipio`,
    { headers: { Accept: "application/vnd.geo+json" }, signal: AbortSignal.timeout(15000) },
  );
  if (!response.ok) throw new Error(`IBGE malhas HTTP ${response.status}`);
  const geo = (await response.json()) as { features?: Feature[] };
  const municipalities = await getBrazilianMunicipalities(uf);
  const names = new Map(municipalities.map((item) => [item.ibgeCode, item.name]));
  const shapes = { state: uf, ...projectFeatures(geo.features ?? [], names) };
  if (shapes.municipalities.length) cache.set(uf, shapes);
  return shapes;
}
