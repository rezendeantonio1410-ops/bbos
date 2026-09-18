import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaClient } from "@bbos/database";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Public } from "./auth.guard";
import { MercadoPagoService } from "./mercado-pago.service";

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

  constructor(private readonly mercadoPago: MercadoPagoService) {}

  private async markAsPaid(
    orderId: string,
    externalId: string,
    provider = "MERCADO_PAGO",
  ) {
    return this.database.$transaction(async (transaction) => {
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
      return { id: order.id, code: order.code, status: "PAID" };
    });
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
    const region = Number(digits(delivery.postalCode).slice(0, 1));
    const free = subtotalCents >= 27000 && [0, 1, 2, 8, 9].includes(region);
    const shippingCents = free
      ? 0
      : 1590 + Math.max(0, Math.ceil(weightGrams / 1000) - 1) * 450;
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
      `SELECT id,code,status,"paidAt","totalCents","paymentExternalId" FROM "StorefrontOrder" WHERE id=$1 AND "confirmationTokenHash"=$2 LIMIT 1`,
      orderId,
      tokenHash(suppliedToken),
    );
    if (!rows[0])
      throw new UnauthorizedException("Consulta de pedido não autorizada.");
    if (rows[0].status !== "PAID" && rows[0].paymentExternalId) {
      await this.reconcileMercadoPago(rows[0]);
      rows = await this.database.$queryRawUnsafe<any[]>(
        `SELECT id,code,status,"paidAt" FROM "StorefrontOrder" WHERE id=$1 AND "confirmationTokenHash"=$2 LIMIT 1`,
        orderId,
        tokenHash(suppliedToken),
      );
    }
    return rows[0];
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
