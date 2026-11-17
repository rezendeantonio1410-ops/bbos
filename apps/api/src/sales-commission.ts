import {
  PayableStatus,
  Prisma,
  ReceivableStatus,
  SalesOrderStatus,
} from "@bbos/database";

const SALES_COMMISSION_CATEGORY = "COMISSAO_VENDA";

export function nextSalesCommissionPaymentDate(paidAt: Date) {
  return new Date(
    Date.UTC(paidAt.getUTCFullYear(), paidAt.getUTCMonth() + 1, 2, 12, 0, 0, 0),
  );
}

export function salesCommissionPayableKey(salesOrderId: string) {
  return `sales-order:${salesOrderId}:broker-commission`;
}

type ReleaseSalesCommissionInput = {
  salesOrderId: string;
  paidAt: Date;
  paymentConfirmed?: boolean;
};

export async function releaseSalesCommission(
  transaction: Prisma.TransactionClient,
  input: ReleaseSalesCommissionInput,
) {
  const order = await transaction.salesOrder.findUnique({
    where: { id: input.salesOrderId },
    select: {
      id: true,
      companyId: true,
      orderNumber: true,
      code: true,
      orderType: true,
      status: true,
      brokerId: true,
      brokerCommissionMode: true,
      brokerCommissionPercent: true,
      brokerCommissionPerPackage: true,
      brokerCommissionAmount: true,
      broker: {
        select: { businessPartnerId: true },
      },
      accountsReceivable: {
        select: { status: true, openAmount: true },
        take: 1,
      },
    },
  });
  if (!order) return { released: false, reason: "ORDER_NOT_FOUND" } as const;
  if (
    order.orderType === "SAMPLE" ||
    order.status === SalesOrderStatus.CANCELLED ||
    !order.brokerId ||
    Number(order.brokerCommissionAmount ?? 0) <= 0
  ) {
    return { released: false, reason: "NOT_ELIGIBLE" } as const;
  }

  const receivable = order.accountsReceivable[0];
  const receivablePaid =
    receivable?.status === ReceivableStatus.PAID &&
    Number(receivable.openAmount) <= 0;
  if (!receivablePaid && !input.paymentConfirmed) {
    return { released: false, reason: "CUSTOMER_NOT_PAID" } as const;
  }

  const payableKey = salesCommissionPayableKey(order.id);
  const existing = await transaction.accountsPayable.findUnique({
    where: { brokerCommissionPayableKey: payableKey },
  });
  if (existing) {
    return {
      released: existing.status !== PayableStatus.CANCELLED,
      idempotent: true,
      payable: existing,
    } as const;
  }

  const amount = order.brokerCommissionAmount!;
  const dueDate = nextSalesCommissionPaymentDate(input.paidAt);
  const commissionRule =
    order.brokerCommissionMode === "PER_PACKAGE"
      ? `R$ ${Number(order.brokerCommissionPerPackage ?? 0)
          .toFixed(2)
          .replace(".", ",")} por pacote vendido`
      : `${Number(order.brokerCommissionPercent ?? 0)
          .toFixed(2)
          .replace(".", ",")}% sobre os produtos do pedido`;
  const payable = await transaction.accountsPayable.create({
    data: {
      companyId: order.companyId,
      brokerId: order.brokerId,
      storefrontPartnerId: order.broker?.businessPartnerId ?? null,
      supplierId: null,
      brokerCommissionPayableKey: payableKey,
      description: `${order.orderNumber ?? order.code} · comissão de venda`,
      issueDate: input.paidAt,
      competenceDate: input.paidAt,
      dueDate,
      amount,
      openAmount: amount,
      status: PayableStatus.OPEN,
      category: SALES_COMMISSION_CATEGORY,
      source: "SALES_ORDER_SETTLEMENT",
      notes: `Comissão liberada após a quitação integral do cliente. Regra: ${commissionRule}. Pagamento programado para o dia 02 do mês seguinte.`,
    },
  });
  return { released: true, idempotent: false, payable } as const;
}

export async function cancelOpenSalesCommission(
  transaction: Prisma.TransactionClient,
  salesOrderId: string,
  reason: string,
) {
  const payable = await transaction.accountsPayable.findUnique({
    where: {
      brokerCommissionPayableKey: salesCommissionPayableKey(salesOrderId),
    },
  });
  if (!payable || payable.status === PayableStatus.CANCELLED)
    return { cancelled: false, idempotent: true } as const;
  if (
    payable.status === PayableStatus.PAID ||
    Number(payable.openAmount) <= 0
  ) {
    return { cancelled: false, requiresReversal: true } as const;
  }
  await transaction.accountsPayable.update({
    where: { id: payable.id },
    data: {
      status: PayableStatus.CANCELLED,
      openAmount: 0,
      notes: [payable.notes, `Cancelada: ${reason}`].filter(Boolean).join("\n"),
    },
  });
  return { cancelled: true, idempotent: false } as const;
}
