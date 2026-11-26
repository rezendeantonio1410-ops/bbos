// Situação do recebimento de um pedido ainda não pago, para a coluna "Pagamento".
export type OrderPaymentDue = {
  label: string;
  tone: "overdue" | "today" | "upcoming";
};

function utcDay(value: Date) {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function localDay(value: Date) {
  return Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
}

export function orderPaymentDue(
  dueDate: string | null | undefined,
  now = new Date(),
): OrderPaymentDue | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return null;
  // O vencimento é gravado como data (meia-noite UTC); "hoje" é o dia local.
  const days = Math.round((utcDay(due) - localDay(now)) / 86_400_000);
  const date = due.toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  if (days < 0) return { label: `Vencido ${date}`, tone: "overdue" };
  if (days === 0) return { label: `Vence hoje`, tone: "today" };
  return { label: `Vence ${date}`, tone: "upcoming" };
}
