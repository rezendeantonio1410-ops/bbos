import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@bbos/database";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

type EventSource = "BBOS" | "MERCADO_PAGO" | "BLING" | "MELHOR_ENVIO" | "CARRIER" | "ADMIN";

@Injectable()
export class StorefrontLifecycleService {
  private readonly database = new PrismaClient();

  private trackingSecret() {
    return process.env.ORDER_TRACKING_SECRET?.trim() || process.env.PAYMENT_WEBHOOK_SECRET?.trim() || "";
  }

  trackingToken(orderId: string) {
    const secret = this.trackingSecret();
    if (!secret) return "";
    return createHmac("sha256", secret).update(orderId).digest("base64url");
  }

  validTrackingToken(orderId: string, supplied: string) {
    const expected = this.trackingToken(orderId);
    if (!expected) return false;
    const a = Buffer.from(expected);
    const b = Buffer.from(supplied || "");
    return a.length === b.length && timingSafeEqual(a, b);
  }

  async record(
    orderId: string,
    eventType: string,
    title: string,
    detail: string,
    source: EventSource,
    idempotencyKey: string,
    metadata: Record<string, unknown> = {},
    notify = true,
  ) {
    return this.database.$transaction(async (transaction) => {
      const orders = await transaction.$queryRawUnsafe<any[]>(
        `SELECT id,"companyId",code,customer,delivery,items,"subtotalCents","shippingCents","totalCents",
                "shippingServiceName","carrierName","estimatedDeliveryDays"
           FROM "StorefrontOrder" WHERE id=$1 LIMIT 1`,
        orderId,
      );
      const order = orders[0];
      if (!order) return null;
      const eventId = randomUUID();
      const inserted = await transaction.$queryRawUnsafe<any[]>(
        `INSERT INTO "StorefrontOrderEvent"
          (id,"companyId","storefrontOrderId","eventType",title,detail,source,public,metadata,"idempotencyKey","occurredAt","createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,$8::jsonb,$9,NOW(),NOW())
         ON CONFLICT ("idempotencyKey") DO NOTHING
         RETURNING id,"occurredAt"`,
        eventId, order.companyId, order.id, eventType, title, detail, source, JSON.stringify(metadata), idempotencyKey,
      );
      if (!inserted[0]) return null;
      const email = String(order.customer?.email || "").trim().toLowerCase();
      if (notify && email) {
        const publicBase = (process.env.STOREFRONT_WEB_URL?.trim() || "https://bbos-ecommerce-preview-v2.onrender.com").replace(/\/$/, "");
        const token = this.trackingToken(order.id);
        await transaction.$executeRawUnsafe(
          `INSERT INTO "CustomerNotificationOutbox"
            (id,"companyId","storefrontOrderId","orderEventId",channel,destination,template,payload,status,attempts,"idempotencyKey","createdAt","updatedAt")
           VALUES ($1,$2,$3,$4,'EMAIL',$5,'ORDER_STATUS',$6::jsonb,'PENDING',0,$7,NOW(),NOW())
           ON CONFLICT ("idempotencyKey") DO NOTHING`,
          randomUUID(), order.companyId, order.id, eventId, email,
          JSON.stringify({
            orderCode: order.code,
            eventType,
            title,
            detail,
            trackingUrl: token ? `${publicBase}/loja/pedido/${order.id}?token=${encodeURIComponent(token)}` : null,
            customer: order.customer,
            delivery: order.delivery,
            items: order.items,
            subtotalCents: order.subtotalCents,
            shippingCents: order.shippingCents,
            totalCents: order.totalCents,
            shippingServiceName: order.shippingServiceName,
            carrierName: order.carrierName,
            estimatedDeliveryDays: order.estimatedDeliveryDays,
          }),
          `notify:email:${idempotencyKey}`,
        );
      }
      return inserted[0];
    });
  }
}
