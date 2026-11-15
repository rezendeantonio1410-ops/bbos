import { BadRequestException } from "@nestjs/common";
import { BISPO_PIX_KEY, buildBillingPix } from "./billing-pix";

// Read-only: generation never creates a receivable or records a payment.
export async function loadSalesOrderBillingData(
  database: any,
  order: any,
  companyId: string,
) {
  if (order.companyId !== companyId)
    throw new BadRequestException("Pedido não pertence à empresa.");
  if (
    order.paymentType !== "TERM" ||
    order.orderType === "SAMPLE" ||
    ["DRAFT", "CANCELLED"].includes(order.status)
  ) {
    throw new BadRequestException(
      "A cobrança está disponível para pedidos comerciais a prazo confirmados.",
    );
  }
  if (String(order.currency ?? "BRL") !== "BRL")
    throw new BadRequestException(
      "A cobrança Pix está disponível apenas para pedidos em reais.",
    );
  const [receivable, invoices, company] = await Promise.all([
    database.accountsReceivable.findFirst({
      where: {
        companyId,
        salesOrderId: order.id,
        customerId: order.customerId,
      },
    }),
    database.$queryRawUnsafe(
      `SELECT id,number,series,"accessKey",status FROM "FiscalDocument" WHERE "companyId"=$1 AND "salesOrderId"=$2 AND direction='OUTBOUND' ORDER BY "createdAt" DESC LIMIT 1`,
      companyId,
      order.id,
    ),
    database.company.findUnique({
      where: { id: companyId },
      select: { name: true, taxId: true },
    }),
  ]);
  if (!receivable)
    throw new BadRequestException(
      "Este pedido ainda não possui um título no contas a receber.",
    );
  const amountCents = Math.round(Number(receivable.amount) * 100);
  const openCents = Math.round(Number(receivable.openAmount) * 100);
  if (
    ["PAID", "CANCELLED"].includes(receivable.status) ||
    !["OPEN", "PARTIALLY_PAID", "OVERDUE"].includes(receivable.status) ||
    !Number.isSafeInteger(amountCents) ||
    !Number.isSafeInteger(openCents) ||
    openCents <= 0 ||
    openCents > amountCents
  ) {
    throw new BadRequestException(
      "Não há saldo válido em aberto para gerar esta cobrança.",
    );
  }
  if (
    !receivable.dueDate ||
    Number.isNaN(new Date(receivable.dueDate).getTime())
  )
    throw new BadRequestException(
      "Defina o vencimento no contas a receber antes de gerar a cobrança.",
    );
  const invoice = invoices[0];
  if (
    !invoice ||
    invoice.status !== "AUTHORIZED" ||
    !invoice.number ||
    !/^\d{44}$/.test(String(invoice.accessKey ?? ""))
  ) {
    throw new BadRequestException(
      "Aguarde a sincronização de uma NF-e autorizada com número e chave de acesso para este pedido.",
    );
  }
  if (String(company?.taxId ?? "").replace(/\D/g, "") !== BISPO_PIX_KEY)
    throw new BadRequestException(
      "A chave Pix desta empresa precisa ser configurada antes de gerar a cobrança.",
    );
  return {
    order,
    receivable,
    invoice,
    company,
    amountCents,
    openCents,
    pix: buildBillingPix(openCents, receivable.id),
  };
}
export type SalesOrderBillingData = Awaited<
  ReturnType<typeof loadSalesOrderBillingData>
>;
