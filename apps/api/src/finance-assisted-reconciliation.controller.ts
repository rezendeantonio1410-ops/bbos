import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import {
  FinancialTransactionType,
  Prisma,
  PrismaClient,
  ReceivableStatus,
} from "@bbos/database";
import type { Request } from "express";
import { AuthService } from "./auth.service";

const normalize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

@Controller("finance/reconciliation-assisted")
export class FinanceAssistedReconciliationController {
  private readonly db = new PrismaClient();

  constructor(private readonly auth: AuthService) {}

  private async actor(req: Request) {
    const actor = await this.auth.resolve(this.auth.readToken(req));
    if (!actor) throw new UnauthorizedException("Sessão inválida.");
    return actor;
  }

  private async context(id: string, companyId: string) {
    const item = await this.db.reconciliationItem.findFirst({
      where: { id, companyId },
      include: { bankTransaction: true },
    });
    if (!item) throw new BadRequestException("Item de conciliação não encontrado.");
    if (!item.bankTransactionId || !item.bankTransaction)
      throw new BadRequestException("Este item não nasceu de uma movimentação bancária.");
    if (item.direction !== "IN" || item.bankTransaction.direction !== "CREDIT")
      throw new BadRequestException("A baixa assistida de clientes exige um crédito bancário de entrada.");
    if (item.financialTransactionId)
      throw new BadRequestException("Este item já está vinculado a um lançamento financeiro.");
    return item;
  }

  private async candidatesFor(id: string, companyId: string) {
    const item = await this.context(id, companyId);
    const rows = await this.db.accountsReceivable.findMany({
      where: {
        companyId,
        status: { notIn: [ReceivableStatus.PAID, ReceivableStatus.CANCELLED] },
        openAmount: item.amount,
      },
      include: { customer: true, salesOrder: true },
      orderBy: { dueDate: "asc" },
      take: 20,
    });

    const haystack = normalize(
      [
        item.documentReference,
        item.counterpartyName,
        item.description,
        item.bankTransaction.reference,
        item.bankTransaction.counterparty,
        item.bankTransaction.description,
      ]
        .filter(Boolean)
        .join(" "),
    );

    const candidates = rows
      .map((receivable) => {
        const orderCode = normalize(receivable.salesOrder?.code);
        const orderNumber = normalize(receivable.salesOrder?.orderNumber);
        const customer = normalize(receivable.customer.name);
        const referenceMatch = Boolean(
          (orderCode && haystack.includes(orderCode)) ||
            (orderNumber && haystack.includes(orderNumber)),
        );
        const customerMatch = Boolean(
          customer &&
            (haystack.includes(customer) ||
              customer
                .split(" ")
                .filter((part) => part.length >= 4)
                .some((part) => haystack.includes(part))),
        );
        const daysFromDue = Math.abs(
          Math.round((item.occurredAt.getTime() - receivable.dueDate.getTime()) / 86400000),
        );
        const dateMatch = daysFromDue <= 30;
        const score =
          60 +
          (referenceMatch ? 30 : 0) +
          (customerMatch ? 20 : 0) +
          (dateMatch ? 10 : 0);
        const strong = referenceMatch || (customerMatch && dateMatch);
        return {
          receivableId: receivable.id,
          customerId: receivable.customerId,
          customer: receivable.customer.name,
          salesOrderId: receivable.salesOrderId,
          orderNumber: receivable.salesOrder?.orderNumber ?? receivable.salesOrder?.code ?? null,
          dueDate: receivable.dueDate,
          amount: Number(receivable.amount),
          openAmount: Number(receivable.openAmount),
          referenceMatch,
          customerMatch,
          dateMatch,
          score,
          strong,
        };
      })
      .sort((a, b) => b.score - a.score);

    const strong = candidates.filter((candidate) => candidate.strong);
    const autoEligible = strong.length === 1;
    return {
      item: {
        id: item.id,
        bankTransactionId: item.bankTransactionId,
        occurredAt: item.occurredAt,
        amount: Number(item.amount),
        description: item.description,
        counterparty: item.counterpartyName ?? item.bankTransaction.counterparty,
        reference: item.documentReference ?? item.bankTransaction.reference,
      },
      autoEligible,
      reason: autoEligible
        ? "Há um único título com valor exato e identificação forte."
        : strong.length > 1
          ? "Mais de um título possui identificação forte; decisão humana necessária."
          : "Nenhum título possui identificação forte suficiente para baixa automática.",
      candidates,
    };
  }

  @Get(":id/candidates")
  async candidates(@Param("id") id: string, @Req() req: Request) {
    const actor = await this.actor(req);
    return this.candidatesFor(id, actor.companyId);
  }

  @Post(":id/settle")
  async settle(@Param("id") id: string, @Req() req: Request) {
    const actor = await this.actor(req);
    const preview = await this.candidatesFor(id, actor.companyId);
    const target = preview.candidates.filter((candidate) => candidate.strong);
    if (!preview.autoEligible || target.length !== 1)
      throw new BadRequestException({
        code: "RECONCILIATION_REQUIRES_REVIEW",
        message: preview.reason,
        candidates: preview.candidates,
      });

    const receivableId = target[0]!.receivableId;
    return this.db.$transaction(
      async (tx) => {
        const itemRows = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "ReconciliationItem" WHERE id=${id} AND "companyId"=${actor.companyId} FOR UPDATE
        `;
        if (!itemRows.length)
          throw new BadRequestException("Item de conciliação não encontrado.");
        const item = await tx.reconciliationItem.findUnique({
          where: { id },
          include: { bankTransaction: true },
        });
        if (!item || !item.bankTransactionId || !item.bankTransaction)
          throw new BadRequestException("Movimentação bancária inválida para baixa assistida.");
        if (item.financialTransactionId)
          return { idempotent: true, reconciliationItemId: id, financialTransactionId: item.financialTransactionId };

        await tx.$queryRaw`SELECT id FROM "AccountsReceivable" WHERE id=${receivableId} FOR UPDATE`;
        const receivable = await tx.accountsReceivable.findFirst({
          where: { id: receivableId, companyId: actor.companyId },
        });
        if (!receivable)
          throw new BadRequestException("Conta a receber não encontrada.");
        if (Number(receivable.openAmount) !== Number(item.amount))
          throw new BadRequestException("O saldo do título mudou; refaça a análise antes da baixa.");
        if ([ReceivableStatus.PAID, ReceivableStatus.CANCELLED].includes(receivable.status))
          throw new BadRequestException("O título não está mais disponível para baixa.");

        const idempotencyKey = `BANK_RECEIPT:${item.bankTransactionId}`;
        const existingPayment = await tx.payment.findUnique({ where: { idempotencyKey } });
        if (existingPayment) {
          const existingTransaction = await tx.financialTransaction.findUnique({
            where: { paymentId: existingPayment.id },
          });
          return {
            idempotent: true,
            reconciliationItemId: id,
            paymentId: existingPayment.id,
            financialTransactionId: existingTransaction?.id ?? null,
          };
        }

        const payment = await tx.payment.create({
          data: {
            companyId: actor.companyId,
            accountsReceivableId: receivable.id,
            financialAccountId: item.bankTransaction.financialAccountId,
            amount: item.amount,
            paidAt: item.occurredAt,
            method: "BANK_RECONCILIATION",
            notes: `Baixa automática assistida pela conciliação ${item.id}`,
            idempotencyKey,
          },
        });
        const transaction = await tx.financialTransaction.create({
          data: {
            companyId: actor.companyId,
            financialAccountId: item.bankTransaction.financialAccountId,
            paymentId: payment.id,
            type: FinancialTransactionType.RECEIPT,
            amount: item.amount,
            category: "RECEBIMENTO",
            description: `Recebimento conciliado ${receivable.id}`,
            occurredAt: item.occurredAt,
          },
        });
        await tx.accountsReceivable.update({
          where: { id: receivable.id },
          data: {
            openAmount: 0,
            status: ReceivableStatus.PAID,
            paymentDate: item.occurredAt,
          },
        });
        await tx.reconciliationItem.update({
          where: { id: item.id },
          data: {
            financialTransactionId: transaction.id,
            matchedAmount: item.amount,
            difference: 0,
            status: "MATCHED",
            matchedAt: new Date(),
            customerId: receivable.customerId,
          },
        });
        await tx.bankTransaction.update({
          where: { id: item.bankTransactionId },
          data: { reconciliationStatus: "MATCHED" },
        });
        await tx.reconciliationEvent.create({
          data: {
            companyId: actor.companyId,
            reconciliationItemId: item.id,
            financialTransactionId: transaction.id,
            statusFrom: item.status,
            statusTo: "MATCHED",
            matchedAmount: item.amount,
            difference: 0,
            action: "ASSISTED_RECEIVABLE_SETTLEMENT",
            actor: actor.name,
          },
        });
        return {
          idempotent: false,
          reconciliationItemId: item.id,
          receivableId: receivable.id,
          paymentId: payment.id,
          financialTransactionId: transaction.id,
          status: "MATCHED",
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
