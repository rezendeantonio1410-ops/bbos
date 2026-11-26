/**
 * Regras do fluxo de compra de etiqueta no Melhor Envio (auditoria 26/11):
 * nunca pagar de novo uma etiqueta já paga, nunca comprar com preço diferente
 * do cotado sem conferência, e só repetir chamadas que podem ser repetidas.
 */

/** Status do Melhor Envio em que a etiqueta já foi paga. */
export const ME_PAID = new Set(["released", "paid", "generated", "posted", "delivered", "undelivered", "paused", "suspended", "returned"]);
/** Status em que a etiqueta já foi gerada (o PDF pode ser impresso). */
export const ME_GENERATED = new Set(["generated", "posted", "delivered", "undelivered", "paused", "suspended", "returned"]);

export type RemoteOrder = { status: string; priceCents: number };

export function readRemoteOrder(details: any): RemoteOrder | null {
  if (!details || typeof details !== "object") return null;
  const status = String(details.status ?? "").trim().toLowerCase();
  const price = Number(details.price ?? details.custom_price ?? 0);
  if (!status && !price) return null;
  return { status, priceCents: Number.isFinite(price) ? Math.round(price * 100) : 0 };
}

/**
 * O que fazer antes de pagar: pular (já pago), parar (preço mudou e ainda não
 * foi pago) ou pagar. Sem resposta do Melhor Envio, segue para o pagamento —
 * o próprio Melhor Envio recusa pagar duas vezes.
 */
export function checkoutDecision(remote: RemoteOrder | null, expectedCents: number | null): "SKIP" | "PRICE_CHANGED" | "CHECKOUT" {
  if (remote && ME_PAID.has(remote.status)) return "SKIP";
  if (remote && expectedCents && remote.priceCents > 0 && remote.priceCents !== expectedCents) return "PRICE_CHANGED";
  return "CHECKOUT";
}

/** Só leitura e impressão podem ser repetidas; compra/pagamento/geração não. */
export function retryable(method: string, path: string) {
  return method.toUpperCase() === "GET" || path === "/me/shipment/tracking" || path === "/me/shipment/print";
}

export function transientStatus(status: number) {
  return status === 429 || status >= 500;
}

/** Renova a chave antes de vencer, mesmo sem envios no período. */
export function tokenNeedsRefresh(expiresAt: Date | string | null | undefined, now = Date.now(), marginDays = 1) {
  const time = expiresAt ? new Date(expiresAt).getTime() : 0;
  return !Number.isFinite(time) || time <= now + marginDays * 86_400_000;
}
