import {
  FinancialAccountType,
  FinancialTransactionType,
  Prisma,
  ReceivableStatus,
} from "@bbos/database";

export const STOREFRONT_PAYMENT_SOURCE = "STOREFRONT_MERCADO_PAGO";

type PaidStorefrontOrder = {
  salesOrderId: string;
  storefrontOrderId: string;
  paymentAttemptId: string;
  companyId: string;
  customerId: string;
  orderCode: string;
  provider: string;
  method: string;
  externalId?: string | null;
  amountCents: number;
  orderTotal: number;
  paidAt: Date | string;
};

const providerInstitutionId = (companyId: string) =>
  `payment-provider:mercado-pago:${companyId}`;
const providerAccountId = (companyId: string) =>
  `payment-account:mercado-pago:${companyId}`;

export async function recordPaidStorefrontOrder(
  transaction: Prisma.TransactionClient,
  input: PaidStorefrontOrder,
) {
  if (input.provider !== "MERCADO_PAGO") return null;
  const amount = Math.round(Number(input.amountCents)) / 100;
  const orderTotal = Math.round(Number(input.orderTotal) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0 || amount !== orderTotal) {
    throw new Error(
      `Pagamento da Loja Bispo divergente do pedido ${input.orderCode}.`,
    );
  }

  const institutionId = providerInstitutionId(input.companyId);
  const accountId = providerAccountId(input.companyId);
  const paidAt = new Date(input.paidAt);
  const idempotencyKey = `storefront-payment:${input.paymentAttemptId}`;

  await transaction.financialInstitution.upsert({
    where: { id: institutionId },
    update: { name: "Mercado Pago", code: "MERCADO_PAGO", active: true },
    create: {
      id: institutionId,
      companyId: input.companyId,
      name: "Mercado Pago",
      code: "MERCADO_PAGO",
      country: "BR",
      active: true,
    },
  });
  const account = await transaction.financialAccount.upsert({
    where: { id: accountId },
    update: {
      financialInstitutionId: institutionId,
      name: "Recebimentos · Mercado Pago",
      active: true,
    },
    create: {
      id: accountId,
      companyId: input.companyId,
      financialInstitutionId: institutionId,
      name: "Recebimentos · Mercado Pago",
      type: FinancialAccountType.DIGITAL_ACCOUNT,
      currency: "BRL",
      country: "BR",
      openingBalance: 0,
      active: true,
    },
  });

  const receivable = await transaction.accountsReceivable.upsert({
    where: { salesOrderId: input.salesOrderId },
    update: {},
    create: {
      companyId: input.companyId,
      customerId: input.customerId,
      salesOrderId: input.salesOrderId,
      issueDate: paidAt,
      dueDate: paidAt,
      amount,
      openAmount: amount,
      status: ReceivableStatus.OPEN,
      notes: `Pagamento online da Loja Bispo · pedido ${input.orderCode}.`,
    },
  });
  const existingPayment = await transaction.payment.findFirst({
    where: { accountsReceivableId: receivable.id },
  });
  if (existingPayment) {
    return {
      receivableId: receivable.id,
      paymentId: existingPayment.id,
      idempotent: true,
    };
  }

  const payment = await transaction.payment.upsert({
    where: { idempotencyKey },
    update: {},
    create: {
      companyId: input.companyId,
      accountsReceivableId: receivable.id,
      financialAccountId: account.id,
      amount,
      paidAt,
      method: input.method,
      source: STOREFRONT_PAYMENT_SOURCE,
      reference: input.externalId ?? input.storefrontOrderId,
      notes: `Pagamento ${input.method} confirmado pelo Mercado Pago para o pedido ${input.orderCode}.`,
      idempotencyKey,
    },
  });
  await transaction.financialTransaction.upsert({
    where: { paymentId: payment.id },
    update: {},
    create: {
      companyId: input.companyId,
      financialAccountId: account.id,
      paymentId: payment.id,
      type: FinancialTransactionType.RECEIPT,
      amount,
      category: "Venda online · Loja Bispo",
      description: `Recebimento do pedido ${input.orderCode} via Mercado Pago`,
      occurredAt: paidAt,
    },
  });
  await transaction.accountsReceivable.update({
    where: { id: receivable.id },
    data: {
      openAmount: 0,
      status: ReceivableStatus.PAID,
      paymentDate: paidAt,
    },
  });
  return {
    receivableId: receivable.id,
    paymentId: payment.id,
    idempotent: false,
  };
}
