import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaClient } from "@bbos/database";
import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { Public } from "./auth.guard";
import { MercadoPagoService } from "./mercado-pago.service";
import { verifyShippingQuote } from "./storefront-shipping.controller";
import { StorefrontEmailService } from "./storefront-email.service";
import { MelhorEnvioService } from "./melhor-envio.service";
import { StorefrontInventoryService } from "./storefront-inventory.service";

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
};
const grinds = new Set(["Grãos", "Espresso", "Coado", "Prensa francesa"]);
const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");
const tokenHash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

function validTrackingToken(value: string, orderId: string) {
  const secret = process.env.STOREFRONT_TRACKING_SECRET?.trim();
  const [payload, supplied] = String(value || "").split(".");
  if (!secret || !payload || !supplied) return false;
  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString());
    return parsed.orderId === orderId && Number(parsed.expiresAt) > Date.now();
  } catch {
    return false;
  }
}

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

function secureEqual(value: string, expected: string) {
  const a = Buffer.from(value);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function findString(
  value: unknown,
  predicate: (candidate: string) => boolean,
  depth = 0,
): string | undefined {
  if (depth > 8 || value == null) return undefined;
  if (typeof value === "string") return predicate(value) ? value : undefined;
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = findString(child, predicate, depth + 1);
      if (found) return found;
    }
  } else if (typeof value === "object") {
    for (const child of Object.values(value as Record<string, unknown>)) {
      const found = findString(child, predicate, depth + 1);
      if (found) return found;
    }
  }
  return undefined;
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
  recurrence?: { mode?: string; rhythmDays?: number };
};

@Controller("storefront/orders")
export class StorefrontOrdersController {
  private readonly database = new PrismaClient();

  constructor(
    private readonly mercadoPago: MercadoPagoService,
    private readonly email: StorefrontEmailService,
    private readonly melhorEnvio: MelhorEnvioService,
    private readonly storefrontInventory: StorefrontInventoryService,
  ) {}

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
      if (order.status === "PAID")
        return {
          id: order.id,
          code: order.code,
          status: "PAID",
          idempotent: true,
        };
      await transaction.$executeRawUnsafe(
        `UPDATE "StorefrontOrder" SET status='PAID',"paymentProvider"=$3,"paymentExternalId"=$2,"paidAt"=NOW(),"updatedAt"=NOW() WHERE id=$1`,
        order.id,
        externalId,
        provider,
      );
      await transaction.$executeRawUnsafe(
        `INSERT INTO "IntegrationOutbox"
          (id,"companyId",provider,"eventType","aggregateType","aggregateId",payload,status,attempts,"idempotencyKey","createdAt","updatedAt")
         VALUES ($1,$2,'BLING','STOREFRONT_ORDER_PAID','SALES_ORDER',$3,$4::jsonb,'PENDING',0,$5,NOW(),NOW())
         ON CONFLICT ("idempotencyKey") DO NOTHING`,
        randomUUID(),
        order.companyId,
        order.id,
        JSON.stringify({ storefrontOrderId: order.id, code: order.code }),
        `bling:storefront-paid:${order.id}`,
      );
      const shipping = order.delivery?.shipping;
      if (shipping?.providerServiceId)
        await transaction.$executeRawUnsafe(
          `INSERT INTO "StorefrontShipment"
            (id,"orderId",provider,status,"providerServiceId","createdAt","updatedAt")
           VALUES ($1,$2,'MELHOR_ENVIO','WAITING_INVOICE',$3,NOW(),NOW())
           ON CONFLICT ("orderId") DO NOTHING`,
          randomUUID(),
          order.id,
          Number(shipping.providerServiceId),
        );
      return { id: order.id, code: order.code, status: "PAID" };
    });
    await this.email.sendPaidOrder(orderId).catch((error) =>
      console.error("Falha ao enviar confirmação da loja", {
        orderId,
        message: error instanceof Error ? error.message : "erro desconhecido",
      }),
    );
    await this.storefrontInventory.ensureReserved(orderId).catch((error) =>
      console.error("Pedido pago aguardando regularização de estoque", {
        orderId,
        message: error instanceof Error ? error.message : "erro desconhecido",
      }),
    );
    return result;
  }

  @Post(":orderId/shipment/issue")
  async issueShipment(
    @Param("orderId") orderId: string,
    @Body() body: { invoiceKey?: string },
  ) {
    const invoiceKey = digits(body.invoiceKey);
    if (invoiceKey.length !== 44)
      throw new BadRequestException("Informe a chave de 44 dígitos da NF-e.");
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT o.*,s.id AS "shipmentId",s.status AS "shipmentStatus",
              s."providerServiceId",s."providerShipmentId",s."labelUrl"
         FROM "StorefrontOrder" o
         JOIN "StorefrontShipment" s ON s."orderId"=o.id
        WHERE o.id=$1 LIMIT 1`,
      orderId,
    );
    const order = rows[0];
    if (!order) throw new BadRequestException("Remessa não encontrada.");
    if (order.status !== "PAID")
      throw new BadRequestException("O pagamento ainda não foi confirmado.");
    if (order.shipmentStatus === "LABEL_READY")
      return {
        status: order.shipmentStatus,
        labelUrl: order.labelUrl,
        idempotent: true,
      };

    const customer = order.customer as CheckoutBody["customer"];
    const delivery = order.delivery as CheckoutBody["delivery"];
    const items = order.items as Array<{
      name: string;
      quantity: number;
      unitPriceCents: number;
      weightGrams: number;
    }>;
    const claimed = await this.database.$executeRawUnsafe(
      `UPDATE "StorefrontShipment"
          SET status='PROCESSING',"invoiceKey"=$2,"lastError"=NULL,"updatedAt"=NOW()
        WHERE id=$1 AND (
          status IN ('WAITING_INVOICE','ERROR') OR
          (status='PROCESSING' AND "updatedAt" < NOW() - INTERVAL '10 minutes')
        )`,
      order.shipmentId,
      invoiceKey,
    );
    if (!claimed)
      throw new BadRequestException(
        "Esta remessa já está sendo processada. Atualize a página em instantes.",
      );
    try {
      let providerShipmentId = order.providerShipmentId as string | null;
      if (!providerShipmentId) {
        const created = await this.melhorEnvio.createShipment({
          serviceId: Number(order.providerServiceId),
          orderCode: order.code,
          orderUrl: `${process.env.STOREFRONT_WEB_URL || ""}/pedido/${order.id}`,
          invoiceKey,
          recipient: {
            name: customer?.name || "",
            email: customer?.email || "",
            phone: digits(customer?.phone),
            document: digits(customer?.cpf),
            address: delivery?.street || "",
            complement: delivery?.complement || "",
            number: delivery?.number || "",
            district: delivery?.district || "",
            city: delivery?.city || "",
            postal_code: digits(delivery?.postalCode),
            state_abbr: delivery?.state?.toUpperCase() || "",
          },
          products: items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            unitaryValueCents: item.unitPriceCents,
          })),
          weightGrams: items.reduce((sum, item) => sum + item.weightGrams, 0),
          insuredValueCents: order.subtotalCents,
        });
        providerShipmentId = created.providerShipmentId;
        await this.database.$executeRawUnsafe(
          `UPDATE "StorefrontShipment" SET "providerShipmentId"=$2,"updatedAt"=NOW() WHERE id=$1`,
          order.shipmentId,
          providerShipmentId,
        );
      }
      const completed =
        await this.melhorEnvio.completeShipment(providerShipmentId);
      await this.database.$executeRawUnsafe(
        `UPDATE "StorefrontShipment"
            SET status='LABEL_READY',"labelUrl"=$2,"purchasedAt"=COALESCE("purchasedAt",NOW()),"generatedAt"=NOW(),"updatedAt"=NOW()
          WHERE id=$1`,
        order.shipmentId,
        completed.labelUrl,
      );
      return { status: "LABEL_READY", ...completed };
    } catch (error) {
      await this.database.$executeRawUnsafe(
        `UPDATE "StorefrontShipment" SET status='ERROR',"lastError"=$2,"updatedAt"=NOW() WHERE id=$1`,
        order.shipmentId,
        error instanceof Error
          ? error.message.slice(0, 500)
          : "Erro desconhecido",
      );
      throw error;
    }
  }

  @Post(":orderId/shipment/sync")
  async syncShipment(@Param("orderId") orderId: string) {
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT id,"providerShipmentId",status FROM "StorefrontShipment" WHERE "orderId"=$1 LIMIT 1`,
      orderId,
    );
    const shipment = rows[0];
    if (!shipment?.providerShipmentId)
      throw new BadRequestException("A etiqueta ainda não foi gerada.");
    const tracking = await this.melhorEnvio.track(shipment.providerShipmentId);
    const providerEvent =
      tracking?.[shipment.providerShipmentId] ??
      Object.values(tracking || {})[0] ??
      {};
    const providerStatus = String(
      (providerEvent as any)?.status || "",
    ).toLowerCase();
    const mappedStatus = providerStatus.includes("deliver")
      ? "DELIVERED"
      : providerStatus.includes("transit")
        ? "IN_TRANSIT"
        : providerStatus.includes("post")
          ? "POSTED"
          : shipment.status;
    const trackingCode =
      (providerEvent as any)?.tracking ||
      (providerEvent as any)?.tracking_code ||
      null;
    await this.database.$executeRawUnsafe(
      `UPDATE "StorefrontShipment"
          SET status=$2,"trackingCode"=COALESCE($3,"trackingCode"),"trackingPayload"=$4::jsonb,"lastTrackedAt"=NOW(),"updatedAt"=NOW()
        WHERE id=$1`,
      shipment.id,
      mappedStatus,
      trackingCode,
      JSON.stringify(tracking),
    );
    if (mappedStatus === "DELIVERED")
      await this.storefrontInventory.markDelivered(orderId).catch((error) =>
        console.error("Entrega recebida antes da baixa operacional", {
          orderId,
          message: error instanceof Error ? error.message : "erro desconhecido",
        }),
      );
    return { status: mappedStatus, trackingCode, tracking };
  }

  @Post(":orderId/fulfillment/picking")
  startPicking(@Param("orderId") orderId: string) {
    return this.storefrontInventory.startPicking(orderId);
  }

  @Post(":orderId/fulfillment/ready")
  completePicking(
    @Param("orderId") orderId: string,
    @Body() body: { pickedByItem?: Record<string, number> },
  ) {
    if (!body.pickedByItem || typeof body.pickedByItem !== "object")
      throw new BadRequestException(
        "Informe as quantidades conferidas por item.",
      );
    return this.storefrontInventory.completePicking(orderId, body.pickedByItem);
  }

  @Post(":orderId/fulfillment/shipped")
  async markShipped(@Param("orderId") orderId: string) {
    const result = await this.storefrontInventory.markShipped(orderId);
    await this.email.sendShippedOrder(orderId).catch((error) =>
      console.error("Falha ao enviar aviso de expedição", {
        orderId,
        message: error instanceof Error ? error.message : "erro desconhecido",
      }),
    );
    return result;
  }

  @Public()
  @Post("bling/webhook")
  async blingWebhook(
    @Req() request: any,
    @Headers("x-bling-signature-256") suppliedSignature: string | undefined,
    @Body() body: any,
  ) {
    const secret =
      process.env.BLING_CLIENT_SECRET?.trim() ||
      process.env.BLING_WEBHOOK_SECRET?.trim();
    const rawBody = request.rawBody as Buffer | undefined;
    if (!secret || !rawBody || !suppliedSignature)
      throw new UnauthorizedException("Webhook do Bling não autorizado.");
    const hex = createHmac("sha256", secret).update(rawBody).digest("hex");
    const base64 = createHmac("sha256", secret)
      .update(rawBody)
      .digest("base64");
    if (
      !secureEqual(suppliedSignature, hex) &&
      !secureEqual(suppliedSignature, base64)
    )
      throw new UnauthorizedException("Assinatura do Bling inválida.");

    const eventName = String(body?.event || body?.type || "unknown");
    const providerEventId = String(
      body?.eventId ||
        body?.id ||
        createHash("sha256").update(rawBody).digest("hex"),
    );
    const orderCode = findString(body?.data ?? body, (value) =>
      /^WEB-\d{8}-[A-Z0-9]{6}$/i.test(value.trim()),
    )?.trim();
    const accessKeyValue = findString(body?.data ?? body, (value) =>
      /^\d{44}$/.test(digits(value)),
    );
    const accessKey = digits(accessKeyValue);
    const orderRows = orderCode
      ? await this.database.$queryRawUnsafe<any[]>(
          `SELECT id,"companyId" FROM "StorefrontOrder" WHERE code=$1 LIMIT 1`,
          orderCode,
        )
      : [];
    const order = orderRows[0];

    const inserted = await this.database.$queryRawUnsafe<any[]>(
      `INSERT INTO "IntegrationWebhookEvent"
        (id,"companyId",provider,"providerEventId","eventName",payload,status,"receivedAt")
       VALUES ($1,$2,'BLING',$3,$4,$5::jsonb,'RECEIVED',NOW())
       ON CONFLICT (provider,"providerEventId") DO NOTHING
       RETURNING id`,
      randomUUID(),
      order?.companyId ?? null,
      providerEventId,
      eventName,
      JSON.stringify(body),
    );
    if (!inserted[0]) return { received: true, idempotent: true };

    if (!order || accessKey.length !== 44) {
      await this.database.$executeRawUnsafe(
        `UPDATE "IntegrationWebhookEvent" SET status='IGNORED',"processedAt"=NOW(),"lastError"=$2 WHERE id=$1`,
        inserted[0].id,
        !order
          ? "Pedido BBOS não identificado no evento."
          : "Chave da NF-e ainda não disponível.",
      );
      return { received: true, awaitingData: true };
    }

    try {
      const shipment = await this.issueShipment(order.id, {
        invoiceKey: accessKey,
      });
      await this.database.$executeRawUnsafe(
        `UPDATE "IntegrationWebhookEvent" SET status='PROCESSED',"processedAt"=NOW() WHERE id=$1`,
        inserted[0].id,
      );
      return { received: true, shipment };
    } catch (error) {
      await this.database.$executeRawUnsafe(
        `UPDATE "IntegrationWebhookEvent" SET status='ERROR',"processedAt"=NOW(),"lastError"=$2 WHERE id=$1`,
        inserted[0].id,
        error instanceof Error
          ? error.message.slice(0, 500)
          : "Erro desconhecido",
      );
      throw error;
    }
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
      await this.markAsPaid(order.id, providerOrder.id);
      return { paid: true };
    }
    return { paid: false };
  }

  private async ensureMercadoPagoCheckout(order: any, idempotencyKey: string) {
    if (order.paymentExternalId) {
      const current = await this.mercadoPago.getOrder(order.paymentExternalId);
      if (current.checkout_url)
        return { externalId: current.id, checkoutUrl: current.checkout_url };
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
    const providerOrder = await this.mercadoPago.createCheckout({
      idempotencyKey: `mp-${idempotencyKey}`.slice(0, 128),
      orderCode: order.code,
      totalCents: order.totalCents,
      shippingCents: order.shippingCents,
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
    });
    await this.database.$executeRawUnsafe(
      `UPDATE "StorefrontOrder" SET "paymentProvider"='MERCADO_PAGO',"paymentExternalId"=$2,"updatedAt"=NOW() WHERE id=$1`,
      order.id,
      providerOrder.id,
    );
    return {
      externalId: providerOrder.id,
      checkoutUrl: providerOrder.checkout_url!,
    };
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
  async create(@Body() body: CheckoutBody) {
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
      if (!grinds.has(item.grind || "Grãos"))
        throw new BadRequestException("Escolha de moagem inválida.");
      return {
        id: item.id,
        name: product.name,
        quantity,
        grind: item.grind || "Grãos",
        unitPriceCents: product.unitPriceCents,
        totalCents: product.unitPriceCents * quantity,
        weightGrams: product.weightGrams * quantity,
      };
    });
    const subtotalCents = items.reduce((sum, item) => sum + item.totalCents, 0);
    const weightGrams = items.reduce((sum, item) => sum + item.weightGrams, 0);
    if (!body.shippingQuoteId)
      throw new BadRequestException("Calcule a entrega antes de continuar.");
    const shippingQuote = verifyShippingQuote(body.shippingQuoteId, {
      postalCode: delivery.postalCode || "",
      subtotalCents,
      weightGrams,
    });
    const shippingCents = shippingQuote.priceCents;
    const companyId = await this.companyId();
    const existing = await this.database.$queryRawUnsafe<any[]>(
      `SELECT * FROM "StorefrontOrder" WHERE "idempotencyKey"=$1 LIMIT 1`,
      key,
    );
    if (existing[0]) {
      const confirmationToken = randomBytes(32).toString("base64url");
      await this.database.$executeRawUnsafe(
        `UPDATE "StorefrontOrder" SET "confirmationTokenHash"=$2,"updatedAt"=NOW() WHERE id=$1`,
        existing[0].id,
        tokenHash(confirmationToken),
      );
      const payment = await this.ensureMercadoPagoCheckout(existing[0], key);
      return {
        id: existing[0].id,
        code: existing[0].code,
        status: existing[0].status,
        totalCents: existing[0].totalCents,
        confirmationToken,
        checkoutUrl: payment.checkoutUrl,
        idempotent: true,
      };
    }

    const id = randomUUID();
    const confirmationToken = randomBytes(32).toString("base64url");
    const code = `WEB-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${id.slice(0, 6).toUpperCase()}`;
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `INSERT INTO "StorefrontOrder"
        (id,"companyId",code,status,"idempotencyKey","confirmationTokenHash",customer,delivery,items,recurrence,"subtotalCents","shippingCents","totalCents","requestedPaymentMethod","createdAt","updatedAt")
       VALUES ($1,$2,$3,'AWAITING_PAYMENT',$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12,$13,NOW(),NOW())
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
        shipping: {
          name: shippingQuote.name,
          serviceName: shippingQuote.serviceName,
          carrierName: shippingQuote.carrierName,
          deliveryDays: shippingQuote.deliveryDays,
          provider: shippingQuote.provider,
          providerServiceId: shippingQuote.providerServiceId,
          commercialPriceCents: shippingQuote.commercialPriceCents,
          customerPriceCents: shippingQuote.priceCents,
        },
      }),
      JSON.stringify(items),
      JSON.stringify(body.recurrence ?? { mode: "now" }),
      subtotalCents,
      shippingCents,
      subtotalCents + shippingCents,
      paymentMethod,
    );
    const completeOrder = {
      ...rows[0],
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
    };
  }

  @Public()
  @Get(":orderId/status")
  async status(
    @Param("orderId") orderId: string,
    @Headers("x-storefront-order-token") suppliedToken: string | undefined,
  ) {
    if (!suppliedToken)
      throw new UnauthorizedException("Consulta de pedido não autorizada.");
    let rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT id,code,status,"fulfillmentStatus","paidAt","totalCents","paymentExternalId",delivery,"createdAt","updatedAt" FROM "StorefrontOrder" WHERE id=$1 AND "confirmationTokenHash"=$2 LIMIT 1`,
      orderId,
      tokenHash(suppliedToken),
    );
    if (!rows[0] && validTrackingToken(suppliedToken, orderId))
      rows = await this.database.$queryRawUnsafe<any[]>(
        `SELECT id,code,status,"fulfillmentStatus","paidAt","totalCents","paymentExternalId",delivery,"createdAt","updatedAt" FROM "StorefrontOrder" WHERE id=$1 LIMIT 1`,
        orderId,
      );
    if (!rows[0])
      throw new UnauthorizedException("Consulta de pedido não autorizada.");
    if (rows[0].status !== "PAID" && rows[0].paymentExternalId) {
      await this.reconcileMercadoPago(rows[0]);
      rows = await this.database.$queryRawUnsafe<any[]>(
        `SELECT id,code,status,"fulfillmentStatus","paidAt","totalCents","paymentExternalId",delivery,"createdAt","updatedAt" FROM "StorefrontOrder" WHERE id=$1 AND "confirmationTokenHash"=$2 LIMIT 1`,
        orderId,
        tokenHash(suppliedToken),
      );
    }
    const order = rows[0];
    const shipping = order.delivery?.shipping ?? {};
    const shipmentRows = await this.database
      .$queryRawUnsafe<any[]>(
        `SELECT status,"labelUrl","trackingCode","trackingPayload","generatedAt","lastTrackedAt"
         FROM "StorefrontShipment" WHERE "orderId"=$1 LIMIT 1`,
        order.id,
      )
      .catch(() => []);
    const shipment = shipmentRows[0] ?? null;
    const events = [
      {
        eventType: "ORDER_RECEIVED",
        title: "Pedido recebido",
        detail: "Sua escolha foi registrada pela Bispo Coffees.",
        occurredAt: order.createdAt,
      },
    ];
    if (order.paidAt)
      events.push({
        eventType: "PAYMENT_CONFIRMED",
        title: "Pagamento confirmado",
        detail: "Seu café seguirá para preparação e embalagem.",
        occurredAt: order.paidAt,
      });
    if (order.fulfillmentStatus === "RESERVED")
      events.push({
        eventType: "STOCK_RESERVED",
        title: "Cafés reservados",
        detail: "Os cafés do seu pedido foram separados no estoque.",
        occurredAt: order.updatedAt,
      });
    if (shipment?.generatedAt)
      events.push({
        eventType: "SHIPMENT_PREPARED",
        title: "Entrega preparada",
        detail: "Seu café está pronto para seguir viagem.",
        occurredAt: shipment.generatedAt,
      });
    return {
      id: order.id,
      code: order.code,
      status: order.status,
      fulfillmentStatus: order.fulfillmentStatus,
      paidAt: order.paidAt,
      totalCents: order.totalCents,
      carrierName: shipping.carrierName || "Entrega Bispo",
      shippingServiceName: shipping.serviceName || "Entrega cuidadosa",
      estimatedDeliveryDays: shipping.deliveryDays || null,
      events,
      shipment: shipment
        ? {
            status: shipment.status,
            trackingCode: shipment.trackingCode,
            tracking: shipment.trackingPayload,
            lastTrackedAt: shipment.lastTrackedAt,
          }
        : null,
    };
  }

  @Public()
  @Post("mercado-pago/webhook")
  async mercadoPagoWebhook(
    @Query("data.id") queryDataId: string | undefined,
    @Query("id") queryId: string | undefined,
    @Body() body: any,
  ) {
    const externalId =
      body?.data?.id || body?.id || queryDataId || queryId || undefined;
    if (!externalId) return { received: true };
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT id,code,status,"totalCents","paymentExternalId" FROM "StorefrontOrder" WHERE "paymentExternalId"=$1 LIMIT 1`,
      String(externalId),
    );
    if (!rows[0]) return { received: true };
    await this.reconcileMercadoPago(rows[0]);
    return { received: true };
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
    const updated = await this.database.$executeRawUnsafe(
      `UPDATE "StorefrontOrder" SET status='PAYMENT_FAILED',"paymentProvider"=$2,"paymentExternalId"=$3,"updatedAt"=NOW() WHERE id=$1`,
      body.orderId,
      body.provider,
      body.externalId,
    );
    if (!updated) throw new BadRequestException("Pedido não encontrado.");
    return { id: body.orderId, status: "PAYMENT_FAILED" };
  }
}
