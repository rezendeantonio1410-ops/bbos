import assert from "node:assert/strict";
import test from "node:test";
import { cleanTrack, daySummary, dayInsights, detectStops, matchStops, parseDayAction, parsePoints, placeHere, trackKm, type GpsPoint } from "./field-day";
import { distanceKm } from "./nearby";

const T0 = new Date("2026-11-30T11:00:00Z").getTime();
const at = (min: number) => new Date(T0 + min * 60_000);
const A = { lat: -23.3100, lng: -51.1600 };
const B = { lat: -23.3100, lng: -51.1110 }; // ~5 km a leste
const C = { lat: -23.2830, lng: -51.1110 }; // ~3 km ao norte de B

function drive(from: { lat: number; lng: number }, to: { lat: number; lng: number }, startMin: number, minutes: number): GpsPoint[] {
  const steps = minutes * 2; // um ponto a cada 30 s
  return Array.from({ length: steps + 1 }, (_, i) => ({ at: at(startMin + i / 2), lat: from.lat + ((to.lat - from.lat) * i) / steps, lng: from.lng + ((to.lng - from.lng) * i) / steps, accuracy: 10, speed: null }));
}
function stay(place: { lat: number; lng: number }, startMin: number, minutes: number): GpsPoint[] {
  return Array.from({ length: minutes + 1 }, (_, i) => ({ at: at(startMin + i), lat: place.lat + (i % 2 ? 0.00004 : -0.00004), lng: place.lng + (i % 3 ? 0.00003 : -0.00003), accuracy: 15, speed: 0 }));
}
const track = [...drive(A, B, 0, 8), ...stay(B, 8.5, 20), ...drive(B, C, 29, 5), ...stay(C, 34.5, 12)];
const places = [
  { id: "b", name: "Cliente B", lat: B.lat + 0.0005, lng: B.lng, kind: "CUSTOMER" as const },
  { id: "c", name: "Cliente C", lat: C.lat, lng: C.lng + 0.0004, kind: "CUSTOMER" as const },
  { id: "far", name: "Longe", lat: -23.40, lng: -51.30, kind: "CUSTOMER" as const },
];

test("pontos: aceita lote válido e descarta lixo", () => {
  const pts = parsePoints({ points: [
    { at: "2026-11-30T11:00:00Z", lat: -23.3, lng: -51.1, accuracy: 8 },
    { at: "invalido", lat: 1, lng: 1 },
    { at: "2026-11-30T11:01:00Z", lat: 0, lng: 0 },
    { at: "2026-11-30T11:02:00Z", lat: 95, lng: 1 },
    { at: "2030-01-01T00:00:00Z", lat: -23.3, lng: -51.1 },
  ] }, new Date("2026-11-30T12:00:00Z"));
  assert.equal(pts.length, 1);
  assert.throws(() => parsePoints({}), /pontos/);
  assert.throws(() => parsePoints({ points: new Array(501).fill({}) }), /500/);
});

test("km: soma o trajeto, ignora tremida parado, ponto impreciso e salto impossível", () => {
  const expected = distanceKm(A, B) + distanceKm(B, C);
  const km = trackKm(track);
  assert.ok(Math.abs(km - expected) < 0.3, `km=${km} esperado≈${expected.toFixed(2)}`);
  const noisy = [...track, { at: at(10), lat: -22.5, lng: -50.0, accuracy: 10, speed: null }, { at: at(11), lat: B.lat + 0.01, lng: B.lng, accuracy: 500, speed: null }];
  assert.ok(Math.abs(trackKm(noisy) - km) < 0.05);
  assert.equal(cleanTrack(noisy).length, cleanTrack(track).length);
  assert.equal(trackKm(stay(B, 0, 60)), 0);
});

test("paradas e clientes visitados", () => {
  const stops = detectStops(track);
  assert.equal(stops.length, 2);
  assert.ok(stops[0]!.minutes >= 19 && stops[0]!.minutes <= 21);
  const matched = matchStops(stops, places);
  assert.deepEqual(matched.map((s) => s.place?.id), ["b", "c"]);
  assert.equal(placeHere(B, places)?.id, "b");
  assert.equal(placeHere({ lat: -23.35, lng: -51.2 }, places), null);
});

test("resumo do dia, vendas por km e o que o BBOS percebe", () => {
  const s = daySummary({ startedAt: at(0), endedAt: at(50), pausedMinutes: 0, points: track, places, orders: [{ customerId: "b", amount: 885 }, { customerId: "c", amount: 360 }] });
  assert.equal(s.visits, 2);
  assert.equal(s.visitsWithOrder, 2);
  assert.equal(s.revenue, 1245);
  assert.ok(s.km > 7 && s.km < 9);
  assert.equal(s.revenuePerKm, Math.round(1245 / s.km));
  assert.equal(s.totalMinutes, 50);
  assert.ok(s.customerMinutes >= 30 && s.customerMinutes <= 34);
  assert.equal(s.stops[0]!.place?.name, "Cliente B");
  assert.equal(s.stops[0]!.sold, 885);
  assert.ok(s.stops[1]!.kmFromPrevious! > 2.5);
  assert.match(dayInsights(s).join(" "), /2 de 2 visitas viraram pedido/);
});

test("ações do dia", () => {
  assert.equal(parseDayAction("start"), "START");
  assert.throws(() => parseDayAction("voar"), /inválida/);
});
