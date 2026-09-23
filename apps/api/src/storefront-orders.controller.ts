import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  OnModuleInit,
  Param,
  Post,
  Query,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaClient, SalesOrderStatus } from "@bbos/database";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Public } from "./auth.guard";
import { MercadoPagoService } from "./mercado-pago.service";
import { StorefrontShippingService } from "./storefront-shipping.service";
import { StorefrontLifecycleService } from "./storefront-lifecycle.service";
import { StorefrontCouponsService } from "./storefront-coupons.service";

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
const grinds = new Set(["Grãos", "Espresso", "Coado", "Prensa francesa"]);
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
  recurrence?: { mode?: string; rhythmDays?: number };
  couponCode?: string;
};

@Controller("storefront/orders")
export class StorefrontOrdersController implements OnModuleInit {
  private readonly database = new PrismaClient();

  constructor(
    private readonly mercadoPago: MercadoPagoService,
    private readonly shipping: StorefrontShippingService,
    private readonly lifecycle: StorefrontLifecycleService,
    private readonly coupons: StorefrontCouponsService,
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
          status === SalesOrderStatus.CONFIRMED &&
          existing.status === SalesOrderStatus.DRAFT
        ) {
          return transaction.salesOrder.update({
            where: { id: existing.id },
            data: { status: SalesOrderStatus.CONFIRMED },
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
    const companyId = await this.companyId();
    const coupon = body.couponCode?.trim()
      ? await this.coupons.calculate(companyId, body.couponCode, subtotalCents)
      : null;
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
      await this.syncSalesOrder(existing[0].id);
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
    await this.syncSalesOrder(id);
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
      `SELECT id,code,status,"paidAt","totalCents","paymentExternalId","shippingServiceName","carrierName","estimatedDeliveryDays"
         FROM "StorefrontOrder" WHERE id=$1 AND ("confirmationTokenHash"=$2 OR $3::boolean=TRUE) LIMIT 1`,
      orderId,
      tokenHash(suppliedToken),
      this.lifecycle.validTrackingToken(orderId, suppliedToken),
    );
    if (!rows[0])
      throw new UnauthorizedException("Consulta de pedido não autorizada.");
    await this.syncSalesOrder(orderId);
    if (rows[0].status !== "PAID" && rows[0].paymentExternalId) {
      await this.reconcileMercadoPago(rows[0]);
      rows = await this.database.$queryRawUnsafe<any[]>(
        `SELECT id,code,status,"paidAt","totalCents","paymentExternalId","shippingServiceName","carrierName","estimatedDeliveryDays"
           FROM "StorefrontOrder" WHERE id=$1 AND ("confirmationTokenHash"=$2 OR $3::boolean=TRUE) LIMIT 1`,
        orderId,
        tokenHash(suppliedToken),
        this.lifecycle.validTrackingToken(orderId, suppliedToken),
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
    const { paymentExternalId: _privatePaymentId, ...publicOrder } = rows[0];
    return { ...publicOrder, events, shipment: shipments[0] ?? null };
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
