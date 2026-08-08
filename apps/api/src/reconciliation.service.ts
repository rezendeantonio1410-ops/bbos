import { BadRequestException, Injectable, NotFoundException, type OnModuleDestroy } from "@nestjs/common";
import { PrismaClient, ReconciliationDirection, ReconciliationStatus } from "@bbos/database";
import { bankTransactionDirection, evaluateReconciliationMatch, financialTransactionDirection } from "@bbos/shared";

type ReconciliationQuery = { status?: ReconciliationStatus; direction?: ReconciliationDirection; from?: string; to?: string; companyId?: string; financialAccountId?: string; currency?: string };
type CreateInput = { companyId: string; financialAccountId?: string; occurredAt: string; description: string; documentReference?: string; counterpartyName?: string; customerId?: string; supplierId?: string; direction: ReconciliationDirection; amount: number; currency?: string; notes?: string };
type BankTransactionInput = { companyId: string; financialAccountId: string; externalId?: string; transactionDate: string; postingDate?: string; description: string; reference?: string; counterparty?: string; direction: "CREDIT" | "DEBIT"; amount: number; currency: string; balanceAfter?: number; source: "MANUAL" | "CSV" | "OFX" | "API" | "OPEN_BANKING" | "OTHER"; rawMetadata?: unknown };

@Injectable()
export class ReconciliationService implements OnModuleDestroy {
  readonly database = new PrismaClient();
  onModuleDestroy() { return this.database.$disconnect(); }

  async list(query: ReconciliationQuery = {}) {
    return this.database.reconciliationItem.findMany({
      where: { companyId: query.companyId, financialAccountId: query.financialAccountId, currency: query.currency, status: query.status, direction: query.direction, occurredAt: { gte: query.from ? new Date(query.from) : undefined, lte: query.to ? new Date(query.to) : undefined } },
      include: { financialAccount: { include: { financialInstitution: true } }, financialTransaction: true, bankTransaction: true, customer: true, supplier: true, events: { orderBy: { createdAt: "desc" } } },
      orderBy: { occurredAt: "desc" },
    });
  }

  async summary(query: Pick<ReconciliationQuery, "companyId" | "from" | "to"> = {}) {
    const items = await this.list(query);
    const byCurrency = Object.values(items.reduce<Record<string, { currency: string; totalMovimentado: number; conciliado: number; pendente: number; divergente: number; quantidade: number }>>((acc, item) => {
      const currency = item.currency || "BRL";
      const entry = acc[currency] ?? (acc[currency] = { currency, totalMovimentado: 0, conciliado: 0, pendente: 0, divergente: 0, quantidade: 0 });
      entry.totalMovimentado += Number(item.amount);
      entry.quantidade += 1;
      if (item.status === "MATCHED" || item.status === "PARTIALLY_MATCHED") entry.conciliado += Number(item.matchedAmount);
      if (item.status === "PENDING") entry.pendente += 1;
      if (item.status === "DIVERGENT") entry.divergente += 1;
      return acc;
    }, {}));
    const onlyCurrency = byCurrency.length === 1 ? byCurrency[0] : undefined;
    const total = onlyCurrency?.totalMovimentado ?? 0;
    const reconciled = onlyCurrency?.conciliado ?? 0;
    const countByStatus = (status: ReconciliationStatus) => items.filter((item) => item.status === status).length;
    return { totalMovimentado: total, conciliado: reconciled, moedasMistas: byCurrency.length > 1, porMoeda: byCurrency, pendente: countByStatus("PENDING"), divergente: countByStatus("DIVERGENT"), parcialmenteConciliado: countByStatus("PARTIALLY_MATCHED"), ignorado: countByStatus("IGNORED"), percentualConciliado: total ? Number(((reconciled / total) * 100).toFixed(2)) : 0, quantidade: items.length };
  }

  async create(input: CreateInput) {
    if (!input.companyId || input.amount <= 0) throw new BadRequestException("Empresa e valor positivo são obrigatórios.");
    return this.database.$transaction(async (tx) => {
      const account = input.financialAccountId ? await tx.financialAccount.findFirst({ where: { id: input.financialAccountId, companyId: input.companyId, active: true } }) : null;
      if (input.financialAccountId && !account) throw new BadRequestException("Conta financeira inválida para a empresa.");
      const currency = (input.currency ?? account?.currency ?? "BRL").toUpperCase();
      if (account && account.currency.toUpperCase() !== currency) throw new BadRequestException("A moeda do item deve ser a mesma da conta financeira.");
      const item = await tx.reconciliationItem.create({ data: { companyId: input.companyId, financialAccountId: input.financialAccountId, occurredAt: new Date(input.occurredAt), description: input.description, documentReference: input.documentReference, counterpartyName: input.counterpartyName, customerId: input.customerId, supplierId: input.supplierId, direction: input.direction, amount: input.amount, currency, difference: input.amount, notes: input.notes } });
      await tx.reconciliationEvent.create({ data: { companyId: input.companyId, reconciliationItemId: item.id, statusTo: "PENDING", matchedAmount: 0, difference: input.amount, action: "CREATED" } });
      return item;
    });
  }

  async accounts(companyId?: string) {
    return this.database.financialAccount.findMany({ where: { companyId, active: true }, include: { financialInstitution: true }, orderBy: [{ currency: "asc" }, { name: "asc" }] });
  }

  async institutions(companyId?: string) {
    return this.database.financialInstitution.findMany({ where: { companyId, active: true }, include: { accounts: { where: { active: true } } }, orderBy: { name: "asc" } });
  }

  async bankTransactions(query: { companyId?: string; financialAccountId?: string; currency?: string; status?: ReconciliationStatus } = {}) {
    return this.database.bankTransaction.findMany({ where: { companyId: query.companyId, financialAccountId: query.financialAccountId, currency: query.currency, reconciliationStatus: query.status }, include: { financialAccount: { include: { financialInstitution: true } }, reconciliationItem: true }, orderBy: { transactionDate: "desc" } });
  }

  async importBankTransaction(input: BankTransactionInput) {
    if (input.amount <= 0) throw new BadRequestException("O valor da movimentação deve ser positivo.");
    return this.database.$transaction(async (tx) => {
      const account = await tx.financialAccount.findFirst({ where: { id: input.financialAccountId, companyId: input.companyId, active: true } });
      if (!account) throw new BadRequestException("Conta financeira inválida para a empresa.");
      if (account.currency.toUpperCase() !== input.currency.toUpperCase()) throw new BadRequestException("A moeda da movimentação não corresponde à conta.");
      const existing = input.externalId ? await tx.bankTransaction.findUnique({ where: { financialAccountId_externalId: { financialAccountId: input.financialAccountId, externalId: input.externalId } }, include: { reconciliationItem: true } }) : null;
      if (existing) return { transaction: existing, idempotent: true };
      const transaction = await tx.bankTransaction.create({ data: { companyId: input.companyId, financialAccountId: input.financialAccountId, externalId: input.externalId, transactionDate: new Date(input.transactionDate), postingDate: input.postingDate ? new Date(input.postingDate) : undefined, description: input.description, reference: input.reference, counterparty: input.counterparty, direction: input.direction, amount: input.amount, currency: input.currency.toUpperCase(), balanceAfter: input.balanceAfter, source: input.source, rawMetadata: input.rawMetadata as object | undefined } });
      const item = await tx.reconciliationItem.create({ data: { companyId: input.companyId, financialAccountId: input.financialAccountId, bankTransactionId: transaction.id, occurredAt: transaction.transactionDate, description: transaction.description, documentReference: transaction.reference, counterpartyName: transaction.counterparty, direction: bankTransactionDirection(transaction.direction), amount: transaction.amount, currency: transaction.currency, difference: transaction.amount } });
      await tx.reconciliationEvent.create({ data: { companyId: input.companyId, reconciliationItemId: item.id, statusTo: "PENDING", matchedAmount: 0, difference: transaction.amount, action: "IMPORTED" } });
      return { transaction, item, idempotent: false };
    });
  }

  async match(id: string, financialTransactionId: string, matchedAmount?: number) {
    return this.database.$transaction(async (tx) => {
      const item = await tx.reconciliationItem.findUnique({ where: { id }, include: { financialTransaction: true } });
      if (!item) throw new NotFoundException("Item de conciliação não encontrado.");
      if (item.financialTransactionId === financialTransactionId) return { item, idempotent: true };
      if (item.financialTransactionId) throw new BadRequestException("Este item já está conciliado com outro lançamento.");
      const transaction = await tx.financialTransaction.findUnique({ where: { id: financialTransactionId }, include: { payment: { include: { accountsReceivable: { include: { customer: true } }, accountsPayable: { include: { supplier: true } } } } } });
      if (!transaction) throw new NotFoundException("Lançamento financeiro não encontrado.");
      const linked = await tx.reconciliationItem.findUnique({ where: { financialTransactionId } });
      if (linked) throw new BadRequestException("Este lançamento já está vinculado a outro item de conciliação.");
      if (transaction.companyId !== item.companyId) throw new BadRequestException("Item e lançamento pertencem a empresas diferentes.");
      const account = await tx.financialAccount.findUnique({ where: { id: transaction.financialAccountId } });
      const result = evaluateReconciliationMatch({ externalAmount: Number(item.amount), externalDirection: item.direction, externalDate: item.occurredAt, externalReference: item.documentReference, externalCounterparty: item.counterpartyName, externalAccountId: item.financialAccountId, transactionAccountId: transaction.financialAccountId, externalCurrency: item.currency, transactionCurrency: account?.currency, transactionAmount: Number(transaction.amount), transactionDirection: financialTransactionDirection(transaction.type), transactionDate: transaction.occurredAt, transactionReference: transaction.description, transactionCounterparty: transaction.payment?.accountsReceivable?.customer.name ?? transaction.payment?.accountsPayable?.supplier?.name, matchedAmount });
      const updated = await tx.reconciliationItem.update({ where: { id }, data: { financialTransactionId, matchedAmount: result.matchedAmount, difference: result.difference, status: result.status, matchedAt: new Date() }, include: { financialTransaction: true, events: true } });
      if (item.bankTransactionId) await tx.bankTransaction.update({ where: { id: item.bankTransactionId }, data: { reconciliationStatus: result.status } });
      await tx.reconciliationEvent.create({ data: { companyId: item.companyId, reconciliationItemId: id, financialTransactionId, statusFrom: item.status, statusTo: result.status, matchedAmount: result.matchedAmount, difference: result.difference, action: "MATCHED" } });
      return { item: updated, result, idempotent: false };
    });
  }

  async autoMatch(id: string) {
    const item = await this.database.reconciliationItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException("Item de conciliação não encontrado.");
    if (item.financialTransactionId) return { idempotent: true, item };
    const transactions = await this.database.financialTransaction.findMany({ where: { companyId: item.companyId, financialAccountId: item.financialAccountId ?? undefined, occurredAt: { gte: new Date(item.occurredAt.getTime() - 3 * 24 * 60 * 60 * 1000), lte: new Date(item.occurredAt.getTime() + 3 * 24 * 60 * 60 * 1000) }, reconciliationItem: null }, include: { financialAccount: true, payment: { include: { accountsReceivable: { include: { customer: true } }, accountsPayable: { include: { supplier: true } } } } }, orderBy: { occurredAt: "asc" } });
    const candidate = transactions.find((transaction) => financialTransactionDirection(transaction.type) === item.direction && transaction.financialAccount.currency.toUpperCase() === item.currency.toUpperCase() && Number(transaction.amount) === Number(item.amount) && (!item.documentReference || transaction.description.includes(item.documentReference)));
    if (!candidate) return { item, matched: false, reason: "Nenhum match determinístico encontrado." };
    return this.match(id, candidate.id);
  }

  async unmatch(id: string) {
    return this.database.$transaction(async (tx) => {
      const item = await tx.reconciliationItem.findUnique({ where: { id } });
      if (!item) throw new NotFoundException("Item de conciliação não encontrado.");
      if (!item.financialTransactionId) return { item, idempotent: true };
      const updated = await tx.reconciliationItem.update({ where: { id }, data: { financialTransactionId: null, matchedAmount: 0, difference: item.amount, status: "PENDING", matchedAt: null }, include: { events: true } });
      if (item.bankTransactionId) await tx.bankTransaction.update({ where: { id: item.bankTransactionId }, data: { reconciliationStatus: "PENDING" } });
      await tx.reconciliationEvent.create({ data: { companyId: item.companyId, reconciliationItemId: id, financialTransactionId: item.financialTransactionId, statusFrom: item.status, statusTo: "PENDING", matchedAmount: 0, difference: item.amount, action: "UNMATCHED" } });
      return { item: updated, idempotent: false };
    });
  }

  async ignore(id: string) {
    return this.database.$transaction(async (tx) => {
      const item = await tx.reconciliationItem.findUnique({ where: { id } });
      if (!item) throw new NotFoundException("Item de conciliação não encontrado.");
      if (item.financialTransactionId) throw new BadRequestException("Desconcilie o item antes de ignorá-lo.");
      const updated = await tx.reconciliationItem.update({ where: { id }, data: { status: "IGNORED" } });
      if (item.bankTransactionId) await tx.bankTransaction.update({ where: { id: item.bankTransactionId }, data: { reconciliationStatus: "IGNORED" } });
      await tx.reconciliationEvent.create({ data: { companyId: item.companyId, reconciliationItemId: id, statusFrom: item.status, statusTo: "IGNORED", difference: item.amount, action: "IGNORED" } });
      return updated;
    });
  }
}
