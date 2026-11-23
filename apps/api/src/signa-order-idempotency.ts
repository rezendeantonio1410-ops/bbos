import { createHash } from "node:crypto";

/**
 * Strict client-generated submission key for a future DB-backed, scoped
 * idempotency claim. This utility ALONE does not deduplicate orders.
 */
export function parseSignaOrderSubmissionKey(raw: unknown): string {
  if (
    typeof raw !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{15,127}$/.test(raw)
  ) {
    throw new Error("Identificador de envio inválido. Revise o pedido e tente novamente.");
  }
  return raw;
}

function canonicalize(value: unknown, depth = 0): unknown {
  if (depth > 20) throw new Error("Pedido excede o limite de estrutura.");
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item, depth + 1));
  }
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, item]) => [key, canonicalize(item, depth + 1)]);
    return Object.fromEntries(entries);
  }
  throw new Error("Pedido possui dados não permitidos.");
}

/**
 * Stable SHA-256 fingerprint of the complete submission body, including fiscal
 * recipient, quantities, payment terms and delivery details. Prevents replay of
 * one submission key with a different payload once persisted in the database.
 * Prices must still be revalidated against the live Signa catalog.
 */
export function hashSignaOrderSubmissionRequest(body: unknown): string {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Pedido inválido.");
  }
  const canonical = JSON.stringify(canonicalize(body));
  if (Buffer.byteLength(canonical, "utf8") > 65536) {
    throw new Error("Pedido excede o tamanho máximo permitido.");
  }
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}
