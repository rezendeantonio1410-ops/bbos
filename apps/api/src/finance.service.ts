import { BadRequestException, Injectable, NotFoundException, type OnModuleDestroy } from "@nestjs/common";
import { FinancialTransactionType, PayableStatus, Prisma, PrismaClient, ReceivableStatus } from "@bbos/database";

@Injectable()
export class FinanceService implements OnModuleDestroy {
  readonly database = new PrismaClient();
  onModuleDestroy() { return this.database.$disconnect(); }

  async summary() {
    const [accounts, receivables, payables, transactions] = await Promise.all([
      this.database.financialAccount.findMany({ where: { active: true } }),
      this.database.accountsReceivable.findMany(),
      this.database.accountsPayable.findMany(),
      this.database.financialTransaction.findMany({ orderBy: { occurredAt: "desc" }, take: 200 }),
    ]);
    const cash = accounts.reduce((sum, account) => sum + Number(account.openingBalance), 0) + transactions.reduce((sum, item) => sum + (item.type === FinancialTransactionType.RECEIPT || item.type === FinancialTransactionType.TRANSFER_IN ? Number(item.amount) : item.type === FinancialTransactionType.PAYMENT || item.type === FinancialTransactionType.TRANSFER_OUT ? -Number(item.amount) : Number(item.amount)), 0);
    const overdueReceivables = receivables.filter((item) => item.status === ReceivableStatus.OVERDUE || (item.status !== ReceivableStatus.PAID && item.dueDate < new Date())).reduce((sum, item) => sum + Number(item.openAmount), 0);
    const openReceivables = receivables.filter((item) => item.status !== ReceivableStatus.CANCELLED && item.status !== ReceivableStatus.PAID).reduce((sum, item) => sum + Number(item.openAmount), 0);
    const openPayables = payables.filter((item) => item.status !== PayableStatus.CANCELLED && item.status !== PayableStatus.PAID).reduce((sum, item) => sum + Number(item.openAmount), 0);
    return { source: "database", cash, receivables: openReceivables, payables: openPayables, projectedBalance: cash + openReceivables - openPayables, delinquency: overdueReceivables, accounts, transactions };
  }
  listReceivables() { return this.database.accountsReceivable.findMany({ include: { customer: true, salesOrder: true, payments: true }, orderBy: { dueDate: "asc" } }); }
  listPayables() { return this.database.accountsPayable.findMany({ include: { supplier: true, costCenter: true, payments: true }, orderBy: { dueDate: "asc" } }); }
  listAccounts() { return this.database.financialAccount.findMany({ where: { active: true }, orderBy: { name: "asc" } }); }
  createAccount(input: { companyId: string; name: string; type: "CASH" | "BANK" | "DIGITAL_ACCOUNT" | "OTHER"; openingBalance?: number }) { return this.database.financialAccount.create({ data: { companyId: input.companyId, name: input.name, type: input.type, openingBalance: input.openingBalance ?? 0 } }); }
  createPayable(input: { companyId: string; supplierId?: string; costCenterId?: string; description: string; issueDate: string; dueDate: string; amount: number; category: string; notes?: string }) { return this.database.accountsPayable.create({ data: { companyId: input.companyId, supplierId: input.supplierId, costCenterId: input.costCenterId, description: input.description, issueDate: new Date(input.issueDate), dueDate: new Date(input.dueDate), amount: input.amount, openAmount: input.amount, category: input.category, notes: input.notes } }); }

  async receive(id: string, input: { financialAccountId: string; amount: number; method?: string; idempotencyKey: string }) {
    if (input.amount <= 0) throw new BadRequestException("Valor recebido deve ser maior que zero.");
    return this.database.$transaction(async (tx) => {
      const item = await tx.accountsReceivable.findUnique({ where: { id } });
      if (!item) throw new NotFoundException("Conta a receber não encontrada.");
      const existing = await tx.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { transaction: true } });
      if (existing) return { payment: existing, idempotent: true };
      if (input.amount > Number(item.openAmount)) throw new BadRequestException("Recebimento superior ao valor em aberto.");
      const payment = await tx.payment.create({ data: { companyId: item.companyId, accountsReceivableId: id, financialAccountId: input.financialAccountId, amount: input.amount, paidAt: new Date(), method: input.method ?? "TRANSFER", idempotencyKey: input.idempotencyKey } });
      await tx.financialTransaction.create({ data: { companyId: item.companyId, financialAccountId: input.financialAccountId, paymentId: payment.id, type: FinancialTransactionType.RECEIPT, amount: input.amount, category: "RECEBIMENTO", description: "Recebimento de " + item.id } });
      const open = Number(item.openAmount) - input.amount;
      await tx.accountsReceivable.update({ where: { id }, data: { openAmount: open, status: open === 0 ? ReceivableStatus.PAID : ReceivableStatus.PARTIALLY_PAID, paymentDate: open === 0 ? new Date() : undefined } });
      return { payment, idempotent: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async pay(id: string, input: { financialAccountId: string; amount: number; method?: string; idempotencyKey: string }) {
    if (input.amount <= 0) throw new BadRequestException("Valor pago deve ser maior que zero.");
    return this.database.$transaction(async (tx) => {
      const item = await tx.accountsPayable.findUnique({ where: { id } });
      if (!item) throw new NotFoundException("Conta a pagar não encontrada.");
      const existing = await tx.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { transaction: true } });
      if (existing) return { payment: existing, idempotent: true };
      if (input.amount > Number(item.openAmount)) throw new BadRequestException("Pagamento superior ao valor em aberto.");
      const payment = await tx.payment.create({ data: { companyId: item.companyId, accountsPayableId: id, financialAccountId: input.financialAccountId, amount: input.amount, paidAt: new Date(), method: input.method ?? "TRANSFER", idempotencyKey: input.idempotencyKey } });
      await tx.financialTransaction.create({ data: { companyId: item.companyId, financialAccountId: input.financialAccountId, paymentId: payment.id, type: FinancialTransactionType.PAYMENT, amount: input.amount, category: "PAGAMENTO", description: "Pagamento de " + item.id } });
      const open = Number(item.openAmount) - input.amount;
      await tx.accountsPayable.update({ where: { id }, data: { openAmount: open, status: open === 0 ? PayableStatus.PAID : PayableStatus.PARTIALLY_PAID, paymentDate: open === 0 ? new Date() : undefined } });
      return { payment, idempotent: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
