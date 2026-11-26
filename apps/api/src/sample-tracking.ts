/**
 * Automatic tracking of export samples through 17TRACK (one API for FedEx,
 * DHL, UPS, TNT, Correios and the destination's local post).
 *
 * Docs: https://api.17track.net/en/doc?version=v2.2 — header "17token",
 * POST /track/v2.2/register and POST /track/v2.2/gettrackinfo, both taking
 * [{ number, carrier? }]. The key lives only in the API's environment
 * (TRACK17_API_KEY); without it the feature stays off.
 */

export const TRACK17_BASE = "https://api.17track.net/track/v2.2";

/** 17TRACK carrier codes; the carrier is auto-detected when omitted. */
export const TRACK17_CARRIER: Record<string, number | undefined> = {
  DHL: 100001,
  UPS: 100002,
  FEDEX: 100003,
  TNT: 100004,
  CORREIOS: 2151,
};

export type TrackedEvent = { at: Date; description: string; location: string | null; stage: string | null };

export type TrackingReading = {
  /** Our journey step suggested by the carrier, or null when nothing to apply. */
  step: "SENT" | "IN_TRANSIT" | "CUSTOMS" | "DELIVERED" | null;
  statusText: string;
  events: TrackedEvent[];
  deliveredAt: Date | null;
  problem: string | null;
};

const ORDER: Record<string, number> = { PREPARED: 0, SENT: 1, IN_TRANSIT: 2, CUSTOMS: 2, DELIVERED: 3, EVALUATED: 4 };

const STATUS_TEXT: Record<string, string> = {
  NotFound: "Ainda sem informação da transportadora",
  InfoReceived: "Etiqueta registrada na transportadora",
  InTransit: "Em trânsito",
  Expired: "Rastreio expirado",
  AvailableForPickup: "Disponível para retirada",
  OutForDelivery: "Saiu para entrega",
  DeliveryFailure: "Falha na entrega",
  Delivered: "Entregue",
  Exception: "Ocorrência no envio",
};

function date(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const TROUBLE = /exception|on hold|held|missing|paperwork|clearance delay|incorrect address|refused|retid|pend[eê]ncia/i;
const RESOLVED = /released|cleared|liberad/i;

const isCustoms =(text: string | null | undefined) => /custom|alf[aâ]ndega|clearance|海关|import/i.test(text ?? "");

/** Reads one entry of gettrackinfo's data.accepted[]. */
export function readTrackInfo(entry: any): TrackingReading {
  const info = entry?.track_info ?? {};
  const status: string = info?.latest_status?.status ?? "NotFound";
  const subStatus: string = info?.latest_status?.sub_status ?? "";
  const providers: any[] = Array.isArray(info?.tracking?.providers) ? info.tracking.providers : [];
  const seen = new Set<string>();
  const events: TrackedEvent[] = [];
  for (const provider of providers) {
    for (const raw of Array.isArray(provider?.events) ? provider.events : []) {
      const at = date(raw?.time_iso) ?? date(raw?.time_utc);
      const description = String(raw?.description ?? "").trim();
      if (!at || !description) continue;
      const key = `${at.toISOString()}|${description}`;
      if (seen.has(key)) continue;
      seen.add(key);
      events.push({ at, description, location: raw?.location ? String(raw.location) : null, stage: raw?.stage ?? null });
    }
  }
  events.sort((a, b) => a.at.getTime() - b.at.getTime());
  const latest = events[events.length - 1];

  let step: TrackingReading["step"] = null;
  if (status === "Delivered") step = "DELIVERED";
  else if (/Customs/i.test(subStatus) || (status === "InTransit" && isCustoms(latest?.description))) step = "CUSTOMS";
  else if (["InTransit", "OutForDelivery", "AvailableForPickup", "DeliveryFailure", "Exception"].includes(status)) step = "IN_TRANSIT";
  else if (status === "InfoReceived" || events.length) step = "SENT";

  const deliveredAt = status === "Delivered" ? (latest?.at ?? null) : null;
  // Carriers often keep the overall status "in transit" and only write the
  // trouble in the latest event (FedEx: "Shipment exception, … paperwork").
  const latestTrouble = !!latest && status !== "Delivered" && TROUBLE.test(latest.description) && !RESOLVED.test(latest.description);
  const troubleEvent = latestTrouble ? latest : [...events].reverse().find((event) => TROUBLE.test(event.description));
  const stillHeld = !!troubleEvent && status !== "Delivered" && !!latest && (latestTrouble || (latest.at.getTime() - troubleEvent.at.getTime() < 3 * 86_400_000 && /facility|unidade|terminal/i.test(latest.description)));
  const problem =
    status === "Exception" || status === "DeliveryFailure"
      ? `${STATUS_TEXT[status]}${latest ? `: ${latest.description}` : ""}`
      : stillHeld
        ? `Ocorrência no envio: ${troubleEvent!.description}${troubleEvent!.location ? ` (${troubleEvent!.location})` : ""}`
        : null;
  return { step, statusText: STATUS_TEXT[status] ?? status, events, deliveredAt, problem };
}

/**
 * The carrier only moves a sample forward: it never undoes a step recorded by
 * hand, and never touches evaluated, lost or returned samples.
 */
export function nextStatus(current: string, suggested: TrackingReading["step"]) {
  if (!suggested || ["EVALUATED", "LOST", "RETURNED"].includes(current)) return null;
  if (current === suggested) return null;
  const from = ORDER[current] ?? 0;
  const to = ORDER[suggested] ?? 0;
  if (to > from) return suggested;
  // Same dot on the line: transit ↔ customs follows the carrier.
  if (to === from && from === 2) return suggested;
  return null;
}

/** Event note as shown in the sample history. */
export function eventNote(event: TrackedEvent) {
  return [event.description, event.location].filter(Boolean).join(" · ").slice(0, 500);
}

export class TrackingUnavailable extends Error {}

export async function track17(path: "register" | "gettrackinfo", items: Array<{ number: string; carrier?: number }>, fetcher: typeof fetch = fetch) {
  const key = process.env.TRACK17_API_KEY?.trim();
  if (!key) throw new TrackingUnavailable("Rastreio automático desligado: falta a chave TRACK17_API_KEY no Render.");
  const response = await fetcher(`${TRACK17_BASE}/${path}`, {
    method: "POST",
    headers: { "17token": key, "content-type": "application/json" },
    body: JSON.stringify(items),
    signal: AbortSignal.timeout(15000),
  });
  const payload: any = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.code !== 0) {
    throw new TrackingUnavailable(`17TRACK respondeu ${response.status}${payload?.data?.errors?.[0]?.message ? `: ${payload.data.errors[0].message}` : ""}`);
  }
  return payload.data as { accepted?: any[]; rejected?: any[] };
}
