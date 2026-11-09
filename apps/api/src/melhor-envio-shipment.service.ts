import {
  BadRequestException,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from "@nestjs/common";
import { prisma } from "@bbos/database";
import { randomUUID } from "node:crypto";
import { StorefrontLifecycleService } from "./storefront-lifecycle.service";
import { MelhorEnvioAuthService } from "./melhor-envio-auth.service";
import { SalesOrderCustomerLifecycleService } from "./sales-order-customer-lifecycle.service";
import { settleMelhorEnvioFreight } from "./storefront-shipping-finance";
import {
  assessMelhorEnvioRecipient,
  melhorEnvioRecipientError,
} from "./melhor-envio-recipient-policy";

const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");

export function normalizeMelhorEnvioTrackingStatus(value: unknown) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^order\./, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  // "undelivered" precisa ser reconhecido antes de "delivered". Caso
  // contrário, uma entrega frustrada pode ser interpretada como concluída.
  if (
    normalized.includes("undelivered") ||
    normalized.includes("not_delivered") ||
    normalized.includes("delivery_failed") ||
    normalized.includes("failed_delivery") ||
    normalized.includes("nao_entregue") ||
    normalized.includes("nao_pode_ser_efetuada")
  )
    return "undelivered";
  if (
    normalized.includes("return_to_sender") ||
    normalized.includes("returning") ||
    normalized.includes("returned") ||
    normalized.includes("devolucao") ||
    normalized.includes("devolvido") ||
    normalized.includes("sera_devolvido")
  )
    return "returned";
  if (normalized.includes("paused") || normalized.includes("interrompid"))
    return "paused";
  if (normalized.includes("suspended") || normalized.includes("suspens"))
    return "suspended";
  if (normalized === "delivered" || normalized === "entregue")
    return "delivered";
  if (normalized.includes("out_for_delivery") || normalized.includes("saiu"))
    return "out_for_delivery";
  if (normalized.includes("received") || normalized.includes("recebid"))
    return "received";
  if (
    normalized.includes("posted") ||
    normalized.includes("postad") ||
    normalized.includes("in_transit") ||
    normalized.includes("transit") ||
    normalized.includes("movimenta")
  )
    return "in_transit";
  if (normalized.includes("cancelled") || normalized.includes("canceled"))
    return "cancelled";
  if (normalized.includes("generated")) return "generated";
  if (normalized.includes("released")) return "released";
  if (normalized.includes("created")) return "created";
  if (normalized.includes("pending")) return "pending";
  return normalized;
}

function trackingIssueReason(payload: any) {
  const candidates = [
    payload?.reason,
    payload?.description,
    payload?.message,
    payload?.detail,
    payload?.data?.reason,
    payload?.data?.description,
    payload?.data?.message,
    payload?.data?.detail,
    payload?.tracking?.reason,
    payload?.tracking?.description,
  ];
  const reason = candidates.find(
    (candidate) => typeof candidate === "string" && candidate.trim().length > 3,
  );
  return typeof reason === "string" ? reason.trim().slice(0, 280) : null;
}

export function melhorEnvioSenderFiscalFields(input: {
  companyDocument?: unknown;
  personalDocument?: unknown;
  stateRegister?: unknown;
}) {
  const companyDocument = digits(input.companyDocument);
  if (companyDocument) {
    if (companyDocument.length !== 14) {
      throw new ServiceUnavailableException(
        "SHIPPING_SENDER_DOCUMENT deve conter um CNPJ válido com 14 dígitos.",
      );
    }
    const stateRegister = digits(input.stateRegister);
    if (!stateRegister) {
      throw new ServiceUnavailableException(
        "SHIPPING_SENDER_STATE_REGISTER não configurado.",
      );
    }
    return {
      company_document: companyDocument,
      state_register: stateRegister,
    };
  }

  const personalDocument = digits(input.personalDocument);
  if (personalDocument.length !== 11) {
    throw new ServiceUnavailableException(
      "Configure o CNPJ ou um CPF válido para o remetente do Melhor Envio.",
    );
  }
  return { document: personalDocument };
}

@Injectable()
export class MelhorEnvioShipmentService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly database = prisma;
  private trackingTimer?: NodeJS.Timeout;
  private reconcilingTracking = false;

  constructor(
    private readonly lifecycle: StorefrontLifecycleService,
    private readonly melhorEnvioAuth: MelhorEnvioAuthService,
    private readonly customerLifecycle: SalesOrderCustomerLifecycleService,
  ) {}

  async onModuleInit() {
    // O status comercial continua protegido pelas regras de estoque.
    // Aqui sincronizamos apenas o que o Melhor Envio informar sobre remessas ativas.
    await this.auditRecentDeliveredShipments();
    await this.backfillDeliveryExceptionNotifications();
    void this.reconcileActiveShipments();
    this.trackingTimer = setInterval(
      () => void this.reconcileActiveShipments(),
      300_000,
    );
    this.trackingTimer.unref?.();
  }

  async onModuleDestroy() {
    if (this.trackingTimer) clearInterval(this.trackingTimer);
  }

  private async auditRecentDeliveredShipments() {
    try {
      const shipments = await this.database.$queryRawUnsafe<any[]>(
        `SELECT id,"companyId","externalId"
           FROM "Shipment"
          WHERE provider='MELHOR_ENVIO'
            AND status='DELIVERED'
            AND "externalId" IS NOT NULL
            AND "updatedAt">=NOW()-INTERVAL '120 days'
          ORDER BY "updatedAt" DESC
          LIMIT 100`,
      );
      for (const shipment of shipments) {
        const trackingResponse = await this.request(
          shipment.companyId,
          "/me/shipment/tracking",
          {
            method: "POST",
            body: JSON.stringify({ orders: [shipment.externalId] }),
          },
        ).catch(() => null);
        const trackingDetails =
          (Array.isArray(trackingResponse) ? trackingResponse[0] : null) ||
          trackingResponse?.[shipment.externalId] ||
          trackingResponse?.data?.[0] ||
          trackingResponse?.data?.[shipment.externalId] ||
          trackingResponse?.data ||
          trackingResponse ||
          {};
        const status = normalizeMelhorEnvioTrackingStatus(
          trackingDetails?.status ||
            trackingDetails?.tracking?.status ||
            trackingDetails?.self_tracking?.status ||
            "",
        );
        if (
          ["undelivered", "returned", "paused", "suspended"].includes(status)
        ) {
          await this.applyTrackingUpdate(
            shipment.externalId,
            status,
            trackingDetails,
          );
        }
      }
    } catch (error) {
      console.error("Falha ao auditar entregas recentes", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async backfillDeliveryExceptionNotifications() {
    try {
      const shipments = await this.database.$queryRawUnsafe<any[]>(
        `SELECT sh.id,sh."companyId",sh."salesOrderId",
                COALESCE(so."orderNumber",so.code) AS "salesOrderNumber",
                customer.name AS "customerName",
                COALESCE(event.title,'Problema na entrega') AS title,
                COALESCE(event.detail,'A transportadora informou uma ocorrência que exige ação.') AS detail
           FROM "Shipment" sh
           LEFT JOIN "SalesOrder" so ON so.id=sh."salesOrderId"
           LEFT JOIN "Customer" customer ON customer.id=so."customerId"
           LEFT JOIN LATERAL (
             SELECT title,detail
               FROM "SalesOrderCustomerEvent"
              WHERE "salesOrderId"=sh."salesOrderId" AND source='CARRIER'
              ORDER BY "occurredAt" DESC LIMIT 1
           ) event ON TRUE
          WHERE sh.provider='MELHOR_ENVIO' AND sh.status='EXCEPTION'
          ORDER BY sh."updatedAt" DESC
          LIMIT 100`,
      );
      for (const shipment of shipments) {
        await this.notifyDeliveryException(
          shipment,
          shipment.title,
          shipment.detail,
        );
      }
    } catch (error) {
      console.error("Falha ao recuperar alertas de entrega pendentes", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async notifyDeliveryException(
    shipment: any,
    title: string,
    detail: string,
  ) {
    const orderLabel = shipment.salesOrderNumber
      ? `Pedido ${shipment.salesOrderNumber}`
      : "Uma entrega";
    const customerLabel = shipment.customerName
      ? ` de ${shipment.customerName}`
      : "";
    const notificationType = `ORDER_DELIVERY_EXCEPTION:${shipment.id}`;
    await this.database.$executeRawUnsafe(
      `INSERT INTO "OperationalNotification"
        (id,"companyId",type,title,message,"targetRole","createdAt")
       SELECT $1,$2,$3,$4,$5,'ALL',NOW()
        WHERE NOT EXISTS (
          SELECT 1 FROM "OperationalNotification"
           WHERE "companyId"=$2 AND type=$3
        )`,
      randomUUID(),
      shipment.companyId,
      notificationType,
      "Pendência crítica na entrega",
      `${orderLabel}${customerLabel}: ${title}. ${detail}`,
    );
  }

  private async reconcileActiveShipments() {
    if (this.reconcilingTracking) return;
    this.reconcilingTracking = true;
    try {
      const shipments = await this.database.$queryRawUnsafe<any[]>(
        `SELECT sh.id,sh."companyId",sh."externalId",sh.status,sh."salesOrderId",sh."storefrontOrderId",
                sh."trackingCode",sh."trackingUrl",sh."postedAt"
           FROM "Shipment" sh
          WHERE sh.provider='MELHOR_ENVIO'
            AND sh."externalId" IS NOT NULL
            AND sh.status IN ('LABEL_READY','PURCHASED','IN_TRANSIT','OUT_FOR_DELIVERY','EXCEPTION')
          ORDER BY sh."updatedAt" ASC
          LIMIT 100`,
      );

      for (const shipment of shipments) {
        try {
          const [orderDetails, trackingResponse] = await Promise.all([
            this.request(
              shipment.companyId,
              `/me/orders/${encodeURIComponent(shipment.externalId)}`,
              { method: "GET" },
            ).catch(() => ({})),
            this.request(shipment.companyId, "/me/shipment/tracking", {
              method: "POST",
              body: JSON.stringify({ orders: [shipment.externalId] }),
            }).catch(() => ({})),
          ]);

          const trackingDetails =
            (Array.isArray(trackingResponse) ? trackingResponse[0] : null) ||
            trackingResponse?.[shipment.externalId] ||
            trackingResponse?.data?.[0] ||
            trackingResponse?.data?.[shipment.externalId] ||
            trackingResponse ||
            {};

          const details = {
            ...(orderDetails || {}),
            ...(trackingDetails || {}),
            tracking_snapshot: trackingDetails || {},
            order_snapshot: orderDetails || {},
          };

          const trackingCode =
            String(
              trackingDetails?.tracking ||
                trackingDetails?.tracking_code ||
                trackingDetails?.melhorenvio_tracking ||
                orderDetails?.tracking ||
                orderDetails?.tracking_code ||
                "",
            ) || null;
          const trackingUrl =
            String(
              trackingDetails?.tracking_url ||
                trackingDetails?.tracking?.url ||
                orderDetails?.tracking_url ||
                orderDetails?.tracking?.url ||
                orderDetails?.service?.company?.tracking_link ||
                "",
            ) || null;

          await this.database.$executeRawUnsafe(
            `UPDATE "Shipment"
                SET "trackingCode"=COALESCE($2,"trackingCode"),
                    "trackingUrl"=COALESCE($3,"trackingUrl"),
                    metadata=COALESCE(metadata,'{}'::jsonb) || $4::jsonb,
                    "updatedAt"=NOW()
              WHERE id=$1`,
            shipment.id,
            trackingCode,
            trackingUrl,
            JSON.stringify(details || {}),
          );

          const rawStatus = normalizeMelhorEnvioTrackingStatus(
            trackingDetails?.status ||
              trackingDetails?.tracking?.status ||
              trackingDetails?.self_tracking?.status ||
              orderDetails?.status ||
              "",
          );
          const postedAt =
            trackingDetails?.posted_at || orderDetails?.posted_at || null;
          const deliveredAt =
            trackingDetails?.delivered_at || orderDetails?.delivered_at || null;

          if (
            ["undelivered", "returned", "paused", "suspended"].includes(
              rawStatus,
            )
          ) {
            await this.applyTrackingUpdate(
              shipment.externalId,
              rawStatus,
              details,
            );
          } else if (deliveredAt || rawStatus === "delivered") {
            await this.applyTrackingUpdate(
              shipment.externalId,
              "delivered",
              details,
            );
          } else if (rawStatus === "out_for_delivery") {
            await this.applyTrackingUpdate(
              shipment.externalId,
              "out_for_delivery",
              details,
            );
          } else if (postedAt || rawStatus === "in_transit") {
            await this.applyTrackingUpdate(
              shipment.externalId,
              "in_transit",
              details,
            );
          }
        } catch (error) {
          console.error("Falha ao reconciliar rastreio do Melhor Envio", {
            shipmentId: shipment.id,
            externalId: shipment.externalId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } finally {
      this.reconcilingTracking = false;
    }
  }

  private base() {
    return (
      process.env.MELHOR_ENVIO_API_URL?.trim() ||
      "https://melhorenvio.com.br/api/v2"
    ).replace(/\/$/, "");
  }

  private async request(companyId: string, path: string, init?: RequestInit) {
    const token = await this.melhorEnvioAuth.accessToken(companyId);
    const response = await fetch(`${this.base()}${path}`, {
      ...init,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "user-agent":
          process.env.MELHOR_ENVIO_USER_AGENT?.trim() || "Bispo Coffees BBOS",
        ...(init?.headers || {}),
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const providerMessage = String(
        body?.message ||
          body?.error ||
          (body?.errors ? JSON.stringify(body.errors) : "") ||
          "",
      ).trim();
      console.error("Melhor Envio recusou a operação", {
        path,
        status: response.status,
        error: providerMessage || undefined,
      });
      throw new ServiceUnavailableException(
        providerMessage
          ? `Melhor Envio: ${providerMessage}`
          : `Melhor Envio indisponível para esta operação (${response.status}).`,
      );
    }
    return body;
  }

  private required(name: string) {
    const value = process.env[name]?.trim();
    if (!value)
      throw new ServiceUnavailableException(`${name} não configurado.`);
    return value;
  }

  private async printWhenReady(companyId: string, externalId: string) {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        const printed = await this.request(companyId, "/me/shipment/print", {
          method: "POST",
          body: JSON.stringify({ orders: [externalId], mode: "public" }),
        });
        const url = String(printed?.url || printed?.data?.url || "");
        if (url) return url;
      } catch (error) {
        if (attempt === 5) throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
    throw new ServiceUnavailableException(
      "A etiqueta foi gerada, mas o PDF ainda não ficou disponível.",
    );
  }

  private sender() {
    const fiscalFields = melhorEnvioSenderFiscalFields({
      companyDocument: process.env.SHIPPING_SENDER_DOCUMENT || "13008726000112",
      personalDocument: process.env.SHIPPING_SENDER_CPF,
      stateRegister: process.env.SHIPPING_SENDER_STATE_REGISTER,
    });

    return {
      name: process.env.SHIPPING_SENDER_NAME?.trim() || "Bispo Coffees Ltda",
      phone: digits(this.required("SHIPPING_SENDER_PHONE")),
      email: this.required("SHIPPING_SENDER_EMAIL"),
      ...fiscalFields,
      address: this.required("SHIPPING_SENDER_ADDRESS"),
      complement: process.env.SHIPPING_SENDER_COMPLEMENT?.trim() || "",
      number: this.required("SHIPPING_SENDER_NUMBER"),
      district: this.required("SHIPPING_SENDER_DISTRICT"),
      city: this.required("SHIPPING_SENDER_CITY"),
      country_id: "BR",
      postal_code: digits(this.required("SHIPPING_ORIGIN_POSTAL_CODE")),
    };
  }

  async markInvoiceAuthorized(
    orderId: string,
    metadata: Record<string, unknown> = {},
  ) {
    const updated = await this.database.$executeRawUnsafe(
      `UPDATE "StorefrontOrder" SET status='INVOICED',"updatedAt"=NOW()
        WHERE id=$1 AND status IN ('PAID','PREPARING','INVOICED')`,
      orderId,
    );
    if (!updated)
      throw new BadRequestException(
        "Pedido não encontrado ou fora da etapa de faturamento.",
      );
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
      `SELECT o.*,q.package,q."providerPriceCents",q."customerPriceCents",q."serviceId",q."serviceName",q."carrierName",
              q."destinationPostalCode"
         FROM "StorefrontOrder" o JOIN "ShippingQuote" q ON q.id=o."shippingQuoteId"
        WHERE o.id=$1 LIMIT 1`,
      orderId,
    );
    const order = orders[0];
    if (!order)
      throw new BadRequestException(
        "Pedido ou cotação de frete não encontrado.",
      );
    if (order.status !== "INVOICED")
      throw new BadRequestException(
        "A etiqueta só pode ser comprada após a autorização da NF-e.",
      );
    if (order.shippingProvider !== "MELHOR_ENVIO")
      throw new BadRequestException("Este pedido não utiliza Melhor Envio.");

    const prior = await this.database.$queryRawUnsafe<any[]>(
      `SELECT * FROM "Shipment" WHERE "storefrontOrderId"=$1 ORDER BY "createdAt" DESC LIMIT 1`,
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
        shipmentId,
        order.companyId,
        order.id,
        order.shippingQuoteId,
        order.serviceId,
        order.serviceName,
        order.carrierName,
        order.providerPriceCents,
        order.customerPriceCents,
      );
    }

    const customer = order.customer || {};
    const delivery = order.delivery || {};
    const items = Array.isArray(order.items) ? order.items : [];
    const recipientAssessment = assessMelhorEnvioRecipient({
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      document: customer.cpf || customer.cnpj || customer.taxId,
      address: delivery.street,
      number: delivery.number,
      complement: delivery.complement,
      district: delivery.district,
      city: delivery.city,
      state: delivery.state,
      postalCode: delivery.postalCode,
      quotedPostalCode: order.destinationPostalCode,
    });
    if (!recipientAssessment.ready) {
      throw new BadRequestException(
        melhorEnvioRecipientError(recipientAssessment.issues),
      );
    }
    const recipient = recipientAssessment.recipient;
    await this.database.$executeRawUnsafe(
      `UPDATE "Shipment"
          SET metadata=COALESCE(metadata,'{}'::jsonb) || $2::jsonb,
              "updatedAt"=NOW()
        WHERE id=$1`,
      shipmentId,
      JSON.stringify({
        recipientPreflight: {
          checkedAt: new Date().toISOString(),
          source: "STOREFRONT_ORDER_SNAPSHOT",
          recipient,
        },
      }),
    );
    let externalId = prior[0]?.externalId || "";
    if (!externalId) {
      const cartResult = await this.request(order.companyId, "/me/cart", {
        method: "POST",
        body: JSON.stringify({
          service: Number(order.serviceId),
          from: this.sender(),
          to: recipient,
          products: items.map((item: any) => ({
            name: item.name,
            quantity: Number(item.quantity),
            unitary_value: Number(item.unitPriceCents) / 100,
            weight: Math.max(
              0.001,
              Number(item.weightGrams || 0) /
                1000 /
                Math.max(1, Number(item.quantity)),
            ),
          })),
          volumes: Array.isArray(order.package)
            ? order.package
            : [order.package],
          options: {
            insurance_value: Number(order.subtotalCents) / 100,
            receipt: false,
            own_hand: false,
            reverse: false,
            non_commercial: false,
          },
        }),
      });
      externalId = String(cartResult?.id || "");
      const cartPriceCents = Math.round(
        Number(cartResult?.price || cartResult?.custom_price || 0) * 100,
      );
      if (
        cartPriceCents > 0 &&
        cartPriceCents !== Number(order.providerPriceCents)
      ) {
        await this.database.$executeRawUnsafe(
          `UPDATE "Shipment" SET status='EXCEPTION',metadata=$2::jsonb,"updatedAt"=NOW() WHERE id=$1`,
          shipmentId,
          JSON.stringify({
            reason: "PRICE_CHANGED",
            quotedCents: Number(order.providerPriceCents),
            cartPriceCents,
            cartResult,
          }),
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
        throw new BadRequestException(
          "O valor da transportadora mudou após a compra. Pedido enviado para conferência, sem cobrança adicional ao cliente.",
        );
      }
    }
    if (!externalId)
      throw new ServiceUnavailableException(
        "Melhor Envio não retornou o identificador da remessa.",
      );
    await this.database.$executeRawUnsafe(
      `UPDATE "Shipment" SET "externalId"=$2,status='CARTED',"updatedAt"=NOW() WHERE id=$1`,
      shipmentId,
      externalId,
    );

    await this.request(order.companyId, "/me/shipment/checkout", {
      method: "POST",
      body: JSON.stringify({ orders: [externalId] }),
    });
    await this.database.$executeRawUnsafe(
      `UPDATE "Shipment" SET status='PURCHASED',"updatedAt"=NOW() WHERE id=$1`,
      shipmentId,
    );
    await this.database.$transaction((transaction) =>
      settleMelhorEnvioFreight(transaction, {
        id: order.id,
        companyId: order.companyId,
        code: order.code,
        shippingProvider: order.shippingProvider,
        shippingCents: Number(
          order.customerPriceCents ?? order.shippingCents ?? 0,
        ),
        providerPriceCents: Number(order.providerPriceCents ?? 0),
        paidAt: order.paidAt,
        shipmentId,
        externalId,
      }),
    );
    await this.request(order.companyId, "/me/shipment/generate", {
      method: "POST",
      body: JSON.stringify({ orders: [externalId] }),
    });
    const labelUrl = await this.printWhenReady(order.companyId, externalId);
    const details = await this.request(
      order.companyId,
      `/me/orders/${encodeURIComponent(externalId)}`,
      { method: "GET" },
    ).catch(() => ({}));
    const trackingCode =
      String(details?.tracking || details?.tracking_code || "") || null;
    const trackingUrl =
      String(details?.tracking_url || details?.tracking?.url || "") || null;
    await this.database.$executeRawUnsafe(
      `UPDATE "Shipment" SET status='LABEL_READY',"labelUrl"=$2,"trackingCode"=$3,"trackingUrl"=$4,metadata=$5::jsonb,"updatedAt"=NOW() WHERE id=$1`,
      shipmentId,
      labelUrl || null,
      trackingCode,
      trackingUrl,
      JSON.stringify(details || {}),
    );
    await this.lifecycle.record(
      order.id,
      "SHIPMENT_CREATED",
      "Envio preparado",
      "A etiqueta de transporte foi emitida e o pedido está pronto para postagem.",
      "MELHOR_ENVIO",
      `storefront:shipment-created:${order.id}`,
      {
        shipmentId,
        externalId,
        carrierName: order.carrierName,
        serviceName: order.serviceName,
      },
    );
    return {
      id: shipmentId,
      externalId,
      status: "LABEL_READY",
      labelUrl,
      trackingCode,
      trackingUrl,
    };
  }

  async postingAgenciesForSalesOrder(orderId: string) {
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT so.id,so."companyId",so."shippingProvider",so."shippingQuoteId",
              q."carrierName",q."serviceName",q."serviceId",q."rawResponse"
         FROM "SalesOrder" so
         JOIN "ShippingQuote" q ON q.id=so."shippingQuoteId"
        WHERE so.id=$1 LIMIT 1`,
      orderId,
    );
    const order = rows[0];
    if (!order)
      throw new BadRequestException(
        "Pedido ou cotação de frete não encontrado.",
      );
    if (order.shippingProvider !== "MELHOR_ENVIO")
      throw new BadRequestException("Este pedido não utiliza Melhor Envio.");

    const sender = this.sender();
    const carrierCompanyId = String(
      order.rawResponse?.company?.id ?? "",
    ).trim();
    const params = new URLSearchParams({
      country: "BR",
      state: String(
        process.env.SHIPPING_SENDER_STATE?.trim() || "PR",
      ).toUpperCase(),
      city: sender.city,
    });
    if (carrierCompanyId) params.set("company", carrierCompanyId);

    const response = await this.request(
      order.companyId,
      `/me/shipment/agencies?${params.toString()}`,
      { method: "GET" },
    );
    const rawAgencies = Array.isArray(response)
      ? response
      : Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.agencies)
          ? response.agencies
          : [];

    const agencies = rawAgencies
      .map((agency: any) => {
        const address = agency?.address ?? agency?.agency_address ?? {};
        const city = address?.city ?? agency?.city ?? {};
        const state = address?.state ?? agency?.state ?? {};
        const street =
          address?.address ??
          address?.street ??
          agency?.address ??
          agency?.street ??
          "";
        const number = address?.number ?? agency?.number ?? "";
        const district =
          address?.district ?? address?.neighborhood ?? agency?.district ?? "";
        const postalCode =
          address?.postal_code ??
          address?.postalCode ??
          agency?.postal_code ??
          agency?.postalCode ??
          "";
        const cityName =
          typeof city === "string"
            ? city
            : (city?.city ?? city?.name ?? agency?.city_name ?? sender.city);
        const stateCode =
          typeof state === "string"
            ? state
            : (state?.state_abbr ??
              state?.abbr ??
              state?.code ??
              agency?.state_abbr ??
              params.get("state"));
        const id = String(
          agency?.id ?? agency?.agency_id ?? agency?.agencyId ?? "",
        );
        const name = String(
          agency?.name ??
            agency?.company_name ??
            agency?.agency_name ??
            `Agência ${id}`,
        );
        const addressLine = [street, number].filter(Boolean).join(", ");
        const locationLine = [district, cityName, stateCode]
          .filter(Boolean)
          .join(" · ");
        const mapsQuery = [
          addressLine,
          district,
          cityName,
          stateCode,
          postalCode,
        ]
          .filter(Boolean)
          .join(", ");
        return {
          id,
          name,
          companyName: String(
            agency?.company_name ??
              agency?.company?.name ??
              order.carrierName ??
              "",
          ),
          address: addressLine,
          district: String(district || ""),
          city: String(cityName || ""),
          state: String(stateCode || ""),
          postalCode: String(postalCode || ""),
          locationLine,
          phone: String(agency?.phone ?? agency?.telephone ?? ""),
          latitude: Number(agency?.latitude ?? address?.latitude ?? NaN),
          longitude: Number(agency?.longitude ?? address?.longitude ?? NaN),
          mapsUrl: mapsQuery
            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`
            : null,
        };
      })
      .filter((agency: any) => agency.id);

    return {
      carrierName: order.carrierName,
      serviceName: order.serviceName,
      serviceId: order.serviceId,
      origin: {
        city: sender.city,
        state: params.get("state"),
        postalCode: sender.postal_code,
      },
      agencies,
    };
  }
  async requoteForSalesOrder(
    orderId: string,
    packages?: Array<{
      weight: number;
      length: number;
      width: number;
      height: number;
    }>,
  ) {
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT so.*,q.package,q."providerPriceCents",q."customerPriceCents",
              q."serviceId",q."serviceName",q."carrierName",
              c."postalCode" AS "customerPostalCode"
         FROM "SalesOrder" so
         JOIN "ShippingQuote" q ON q.id=so."shippingQuoteId"
         JOIN "Customer" c ON c.id=so."customerId"
        WHERE so.id=$1 LIMIT 1`,
      orderId,
    );
    const order = rows[0];
    if (!order)
      throw new BadRequestException(
        "Pedido comercial ou cotação de frete não encontrado.",
      );
    const originalPackages = Array.isArray(order.package)
      ? order.package
      : [order.package];
    const packagePayload =
      Array.isArray(packages) && packages.length ? packages : originalPackages;
    for (const volume of packagePayload) {
      if (
        ![volume.weight, volume.length, volume.width, volume.height].every(
          (value) => Number(value) > 0,
        )
      )
        throw new BadRequestException(
          "Peso e dimensões de todas as caixas devem ser maiores que zero.",
        );
    }
    const response = await this.request(
      order.companyId,
      "/me/shipment/calculate",
      {
        method: "POST",
        body: JSON.stringify({
          from: { postal_code: this.sender().postal_code },
          to: { postal_code: digits(order.customerPostalCode) },
          packages: packagePayload,
        }),
      },
    );
    const raw = Array.isArray(response)
      ? response
      : Array.isArray(response?.data)
        ? response.data
        : [];
    const options = raw
      .filter(
        (item: any) =>
          !item?.error && Number(item?.price ?? item?.custom_price ?? 0) > 0,
      )
      .map((item: any) => ({
        serviceId: String(item.id ?? ""),
        serviceName: String(item.name ?? ""),
        carrierName: String(item.company?.name ?? ""),
        priceCents: Math.round(
          Number(item.custom_price ?? item.price ?? 0) * 100,
        ),
        deliveryDays: Number(
          item.custom_delivery_time ?? item.delivery_time ?? 0,
        ),
      }))
      .sort((a: any, b: any) => a.priceCents - b.priceCents);
    return {
      approvedPriceCents: Number(order.customerPriceCents),
      originalProviderPriceCents: Number(order.providerPriceCents),
      quoteExpired: true,
      packages: packagePayload,
      originalPackages,
      customPackages: Boolean(packages?.length),
      options,
    };
  }

  async selectRequoteForSalesOrder(
    orderId: string,
    selection: {
      serviceId: string;
      serviceName: string;
      carrierName: string;
      priceCents: number;
      deliveryDays?: number;
      packages?: Array<{
        weight: number;
        length: number;
        width: number;
        height: number;
      }>;
    },
  ) {
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT so."shippingQuoteId",so.freight,q."customerPriceCents",q."providerPriceCents",q.package
         FROM "SalesOrder" so JOIN "ShippingQuote" q ON q.id=so."shippingQuoteId"
        WHERE so.id=$1 LIMIT 1`,
      orderId,
    );
    const current = rows[0];
    if (!current)
      throw new BadRequestException("Pedido ou cotação não encontrado.");
    if (!selection?.serviceId || !selection?.priceCents)
      throw new BadRequestException("Selecione uma cotação válida.");
    const packages = selection.packages?.length
      ? selection.packages
      : Array.isArray(current.package)
        ? current.package
        : [current.package];
    await this.database.$executeRawUnsafe(
      `UPDATE "ShippingQuote" SET "serviceId"=$2,"serviceName"=$3,"carrierName"=$4,
         "providerPriceCents"=$5,package=$6::jsonb,"deliveryDays"=$7,"updatedAt"=NOW()
       WHERE id=$1`,
      current.shippingQuoteId,
      selection.serviceId,
      selection.serviceName,
      selection.carrierName,
      selection.priceCents,
      JSON.stringify(packages),
      Number(selection.deliveryDays || 0),
    );
    await this.database.$executeRawUnsafe(
      `UPDATE "SalesOrder" SET "shippingServiceId"=$2,"shippingServiceName"=$3,"carrierName"=$4,"updatedAt"=NOW() WHERE id=$1`,
      orderId,
      selection.serviceId,
      selection.serviceName,
      selection.carrierName,
    );
    return {
      selected: true,
      customerFreightCents: Math.round(Number(current.freight || 0) * 100),
      providerPriceCents: selection.priceCents,
      logisticsResultCents:
        Math.round(Number(current.freight || 0) * 100) - selection.priceCents,
      serviceId: selection.serviceId,
      serviceName: selection.serviceName,
      carrierName: selection.carrierName,
    };
  }

  async createLabelForSalesOrder(orderId: string) {
    const orders = await this.database.$queryRawUnsafe<any[]>(
      `SELECT so.*,q.package,q."providerPriceCents",q."customerPriceCents",
              q."serviceId",q."serviceName",q."carrierName",
              sfo.id AS "storefrontOrderId",sfo.delivery AS "storefrontDelivery",
              c.name AS "customerName",c."taxId" AS "customerTaxId",
              c.email AS "customerEmail",c.phone AS "customerPhone",
              c."postalCode" AS "customerPostalCode",c.address AS "customerAddress",
              c."addressNumber" AS "customerAddressNumber",
              c."addressComplement" AS "customerAddressComplement",
              c.district AS "customerDistrict",c.city AS "customerCity",c.state AS "customerState",
              q."destinationPostalCode"
         FROM "SalesOrder" so
         JOIN "ShippingQuote" q ON q.id=so."shippingQuoteId"
         JOIN "Customer" c ON c.id=so."customerId"
         LEFT JOIN "StorefrontOrder" sfo
           ON sfo."companyId"=so."companyId"
          AND sfo.code=COALESCE(so."orderNumber",so.code)
        WHERE so.id=$1 LIMIT 1`,
      orderId,
    );
    const order = orders[0];
    if (!order)
      throw new BadRequestException(
        "Pedido comercial ou cotação de frete não encontrado.",
      );
    if (order.shippingProvider !== "MELHOR_ENVIO")
      throw new BadRequestException(
        "Este pedido comercial não utiliza Melhor Envio.",
      );

    const activeReexpeditions = await this.database.$queryRawUnsafe<any[]>(
      `SELECT id,status,"attemptNumber"
         FROM "SalesOrderReexpedition"
        WHERE "salesOrderId"=$1
          AND status NOT IN ('LABEL_CREATED','CANCELLED')
        ORDER BY "attemptNumber" DESC LIMIT 1`,
      orderId,
    );
    if (activeReexpeditions[0]) {
      throw new BadRequestException(
        "Este pedido possui uma reexpedição automática em andamento. A etiqueta antiga não pode ser reutilizada.",
      );
    }

    const authorized = await this.database.$queryRawUnsafe<any[]>(
      `SELECT id,"accessKey" FROM "FiscalDocument"
        WHERE "salesOrderId"=$1 AND direction='OUTBOUND' AND status='AUTHORIZED'
        ORDER BY "updatedAt" DESC LIMIT 1`,
      orderId,
    );
    if (!authorized[0])
      throw new BadRequestException(
        "A etiqueta só pode ser comprada após a autorização da NF-e.",
      );

    if (order.storefrontOrderId) {
      await this.database.$executeRawUnsafe(
        `UPDATE "StorefrontOrder" SET status='INVOICED',"updatedAt"=NOW()
          WHERE id=$1 AND status IN ('PAID','PREPARING','INVOICED')`,
        order.storefrontOrderId,
      );
      await this.lifecycle.record(
        order.storefrontOrderId,
        "INVOICE_AUTHORIZED",
        "Nota fiscal emitida",
        "A nota fiscal do seu pedido foi autorizada e a expedição será preparada.",
        "BLING",
        `storefront:invoice-authorized:${order.storefrontOrderId}`,
        { salesOrderId: order.id },
      );
    }

    const prior = await this.database.$queryRawUnsafe<any[]>(
      `SELECT * FROM "Shipment"
        WHERE "salesOrderId"=$1 OR "storefrontOrderId"=$2
        ORDER BY "updatedAt" DESC LIMIT 1`,
      orderId,
      order.storefrontOrderId,
    );
    if (prior[0]) {
      await this.database.$executeRawUnsafe(
        `UPDATE "Shipment"
            SET "salesOrderId"=COALESCE("salesOrderId",$2),
                "storefrontOrderId"=COALESCE("storefrontOrderId",$3),
                "updatedAt"=NOW()
          WHERE id=$1`,
        prior[0].id,
        order.id,
        order.storefrontOrderId,
      );
    }
    if (prior[0]?.labelUrl) return { ...prior[0], idempotent: true };

    const items = await this.database.$queryRawUnsafe<any[]>(
      `SELECT soi.id,soi."productName",soi.quantity,soi."unitPrice",pv."netWeightGrams"
         FROM "SalesOrderItem" soi
         JOIN "ProductVariant" pv ON pv.id=soi."productVariantId"
        WHERE soi."salesOrderId"=$1
        ORDER BY soi."createdAt" ASC`,
      orderId,
    );
    if (!items.length)
      throw new BadRequestException(
        "Pedido comercial sem itens para expedição.",
      );

    const shipmentId = prior[0]?.id || randomUUID();
    if (!prior[0]) {
      await this.database.$executeRawUnsafe(
        `INSERT INTO "Shipment"
         (id,"companyId","storefrontOrderId","salesOrderId","shippingQuoteId",provider,status,
           "serviceId","serviceName","carrierName","providerPriceCents","customerPriceCents",
           metadata,"createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,'MELHOR_ENVIO','PENDING',$6,$7,$8,$9,$10,'{}'::jsonb,NOW(),NOW())`,
        shipmentId,
        order.companyId,
        order.storefrontOrderId,
        order.id,
        order.shippingQuoteId,
        order.serviceId,
        order.serviceName,
        order.carrierName,
        order.providerPriceCents,
        order.customerPriceCents,
      );
    }

    const delivery = order.storefrontDelivery || {};
    const recipientAssessment = assessMelhorEnvioRecipient({
      name: delivery.name || order.customerName,
      phone: delivery.phone || order.customerPhone,
      email: delivery.email || order.customerEmail,
      document:
        delivery.cpf || delivery.cnpj || delivery.taxId || order.customerTaxId,
      address: delivery.street || order.customerAddress,
      number: delivery.number || order.customerAddressNumber,
      complement: delivery.complement || order.customerAddressComplement,
      district: delivery.district || order.customerDistrict,
      city: delivery.city || order.customerCity,
      state: delivery.state || order.customerState,
      postalCode: delivery.postalCode || order.customerPostalCode,
      quotedPostalCode: order.destinationPostalCode,
    });
    if (!recipientAssessment.ready) {
      throw new BadRequestException(
        melhorEnvioRecipientError(recipientAssessment.issues),
      );
    }
    const recipient = recipientAssessment.recipient;
    await this.database.$executeRawUnsafe(
      `UPDATE "Shipment"
          SET metadata=COALESCE(metadata,'{}'::jsonb) || $2::jsonb,
              "updatedAt"=NOW()
        WHERE id=$1`,
      shipmentId,
      JSON.stringify({
        recipientPreflight: {
          checkedAt: new Date().toISOString(),
          source: order.storefrontOrderId
            ? "STOREFRONT_ORDER_SNAPSHOT"
            : "CUSTOMER_MASTER",
          recipient,
        },
      }),
    );

    const packagePayload = Array.isArray(order.package)
      ? order.package
      : [order.package];
    let externalId = prior[0]?.externalId || "";
    if (!externalId) {
      const cartResult = await this.request(order.companyId, "/me/cart", {
        method: "POST",
        body: JSON.stringify({
          service: Number(order.serviceId),
          from: this.sender(),
          to: recipient,
          products: items.map((item: any) => ({
            name: item.productName,
            quantity: Number(item.quantity),
            unitary_value: Number(item.unitPrice),
            weight: Math.max(0.001, Number(item.netWeightGrams || 0) / 1000),
          })),
          volumes: packagePayload,
          options: {
            insurance_value: Number(order.subtotal || order.totalAmount || 0),
            receipt: false,
            own_hand: false,
            reverse: false,
            non_commercial: false,
            invoice: {
              key: String(authorized[0].accessKey || "") || undefined,
            },
          },
        }),
      });
      externalId = String(cartResult?.id || "");
      const cartPriceCents = Math.round(
        Number(cartResult?.price || cartResult?.custom_price || 0) * 100,
      );
      if (externalId) {
        await this.database.$executeRawUnsafe(
          `UPDATE "Shipment"
              SET "externalId"=$2,
                  metadata=COALESCE(metadata,'{}'::jsonb) || $3::jsonb,
                  "updatedAt"=NOW()
            WHERE id=$1`,
          shipmentId,
          externalId,
          JSON.stringify({ cartResult, cartPriceCents }),
        );
      }
      if (
        cartPriceCents > 0 &&
        cartPriceCents !== Number(order.providerPriceCents)
      ) {
        await this.database.$executeRawUnsafe(
          `UPDATE "Shipment" SET status='EXCEPTION',"updatedAt"=NOW() WHERE id=$1`,
          shipmentId,
        );
        throw new BadRequestException(
          "O valor da transportadora mudou após a cotação. Pedido enviado para conferência.",
        );
      }
    }

    if (!externalId)
      throw new ServiceUnavailableException(
        "Melhor Envio não retornou o identificador da remessa.",
      );

    await this.database.$executeRawUnsafe(
      `UPDATE "Shipment" SET "externalId"=$2,status='CARTED',"updatedAt"=NOW() WHERE id=$1`,
      shipmentId,
      externalId,
    );
    await this.request(order.companyId, "/me/shipment/checkout", {
      method: "POST",
      body: JSON.stringify({ orders: [externalId] }),
    });
    await this.database.$executeRawUnsafe(
      `UPDATE "Shipment" SET status='PURCHASED',"updatedAt"=NOW() WHERE id=$1`,
      shipmentId,
    );
    if (order.storefrontOrderId) {
      await this.database.$transaction((transaction) =>
        settleMelhorEnvioFreight(transaction, {
          id: order.storefrontOrderId,
          companyId: order.companyId,
          code: order.orderNumber || order.code,
          shippingProvider: order.shippingProvider,
          shippingCents: Number(order.customerPriceCents ?? order.freight ?? 0),
          providerPriceCents: Number(order.providerPriceCents ?? 0),
          paidAt: order.paidAt,
          shipmentId,
          externalId,
        }),
      );
    }
    await this.request(order.companyId, "/me/shipment/generate", {
      method: "POST",
      body: JSON.stringify({ orders: [externalId] }),
    });
    const labelUrl = await this.printWhenReady(order.companyId, externalId);
    const details = await this.request(
      order.companyId,
      `/me/orders/${encodeURIComponent(externalId)}`,
      { method: "GET" },
    ).catch(() => ({}));
    const trackingCode =
      String(details?.tracking || details?.tracking_code || "") || null;
    const trackingUrl =
      String(details?.tracking_url || details?.tracking?.url || "") || null;

    await this.database.$executeRawUnsafe(
      `UPDATE "Shipment"
          SET status='LABEL_READY',"labelUrl"=$2,"trackingCode"=$3,"trackingUrl"=$4,
              metadata=COALESCE(metadata,'{}'::jsonb) || $5::jsonb,"updatedAt"=NOW()
        WHERE id=$1`,
      shipmentId,
      labelUrl || null,
      trackingCode,
      trackingUrl,
      JSON.stringify(details || {}),
    );

    if (order.storefrontOrderId) {
      await this.lifecycle.record(
        order.storefrontOrderId,
        "SHIPMENT_CREATED",
        "Envio preparado",
        "A etiqueta de transporte foi emitida e o pedido está pronto para postagem.",
        "MELHOR_ENVIO",
        `storefront:shipment-created:${order.storefrontOrderId}`,
        { shipmentId, externalId, trackingCode, trackingUrl },
      );
    }

    await this.customerLifecycle.record(
      order.id,
      "SHIPMENT_CREATED",
      "Envio preparado",
      "A etiqueta de transporte foi emitida e o pedido está pronto para postagem.",
      "MELHOR_ENVIO",
      `sales-order:shipment-created:${order.id}`,
      { shipmentId, externalId, trackingCode, trackingUrl },
    );

    return {
      id: shipmentId,
      externalId,
      status: "LABEL_READY",
      labelUrl,
      trackingCode,
      trackingUrl,
    };
  }

  async createReexpeditionLabel(
    reexpeditionId: string,
    fiscalAccessKey: string,
  ) {
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT re.*,so.code,so."orderNumber",so."shippingQuoteId",so."shippingProvider",
              so.subtotal,so."totalAmount",q.package,q."providerPriceCents",
              q."serviceId",q."serviceName",q."carrierName",
              sfo.id AS "storefrontOrderId"
         FROM "SalesOrderReexpedition" re
         JOIN "SalesOrder" so ON so.id=re."salesOrderId"
         JOIN "ShippingQuote" q ON q.id=so."shippingQuoteId"
         LEFT JOIN "StorefrontOrder" sfo
           ON sfo."companyId"=so."companyId"
          AND sfo.code=COALESCE(so."orderNumber",so.code)
        WHERE re.id=$1 LIMIT 1`,
      reexpeditionId,
    );
    const reexpedition = rows[0];
    if (!reexpedition)
      throw new BadRequestException("Reexpedição não encontrada.");
    if (reexpedition.shippingProvider !== "MELHOR_ENVIO")
      throw new BadRequestException(
        "A reexpedição automática exige um pedido do Melhor Envio.",
      );
    if (!/^\d{44}$/.test(String(fiscalAccessKey ?? "").replace(/\D/g, "")))
      throw new BadRequestException(
        "A nova etiqueta exige a chave da NF-e de reexpedição autorizada.",
      );

    if (reexpedition.replacementShipmentId) {
      const existing = await this.database.$queryRawUnsafe<any[]>(
        `SELECT * FROM "Shipment" WHERE id=$1 LIMIT 1`,
        reexpedition.replacementShipmentId,
      );
      if (existing[0]?.labelUrl)
        return { ...existing[0], idempotent: true };
    }

    const items = await this.database.$queryRawUnsafe<any[]>(
      `SELECT soi."productName",soi.quantity,soi."unitPrice",pv."netWeightGrams"
         FROM "SalesOrderItem" soi
         JOIN "ProductVariant" pv ON pv.id=soi."productVariantId"
        WHERE soi."salesOrderId"=$1 ORDER BY soi."createdAt" ASC`,
      reexpedition.salesOrderId,
    );
    if (!items.length)
      throw new BadRequestException("Pedido sem itens para reexpedição.");

    const shipmentId = reexpedition.replacementShipmentId || randomUUID();
    if (!reexpedition.replacementShipmentId) {
      await this.database.$transaction(async (transaction) => {
        await transaction.$executeRawUnsafe(
          `INSERT INTO "Shipment"
           (id,"companyId","storefrontOrderId","salesOrderId","shippingQuoteId",provider,status,
             "serviceId","serviceName","carrierName","providerPriceCents","customerPriceCents",
             metadata,"createdAt","updatedAt")
           VALUES ($1,$2,$3,$4,$5,'MELHOR_ENVIO','PENDING',$6,$7,$8,$9,0,$10::jsonb,NOW(),NOW())`,
          shipmentId,
          reexpedition.companyId,
          reexpedition.storefrontOrderId,
          reexpedition.salesOrderId,
          reexpedition.shippingQuoteId,
          reexpedition.serviceId,
          reexpedition.serviceName,
          reexpedition.carrierName,
          reexpedition.providerPriceCents,
          JSON.stringify({
            reexpeditionId,
            attemptNumber: reexpedition.attemptNumber,
            recipientPreflight: {
              checkedAt: new Date().toISOString(),
              source: "REEXPEDITION_ADDRESS_SNAPSHOT",
              recipient: reexpedition.addressSnapshot,
            },
          }),
        );
        await transaction.$executeRawUnsafe(
          `UPDATE "SalesOrderReexpedition"
              SET "replacementShipmentId"=$2,status='LABEL_PENDING',"lastError"=NULL,"updatedAt"=NOW()
            WHERE id=$1`,
          reexpeditionId,
          shipmentId,
        );
      });
    }

    const packagePayload = Array.isArray(reexpedition.package)
      ? reexpedition.package
      : [reexpedition.package];
    const prior = await this.database.$queryRawUnsafe<any[]>(
      `SELECT * FROM "Shipment" WHERE id=$1 LIMIT 1`,
      shipmentId,
    );
    let externalId = String(prior[0]?.externalId ?? "");
    let providerPriceCents = Number(
      prior[0]?.providerPriceCents ?? reexpedition.providerPriceCents ?? 0,
    );
    if (!externalId) {
      const cartResult = await this.request(
        reexpedition.companyId,
        "/me/cart",
        {
          method: "POST",
          body: JSON.stringify({
            service: Number(reexpedition.serviceId),
            from: this.sender(),
            to: reexpedition.addressSnapshot,
            products: items.map((item: any) => ({
              name: item.productName,
              quantity: Number(item.quantity),
              unitary_value: Number(item.unitPrice),
              weight: Math.max(
                0.001,
                Number(item.netWeightGrams || 0) / 1000,
              ),
            })),
            volumes: packagePayload,
            options: {
              insurance_value: Number(
                reexpedition.subtotal || reexpedition.totalAmount || 0,
              ),
              receipt: false,
              own_hand: false,
              reverse: false,
              non_commercial: false,
              invoice: { key: String(fiscalAccessKey).replace(/\D/g, "") },
            },
          }),
        },
      );
      externalId = String(cartResult?.id ?? "");
      providerPriceCents = Math.round(
        Number(cartResult?.price ?? cartResult?.custom_price ?? 0) * 100,
      );
      if (!externalId)
        throw new ServiceUnavailableException(
          "Melhor Envio não retornou o identificador da nova remessa.",
        );
      await this.database.$executeRawUnsafe(
        `UPDATE "Shipment"
            SET "externalId"=$2,status='CARTED',"providerPriceCents"=$3,
                metadata=COALESCE(metadata,'{}'::jsonb) || $4::jsonb,"updatedAt"=NOW()
          WHERE id=$1`,
        shipmentId,
        externalId,
        providerPriceCents,
        JSON.stringify({ cartResult, fiscalAccessKey }),
      );
    }

    await this.request(reexpedition.companyId, "/me/shipment/checkout", {
      method: "POST",
      body: JSON.stringify({ orders: [externalId] }),
    });
    await this.database.$executeRawUnsafe(
      `UPDATE "Shipment" SET status='PURCHASED',"updatedAt"=NOW() WHERE id=$1`,
      shipmentId,
    );
    await this.database.$transaction((transaction) =>
      settleMelhorEnvioFreight(transaction, {
        id: reexpeditionId,
        companyId: reexpedition.companyId,
        code: `${reexpedition.orderNumber || reexpedition.code} · reexpedição ${reexpedition.attemptNumber}`,
        shippingProvider: "MELHOR_ENVIO",
        shippingCents: 0,
        providerPriceCents,
        paidAt: new Date(),
        shipmentId,
        externalId,
      }),
    );
    await this.request(reexpedition.companyId, "/me/shipment/generate", {
      method: "POST",
      body: JSON.stringify({ orders: [externalId] }),
    });
    const labelUrl = await this.printWhenReady(
      reexpedition.companyId,
      externalId,
    );
    const details = await this.request(
      reexpedition.companyId,
      `/me/orders/${encodeURIComponent(externalId)}`,
      { method: "GET" },
    ).catch(() => ({}));
    const trackingCode =
      String(details?.tracking ?? details?.tracking_code ?? "") || null;
    const trackingUrl =
      String(details?.tracking_url ?? details?.tracking?.url ?? "") || null;

    await this.database.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(
        `UPDATE "Shipment"
            SET status='LABEL_READY',"labelUrl"=$2,"trackingCode"=$3,"trackingUrl"=$4,
                metadata=COALESCE(metadata,'{}'::jsonb) || $5::jsonb,"updatedAt"=NOW()
          WHERE id=$1`,
        shipmentId,
        labelUrl || null,
        trackingCode,
        trackingUrl,
        JSON.stringify(details || {}),
      );
      await transaction.$executeRawUnsafe(
        `UPDATE "SalesOrderReexpedition"
            SET status='LABEL_CREATED',"lastError"=NULL,"completedAt"=NOW(),"updatedAt"=NOW()
          WHERE id=$1`,
        reexpeditionId,
      );
    });

    if (reexpedition.storefrontOrderId) {
      await this.lifecycle.record(
        reexpedition.storefrontOrderId,
        "SHIPMENT_CREATED",
        "Reenvio preparado",
        "A nova etiqueta foi emitida e o pacote está pronto para postagem.",
        "MELHOR_ENVIO",
        `storefront:reexpedition-shipment:${reexpeditionId}`,
        { reexpeditionId, shipmentId, externalId, trackingCode, trackingUrl },
      );
    }
    await this.customerLifecycle.record(
      reexpedition.salesOrderId,
      "REEXPEDITION_LABEL_CREATED",
      "Reenvio preparado",
      "A nova etiqueta foi emitida e o pacote está pronto para postagem.",
      "MELHOR_ENVIO",
      `sales-order:reexpedition-shipment:${reexpeditionId}`,
      { reexpeditionId, shipmentId, externalId, trackingCode, trackingUrl },
    );
    return {
      id: shipmentId,
      externalId,
      status: "LABEL_READY",
      labelUrl,
      trackingCode,
      trackingUrl,
      reexpeditionId,
    };
  }

  async prepareReexpeditionForSalesOrder(
    orderId: string,
    actor: { id: string; companyId: string; name: string },
    input: { returnConfirmed?: boolean; reason?: string },
  ) {
    if (input.returnConfirmed !== true) {
      throw new BadRequestException(
        "Confirme que o pacote retornou fisicamente à Bispo antes de preparar a reexpedição.",
      );
    }

    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT so.id,so."companyId",COALESCE(so."orderNumber",so.code) AS code,
              so."shippingProvider",q."destinationPostalCode",
              sfo.id AS "storefrontOrderId",sfo.delivery AS "storefrontDelivery",
              c.name AS "customerName",c."taxId" AS "customerTaxId",
              c.email AS "customerEmail",c.phone AS "customerPhone",
              c."postalCode" AS "customerPostalCode",c.address AS "customerAddress",
              c."addressNumber" AS "customerAddressNumber",
              c."addressComplement" AS "customerAddressComplement",
              c.district AS "customerDistrict",c.city AS "customerCity",c.state AS "customerState",
              sh.id AS "shipmentId",sh.status AS "shipmentStatus",sh."externalId",
              sh."serviceId",sh."serviceName",sh."carrierName",sh."labelUrl",
              sh."trackingCode",sh."trackingUrl",sh.metadata AS "shipmentMetadata",
              sh."postedAt",sh."deliveredAt",sh."createdAt" AS "shipmentCreatedAt",
              EXISTS (
                SELECT 1 FROM "SalesOrderCustomerEvent" issue
                 WHERE issue."salesOrderId"=so.id
                   AND issue.source IN ('MELHOR_ENVIO','CARRIER')
                   AND issue."eventType" IN ('UNDELIVERED','RETURNED','PAUSED','SUSPENDED')
                   AND NOT EXISTS (
                     SELECT 1 FROM "SalesOrderCustomerEvent" resolved
                      WHERE resolved."salesOrderId"=so.id
                        AND resolved.source IN ('MELHOR_ENVIO','CARRIER')
                        AND resolved."eventType"='DELIVERED'
                        AND resolved."occurredAt">issue."occurredAt"
                   )
              ) AS "hasUnresolvedDeliveryException",
              f.id AS "originalFiscalDocumentId",f.number AS "originalFiscalNumber",
              f."accessKey" AS "originalFiscalAccessKey"
         FROM "SalesOrder" so
         JOIN "Customer" c ON c.id=so."customerId"
         LEFT JOIN "ShippingQuote" q ON q.id=so."shippingQuoteId"
         LEFT JOIN "StorefrontOrder" sfo
           ON sfo."companyId"=so."companyId"
          AND sfo.code=COALESCE(so."orderNumber",so.code)
         LEFT JOIN LATERAL (
           SELECT * FROM "Shipment"
            WHERE "salesOrderId"=so.id OR "storefrontOrderId"=sfo.id
            ORDER BY "updatedAt" DESC LIMIT 1
         ) sh ON TRUE
         LEFT JOIN LATERAL (
           SELECT id,number,"accessKey" FROM "FiscalDocument"
            WHERE "salesOrderId"=so.id AND direction='OUTBOUND' AND status='AUTHORIZED'
            ORDER BY "createdAt" DESC LIMIT 1
         ) f ON TRUE
        WHERE so.id=$1 AND so."companyId"=$2 LIMIT 1`,
      orderId,
      actor.companyId,
    );
    const order = rows[0];
    if (!order) throw new BadRequestException("Pedido não encontrado.");
    if (order.shippingProvider !== "MELHOR_ENVIO") {
      throw new BadRequestException(
        "A reexpedição assistida está disponível apenas para envios do Melhor Envio.",
      );
    }
    if (!order.shipmentId || !order.externalId) {
      throw new BadRequestException(
        "A remessa original não foi encontrada para preparar o reenvio.",
      );
    }
    const providerStatus = normalizeMelhorEnvioTrackingStatus(
      order.shipmentMetadata?.tracking_snapshot?.status ??
        order.shipmentMetadata?.status ??
        "",
    );
    if (
      order.shipmentStatus !== "EXCEPTION" &&
      !order.hasUnresolvedDeliveryException &&
      !["undelivered", "returned"].includes(providerStatus)
    ) {
      throw new BadRequestException(
        "O reenvio só pode ser preparado após uma falha de entrega ou devolução registrada.",
      );
    }

    const delivery = order.storefrontDelivery || {};
    const assessment = assessMelhorEnvioRecipient({
      // Na reexpedição, o cadastro mestre corrigido prevalece sobre o retrato
      // histórico do checkout que produziu a etiqueta devolvida.
      name: order.customerName || delivery.name,
      phone: order.customerPhone || delivery.phone,
      email: order.customerEmail || delivery.email,
      document:
        order.customerTaxId || delivery.cpf || delivery.cnpj || delivery.taxId,
      address: order.customerAddress || delivery.street,
      number: order.customerAddressNumber || delivery.number,
      complement: order.customerAddressComplement || delivery.complement,
      district: order.customerDistrict || delivery.district,
      city: order.customerCity || delivery.city,
      state: order.customerState || delivery.state,
      postalCode: order.customerPostalCode || delivery.postalCode,
      quotedPostalCode: order.destinationPostalCode,
    });
    if (!assessment.ready) {
      throw new BadRequestException(
        melhorEnvioRecipientError(assessment.issues),
      );
    }

    const reason =
      String(input.reason ?? "").trim() ||
      "Pacote devolvido pela transportadora após falha na entrega.";
    const shipmentSnapshot = {
      shipmentId: order.shipmentId,
      status: order.shipmentStatus,
      externalId: order.externalId,
      serviceId: order.serviceId,
      serviceName: order.serviceName,
      carrierName: order.carrierName,
      labelUrl: order.labelUrl,
      trackingCode: order.trackingCode,
      trackingUrl: order.trackingUrl,
      postedAt: order.postedAt,
      deliveredAt: order.deliveredAt,
      createdAt: order.shipmentCreatedAt,
      providerStatus,
      originalFiscalNumber: order.originalFiscalNumber,
      originalFiscalAccessKey: order.originalFiscalAccessKey,
    };

    const prepared = await this.database.$transaction(async (transaction) => {
      const existing = await transaction.$queryRawUnsafe<any[]>(
        `SELECT * FROM "SalesOrderReexpedition"
          WHERE "salesOrderId"=$1
            AND status NOT IN ('LABEL_CREATED','CANCELLED')
          ORDER BY "attemptNumber" DESC LIMIT 1`,
        order.id,
      );
      if (existing[0]) return { ...existing[0], idempotent: true };

      const attempts = await transaction.$queryRawUnsafe<any[]>(
        `SELECT COALESCE(MAX("attemptNumber"),0)::int+1 AS next
           FROM "SalesOrderReexpedition" WHERE "salesOrderId"=$1`,
        order.id,
      );
      const attemptNumber = Number(attempts[0]?.next ?? 1);
      const reexpeditionId = randomUUID();
      const inserted = await transaction.$queryRawUnsafe<any[]>(
        `INSERT INTO "SalesOrderReexpedition"
          (id,"companyId","salesOrderId","originalShipmentId","attemptNumber",status,reason,
           "addressSnapshot","shipmentSnapshot","originalFiscalDocumentId",
           "preparedByUserId","preparedByName","preparedAt","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,'QUEUED',$6,$7::jsonb,$8::jsonb,$9,$10,$11,NOW(),NOW(),NOW())
         RETURNING *`,
        reexpeditionId,
        order.companyId,
        order.id,
        order.shipmentId,
        attemptNumber,
        reason,
        JSON.stringify(assessment.recipient),
        JSON.stringify(shipmentSnapshot),
        order.originalFiscalDocumentId || null,
        actor.id,
        actor.name,
      );
      await transaction.$executeRawUnsafe(
        `UPDATE "Shipment"
            SET metadata=COALESCE(metadata,'{}'::jsonb) || $2::jsonb,
                "updatedAt"=NOW()
          WHERE id=$1`,
        order.shipmentId,
        JSON.stringify({
          reexpedition: {
            id: reexpeditionId,
            attemptNumber,
            status: "QUEUED",
            preparedAt: new Date().toISOString(),
            preparedBy: actor.name,
            addressSnapshot: assessment.recipient,
          },
        }),
      );
      await transaction.$executeRawUnsafe(
        `INSERT INTO "IntegrationOutbox"
          (id,"companyId",provider,"eventType","aggregateType","aggregateId",payload,status,attempts,
           "idempotencyKey","createdAt","updatedAt")
         VALUES ($1,$2,'BLING','SALES_ORDER_REEXPEDITION_REQUESTED','SALES_ORDER_REEXPEDITION',$3,
                 $4::jsonb,'PENDING',0,$5,NOW(),NOW())
         ON CONFLICT ("idempotencyKey") DO UPDATE SET
           status=CASE WHEN "IntegrationOutbox".status IN ('FAILED','CANCELLED') THEN 'PENDING' ELSE "IntegrationOutbox".status END,
           "lastError"=CASE WHEN "IntegrationOutbox".status IN ('FAILED','CANCELLED') THEN NULL ELSE "IntegrationOutbox"."lastError" END,
           "nextAttemptAt"=CASE WHEN "IntegrationOutbox".status IN ('FAILED','CANCELLED') THEN NULL ELSE "IntegrationOutbox"."nextAttemptAt" END,
           "updatedAt"=NOW()`,
        randomUUID(),
        order.companyId,
        reexpeditionId,
        JSON.stringify({
          reexpeditionId,
          salesOrderId: order.id,
          attemptNumber,
        }),
        `bling:sales-order-reexpedition:${reexpeditionId}`,
      );
      return { ...inserted[0], idempotent: false };
    });

    // Um segundo clique após corrigir a configuração fiscal reativa a mesma
    // tentativa, sem criar documentos ou remessas duplicados.
    await this.database.$transaction((transaction) =>
      transaction.$executeRawUnsafe(
        `INSERT INTO "IntegrationOutbox"
        (id,"companyId",provider,"eventType","aggregateType","aggregateId",payload,status,attempts,
         "idempotencyKey","createdAt","updatedAt")
       VALUES ($1,$2,'BLING','SALES_ORDER_REEXPEDITION_REQUESTED','SALES_ORDER_REEXPEDITION',$3,
               $4::jsonb,'PENDING',0,$5,NOW(),NOW())
       ON CONFLICT ("idempotencyKey") DO UPDATE SET
         status=CASE WHEN "IntegrationOutbox".status IN ('FAILED','CANCELLED') THEN 'PENDING' ELSE "IntegrationOutbox".status END,
         attempts=CASE WHEN "IntegrationOutbox".status IN ('FAILED','CANCELLED') THEN 0 ELSE "IntegrationOutbox".attempts END,
         "lastError"=CASE WHEN "IntegrationOutbox".status IN ('FAILED','CANCELLED') THEN NULL ELSE "IntegrationOutbox"."lastError" END,
         "nextAttemptAt"=CASE WHEN "IntegrationOutbox".status IN ('FAILED','CANCELLED') THEN NULL ELSE "IntegrationOutbox"."nextAttemptAt" END,
         "updatedAt"=NOW()`,
        randomUUID(),
        order.companyId,
        prepared.id,
        JSON.stringify({
          reexpeditionId: prepared.id,
          salesOrderId: order.id,
          attemptNumber: prepared.attemptNumber,
        }),
        `bling:sales-order-reexpedition:${prepared.id}`,
      ),
    );

    if (order.storefrontOrderId) {
      await this.lifecycle.record(
        order.storefrontOrderId,
        "EXCEPTION",
        "Reexpedição em preparação",
        "A devolução foi confirmada. A Bispo está preparando uma nova expedição com conferência fiscal e de endereço.",
        "ADMIN",
        `storefront:reexpedition-prepared:${prepared.id}`,
        { reexpeditionId: prepared.id, attemptNumber: prepared.attemptNumber },
        false,
      );
    }
    await this.customerLifecycle.record(
      order.id,
      "REEXPEDITION_PREPARED",
      "Reexpedição automática iniciada",
      "A devolução foi confirmada. O BBOS cuidará dos documentos fiscais, da nova etiqueta e do rastreio.",
      "ADMIN",
      `sales-order:reexpedition-prepared:${prepared.id}`,
      { reexpeditionId: prepared.id, attemptNumber: prepared.attemptNumber },
      false,
    );

    return {
      id: prepared.id,
      status: prepared.status,
      attemptNumber: prepared.attemptNumber,
      preparedAt: prepared.preparedAt,
      preparedByName: prepared.preparedByName,
      addressSnapshot: prepared.addressSnapshot,
      idempotent: prepared.idempotent,
      nextAction:
        "Acompanhar o processamento automático do novo documento fiscal de entrada, da nova saída e da etiqueta. O BBOS só pedirá atenção se Bling, SEFAZ ou Melhor Envio rejeitarem alguma etapa.",
    };
  }

  async applyTrackingUpdate(
    externalId: string,
    statusValue: string,
    payload: unknown,
  ) {
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT sh.*,
              COALESCE(so."orderNumber",so.code) AS "salesOrderNumber",
              customer.name AS "customerName"
         FROM "Shipment" sh
         LEFT JOIN "SalesOrder" so ON so.id=sh."salesOrderId"
         LEFT JOIN "Customer" customer ON customer.id=so."customerId"
        WHERE sh.provider='MELHOR_ENVIO' AND sh."externalId"=$1
        LIMIT 1`,
      externalId,
    );
    const shipment = rows[0];
    if (!shipment) return { ignored: true };
    const normalized = normalizeMelhorEnvioTrackingStatus(statusValue);
    const mapping =
      normalized.includes("out_for_delivery") || normalized.includes("saiu")
        ? {
            status: "OUT_FOR_DELIVERY",
            order: "SHIPPED",
            event: "OUT_FOR_DELIVERY",
            title: "Saiu para entrega",
            detail:
              "A transportadora informou que o pedido saiu para entrega no endereço indicado.",
          }
        : normalized === "delivered" || normalized === "entregue"
          ? {
              status: "DELIVERED",
              order: "DELIVERED",
              event: "DELIVERED",
              title: "Pedido entregue",
              detail: "A transportadora confirmou a entrega do pedido.",
            }
          : normalized === "received" || normalized.includes("recebid")
            ? {
                status: "IN_TRANSIT",
                order: "SHIPPED",
                event: "RECEIVED",
                title: "Recebido no ponto de distribuição",
                detail:
                  "O volume foi recebido pelo ponto de distribuição ou postagem.",
              }
            : normalized === "posted" ||
                normalized.includes("postad") ||
                normalized.includes("transit") ||
                normalized.includes("movimenta")
              ? {
                  status: "IN_TRANSIT",
                  order: "SHIPPED",
                  event: "SHIPPED",
                  title: "Pedido a caminho",
                  detail: "O pedido foi postado e está em transporte.",
                }
              : normalized === "generated"
                ? {
                    status: "LABEL_READY",
                    order: null,
                    event: "LABEL_GENERATED",
                    title: "Etiqueta gerada",
                    detail:
                      "A etiqueta de transporte foi gerada e está pronta para uso.",
                  }
                : normalized === "released"
                  ? {
                      status: "PURCHASED",
                      order: null,
                      event: "LABEL_RELEASED",
                      title: "Etiqueta liberada",
                      detail:
                        "O Melhor Envio confirmou o pagamento e liberou a etiqueta.",
                    }
                  : normalized === "created"
                    ? {
                        status: "PENDING",
                        order: null,
                        event: "LABEL_CREATED",
                        title: "Etiqueta criada",
                        detail:
                          "A solicitação da etiqueta foi criada no Melhor Envio.",
                      }
                    : normalized === "pending"
                      ? {
                          status: "PENDING",
                          order: null,
                          event: "LABEL_PENDING",
                          title: "Etiqueta em preparação",
                          detail:
                            "A etiqueta está em preparação no Melhor Envio.",
                        }
                      : normalized === "undelivered"
                        ? {
                            status: "EXCEPTION",
                            order: null,
                            event: "UNDELIVERED",
                            title: "Entrega não realizada",
                            detail:
                              "A transportadora informou que não foi possível concluir a entrega.",
                          }
                        : normalized === "returned"
                          ? {
                              status: "EXCEPTION",
                              order: null,
                              event: "RETURNED",
                              title: "Pedido em devolução",
                              detail:
                                "A transportadora informou que o pedido será devolvido ao remetente.",
                            }
                          : normalized === "paused"
                            ? {
                                status: "EXCEPTION",
                                order: null,
                                event: "PAUSED",
                                title: "Entrega interrompida",
                                detail:
                                  "A entrega foi interrompida e pode exigir uma ação do destinatário.",
                              }
                            : normalized === "suspended"
                              ? {
                                  status: "EXCEPTION",
                                  order: null,
                                  event: "SUSPENDED",
                                  title: "Envio suspenso",
                                  detail:
                                    "O Melhor Envio informou que o envio foi suspenso.",
                                }
                              : normalized === "cancelled" ||
                                  normalized === "canceled"
                                ? {
                                    status: "CANCELLED",
                                    order: null,
                                    event: "SHIPMENT_CANCELLED",
                                    title: "Etiqueta cancelada",
                                    detail:
                                      "A etiqueta de transporte foi cancelada.",
                                  }
                                : null;
    if (!mapping) return { ignored: true };
    const providerReason =
      mapping.status === "EXCEPTION" ? trackingIssueReason(payload) : null;
    const effectiveDetail =
      providerReason && !mapping.detail.includes(providerReason)
        ? `${mapping.detail} Motivo informado: ${providerReason}`
        : mapping.detail;
    const statusRank: Record<string, number> = {
      PENDING: 0,
      PURCHASED: 1,
      LABEL_READY: 2,
      IN_TRANSIT: 3,
      OUT_FOR_DELIVERY: 4,
      DELIVERED: 5,
      CANCELLED: 99,
    };
    const shouldAdvanceStatus =
      mapping.status === "EXCEPTION" ||
      mapping.status === "CANCELLED" ||
      (statusRank[mapping.status] ?? 0) >=
        (statusRank[String(shipment.status)] ?? 0);
    const nextStatus = shouldAdvanceStatus
      ? mapping.status
      : String(shipment.status);
    await this.database.$executeRawUnsafe(
      `UPDATE "Shipment" SET status=$2,metadata=COALESCE(metadata,'{}'::jsonb) || $3::jsonb,
         "postedAt"=CASE WHEN $2 IN ('IN_TRANSIT','OUT_FOR_DELIVERY','DELIVERED') THEN COALESCE("postedAt",NOW()) ELSE "postedAt" END,
         "deliveredAt"=CASE WHEN $2='DELIVERED' THEN COALESCE("deliveredAt",NOW()) ELSE "deliveredAt" END,"updatedAt"=NOW() WHERE id=$1`,
      shipment.id,
      nextStatus,
      JSON.stringify(payload || {}),
    );
    if (shipment.storefrontOrderId) {
      if (mapping.order) {
        await this.database.$executeRawUnsafe(
          `UPDATE "StorefrontOrder" SET status=$2,"updatedAt"=NOW() WHERE id=$1`,
          shipment.storefrontOrderId,
          mapping.order,
        );
      }
      await this.lifecycle.record(
        shipment.storefrontOrderId,
        mapping.event,
        mapping.title,
        effectiveDetail,
        "CARRIER",
        `storefront:${mapping.event.toLowerCase()}:${shipment.storefrontOrderId}`,
        { externalId, status: statusValue },
      );
    }
    if (shipment.salesOrderId) {
      if (mapping.order) {
        await this.database
          .$executeRawUnsafe(
            `UPDATE "SalesOrder"
              SET status=$2::"SalesOrderStatus",
                  "updatedAt"=NOW()
            WHERE id=$1
              AND (
                (status='INVOICED' AND $2::"SalesOrderStatus"='SHIPPED')
                OR (status='SHIPPED' AND $2::"SalesOrderStatus"='DELIVERED')
              )`,
            shipment.salesOrderId,
            mapping.order,
          )
          .catch((error) => {
            // O banco pode bloquear SHIPPED enquanto não houver baixa física.
            // A remessa/rastreio continua sendo atualizada; o status comercial só
            // avança quando as regras de estoque estiverem satisfeitas.
            console.warn(
              "Status comercial preservado durante sincronização de rastreio",
              {
                salesOrderId: shipment.salesOrderId,
                targetStatus: mapping.order,
                error: error instanceof Error ? error.message : String(error),
              },
            );
            return 0;
          });
      }
      await this.customerLifecycle.record(
        shipment.salesOrderId,
        mapping.event,
        mapping.title,
        effectiveDetail,
        "CARRIER",
        `sales-order:${mapping.event.toLowerCase()}:${shipment.salesOrderId}`,
        { externalId, status: statusValue },
      );
    }
    if (
      mapping.status === "EXCEPTION" &&
      String(shipment.status) !== "EXCEPTION"
    ) {
      await this.notifyDeliveryException(
        shipment,
        mapping.title,
        effectiveDetail,
      );
    }
    return {
      updated: true,
      status: mapping.status,
      salesOrderId: shipment.salesOrderId ?? null,
      storefrontOrderId: shipment.storefrontOrderId ?? null,
    };
  }
}
