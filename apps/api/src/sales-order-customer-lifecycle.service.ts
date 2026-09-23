import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@bbos/database";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

type EventSource = "BBOS" | "BLING" | "MELHOR_ENVIO" | "CARRIER" | "ADMIN";

@Injectable()
export class SalesOrderCustomerLifecycleService {
  private readonly database = new PrismaClient();

  private trackingSecret() {
    return process.env.ORDER_TRACKING_SECRET?.trim() || process.env.PAYMENT_WEBHOOK_SECRET?.trim() || "";
  }

  trackingToken(orderId: string) {
    const secret = this.trackingSecret();
    if (!secret) return "";
    return createHmac("sha256", secret).update(`sales-order:${orderId}`).digest("base64url");
  }

  validTrackingToken(orderId: string, supplied: string) {
    const expected = this.trackingToken(orderId);
    if (!expected) return false;
    const a = Buffer.from(expected);
    const b = Buffer.from(supplied || "");
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private publicBase() {
    return (process.env.PUBLIC_APP_URL ?? process.env.PUBLIC_WEB_URL ?? process.env.WEB_URL?.split(",")[0] ?? "http://localhost:3000").replace(/\/$/, "");
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
        `SELECT so.id,so."companyId",COALESCE(so."orderNumber",so.code) AS code,so.status,
                so.subtotal,so.discount,so.freight,so."totalAmount",so."shippingServiceName",
                so."carrierName",so."estimatedDeliveryDays",c.name AS "customerName",c.email,
                c.phone,c.address,c.district,c.city,c.state,c."postalCode",sfo.id AS "storefrontOrderId"
           FROM "SalesOrder" so JOIN "Customer" c ON c.id=so."customerId"
           LEFT JOIN "StorefrontOrder" sfo ON sfo."companyId"=so."companyId"
            AND sfo.code=COALESCE(so."orderNumber",so.code)
          WHERE so.id=$1 LIMIT 1`,
        orderId,
      );
      const order = orders[0];
      if (!order) return null;
      if (order.storefrontOrderId) return null;
      const items = await transaction.$queryRawUnsafe<any[]>(
        `SELECT "productName" AS name,quantity,"unitPrice","totalAmount"
           FROM "SalesOrderItem" WHERE "salesOrderId"=$1 ORDER BY "createdAt" ASC`,
        orderId,
      );
      const eventId = randomUUID();
      const inserted = await transaction.$queryRawUnsafe<any[]>(
        `INSERT INTO "SalesOrderCustomerEvent"
          (id,"companyId","salesOrderId","eventType",title,detail,source,public,metadata,"idempotencyKey","occurredAt","createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,$8::jsonb,$9,NOW(),NOW())
         ON CONFLICT ("idempotencyKey") DO NOTHING
         RETURNING id,"occurredAt"`,
        eventId,
        order.companyId,
        order.id,
        eventType,
        title,
        detail,
        source,
        JSON.stringify(metadata),
        idempotencyKey,
      );
      if (!inserted[0]) return null;

      const email = String(order.email || "").trim().toLowerCase();
      if (notify && email) {
        const token = this.trackingToken(order.id);
        const address = String(order.address || "").trim();
        const addressMatch = address.match(/^(.*?)(?:,|\s)+(\d+[A-Za-z0-9/-]*)\s*$/);
        await transaction.$executeRawUnsafe(
          `INSERT INTO "CustomerNotificationOutbox"
            (id,"companyId","storefrontOrderId","orderEventId","salesOrderId","salesOrderEventId",
             channel,destination,template,payload,status,attempts,"idempotencyKey","createdAt","updatedAt")
           VALUES ($1,$2,NULL,NULL,$3,$4,'EMAIL',$5,'ORDER_STATUS',$6::jsonb,'PENDING',0,$7,NOW(),NOW())
           ON CONFLICT ("idempotencyKey") DO NOTHING`,
          randomUUID(),
          order.companyId,
          order.id,
          eventId,
          email,
          JSON.stringify({
            orderCode: order.code,
            eventType,
            title,
            detail,
            trackingUrl: token ? `${this.publicBase()}/pedido/acompanhar/${order.id}?token=${encodeURIComponent(token)}` : null,
            customer: { name: order.customerName, phone: order.phone },
            delivery: {
              street: String(addressMatch?.[1] || address),
              number: String(addressMatch?.[2] || ""),
              district: order.district,
              city: order.city,
              state: order.state,
              postalCode: order.postalCode,
            },
            items: items.map((item) => ({
              name: item.name,
              quantity: Number(item.quantity),
              unitPriceCents: Math.round(Number(item.unitPrice) * 100),
              totalCents: Math.round(Number(item.totalAmount) * 100),
            })),
            subtotalCents: Math.round(Number(order.subtotal ?? 0) * 100),
            shippingCents: Math.round(Number(order.freight ?? 0) * 100),
            totalCents: Math.round(Number(order.totalAmount ?? 0) * 100),
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
