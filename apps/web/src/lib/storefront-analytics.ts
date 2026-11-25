/**
 * Store measurement for paid traffic (Meta Pixel + Google Analytics 4 / Google Ads).
 * Nothing loads or is sent until (1) the IDs exist in the environment and
 * (2) the visitor accepted cookies (LGPD). Without IDs every call is a no-op.
 */
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "";
export const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ?? "";
export const GOOGLE_ADS_PURCHASE_LABEL = process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL ?? "";

export const CONSENT_KEY = "bispo-cookies-v1";
const PENDING_KEY = "bispo-analytics-pending";
const SENT_KEY = "bispo-analytics-purchases";

export type AnalyticsItem = { id: string; name: string; priceCents: number; quantity: number };
type Win = Window & { fbq?: (...args: unknown[]) => void; gtag?: (...args: unknown[]) => void };

export const analyticsConfigured = () => Boolean(META_PIXEL_ID || GA_MEASUREMENT_ID || GOOGLE_ADS_ID);

export function consentGiven() {
  try {
    return localStorage.getItem(CONSENT_KEY) === "accepted";
  } catch {
    return false;
  }
}

const reais = (cents: number) => Math.round(cents) / 100;

/** Maps our four funnel steps to Meta and Google event names. */
export function eventPayloads(step: "view_item" | "add_to_cart" | "begin_checkout" | "purchase", items: AnalyticsItem[], extra: { valueCents?: number; orderId?: string } = {}) {
  const valueCents = extra.valueCents ?? items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
  const meta = { view_item: "ViewContent", add_to_cart: "AddToCart", begin_checkout: "InitiateCheckout", purchase: "Purchase" }[step];
  return {
    meta: {
      name: meta,
      params: {
        currency: "BRL",
        value: reais(valueCents),
        content_type: "product",
        content_ids: items.map((item) => item.id),
        contents: items.map((item) => ({ id: item.id, quantity: item.quantity })),
        num_items: items.reduce((sum, item) => sum + item.quantity, 0),
      },
      options: extra.orderId ? { eventID: `purchase-${extra.orderId}` } : undefined,
    },
    google: {
      name: step,
      params: {
        currency: "BRL",
        value: reais(valueCents),
        ...(extra.orderId ? { transaction_id: extra.orderId } : {}),
        items: items.map((item) => ({ item_id: item.id, item_name: item.name, price: reais(item.priceCents), quantity: item.quantity })),
      },
    },
  };
}

export function track(step: Parameters<typeof eventPayloads>[0], items: AnalyticsItem[], extra: { valueCents?: number; orderId?: string } = {}) {
  if (typeof window === "undefined" || !analyticsConfigured() || !consentGiven()) return;
  const w = window as Win;
  const payload = eventPayloads(step, items, extra);
  try {
    if (META_PIXEL_ID && w.fbq) {
      if (payload.meta.options) w.fbq("track", payload.meta.name, payload.meta.params, payload.meta.options);
      else w.fbq("track", payload.meta.name, payload.meta.params);
    }
    if (w.gtag && (GA_MEASUREMENT_ID || GOOGLE_ADS_ID)) {
      w.gtag("event", payload.google.name, payload.google.params);
      if (step === "purchase" && GOOGLE_ADS_ID && GOOGLE_ADS_PURCHASE_LABEL) {
        w.gtag("event", "conversion", {
          send_to: `${GOOGLE_ADS_ID}/${GOOGLE_ADS_PURCHASE_LABEL}`,
          value: payload.google.params.value,
          currency: "BRL",
          transaction_id: extra.orderId,
        });
      }
    }
  } catch {
    /* measurement must never break a purchase */
  }
}

/** Saved right before payment so the confirmation page knows the value. */
export function rememberPendingPurchase(orderId: string, items: AnalyticsItem[], valueCents: number) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ orderId, items, valueCents }));
  } catch {}
}

/** Fires "purchase" once per order, only for an order we saw going to payment. */
export function trackPurchaseOnce(orderId: string) {
  try {
    const sent: string[] = JSON.parse(localStorage.getItem(SENT_KEY) || "[]");
    if (sent.includes(orderId)) return false;
    const pending = JSON.parse(localStorage.getItem(PENDING_KEY) || "null");
    if (!pending || pending.orderId !== orderId) return false;
    track("purchase", pending.items, { valueCents: pending.valueCents, orderId });
    localStorage.setItem(SENT_KEY, JSON.stringify([...sent, orderId].slice(-20)));
    localStorage.removeItem(PENDING_KEY);
    return true;
  } catch {
    return false;
  }
}
