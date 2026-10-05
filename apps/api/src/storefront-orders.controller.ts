import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  OnModuleInit,
  OnModuleDestroy,
  Param,
  Post,
  Query,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { prisma, SalesOrderStatus } from "@bbos/database";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Public } from "./auth.guard";
import { MercadoPagoService } from "./mercado-pago.service";
import { StorefrontShippingService } from "./storefront-shipping.service";
import { StorefrontLifecycleService } from "./storefront-lifecycle.service";
import { StorefrontCouponsService } from "./storefront-coupons.service";
import { StorefrontCustomerService } from "./storefront-customer.service";
import { SalesOrderPaymentsService } from "./sales-order-payments.service";
import { SalesOrdersService } from "./sales-orders.service";

const catalog: Record<
  string,
  { name: string; unitPriceCents: number; weightGrams: number }
> = {
  essencial: { name: "Essencial", unitPriceCents: 5200, weightGrams: 500 },
  intenso: { name: "Intenso", unitPriceCents: 5200, weightGrams: 500 },
  caramelo: { name: "Caramelo", unitPriceCents: 6800, weightGrams: 500 },
  "doce-de-leite": {
    name: "Doce de Leite",
    unitPriceCents: 6800,
    weightGrams: 500,
  },
  tangerina: { name: "Tangerina", unitPriceCents: 6800, weightGrams: 500 },
  singular: { name: "Singular", unitPriceCents: 8400, weightGrams: 500 },
  sublime: { name: "Sublime", unitPriceCents: 8400, weightGrams: 500 },
  raros: { name: "Raro", unitPriceCents: 5200, weightGrams: 250 },
};
const groundProductIds = new Set(["essencial", "intenso"]);
const preparationFor = (id: string) =>
  groundProductIds.has(id) ? "Moído" : "Grãos";
const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");
const tokenHash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

function validCpf(value: unknown) {
  const cpf = digits(value);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  for (let size = 9; size <= 10; size += 1) {
    let sum = 0;
    for (let index = 0; index < size; index += 1)
      sum += Number(cpf[index]) * (size + 1 - index);
    const check = ((sum * 10) % 11) % 10;
    if (check !== Number(cpf[size])) return false;
  }
  return true;
}

type CheckoutBody = {
  idempotencyKey?: string;
  shippingQuoteId?: string;
  paymentMethod?: string;
  customer?: { name?: string; email?: string; phone?: string; cpf?: string };
  delivery?: {
    postalCode?: string;
    street?: string;
    number?: string;
    complement?: string;
    district?: string;
    city?: string;
    state?: string;
  };
  items?: Array<{ id?: string; quantity?: number; grind?: string }>;
  recurrence?: {
    mode?: string;
    reminderDays?: number;
    rhythmDays?: number;
  };
  couponCode?: string;
};

@Controller("storefront/orders")
export class StorefrontOrdersController
  implements OnModuleInit, OnModuleDestroy
{
  private readonly database = prisma;
  private reconciliationTimer?: NodeJS.Timeout;
  private reconcilingPayments = false;

  constructor(
    private readonly mercadoPago: MercadoPagoService,
    private readonly shipping: StorefrontShippingService,
    private readonly lifecycle: StorefrontLifecycleService,
    private readonly coupons: StorefrontCouponsService,
    private readonly customers: StorefrontCustomerService,
    private readonly salesOrderPayments: SalesOrderPaymentsService,
    private readonly salesOrders: SalesOrdersService,
  ) {}

  async onModuleInit() {
    const pending = await this.database.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT so.id
         FROM "StorefrontOrder" so
         LEFT JOIN "SalesOrder" s
           ON s."companyId"=so."companyId" AND s.code=so.code
        WHERE s.id IS NULL
        ORDER BY so."createdAt" ASC
        LIMIT 100`,
    );
    for (const order of pending) {
      try {
        await this.syncSalesOrder(order.id);
      } catch (error) {
        console.error("Não foi possível sincronizar pedido da loja no BBOS", {
          storefrontOrderId: order.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const cancelledDrafts = await this.database.$queryRawUnsafe<
      Array<{ id: string }>
    >(
      `SELECT so.id
         FROM "StorefrontOrder" so
         JOIN "SalesOrder" s
           ON s."companyId"=so."companyId" AND s.code=so.code
        WHERE so.status='CANCELLED'
          AND s.status='DRAFT'
        ORDER BY so."updatedAt" ASC
        LIMIT 100`,
    );
    for (const order of cancelledDrafts) {
      try {
        await this.syncSalesOrder(order.id);
      } catch (error) {
        console.error("Não foi possível sincronizar pedido cancelado da loja", {
          storefrontOrderId: order.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Webhook é o caminho principal, mas pagamentos não podem ficar presos caso
    // uma notificação externa atrase ou falhe. Reconciliamos pedidos pendentes
    // em segundo plano e também na consulta pública de status.
    void this.reconcilePendingMercadoPagoOrders();
    this.reconciliationTimer = setInterval(
      () => void this.reconcilePendingMercadoPagoOrders(),
      15_000,
    );
    this.reconciliationTimer.unref();
  }

  async onModuleDestroy() {
    if (this.reconciliationTimer) clearInterval(this.reconciliationTimer);
    await this.database.$disconnect();
  }

  private async processPendingMercadoPagoWebhookEvents() {
    for (let index = 0; index < 20; index += 1) {
      const rows = await this.database.$queryRawUnsafe<any[]>(
        `WITH candidate AS (
           SELECT id
             FROM "IntegrationWebhookEvent"
            WHERE provider='MERCADO_PAGO' AND status='RECEIVED'
            ORDER BY "receivedAt" ASC
            FOR UPDATE SKIP LOCKED
            LIMIT 1
         )
         UPDATE "IntegrationWebhookEvent" w
            SET status='PROCESSED',"processedAt"=NOW(),"lastError"=NULL
           FROM candidate
          WHERE w.id=candidate.id
         RETURNING w.*`,
      );
      const event = rows[0];
      if (!event) break;

      try {
        const payload = event.payload ?? {};
        const externalId = String(
          payload?._bbosExternalId ?? payload?.data?.id ?? payload?.id ?? "",
        ).trim();
        if (!externalId) {
          await this.database.$executeRawUnsafe(
            `UPDATE "IntegrationWebhookEvent"
                SET status='IGNORED',"processedAt"=NOW(),"lastError"='Evento sem identificador da order'
              WHERE id=$1`,
            event.id,
          );
          continue;
        }

        const attempts = await this.database.$queryRawUnsafe<any[]>(
          `SELECT p.*,o.code,o."totalCents"
             FROM "StorefrontPaymentAttempt" p
             JOIN "StorefrontOrder" o ON o.id=p."storefrontOrderId"
            WHERE p.provider='MERCADO_PAGO' AND p."externalId"=$1
            LIMIT 1`,
          externalId,
        );
        const attempt = attempts[0];
        if (!attempt) {
          const commercialAttempts = await this.database.$queryRawUnsafe<any[]>(
            `SELECT id FROM "SalesOrderPaymentAttempt"
              WHERE provider='MERCADO_PAGO' AND "externalId"=$1 LIMIT 1`,
            externalId,
          );
          if (commercialAttempts[0]) {
            await this.salesOrderPayments.reconcileByExternalId(externalId);
            continue;
          }
          await this.database.$executeRawUnsafe(
            `UPDATE "IntegrationWebhookEvent"
                SET status='IGNORED',"processedAt"=NOW(),"lastError"='Order do Mercado Pago sem tentativa correspondente no BBOS'
              WHERE id=$1`,
            event.id,
          );
          continue;
        }

        await this.reconcileMercadoPago({
          id: attempt.storefrontOrderId,
          code: attempt.code,
          totalCents: attempt.totalCents,
          paymentExternalId: externalId,
        });
      } catch (error) {
        await this.database.$executeRawUnsafe(
          `UPDATE "IntegrationWebhookEvent"
              SET status='ERROR',"processedAt"=NOW(),"lastError"=$2
            WHERE id=$1`,
          event.id,
          (error instanceof Error ? error.message : String(error)).slice(
            0,
            2000,
          ),
        );
      }
    }
  }

  private async reconcilePendingMercadoPagoOrders() {
    if (this.reconcilingPayments) return;
    this.reconcilingPayments = true;
    try {
      await this.processPendingMercadoPagoWebhookEvents();

      for (let index = 0; index < 20; index += 1) {
        const rows = await this.database.$queryRawUnsafe<any[]>(
          `WITH candidate AS (
             SELECT p.id
               FROM "StorefrontPaymentAttempt" p
               JOIN "StorefrontOrder" o ON o.id=p."storefrontOrderId"
              WHERE p."externalId" IS NOT NULL
                AND p."externalId"=o."paymentExternalId"
                AND o.status='AWAITING_PAYMENT'
                AND (
                  (p.status='AWAITING_PAYMENT' AND (p."nextAttemptAt" IS NULL OR p."nextAttemptAt" <= NOW()))
                  OR (p.status='PROCESSING' AND p."processingStartedAt" < NOW() - INTERVAL '2 minutes')
                  OR (p.status='ERROR' AND (p."nextAttemptAt" IS NULL OR p."nextAttemptAt" <= NOW()))
                  OR (p.status='FAILED' AND p."nextAttemptAt" IS NULL)
                )
              ORDER BY p."updatedAt" ASC
              FOR UPDATE OF p SKIP LOCKED
              LIMIT 1
           )
           UPDATE "StorefrontPaymentAttempt" p
              SET status='PROCESSING',
                  attempts=p.attempts+1,
                  "processingStartedAt"=NOW(),
                  "updatedAt"=NOW()
             FROM candidate
            WHERE p.id=candidate.id
           RETURNING p.*`,
        );
        const attempt = rows[0];
        if (!attempt) break;

        const orders = await this.database.$queryRawUnsafe<any[]>(
          `SELECT id,code,"totalCents","paymentExternalId"
             FROM "StorefrontOrder"
            WHERE id=$1
            LIMIT 1`,
          attempt.storefrontOrderId,
        );
        const order = orders[0];
        if (!order) {
          await this.database.$executeRawUnsafe(
            `UPDATE "StorefrontPaymentAttempt"
                SET status='ERROR',"lastError"='Pedido não encontrado',
                    "nextAttemptAt"=NULL,"updatedAt"=NOW()
              WHERE id=$1`,
            attempt.id,
          );
          continue;
        }

        try {
          await this.reconcileMercadoPago({
            ...order,
            paymentExternalId: attempt.externalId,
          });
        } catch (error) {
          // A falha de consulta é transitória: o pedido pendente deve continuar
          // sendo reconciliado até ser pago, recusado ou expirar.
          const attempts = Number(attempt.attempts ?? 0);
          const delaySeconds = Math.min(
            300,
            Math.max(15, 2 ** Math.min(attempts, 8)),
          );
          await this.database.$executeRawUnsafe(
            `UPDATE "StorefrontPaymentAttempt"
                SET status='ERROR',
                    "lastError"=$2,
                    "nextAttemptAt"=NOW() + ($3 || ' seconds')::interval,
                    "processingStartedAt"=NULL,
                    "updatedAt"=NOW()
              WHERE id=$1`,
            attempt.id,
            (error instanceof Error ? error.message : String(error)).slice(
              0,
              2000,
            ),
            String(delaySeconds),
          );
        }
      }

      const commercialPending = await this.database.$queryRawUnsafe<
        Array<{ externalId: string }>
      >(
        `SELECT "externalId"
           FROM "SalesOrderPaymentAttempt"
          WHERE status IN ('AWAITING_PAYMENT','PROCESSING','ERROR')
            AND "externalId" IS NOT NULL
            AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= NOW())
          ORDER BY "updatedAt" ASC
          LIMIT 20`,
      );
      for (const payment of commercialPending) {
        try {
          await this.salesOrderPayments.reconcileByExternalId(
            payment.externalId,
          );
        } catch (error) {
          console.error("Falha ao reconciliar Pix de pedido comercial", {
            externalId: payment.externalId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const reminderCandidates = await this.database.$queryRawUnsafe<
        Array<{ id: string; code: string }>
      >(
        `SELECT id,code
           FROM "StorefrontOrder"
          WHERE status='AWAITING_PAYMENT'
            AND "createdAt" <= NOW() - INTERVAL '30 minutes'
            AND "createdAt" > NOW() - INTERVAL '24 hours'
          ORDER BY "createdAt" ASC
          LIMIT 50`,
      );
      for (const order of reminderCandidates) {
        await this.lifecycle.record(
          order.id,
          "ORDER_RECEIVED",
          "Seu pedido Bispo está reservado",
          `O pagamento do pedido ${order.code} ainda não foi identificado. Se quiser concluir sua escolha, o pagamento continua disponível por tempo limitado.`,
          "BBOS",
          `storefront:payment-reminder:${order.id}`,
          {
            paymentUrl: (() => {
              const publicBase = (
                process.env.STOREFRONT_WEB_URL?.trim() ||
                "https://bbos-ecommerce-preview-v2.onrender.com"
              ).replace(/\/$/, "");
              const token = this.lifecycle.trackingToken(order.id);
              return token
                ? `${publicBase}/loja/pagar/${order.id}?token=${encodeURIComponent(token)}`
                : null;
            })(),
          },
          true,
        );
      }

      const expired = await this.database.$queryRawUnsafe<
        Array<{ id: string; paymentExternalId: string | null }>
      >(
        `SELECT id,"paymentExternalId"
           FROM "StorefrontOrder"
          WHERE status='AWAITING_PAYMENT'
            AND "createdAt" <= NOW() - INTERVAL '24 hours'
          ORDER BY "createdAt" ASC
          LIMIT 50`,
      );
      for (const order of expired) {
        const cancellation = await this.cancelActiveMercadoPagoPayment(order);
        if (cancellation.paid) continue;
        await this.releaseSalesOrderReservation(order.id);
        const cancelled = await this.database.$executeRawUnsafe(
          `UPDATE "StorefrontOrder"
              SET status='CANCELLED',"updatedAt"=NOW()
            WHERE id=$1 AND status='AWAITING_PAYMENT'`,
          order.id,
        );
        if (!cancelled) continue;
        await this.database.$executeRawUnsafe(
          `UPDATE "StorefrontPaymentAttempt"
              SET status='EXPIRED',"updatedAt"=NOW()
            WHERE "storefrontOrderId"=$1
              AND status IN ('CREATING','AWAITING_PAYMENT','PROCESSING','ERROR')`,
          order.id,
        );
        await this.lifecycle.record(
          order.id,
          "CANCELLED",
          "Reserva do pedido encerrada",
          "O prazo desta tentativa de pagamento terminou. Se desejar, você pode voltar à loja e gerar um novo pagamento.",
          "BBOS",
          `storefront:payment-expired:${order.id}`,
          {},
          false,
        );
      }
    } catch (error) {
      console.error("Falha no worker de pagamentos da loja", {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.reconcilingPayments = false;
    }
  }

  private async syncSalesOrder(storefrontOrderId: string) {
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT * FROM "StorefrontOrder" WHERE id=$1 LIMIT 1`,
      storefrontOrderId,
    );
    const storefront = rows[0];
    if (!storefront)
      throw new BadRequestException("Pedido da loja não encontrado.");

    const customerData = storefront.customer as CheckoutBody["customer"];
    const delivery = storefront.delivery as CheckoutBody["delivery"];
    const storefrontItems = storefront.items as Array<{
      id: string;
      name: string;
      quantity: number;
      grind: string;
      unitPriceCents: number;
      totalCents: number;
    }>;

    return this.database.$transaction(async (transaction) => {
      const channel =
        (await transaction.salesChannel.findFirst({
          where: {
            companyId: storefront.companyId,
            type: "ECOMMERCE",
            active: true,
          },
          orderBy: { createdAt: "asc" },
        })) ??
        (await transaction.salesChannel.upsert({
          where: {
            companyId_code: {
              companyId: storefront.companyId,
              code: "ECOMMERCE",
            },
          },
          update: { active: true, name: "Loja online", currency: "BRL" },
          create: {
            companyId: storefront.companyId,
            code: "ECOMMERCE",
            name: "Loja online",
            type: "ECOMMERCE",
            active: true,
            country: "BR",
            currency: "BRL",
          },
        }));

      const cpf = digits(customerData?.cpf);
      let customer = cpf
        ? await transaction.customer.findFirst({
            where: { companyId: storefront.companyId, taxId: cpf },
          })
        : null;
      if (customer) {
        customer = await transaction.customer.update({
          where: { id: customer.id },
          data: { name: customerData?.name?.trim() || customer.name },
        });
      } else {
        customer = await transaction.customer.create({
          data: {
            companyId: storefront.companyId,
            name: customerData?.name?.trim() || "Cliente da loja",
            taxId: cpf || null,
            segment: "E-commerce",
          },
        });
      }

      const slugs = storefrontItems.map((item) => item.id);
      const variants = await transaction.productVariant.findMany({
        where: {
          active: true,
          netWeightGrams: { in: [250, 500] },
          product: {
            active: true,
            slug: { in: slugs },
            productLine: { companyId: storefront.companyId, active: true },
          },
        },
        include: { product: true },
      });
      const variantBySlug = new Map(
        variants.map((variant) => [variant.product.slug, variant]),
      );
      const missing = storefrontItems.find(
        (item) => !variantBySlug.has(item.id),
      );
      if (missing)
        throw new ServiceUnavailableException(
          `O produto ${missing.name} ainda não está vinculado ao catálogo interno.`,
        );

      const status =
        storefront.status === "PAID"
          ? SalesOrderStatus.CONFIRMED
          : new Set(["EXCEPTION", "CANCELLED"]).has(storefront.status)
            ? SalesOrderStatus.CANCELLED
            : SalesOrderStatus.DRAFT;
      const existing = await transaction.salesOrder.findUnique({
        where: {
          companyId_code: {
            companyId: storefront.companyId,
            code: storefront.code,
          },
        },
      });
      if (existing) {
        if (
          status !== existing.status &&
          (existing.status === SalesOrderStatus.DRAFT ||
            (existing.status === SalesOrderStatus.CANCELLED &&
              status === SalesOrderStatus.CONFIRMED))
        ) {
          return transaction.salesOrder.update({
            where: { id: existing.id },
            data: { status },
          });
        }
        return existing;
      }

      const totalQuantity = storefrontItems.reduce(
        (sum, item) => sum + item.quantity,
        0,
      );
      const address = [
        `${delivery?.street || ""}, ${delivery?.number || ""}`,
        delivery?.complement,
        delivery?.district,
        `${delivery?.city || ""}/${delivery?.state || ""}`,
        `CEP ${digits(delivery?.postalCode)}`,
      ]
        .filter(Boolean)
        .join(" · ");
      const grindSummary = storefrontItems
        .map((item) => `${item.name}: ${item.grind}`)
        .join("; ");

      return transaction.salesOrder.create({
        data: {
          companyId: storefront.companyId,
          customerId: customer.id,
          salesChannelId: channel.id,
          code: storefront.code,
          orderNumber: storefront.code,
          status,
          quantity: totalQuantity,
          unitPrice: totalQuantity
            ? storefront.subtotalCents / 100 / totalQuantity
            : 0,
          subtotal: storefront.subtotalCents / 100,
          freight: storefront.shippingCents / 100,
          discount: (storefront.discountCents || 0) / 100,
          totalAmount: storefront.totalCents / 100,
          orderDate: storefront.createdAt,
          notes: [
            `Loja online · ${customerData?.email || ""} · ${customerData?.phone || ""}`,
            `Entrega: ${address}`,
            `Moagem: ${grindSummary}`,
            `Pagamento: ${storefront.requestedPaymentMethod}`,
            storefront.couponCode
              ? `Cupom: ${storefront.couponCode} · Desconto: R$ ${(Number(storefront.discountCents || 0) / 100).toFixed(2)}`
              : null,
          ]
            .filter(Boolean)
            .join("\n"),
          items: {
            create: storefrontItems.map((item) => {
              const variant = variantBySlug.get(item.id)!;
              return {
                companyId: storefront.companyId,
                productVariantId: variant.id,
                productName: item.name,
                sku: variant.sku,
                quantity: item.quantity,
                unitPrice: item.unitPriceCents / 100,
                totalAmount: item.totalCents / 100,
              };
            }),
          },
        },
      });
    });
  }

  private async reserveSalesOrderForPayment(storefrontOrderId: string) {
    const salesOrder = await this.syncSalesOrder(storefrontOrderId);
    return this.salesOrders.reserveForPayment(
      salesOrder.companyId,
      salesOrder.id,
    );
  }

  private async releaseSalesOrderReservation(storefrontOrderId: string) {
    const salesOrder = await this.syncSalesOrder(storefrontOrderId);
    return this.salesOrders.cancel(salesOrder.companyId, salesOrder.id);
  }

  private mercadoPagoOrderIsPaid(providerOrder: any) {
    return (
      (providerOrder.status === "processed" &&
        providerOrder.status_detail === "accredited") ||
      providerOrder.transactions?.payments?.some(
        (payment: any) =>
          payment.status === "processed" &&
          payment.status_detail === "accredited",
      )
    );
  }

  private async cancelActiveMercadoPagoPayment(order: any) {
    const externalId = String(order.paymentExternalId || "").trim();
    if (!externalId) return { paid: false, cancelled: false };

    let providerOrder = await this.mercadoPago.getOrder(externalId);
    if (this.mercadoPagoOrderIsPaid(providerOrder)) {
      await this.markAsPaid(order.id, externalId);
      return { paid: true, cancelled: false };
    }

    const terminal = new Set(["failed", "canceled", "expired"]);
    if (!terminal.has(String(providerOrder.status || ""))) {
      const cancellable = new Set(["created", "action_required"]);
      if (!cancellable.has(String(providerOrder.status || ""))) {
        throw new ServiceUnavailableException(
          "A cobrança anterior ainda está sendo processada. Aguarde a atualização antes de tentar novamente.",
        );
      }
      try {
        providerOrder = await this.mercadoPago.cancelOrder(
          externalId,
          `mp-cancel-${order.id}-${externalId}`,
        );
      } catch (error) {
        const latest = await this.mercadoPago.getOrder(externalId);
        if (this.mercadoPagoOrderIsPaid(latest)) {
          await this.markAsPaid(order.id, externalId);
          return { paid: true, cancelled: false };
        }
        if (latest.status !== "canceled") throw error;
        providerOrder = latest;
      }
    }

    await this.database.$executeRawUnsafe(
      `UPDATE "StorefrontPaymentAttempt"
          SET status=CASE
                WHEN $2='expired' THEN 'EXPIRED'
                WHEN $2='failed' THEN 'FAILED'
                ELSE 'CANCELLED'
              END,
              "providerStatus"=$2,
              "providerStatusDetail"=$3,
              "nextAttemptAt"=NULL,
              "processingStartedAt"=NULL,
              "updatedAt"=NOW()
        WHERE provider='MERCADO_PAGO' AND "externalId"=$1`,
      externalId,
      providerOrder.status || "canceled",
      providerOrder.status_detail ?? null,
    );
    return { paid: false, cancelled: true };
  }

  private async markAsPaid(
    orderId: string,
    externalId: string,
    provider = "MERCADO_PAGO",
  ) {
    const result = await this.database.$transaction(async (transaction) => {
      const found = await transaction.$queryRawUnsafe<any[]>(
        `SELECT * FROM "StorefrontOrder" WHERE id=$1 FOR UPDATE`,
        orderId,
      );
      const order = found[0];
      if (!order) throw new BadRequestException("Pedido não encontrado.");
      if (
        ["PAID", "PREPARING", "INVOICED", "SHIPPED", "DELIVERED"].includes(
          order.status,
        )
      ) {
        const duplicatePayment =
          Boolean(order.paymentExternalId) &&
          String(order.paymentExternalId) !== String(externalId);
        if (duplicatePayment) {
          await transaction.$executeRawUnsafe(
            `UPDATE "StorefrontPaymentAttempt"
                SET status='PAID',"paidAt"=COALESCE("paidAt",NOW()),
                    metadata=COALESCE(metadata,'{}'::jsonb) || $2::jsonb,
                    "updatedAt"=NOW()
              WHERE provider=$3 AND "externalId"=$1`,
            externalId,
            JSON.stringify({
              duplicatePaymentDetected: true,
              alreadyPaidExternalId: order.paymentExternalId,
            }),
            provider,
          );
        }
        return {
          id: order.id,
          code: order.code,
          status: order.status,
          idempotent: !duplicatePayment,
          duplicatePayment,
          alreadyPaidExternalId: order.paymentExternalId,
        };
      }
      await transaction.$executeRawUnsafe(
        `UPDATE "StorefrontOrder" SET status='PAID',"paymentProvider"=$3,"paymentExternalId"=$2,"paidAt"=NOW(),"updatedAt"=NOW() WHERE id=$1`,
        order.id,
        externalId,
        provider,
      );
      await transaction.$executeRawUnsafe(
        `UPDATE "StorefrontPaymentAttempt"
            SET status=CASE WHEN provider=$3 AND "externalId"=$2 THEN 'PAID' ELSE 'CANCELLED' END,
                "paidAt"=CASE WHEN provider=$3 AND "externalId"=$2 THEN COALESCE("paidAt",NOW()) ELSE "paidAt" END,
                metadata=CASE
                  WHEN provider=$3 AND "externalId"=$2 THEN COALESCE(metadata,'{}'::jsonb)
                  ELSE COALESCE(metadata,'{}'::jsonb) || '{"supersededByPaidAttempt":true}'::jsonb
                END,
                "nextAttemptAt"=NULL,
                "processingStartedAt"=NULL,
                "updatedAt"=NOW()
          WHERE "storefrontOrderId"=$1
            AND status IN ('CREATING','AWAITING_PAYMENT','PROCESSING','ERROR','PAID')`,
        order.id,
        externalId,
        provider,
      );
      await transaction.$executeRawUnsafe(
        `INSERT INTO "IntegrationOutbox"
          (id,"companyId",provider,"eventType","aggregateType","aggregateId",payload,status,attempts,"idempotencyKey","createdAt","updatedAt")
         VALUES ($1,$2,'BLING','STOREFRONT_ORDER_PAID','STOREFRONT_ORDER',$3,$4::jsonb,'PENDING',0,$5,NOW(),NOW())
         ON CONFLICT ("idempotencyKey") DO NOTHING`,
        randomUUID(),
        order.companyId,
        order.id,
        JSON.stringify({
          storefrontOrderId: order.id,
          code: order.code,
          origin: "ECOMMERCE",
        }),
        `bling:storefront-paid:${order.id}`,
      );
      if (order.couponId && order.commissionCents > 0) {
        const couponRows = await transaction.$queryRawUnsafe<any[]>(
          `SELECT c.*, b.name AS "ownerName" FROM "StorefrontCoupon" c JOIN "StorefrontPartner" b ON b.id=c."partnerId" WHERE c.id=$1 FOR UPDATE`,
          order.couponId,
        );
        const coupon = couponRows[0];
        if (!coupon)
          throw new BadRequestException("Cupom do pedido não encontrado.");
        const redemptionId = randomUUID();
        await transaction.$executeRawUnsafe(
          `INSERT INTO "StorefrontCouponRedemption"
            (id,"companyId","couponId","storefrontOrderId","partnerId","couponCode","grossSubtotalCents","discountCents","netSubtotalCents","commissionCents",status,"reservedAt","createdAt","updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'RESERVED',NOW(),NOW(),NOW())
           ON CONFLICT ("storefrontOrderId") DO NOTHING`,
          redemptionId,
          order.companyId,
          coupon.id,
          order.id,
          coupon.partnerId,
          order.couponCode,
          order.subtotalCents,
          order.discountCents,
          order.subtotalCents - order.discountCents,
          order.commissionCents,
        );
        const redemption = await transaction.$queryRawUnsafe<any[]>(
          `SELECT id FROM "StorefrontCouponRedemption" WHERE "storefrontOrderId"=$1 LIMIT 1`,
          order.id,
        );
        await transaction.$executeRawUnsafe(
          `UPDATE "StorefrontCoupon" SET "usageCount"="usageCount"+1,"updatedAt"=NOW()
            WHERE id=$1 AND NOT EXISTS (SELECT 1 FROM "AccountsPayable" WHERE "brokerCommissionPayableKey"=$2)`,
          coupon.id,
          `coupon:${redemption[0].id}`,
        );
        await transaction.$executeRawUnsafe(
          `INSERT INTO "AccountsPayable"
            (id,"companyId","storefrontPartnerId",description,"issueDate","dueDate",amount,"openAmount",status,category,notes,"brokerCommissionPayableKey","createdAt","updatedAt")
           VALUES ($1,$2,$3,$4,NOW(),NOW(),$5,$5,'OPEN','COMISSAO_CUPOM',$6,$7,NOW(),NOW())
           ON CONFLICT ("brokerCommissionPayableKey") DO NOTHING`,
          randomUUID(),
          order.companyId,
          coupon.partnerId,
          `Comissão reservada · cupom ${order.couponCode} · pedido ${order.code}`,
          Number(order.commissionCents) / 100,
          `Reserva automática no pagamento. Beneficiário: ${coupon.ownerName}.`,
          `coupon:${redemption[0].id}`,
        );
      }
      return { id: order.id, code: order.code, status: "PAID" };
    });
    if ((result as any).duplicatePayment) {
      await this.lifecycle.record(
        orderId,
        "EXCEPTION",
        "Pagamento duplicado detectado",
        "O BBOS identificou uma segunda aprovação de pagamento para o mesmo pedido. A venda não foi duplicada e requer conferência financeira.",
        provider === "MERCADO_PAGO" ? "MERCADO_PAGO" : "BBOS",
        `storefront:duplicate-payment:${orderId}:${externalId}`,
        {
          externalId,
          provider,
          alreadyPaidExternalId: (result as any).alreadyPaidExternalId,
        },
        false,
      );
      return result;
    }

    await this.lifecycle.record(
      orderId,
      "PAYMENT_CONFIRMED",
      "Pagamento confirmado",
      "Seu pagamento foi aprovado e o pedido seguirá para preparação.",
      provider === "MERCADO_PAGO" ? "MERCADO_PAGO" : "BBOS",
      `storefront:payment-confirmed:${orderId}`,
      { externalId, provider },
    );
    await this.syncSalesOrder(orderId);
    return result;
  }

  private async reconcileMercadoPago(order: {
    id: string;
    code: string;
    totalCents: number;
    paymentExternalId: string;
  }) {
    const providerOrder = await this.mercadoPago.getOrder(
      order.paymentExternalId,
    );
    const amountCents = Math.round(
      Number(providerOrder.total_amount || 0) * 100,
    );

    if (
      providerOrder.id !== order.paymentExternalId ||
      providerOrder.external_reference !== order.code ||
      amountCents !== order.totalCents
    ) {
      await this.database.$executeRawUnsafe(
        `UPDATE "StorefrontPaymentAttempt"
            SET status='ERROR',
                "providerStatus"=$2,
                "providerStatusDetail"=$3,
                "lastError"='Divergência entre a tentativa BBOS e a order do Mercado Pago',
                "nextAttemptAt"=NOW() + INTERVAL '5 minutes',
                "updatedAt"=NOW()
          WHERE provider='MERCADO_PAGO' AND "externalId"=$1`,
        order.paymentExternalId,
        providerOrder.status ?? null,
        providerOrder.status_detail ?? null,
      );
      console.error("Mercado Pago retornou dados divergentes para o pedido", {
        orderId: order.id,
        providerOrderId: providerOrder.id,
      });
      return { paid: false };
    }

    const payment = providerOrder.transactions?.payments?.find(
      (candidate) =>
        candidate.status === "processed" &&
        candidate.status_detail === "accredited",
    );
    const paid =
      providerOrder.status === "processed" &&
      providerOrder.status_detail === "accredited";

    if (paid || payment) {
      await this.database.$executeRawUnsafe(
        `UPDATE "StorefrontPaymentAttempt"
            SET status='PAID',
                "providerStatus"=$2,
                "providerStatusDetail"=$3,
                "paidAt"=COALESCE("paidAt",NOW()),
                "lastError"=NULL,
                "nextAttemptAt"=NULL,
                "processingStartedAt"=NULL,
                "updatedAt"=NOW()
          WHERE provider='MERCADO_PAGO' AND "externalId"=$1`,
        providerOrder.id,
        providerOrder.status ?? null,
        providerOrder.status_detail ?? null,
      );
      await this.markAsPaid(order.id, providerOrder.id);
      return { paid: true };
    }

    const terminalFailure = new Set(["failed", "canceled", "expired"]);
    if (providerOrder.status && terminalFailure.has(providerOrder.status)) {
      const attemptStatus =
        providerOrder.status === "canceled"
          ? "CANCELLED"
          : providerOrder.status === "expired"
            ? "EXPIRED"
            : "FAILED";

      await this.database.$executeRawUnsafe(
        `UPDATE "StorefrontPaymentAttempt"
            SET status=$2,
                "providerStatus"=$3,
                "providerStatusDetail"=$4,
                "lastError"=NULL,
                "nextAttemptAt"=NULL,
                "processingStartedAt"=NULL,
                "updatedAt"=NOW()
          WHERE provider='MERCADO_PAGO' AND "externalId"=$1`,
        providerOrder.id,
        attemptStatus,
        providerOrder.status,
        providerOrder.status_detail ?? null,
      );
      await this.releaseSalesOrderReservation(order.id);
      await this.database.$executeRawUnsafe(
        `UPDATE "StorefrontOrder"
            SET status='PAYMENT_FAILED',"updatedAt"=NOW()
          WHERE id=$1 AND status='AWAITING_PAYMENT' AND "paymentExternalId"=$2`,
        order.id,
        providerOrder.id,
      );
      await this.lifecycle.record(
        order.id,
        "EXCEPTION",
        "Pagamento não concluído",
        "A tentativa de pagamento não foi concluída. Você pode iniciar uma nova tentativa com segurança.",
        "MERCADO_PAGO",
        `storefront:payment-failed:${order.id}:${providerOrder.id}`,
        {
          externalId: providerOrder.id,
          providerStatus: providerOrder.status,
          providerStatusDetail: providerOrder.status_detail,
        },
      );
      return { paid: false };
    }

    await this.database.$executeRawUnsafe(
      `UPDATE "StorefrontPaymentAttempt"
          SET status='AWAITING_PAYMENT',
              "providerStatus"=$2,
              "providerStatusDetail"=$3,
              "lastError"=NULL,
              "nextAttemptAt"=NOW() + INTERVAL '20 seconds',
              "processingStartedAt"=NULL,
              "updatedAt"=NOW()
        WHERE provider='MERCADO_PAGO' AND "externalId"=$1`,
      providerOrder.id,
      providerOrder.status ?? null,
      providerOrder.status_detail ?? null,
    );

    return { paid: false };
  }

  private async beginPaymentAttempt(order: any, idempotencyKey: string) {
    return this.database.$transaction(async (transaction) => {
      const existing = await transaction.$queryRawUnsafe<any[]>(
        `SELECT * FROM "StorefrontPaymentAttempt"
          WHERE "idempotencyKey"=$1
          LIMIT 1`,
        idempotencyKey,
      );
      if (existing[0]) return existing[0];

      const lockedOrders = await transaction.$queryRawUnsafe<
        Array<{ id: string; companyId: string }>
      >(
        `SELECT id,"companyId" FROM "StorefrontOrder" WHERE id=$1 FOR UPDATE`,
        order.id,
      );
      const lockedOrder = lockedOrders[0];
      if (!lockedOrder?.companyId)
        throw new ServiceUnavailableException(
          "O pedido não possui empresa vinculada para iniciar o pagamento.",
        );

      await transaction.$executeRawUnsafe(
        `UPDATE "StorefrontPaymentAttempt"
            SET status='CANCELLED',
                "nextAttemptAt"=NULL,
                "processingStartedAt"=NULL,
                metadata=COALESCE(metadata,'{}'::jsonb) || $2::jsonb,
                "updatedAt"=NOW()
          WHERE "storefrontOrderId"=$1
            AND status IN ('CREATING','AWAITING_PAYMENT','PROCESSING')`,
        order.id,
        JSON.stringify({ supersededByNewAttempt: true }),
      );

      const numbers = await transaction.$queryRawUnsafe<
        Array<{ next: number }>
      >(
        `SELECT COALESCE(MAX("attemptNumber"),0)::int + 1 AS next
           FROM "StorefrontPaymentAttempt"
          WHERE "storefrontOrderId"=$1`,
        order.id,
      );
      const id = randomUUID();
      const rows = await transaction.$queryRawUnsafe<any[]>(
        `INSERT INTO "StorefrontPaymentAttempt"
          (id,"companyId","storefrontOrderId",provider,method,status,"attemptNumber",
           "amountCents","idempotencyKey",attempts,"nextAttemptAt",metadata,"createdAt","updatedAt")
         VALUES ($1,$2,$3,'MERCADO_PAGO',$4,'CREATING',$5,$6,$7,0,NOW(),$8::jsonb,NOW(),NOW())
         RETURNING *`,
        id,
        lockedOrder.companyId,
        order.id,
        order.requestedPaymentMethod === "CARD" ? "CARD" : "PIX",
        Number(numbers[0]?.next ?? 1),
        Number(order.totalCents),
        idempotencyKey,
        JSON.stringify({ orderCode: order.code }),
      );
      return rows[0];
    });
  }

  private async ensureMercadoPagoCheckout(
    order: any,
    idempotencyKey: string,
    forceNew = false,
  ) {
    if (!forceNew) {
      const activeAttempts = await this.database.$queryRawUnsafe<any[]>(
        `SELECT *
           FROM "StorefrontPaymentAttempt"
          WHERE "storefrontOrderId"=$1
            AND status IN ('CREATING','AWAITING_PAYMENT','PROCESSING','ERROR')
          ORDER BY "attemptNumber" DESC
          LIMIT 1`,
        order.id,
      );
      const activeAttempt = activeAttempts[0];
      if (
        activeAttempt?.externalId &&
        (activeAttempt.checkoutUrl || activeAttempt.metadata?.pix)
      ) {
        return {
          externalId: activeAttempt.externalId,
          checkoutUrl: activeAttempt.checkoutUrl || null,
          pix: activeAttempt.metadata?.pix || null,
        };
      }
    }

    if (!forceNew && order.paymentExternalId) {
      const current = await this.mercadoPago.getOrder(order.paymentExternalId);
      const terminalFailure = new Set(["failed", "canceled", "expired"]);
      if (current.checkout_url && !terminalFailure.has(current.status || ""))
        return { externalId: current.id, checkoutUrl: current.checkout_url };
    }

    const providerIdempotencyKey = `mp-${idempotencyKey}`.slice(0, 128);
    const attempt = await this.beginPaymentAttempt(
      order,
      providerIdempotencyKey,
    );

    if (attempt.externalId && (attempt.checkoutUrl || attempt.metadata?.pix)) {
      return {
        externalId: attempt.externalId,
        checkoutUrl: attempt.checkoutUrl || null,
        pix: attempt.metadata?.pix || null,
      };
    }

    const customer = order.customer as CheckoutBody["customer"];
    const delivery = order.delivery as CheckoutBody["delivery"];
    const orderItems = order.items as Array<{
      id: string;
      name: string;
      quantity: number;
      grind: string;
      unitPriceCents: number;
    }>;

    try {
      const paymentInput = {
        paymentMethod:
          order.requestedPaymentMethod === "CARD"
            ? ("CARD" as const)
            : ("PIX" as const),
        idempotencyKey: providerIdempotencyKey,
        orderCode: order.code,
        totalCents: order.totalCents,
        shippingCents: order.shippingCents,
        discountCents: order.discountCents || 0,
        couponCode: order.couponCode || undefined,
        items: orderItems.map((item) => ({
          externalCode: item.id,
          title: item.name,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          description: `${item.grind} · Café Bispo`,
        })),
        payer: {
          name: customer?.name || "",
          email: customer?.email || "",
          phone: customer?.phone || "",
          cpf: customer?.cpf || "",
        },
        delivery: {
          postalCode: delivery?.postalCode || "",
          street: delivery?.street || "",
          number: delivery?.number || "",
          complement: delivery?.complement,
          district: delivery?.district || "",
          city: delivery?.city || "",
          state: delivery?.state || "",
        },
      };
      const providerOrder =
        order.requestedPaymentMethod === "PIX"
          ? await this.mercadoPago.createPix(paymentInput)
          : await this.mercadoPago.createCheckout(paymentInput);

      await this.database.$transaction(async (transaction) => {
        await transaction.$executeRawUnsafe(
          `UPDATE "StorefrontPaymentAttempt"
              SET status='AWAITING_PAYMENT',
                  "externalId"=$2,
                  "checkoutUrl"=$3,
                  "providerStatus"=$4,
                  "providerStatusDetail"=$5,
                  metadata=COALESCE(metadata,'{}'::jsonb) || $6::jsonb,
                  "lastError"=NULL,
                  "nextAttemptAt"=NOW() + INTERVAL '20 seconds',
                  "updatedAt"=NOW()
            WHERE id=$1`,
          attempt.id,
          providerOrder.id,
          providerOrder.checkout_url ?? providerOrder.pix?.ticketUrl ?? null,
          providerOrder.status ?? null,
          providerOrder.status_detail ?? null,
          JSON.stringify({ pix: providerOrder.pix ?? null }),
        );
        await transaction.$executeRawUnsafe(
          `UPDATE "StorefrontOrder"
              SET status=CASE WHEN status='PAID' THEN status ELSE 'AWAITING_PAYMENT' END,
                  "paymentProvider"='MERCADO_PAGO',
                  "paymentExternalId"=$2,
                  "updatedAt"=NOW()
            WHERE id=$1`,
          order.id,
          providerOrder.id,
        );
      });

      return {
        externalId: providerOrder.id,
        checkoutUrl:
          providerOrder.checkout_url ?? providerOrder.pix?.ticketUrl ?? null,
        pix: providerOrder.pix ?? null,
      };
    } catch (error) {
      await this.database.$executeRawUnsafe(
        `UPDATE "StorefrontPaymentAttempt"
            SET status='ERROR',
                attempts=attempts+1,
                "lastError"=$2,
                "nextAttemptAt"=NOW() + INTERVAL '30 seconds',
                "updatedAt"=NOW()
          WHERE id=$1`,
        attempt.id,
        (error instanceof Error ? error.message : String(error)).slice(0, 2000),
      );
      throw error;
    }
  }

  private async companyId() {
    const configured = process.env.STOREFRONT_COMPANY_ID?.trim();
    if (configured) return configured;
    const companies = await this.database.company.findMany({
      select: { id: true },
      take: 2,
    });
    if (companies.length !== 1)
      throw new ServiceUnavailableException(
        "Configure STOREFRONT_COMPANY_ID para receber pedidos da loja.",
      );
    return companies[0]!.id;
  }

  @Public()
  @Post()
  async create(@Body() body: CheckoutBody, @Req() request: any) {
    const key = body.idempotencyKey?.trim();
    if (!key || key.length < 16 || key.length > 100)
      throw new BadRequestException(
        "Identificador seguro do checkout inválido.",
      );
    const customer = body.customer ?? {};
    const delivery = body.delivery ?? {};
    if (!customer.name?.trim() || !/^\S+@\S+\.\S+$/.test(customer.email ?? ""))
      throw new BadRequestException("Informe nome e e-mail válidos.");
    if (
      digits(customer.phone).length < 10 ||
      digits(customer.phone).length > 11
    )
      throw new BadRequestException("Telefone inválido.");
    if (!validCpf(customer.cpf)) throw new BadRequestException("CPF inválido.");
    if (
      digits(delivery.postalCode).length !== 8 ||
      !delivery.street?.trim() ||
      !delivery.number?.trim() ||
      !delivery.district?.trim() ||
      !delivery.city?.trim() ||
      !/^[A-Za-z]{2}$/.test(delivery.state ?? "")
    )
      throw new BadRequestException("Endereço de entrega incompleto.");
    if (!body.items?.length || body.items.length > 12)
      throw new BadRequestException("A sacola não possui itens válidos.");
    const paymentMethod = body.paymentMethod || "PIX";
    if (!new Set(["PIX", "CARD"]).has(paymentMethod))
      throw new BadRequestException("Forma de pagamento inválida.");

    const items = body.items.map((item) => {
      const product = catalog[item.id ?? ""];
      const quantity = Number(item.quantity);
      if (
        !product ||
        !Number.isSafeInteger(quantity) ||
        quantity < 1 ||
        quantity > 20
      )
        throw new BadRequestException("Produto ou quantidade inválidos.");
      return {
        id: item.id,
        name: product.name,
        quantity,
        grind: preparationFor(String(item.id)),
        unitPriceCents: product.unitPriceCents,
        totalCents: product.unitPriceCents * quantity,
        weightGrams: product.weightGrams * quantity,
      };
    });
    const subtotalCents = items.reduce((sum, item) => sum + item.totalCents, 0);
    const weightGrams = items.reduce((sum, item) => sum + item.weightGrams, 0);
    const companyId = await this.companyId();
    const coupon = body.couponCode?.trim()
      ? await this.coupons.calculate(companyId, body.couponCode, subtotalCents)
      : null;
    const existing = await this.database.$queryRawUnsafe<any[]>(
      `SELECT * FROM "StorefrontOrder" WHERE "idempotencyKey"=$1 LIMIT 1`,
      key,
    );
    if (existing[0]) {
      if (existing[0].requestedPaymentMethod !== paymentMethod)
        throw new BadRequestException(
          "Este pedido já foi iniciado com outra forma de pagamento. Escolha a forma original ou inicie uma nova compra.",
        );
      const confirmationToken = randomBytes(32).toString("base64url");
      await this.database.$executeRawUnsafe(
        `UPDATE "StorefrontOrder" SET "confirmationTokenHash"=$2,"updatedAt"=NOW() WHERE id=$1`,
        existing[0].id,
        tokenHash(confirmationToken),
      );
      if (existing[0].status === "CANCELLED")
        throw new BadRequestException(
          "Este pedido foi encerrado. Volte à sacola para iniciar uma nova compra.",
        );
      if (existing[0].status === "PAYMENT_FAILED") {
        return {
          id: existing[0].id,
          code: existing[0].code,
          status: "PAYMENT_FAILED",
          totalCents: existing[0].totalCents,
          confirmationToken,
          idempotent: true,
        };
      }
      if (
        ["PAID", "PREPARING", "INVOICED", "SHIPPED", "DELIVERED"].includes(
          existing[0].status,
        )
      ) {
        return {
          id: existing[0].id,
          code: existing[0].code,
          status: "PAID",
          totalCents: existing[0].totalCents,
          confirmationToken,
          idempotent: true,
        };
      }
      await this.reserveSalesOrderForPayment(existing[0].id);
      const payment = await this.ensureMercadoPagoCheckout(existing[0], key);
      return {
        id: existing[0].id,
        code: existing[0].code,
        status: "AWAITING_PAYMENT",
        totalCents: existing[0].totalCents,
        confirmationToken,
        checkoutUrl: payment.checkoutUrl,
        pix: payment.pix ?? null,
        idempotent: true,
      };
    }

    if (!body.shippingQuoteId?.trim())
      throw new BadRequestException(
        "Calcule e escolha uma modalidade de frete antes de pagar.",
      );
    const quote = await this.shipping.validateQuote(
      companyId,
      body.shippingQuoteId.trim(),
      {
        postalCode: delivery.postalCode || "",
        subtotalCents,
        weightGrams,
      },
    );
    const shippingCents = Number(quote.customerPriceCents);
    if (
      quote.refreshed &&
      Number.isFinite(Number(quote.previousCustomerPriceCents)) &&
      shippingCents > Number(quote.previousCustomerPriceCents)
    ) {
      return {
        shippingRefreshRequired: true,
        message:
          "O valor do frete foi atualizado pela transportadora. Confira o novo total e confirme o pagamento.",
        quote: {
          id: quote.id,
          name: quote.serviceName,
          serviceName: quote.serviceName,
          carrierName: quote.carrierName,
          priceCents: shippingCents,
          deliveryDays: Number(quote.deliveryDays),
          expiresAt: new Date(quote.expiresAt).toISOString(),
        },
      };
    }

    const equivalent = await this.database.$queryRawUnsafe<any[]>(
      `SELECT *
         FROM "StorefrontOrder"
        WHERE "companyId"=$1
          AND status IN ('AWAITING_PAYMENT','PAYMENT_FAILED')
          AND lower(customer->>'email')=lower($2)
          AND customer->>'cpf'=$3
          AND items=$4::jsonb
          AND "totalCents"=$5
          AND "createdAt" >= NOW() - INTERVAL '2 hours'
        ORDER BY "createdAt" DESC
        LIMIT 1`,
      companyId,
      customer.email!.trim(),
      digits(customer.cpf),
      JSON.stringify(items),
      (coupon?.netSubtotalCents ?? subtotalCents) + shippingCents,
    );
    if (equivalent[0]) {
      const confirmationToken = randomBytes(32).toString("base64url");
      const claimed = await this.database.$executeRawUnsafe(
        `UPDATE "ShippingQuote"
            SET status='USED',"usedAt"=NOW(),"updatedAt"=NOW()
          WHERE id=$1 AND status='VALID'`,
        quote.id,
      );
      if (!claimed)
        throw new BadRequestException(
          "Esta cotação já foi utilizada. Calcule novamente.",
        );

      await this.database.$executeRawUnsafe(
        `UPDATE "StorefrontOrder"
            SET status='AWAITING_PAYMENT',
                "confirmationTokenHash"=$2,
                customer=$3::jsonb,
                delivery=$4::jsonb,
                recurrence=$5::jsonb,
                "shippingQuoteId"=$6,
                "shippingProvider"=$7,
                "shippingServiceId"=$8,
                "shippingServiceName"=$9,
                "carrierName"=$10,
                "estimatedDeliveryDays"=$11,
                "shippingCents"=$12,
                "totalCents"=$13,
                "requestedPaymentMethod"=$14,
                "updatedAt"=NOW()
          WHERE id=$1`,
        equivalent[0].id,
        tokenHash(confirmationToken),
        JSON.stringify({
          ...customer,
          cpf: digits(customer.cpf),
          phone: digits(customer.phone),
        }),
        JSON.stringify({
          ...delivery,
          postalCode: digits(delivery.postalCode),
          state: delivery.state?.toUpperCase(),
        }),
        JSON.stringify(body.recurrence ?? { mode: "now" }),
        quote.id,
        quote.provider,
        quote.serviceId,
        quote.serviceName,
        quote.carrierName,
        quote.deliveryDays,
        shippingCents,
        (coupon?.netSubtotalCents ?? subtotalCents) + shippingCents,
        paymentMethod,
      );

      const refreshed = {
        ...equivalent[0],
        status: "AWAITING_PAYMENT",
        customer: {
          ...customer,
          cpf: digits(customer.cpf),
          phone: digits(customer.phone),
        },
        delivery: {
          ...delivery,
          postalCode: digits(delivery.postalCode),
          state: delivery.state?.toUpperCase(),
        },
        items,
        shippingCents,
        totalCents: (coupon?.netSubtotalCents ?? subtotalCents) + shippingCents,
        requestedPaymentMethod: paymentMethod,
      };
      await this.reserveSalesOrderForPayment(equivalent[0].id);
      const payment = await this.ensureMercadoPagoCheckout(refreshed, key);
      await this.lifecycle.record(
        equivalent[0].id,
        "ORDER_RECEIVED",
        "Nova tentativa de pagamento",
        "Uma nova tentativa de pagamento foi aberta para o mesmo pedido, sem duplicar a compra.",
        "BBOS",
        `storefront:payment-retry:${equivalent[0].id}:${payment.externalId}`,
        { externalId: payment.externalId },
        false,
      );
      return {
        id: equivalent[0].id,
        code: equivalent[0].code,
        status: "AWAITING_PAYMENT",
        totalCents: refreshed.totalCents,
        confirmationToken,
        checkoutUrl: payment.checkoutUrl,
        pix: payment.pix ?? null,
        reusedPendingOrder: true,
      };
    }

    const id = randomUUID();
    const confirmationToken = randomBytes(32).toString("base64url");
    const code = `WEB-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${id.slice(0, 6).toUpperCase()}`;
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `INSERT INTO "StorefrontOrder"
        (id,"companyId",code,status,"idempotencyKey","confirmationTokenHash",customer,delivery,items,recurrence,
         "subtotalCents","shippingCents","totalCents","requestedPaymentMethod","shippingQuoteId","shippingProvider",
         "shippingServiceId","shippingServiceName","carrierName","estimatedDeliveryDays","couponId","couponCode","discountCents","commissionCents","createdAt","updatedAt")
       VALUES ($1,$2,$3,'AWAITING_PAYMENT',$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,NOW(),NOW())
       RETURNING id,code,status,"subtotalCents","shippingCents","totalCents"`,
      id,
      companyId,
      code,
      key,
      tokenHash(confirmationToken),
      JSON.stringify({
        ...customer,
        cpf: digits(customer.cpf),
        phone: digits(customer.phone),
      }),
      JSON.stringify({
        ...delivery,
        postalCode: digits(delivery.postalCode),
        state: delivery.state?.toUpperCase(),
      }),
      JSON.stringify(items),
      JSON.stringify(body.recurrence ?? { mode: "now" }),
      subtotalCents,
      shippingCents,
      (coupon?.netSubtotalCents ?? subtotalCents) + shippingCents,
      paymentMethod,
      quote.id,
      quote.provider,
      quote.serviceId,
      quote.serviceName,
      quote.carrierName,
      quote.deliveryDays,
      coupon?.id ?? null,
      coupon?.code ?? null,
      coupon?.discountCents ?? 0,
      coupon?.commissionCents ?? 0,
    );
    const signedInCustomer = await this.customers.resolve(
      this.customers.readToken(request),
    );
    await this.customers.linkOrder(signedInCustomer, id, customer.email);
    const claimed = await this.database.$executeRawUnsafe(
      `UPDATE "ShippingQuote" SET status='USED',"usedAt"=NOW(),"updatedAt"=NOW() WHERE id=$1 AND status='VALID'`,
      quote.id,
    );
    if (!claimed)
      throw new BadRequestException(
        "Esta cotação já foi utilizada. Calcule novamente.",
      );
    await this.lifecycle.record(
      id,
      "ORDER_RECEIVED",
      "Pedido recebido",
      "Recebemos os dados do seu pedido e reservamos o valor do frete escolhido.",
      "BBOS",
      `storefront:received:${id}`,
      {
        shippingQuoteId: quote.id,
        carrierName: quote.carrierName,
        serviceName: quote.serviceName,
      },
    );
    await this.reserveSalesOrderForPayment(id);
    const completeOrder = {
      ...rows[0],
      requestedPaymentMethod: paymentMethod,
      customer: {
        ...customer,
        cpf: digits(customer.cpf),
        phone: digits(customer.phone),
      },
      delivery: {
        ...delivery,
        postalCode: digits(delivery.postalCode),
        state: delivery.state?.toUpperCase(),
      },
      items,
    };
    const payment = await this.ensureMercadoPagoCheckout(completeOrder, key);
    return {
      ...rows[0],
      confirmationToken,
      checkoutUrl: payment.checkoutUrl,
      pix: payment.pix ?? null,
    };
  }

  @Public()
  @Post(":orderId/reorder")
  async reorder(@Param("orderId") orderId: string, @Req() request: any) {
    const account = await this.customers.resolve(
      this.customers.readToken(request),
    );
    if (!account || !(await this.customers.ownsOrder(account, orderId)))
      throw new UnauthorizedException("Recompra não autorizada.");

    const rows = await this.database.$queryRawUnsafe<Array<{ items: any }>>(
      `SELECT items FROM "StorefrontOrder"
        WHERE id=$1 AND "companyId"=$2 LIMIT 1`,
      orderId,
      account.companyId,
    );
    const previousItems = Array.isArray(rows[0]?.items) ? rows[0].items : [];
    const items = previousItems.flatMap((item: any) => {
      const id = String(item?.id || "");
      const product = catalog[id];
      if (!product) return [];
      const quantity = Math.min(20, Math.max(1, Number(item.quantity) || 1));
      const grind = preparationFor(id);
      const line = new Set(["essencial", "intenso"]).has(id)
        ? "Cotidiano"
        : id === "raros"
          ? "Raros"
          : "Memórias";
      return [
        {
          id,
          name: product.name,
          line,
          notes: "Sua escolha anterior, pronta para ser confirmada novamente.",
          priceCents: product.unitPriceCents,
          weightGrams: product.weightGrams,
          quantity,
          grind,
          image: null,
        },
      ];
    });
    if (!items.length)
      throw new BadRequestException(
        "Os cafés deste pedido não estão disponíveis para recompra agora.",
      );
    return { items };
  }

  @Public()
  @Post(":orderId/retry-payment")
  async retryPayment(
    @Param("orderId") orderId: string,
    @Headers("x-storefront-order-token") suppliedToken: string | undefined,
    @Req() request: any,
  ) {
    const account = await this.customers.resolve(
      this.customers.readToken(request),
    );
    const accountOwnsOrder = account
      ? await this.customers.ownsOrder(account, orderId)
      : false;
    if (!suppliedToken && !accountOwnsOrder)
      throw new UnauthorizedException(
        "Nova tentativa de pagamento não autorizada.",
      );

    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT *
         FROM "StorefrontOrder"
        WHERE id=$1
          AND ("confirmationTokenHash"=$2 OR $3::boolean=TRUE OR $4::boolean=TRUE)
        LIMIT 1`,
      orderId,
      tokenHash(suppliedToken || ""),
      this.lifecycle.validTrackingToken(orderId, suppliedToken || ""),
      accountOwnsOrder,
    );
    const order = rows[0];
    if (!order)
      throw new UnauthorizedException(
        "Nova tentativa de pagamento não autorizada.",
      );
    if (order.status === "PAID")
      return { id: order.id, code: order.code, status: "PAID" };
    if (order.status === "CANCELLED")
      throw new BadRequestException(
        "Esta tentativa foi consolidada em outro pedido.",
      );

    await this.reserveSalesOrderForPayment(order.id);
    const cancellation = await this.cancelActiveMercadoPagoPayment(order);
    if (cancellation.paid)
      return { id: order.id, code: order.code, status: "PAID" };

    await this.database.$executeRawUnsafe(
      `UPDATE "StorefrontOrder"
          SET status='AWAITING_PAYMENT',"updatedAt"=NOW()
        WHERE id=$1 AND status NOT IN ('PAID','PREPARING','INVOICED','SHIPPED','DELIVERED')`,
      order.id,
    );
    const retryKey = `retry-${order.id}-${order.paymentExternalId || "initial"}`;
    const payment = await this.ensureMercadoPagoCheckout(order, retryKey, true);
    await this.lifecycle.record(
      order.id,
      "ORDER_RECEIVED",
      "Nova tentativa de pagamento",
      "Seu pedido foi preservado e uma nova tentativa de pagamento está disponível.",
      "BBOS",
      `storefront:customer-payment-retry:${order.id}:${payment.externalId}`,
      { externalId: payment.externalId },
      false,
    );
    return {
      id: order.id,
      code: order.code,
      status: "AWAITING_PAYMENT",
      checkoutUrl: payment.checkoutUrl,
      pix: payment.pix ?? null,
    };
  }

  @Public()
  @Get(":orderId/status")
  async status(
    @Param("orderId") orderId: string,
    @Headers("x-storefront-order-token") suppliedToken: string | undefined,
    @Req() request: any,
  ) {
    const account = await this.customers.resolve(
      this.customers.readToken(request),
    );
    const accountOwnsOrder = account
      ? await this.customers.ownsOrder(account, orderId)
      : false;
    if (!suppliedToken && !accountOwnsOrder)
      throw new UnauthorizedException("Consulta de pedido não autorizada.");
    let rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT id,code,status,"paidAt","totalCents","paymentExternalId","shippingServiceName","carrierName","estimatedDeliveryDays"
         FROM "StorefrontOrder" WHERE id=$1 AND ("confirmationTokenHash"=$2 OR $3::boolean=TRUE OR $4::boolean=TRUE) LIMIT 1`,
      orderId,
      tokenHash(suppliedToken || ""),
      this.lifecycle.validTrackingToken(orderId, suppliedToken || ""),
      accountOwnsOrder,
    );
    if (!rows[0])
      throw new UnauthorizedException("Consulta de pedido não autorizada.");
    await this.syncSalesOrder(orderId);
    if (rows[0].status === "AWAITING_PAYMENT" && rows[0].paymentExternalId) {
      await this.reconcileMercadoPago(rows[0]);
      rows = await this.database.$queryRawUnsafe<any[]>(
        `SELECT id,code,status,"paidAt","totalCents","paymentExternalId","shippingServiceName","carrierName","estimatedDeliveryDays"
           FROM "StorefrontOrder" WHERE id=$1 AND ("confirmationTokenHash"=$2 OR $3::boolean=TRUE OR $4::boolean=TRUE) LIMIT 1`,
        orderId,
        tokenHash(suppliedToken || ""),
        this.lifecycle.validTrackingToken(orderId, suppliedToken || ""),
        accountOwnsOrder,
      );
    }
    const [events, shipments] = await Promise.all([
      this.database.$queryRawUnsafe<any[]>(
        `SELECT "eventType",title,detail,"occurredAt" FROM "StorefrontOrderEvent"
          WHERE "storefrontOrderId"=$1 AND public=TRUE ORDER BY "occurredAt" ASC`,
        orderId,
      ),
      this.database.$queryRawUnsafe<any[]>(
        `SELECT status,"serviceName","carrierName","trackingCode","trackingUrl","postedAt","deliveredAt"
           FROM "Shipment" WHERE "storefrontOrderId"=$1 LIMIT 1`,
        orderId,
      ),
    ]);
    const publicOrder = { ...rows[0] };
    delete publicOrder.paymentExternalId;
    return { ...publicOrder, events, shipment: shipments[0] ?? null };
  }

  @Public()
  @Post("mercado-pago/webhook")
  @HttpCode(202)
  async mercadoPagoWebhook(
    @Query("data.id") queryDataId: string | undefined,
    @Query("id") queryId: string | undefined,
    @Body() body: any,
  ) {
    const externalId = String(
      body?.data?.id || body?.id || queryDataId || queryId || "",
    ).trim();

    const [attempts, commercialAttempts] = externalId
      ? await Promise.all([
          this.database.$queryRawUnsafe<any[]>(
            `SELECT p."companyId"
               FROM "StorefrontPaymentAttempt" p
              WHERE p.provider='MERCADO_PAGO' AND p."externalId"=$1
              LIMIT 1`,
            externalId,
          ),
          this.database.$queryRawUnsafe<any[]>(
            `SELECT p."companyId"
               FROM "SalesOrderPaymentAttempt" p
              WHERE p.provider='MERCADO_PAGO' AND p."externalId"=$1
              LIMIT 1`,
            externalId,
          ),
        ])
      : [[], []];

    const eventName = String(body?.action || body?.type || "order.updated");
    const providerEventId = createHash("sha256")
      .update(
        JSON.stringify({
          externalId,
          eventName,
          payload: body ?? {},
        }),
      )
      .digest("hex");

    const inserted = await this.database.$executeRawUnsafe(
      `INSERT INTO "IntegrationWebhookEvent"
        (id,"companyId",provider,"providerEventId","eventName",payload,status,"receivedAt")
       VALUES ($1,$2,'MERCADO_PAGO',$3,$4,$5::jsonb,'RECEIVED',NOW())
       ON CONFLICT (provider,"providerEventId") DO NOTHING`,
      randomUUID(),
      attempts[0]?.companyId ?? commercialAttempts[0]?.companyId ?? null,
      providerEventId,
      eventName,
      JSON.stringify({
        ...(body ?? {}),
        _bbosExternalId: externalId || null,
      }),
    );

    // Não bloqueamos o webhook esperando Mercado Pago/Banco/Bling.
    // O worker persistente processa o evento com retry e deduplicação.
    void Promise.all([
      this.reconcilePendingMercadoPagoOrders(),
      externalId
        ? this.salesOrderPayments.reconcileByExternalId(externalId)
        : Promise.resolve({ found: false }),
    ]).catch((error) => {
      console.error("Não foi possível reconciliar o webhook do Mercado Pago", {
        externalId: externalId || null,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return {
      accepted: true,
      duplicate: inserted === 0,
    };
  }

  @Public()
  @Post("payment-confirmation")
  async paymentConfirmation(
    @Headers("x-bbos-webhook-secret") suppliedSecret: string | undefined,
    @Body()
    body: {
      orderId?: string;
      provider?: string;
      externalId?: string;
      approved?: boolean;
    },
  ) {
    const secret = process.env.PAYMENT_WEBHOOK_SECRET?.trim();
    if (!secret || suppliedSecret !== secret)
      throw new UnauthorizedException("Webhook de pagamento não autorizado.");
    if (!body.orderId || !body.provider || !body.externalId)
      throw new BadRequestException("Confirmação de pagamento incompleta.");

    if (body.approved)
      return this.markAsPaid(body.orderId, body.externalId, body.provider);
    await this.releaseSalesOrderReservation(body.orderId);
    const updated = await this.database.$executeRawUnsafe(
      `UPDATE "StorefrontOrder" SET status='PAYMENT_FAILED',"paymentProvider"=$2,"paymentExternalId"=$3,"updatedAt"=NOW() WHERE id=$1`,
      body.orderId,
      body.provider,
      body.externalId,
    );
    if (!updated) throw new BadRequestException("Pedido não encontrado.");
    return { id: body.orderId, status: "EXCEPTION" };
  }
}
