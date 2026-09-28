import { Controller, Get, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@bbos/database";
import { MercadoPagoService } from "./mercado-pago.service";

@Controller("storefront/operations")
export class StorefrontOperationsController implements OnModuleDestroy {
  private readonly database = new PrismaClient();

  constructor(private readonly mercadoPago: MercadoPagoService) {}

  async onModuleDestroy() {
    await this.database.$disconnect();
  }

  @Get("health")
  async health() {
    const [orders, payments, outbox, webhooks, shipments, duplicates] =
      await Promise.all([
        this.database.$queryRawUnsafe<any[]>(
          `SELECT status,COUNT(*)::int AS count
             FROM "StorefrontOrder"
            WHERE "createdAt" >= NOW() - INTERVAL '7 days'
            GROUP BY status
            ORDER BY status`,
        ),
        this.database.$queryRawUnsafe<any[]>(
          `SELECT status,COUNT(*)::int AS count,
                  MIN("createdAt") AS "oldestCreatedAt"
             FROM "StorefrontPaymentAttempt"
            WHERE "createdAt" >= NOW() - INTERVAL '7 days'
            GROUP BY status
            ORDER BY status`,
        ),
        this.database.$queryRawUnsafe<any[]>(
          `SELECT provider,status,COUNT(*)::int AS count,
                  MIN("createdAt") AS "oldestCreatedAt"
             FROM "IntegrationOutbox"
            WHERE "createdAt" >= NOW() - INTERVAL '7 days'
            GROUP BY provider,status
            ORDER BY provider,status`,
        ),
        this.database.$queryRawUnsafe<any[]>(
          `SELECT provider,status,COUNT(*)::int AS count,
                  MIN("receivedAt") AS "oldestReceivedAt"
             FROM "IntegrationWebhookEvent"
            WHERE "receivedAt" >= NOW() - INTERVAL '7 days'
            GROUP BY provider,status
            ORDER BY provider,status`,
        ),
        this.database.$queryRawUnsafe<any[]>(
          `SELECT status,COUNT(*)::int AS count
             FROM "Shipment"
            WHERE "createdAt" >= NOW() - INTERVAL '7 days'
            GROUP BY status
            ORDER BY status`,
        ),
        this.database.$queryRawUnsafe<any[]>(
          `SELECT "storefrontOrderId",COUNT(*)::int AS "paidAttempts"
             FROM "StorefrontPaymentAttempt"
            WHERE status='PAID'
            GROUP BY "storefrontOrderId"
           HAVING COUNT(*) > 1`,
        ),
      ]);

    const paymentFailures = payments
      .filter((row) => ["ERROR", "FAILED"].includes(String(row.status)))
      .reduce((sum, row) => sum + Number(row.count || 0), 0);
    const webhookErrors = webhooks
      .filter((row) => String(row.status) === "ERROR")
      .reduce((sum, row) => sum + Number(row.count || 0), 0);
    const outboxFailures = outbox
      .filter((row) => String(row.status) === "FAILED")
      .reduce((sum, row) => sum + Number(row.count || 0), 0);
    const duplicatePayments = duplicates.length;

    const status =
      duplicatePayments > 0
        ? "CRITICAL"
        : paymentFailures > 0 || webhookErrors > 0 || outboxFailures > 0
          ? "DEGRADED"
          : "OK";

    return {
      status,
      generatedAt: new Date().toISOString(),
      providers: {
        mercadoPago: { configured: this.mercadoPago.configured() },
      },
      summary: {
        paymentFailures,
        webhookErrors,
        outboxFailures,
        duplicatePayments,
      },
      orders,
      payments,
      outbox,
      webhooks,
      shipments,
      duplicates,
    };
  }
}
