import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { FinancialTransactionType, prisma, ReconciliationStatus } from "@bbos/database";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import { FinanceService } from "./finance.service";
import { ReconciliationService } from "./reconciliation.service";
import { balanceCheck, cleanTaxId, parseOfx, readItauPdf, type ParsedStatement, type StatementLine } from "./bank-statement-itau";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  planStatement,
  type OpenInstallment,
  type OpenPayable,
  type RecordedPayment,
} from "./statement-matching";

const MAX_BYTES = 1_400_000;
const LEARN_PREFIX = "Extrato bancário";

type Decision =
  | { externalId: string; action: "SKIP" }
  | { externalId: string; action: "ALREADY"; paymentId: string }
  | { externalId: string; action: "EXPENSE"; category: string }
  | { externalId: string; action: "INCOME"; category: string }
  | { externalId: string; action: "SETTLE" };

/** Lê o arquivo enviado (PDF do Itaú ou OFX). */
async function readStatement(fileName: string, contentBase64: string): Promise<ParsedStatement> {
  const content = Buffer.from(String(contentBase64 ?? ""), "base64");
  if (!content.length) throw new BadRequestException("Arquivo vazio.");
  if (content.length > MAX_BYTES) throw new BadRequestException("Arquivo muito grande (máximo 1,4 MB).");
  try {
    if (content.subarray(0, 5).toString() === "%PDF-") return await readItauPdf(content);
    const text = content.toString("latin1");
    if (/<OFX>|OFXHEADER/i.test(text)) return parseOfx(text);
  } catch (error) {
    throw new BadRequestException(error instanceof Error ? error.message : "Não foi possível ler o extrato.");
  }
  throw new BadRequestException(`Formato não reconhecido em ${fileName}. Envie o PDF "Entradas e Saídas" do Itaú ou o arquivo OFX.`);
}

/**
 * Importar extrato (Financeiro → Conciliação). A prévia não grava nada; o
 * "aplicar" só faz o que a pessoa marcou, sempre de forma idempotente: enviar
 * o mesmo extrato de novo não duplica baixas nem despesas.
 */
@Controller("finance/statement-import")
export class BankStatementImportController {
  constructor(
    private readonly auth: AuthService,
    private readonly finance: FinanceService,
    private readonly reconciliation: ReconciliationService,
  ) {}

  private async actor(req: Request) {
    const actor = await this.auth.resolve(this.auth.readToken(req));
    if (!actor) throw new UnauthorizedException("Sessão inválida.");
    return actor;
  }

  private async account(companyId: string, financialAccountId: string) {
    const account = await prisma.financialAccount.findFirst({
      where: { id: String(financialAccountId ?? ""), companyId, active: true },
      include: { financialInstitution: true },
    });
    if (!account) throw new BadRequestException("Escolha a conta do banco.");
    return account;
  }

  private async context(companyId: string, financialAccountId: string, statement: ParsedStatement) {
    const from = new Date(`${statement.from ?? "2000-01-01"}T00:00:00Z`);
    from.setUTCDate(from.getUTCDate() - 5);
    const [payments, payables, installments, company, users, learnedPayables, learnedIncome, imported] = await Promise.all([
      prisma.payment.findMany({
        where: { companyId, financialAccountId, paidAt: { gte: from } },
        include: { accountsReceivable: { include: { customer: true } }, accountsPayable: { include: { supplier: true } } },
      }),
      prisma.accountsPayable.findMany({
        where: { companyId, status: { in: ["OPEN", "PARTIALLY_PAID", "OVERDUE"] as any }, openAmount: { gt: 0 } },
        include: { supplier: true, broker: true },
      }),
      prisma.greenCoffeePurchaseInstallment.findMany({
        where: { accountsPayableId: null, paidAt: null, status: "COMMITTED" as any, purchase: { companyId, approvalStatus: "APPROVED" } },
        include: { purchase: { include: { supplier: true } } },
      }),
      prisma.company.findUnique({ where: { id: companyId }, select: { taxId: true } }),
      prisma.user.findMany({ where: { companyId, active: true }, select: { name: true } }).catch(() => []),
      prisma.accountsPayable.findMany({
        where: { companyId, notes: { startsWith: LEARN_PREFIX } },
        select: { notes: true, category: true },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      prisma.financialTransaction.findMany({
        where: { companyId, paymentId: null, description: { startsWith: LEARN_PREFIX } },
        select: { description: true, category: true },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      prisma.bankTransaction.findMany({
        where: { financialAccountId, externalId: { in: statement.lines.map((l) => l.externalId) } },
        include: { reconciliationItem: true },
      }),
    ]);
    const recorded: RecordedPayment[] = payments.map((p) => ({
      id: p.id,
      direction: p.accountsReceivableId ? "IN" : "OUT",
      amount: Number(p.amount),
      date: p.paidAt.toISOString().slice(0, 10),
      name: p.accountsReceivable?.customer?.name ?? p.accountsPayable?.supplier?.name ?? p.accountsPayable?.description ?? "",
    }));
    const open: OpenPayable[] = payables.map((p) => ({
      id: p.id,
      label: p.description,
      amount: Number(p.openAmount),
      dueDate: p.dueDate.toISOString().slice(0, 10),
      taxId: cleanTaxId(p.broker?.taxId ?? p.supplier?.taxId ?? ""),
      name: p.broker?.name ?? p.supplier?.name ?? "",
      commission: Boolean(p.brokerId) || /comiss/i.test(p.description),
    }));
    const openInstallments: OpenInstallment[] = installments.map((i) => ({
      id: i.id,
      label: `${i.purchase.purchaseNumber} · parcela ${i.installmentNumber}`,
      amount: Number(i.amount),
      taxId: cleanTaxId(i.purchase.supplier?.taxId ?? ""),
      name: i.purchase.supplier?.name ?? "",
    }));
    // "O BBOS lembra": a última categoria usada para o mesmo CNPJ/CPF.
    const learned = new Map<string, string>();
    for (const row of learnedPayables) {
      const taxId = /CNPJ\/CPF (\w+)/.exec(row.notes ?? "")?.[1];
      if (taxId && !learned.has(`OUT:${taxId}`)) learned.set(`OUT:${taxId}`, row.category);
    }
    for (const row of learnedIncome) {
      const taxId = /CNPJ\/CPF (\w+)/.exec(row.description)?.[1];
      if (taxId && !learned.has(`IN:${taxId}`)) learned.set(`IN:${taxId}`, row.category);
    }
    return {
      payments: recorded,
      payables: open,
      installments: openInstallments,
      companyTaxId: cleanTaxId(company?.taxId ?? ""),
      ownerNames: users.map((u) => u.name ?? "").filter(Boolean),
      learned,
      imported: new Map(imported.map((b) => [b.externalId ?? "", b])),
    };
  }

  @Post("preview")
  async preview(@Body() body: { financialAccountId?: string; fileName?: string; contentBase64?: string }, @Req() req: Request) {
    const actor = await this.actor(req);
    const account = await this.account(actor.companyId, body?.financialAccountId ?? "");
    const statement = await readStatement(String(body?.fileName ?? "extrato"), String(body?.contentBase64 ?? ""));
    const ctx = await this.context(actor.companyId, account.id, statement);
    const plans = planStatement(statement.lines, ctx);
    return {
      account: { id: account.id, name: account.name, bank: account.financialInstitution?.name ?? statement.bank },
      statement: { bank: statement.bank, agency: statement.agency, account: statement.account, from: statement.from, to: statement.to, openingBalance: statement.openingBalance, closingBalance: statement.closingBalance },
      balance: balanceCheck(statement),
      categories: { expense: EXPENSE_CATEGORIES, income: INCOME_CATEGORIES },
      lines: plans.map((plan) => {
        const done = ctx.imported.get(plan.line.externalId)?.reconciliationItem;
        return { ...plan, alreadyApplied: done ? done.status === ReconciliationStatus.MATCHED || done.status === ReconciliationStatus.IGNORED : false };
      }),
    };
  }

  @Post("apply")
  async apply(@Body() body: { financialAccountId?: string; fileName?: string; contentBase64?: string; decisions?: Decision[] }, @Req() req: Request) {
    const actor = await this.actor(req);
    const account = await this.account(actor.companyId, body?.financialAccountId ?? "");
    const statement = await readStatement(String(body?.fileName ?? "extrato"), String(body?.contentBase64 ?? ""));
    const ctx = await this.context(actor.companyId, account.id, statement);
    const plans = new Map(planStatement(statement.lines, ctx).map((plan) => [plan.line.externalId, plan]));
    const decisions = Array.isArray(body?.decisions) ? body!.decisions : [];
    const source = statement.bank === "Itaú" ? "OTHER" : "OFX";
    const results: Array<{ externalId: string; status: "OK" | "SKIPPED" | "ERROR"; message: string }> = [];
    const settled = new Set<Record<string, unknown>>();

    for (const decision of decisions) {
      const plan = plans.get(decision?.externalId);
      if (!plan) { results.push({ externalId: String(decision?.externalId), status: "ERROR", message: "Linha não encontrada no extrato." }); continue; }
      const line = plan.line;
      try {
        // Toda linha marcada entra no extrato do BBOS (uma vez só).
        const imported = await this.reconciliation.importBankTransaction({
          companyId: actor.companyId,
          financialAccountId: account.id,
          externalId: line.externalId,
          transactionDate: line.date,
          description: line.description,
          counterparty: line.counterparty || undefined,
          reference: line.taxId || undefined,
          direction: line.amount > 0 ? "CREDIT" : "DEBIT",
          amount: Math.abs(line.amount),
          currency: account.currency,
          source: source as any,
          rawMetadata: { fileName: body?.fileName, taxId: line.taxId },
        });
        const item = await prisma.reconciliationItem.findUnique({ where: { bankTransactionId: imported.transaction.id } });
        if (!item) throw new Error("Linha do extrato sem conciliação.");
        if (item.status === ReconciliationStatus.MATCHED || item.status === ReconciliationStatus.IGNORED) {
          results.push({ externalId: line.externalId, status: "SKIPPED", message: "Já aplicado antes." });
          continue;
        }
        if (decision.action === "SKIP") { results.push({ externalId: line.externalId, status: "SKIPPED", message: "Fica pendente na conciliação." }); continue; }

        let transactionId: string | null = null;
        let note = "";
        const method = /BOLETO/i.test(line.description) ? "BOLETO" : /PIX/i.test(line.description) ? "PIX" : "BANK_TRANSFER";
        const key = `stmt:${account.id}:${line.externalId}`;

        if (decision.action === "ALREADY") {
          if (plan.group !== "ALREADY" || plan.matchedPayment?.id !== decision.paymentId) throw new Error("O registro correspondente mudou. Gere a prévia de novo.");
          const payment = await prisma.payment.findFirst({ where: { id: decision.paymentId, companyId: actor.companyId }, include: { transaction: { include: { reconciliationItem: true } } } });
          if (payment?.transaction && !payment.transaction.reconciliationItem) transactionId = payment.transaction.id;
          note = "Já registrado no BBOS";
        } else if (decision.action === "SETTLE") {
          const settlement = plan.settlement;
          if (plan.group !== "SETTLE" || !settlement) throw new Error("Não há conta em aberto para esta linha. Gere a prévia de novo.");
          // Dois Pix para a mesma conta: a baixa acontece uma vez, com a soma.
          if (!settled.has(settlement)) {
            settled.add(settlement);
            for (const allocation of settlement.allocations) {
              let payableId = allocation.id;
              if (allocation.kind === "INSTALLMENT") payableId = await this.payableForInstallment(allocation.id, actor.companyId);
              await this.finance.pay(payableId, {
                financialAccountId: account.id,
                amount: allocation.amount,
                method,
                paidAt: `${line.date}T12:00:00Z`,
                notes: `Baixa pelo extrato ${statement.bank} de ${line.date.split("-").reverse().join("/")}`,
                idempotencyKey: `${key}:${allocation.id}`,
                recordedById: actor.id,
                recordedByName: actor.name,
              }, actor.companyId);
            }
            if (settlement.extra > 0) {
              const category = (decision as any).extraCategory || settlement.extraCategory || "Outras despesas";
              await this.expense(actor, account.id, line, settlement.extra, category, `${key}:extra`, method, settlement.allocations.map((a) => a.label).join(", "));
            }
          }
          note = `Baixa: ${settlement.allocations.map((a) => a.label).join(", ")}${settlement.extra > 0 ? ` + ${settlement.extra.toFixed(2)} em despesa` : ""}`;
        } else if (decision.action === "EXPENSE") {
          if (line.amount >= 0) throw new Error("Entrada não pode virar despesa.");
          const category = String((decision as any).category ?? "").trim();
          if (!category) throw new Error("Escolha a categoria.");
          transactionId = await this.expense(actor, account.id, line, -line.amount, category, key, method);
          note = `Despesa: ${category}`;
        } else if (decision.action === "INCOME") {
          if (line.amount <= 0) throw new Error("Saída não pode virar entrada.");
          const category = String((decision as any).category ?? "").trim();
          if (!category) throw new Error("Diga o que é esta entrada.");
          const transfer = category === "Transferência entre contas" || category === "Aporte do sócio";
          const tx = await prisma.financialTransaction.create({
            data: {
              companyId: actor.companyId,
              financialAccountId: account.id,
              type: transfer ? FinancialTransactionType.TRANSFER_IN : FinancialTransactionType.RECEIPT,
              amount: line.amount,
              category,
              description: `${LEARN_PREFIX} · ${line.counterparty || line.description} · CNPJ/CPF ${line.taxId || "-"}`,
              occurredAt: new Date(`${line.date}T12:00:00Z`),
            },
          });
          transactionId = tx.id;
          note = `Entrada: ${category}`;
        } else {
          throw new Error("Ação inválida.");
        }

        await prisma.$transaction([
          prisma.reconciliationItem.update({
            where: { id: item.id },
            data: {
              status: ReconciliationStatus.MATCHED,
              matchedAmount: item.amount,
              difference: 0,
              matchedAt: new Date(),
              financialTransactionId: transactionId ?? undefined,
              notes: note.slice(0, 500),
            },
          }),
          prisma.reconciliationEvent.create({
            data: { companyId: actor.companyId, reconciliationItemId: item.id, statusFrom: item.status, statusTo: ReconciliationStatus.MATCHED, matchedAmount: item.amount, difference: 0, action: "STATEMENT_IMPORT", actor: actor.name } as any,
          }),
        ]);
        results.push({ externalId: line.externalId, status: "OK", message: note });
      } catch (error) {
        results.push({ externalId: line.externalId, status: "ERROR", message: error instanceof Error ? error.message : "Falha ao aplicar." });
      }
    }
    return {
      applied: results.filter((r) => r.status === "OK").length,
      skipped: results.filter((r) => r.status === "SKIPPED").length,
      errors: results.filter((r) => r.status === "ERROR").length,
      results,
    };
  }

  /** Despesa paga criada a partir da linha do extrato (sem centro de custo). */
  private async expense(actor: { id: string; name: string; companyId: string }, accountId: string, line: StatementLine, amount: number, category: string, key: string, method: string, related?: string) {
    const result = await this.finance.createPayable({
      companyId: actor.companyId,
      description: `${line.counterparty || line.description}${related ? ` · ${related}` : ""}`.slice(0, 180),
      issueDate: line.date,
      dueDate: line.date,
      amount,
      category,
      notes: `${LEARN_PREFIX} · ${line.description} · CNPJ/CPF ${line.taxId || "-"}`,
      createCost: false,
      paidNow: true,
      financialAccountId: accountId,
      paymentMethod: method,
      paidAt: line.date,
      idempotencyKey: key,
      createdById: actor.id,
      createdByName: actor.name,
    } as any);
    const payable: any = (result as any).payables?.[0];
    const payment = payable?.payments?.[0] ?? (payable ? await prisma.payment.findFirst({ where: { accountsPayableId: payable.id }, include: { transaction: true } }) : null);
    const transaction = payment?.transaction ?? (payment ? await prisma.financialTransaction.findUnique({ where: { paymentId: payment.id } }) : null);
    return transaction?.id ?? null;
  }

  /** Parcela de compra antiga sem conta a pagar: cria a conta como a aprovação faria. */
  private async payableForInstallment(installmentId: string, companyId: string) {
    return prisma.$transaction(async (tx) => {
      const installment = await tx.greenCoffeePurchaseInstallment.findFirst({
        where: { id: installmentId, purchase: { companyId } },
        include: { purchase: true },
      });
      if (!installment) throw new Error("Parcela da compra não encontrada.");
      if (installment.accountsPayableId) return installment.accountsPayableId;
      const payable = await tx.accountsPayable.create({
        data: {
          companyId,
          supplierId: installment.purchase.supplierId,
          description: `${installment.purchase.purchaseNumber} · parcela ${installment.installmentNumber}`,
          issueDate: installment.purchase.purchasedAt,
          dueDate: installment.dueDate,
          amount: installment.amount,
          openAmount: installment.amount,
          purchaseId: installment.purchase.id,
          category: "COMPRA_CAFE_VERDE",
          notes: `Gerado pela conciliação do extrato (compra ${installment.purchase.purchaseNumber})`,
        },
      });
      await tx.greenCoffeePurchaseInstallment.update({ where: { id: installment.id }, data: { accountsPayableId: payable.id } });
      return payable.id;
    });
  }
}
