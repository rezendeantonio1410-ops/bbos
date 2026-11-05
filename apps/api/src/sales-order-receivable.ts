import type { PrismaClient } from "@bbos/database";

type ReceivableDatabase = Pick<
  PrismaClient,
  "salesOrder" | "accountsReceivable"
>;

export function resolveSalesOrderDueDate(
  issueDate: Date,
  paymentTerms?: string | null,
) {
  const firstTerm = String(paymentTerms ?? "").match(/\b(\d{1,3})\b/);
  const days = Math.min(
    365,
    Math.max(1, firstTerm ? Number(firstTerm[1]) : 30),
  );
  const dueDate = new Date(issueDate);
  dueDate.setUTCDate(dueDate.getUTCDate() + days);
  return dueDate;
}

/**
 * Keeps the financial title aligned with an authorized NF-e. The unique
 * salesOrderId constraint makes retries and Bling reconciliation idempotent.
 */
export async function ensureSalesOrderReceivable(
  database: ReceivableDatabase,
  salesOrderId: string,
  invoiceNumber?: string | null,
) {
  const order = await database.salesOrder.findUnique({
    where: { id: salesOrderId },
    select: {
      id: true,
      companyId: true,
      customerId: true,
      orderType: true,
      paymentType: true,
      paymentTermsSnapshot: true,
      totalAmount: true,
      invoicedAt: true,
    },
  });
  if (!order || order.orderType === "SAMPLE" || order.paymentType !== "TERM") {
    return null;
  }

  const issueDate = order.invoicedAt ?? new Date();
  const invoiceId = String(invoiceNumber ?? "").trim() || null;
  return database.accountsReceivable.upsert({
    where: { salesOrderId: order.id },
    create: {
      companyId: order.companyId,
      customerId: order.customerId,
      salesOrderId: order.id,
      invoiceId,
      issueDate,
      dueDate: resolveSalesOrderDueDate(issueDate, order.paymentTermsSnapshot),
      amount: order.totalAmount,
      openAmount: order.totalAmount,
      status: "OPEN",
      notes: "Título criado automaticamente após autorização da NF-e.",
    },
    update: invoiceId ? { invoiceId } : {},
  });
}
