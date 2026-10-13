import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  FinancialTransactionType,
  Prisma,
  ReceivableStatus,
  SalesOrderStatus,
  prisma,
} from "@bbos/database";
import { randomUUID } from "node:crypto";
import { MercadoPagoService } from "./mercado-pago.service";
import { SalesOrderCustomerLifecycleService } from "./sales-order-customer-lifecycle.service";

type PaymentReason =
  "CASH_ORDER" | "CREDIT_NOT_APPROVED" | "INSUFFICIENT_CREDIT";

type ManualPixActor = {
  id: string;
  name: string;
  role: string;
  companyId: string;
};

type ManualPixInput = {
  financialAccountId: string;
  reference: string;
  paidAt?: string;
};

const MANUAL_PIX_SOURCE = "SALES_ORDER_MANUAL_PIX";

@Injectable()
export class SalesOrderPaymentsService {
  private readonly database = prisma;

  constructor(
    private readonly mercadoPago: MercadoPagoService,
    private readonly customerLifecycle: SalesOrderCustomerLifecycleService,
  ) {}

  private publicPayment(attempt: any) {
    if (!attempt) return null;
    return {
      status: attempt.status,
      method: attempt.method,
      amountCents: Number(attempt.amountCents),
      ticketUrl: attempt.ticketUrl ?? null,
      qrCode: attempt.qrCode ?? null,
      qrCodeBase64: attempt.qrCodeBase64 ?? null,
      expiresAt: attempt.expiresAt ?? null,
      paidAt: attempt.paidAt ?? null,
      paymentReason: attempt.paymentReason ?? null,
    };
  }

  async manualPixInfo(companyId: string, orderId: string) {
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT so.id,so.status::text,so."orderType",so."totalAmount",
              COALESCE(so."orderNumber",so.code) AS "orderNumber",
              ar.id AS "receivableId",ar.status::text AS "receivableStatus",
              ar."openAmount",ar."paymentDate",
              payment.id AS "paymentId",payment.amount AS "paidAmount",
              payment."paidAt",payment.method,payment.source,payment.reference,
              payment."recordedByName",payment."recordedByRole",
              account.id AS "financialAccountId",account.name AS "financialAccountName"
         FROM "SalesOrder" so
         LEFT JOIN "AccountsReceivable" ar ON ar."salesOrderId"=so.id
         LEFT JOIN LATERAL (
           SELECT p.* FROM "Payment" p
            WHERE p."accountsReceivableId"=ar.id
            ORDER BY p."createdAt" DESC LIMIT 1
         ) payment ON TRUE
         LEFT JOIN "FinancialAccount" account ON account.id=payment."financialAccountId"
        WHERE so.id=$1 AND so."companyId"=$2 LIMIT 1`,
      orderId,
      companyId,
    );
    const order = rows[0];
    if (!order) throw new NotFoundException("Pedido não encontrado.");
    const accounts = await this.database.financialAccount.findMany({
      where: {
        companyId,
        active: true,
        currency: "BRL",
        NOT: { id: { startsWith: "shipping-account:" } },
      },
      select: {
        id: true,
        name: true,
        type: true,
        currency: true,
        financialInstitution: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    });
    const paid =
      order.receivableStatus === ReceivableStatus.PAID ||
      Number(order.openAmount ?? order.totalAmount) <= 0;
    const eligible =
      order.orderType !== "SAMPLE" &&
      order.status !== SalesOrderStatus.CANCELLED &&
      Number(order.totalAmount) > 0;
    return {
      eligible,
      paid,
      orderStatus: order.status,
      amount: paid
        ? Number(order.paidAmount ?? order.totalAmount)
        : Number(order.openAmount ?? order.totalAmount),
      accounts,
      approval: order.paymentId
        ? {
            source: order.source,
            method: order.method,
            amount: Number(order.paidAmount ?? 0),
            paidAt: order.paidAt,
            reference: order.reference,
            recordedByName: order.recordedByName,
            recordedByRole: order.recordedByRole,
            financialAccountId: order.financialAccountId,
            financialAccountName: order.financialAccountName,
            manual: order.source === MANUAL_PIX_SOURCE,
          }
        : null,
    };
  }

  async confirmManualPix(
    orderId: string,
    input: ManualPixInput,
    actor: ManualPixActor,
  ) {
    if (actor.role !== "ADMIN") {
      throw new ForbiddenException(
        "Somente administradores autorizados podem confirmar um Pix manualmente.",
      );
    }
    const financialAccountId = String(input.financialAccountId ?? "").trim();
    const reference = String(input.reference ?? "")
      .trim()
      .slice(0, 180);
    const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
    if (!financialAccountId)
      throw new BadRequestException("Selecione a conta que recebeu o Pix.");
    if (!reference)
      throw new BadRequestException(
        "Informe o identificador do Pix ou uma referência do comprovante.",
      );
    if (Number.isNaN(paidAt.getTime()))
      throw new BadRequestException("Data do recebimento inválida.");
    if (paidAt.getTime() > Date.now() + 5 * 60 * 1000)
      throw new BadRequestException(
        "A data do recebimento não pode estar no futuro.",
      );

    const preview = await this.manualPixInfo(actor.companyId, orderId);
    if (preview.paid) {
      return { idempotent: true, ...preview };
    }
    if (!preview.eligible) {
      throw new BadRequestException(
        "Este pedido não está disponível para confirmação manual de pagamento.",
      );
    }
    if (
      !preview.accounts.some((account) => account.id === financialAccountId)
    ) {
      throw new BadRequestException("Conta financeira inválida ou inativa.");
    }

    await this.cancelPendingForManualConfirmation(orderId);
    const idempotencyKey = `sales-order:manual-pix:${orderId}`;
    const result = await this.database.$transaction(
      async (transaction) => {
        const locked = await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "SalesOrder"
           WHERE id=${orderId} AND "companyId"=${actor.companyId}
           FOR UPDATE
        `;
        if (!locked[0]) throw new NotFoundException("Pedido não encontrado.");

        const order = await transaction.salesOrder.findFirst({
          where: { id: orderId, companyId: actor.companyId },
          select: {
            id: true,
            companyId: true,
            customerId: true,
            orderNumber: true,
            code: true,
            orderType: true,
            status: true,
            totalAmount: true,
          },
        });
        if (!order) throw new NotFoundException("Pedido não encontrado.");
        if (
          order.orderType === "SAMPLE" ||
          order.status === SalesOrderStatus.CANCELLED
        ) {
          throw new BadRequestException(
            "Este pedido não está disponível para confirmação manual de pagamento.",
          );
        }

        const existing = await transaction.payment.findUnique({
          where: { idempotencyKey },
        });
        if (existing) return { idempotent: true, paymentId: existing.id };

        const account = await transaction.financialAccount.findFirst({
          where: {
            id: financialAccountId,
            companyId: actor.companyId,
            active: true,
            currency: "BRL",
            NOT: { id: { startsWith: "shipping-account:" } },
          },
        });
        if (!account)
          throw new BadRequestException(
            "Conta financeira inválida ou inativa.",
          );

        let receivable = await transaction.accountsReceivable.findUnique({
          where: { salesOrderId: orderId },
        });
        if (!receivable) {
          receivable = await transaction.accountsReceivable.create({
            data: {
              companyId: order.companyId,
              customerId: order.customerId,
              salesOrderId: order.id,
              issueDate: paidAt,
              dueDate: paidAt,
              amount: order.totalAmount,
              openAmount: order.totalAmount,
              status: ReceivableStatus.OPEN,
              notes: "Título criado pela confirmação manual de Pix do pedido.",
            },
          });
        }
        if (
          receivable.status === ReceivableStatus.PAID ||
          receivable.status === ReceivableStatus.CANCELLED ||
          Number(receivable.openAmount) <= 0
        ) {
          throw new BadRequestException(
            "Este pedido já está quitado ou cancelado.",
          );
        }

        const amount = Math.round(Number(receivable.openAmount) * 100) / 100;
        const payment = await transaction.payment.create({
          data: {
            companyId: order.companyId,
            accountsReceivableId: receivable.id,
            financialAccountId: account.id,
            amount,
            paidAt,
            method: "PIX",
            source: MANUAL_PIX_SOURCE,
            reference,
            recordedById: actor.id,
            recordedByName: actor.name,
            recordedByRole: actor.role,
            notes: `Pix confirmado manualmente por ${actor.name} (${actor.role}). Referência: ${reference}`,
            idempotencyKey,
          },
        });
        await transaction.financialTransaction.create({
          data: {
            companyId: order.companyId,
            financialAccountId: account.id,
            paymentId: payment.id,
            type: FinancialTransactionType.RECEIPT,
            amount,
            category: "RECEBIMENTO_PIX",
            description: `Pix do pedido ${order.orderNumber ?? order.code} confirmado por ${actor.name}`,
            occurredAt: paidAt,
          },
        });
        await transaction.accountsReceivable.update({
          where: { id: receivable.id },
          data: {
            openAmount: 0,
            status: ReceivableStatus.PAID,
            paymentDate: paidAt,
          },
        });
        if (order.status === SalesOrderStatus.DRAFT) {
          await transaction.salesOrder.update({
            where: { id: order.id },
            data: {
              status: SalesOrderStatus.CONFIRMED,
              paymentType: "CASH",
              paymentTermsSnapshot: "Pix direto · confirmado manualmente",
            },
          });
        }
        await transaction.$executeRawUnsafe(
          `UPDATE "SalesOrderPaymentAttempt"
              SET status='CANCELLED',"nextAttemptAt"=NULL,"processingStartedAt"=NULL,
                  metadata=COALESCE(metadata,'{}'::jsonb) || $2::jsonb,"updatedAt"=NOW()
            WHERE "salesOrderId"=$1
              AND status IN ('CREATING','AWAITING_PAYMENT','PROCESSING','ERROR')`,
          order.id,
          JSON.stringify({
            replacedByManualPix: true,
            manualPaymentId: payment.id,
            approvedBy: actor.name,
          }),
        );
        return { idempotent: false, paymentId: payment.id };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (!result.idempotent) {
      await this.customerLifecycle.record(
        orderId,
        "PAYMENT_CONFIRMED",
        "Pagamento confirmado",
        "O pagamento via Pix foi conferido e aprovado manualmente pela equipe Bispo Coffees.",
        "ADMIN",
        `sales-order:manual-pix-confirmed:${result.paymentId}`,
        { paymentId: result.paymentId, approvedBy: actor.name },
        false,
      );
    }
    return {
      idempotent: result.idempotent,
      ...(await this.manualPixInfo(actor.companyId, orderId)),
    };
  }

  private mercadoPagoOrderIsPaid(providerOrder: any) {
    return (
      (providerOrder?.status === "processed" &&
        providerOrder?.status_detail === "accredited") ||
      providerOrder?.transactions?.payments?.some(
        (payment: any) =>
          payment.status === "processed" &&
          payment.status_detail === "accredited",
      )
    );
  }

  private async cancelPendingForManualConfirmation(orderId: string) {
    const attempts = await this.database.$queryRawUnsafe<any[]>(
      `SELECT * FROM "SalesOrderPaymentAttempt"
        WHERE "salesOrderId"=$1
          AND status IN ('CREATING','AWAITING_PAYMENT','PROCESSING','ERROR')
        ORDER BY "attemptNumber" DESC LIMIT 1`,
      orderId,
    );
    const attempt = attempts[0];
    if (!attempt) return;
    let providerStatus = "canceled";
    let providerStatusDetail: string | null = "manual_payment_confirmed";
    if (attempt.externalId) {
      try {
        let providerOrder = await this.mercadoPago.getOrder(attempt.externalId);
        if (this.mercadoPagoOrderIsPaid(providerOrder)) {
          await this.reconcileByExternalId(attempt.externalId);
          throw new BadRequestException(
            "O Mercado Pago já confirmou este Pix. Atualize o pedido antes de continuar.",
          );
        }
        const terminal = new Set(["failed", "canceled", "expired"]);
        if (!terminal.has(String(providerOrder.status ?? ""))) {
          const cancellable = new Set(["created", "action_required"]);
          if (!cancellable.has(String(providerOrder.status ?? ""))) {
            throw new ServiceUnavailableException(
              "A cobrança do Mercado Pago ainda está sendo processada. Aguarde a atualização antes da confirmação manual.",
            );
          }
          providerOrder = await this.mercadoPago.cancelOrder(
            attempt.externalId,
            `sales-order-manual-pix-cancel:${attempt.id}`,
          );
        }
        providerStatus = String(providerOrder.status ?? "canceled");
        providerStatusDetail = providerOrder.status_detail ?? null;
      } catch (error) {
        if (
          error instanceof BadRequestException ||
          error instanceof ServiceUnavailableException
        ) {
          throw error;
        }
        throw new ServiceUnavailableException(
          "Não foi possível encerrar a cobrança anterior do Mercado Pago. Tente novamente em instantes.",
        );
      }
    }
    await this.database.$executeRawUnsafe(
      `UPDATE "SalesOrderPaymentAttempt"
          SET status=CASE
                WHEN $2='expired' THEN 'EXPIRED'
                WHEN $2='failed' THEN 'FAILED'
                ELSE 'CANCELLED'
              END,
              "providerStatus"=$2,"providerStatusDetail"=$3,
              "nextAttemptAt"=NULL,"processingStartedAt"=NULL,
              metadata=COALESCE(metadata,'{}'::jsonb) || $4::jsonb,
              "updatedAt"=NOW()
        WHERE id=$1 AND status<>'PAID'`,
      attempt.id,
      providerStatus,
      providerStatusDetail,
      JSON.stringify({ replacedByManualPix: true }),
    );
  }

  async forOrder(orderId: string, reconcile = false) {
    let rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT * FROM "SalesOrderPaymentAttempt"
        WHERE "salesOrderId"=$1 ORDER BY "attemptNumber" DESC LIMIT 1`,
      orderId,
    );
    if (
      reconcile &&
      rows[0]?.externalId &&
      ["AWAITING_PAYMENT", "PROCESSING"].includes(rows[0].status)
    ) {
      await this.reconcileByExternalId(rows[0].externalId);
      rows = await this.database.$queryRawUnsafe<any[]>(
        `SELECT * FROM "SalesOrderPaymentAttempt"
          WHERE "salesOrderId"=$1 ORDER BY "attemptNumber" DESC LIMIT 1`,
        orderId,
      );
    }
    return this.publicPayment(rows[0]);
  }

  async ensurePix(
    orderId: string,
    paymentReason: PaymentReason,
    paymentUrl: string,
    forceNew = false,
  ) {
    const orders = await this.database.$queryRawUnsafe<any[]>(
      `SELECT so.id,so."companyId",COALESCE(so."orderNumber",so.code) AS code,
              so."totalAmount",so.status,c.name AS "customerName",c.email,c.phone,
              c."postalCode",c.address,c.district,c.city,c.state
         FROM "SalesOrder" so JOIN "Customer" c ON c.id=so."customerId"
        WHERE so.id=$1 LIMIT 1`,
      orderId,
    );
    const order = orders[0];
    if (!order) throw new BadRequestException("Pedido não encontrado.");
    const email = String(order.email ?? "")
      .trim()
      .toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException(
        "Cadastre um e-mail válido para enviar o Pix deste pedido.",
      );
    }

    let attempts = await this.database.$queryRawUnsafe<any[]>(
      `SELECT * FROM "SalesOrderPaymentAttempt"
        WHERE "salesOrderId"=$1 AND status IN ('CREATING','AWAITING_PAYMENT','PROCESSING','ERROR')
        ORDER BY "attemptNumber" DESC LIMIT 1`,
      orderId,
    );
    if (forceNew && attempts[0]) {
      await this.database.$executeRawUnsafe(
        `UPDATE "SalesOrderPaymentAttempt"
            SET status='CANCELLED',"updatedAt"=NOW()
          WHERE id=$1 AND status IN ('CREATING','AWAITING_PAYMENT','PROCESSING','ERROR')`,
        attempts[0].id,
      );
      attempts = [];
    }

    let attempt = attempts[0];
    if (!attempt) {
      const numbers = await this.database.$queryRawUnsafe<
        Array<{ next: number }>
      >(
        `SELECT COALESCE(MAX("attemptNumber"),0)::int + 1 AS next
           FROM "SalesOrderPaymentAttempt" WHERE "salesOrderId"=$1`,
        orderId,
      );
      const attemptNumber = Number(numbers[0]?.next ?? 1);
      const idempotencyKey = `sales-order-pix:${orderId}:${attemptNumber}`;
      const created = await this.database.$queryRawUnsafe<any[]>(
        `INSERT INTO "SalesOrderPaymentAttempt"
          (id,"companyId","salesOrderId",provider,method,status,"attemptNumber",
           "amountCents","idempotencyKey","paymentReason",attempts,"nextAttemptAt",metadata,"createdAt","updatedAt")
         VALUES ($1,$2,$3,'MERCADO_PAGO','PIX','CREATING',$4,$5,$6,$7,0,NOW(),$8::jsonb,NOW(),NOW())
         RETURNING *`,
        randomUUID(),
        order.companyId,
        order.id,
        attemptNumber,
        Math.round(Number(order.totalAmount) * 100),
        idempotencyKey,
        paymentReason,
        JSON.stringify({ paymentUrl }),
      );
      attempt = created[0];
    }

    if (attempt.externalId && attempt.qrCode)
      return this.publicPayment(attempt);

    const items = await this.database.$queryRawUnsafe<any[]>(
      `SELECT "productName",sku,quantity,"unitPrice"
         FROM "SalesOrderItem" WHERE "salesOrderId"=$1 ORDER BY "createdAt" ASC`,
      orderId,
    );
    try {
      const providerOrder = await this.mercadoPago.createPix({
        paymentMethod: "PIX",
        idempotencyKey: attempt.idempotencyKey,
        orderCode: order.code,
        totalCents: Number(attempt.amountCents),
        shippingCents: 0,
        items: items.map((item) => ({
          externalCode: String(item.sku ?? "CAFE-BISPO"),
          title: String(item.productName ?? "Café Bispo"),
          quantity: Number(item.quantity),
          unitPriceCents: Math.round(Number(item.unitPrice) * 100),
        })),
        payer: {
          name: String(order.customerName ?? ""),
          email,
          phone: String(order.phone ?? ""),
          cpf: "",
        },
        delivery: {
          postalCode: String(order.postalCode ?? ""),
          street: String(order.address ?? ""),
          number: "",
          district: String(order.district ?? ""),
          city: String(order.city ?? ""),
          state: String(order.state ?? ""),
        },
      });
      const expiresAt = new Date(
        Date.now() +
          Number(providerOrder.pix?.expiresInSeconds ?? 86400) * 1000,
      );
      const updated = await this.database.$queryRawUnsafe<any[]>(
        `UPDATE "SalesOrderPaymentAttempt"
            SET status='AWAITING_PAYMENT',"externalId"=$2,"ticketUrl"=$3,
                "qrCode"=$4,"qrCodeBase64"=$5,"providerStatus"=$6,
                "providerStatusDetail"=$7,"expiresAt"=$8,"lastError"=NULL,
                "nextAttemptAt"=NOW() + INTERVAL '20 seconds',
                metadata=metadata || $9::jsonb,"updatedAt"=NOW()
          WHERE id=$1 RETURNING *`,
        attempt.id,
        providerOrder.id,
        providerOrder.pix?.ticketUrl ?? null,
        providerOrder.pix?.qrCode ?? null,
        providerOrder.pix?.qrCodeBase64 ?? null,
        providerOrder.status ?? null,
        providerOrder.status_detail ?? null,
        expiresAt,
        JSON.stringify({ paymentUrl }),
      );
      await this.customerLifecycle.record(
        order.id,
        "PAYMENT_AWAITING",
        "Pedido confirmado · Pix disponível",
        "Recebemos sua confirmação. Como esta compra não utiliza limite de crédito, o Pix já está disponível no ambiente seguro da Bispo.",
        "BBOS",
        `sales-order:pix-created:${attempt.id}`,
        { paymentUrl, paymentReason },
      );
      return this.publicPayment(updated[0]);
    } catch (error) {
      await this.database.$executeRawUnsafe(
        `UPDATE "SalesOrderPaymentAttempt"
            SET status='ERROR',attempts=attempts+1,"lastError"=$2,
                "nextAttemptAt"=NOW() + INTERVAL '30 seconds',"updatedAt"=NOW() WHERE id=$1`,
        attempt.id,
        (error instanceof Error ? error.message : String(error)).slice(0, 2000),
      );
      throw new ServiceUnavailableException(
        "O pedido foi confirmado, mas o Pix não pôde ser preparado agora. Tente novamente em instantes.",
      );
    }
  }

  async reconcileByExternalId(externalId: string) {
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT p.*,COALESCE(so."orderNumber",so.code) AS code,so.status AS "orderStatus"
         FROM "SalesOrderPaymentAttempt" p
         JOIN "SalesOrder" so ON so.id=p."salesOrderId"
        WHERE p.provider='MERCADO_PAGO' AND p."externalId"=$1 LIMIT 1`,
      externalId,
    );
    const attempt = rows[0];
    if (!attempt) return { found: false, paid: false };
    let providerOrder;
    try {
      providerOrder = await this.mercadoPago.getOrder(externalId);
    } catch (error) {
      await this.database.$executeRawUnsafe(
        `UPDATE "SalesOrderPaymentAttempt"
            SET status='ERROR',attempts=attempts+1,"lastError"=$2,
                "nextAttemptAt"=NOW() + INTERVAL '30 seconds',"updatedAt"=NOW()
          WHERE id=$1 AND status<>'PAID'`,
        attempt.id,
        (error instanceof Error ? error.message : String(error)).slice(0, 2000),
      );
      return { found: true, paid: false, transientError: true };
    }
    const amountCents = Math.round(
      Number(providerOrder.total_amount ?? 0) * 100,
    );
    if (
      providerOrder.id !== attempt.externalId ||
      providerOrder.external_reference !== attempt.code ||
      amountCents !== Number(attempt.amountCents)
    ) {
      await this.database.$executeRawUnsafe(
        `UPDATE "SalesOrderPaymentAttempt"
            SET status='ERROR',"lastError"='Divergência entre o pedido BBOS e o Mercado Pago',
                "providerStatus"=$2,"providerStatusDetail"=$3,
                "nextAttemptAt"=NOW() + INTERVAL '5 minutes',"updatedAt"=NOW()
          WHERE id=$1`,
        attempt.id,
        providerOrder.status ?? null,
        providerOrder.status_detail ?? null,
      );
      return { found: true, paid: false, divergent: true };
    }

    const paid =
      providerOrder.status === "processed" &&
      providerOrder.status_detail === "accredited";
    if (paid) {
      const changed = await this.database.$transaction(async (transaction) => {
        const attemptUpdated = await transaction.$executeRawUnsafe(
          `UPDATE "SalesOrderPaymentAttempt"
              SET status='PAID',"paidAt"=COALESCE("paidAt",NOW()),
                  "providerStatus"=$2,"providerStatusDetail"=$3,"lastError"=NULL,
                  "nextAttemptAt"=NULL,"processingStartedAt"=NULL,
                  "updatedAt"=NOW()
            WHERE id=$1 AND status<>'PAID'`,
          attempt.id,
          providerOrder.status,
          providerOrder.status_detail,
        );
        const orderConfirmed = await transaction.$executeRawUnsafe(
          `UPDATE "SalesOrder" SET status='CONFIRMED',"paymentType"='CASH',
                  "paymentTermsSnapshot"='Pix',"updatedAt"=NOW()
            WHERE id=$1 AND status='DRAFT'`,
          attempt.salesOrderId,
        );
        return {
          attemptUpdated: Boolean(attemptUpdated),
          orderConfirmed: Boolean(orderConfirmed),
        };
      });
      if (changed.attemptUpdated && changed.orderConfirmed) {
        await this.customerLifecycle.record(
          attempt.salesOrderId,
          "PAYMENT_CONFIRMED",
          "Pagamento confirmado",
          "O Pix foi confirmado. Seu pedido seguirá agora para separação e preparação.",
          "BBOS",
          `sales-order:payment-confirmed:${attempt.id}`,
          { externalId },
        );
      } else if (changed.attemptUpdated && !changed.orderConfirmed) {
        await this.customerLifecycle.record(
          attempt.salesOrderId,
          "PAYMENT_EXCEPTION",
          "Pagamento recebido após encerramento do pedido",
          "O pagamento foi identificado, mas o pedido já não estava disponível para avanço automático. A equipe financeira fará a conferência.",
          "BBOS",
          `sales-order:payment-after-close:${attempt.id}`,
          { externalId, previousOrderStatus: attempt.orderStatus },
          false,
        );
      }
      return { found: true, paid: true };
    }

    const terminal = new Set(["failed", "canceled", "expired"]);
    const status = terminal.has(String(providerOrder.status))
      ? providerOrder.status === "canceled"
        ? "CANCELLED"
        : providerOrder.status === "expired"
          ? "EXPIRED"
          : "FAILED"
      : "AWAITING_PAYMENT";
    await this.database.$executeRawUnsafe(
      `UPDATE "SalesOrderPaymentAttempt"
          SET status=$2,"providerStatus"=$3,"providerStatusDetail"=$4,
              "nextAttemptAt"=CASE WHEN $2='AWAITING_PAYMENT' THEN NOW() + INTERVAL '20 seconds' ELSE NULL END,
              "processingStartedAt"=NULL,"updatedAt"=NOW() WHERE id=$1 AND status<>'PAID'`,
      attempt.id,
      status,
      providerOrder.status ?? null,
      providerOrder.status_detail ?? null,
    );
    return { found: true, paid: false, status };
  }
}
