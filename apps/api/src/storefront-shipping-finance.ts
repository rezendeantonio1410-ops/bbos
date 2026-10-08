import {
  FinancialAccountType,
  FinancialTransactionType,
  PayableStatus,
  Prisma,
} from "@bbos/database";

export const MELHOR_ENVIO_FREIGHT_CATEGORY = "Frete / logística · Melhor Envio";

type FreightOrder = {
  id: string;
  companyId: string;
  code: string;
  shippingProvider?: string | null;
  shippingCents?: number | null;
  providerPriceCents?: number | null;
  paidAt?: Date | string | null;
};

type FreightSettlement = FreightOrder & {
  shipmentId: string;
  externalId?: string | null;
};

const providerKey = (companyId: string) =>
  `shipping-provider:melhor-envio:${companyId}`;
const accountKey = (companyId: string) =>
  `shipping-account:melhor-envio:${companyId}`;
const payableKey = (orderId: string) =>
  `shipping-payable:storefront:${orderId}`;
const allocationKey = (orderId: string) =>
  `shipping-allocation:storefront:${orderId}`;

function cents(value: unknown) {
  const parsed = Math.round(Number(value ?? 0));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function melhorEnvioFreightAmounts(order: FreightOrder) {
  if (String(order.shippingProvider ?? "").toUpperCase() !== "MELHOR_ENVIO")
    return null;
  const collectedCents = cents(order.shippingCents);
  const providerCents = cents(order.providerPriceCents ?? collectedCents);
  if (providerCents <= 0) return null;
  return {
    collectedCents,
    providerCents,
    logisticsResultCents: collectedCents - providerCents,
  };
}

async function ensureMelhorEnvioFinanceEntities(
  transaction: Prisma.TransactionClient,
  companyId: string,
) {
  const institutionId = providerKey(companyId);
  const walletId = accountKey(companyId);
  const supplierId = providerKey(companyId);

  await transaction.financialInstitution.upsert({
    where: { id: institutionId },
    update: { name: "Melhor Envio", code: "MELHOR_ENVIO", active: true },
    create: {
      id: institutionId,
      companyId,
      name: "Melhor Envio",
      code: "MELHOR_ENVIO",
      country: "BR",
      active: true,
    },
  });
  const account = await transaction.financialAccount.upsert({
    where: { id: walletId },
    update: {
      financialInstitutionId: institutionId,
      name: "Fretes recebidos · Melhor Envio",
      active: true,
    },
    create: {
      id: walletId,
      companyId,
      financialInstitutionId: institutionId,
      name: "Fretes recebidos · Melhor Envio",
      type: FinancialAccountType.DIGITAL_ACCOUNT,
      currency: "BRL",
      country: "BR",
      openingBalance: 0,
      active: true,
    },
  });
  const supplier = await transaction.supplier.upsert({
    where: { id: supplierId },
    update: { name: "Melhor Envio", tradeName: "Melhor Envio", active: true },
    create: {
      id: supplierId,
      companyId,
      name: "Melhor Envio",
      tradeName: "Melhor Envio",
      country: "Brasil",
      active: true,
    },
  });
  return { account, supplier };
}

export async function reserveMelhorEnvioFreight(
  transaction: Prisma.TransactionClient,
  order: FreightOrder,
) {
  const amounts = melhorEnvioFreightAmounts(order);
  if (!amounts) return null;
  const { account, supplier } = await ensureMelhorEnvioFinanceEntities(
    transaction,
    order.companyId,
  );
  const occurredAt = order.paidAt ? new Date(order.paidAt) : new Date();
  const payableAmount = amounts.providerCents / 100;
  const collectedAmount = amounts.collectedCents / 100;
  const resultAmount = amounts.logisticsResultCents / 100;

  const payable = await transaction.accountsPayable.upsert({
    where: { id: payableKey(order.id) },
    update: {
      supplierId: supplier.id,
      description: `Frete Melhor Envio · pedido ${order.code}`,
      category: MELHOR_ENVIO_FREIGHT_CATEGORY,
    },
    create: {
      id: payableKey(order.id),
      companyId: order.companyId,
      supplierId: supplier.id,
      description: `Frete Melhor Envio · pedido ${order.code}`,
      issueDate: occurredAt,
      dueDate: occurredAt,
      amount: payableAmount,
      openAmount: payableAmount,
      status: PayableStatus.OPEN,
      category: MELHOR_ENVIO_FREIGHT_CATEGORY,
      notes: `Reserva automática do frete. Recebido do cliente: R$ ${collectedAmount.toFixed(2)}. Custo do provedor: R$ ${payableAmount.toFixed(2)}. Resultado logístico: R$ ${resultAmount.toFixed(2)}.`,
    },
  });

  if (amounts.collectedCents > 0) {
    await transaction.financialTransaction.upsert({
      where: { id: allocationKey(order.id) },
      update: {},
      create: {
        id: allocationKey(order.id),
        companyId: order.companyId,
        financialAccountId: account.id,
        type: FinancialTransactionType.TRANSFER_IN,
        amount: collectedAmount,
        category: "Frete recebido · Melhor Envio",
        description: `Valor de frete reservado · pedido ${order.code}`,
        occurredAt,
      },
    });
  }
  return { account, payable, amounts };
}

export async function settleMelhorEnvioFreight(
  transaction: Prisma.TransactionClient,
  input: FreightSettlement,
) {
  const reservation = await reserveMelhorEnvioFreight(transaction, input);
  if (!reservation) return null;
  const { account, payable } = reservation;
  const amount = Number(payable.amount);
  const idempotencyKey = `shipping-payment:melhor-envio:${input.shipmentId}`;
  const payment = await transaction.payment.upsert({
    where: { idempotencyKey },
    update: {},
    create: {
      id: idempotencyKey,
      companyId: input.companyId,
      accountsPayableId: payable.id,
      financialAccountId: account.id,
      amount,
      paidAt: new Date(),
      method: "MELHOR_ENVIO_WALLET",
      notes: `Etiqueta comprada no Melhor Envio${input.externalId ? ` · remessa ${input.externalId}` : ""}.`,
      idempotencyKey,
    },
  });
  await transaction.financialTransaction.upsert({
    where: { paymentId: payment.id },
    update: {},
    create: {
      id: `shipping-settlement:melhor-envio:${input.shipmentId}`,
      companyId: input.companyId,
      financialAccountId: account.id,
      paymentId: payment.id,
      type: FinancialTransactionType.PAYMENT,
      amount,
      category: MELHOR_ENVIO_FREIGHT_CATEGORY,
      description: `Pagamento do frete · pedido ${input.code}`,
      occurredAt: payment.paidAt,
    },
  });
  await transaction.accountsPayable.update({
    where: { id: payable.id },
    data: {
      openAmount: 0,
      status: PayableStatus.PAID,
      paymentDate: payment.paidAt,
    },
  });
  return { account, payableId: payable.id, payment };
}
