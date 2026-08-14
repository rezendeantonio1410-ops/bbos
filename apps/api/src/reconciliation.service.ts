import { BadRequestException, Injectable, NotFoundException, type OnModuleDestroy } from "@nestjs/common";
import { PrismaClient, ReconciliationDirection, ReconciliationStatus } from "@bbos/database";
import { bankTransactionDirection, evaluateReconciliationMatch, financialTransactionDirection } from "@bbos/shared";
import { createHash } from "node:crypto";

type ReconciliationQuery = { status?: ReconciliationStatus; direction?: ReconciliationDirection; from?: string; to?: string; companyId?: string; financialAccountId?: string; currency?: string; minAmount?: string | number; maxAmount?: string | number; search?: string };
type CreateInput = { companyId: string; financialAccountId?: string; occurredAt: string; description: string; documentReference?: string; counterpartyName?: string; customerId?: string; supplierId?: string; direction: ReconciliationDirection; amount: number; currency?: string; notes?: string };
type BankTransactionInput = { companyId: string; financialAccountId: string; externalId?: string; transactionDate: string; postingDate?: string; description: string; reference?: string; counterparty?: string; direction: "CREDIT" | "DEBIT"; amount: number; currency: string; balanceAfter?: number; source: "MANUAL" | "CSV" | "OFX" | "API" | "OPEN_BANKING" | "OTHER"; rawMetadata?: unknown };
type StatementImportInput = { companyId: string; financialAccountId: string; format: "CSV" | "OFX"; fileName: string; content: string };

@Injectable()
export class ReconciliationService implements OnModuleDestroy {
  readonly database = new PrismaClient();
  onModuleDestroy() { return this.database.$disconnect(); }

  async list(query: ReconciliationQuery = {}) {
    return this.database.reconciliationItem.findMany({
      where: { companyId: query.companyId, financialAccountId: query.financialAccountId, currency: query.currency, status: query.status, direction: query.direction, amount: { gte: query.minAmount ? Number(query.minAmount) : undefined, lte: query.maxAmount ? Number(query.maxAmount) : undefined }, occurredAt: { gte: query.from ? new Date(query.from) : undefined, lte: query.to ? new Date(query.to + (query.to.length === 10 ? "T23:59:59.999" : "")) : undefined }, OR: query.search ? [{ description: { contains: query.search, mode: "insensitive" } }, { documentReference: { contains: query.search, mode: "insensitive" } }, { counterpartyName: { contains: query.search, mode: "insensitive" } }] : undefined },
      include: { financialAccount: { include: { financialInstitution: true } }, financialTransaction: { include: { payment: { include: { accountsReceivable: { include: { customer: true, salesOrder: true } }, accountsPayable: { include: { supplier: true } } } }, costCenter: true } }, bankTransaction: true, customer: true, supplier: true, events: { orderBy: { createdAt: "desc" } } },
      orderBy: { occurredAt: "desc" },
    });
  }

  async summary(query: ReconciliationQuery = {}) {
    const items = await this.list(query);
    const byCurrency = Object.values(items.reduce<Record<string, { currency: string; totalMovimentado: number; entradas: number; saidas: number; conciliado: number; pendente: number; divergente: number; quantidade: number }>>((acc, item) => {
      const currency = item.currency || "BRL";
      const entry = acc[currency] ?? (acc[currency] = { currency, totalMovimentado: 0, entradas: 0, saidas: 0, conciliado: 0, pendente: 0, divergente: 0, quantidade: 0 });
      entry.totalMovimentado += Number(item.amount);
      entry[item.direction === "IN" ? "entradas" : "saidas"] += Number(item.amount);
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
    return { totalMovimentado: total, entradas: onlyCurrency?.entradas ?? 0, saidas: onlyCurrency?.saidas ?? 0, conciliado: reconciled, moedasMistas: byCurrency.length > 1, porMoeda: byCurrency, pendente: countByStatus("PENDING"), divergente: countByStatus("DIVERGENT"), parcialmenteConciliado: countByStatus("PARTIALLY_MATCHED"), ignorado: countByStatus("IGNORED"), percentualConciliado: total ? Number(((reconciled / total) * 100).toFixed(2)) : 0, quantidade: items.length };
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
      const externalId = input.externalId || this.fingerprint(input);
      const existing = await tx.bankTransaction.findUnique({ where: { financialAccountId_externalId: { financialAccountId: input.financialAccountId, externalId } }, include: { reconciliationItem: true } });
      if (existing) return { transaction: existing, idempotent: true };
      const transaction = await tx.bankTransaction.create({ data: { companyId: input.companyId, financialAccountId: input.financialAccountId, externalId, transactionDate: new Date(input.transactionDate), postingDate: input.postingDate ? new Date(input.postingDate) : undefined, description: input.description, reference: input.reference, counterparty: input.counterparty, direction: input.direction, amount: input.amount, currency: input.currency.toUpperCase(), balanceAfter: input.balanceAfter, source: input.source, rawMetadata: input.rawMetadata as object | undefined } });
      const item = await tx.reconciliationItem.create({ data: { companyId: input.companyId, financialAccountId: input.financialAccountId, bankTransactionId: transaction.id, occurredAt: transaction.transactionDate, description: transaction.description, documentReference: transaction.reference, counterpartyName: transaction.counterparty, direction: bankTransactionDirection(transaction.direction), amount: transaction.amount, currency: transaction.currency, difference: transaction.amount } });
      await tx.reconciliationEvent.create({ data: { companyId: input.companyId, reconciliationItemId: item.id, statusTo: "PENDING", matchedAmount: 0, difference: transaction.amount, action: "IMPORTED" } });
      return { transaction, item, idempotent: false };
    });
  }

  private fingerprint(input: Pick<BankTransactionInput, "transactionDate" | "description" | "direction" | "amount" | "currency" | "reference">) {
    return "bbos-" + createHash("sha256").update([input.transactionDate.slice(0, 10), input.description.trim().toLowerCase(), input.direction, Number(input.amount).toFixed(2), input.currency.toUpperCase(), input.reference ?? ""].join("|")).digest("hex").slice(0, 32);
  }

  private parseStatement(input: StatementImportInput, currency: string): BankTransactionInput[] {
    if (!input.content.trim()) throw new BadRequestException("O arquivo de extrato está vazio.");
    if (input.format === "OFX") {
      const blocks = input.content.match(/<STMTTRN>[\s\S]*?(?=<STMTTRN>|<\/BANKTRANLIST>)/gi) ?? [];
      return blocks.map((block) => {
        const field = (name: string) => block.match(new RegExp(`<${name}>([^<\\r\\n]+)`, "i"))?.[1]?.trim();
        const amount = Number((field("TRNAMT") ?? "0").replace(",", "."));
        const rawDate = field("DTPOSTED") ?? "";
        return { companyId: input.companyId, financialAccountId: input.financialAccountId, externalId: field("FITID"), transactionDate: `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`, description: field("MEMO") ?? field("NAME") ?? "Movimentação bancária", reference: field("CHECKNUM") ?? field("REFNUM"), counterparty: field("NAME"), direction: amount >= 0 ? "CREDIT" : "DEBIT", amount: Math.abs(amount), currency, source: "OFX", rawMetadata: { fileName: input.fileName } };
      });
    }
    const lines = input.content.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
    const delimiter = (lines[0]?.match(/;/g)?.length ?? 0) >= (lines[0]?.match(/,/g)?.length ?? 0) ? ";" : ",";
    const cells = (line: string) => line.split(delimiter).map((value) => value.trim().replace(/^"|"$/g, ""));
    const headers = cells(lines.shift() ?? "").map((value) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
    const index = (...names: string[]) => headers.findIndex((header) => names.includes(header));
    const dateIndex = index("data", "date", "transactiondate"); const descriptionIndex = index("descricao", "description", "historico"); const amountIndex = index("valor", "amount");
    if ([dateIndex, descriptionIndex, amountIndex].some((value) => value < 0)) throw new BadRequestException("CSV deve conter as colunas data, descrição e valor.");
    return lines.map((line, row) => { const value = cells(line); const normalized = value[amountIndex]!.replace(/\./g, "").replace(",", "."); const amount = Number(normalized); const rawDate = value[dateIndex]!; const [day, month, year] = rawDate.includes("/") ? rawDate.split("/") : []; return { companyId: input.companyId, financialAccountId: input.financialAccountId, externalId: value[index("id", "externalid", "fitid")] || undefined, transactionDate: year ? `${year}-${month}-${day}` : rawDate, description: value[descriptionIndex]!, reference: value[index("referencia", "reference", "documento")] || undefined, counterparty: value[index("contraparte", "counterparty", "favorecido")] || undefined, direction: amount >= 0 ? "CREDIT" : "DEBIT", amount: Math.abs(amount), currency, source: "CSV", rawMetadata: { fileName: input.fileName, row: row + 2 } }; });
  }

  async importStatement(input: StatementImportInput) {
    const account = await this.database.financialAccount.findFirst({ where: { id: input.financialAccountId, companyId: input.companyId, active: true }, include: { financialInstitution: true } });
    if (!account) throw new BadRequestException("Conta financeira inválida para a empresa.");
    const rows = this.parseStatement(input, account.currency);
    if (!rows.length) throw new BadRequestException("Nenhum lançamento válido foi encontrado no extrato.");
    const results = [];
    for (const row of rows) results.push(await this.importBankTransaction(row));
    const imported = results.filter((result) => !result.idempotent).length;
    const dates = rows.map((row) => row.transactionDate).sort();
    return { bank: account.financialInstitution?.name ?? "Instituição não informada", account: account.name, accountId: account.id, currency: account.currency, format: input.format, fileName: input.fileName, period: { from: dates[0], to: dates.at(-1) }, total: rows.length, imported, duplicates: rows.length - imported };
  }

  async suggestions(id: string) {
    const item = await this.database.reconciliationItem.findUnique({ where: { id }, include: { financialAccount: true } });
    if (!item) throw new NotFoundException("Item de conciliação não encontrado.");
    const transactions = await this.database.financialTransaction.findMany({ where: { companyId: item.companyId, reconciliationItem: null, occurredAt: { gte: new Date(item.occurredAt.getTime() - 7 * 86400000), lte: new Date(item.occurredAt.getTime() + 7 * 86400000) } }, include: { financialAccount: true, costCenter: true, payment: { include: { accountsReceivable: { include: { customer: true, salesOrder: true } }, accountsPayable: { include: { supplier: true } } } } } });
    return transactions.map((transaction) => { const counterparty = transaction.payment?.accountsReceivable?.customer.name ?? transaction.payment?.accountsPayable?.supplier?.name; const result = evaluateReconciliationMatch({ externalAmount: Number(item.amount), externalDirection: item.direction, externalDate: item.occurredAt, externalReference: item.documentReference, externalCounterparty: item.counterpartyName, externalAccountId: item.financialAccountId, transactionAccountId: transaction.financialAccountId, externalCurrency: item.currency, transactionCurrency: transaction.financialAccount.currency, transactionAmount: Number(transaction.amount), transactionDirection: financialTransactionDirection(transaction.type), transactionDate: transaction.occurredAt, transactionReference: transaction.payment?.accountsReceivable?.salesOrder?.code ?? transaction.description, transactionCounterparty: counterparty }); const score = (result.reasons.length * 20) + (Number(transaction.amount) === Number(item.amount) ? 40 : 0) + (financialTransactionDirection(transaction.type) === item.direction ? 20 : 0); return { id: transaction.id, occurredAt: transaction.occurredAt, amount: transaction.amount, direction: financialTransactionDirection(transaction.type), category: transaction.category, description: transaction.description, counterparty, document: transaction.payment?.accountsReceivable?.salesOrder?.code, score: Math.min(score, 100), reasons: result.reasons }; }).filter((candidate) => candidate.score >= 40).sort((a, b) => b.score - a.score).slice(0, 5);
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
