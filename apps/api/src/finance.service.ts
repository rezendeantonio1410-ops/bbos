import {
  BadRequestException,
  Injectable,
  NotFoundException,
  type OnModuleDestroy,
} from "@nestjs/common";
import {
  FinancialTransactionType,
  PayableStatus,
  Prisma,
  PrismaClient,
  ReceivableStatus,
} from "@bbos/database";

@Injectable()
export class FinanceService implements OnModuleDestroy {
  readonly database = new PrismaClient();
  onModuleDestroy() {
    return this.database.$disconnect();
  }

  async summary(companyId?: string) {
    const [
      accounts,
      receivables,
      payables,
      transactions,
      purchaseInstallments,
    ] = await Promise.all([
      this.database.financialAccount.findMany({ where: { active: true, ...(companyId ? { companyId } : {}) } }),
      this.database.accountsReceivable.findMany({ where: companyId ? { companyId } : undefined }),
      this.database.accountsPayable.findMany({ where: companyId ? { companyId } : undefined }),
      this.database.financialTransaction.findMany({ where: companyId ? { companyId } : undefined,
        orderBy: { occurredAt: "desc" },
        take: 200,
      }),
      this.database.greenCoffeePurchaseInstallment.findMany({
        where: { status: { in: ["PLANNED", "COMMITTED"] }, ...(companyId ? { purchase: { companyId } } : {}) },
        include: {
          purchase: {
            select: {
              purchaseNumber: true,
              approvalStatus: true,
              externalAcceptanceStatus: true,
              supplier: { select: { name: true } },
            },
          },
        },
        orderBy: { dueDate: "asc" },
      }),
    ]);
    const cash =
      accounts.reduce(
        (sum, account) => sum + Number(account.openingBalance),
        0,
      ) +
      transactions.reduce(
        (sum, item) =>
          sum +
          (item.type === FinancialTransactionType.RECEIPT ||
          item.type === FinancialTransactionType.TRANSFER_IN
            ? Number(item.amount)
            : item.type === FinancialTransactionType.PAYMENT ||
                item.type === FinancialTransactionType.TRANSFER_OUT
              ? -Number(item.amount)
              : Number(item.amount)),
        0,
      );
    const overdueReceivables = receivables
      .filter(
        (item) =>
          item.status === ReceivableStatus.OVERDUE ||
          (item.status !== ReceivableStatus.PAID && item.dueDate < new Date()),
      )
      .reduce((sum, item) => sum + Number(item.openAmount), 0);
    const openReceivables = receivables
      .filter(
        (item) =>
          item.status !== ReceivableStatus.CANCELLED &&
          item.status !== ReceivableStatus.PAID,
      )
      .reduce((sum, item) => sum + Number(item.openAmount), 0);
    const openPayables = payables
      .filter(
        (item) =>
          item.status !== PayableStatus.CANCELLED &&
          item.status !== PayableStatus.PAID,
      )
      .reduce((sum, item) => sum + Number(item.openAmount), 0);
    const greenCoffeePurchaseProjection = purchaseInstallments.map((item) => ({
      id: item.id,
      purchaseNumber: item.purchase.purchaseNumber,
      supplier: item.purchase.supplier.name,
      amount: Number(item.amount),
      dueDate: item.dueDate,
      status:
        item.purchase.approvalStatus === "DRAFT"
          ? "RASCUNHO — NÃO COMPROMETE CAIXA"
          : item.status === "PLANNED"
            ? item.purchase.approvalStatus === "APPROVED"
              ? "PREVISTO — AGUARDANDO ACEITE"
              : "PREVISTO — AGUARDANDO APROVAÇÃO"
            : "COMPROMETIDO / PROGRAMADO",
      approvalStatus: item.purchase.approvalStatus,
      externalAcceptanceStatus: item.purchase.externalAcceptanceStatus,
    }));
    const plannedPurchases = purchaseInstallments
      .filter((item) => item.status === "PLANNED" && item.purchase.approvalStatus !== "DRAFT")
      .reduce((sum, item) => sum + Number(item.amount), 0);
    return {
      source: "database",
      cash,
      receivables: openReceivables,
      payables: openPayables,
      plannedPurchases,
      projectedBalance:
        cash + openReceivables - openPayables - plannedPurchases,
      delinquency: overdueReceivables,
      accounts,
      transactions,
      greenCoffeePurchaseProjection,
    };
  }
  listReceivables(companyId?: string) {
    return this.database.accountsReceivable.findMany({
      where: companyId ? { companyId } : undefined,
      include: { customer: true, salesOrder: true, payments: true },
      orderBy: { dueDate: "asc" },
    });
  }
  listPayables(companyId?: string) {
    return this.database.accountsPayable.findMany({
      where: companyId ? { companyId } : undefined,
      include: { supplier: true, costCenter: true, payments: true },
      orderBy: { dueDate: "asc" },
    });
  }
  listAccounts(companyId?: string) {
    return this.database.financialAccount.findMany({
      where: { active: true, ...(companyId ? { companyId } : {}) },
      orderBy: { name: "asc" },
    });
  }
  createAccount(input: {
    companyId: string;
    name: string;
    type: "CASH" | "BANK" | "DIGITAL_ACCOUNT" | "OTHER";
    openingBalance?: number;
  }) {
    return this.database.financialAccount.create({
      data: {
        companyId: input.companyId,
        name: input.name,
        type: input.type,
        openingBalance: input.openingBalance ?? 0,
      },
    });
  }
  createPayable(input: {
    companyId: string;
    supplierId?: string;
    costCenterId?: string;
    description: string;
    issueDate: string;
    dueDate: string;
    amount: number;
    category: string;
    notes?: string;
  }) {
    return this.database.accountsPayable.create({
      data: {
        companyId: input.companyId,
        supplierId: input.supplierId,
        costCenterId: input.costCenterId,
        description: input.description,
        issueDate: new Date(input.issueDate),
        dueDate: new Date(input.dueDate),
        amount: input.amount,
        openAmount: input.amount,
        category: input.category,
        notes: input.notes,
      },
    });
  }

  async receive(
    id: string,
    input: {
      financialAccountId: string;
      amount: number;
      method?: string;
      idempotencyKey: string;
    },
    companyId?: string,
  ) {
    if (input.amount <= 0)
      throw new BadRequestException("Valor recebido deve ser maior que zero.");
    return this.database.$transaction(
      async (tx) => {
        const item = await tx.accountsReceivable.findFirst({ where: { id, ...(companyId ? { companyId } : {}) } });
        if (!item)
          throw new NotFoundException("Conta a receber não encontrada.");
        const existing = await tx.payment.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: { transaction: true },
        });
        if (existing) return { payment: existing, idempotent: true };
        if (input.amount > Number(item.openAmount))
          throw new BadRequestException(
            "Recebimento superior ao valor em aberto.",
          );
        const payment = await tx.payment.create({
          data: {
            companyId: item.companyId,
            accountsReceivableId: id,
            financialAccountId: input.financialAccountId,
            amount: input.amount,
            paidAt: new Date(),
            method: input.method ?? "TRANSFER",
            idempotencyKey: input.idempotencyKey,
          },
        });
        await tx.financialTransaction.create({
          data: {
            companyId: item.companyId,
            financialAccountId: input.financialAccountId,
            paymentId: payment.id,
            type: FinancialTransactionType.RECEIPT,
            amount: input.amount,
            category: "RECEBIMENTO",
            description: "Recebimento de " + item.id,
          },
        });
        const open = Number(item.openAmount) - input.amount;
        await tx.accountsReceivable.update({
          where: { id },
          data: {
            openAmount: open,
            status:
              open === 0
                ? ReceivableStatus.PAID
                : ReceivableStatus.PARTIALLY_PAID,
            paymentDate: open === 0 ? new Date() : undefined,
          },
        });
        return { payment, idempotent: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async pay(
    id: string,
    input: {
      financialAccountId: string;
      amount: number;
      method?: string;
      idempotencyKey: string;
    },
    companyId?: string,
  ) {
    if (input.amount <= 0)
      throw new BadRequestException("Valor pago deve ser maior que zero.");
    return this.database.$transaction(
      async (tx) => {
        const item = await tx.accountsPayable.findFirst({ where: { id, ...(companyId ? { companyId } : {}) } });
        if (!item) throw new NotFoundException("Conta a pagar não encontrada.");
        const existing = await tx.payment.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: { transaction: true },
        });
        if (existing) return { payment: existing, idempotent: true };
        if (input.amount > Number(item.openAmount))
          throw new BadRequestException(
            "Pagamento superior ao valor em aberto.",
          );
        const payment = await tx.payment.create({
          data: {
            companyId: item.companyId,
            accountsPayableId: id,
            financialAccountId: input.financialAccountId,
            amount: input.amount,
            paidAt: new Date(),
            method: input.method ?? "TRANSFER",
            idempotencyKey: input.idempotencyKey,
          },
        });
        await tx.financialTransaction.create({
          data: {
            companyId: item.companyId,
            financialAccountId: input.financialAccountId,
            paymentId: payment.id,
            type: FinancialTransactionType.PAYMENT,
            amount: input.amount,
            category: "PAGAMENTO",
            description: "Pagamento de " + item.id,
          },
        });
        const open = Number(item.openAmount) - input.amount;
        await tx.accountsPayable.update({
          where: { id },
          data: {
            openAmount: open,
            status:
              open === 0 ? PayableStatus.PAID : PayableStatus.PARTIALLY_PAID,
            paymentDate: open === 0 ? new Date() : undefined,
          },
        });
        return { payment, idempotent: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
