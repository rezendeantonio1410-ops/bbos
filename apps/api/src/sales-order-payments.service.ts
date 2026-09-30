import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { prisma } from "@bbos/database";
import { randomUUID } from "node:crypto";
import { MercadoPagoService } from "./mercado-pago.service";
import { SalesOrderCustomerLifecycleService } from "./sales-order-customer-lifecycle.service";

type PaymentReason =
  | "CASH_ORDER"
  | "CREDIT_NOT_APPROVED"
  | "INSUFFICIENT_CREDIT";

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
    const email = String(order.email ?? "").trim().toLowerCase();
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
      const numbers = await this.database.$queryRawUnsafe<Array<{ next: number }>>(
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

    if (attempt.externalId && attempt.qrCode) return this.publicPayment(attempt);

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
        Date.now() + Number(providerOrder.pix?.expiresInSeconds ?? 86400) * 1000,
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
    const amountCents = Math.round(Number(providerOrder.total_amount ?? 0) * 100);
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
