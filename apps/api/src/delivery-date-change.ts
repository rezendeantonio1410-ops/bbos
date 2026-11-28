/**
 * Remarcar a entrega de um pedido já confirmado (data combinada errada ou
 * nova data com o cliente). Só a data prevista muda; fica no histórico.
 */
const MAX_DAYS_AHEAD = 120;

function saoPauloToday(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (name: string) => Number(parts.find((item) => item.type === name)?.value);
  return Date.UTC(part("year"), part("month") - 1, part("day"));
}

export function parseDeliveryDateChange(body: unknown, now = new Date()) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Alteração de entrega inválida.");
  const value = body as Record<string, unknown>;
  if (Object.keys(value).some((key) => !["deliveryDate", "reason"].includes(key))) throw new Error("Campos não permitidos na alteração de entrega.");
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value.deliveryDate ?? ""));
  if (!match) throw new Error("Informe a nova data de entrega.");
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  // Data "só dia", à meia-noite UTC, como as demais datas de entrega do BBOS.
  const deliveryDate = new Date(Date.UTC(year, month - 1, day));
  if (deliveryDate.getUTCFullYear() !== year || deliveryDate.getUTCMonth() !== month - 1 || deliveryDate.getUTCDate() !== day) throw new Error("Data de entrega inválida.");
  const today = saoPauloToday(now);
  if (deliveryDate.getTime() < today) throw new Error("A nova data de entrega não pode ser no passado.");
  if (deliveryDate.getTime() > today + MAX_DAYS_AHEAD * 86_400_000) throw new Error(`A nova data pode ser no máximo ${MAX_DAYS_AHEAD} dias à frente.`);
  const reason = typeof value.reason === "string" ? value.reason.trim().replace(/\s+/g, " ") : "";
  if (reason.length < 10 || reason.length > 500) throw new Error("Informe o motivo da nova data (10 a 500 caracteres).");
  return { deliveryDate, reason };
}

/** Pedidos que ainda não saíram: dá para remarcar a entrega. */
export const RESCHEDULABLE_DELIVERY = ["DRAFT", "CONFIRMED", "RESERVED", "PICKING", "IN_PRODUCTION", "READY_TO_SHIP", "INVOICED"] as const;
