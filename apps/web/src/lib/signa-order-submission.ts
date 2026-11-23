import type { SignaOrderDraftScope } from "./signa-order-draft";

/**
 * Stable submission key for POST /partner-portal/orders. The same content
 * reuses the same key across double clicks, timeouts and page reloads, so the
 * API can return the original order instead of creating a duplicate. Any
 * change to the order content produces a new key.
 */
export type SignaOrderSubmission = { key: string; body: string; createdAt: number };

export const SIGNA_SUBMISSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const keyPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{15,127}$/;

export function signaOrderSubmissionStorageKey(scope: SignaOrderDraftScope | null): string | null {
  if (!scope) return null;
  const parts = [scope.companyId, scope.partnerId, scope.userId];
  if (parts.some(part => typeof part !== "string" || !part.trim() || part.length > 200)) return null;
  return `bbos:signa-order-submission:v1:${parts.map(encodeURIComponent).join(":")}`;
}

export function parseSignaOrderSubmission(raw: string | null): SignaOrderSubmission | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<SignaOrderSubmission>;
    if (typeof value.key !== "string" || !keyPattern.test(value.key)) return null;
    if (typeof value.body !== "string" || typeof value.createdAt !== "number") return null;
    return { key: value.key, body: value.body, createdAt: value.createdAt };
  } catch {
    return null;
  }
}

export function reuseOrCreateSignaOrderSubmission(
  stored: SignaOrderSubmission | null,
  body: string,
  now: number,
  generateKey: () => string,
): SignaOrderSubmission {
  if (
    stored &&
    stored.body === body &&
    now >= stored.createdAt &&
    now - stored.createdAt < SIGNA_SUBMISSION_MAX_AGE_MS
  ) {
    return stored;
  }
  const key = generateKey();
  if (!keyPattern.test(key)) throw new Error("Não foi possível gerar o identificador do envio.");
  return { key, body, createdAt: now };
}
