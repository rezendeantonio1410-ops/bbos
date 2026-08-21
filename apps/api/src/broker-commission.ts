import { PayableStatus, Prisma } from "@bbos/database";

export const calculateBrokerCommission = (
  totalValue: number,
  percent: number,
) => Math.round(totalValue * percent) / 100;

export async function ensureBrokerCommissionPayable(
  tx: Prisma.TransactionClient,
  purchase: {
    id: string;
    companyId: string;
    supplierId: string;
    purchasedAt: Date;
    expectedAt: Date | null;
    purchaseNumber: string;
    totalValue: Prisma.Decimal;
    brokerId: string | null;
    brokerCommissionPercent: Prisma.Decimal | null;
    brokerCommissionAmount: Prisma.Decimal | null;
  },
) {
  if (
    !purchase.brokerId ||
    !purchase.brokerCommissionAmount ||
    Number(purchase.brokerCommissionAmount) <= 0
  )
    return null;
  const key = `${purchase.id}:BROKER_COMMISSION`;
  const existing = await tx.accountsPayable.findUnique({
    where: { brokerCommissionPayableKey: key },
  });
  if (existing) return existing;
  return tx.accountsPayable.create({
    data: {
      companyId: purchase.companyId,
      brokerId: purchase.brokerId,
      supplierId: null,
      purchaseId: purchase.id,
      brokerCommissionPayableKey: key,
      description: `${purchase.purchaseNumber} · comissão de corretagem`,
      issueDate: purchase.purchasedAt,
      dueDate: purchase.expectedAt ?? purchase.purchasedAt,
      amount: purchase.brokerCommissionAmount,
      openAmount: purchase.brokerCommissionAmount,
      status: PayableStatus.OPEN,
      category: "CORRETAGEM_CAFE_VERDE",
      notes: `Comissão de ${purchase.brokerCommissionPercent ?? 0}% sobre ${purchase.totalValue}`,
    },
  });
}
