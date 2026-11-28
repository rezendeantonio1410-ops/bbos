/**
 * Dia em campo (BBOS Campo): pontos de GPS do tablet entre "Iniciar dia" e
 * "Encerrar dia", km rodados, paradas, clientes visitados e resumo do dia.
 * Funções puras; o controlador só lê e grava.
 */
import { distanceKm } from "./nearby";

/** Versão do texto de concordância. Mudou o texto, sobe a versão e pede de novo. */
export const FIELD_CONSENT_VERSION = 1;

export type GpsPoint = { at: Date; lat: number; lng: number; accuracy: number | null; speed: number | null };

const MAX_POINTS_PER_BATCH = 500;
const MAX_ACCURACY_M = 60; // ponto impreciso (prédio, túnel) não entra no km
const MIN_STEP_M = 25; // abaixo disso é "tremida" do GPS parado
const MAX_SPEED_KMH = 160; // salto impossível = ponto errado

/** Lote de pontos enviado pelo app: valida e descarta o que não faz sentido. */
export function parsePoints(body: unknown, now = new Date()): GpsPoint[] {
  const list = (body as { points?: unknown })?.points;
  if (!Array.isArray(list)) throw new Error("Envie os pontos de localização.");
  if (list.length > MAX_POINTS_PER_BATCH) throw new Error(`Envie no máximo ${MAX_POINTS_PER_BATCH} pontos por vez.`);
  const points: GpsPoint[] = [];
  for (const raw of list) {
    const p = raw as Record<string, unknown>;
    const at = new Date(String(p.at ?? ""));
    const lat = Number(p.lat);
    const lng = Number(p.lng);
    if (Number.isNaN(at.getTime()) || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) continue;
    if (at.getTime() > now.getTime() + 5 * 60_000) continue; // relógio adiantado
    const accuracy = p.accuracy === undefined || p.accuracy === null ? null : Number(p.accuracy);
    const speed = p.speed === undefined || p.speed === null ? null : Number(p.speed);
    points.push({ at, lat, lng, accuracy: Number.isFinite(accuracy) ? accuracy : null, speed: Number.isFinite(speed) ? speed : null });
  }
  return points;
}

/** Trajeto limpo: ordem do tempo, sem pontos imprecisos nem saltos impossíveis. */
export function cleanTrack(points: GpsPoint[]): GpsPoint[] {
  const sorted = [...points].filter((p) => p.accuracy === null || p.accuracy <= MAX_ACCURACY_M).sort((a, b) => a.at.getTime() - b.at.getTime());
  const out: GpsPoint[] = [];
  for (const p of sorted) {
    const last = out[out.length - 1];
    if (last) {
      const km = distanceKm(last, p);
      const hours = (p.at.getTime() - last.at.getTime()) / 3_600_000;
      if (hours <= 0) continue;
      if (km / hours > MAX_SPEED_KMH && km > 0.3) continue;
    }
    out.push(p);
  }
  return out;
}

/** Km rodados: soma dos trechos, ignorando a tremida do GPS parado. */
export function trackKm(points: GpsPoint[]) {
  const track = cleanTrack(points);
  let km = 0;
  let anchor = track[0];
  for (const p of track.slice(1)) {
    const step = distanceKm(anchor!, p);
    if (step * 1000 >= MIN_STEP_M) {
      km += step;
      anchor = p;
    }
  }
  return Math.round(km * 10) / 10;
}

export type Stop = { lat: number; lng: number; start: Date; end: Date; minutes: number };

/** Paradas: ficou num raio de ~120 m por 5 minutos ou mais. */
export function detectStops(points: GpsPoint[], minMinutes = 5, radiusM = 120): Stop[] {
  const track = cleanTrack(points);
  const stops: Stop[] = [];
  let i = 0;
  while (i < track.length) {
    let j = i + 1;
    while (j < track.length && distanceKm(track[i]!, track[j]!) * 1000 <= radiusM) j++;
    const first = track[i]!;
    const last = track[j - 1]!;
    const minutes = (last.at.getTime() - first.at.getTime()) / 60_000;
    if (minutes >= minMinutes) {
      const group = track.slice(i, j);
      stops.push({
        lat: group.reduce((s, p) => s + p.lat, 0) / group.length,
        lng: group.reduce((s, p) => s + p.lng, 0) / group.length,
        start: first.at,
        end: last.at,
        minutes: Math.round(minutes),
      });
      i = j;
    } else i++;
  }
  return stops;
}

export type Place = { id: string; name: string; lat: number; lng: number; kind: "CUSTOMER" | "PROSPECT" };

/** Liga cada parada ao cliente (ou prospect) a até 200 m. */
export function matchStops(stops: Stop[], places: Place[], maxM = 200) {
  return stops.map((stop) => {
    let best: (Place & { meters: number }) | null = null;
    for (const place of places) {
      const meters = distanceKm(stop, place) * 1000;
      if (meters <= maxM && (!best || meters < best.meters)) best = { ...place, meters: Math.round(meters) };
    }
    return { ...stop, place: best };
  });
}

/** Cliente da carteira mais perto da posição atual: "Você está no Hospital". */
export function placeHere(here: { lat: number; lng: number }, places: Place[], maxM = 150) {
  return matchStops([{ ...here, start: new Date(), end: new Date(), minutes: 0 }], places, maxM)[0]?.place ?? null;
}

export type DayInput = {
  startedAt: Date;
  endedAt: Date | null;
  pausedMinutes: number;
  points: GpsPoint[];
  places: Place[];
  orders: Array<{ customerId: string; amount: number }>;
  now?: Date;
};

/** Resumo do dia: km, tempo com cliente, dirigindo, parado, pausa e vendas por km. */
export function daySummary(input: DayInput) {
  const end = input.endedAt ?? input.now ?? new Date();
  const totalMinutes = Math.max(0, Math.round((end.getTime() - input.startedAt.getTime()) / 60_000));
  const km = trackKm(input.points);
  const stops = matchStops(detectStops(input.points), input.places);
  const atCustomers = stops.filter((s) => s.place);
  const customerMinutes = atCustomers.reduce((s, x) => s + x.minutes, 0);
  const stoppedMinutes = stops.filter((s) => !s.place).reduce((s, x) => s + x.minutes, 0);
  const pauseMinutes = Math.min(totalMinutes, Math.max(0, Math.round(input.pausedMinutes)));
  const drivingMinutes = Math.max(0, totalMinutes - customerMinutes - stoppedMinutes - pauseMinutes);
  const revenue = input.orders.reduce((s, o) => s + o.amount, 0);
  const visitedIds = new Set(atCustomers.map((s) => s.place!.id));
  const withOrder = [...visitedIds].filter((id) => input.orders.some((o) => o.customerId === id)).length;
  let previous: { lat: number; lng: number } | null = null;
  const stopList = stops.map((s) => {
    const fromPrevious = previous ? Math.round(distanceKm(previous, s) * 10) / 10 : null;
    previous = s;
    const sold = s.place ? input.orders.filter((o) => o.customerId === s.place!.id).reduce((t, o) => t + o.amount, 0) : 0;
    return { start: s.start.toISOString(), end: s.end.toISOString(), minutes: s.minutes, place: s.place ? { id: s.place.id, name: s.place.name, kind: s.place.kind } : null, kmFromPrevious: fromPrevious, sold: Math.round(sold) };
  });
  return {
    km,
    totalMinutes,
    customerMinutes,
    drivingMinutes,
    stoppedMinutes,
    pauseMinutes,
    visits: visitedIds.size,
    visitsWithOrder: withOrder,
    revenue: Math.round(revenue),
    revenuePerKm: km > 0 ? Math.round(revenue / km) : null,
    kmPerVisit: visitedIds.size ? Math.round((km / visitedIds.size) * 10) / 10 : null,
    stops: stopList,
    track: cleanTrack(input.points).map((p) => [Math.round(p.lat * 1e5) / 1e5, Math.round(p.lng * 1e5) / 1e5] as [number, number]),
  };
}

/** O que o BBOS percebe no dia (regras simples, sempre com o número). */
export function dayInsights(summary: ReturnType<typeof daySummary>) {
  const out: string[] = [];
  if (summary.totalMinutes >= 120 && summary.stoppedMinutes >= 45)
    out.push(`${Math.floor(summary.stoppedMinutes / 60)}h${String(summary.stoppedMinutes % 60).padStart(2, "0")} parado fora de cliente. Dá para encaixar uma visita de prospecção perto dessas paradas.`);
  if (summary.kmPerVisit !== null && summary.kmPerVisit >= 15)
    out.push(`${summary.kmPerVisit} km por visita. Agrupar clientes da mesma região no mesmo dia reduz a estrada.`);
  if (summary.visits > 0 && summary.visitsWithOrder / summary.visits >= 0.6)
    out.push(`${summary.visitsWithOrder} de ${summary.visits} visitas viraram pedido. Bom aproveitamento.`);
  if (summary.km >= 10 && summary.revenuePerKm !== null && summary.revenuePerKm < 20)
    out.push(`R$ ${summary.revenuePerKm} vendidos por km. Vale priorizar clientes com recompra chegando.`);
  return out;
}

/** Nome curto do status do dia, para a tela. */
export function parseDayAction(value: unknown) {
  const action = String(value ?? "").toUpperCase();
  if (!["START", "PAUSE", "RESUME", "END"].includes(action)) throw new Error("Ação inválida para o dia.");
  return action as "START" | "PAUSE" | "RESUME" | "END";
}
