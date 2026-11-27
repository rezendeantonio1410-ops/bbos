/**
 * Nova data de vencimento combinada com o cliente (renegociação).
 * Só a data muda: valor, NF-e, entrega e pagamentos já registrados ficam iguais.
 */
const MAX_DAYS_AHEAD = 180;

function saoPauloToday(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (name: string) => Number(parts.find((item) => item.type === name)?.value);
  return Date.UTC(part("year"), part("month") - 1, part("day"), 12);
}

export function parseDueDateChange(body: unknown, now = new Date()) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Alteração de vencimento inválida.");
  const value = body as Record<string, unknown>;
  if (Object.keys(value).some((key) => !["dueDate", "reason"].includes(key))) throw new Error("Campos não permitidos na alteração de vencimento.");
  const raw = String(value.dueDate ?? "");
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) throw new Error("Informe a nova data de vencimento.");
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  // Meio-dia UTC cai no mesmo dia em São Paulo, como os demais vencimentos.
  const dueDate = new Date(Date.UTC(year, month - 1, day, 12));
  if (dueDate.getUTCFullYear() !== year || dueDate.getUTCMonth() !== month - 1 || dueDate.getUTCDate() !== day) throw new Error("Data de vencimento inválida.");
  const today = saoPauloToday(now);
  if (dueDate.getTime() < today) throw new Error("A nova data não pode ser no passado.");
  if (dueDate.getTime() > today + MAX_DAYS_AHEAD * 86_400_000) throw new Error(`A nova data pode ser no máximo ${MAX_DAYS_AHEAD} dias à frente.`);
  const reason = typeof value.reason === "string" ? value.reason.trim().replace(/\s+/g, " ") : "";
  if (reason.length < 10 || reason.length > 500) throw new Error("Informe o motivo da nova data (10 a 500 caracteres).");
  return { dueDate, reason };
}

export const RESCHEDULABLE_RECEIVABLE = ["OPEN", "OVERDUE", "PARTIALLY_PAID"] as const;
