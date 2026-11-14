import {
  BadRequestException,
  Injectable,
  NotFoundException,
  type OnModuleDestroy,
} from "@nestjs/common";
import {
  CostNature,
  CostType,
  FinancialTransactionType,
  PayableStatus,
  Prisma,
  prisma,
  ReceivableStatus,
} from "@bbos/database";
import { randomUUID } from "node:crypto";
import {
  expenseAmount,
  expenseCostType,
  expenseDate,
  expensePaymentDate,
  expensePaymentMethod,
  monthlyOccurrence,
  recurrenceCount,
} from "./expense-policy";

const RECEIPT_METHODS = new Set([
  "PIX",
  "BANK_TRANSFER",
  "CASH",
  "CREDIT_CARD",
  "DEBIT_CARD",
  "BOLETO",
  "OTHER",
]);

function receiptDate(value?: string) {
  const parsed = value ? new Date(value) : new Date();
  if (Number.isNaN(parsed.getTime()))
    throw new BadRequestException("Data do recebimento inválida.");
  if (parsed.getTime() > Date.now() + 5 * 60 * 1000)
    throw new BadRequestException(
      "A data do recebimento não pode estar no futuro.",
    );
  return parsed;
}

function receiptAmount(value: number) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0)
    throw new BadRequestException("Valor recebido deve ser maior que zero.");
  const cents = Math.round(amount * 100);
  if (Math.abs(amount * 100 - cents) > 0.000001)
    throw new BadRequestException(
      "Informe o valor recebido com no máximo duas casas decimais.",
    );
  return cents / 100;
}

@Injectable()
export class FinanceService implements OnModuleDestroy {
  readonly database = prisma;
  onModuleDestroy() {
    return this.database.$disconnect();
  }

  async summary(companyId?: string) {
    const [
      accounts,
      receivables,
      payables,
      transactions,
      transactionTotals,
      purchaseInstallments,
    ] = await Promise.all([
      this.database.financialAccount.findMany({
        where: { active: true, ...(companyId ? { companyId } : {}) },
      }),
      this.database.accountsReceivable.findMany({
        where: companyId ? { companyId } : undefined,
        include: {
          customer: { select: { name: true } },
          salesOrder: { select: { code: true, orderNumber: true } },
        },
      }),
      this.database.accountsPayable.findMany({
        where: companyId ? { companyId } : undefined,
        include: {
          supplier: { select: { name: true } },
          costCenter: { select: { name: true } },
        },
      }),
      this.database.financialTransaction.findMany({
        where: companyId ? { companyId } : undefined,
        orderBy: { occurredAt: "desc" },
        take: 200,
      }),
      this.database.financialTransaction.groupBy({
        by: ["type"],
        where: companyId ? { companyId } : undefined,
        _sum: { amount: true },
      }),
      this.database.greenCoffeePurchaseInstallment.findMany({
        where: {
          status: { in: ["PLANNED", "COMMITTED"] },
          ...(companyId ? { purchase: { companyId } } : {}),
        },
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
      transactionTotals.reduce(
        (sum, item) =>
          sum +
          (item.type === FinancialTransactionType.RECEIPT ||
          item.type === FinancialTransactionType.TRANSFER_IN
            ? Number(item._sum.amount)
            : item.type === FinancialTransactionType.PAYMENT ||
                item.type === FinancialTransactionType.TRANSFER_OUT
              ? -Number(item._sum.amount)
              : Number(item._sum.amount)),
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
      .filter(
        (item) =>
          item.status === "PLANNED" && item.purchase.approvalStatus !== "DRAFT",
      )
      .reduce((sum, item) => sum + Number(item.amount), 0);
    const receivableProjection = receivables
      .filter(
        (item) =>
          item.status !== ReceivableStatus.CANCELLED &&
          item.status !== ReceivableStatus.PAID &&
          Number(item.openAmount) > 0,
      )
      .map((item) => ({
        id: item.id,
        document:
          item.invoiceId ??
          item.salesOrder?.orderNumber ??
          item.salesOrder?.code ??
          null,
        counterparty: item.customer.name,
        description: item.notes,
        issueDate: item.issueDate,
        dueDate: item.dueDate,
        amount: Number(item.openAmount),
        status: item.status,
      }));
    const payableProjection = payables
      .filter(
        (item) =>
          item.status !== PayableStatus.CANCELLED &&
          item.status !== PayableStatus.PAID &&
          Number(item.openAmount) > 0,
      )
      .map((item) => ({
        id: item.id,
        document: null,
        counterparty:
          item.supplier?.name ??
          item.costCenter?.name ??
          "Sem fornecedor informado",
        description: item.description,
        category: item.category,
        issueDate: item.issueDate,
        dueDate: item.dueDate,
        amount: Number(item.openAmount),
        status: item.status,
      }));
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
      receivableProjection,
      payableProjection,
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
      include: {
        supplier: true,
        costCenter: true,
        costEvent: true,
        payments: true,
      },
      orderBy: { dueDate: "asc" },
    });
  }

  async expenseOptions(companyId: string) {
    const [suppliers, costCenters, accounts] = await Promise.all([
      this.database.supplier.findMany({
        where: { companyId, active: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      this.database.costCenter.findMany({
        where: { companyId, active: true },
        select: { id: true, code: true, name: true, category: true },
        orderBy: [{ category: "asc" }, { name: "asc" }],
      }),
      this.database.financialAccount.findMany({
        where: { companyId, active: true },
        select: { id: true, name: true, type: true, currency: true },
        orderBy: { name: "asc" },
      }),
    ]);
    return { suppliers, costCenters, accounts };
  }
  listAccounts(companyId?: string) {
    return this.database.financialAccount.findMany({
      where: { active: true, ...(companyId ? { companyId } : {}) },
      include: { financialInstitution: true },
      orderBy: { name: "asc" },
    });
  }

  listInstitutions(companyId?: string) {
    return this.database.financialInstitution.findMany({
      where: { active: true, ...(companyId ? { companyId } : {}) },
      orderBy: { name: "asc" },
    });
  }

  async createInstitution(input: {
    companyId: string;
    name: string;
    code?: string;
    country?: string;
  }) {
    const name = String(input.name ?? "").trim();
    if (!name)
      throw new BadRequestException("Nome da instituição é obrigatório.");
    const code = String(input.code ?? "").trim() || null;
    const existing = await this.database.financialInstitution.findFirst({
      where: {
        companyId: input.companyId,
        OR: [
          { name: { equals: name, mode: "insensitive" } },
          ...(code ? [{ code }] : []),
        ],
      },
    });
    if (existing) return existing;
    return this.database.financialInstitution.create({
      data: {
        companyId: input.companyId,
        name,
        code,
        country:
          String(input.country ?? "BR")
            .trim()
            .toUpperCase() || "BR",
      },
    });
  }

  async createAccount(input: {
    companyId: string;
    financialInstitutionId?: string;
    name: string;
    type: "CASH" | "BANK" | "DIGITAL_ACCOUNT" | "OTHER";
    currency?: string;
    bankCode?: string;
    branch?: string;
    accountNumberMasked?: string;
    country?: string;
    openingBalance?: number;
  }) {
    const name = String(input.name ?? "").trim();
    if (!name) throw new BadRequestException("Nome da conta é obrigatório.");
    let institution = null;
    if (input.financialInstitutionId) {
      institution = await this.database.financialInstitution.findFirst({
        where: {
          id: input.financialInstitutionId,
          companyId: input.companyId,
          active: true,
        },
      });
      if (!institution)
        throw new BadRequestException("Instituição financeira inválida.");
    }
    const currency =
      String(input.currency ?? "BRL")
        .trim()
        .toUpperCase() || "BRL";
    const duplicate = await this.database.financialAccount.findFirst({
      where: {
        companyId: input.companyId,
        active: true,
        name: { equals: name, mode: "insensitive" },
      },
    });
    if (duplicate)
      throw new BadRequestException(
        "Já existe uma conta financeira ativa com este nome.",
      );
    return this.database.financialAccount.create({
      data: {
        companyId: input.companyId,
        financialInstitutionId: institution?.id,
        name,
        type: input.type,
        currency,
        bankCode:
          String(input.bankCode ?? institution?.code ?? "").trim() || null,
        branch: String(input.branch ?? "").trim() || null,
        accountNumberMasked:
          String(input.accountNumberMasked ?? "").trim() || null,
        country:
          String(input.country ?? institution?.country ?? "BR")
            .trim()
            .toUpperCase() || "BR",
        openingBalance: Number.isFinite(Number(input.openingBalance))
          ? Number(input.openingBalance)
          : 0,
      },
    });
  }
  async createPayable(input: {
    companyId: string;
    supplierId?: string;
    costCenterId?: string;
    description: string;
    issueDate: string;
    dueDate: string;
    amount: number;
    category: string;
    notes?: string;
    competenceDate?: string;
    documentType?: string;
    documentNumber?: string;
    documentUrl?: string;
    createCost?: boolean;
    repeatMonthly?: boolean;
    repeatCount?: number;
    paidNow?: boolean;
    financialAccountId?: string;
    paymentMethod?: string;
    paidAt?: string;
    idempotencyKey: string;
    createdById?: string;
    createdByName?: string;
  }) {
    const description = String(input.description ?? "").trim();
    const category = String(input.category ?? "").trim();
    const idempotencyKey = String(input.idempotencyKey ?? "").trim();
    if (!description) throw new BadRequestException("Descrição é obrigatória.");
    if (!category) throw new BadRequestException("Categoria é obrigatória.");
    if (!idempotencyKey)
      throw new BadRequestException("Identificador da operação é obrigatório.");
    const amount = expenseAmount(input.amount);
    const issueDate = expenseDate(input.issueDate, "Data de emissão");
    const dueDate = expenseDate(input.dueDate, "Data de vencimento");
    const competenceDate = expenseDate(
      input.competenceDate ?? input.issueDate,
      "Competência",
    );
    if (dueDate < issueDate)
      throw new BadRequestException(
        "O vencimento não pode ser anterior à data de emissão.",
      );
    const count = recurrenceCount(input.repeatMonthly, input.repeatCount);
    if (input.paidNow && count > 1)
      throw new BadRequestException(
        "Uma série recorrente não pode ser registrada como integralmente paga.",
      );
    const paidAt = input.paidNow
      ? expensePaymentDate(input.paidAt ?? input.issueDate)
      : null;
    const paymentMethod = input.paidNow
      ? expensePaymentMethod(input.paymentMethod)
      : null;
    const documentNumber = String(input.documentNumber ?? "").trim() || null;
    const documentType = String(input.documentType ?? "").trim() || null;
    const documentUrl = String(input.documentUrl ?? "").trim() || null;
    if (documentUrl && !/^https?:\/\//i.test(documentUrl))
      throw new BadRequestException(
        "O link do documento deve começar com http:// ou https://.",
      );
    const createCost = input.createCost !== false;
    if (createCost && !input.costCenterId)
      throw new BadRequestException(
        "Selecione o centro de custo para apropriar esta despesa.",
      );
    const existing = await this.database.accountsPayable.findFirst({
      where: { companyId: input.companyId, creationKey: `${idempotencyKey}:1` },
      include: {
        supplier: true,
        costCenter: true,
        costEvent: true,
        payments: true,
      },
    });
    if (existing) return { payables: [existing], idempotent: true };

    return this.database.$transaction(
      async (tx) => {
        if (input.supplierId) {
          const supplier = await tx.supplier.findFirst({
            where: {
              id: input.supplierId,
              companyId: input.companyId,
              active: true,
            },
          });
          if (!supplier)
            throw new BadRequestException("Fornecedor inválido ou inativo.");
        }
        let center: { id: string; category: string } | null = null;
        if (input.costCenterId) {
          center = await tx.costCenter.findFirst({
            where: {
              id: input.costCenterId,
              companyId: input.companyId,
              active: true,
            },
            select: { id: true, category: true },
          });
          if (!center)
            throw new BadRequestException(
              "Centro de custo inválido ou inativo.",
            );
        }
        let account: { id: string } | null = null;
        if (input.paidNow) {
          account = await tx.financialAccount.findFirst({
            where: {
              id: String(input.financialAccountId ?? ""),
              companyId: input.companyId,
              active: true,
            },
            select: { id: true },
          });
          if (!account)
            throw new BadRequestException(
              "Selecione a conta utilizada no pagamento.",
            );
        }
        if (documentNumber) {
          const duplicate = await tx.accountsPayable.findFirst({
            where: {
              companyId: input.companyId,
              supplierId: input.supplierId ?? null,
              documentNumber,
              status: { not: PayableStatus.CANCELLED },
            },
          });
          if (duplicate)
            throw new BadRequestException(
              "Já existe uma despesa ativa com este fornecedor e número de documento.",
            );
        }

        const recurrenceGroupId = count > 1 ? randomUUID() : null;
        const payables = [];
        for (let index = 0; index < count; index += 1) {
          const occurrenceIssueDate = monthlyOccurrence(issueDate, index);
          const occurrenceDueDate = monthlyOccurrence(dueDate, index);
          const occurrenceCompetence = monthlyOccurrence(competenceDate, index);
          const costEvent =
            createCost && center
              ? await tx.costEvent.create({
                  data: {
                    companyId: input.companyId,
                    costCenterId: center.id,
                    supplierId: input.supplierId,
                    type: expenseCostType(category) as CostType,
                    nature:
                      center.category === "CORPORATE"
                        ? CostNature.CORPORATE
                        : CostNature.INDIRECT_INDUSTRIAL,
                    amount,
                    competenceAt: occurrenceCompetence,
                    occurredAt: occurrenceIssueDate,
                    description,
                    notes: input.notes,
                  },
                })
              : null;
          const payable = await tx.accountsPayable.create({
            data: {
              companyId: input.companyId,
              supplierId: input.supplierId,
              costCenterId: center?.id,
              description,
              issueDate: occurrenceIssueDate,
              dueDate: occurrenceDueDate,
              competenceDate: occurrenceCompetence,
              amount,
              openAmount: input.paidNow ? 0 : amount,
              status: input.paidNow ? PayableStatus.PAID : PayableStatus.OPEN,
              paymentDate: paidAt,
              category,
              documentType,
              documentNumber,
              documentUrl,
              source: "MANUAL_EXPENSE",
              creationKey: `${idempotencyKey}:${index + 1}`,
              recurrenceGroupId,
              recurrenceIndex: count > 1 ? index + 1 : null,
              recurrenceCount: count > 1 ? count : null,
              costEventId: costEvent?.id,
              createdById: input.createdById,
              createdByName: input.createdByName,
              notes: input.notes,
            },
          });
          if (input.paidNow && account && paidAt) {
            const payment = await tx.payment.create({
              data: {
                companyId: input.companyId,
                accountsPayableId: payable.id,
                financialAccountId: account.id,
                amount,
                paidAt,
                method: paymentMethod ?? "BANK_TRANSFER",
                notes: `Baixa registrada por ${input.createdByName ?? "gestor autorizado"}`,
                source: "FINANCE",
                recordedById: input.createdById,
                recordedByName: input.createdByName,
                idempotencyKey: `${idempotencyKey}:payment`,
              },
            });
            await tx.financialTransaction.create({
              data: {
                companyId: input.companyId,
                financialAccountId: account.id,
                paymentId: payment.id,
                costCenterId: center?.id,
                type: FinancialTransactionType.PAYMENT,
                amount,
                category,
                description,
                occurredAt: paidAt,
              },
            });
          }
          payables.push(payable);
        }
        return { payables, idempotent: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async receive(
    id: string,
    input: {
      financialAccountId: string;
      amount: number;
      paidAt?: string;
      method?: string;
      notes?: string;
      idempotencyKey: string;
      recordedBy?: string;
    },
    companyId: string,
  ) {
    const amount = receiptAmount(input.amount);
    const paidAt = receiptDate(input.paidAt);
    const financialAccountId = String(input.financialAccountId ?? "").trim();
    const idempotencyKey = String(input.idempotencyKey ?? "").trim();
    const method = String(input.method ?? "BANK_TRANSFER")
      .trim()
      .toUpperCase();
    const notes = String(input.notes ?? "")
      .trim()
      .slice(0, 500);
    const recordedBy = String(input.recordedBy ?? "gestor autorizado")
      .trim()
      .slice(0, 120);
    if (!financialAccountId)
      throw new BadRequestException(
        "Selecione a conta que recebeu o pagamento.",
      );
    if (!idempotencyKey)
      throw new BadRequestException("Identificador da operação é obrigatório.");
    if (!RECEIPT_METHODS.has(method))
      throw new BadRequestException("Forma de pagamento inválida.");
    return this.database.$transaction(
      async (tx) => {
        const item = await tx.accountsReceivable.findFirst({
          where: { id, companyId },
        });
        if (!item)
          throw new NotFoundException("Conta a receber não encontrada.");
        const existing = await tx.payment.findUnique({
          where: { idempotencyKey },
          include: { transaction: true },
        });
        if (existing) {
          if (
            existing.companyId !== companyId ||
            existing.accountsReceivableId !== id
          )
            throw new BadRequestException(
              "Identificador já utilizado em outra operação.",
            );
          return { payment: existing, idempotent: true };
        }
        if (
          item.status === ReceivableStatus.PAID ||
          item.status === ReceivableStatus.CANCELLED ||
          Number(item.openAmount) <= 0
        )
          throw new BadRequestException(
            "Este título não está disponível para baixa.",
          );
        const account = await tx.financialAccount.findFirst({
          where: { id: financialAccountId, companyId, active: true },
        });
        if (!account)
          throw new BadRequestException(
            "Conta financeira inválida ou inativa.",
          );
        if (amount > Number(item.openAmount))
          throw new BadRequestException(
            "Recebimento superior ao valor em aberto.",
          );
        const auditNote = `Baixa manual registrada por ${recordedBy}`;
        const payment = await tx.payment.create({
          data: {
            companyId: item.companyId,
            accountsReceivableId: id,
            financialAccountId,
            amount,
            paidAt,
            method,
            notes: notes ? `${auditNote}. ${notes}` : auditNote,
            idempotencyKey,
          },
        });
        await tx.financialTransaction.create({
          data: {
            companyId: item.companyId,
            financialAccountId,
            paymentId: payment.id,
            type: FinancialTransactionType.RECEIPT,
            amount,
            category: "RECEBIMENTO",
            description: `Recebimento manual ${item.invoiceId ?? item.id}`,
            occurredAt: paidAt,
          },
        });
        const open = Math.round((Number(item.openAmount) - amount) * 100) / 100;
        const receivable = await tx.accountsReceivable.update({
          where: { id },
          data: {
            openAmount: open,
            status:
              open === 0
                ? ReceivableStatus.PAID
                : ReceivableStatus.PARTIALLY_PAID,
            paymentDate: open === 0 ? paidAt : undefined,
          },
        });
        return { payment, receivable, idempotent: false };
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
      paidAt?: string;
      notes?: string;
      idempotencyKey: string;
      recordedById?: string;
      recordedByName?: string;
    },
    companyId?: string,
  ) {
    const amount = expenseAmount(input.amount);
    const paidAt = expensePaymentDate(input.paidAt);
    const method = expensePaymentMethod(input.method);
    const idempotencyKey = String(input.idempotencyKey ?? "").trim();
    if (!idempotencyKey)
      throw new BadRequestException("Identificador da operação é obrigatório.");
    return this.database.$transaction(
      async (tx) => {
        const item = await tx.accountsPayable.findFirst({
          where: { id, ...(companyId ? { companyId } : {}) },
        });
        if (!item) throw new NotFoundException("Conta a pagar não encontrada.");
        const existing = await tx.payment.findUnique({
          where: { idempotencyKey },
          include: { transaction: true },
        });
        if (existing) {
          if (
            existing.companyId !== item.companyId ||
            existing.accountsPayableId !== id
          )
            throw new BadRequestException(
              "Identificador já utilizado em outra operação.",
            );
          return { payment: existing, idempotent: true };
        }
        const account = await tx.financialAccount.findFirst({
          where: {
            id: input.financialAccountId,
            companyId: item.companyId,
            active: true,
          },
        });
        if (!account)
          throw new BadRequestException(
            "Conta financeira inválida ou inativa.",
          );
        if (amount > Number(item.openAmount))
          throw new BadRequestException(
            "Pagamento superior ao valor em aberto.",
          );
        const payment = await tx.payment.create({
          data: {
            companyId: item.companyId,
            accountsPayableId: id,
            financialAccountId: input.financialAccountId,
            amount,
            paidAt,
            method,
            notes: input.notes,
            recordedById: input.recordedById,
            recordedByName: input.recordedByName,
            idempotencyKey,
          },
        });
        await tx.financialTransaction.create({
          data: {
            companyId: item.companyId,
            financialAccountId: input.financialAccountId,
            paymentId: payment.id,
            costCenterId: item.costCenterId,
            type: FinancialTransactionType.PAYMENT,
            amount,
            category: item.category,
            description: `Pagamento de ${item.description}`,
            occurredAt: paidAt,
          },
        });
        const open = Math.round((Number(item.openAmount) - amount) * 100) / 100;
        await tx.accountsPayable.update({
          where: { id },
          data: {
            openAmount: open,
            status:
              open === 0 ? PayableStatus.PAID : PayableStatus.PARTIALLY_PAID,
            paymentDate: open === 0 ? paidAt : undefined,
          },
        });
        return { payment, idempotent: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
