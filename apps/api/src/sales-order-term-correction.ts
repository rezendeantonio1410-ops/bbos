/**
 * Post-invoice correction of a mistakenly marked cash order.
 * Keep this separate from draft editing: the NF-e and delivery never change.
 */
export function parseTermCorrection(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Correção de prazo inválida.");
  }
  const value = body as Record<string, unknown>;
  if (Object.keys(value).some(key => !["days", "reason"].includes(key))) {
    throw new Error("Campos não permitidos na correção de prazo.");
  }
  if (value.days !== 14) {
    throw new Error("Esta correção autoriza exclusivamente o prazo de 14 dias.");
  }
  if (typeof value.reason !== "string" || value.reason.trim().length < 10 ||
      value.reason.trim().length > 500) {
    throw new Error("Informe uma justificativa de 10 a 500 caracteres.");
  }
  return { days: 14, reason: value.reason.trim() };
}

export function fourteenDayDueDate(orderedAt: Date): Date {
  if (!(orderedAt instanceof Date) || Number.isNaN(orderedAt.getTime())) {
    throw new Error("Data do pedido inválida.");
  }
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(orderedAt);
  const part = (name: string) => Number(day.find(item => item.type === name)?.value);
  // Midday UTC is inside the same São Paulo calendar day; avoids day rollovers.
  return new Date(Date.UTC(part("year"), part("month") - 1, part("day") + 14, 12));
}
