import assert from "node:assert/strict";
import test from "node:test";
import { boundingBox, buyingRhythm, distanceKm, geocodeQuery, parseNearbyQuery } from "./nearby";
import { GeocodingService } from "./geocoding.service";

const LONDRINA = { lat: -23.3045, lng: -51.1696 };
const CAMBE = { lat: -23.2766, lng: -51.2798 };

test("distance and box", () => {
  const km = distanceKm(LONDRINA, CAMBE);
  assert.ok(km > 10 && km < 13, `Londrina–Cambé ${km}`);
  assert.equal(distanceKm(LONDRINA, LONDRINA), 0);
  const box = boundingBox(LONDRINA.lat, LONDRINA.lng, 2);
  assert.ok(box.minLat < LONDRINA.lat && box.maxLat > LONDRINA.lat);
  assert.ok(distanceKm(LONDRINA, { lat: box.maxLat, lng: LONDRINA.lng }) > 1.99);
});

test("query parsing clamps radius and rejects bad points", () => {
  assert.deepEqual(parseNearbyQuery({ lat: "-23.3", lng: "-51.1" }), { lat: -23.3, lng: -51.1, radiusKm: 3 });
  assert.equal(parseNearbyQuery({ lat: "x", lng: "1" }), null);
  assert.equal(parseNearbyQuery({ lat: "95", lng: "1" }), null);
  assert.equal(parseNearbyQuery({ lat: "1", lng: "1", radiusKm: "500" })?.radiusKm, 30);
});

const now = new Date("2026-11-24T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

test("recurring buyer late enough gets a visit suggestion", () => {
  // Buys every ~14 days; last order 24 days ago → 10 days late.
  const rhythm = buyingRhythm([daysAgo(66), daysAgo(52), daysAgo(38), daysAgo(24)], now);
  assert.equal(rhythm.orders, 4);
  assert.equal(rhythm.usualIntervalDays, 14);
  assert.equal(rhythm.daysSinceLastOrder, 24);
  assert.equal(rhythm.overdueDays, 10);
  assert.equal(rhythm.suggestVisit, true);
});

test("no suggestion when on time, too few orders or long lost", () => {
  assert.equal(buyingRhythm([daysAgo(42), daysAgo(28), daysAgo(14), daysAgo(2)], now).suggestVisit, false);
  assert.equal(buyingRhythm([daysAgo(40), daysAgo(30)], now).suggestVisit, false);
  assert.equal(buyingRhythm([daysAgo(200), daysAgo(190), daysAgo(180)], now).suggestVisit, false);
  const same = buyingRhythm([daysAgo(10), daysAgo(10), daysAgo(10)], now);
  assert.equal(same.orders, 1);
  assert.equal(buyingRhythm([], now).lastOrderAt, null);
});

test("geocode query cleans address and needs a city", () => {
  assert.deepEqual(
    geocodeQuery({ address: "Av. Rio Branco (número a confirmar)", addressNumber: "120", city: "Londrina", state: "PR", postalCode: "86.010-000" }),
    { street: "120 Av. Rio Branco", city: "Londrina", state: "PR", postalcode: "86010000" },
  );
  assert.equal(geocodeQuery({ address: "R. X", city: "" }), null);
  assert.equal(geocodeQuery({ city: "Cambé" }), null);
});

test("geocoder tries street, then postal code; null when nothing found", async () => {
  const service = new GeocodingService();
  const urls: string[] = [];
  service.fetchImpl = (async (url: string) => {
    urls.push(url);
    const body = url.includes("postalcode") ? [{ lat: "-23.31", lon: "-51.16" }] : [];
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
  const found = await service.search({ street: "90 R. Foz do Iguaçu", city: "Londrina", state: "PR", postalcode: "86020000" });
  assert.deepEqual(found, { lat: -23.31, lng: -51.16 });
  assert.equal(urls.length, 2);
  assert.match(urls[0]!, /street=90\+R\.\+Foz/);
  service.fetchImpl = (async () => new Response("[]", { status: 200 })) as typeof fetch;
  assert.equal(await service.search({ street: "1 R. Y", city: "Ibiporã", state: null, postalcode: null }), null);
  service.fetchImpl = (async () => new Response("", { status: 429 })) as typeof fetch;
  await assert.rejects(service.search({ street: "1 R. Y", city: "Ibiporã", state: null, postalcode: null }), /429/);
});
