/**
 * Accounts payable planned from an inbound NF-e: one per "duplicata" (dup),
 * or a single one due on the issue date when the note has no installments.
 */
export type InboundPaymentSnapshot = Array<{ number?: string | null; dueDate?: string | null; amount?: number | string | null }>;

export type PlannedInboundPayable = { key: string; number: string; dueDate: string; amount: number };

export function planInboundPayables(document: {
  id: string;
  number?: string | null;
  issueDate?: Date | string | null;
  totalAmount?: number | string | null;
  paymentSnapshot?: InboundPaymentSnapshot | null;
}): PlannedInboundPayable[] {
  const issue = document.issueDate ? new Date(document.issueDate).toISOString().slice(0, 10) : null;
  const installments = (Array.isArray(document.paymentSnapshot) ? document.paymentSnapshot : [])
    .map((item) => ({ number: String(item.number ?? "").trim(), dueDate: String(item.dueDate ?? "").slice(0, 10), amount: Math.round(Number(item.amount ?? 0) * 100) / 100 }))
    .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate) && item.amount > 0);
  if (installments.length)
    return installments.map((item, index) => ({
      key: `nfe-in:${document.id}:${index + 1}`,
      number: item.number || String(index + 1).padStart(3, "0"),
      dueDate: item.dueDate,
      amount: item.amount,
    }));
  const total = Math.round(Number(document.totalAmount ?? 0) * 100) / 100;
  if (!issue || total <= 0) return [];
  return [{ key: `nfe-in:${document.id}:1`, number: "001", dueDate: issue, amount: total }];
}
