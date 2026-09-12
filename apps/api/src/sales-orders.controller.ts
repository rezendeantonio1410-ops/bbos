import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  SalesOrdersService,
  type CreateSalesOrderInput,
} from "./sales-orders.service";
import { AuthService } from "./auth.service";

const isCashTerm = (value: unknown) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return !normalized || normalized === "à vista" || normalized === "a vista";
};
const termDays = (value: unknown) => {
  const match = String(value ?? "").match(/(\d+)/);
  return match ? Math.max(0, Number(match[1])) : 0;
};
const roundMoney = (value: number) => Math.round(value * 100) / 100;

type SalesOrderCommercialTerms = {
  paymentType?: string;
  paymentTerms?: string;
  freightResponsibility?: "BISPO" | "CUSTOMER" | "PICKUP";
  carrierName?: string;
  customerReference?: string;
  incoterm?: string;
  incotermLocation?: string;
};

@Controller("sales-orders")
export class SalesOrdersController {
  constructor(
    private readonly salesOrders: SalesOrdersService,
    private readonly auth: AuthService,
  ) {}

  private async actor(request: any) {
    const actor = await this.auth.resolve(this.auth.readToken(request));
    if (!actor) throw new UnauthorizedException("Sessão inválida.");
    return actor;
  }

  private async nextOrderNumber() {
    const year = new Date().getFullYear();
    const prefix = `B-${year}-`;
    const rows = await this.salesOrders.database.$queryRawUnsafe<any[]>(
      `SELECT COALESCE(MAX(RIGHT(COALESCE("orderNumber", code), 6)::int), 0) + 1 AS next
         FROM "SalesOrder"
        WHERE COALESCE("orderNumber", code) LIKE $1`,
      `${prefix}%`,
    );
    const next = Math.max(1, Number(rows[0]?.next ?? 1));
    return `${prefix}${String(next).padStart(6, "0")}`;
  }

  private async resolveInternalPrice(customerId: string, productVariantId: string) {
    const rows = await this.salesOrders.database.$queryRawUnsafe<any[]>(
      `SELECT pp.id AS "productPriceId", pp.price, pp.currency,
              pp."maxRequestDiscountPercent", pp."maxApprovalDiscountPercent",
              pp."minimumPrice", pp."minimumMarginPercent", pp."minimumRoiPercent",
              sc.id AS "salesChannelId", sc.name AS "salesChannelName", sc.type AS "salesChannelType",
              pv."unitCost", c.segment
         FROM "Customer" c
         JOIN "ProductPrice" pp
           ON pp."companyId" = c."companyId"
          AND pp."productVariantId" = $2
         JOIN "SalesChannel" sc ON sc.id = pp."salesChannelId" AND sc.active = true
         JOIN "ProductVariant" pv ON pv.id = pp."productVariantId"
        WHERE c.id = $1
          AND pp.active = true
          AND (pp."validFrom" IS NULL OR pp."validFrom" <= NOW())
          AND (pp."validUntil" IS NULL OR pp."validUntil" >= NOW())
        ORDER BY CASE
          WHEN c.segment ILIKE '%distrib%' AND sc.type = 'DISTRIBUIDOR' THEN 0
          WHEN c.segment ILIKE '%cafeter%' AND sc.type = 'CAFETERIA' THEN 0
          WHEN c.segment ILIKE '%escrit%' AND sc.type = 'ESCRITORIO' THEN 0
          WHEN c.segment ILIKE '%export%' AND sc.type = 'EXPORTACAO' THEN 0
          WHEN (c.segment ILIKE '%consum%' OR c.segment ILIKE '%varejo%') AND sc.type = 'ECOMMERCE' THEN 0
          WHEN sc.type = 'B2B' THEN 1
          ELSE 5
        END,
        pp."validFrom" DESC NULLS LAST,
        pp."createdAt" DESC
        LIMIT 1`,
      customerId,
      productVariantId,
    );
    const row = rows[0];
    if (!row) {
      throw new BadRequestException(
        "Este produto ainda não possui preço interno vigente para o canal comercial deste cliente.",
      );
    }
    return {
      productPriceId: row.productPriceId as string,
      officialUnitPrice: Number(row.price),
      currency: row.currency as string,
      salesChannelId: row.salesChannelId as string,
      salesChannelName: row.salesChannelName as string,
      salesChannelType: row.salesChannelType as string,
      maxRequestDiscountPercent: Number(row.maxRequestDiscountPercent ?? 0),
      maxApprovalDiscountPercent: Number(row.maxApprovalDiscountPercent ?? 0),
      minimumPrice: row.minimumPrice == null ? null : Number(row.minimumPrice),
      minimumMarginPercent: row.minimumMarginPercent == null ? null : Number(row.minimumMarginPercent),
      minimumRoiPercent: row.minimumRoiPercent == null ? null : Number(row.minimumRoiPercent),
      unitCost: Number(row.unitCost ?? 0),
      segment: row.segment as string | null,
    };
  }

  @Get()
  list() { return this.salesOrders.list(); }

  @Get("options")
  options() { return this.salesOrders.options(); }

  @Get("next-number")
  async nextNumber() { return { number: await this.nextOrderNumber() }; }

  @Get("quote")
  async quote(
    @Query("customerId") customerId: string,
    @Query("productVariantId") productVariantId: string,
    @Query("quantity") rawQuantity = "1",
  ) {
    if (!customerId || !productVariantId) throw new BadRequestException("Cliente e produto são obrigatórios para cotar.");
    const quantity = Number(rawQuantity);
    if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new BadRequestException("Quantidade inválida.");
    const price = await this.resolveInternalPrice(customerId, productVariantId);
    return {
      ...price,
      quantity,
      totalAmount: roundMoney(price.officialUnitPrice * quantity),
      discountPolicy: {
        maxRequestPercent: price.maxRequestDiscountPercent,
        maxApprovalPercent: price.maxApprovalDiscountPercent,
        minimumPrice: price.minimumPrice,
        minimumMarginPercent: price.minimumMarginPercent,
        minimumRoiPercent: price.minimumRoiPercent,
      },
    };
  }

  @Get(":id")
  get(@Param("id") id: string) { return this.salesOrders.get(id); }

  @Post()
  async create(@Body() body: CreateSalesOrderInput & SalesOrderCommercialTerms) {
    const paymentType = String(body.paymentType ?? "CASH").toUpperCase();
    if (!["CASH", "TERM"].includes(paymentType)) throw new BadRequestException("Forma de pagamento inválida.");
    const paymentTerms = paymentType === "TERM" ? String(body.paymentTerms ?? "").trim() : "À vista";
    if (paymentType === "TERM" && !paymentTerms) throw new BadRequestException("Informe a condição de pagamento da venda a prazo.");
    if (!body.customerId || !body.items?.length) throw new BadRequestException("Cliente e itens são obrigatórios.");

    const freightResponsibility = String(body.freightResponsibility ?? "").trim().toUpperCase();
    if (!freightResponsibility) {
      throw new BadRequestException("Selecione quem será responsável pelo frete.");
    }
    if (!["BISPO", "CUSTOMER", "PICKUP"].includes(freightResponsibility)) {
      throw new BadRequestException("Responsabilidade do frete inválida.");
    }

    const pricedItems = [] as CreateSalesOrderInput["items"];
    let resolvedChannelId: string | undefined;
    let resolvedChannelType: string | undefined;
    for (const item of body.items) {
      const price = await this.resolveInternalPrice(body.customerId, item.productVariantId);
      if (resolvedChannelId && resolvedChannelId !== price.salesChannelId) {
        throw new BadRequestException("Os itens do pedido precisam pertencer ao mesmo canal/tabela comercial.");
      }
      resolvedChannelId = price.salesChannelId;
      resolvedChannelType = price.salesChannelType;
      pricedItems.push({ ...item, unitPrice: price.officialUnitPrice });
    }

    const orderNumber = await this.nextOrderNumber();
    const order = await this.salesOrders.create({
      ...body,
      code: orderNumber,
      orderNumber,
      salesChannelId: resolvedChannelId,
      items: pricedItems,
      notes: String(body.notes ?? "").trim() || undefined,
      expectedDeliveryDate: body.expectedDeliveryDate || undefined,
    });

    const carrierName = String(body.carrierName ?? "").trim() || null;
    const customerReference = String(body.customerReference ?? "").trim() || null;
    const incoterm = resolvedChannelType === "EXPORTACAO" ? (String(body.incoterm ?? "").trim().toUpperCase() || null) : null;
    const incotermLocation = resolvedChannelType === "EXPORTACAO" ? (String(body.incotermLocation ?? "").trim() || null) : null;

    await this.salesOrders.database.$executeRawUnsafe(
      `UPDATE "SalesOrder"
          SET "paymentType"=$2,
              "paymentTermsSnapshot"=$3,
              "freightResponsibility"=$4,
              "carrierName"=$5,
              "customerReference"=$6,
              "incoterm"=$7,
              "incotermLocation"=$8,
              "updatedAt"=NOW()
        WHERE id=$1`,
      order.id,
      paymentType,
      paymentTerms,
      freightResponsibility,
      carrierName,
      customerReference,
      incoterm,
      incotermLocation,
    );

    return {
      ...order,
      code: orderNumber,
      orderNumber,
      paymentType,
      paymentTermsSnapshot: paymentTerms,
      freightResponsibility,
      carrierName,
      customerReference,
      incoterm,
      incotermLocation,
    };
  }

  @Get(":id/discount-requests")
  async discountRequests(@Param("id") id: string) {
    return this.salesOrders.database.$queryRawUnsafe<any[]>(
      `SELECT * FROM "SalesDiscountRequest" WHERE "salesOrderId"=$1 ORDER BY "createdAt" DESC`,
      id,
    );
  }

  @Post(":id/discount-request")
  async requestDiscount(
    @Param("id") id: string,
    @Req() request: any,
    @Body() body: { salesOrderItemId: string; discountPercent: number; rationale: string },
  ) {
    const actor = await this.actor(request);
    const itemRows = await this.salesOrders.database.$queryRawUnsafe<any[]>(
      `SELECT soi.id, soi.quantity, soi."productVariantId", so."customerId", so."companyId", so.status
         FROM "SalesOrderItem" soi
         JOIN "SalesOrder" so ON so.id = soi."salesOrderId"
        WHERE so.id=$1 AND soi.id=$2`,
      id,
      body.salesOrderItemId,
    );
    const item = itemRows[0];
    if (!item) throw new BadRequestException("Item do pedido não encontrado.");
    if (item.companyId !== actor.companyId) throw new UnauthorizedException("Pedido fora da empresa do usuário.");
    if (item.status !== "DRAFT") throw new BadRequestException("Desconto só pode ser solicitado enquanto o pedido está em rascunho.");

    const discountPercent = Number(body.discountPercent);
    const rationale = String(body.rationale ?? "").trim();
    if (!Number.isFinite(discountPercent) || discountPercent <= 0) throw new BadRequestException("Informe um desconto maior que zero.");
    if (!rationale) throw new BadRequestException("Justifique a solicitação de desconto.");
    const price = await this.resolveInternalPrice(item.customerId, item.productVariantId);
    if (discountPercent > price.maxRequestDiscountPercent) {
      throw new BadRequestException(`Desconto máximo solicitável nesta tabela: ${price.maxRequestDiscountPercent.toFixed(2)}%.`);
    }
    const requestedUnitPrice = roundMoney(price.officialUnitPrice * (1 - discountPercent / 100));
    if (price.minimumPrice !== null && requestedUnitPrice < price.minimumPrice) {
      throw new BadRequestException(`Preço mínimo permitido nesta tabela: R$ ${price.minimumPrice.toFixed(2)}.`);
    }
    const marginPercent = requestedUnitPrice > 0 ? ((requestedUnitPrice - price.unitCost) / requestedUnitPrice) * 100 : -Infinity;
    const roiPercent = price.unitCost > 0 ? ((requestedUnitPrice - price.unitCost) / price.unitCost) * 100 : Infinity;
    if (price.minimumMarginPercent !== null && marginPercent < price.minimumMarginPercent) {
      throw new BadRequestException(`Desconto bloqueado: margem resultante ${marginPercent.toFixed(1)}% abaixo do mínimo ${price.minimumMarginPercent.toFixed(1)}%.`);
    }
    if (price.minimumRoiPercent !== null && roiPercent < price.minimumRoiPercent) {
      throw new BadRequestException(`Desconto bloqueado: ROI resultante ${roiPercent.toFixed(1)}% abaixo do mínimo ${price.minimumRoiPercent.toFixed(1)}%.`);
    }
    const pending = await this.salesOrders.database.$queryRawUnsafe<any[]>(
      `SELECT id FROM "SalesDiscountRequest" WHERE "salesOrderItemId"=$1 AND status='PENDING' LIMIT 1`,
      item.id,
    );
    if (pending.length) throw new BadRequestException("Já existe uma solicitação de desconto pendente para este item.");

    const requestId = randomUUID();
    await this.salesOrders.database.$executeRawUnsafe(
      `INSERT INTO "SalesDiscountRequest"
        (id,"companyId","salesOrderId","salesOrderItemId","productPriceId","officialUnitPrice","requestedUnitPrice","discountPercent","discountAmount",rationale,status,"requestedById","requestedByName","requestedByRole","createdAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'PENDING',$11,$12,$13,NOW())`,
      requestId, actor.companyId, id, item.id, price.productPriceId, price.officialUnitPrice,
      requestedUnitPrice, discountPercent, roundMoney((price.officialUnitPrice - requestedUnitPrice) * item.quantity),
      rationale, actor.id, actor.name, actor.role,
    );
    return {
      id: requestId,
      status: "PENDING",
      officialUnitPrice: price.officialUnitPrice,
      requestedUnitPrice,
      discountPercent,
      marginPercent,
      roiPercent,
      maxApprovalPercent: price.maxApprovalDiscountPercent,
    };
  }

  @Post(":id/discount-request/:requestId/decision")
  async decideDiscount(
    @Param("id") id: string,
    @Param("requestId") requestId: string,
    @Req() request: any,
    @Body() body: { decision: "APPROVE" | "REJECT"; note?: string },
  ) {
    const actor = await this.actor(request);
    if (!["ADMIN", "EXECUTIVE"].includes(actor.role)) {
      throw new UnauthorizedException("A aprovação de desconto é restrita à administração/diretoria.");
    }
    const rows = await this.salesOrders.database.$queryRawUnsafe<any[]>(
      `SELECT dr.*, pp."maxApprovalDiscountPercent", so.status AS "orderStatus", soi.quantity
         FROM "SalesDiscountRequest" dr
         JOIN "ProductPrice" pp ON pp.id=dr."productPriceId"
         JOIN "SalesOrder" so ON so.id=dr."salesOrderId"
         JOIN "SalesOrderItem" soi ON soi.id=dr."salesOrderItemId"
        WHERE dr.id=$1 AND dr."salesOrderId"=$2`,
      requestId,
      id,
    );
    const discount = rows[0];
    if (!discount) throw new BadRequestException("Solicitação de desconto não encontrada.");
    if (discount.companyId !== actor.companyId) throw new UnauthorizedException("Solicitação fora da empresa do usuário.");
    if (discount.status !== "PENDING") throw new BadRequestException("Esta solicitação já foi decidida.");
    const approve = body.decision === "APPROVE";
    if (approve && Number(discount.discountPercent) > Number(discount.maxApprovalDiscountPercent ?? 0)) {
      throw new BadRequestException(`A tabela permite aprovação somente até ${Number(discount.maxApprovalDiscountPercent ?? 0).toFixed(2)}%.`);
    }
    if (approve && discount.orderStatus !== "DRAFT") throw new BadRequestException("O pedido precisa estar em rascunho para aplicar desconto.");

    await this.salesOrders.database.$transaction(async (tx) => {
      if (approve) {
        const unitPrice = Number(discount.requestedUnitPrice);
        const totalAmount = roundMoney(unitPrice * Number(discount.quantity));
        await tx.$executeRawUnsafe(
          `UPDATE "SalesOrderItem" SET "unitPrice"=$2, "totalAmount"=$3 WHERE id=$1`,
          discount.salesOrderItemId,
          unitPrice,
          totalAmount,
        );
        await tx.$executeRawUnsafe(
          `UPDATE "SalesOrder" so
              SET subtotal = x.subtotal,
                  "totalAmount" = x.subtotal - so.discount + so.freight,
                  "updatedAt" = NOW()
             FROM (SELECT "salesOrderId", SUM("totalAmount")::numeric AS subtotal FROM "SalesOrderItem" WHERE "salesOrderId"=$1 GROUP BY "salesOrderId") x
            WHERE so.id=$1`,
          id,
        );
      }
      await tx.$executeRawUnsafe(
        `UPDATE "SalesDiscountRequest"
            SET status=$2, "decidedById"=$3, "decidedByName"=$4, "decidedByRole"=$5,
                "decisionNote"=$6, "decidedAt"=NOW()
          WHERE id=$1`,
        requestId, approve ? "APPROVED" : "REJECTED", actor.id, actor.name, actor.role,
        String(body.note ?? "").trim() || null,
      );
    });
    return { ok: true, status: approve ? "APPROVED" : "REJECTED" };
  }

  @Post(":id/confirm")
  async confirm(@Param("id") id: string) {
    const pendingDiscounts = await this.salesOrders.database.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int AS count FROM "SalesDiscountRequest" WHERE "salesOrderId"=$1 AND status='PENDING'`,
      id,
    );
    if (Number(pendingDiscounts[0]?.count ?? 0) > 0) {
      throw new BadRequestException("O pedido possui solicitação de desconto pendente de aprovação.");
    }
    const rows = await this.salesOrders.database.$queryRawUnsafe<any[]>(
      `SELECT so.id, so."totalAmount", so."paymentType", so."paymentTermsSnapshot",
              c.id AS "customerId", c.active, c."paymentTerms", c."creditStatus", c."creditLimit"
         FROM "SalesOrder" so JOIN "Customer" c ON c.id = so."customerId" WHERE so.id=$1`, id,
    );
    const context = rows[0];
    if (!context) return this.salesOrders.confirm(id);
    const saleIsTerm = context.paymentType === "TERM" || (context.paymentType === "LEGACY" && !isCashTerm(context.paymentTerms));
    if (saleIsTerm) {
      if (!context.active) throw new BadRequestException("Cliente inativo. O pedido não pode ser confirmado.");
      if (context.creditStatus !== "APPROVED") throw new BadRequestException("Venda a prazo bloqueada: o cliente não possui crédito vigente aprovado.");
      const exposureRows = await this.salesOrders.database.$queryRawUnsafe<any[]>(
        `SELECT COALESCE(SUM("openAmount"),0)::numeric AS total FROM "AccountsReceivable" WHERE "customerId"=$1 AND status NOT IN ('PAID','CANCELLED')`, context.customerId,
      );
      const usedCredit = Number(exposureRows[0]?.total ?? 0);
      const creditLimit = Number(context.creditLimit ?? 0);
      const availableCredit = Math.max(0, creditLimit - usedCredit);
      const orderTotal = Number(context.totalAmount ?? 0);
      if (orderTotal > availableCredit) throw new BadRequestException(`Venda a prazo bloqueada: pedido de ${orderTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} excede o crédito disponível de ${availableCredit.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`);
    }
    return this.salesOrders.confirm(id);
  }

  @Post(":id/reserve")
  reserve(@Param("id") id: string, @Body() body: { warehouseByVariant?: Record<string, string> }) { return this.salesOrders.reserve(id, body.warehouseByVariant); }
  @Post(":id/cancel")
  cancel(@Param("id") id: string) { return this.salesOrders.cancel(id); }
  @Post(":id/ship")
  ship(@Param("id") id: string) { return this.salesOrders.ship(id); }
  @Post(":id/picking")
  picking(@Param("id") id: string) { return this.salesOrders.transition(id, "PICKING"); }
  @Post(":id/ready-to-ship")
  readyToShip(@Param("id") id: string) { return this.salesOrders.transition(id, "READY_TO_SHIP"); }
  @Post(":id/picking/confirm")
  confirmPicking(@Param("id") id: string, @Body() body: { pickedByItem: Record<string, number> }) { return this.salesOrders.confirmPicking(id, body.pickedByItem); }

  @Post(":id/invoice")
  async invoice(@Param("id") id: string) {
    const result = await this.salesOrders.transition(id, "INVOICED");
    const rows = await this.salesOrders.database.$queryRawUnsafe<any[]>(`SELECT "paymentType", "paymentTermsSnapshot" FROM "SalesOrder" WHERE id=$1`, id);
    const payment = rows[0];
    if (payment && payment.paymentType !== "LEGACY") {
      const days = payment.paymentType === "CASH" ? 0 : termDays(payment.paymentTermsSnapshot);
      await this.salesOrders.database.$executeRawUnsafe(`UPDATE "AccountsReceivable" SET "dueDate" = "issueDate" + ($2::int * INTERVAL '1 day'), "updatedAt"=NOW() WHERE "salesOrderId"=$1`, id, days);
    }
    return result;
  }
}
