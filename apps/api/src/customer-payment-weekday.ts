/** Dia fixo de pagamento do cliente: 0 = domingo … 6 = sábado, ou nenhum. */
export const WEEKDAY_LABEL = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"] as const;

export function parsePaymentWeekday(body: unknown): number | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Dia de pagamento inválido.");
  const value = (body as Record<string, unknown>).weekday;
  if (value === null || value === "" || value === undefined) return null;
  const weekday = Number(value);
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw new Error("Escolha um dia da semana válido.");
  return weekday;
}

/** Mesma regra do gatilho do banco: empurra para o próximo dia permitido. */
export function nextPaymentDay(date: Date, weekday: number | null) {
  if (weekday === null) return date;
  const local = new Date(date.getTime() - 3 * 3_600_000);
  const shift = (weekday - local.getUTCDay() + 7) % 7;
  return new Date(date.getTime() + shift * 86_400_000);
}
