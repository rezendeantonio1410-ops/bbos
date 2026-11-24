/**
 * Pure helpers for "Por perto": distance, search box and each customer's
 * buying rhythm (to suggest a visit when a recurring buyer is late).
 */

const EARTH_RADIUS_KM = 6371;
const DAY_MS = 86_400_000;
const rad = (degrees: number) => (degrees * Math.PI) / 180;

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Latitude/longitude limits of a square around the point (fast SQL prefilter). */
export function boundingBox(lat: number, lng: number, radiusKm: number) {
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.max(0.01, Math.cos(rad(lat))));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}

export function parseNearbyQuery(query: { lat?: string; lng?: string; radiusKm?: string }) {
  const lat = Number(query.lat);
  const lng = Number(query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
    return null;
  const radius = Number(query.radiusKm ?? 3);
  const radiusKm = Number.isFinite(radius) ? Math.min(30, Math.max(0.2, radius)) : 3;
  return { lat, lng, radiusKm };
}

export type BuyingRhythm = {
  orders: number;
  lastOrderAt: string | null;
  /** Typical days between purchases (median of the recent intervals). */
  usualIntervalDays: number | null;
  daysSinceLastOrder: number | null;
  /** Days past the usual moment to buy again (0 when not late). */
  overdueDays: number;
  /** Recurring buyer (3+ orders) late enough to deserve a visit. */
  suggestVisit: boolean;
};

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};

/**
 * Orders on the same day count once. Uses the last 6 intervals, so a change of
 * habit shows quickly. A visit is suggested when the customer is late by at
 * least 20% of the usual interval (and 3 days), up to 4 intervals (after that
 * the customer is considered lost and handled by the sales follow-up).
 */
export function buyingRhythm(orderDates: Array<Date | string>, now = new Date()): BuyingRhythm {
  const days = [
    ...new Set(
      orderDates
        .map((value) => new Date(value).getTime())
        .filter((time) => Number.isFinite(time) && time <= now.getTime())
        .map((time) => Math.floor(time / DAY_MS)),
    ),
  ].sort((a, b) => a - b);
  if (!days.length)
    return { orders: 0, lastOrderAt: null, usualIntervalDays: null, daysSinceLastOrder: null, overdueDays: 0, suggestVisit: false };
  const last = days[days.length - 1]!;
  const daysSinceLastOrder = Math.floor(now.getTime() / DAY_MS) - last;
  const intervals = days.slice(1).map((day, index) => day - days[index]!).slice(-6);
  const usual = intervals.length >= 2 ? Math.round(median(intervals)) : null;
  const overdueDays = usual ? Math.max(0, daysSinceLastOrder - usual) : 0;
  const suggestVisit =
    usual !== null && days.length >= 3 && overdueDays >= Math.max(3, usual * 0.2) && daysSinceLastOrder <= usual * 4;
  return {
    orders: days.length,
    lastOrderAt: new Date(last * DAY_MS).toISOString().slice(0, 10),
    usualIntervalDays: usual,
    daysSinceLastOrder,
    overdueDays,
    suggestVisit,
  };
}

/** Postal-format query for the geocoder from the stored address fields. */
export function geocodeQuery(row: {
  address?: string | null;
  addressNumber?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
}) {
  const street = (row.address ?? "").replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  const number = (row.addressNumber ?? "").replace(/[^\dA-Za-z-]/g, "").slice(0, 10);
  const city = (row.city ?? "").trim();
  if (!city || (!street && !row.postalCode)) return null;
  return {
    street: street ? `${number ? `${number} ` : ""}${street}`.slice(0, 200) : null,
    city: city.slice(0, 100),
    state: (row.state ?? "").trim().slice(0, 40) || null,
    postalcode: (row.postalCode ?? "").replace(/\D/g, "").slice(0, 8) || null,
  };
}
