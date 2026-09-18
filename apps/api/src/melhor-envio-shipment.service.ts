import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { PrismaClient } from "@bbos/database";
import { randomUUID } from "node:crypto";
import { StorefrontLifecycleService } from "./storefront-lifecycle.service";

const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");

@Injectable()
export class MelhorEnvioShipmentService {
  private readonly database = new PrismaClient();

  constructor(private readonly lifecycle: StorefrontLifecycleService) {}

  private base() {
    return (process.env.MELHOR_ENVIO_API_URL?.trim() || "https://melhorenvio.com.br/api/v2").replace(/\/$/, "");
  }

  private async request(path: string, init?: RequestInit) {
    const token = process.env.MELHOR_ENVIO_ACCESS_TOKEN?.trim();
    if (!token) throw new ServiceUnavailableException("MELHOR_ENVIO_ACCESS_TOKEN não configurado.");
    const response = await fetch(`${this.base()}${path}`, {
      ...init,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "user-agent": process.env.MELHOR_ENVIO_USER_AGENT?.trim() || "Bispo Coffees BBOS",
        ...(init?.headers || {}),
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Melhor Envio recusou a operação", { path, status: response.status });
      throw new ServiceUnavailableException(`Melhor Envio indisponível para esta operação (${response.status}).`);
    }
    return body;
  }

  private required(name: string) {
    const value = process.env[name]?.trim();
    if (!value) throw new ServiceUnavailableException(`${name} não configurado.`);
    return value;
  }

  private sender() {
    return {
      name: process.env.SHIPPING_SENDER_NAME?.trim() || "Bispo Coffees Ltda",
      phone: digits(this.required("SHIPPING_SENDER_PHONE")),
      email: this.required("SHIPPING_SENDER_EMAIL"),
      document: digits(process.env.SHIPPING_SENDER_DOCUMENT || "13008726000112"),
      company_document: digits(process.env.SHIPPING_SENDER_DOCUMENT || "13008726000112"),
      state_register: digits(this.required("SHIPPING_SENDER_STATE_REGISTER")),
      address: this.required("SHIPPING_SENDER_ADDRESS"),
      complement: process.env.SHIPPING_SENDER_COMPLEMENT?.trim() || "",
      number: this.required("SHIPPING_SENDER_NUMBER"),
      district: this.required("SHIPPING_SENDER_DISTRICT"),
      city: this.required("SHIPPING_SENDER_CITY"),
      country_id: "BR",
      postal_code: digits(this.required("SHIPPING_ORIGIN_POSTAL_CODE")),
    };
  }

  async markInvoiceAuthorized(orderId: string, metadata: Record<string, unknown> = {}) {
    const updated = await this.database.$executeRawUnsafe(
      `UPDATE "StorefrontOrder" SET status='INVOICED',"updatedAt"=NOW()
        WHERE id=$1 AND status IN ('PAID','PREPARING','INVOICED')`,
      orderId,
    );
    if (!updated) throw new BadRequestException("Pedido não encontrado ou fora da etapa de faturamento.");
    await this.lifecycle.record(
      orderId,
      "INVOICE_AUTHORIZED",
      "Nota fiscal emitida",
      "A nota fiscal do seu pedido foi autorizada e a expedição será preparada.",
      "BLING",
      `storefront:invoice-authorized:${orderId}`,
      metadata,
    );
    return { orderId, status: "INVOICED" };
  }

  async createLabel(orderId: string) {
    const orders = await this.database.$queryRawUnsafe<any[]>(
      `SELECT o.*,q.package,q."providerPriceCents",q."customerPriceCents",q."serviceId",q."serviceName",q."carrierName"
         FROM "StorefrontOrder" o JOIN "ShippingQuote" q ON q.id=o."shippingQuoteId"
        WHERE o.id=$1 LIMIT 1`,
      orderId,
    );
    const order = orders[0];
    if (!order) throw new BadRequestException("Pedido ou cotação de frete não encontrado.");
    if (order.status !== "INVOICED") throw new BadRequestException("A etiqueta só pode ser comprada após a autorização da NF-e.");
    if (order.shippingProvider !== "MELHOR_ENVIO") throw new BadRequestException("Este pedido não utiliza Melhor Envio.");

    const prior = await this.database.$queryRawUnsafe<any[]>(
      `SELECT * FROM "Shipment" WHERE "storefrontOrderId"=$1 LIMIT 1`,
      orderId,
    );
    if (prior[0]?.labelUrl) return { ...prior[0], idempotent: true };

    const shipmentId = prior[0]?.id || randomUUID();
    if (!prior[0]) {
      await this.database.$executeRawUnsafe(
        `INSERT INTO "Shipment"
          (id,"companyId","storefrontOrderId","shippingQuoteId",provider,status,"serviceId","serviceName","carrierName",
           "providerPriceCents","customerPriceCents",metadata,"createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,'MELHOR_ENVIO','PENDING',$5,$6,$7,$8,$9,'{}'::jsonb,NOW(),NOW())`,
        shipmentId, order.companyId, order.id, order.shippingQuoteId, order.serviceId, order.serviceName,
        order.carrierName, order.providerPriceCents, order.customerPriceCents,
      );
    }

    const customer = order.customer || {};
    const delivery = order.delivery || {};
    const items = Array.isArray(order.items) ? order.items : [];
    let externalId = prior[0]?.externalId || "";
    if (!externalId) {
      const cartResult = await this.request("/me/cart", {
        method: "POST",
        body: JSON.stringify({
        service: Number(order.serviceId),
        from: this.sender(),
        to: {
          name: customer.name,
          phone: digits(customer.phone),
          email: customer.email,
          document: digits(customer.cpf),
          address: delivery.street,
          complement: delivery.complement || "",
          number: delivery.number,
          district: delivery.district,
          city: delivery.city,
          state_abbr: delivery.state,
          country_id: "BR",
          postal_code: digits(delivery.postalCode),
        },
        products: items.map((item: any) => ({
          name: item.name,
          quantity: Number(item.quantity),
          unitary_value: Number(item.unitPriceCents) / 100,
          weight: Math.max(0.001, Number(item.weightGrams || 0) / 1000 / Math.max(1, Number(item.quantity))),
        })),
        volumes: [order.package],
        options: { insurance_value: Number(order.subtotalCents) / 100, receipt: false, own_hand: false, reverse: false, non_commercial: false },
        }),
      });
      externalId = String(cartResult?.id || "");
      const cartPriceCents = Math.round(Number(cartResult?.price || cartResult?.custom_price || 0) * 100);
      if (cartPriceCents > 0 && cartPriceCents !== Number(order.providerPriceCents)) {
        await this.database.$executeRawUnsafe(
          `UPDATE "Shipment" SET status='EXCEPTION',metadata=$2::jsonb,"updatedAt"=NOW() WHERE id=$1`,
          shipmentId,
          JSON.stringify({ reason: "PRICE_CHANGED", quotedCents: Number(order.providerPriceCents), cartPriceCents, cartResult }),
        );
        await this.database.$executeRawUnsafe(
          `UPDATE "StorefrontOrder" SET status='EXCEPTION',"updatedAt"=NOW() WHERE id=$1`,
          order.id,
        );
        await this.lifecycle.record(
          order.id,
          "EXCEPTION",
          "Envio em conferência",
          "Identificamos uma alteração no custo da transportadora. A Bispo Coffees fará a conferência sem cobrança adicional automática.",
          "MELHOR_ENVIO",
          `storefront:shipping-price-exception:${order.id}`,
          { quotedCents: Number(order.providerPriceCents), cartPriceCents },
        );
        throw new BadRequestException("O valor da transportadora mudou após a compra. Pedido enviado para conferência, sem cobrança adicional ao cliente.");
      }
    }
    if (!externalId) throw new ServiceUnavailableException("Melhor Envio não retornou o identificador da remessa.");
    await this.database.$executeRawUnsafe(
      `UPDATE "Shipment" SET "externalId"=$2,status='CARTED',"updatedAt"=NOW() WHERE id=$1`,
      shipmentId, externalId,
    );

    await this.request("/me/shipment/checkout", { method: "POST", body: JSON.stringify({ orders: [externalId] }) });
    await this.database.$executeRawUnsafe(`UPDATE "Shipment" SET status='PURCHASED',"updatedAt"=NOW() WHERE id=$1`, shipmentId);
    await this.request("/me/shipment/generate", { method: "POST", body: JSON.stringify({ orders: [externalId] }) });
    const printed = await this.request("/me/shipment/print", { method: "POST", body: JSON.stringify({ orders: [externalId], mode: "public" }) });
    const labelUrl = String(printed?.url || printed?.data?.url || "");
    const details = await this.request(`/me/orders/${encodeURIComponent(externalId)}`, { method: "GET" }).catch(() => ({}));
    const trackingCode = String(details?.tracking || details?.tracking_code || "") || null;
    await this.database.$executeRawUnsafe(
      `UPDATE "Shipment" SET status='LABEL_READY',"labelUrl"=$2,"trackingCode"=$3,metadata=$4::jsonb,"updatedAt"=NOW() WHERE id=$1`,
      shipmentId, labelUrl || null, trackingCode, JSON.stringify(details || {}),
    );
    await this.lifecycle.record(
      order.id,
      "SHIPMENT_CREATED",
      "Envio preparado",
      "A etiqueta de transporte foi emitida e o pedido está pronto para postagem.",
      "MELHOR_ENVIO",
      `storefront:shipment-created:${order.id}`,
      { shipmentId, externalId, carrierName: order.carrierName, serviceName: order.serviceName },
    );
    return { id: shipmentId, externalId, status: "LABEL_READY", labelUrl, trackingCode };
  }

  async applyTrackingUpdate(externalId: string, statusValue: string, payload: unknown) {
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT * FROM "Shipment" WHERE provider='MELHOR_ENVIO' AND "externalId"=$1 LIMIT 1`,
      externalId,
    );
    const shipment = rows[0];
    if (!shipment) return { ignored: true };
    const normalized = statusValue.toLowerCase();
    const mapping = normalized.includes("deliver") && !normalized.includes("out")
      ? { status: "DELIVERED", order: "DELIVERED", event: "DELIVERED", title: "Pedido entregue", detail: "A transportadora confirmou a entrega do seu pedido." }
      : normalized.includes("out_for_delivery") || normalized.includes("saiu")
        ? { status: "OUT_FOR_DELIVERY", order: "SHIPPED", event: "OUT_FOR_DELIVERY", title: "Saiu para entrega", detail: "Seu pedido saiu para entrega no endereço informado." }
        : normalized.includes("post") || normalized.includes("transit") || normalized.includes("movimenta")
          ? { status: "IN_TRANSIT", order: "SHIPPED", event: "SHIPPED", title: "Pedido a caminho", detail: "Seu pedido foi postado e está a caminho." }
          : null;
    if (!mapping) return { ignored: true };
    await this.database.$executeRawUnsafe(
      `UPDATE "Shipment" SET status=$2,metadata=$3::jsonb,
         "postedAt"=CASE WHEN $2 IN ('IN_TRANSIT','OUT_FOR_DELIVERY','DELIVERED') THEN COALESCE("postedAt",NOW()) ELSE "postedAt" END,
         "deliveredAt"=CASE WHEN $2='DELIVERED' THEN COALESCE("deliveredAt",NOW()) ELSE "deliveredAt" END,"updatedAt"=NOW() WHERE id=$1`,
      shipment.id, mapping.status, JSON.stringify(payload || {}),
    );
    await this.database.$executeRawUnsafe(`UPDATE "StorefrontOrder" SET status=$2,"updatedAt"=NOW() WHERE id=$1`, shipment.storefrontOrderId, mapping.order);
    await this.lifecycle.record(
      shipment.storefrontOrderId, mapping.event, mapping.title, mapping.detail, "CARRIER",
      `storefront:${mapping.event.toLowerCase()}:${shipment.storefrontOrderId}`, { externalId, status: statusValue },
    );
    return { updated: true, status: mapping.status };
  }
}
