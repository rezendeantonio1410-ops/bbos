// Drafts are local to this browser and contain no names, fiscal IDs, notes or prices.
// They are never submitted directly: pricing and authorization stay on the server.
export type SignaOrderDraft = {
  version: 1;
  savedAt: number;
  lines: Array<{ productVariantId: string; quantity: number }>;
  deliveryMode: "PICKUP" | "CUSTOMER_CARRIER";
  expectedDeliveryDate: string;
};

const MAX_DRAFT_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_LINES = 50;
const MAX_QUANTITY = 99999;

export function signaOrderDraftKey(commercialCustomerId: string): string {
  return `bbos:signa-order-draft:v1:${commercialCustomerId}`;
}

function validLine(line: unknown): line is { productVariantId: string; quantity: number } {
  if (!line || typeof line !== "object") return false;
  const candidate = line as Record<string, unknown>;
  return (
    typeof candidate.productVariantId === "string" &&
    candidate.productVariantId.length > 0 &&
    Number.isSafeInteger(candidate.quantity) &&
    (candidate.quantity as number) >= 1 &&
    (candidate.quantity as number) <= MAX_QUANTITY
  );
}

function validDate(value: unknown): value is string {
  if (value === "") return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1900 || year > 9999) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function createSignaOrderDraft(
  lines: unknown[],
  allowedVariantIds: ReadonlySet<string>,
  deliveryMode: "PICKUP" | "CUSTOMER_CARRIER",
  expectedDeliveryDate: string,
  now: number = Date.now(),
): SignaOrderDraft | null {
  if (lines.length < 1 || lines.length > MAX_LINES || !validDate(expectedDeliveryDate)) return null;
  const seen = new Set<string>();
  for (const line of lines) {
    if (!validLine(line) || !allowedVariantIds.has(line.productVariantId) || seen.has(line.productVariantId)) return null;
    seen.add(line.productVariantId);
  }
  if (deliveryMode !== "PICKUP" && deliveryMode !== "CUSTOMER_CARRIER") return null;
  return {
    version: 1,
    savedAt: now,
    lines: lines.map(line => {
      const item = line as { productVariantId: string; quantity: number };
      return { productVariantId: item.productVariantId, quantity: item.quantity };
    }),
    deliveryMode,
    expectedDeliveryDate,
  };
}

export function parseSignaOrderDraft(
  raw: string | null,
  allowedVariantIds: ReadonlySet<string>,
  now: number = Date.now(),
): SignaOrderDraft | null {
  if (!raw || raw.length > 20000) return null;
  try {
    const data = JSON.parse(raw) as Partial<SignaOrderDraft>;
    if (
      data.version !== 1 ||
      typeof data.savedAt !== "number" ||
      !Number.isFinite(data.savedAt) ||
      data.savedAt > now ||
      now - data.savedAt > MAX_DRAFT_AGE_MS ||
      !Array.isArray(data.lines) ||
      !validDate(data.expectedDeliveryDate) ||
      (data.deliveryMode !== "PICKUP" && data.deliveryMode !== "CUSTOMER_CARRIER")
    ) return null;
    // A changed or revoked catalog must invalidate the draft; never silently restore old SKUs.
    return createSignaOrderDraft(
      data.lines,
      allowedVariantIds,
      data.deliveryMode,
      data.expectedDeliveryDate,
      data.savedAt,
    );
  } catch {
    return null;
  }
}
