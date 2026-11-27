// Data de entrega é um dia do calendário (gravada como meia-noite UTC).
// Converter para o horário de Brasília joga o dia para trás (27/11 → 26/11 21h)
// e marcava pedido do dia como "atrasado 1 d". Aqui o dia é lido sem fuso.

const DAY = 86_400_000;

/** "AAAA-MM-DD" da data de entrega, sem conversão de fuso. */
export function deliveryDay(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

/** Hoje em São Paulo, "AAAA-MM-DD". */
export function todayInSaoPaulo(now: number | Date = Date.now()) {
  return new Date(new Date(now).getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}

/** Dias de atraso: 0 no próprio dia da entrega; 1 a partir do dia seguinte. */
export function deliveryDaysLate(value: string | Date | null | undefined, now: number | Date = Date.now()) {
  const day = deliveryDay(value);
  if (!day) return 0;
  return Math.max(0, Math.round((Date.parse(`${todayInSaoPaulo(now)}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / DAY));
}

/** "27/11/2026", sem voltar um dia. */
export function formatDeliveryDate(value: string | Date | null | undefined) {
  const day = deliveryDay(value);
  return day ? `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}` : "";
}
