import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
} from "@nestjs/common";
import { prisma } from "@bbos/database";
import { randomUUID } from "node:crypto";
import { SalesOrdersService } from "./sales-orders.service";
import { assessCustomerFiscalReadiness } from "./customer-fiscal-readiness";

type PartnerActor = {
  companyId: string;
  role: string;
  storefrontPartnerId?: string | null;
};

@Controller("partner-portal")
export class PartnerPortalController {
  private readonly database = prisma;

  constructor(private readonly salesOrders: SalesOrdersService) {}

  private async context(request: { user?: PartnerActor }) {
    const actor = request.user;
    if (!actor || actor.role !== "PARTNER" || !actor.storefrontPartnerId) {
      throw new ForbiddenException("Acesso restrito ao parceiro de venda.");
    }
    const partners = await this.database.$queryRawUnsafe<any[]>(
      `SELECT id,name,"contactName",email,phone,"pixKey",active,"portalAccessLevel"::text AS "portalAccessLevel"
         FROM "StorefrontPartner"
        WHERE id=$1 AND "companyId"=$2
        LIMIT 1`,
      actor.storefrontPartnerId,
      actor.companyId,
    );
    const partner = partners[0];
    if (!partner || !partner.active) {
      throw new ForbiddenException("O acesso deste parceiro está inativo.");
    }
    return { actor, partner };
  }

  private assertCanCreateOrders(partner: any) {
    if (!["SELLER", "DISTRIBUTOR"].includes(partner.portalAccessLevel)) {
      throw new ForbiddenException(
        "Seu nível de acesso permite apenas consultar negócios e comissões.",
      );
    }
  }

  private async assertCustomer(
    partnerId: string,
    companyId: string,
    customerId: string,
  ) {
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT c.id,c.name,c."tradeName",c.segment,c.active,c."postalCode"
         FROM "StorefrontPartnerCustomer" link
         JOIN "Customer" c ON c.id=link."customerId"
        WHERE link."partnerId"=$1 AND c.id=$2 AND c."companyId"=$3
        LIMIT 1`,
      partnerId,
      customerId,
      companyId,
    );
    if (!rows[0] || !rows[0].active) {
      throw new BadRequestException("Cliente não liberado para este parceiro.");
    }
    return rows[0];
  }

  private async resolvePrice(
    companyId: string,
    customerId: string,
    productVariantId: string,
  ) {
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT pp.price,pp.currency,sc.id AS "salesChannelId",sc.name AS "salesChannelName",
              sc.type::text AS "salesChannelType"
         FROM "Customer" c
         JOIN "ProductPrice" pp
           ON pp."companyId"=c."companyId" AND pp."productVariantId"=$2
         JOIN "SalesChannel" sc ON sc.id=pp."salesChannelId" AND sc.active=true
        WHERE c.id=$1 AND c."companyId"=$3 AND pp.active=true
          AND (pp."validFrom" IS NULL OR pp."validFrom" <= NOW())
          AND (pp."validUntil" IS NULL OR pp."validUntil" >= NOW())
        ORDER BY CASE
          WHEN c.segment ILIKE '%distrib%' AND sc.type='DISTRIBUIDOR' THEN 0
          WHEN c.segment ILIKE '%cafeter%' AND sc.type='CAFETERIA' THEN 0
          WHEN c.segment ILIKE '%escrit%' AND sc.type='ESCRITORIO' THEN 0
          WHEN c.segment ILIKE '%export%' AND sc.type='EXPORTACAO' THEN 0
          WHEN (c.segment ILIKE '%consum%' OR c.segment ILIKE '%varejo%') AND sc.type='ECOMMERCE' THEN 0
          WHEN sc.type='B2B' THEN 1 ELSE 5 END,
          pp."validFrom" DESC NULLS LAST,pp."createdAt" DESC
        LIMIT 1`,
      customerId,
      productVariantId,
      companyId,
    );
    if (!rows[0]) {
      throw new BadRequestException(
        "Produto sem preço vigente para o canal comercial deste cliente.",
      );
    }
    return {
      unitPrice: Number(rows[0].price),
      currency: rows[0].currency,
      salesChannelId: rows[0].salesChannelId as string,
      salesChannelName: rows[0].salesChannelName as string,
      salesChannelType: rows[0].salesChannelType as string,
    };
  }

  private async nextOrderNumber(companyId: string) {
    const year = new Date().getFullYear();
    const prefix = `P-${year}-`;
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT COALESCE(MAX(RIGHT(COALESCE("orderNumber",code),6)::int),0)+1 AS next
         FROM "SalesOrder"
        WHERE "companyId"=$1 AND COALESCE("orderNumber",code) LIKE $2`,
      companyId,
      `${prefix}%`,
    );
    return `${prefix}${String(Math.max(1, Number(rows[0]?.next ?? 1))).padStart(6, "0")}`;
  }

  @Get("summary")
  async summary(@Req() request: { user?: PartnerActor }) {
    const { actor, partner } = await this.context(request);

    const [metricsRows, coupons, businesses, partnerOrders] = await Promise.all(
      [
        this.database.$queryRawUnsafe<any[]>(
          `SELECT
            COUNT(r.id) FILTER (WHERE r.status <> 'CANCELLED')::int AS "businessCount",
            COALESCE(SUM(r."netSubtotalCents") FILTER (WHERE r.status <> 'CANCELLED'),0)::int AS "salesCents",
            COALESCE(SUM(r."commissionCents") FILTER (WHERE r.status <> 'CANCELLED'),0)::int AS "commissionEarnedCents",
            COALESCE(ROUND(SUM(ap.amount) FILTER (WHERE ap.status='PAID') * 100),0)::int AS "commissionPaidCents",
            COALESCE(ROUND(SUM(ap."openAmount") FILTER (WHERE ap.status IN ('OPEN','PARTIALLY_PAID','OVERDUE')) * 100),0)::int AS "commissionOpenCents"
           FROM "StorefrontPartner" partner
           LEFT JOIN "StorefrontCouponRedemption" r
             ON r."partnerId"=partner.id AND r."companyId"=partner."companyId"
           LEFT JOIN "AccountsPayable" ap
             ON ap."storefrontPartnerId"=partner.id
            AND ap.category='COMISSAO_CUPOM'
            AND ap."brokerCommissionPayableKey"=('coupon:' || r.id)
          WHERE partner.id=$1 AND partner."companyId"=$2`,
          partner.id,
          actor.companyId,
        ),
        this.database.$queryRawUnsafe<any[]>(
          `SELECT c.id,c.code,c.description,c."discountType",c."discountValue",
                c."commissionType",c."commissionValue",c."commissionBasis",
                c."usageLimit",c."usageCount",c."validFrom",c."validUntil",c.active,
                COUNT(r.id) FILTER (WHERE r.status <> 'CANCELLED')::int AS "confirmedUses",
                COALESCE(SUM(r."commissionCents") FILTER (WHERE r.status <> 'CANCELLED'),0)::int AS "commissionCents"
           FROM "StorefrontCoupon" c
           LEFT JOIN "StorefrontCouponRedemption" r ON r."couponId"=c.id
          WHERE c."companyId"=$1 AND c."partnerId"=$2
          GROUP BY c.id
          ORDER BY c."createdAt" DESC`,
          actor.companyId,
          partner.id,
        ),
        this.database.$queryRawUnsafe<any[]>(
          `SELECT r.id,r."couponCode",r."grossSubtotalCents",r."discountCents",
                r."netSubtotalCents",r."commissionCents",r.status,r."createdAt",
                so.code AS "orderCode",ap.status AS "payableStatus",
                COALESCE(ROUND(ap."openAmount" * 100),0)::int AS "commissionOpenCents",
                ap."paymentDate" AS "commissionPaidAt"
           FROM "StorefrontCouponRedemption" r
           JOIN "StorefrontOrder" so ON so.id=r."storefrontOrderId"
           LEFT JOIN "AccountsPayable" ap
             ON ap."brokerCommissionPayableKey"=('coupon:' || r.id)
          WHERE r."companyId"=$1 AND r."partnerId"=$2 AND r.status <> 'CANCELLED'
          ORDER BY r."createdAt" DESC
          LIMIT 100`,
          actor.companyId,
          partner.id,
        ),
        this.database.$queryRawUnsafe<any[]>(
          `SELECT so.id,so.code,so.status::text AS status,so."totalAmount",so."orderedAt",
                c.name AS "customerName"
           FROM "SalesOrder" so
           JOIN "Customer" c ON c.id=so."customerId"
          WHERE so."companyId"=$1 AND so."createdByStorefrontPartnerId"=$2
            AND so.status <> 'CANCELLED'
          ORDER BY so."orderedAt" DESC
          LIMIT 100`,
          actor.companyId,
          partner.id,
        ),
      ],
    );

    return {
      partner,
      capabilities: {
        canCreateCustomers: ["SELLER", "DISTRIBUTOR"].includes(
          partner.portalAccessLevel,
        ),
        canCreateOrders: ["SELLER", "DISTRIBUTOR"].includes(
          partner.portalAccessLevel,
        ),
      },
      metrics: metricsRows[0] ?? {
        businessCount: 0,
        salesCents: 0,
        commissionEarnedCents: 0,
        commissionPaidCents: 0,
        commissionOpenCents: 0,
      },
      coupons,
      businesses,
      partnerOrders,
      updatedAt: new Date().toISOString(),
    };
  }

  @Get("order-options")
  async orderOptions(@Req() request: { user?: PartnerActor }) {
    const { actor, partner } = await this.context(request);
    this.assertCanCreateOrders(partner);
    const [customers, internalOptions] = await Promise.all([
      this.database.$queryRawUnsafe<any[]>(
        `SELECT c.id,c.name,c."legalName",c."tradeName",c."taxId",c.segment,c."postalCode",
                c.address,c."addressNumber",c."addressComplement",c.district,c.city,c.state,
                c."stateRegistration",c."stateRegistrationType"
           FROM "StorefrontPartnerCustomer" link
           JOIN "Customer" c ON c.id=link."customerId"
          WHERE link."partnerId"=$1 AND c."companyId"=$2 AND c.active=true
          ORDER BY c.name ASC`,
        partner.id,
        actor.companyId,
      ),
      this.salesOrders.options(actor.companyId),
    ]);
    return {
      customers: customers.map((customer) => ({
        ...customer,
        fiscalReadiness: assessCustomerFiscalReadiness(customer),
      })),
      variants: internalOptions.variants,
    };
  }

  @Post("customers")
  async createCustomer(
    @Req() request: { user?: PartnerActor },
    @Body() body: Record<string, any>,
  ) {
    const { actor, partner } = await this.context(request);
    this.assertCanCreateOrders(partner);
    const fiscalReadiness = assessCustomerFiscalReadiness(body);
    if (!fiscalReadiness.ready) {
      throw new BadRequestException(
        `Complete o cadastro fiscal do cliente: ${fiscalReadiness.issues.join(", ")}.`,
      );
    }
    const fiscal = fiscalReadiness.normalized;
    const name = fiscal.name;
    const taxId = fiscal.taxId;
    const email =
      String(body.email ?? "")
        .trim()
        .toLowerCase() || null;
    const phoneRaw = String(body.phone ?? "").trim();
    const phone = phoneRaw ? `+${phoneRaw.replace(/\D/g, "")}` : null;
    const postalCode = fiscal.postalCode;
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      throw new BadRequestException("Informe um e-mail válido.");
    }
    if (phone && !/^\+[1-9]\d{7,14}$/.test(phone)) {
      throw new BadRequestException(
        "Informe o telefone no padrão internacional.",
      );
    }
    if (taxId) {
      const duplicate = await this.database.$queryRawUnsafe<any[]>(
        `SELECT id FROM "Customer"
          WHERE "companyId"=$1
            AND regexp_replace(COALESCE("taxId",''),'[^0-9]','','g')=$2
          LIMIT 1`,
        actor.companyId,
        taxId,
      );
      if (duplicate[0]) {
        throw new BadRequestException(
          "Este cliente já está cadastrado. Solicite à equipe Bispo a vinculação ao seu acesso.",
        );
      }
    }
    const customerId = randomUUID();
    await this.database.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(
        `INSERT INTO "Customer"
          (id,"companyId",name,"legalName","tradeName","taxId",segment,email,phone,"postalCode",
           address,"addressNumber","addressComplement",district,city,state,"stateRegistration","stateRegistrationType",
           "paymentTerms",active,"creditStatus","creditLimit","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'À vista',true,'NOT_ANALYZED',0,NOW(),NOW())`,
        customerId,
        actor.companyId,
        name,
        fiscal.legalName || null,
        String(body.tradeName ?? "").trim() || null,
        taxId || null,
        String(body.segment ?? "B2B").trim() || "B2B",
        email,
        phone,
        postalCode,
        fiscal.address,
        fiscal.addressNumber,
        fiscal.addressComplement || null,
        fiscal.district,
        fiscal.city,
        fiscal.state,
        fiscal.stateRegistration || null,
        fiscal.stateRegistrationType,
      );
      await transaction.$executeRawUnsafe(
        `INSERT INTO "StorefrontPartnerCustomer" ("partnerId","customerId","createdAt")
         VALUES ($1,$2,NOW())`,
        partner.id,
        customerId,
      );
    });
    return { id: customerId, name, tradeName: body.tradeName || null };
  }

  @Post("quote")
  async quote(
    @Req() request: { user?: PartnerActor },
    @Body()
    body: {
      customerId?: string;
      items?: Array<{ productVariantId?: string; quantity?: number }>;
    },
  ) {
    const { actor, partner } = await this.context(request);
    this.assertCanCreateOrders(partner);
    const customerId = String(body.customerId ?? "").trim();
    await this.assertCustomer(partner.id, actor.companyId, customerId);
    const items = body.items ?? [];
    if (!items.length)
      throw new BadRequestException("Adicione ao menos um produto.");
    const quoted = [];
    let salesChannelId = "";
    for (const item of items) {
      const productVariantId = String(item.productVariantId ?? "").trim();
      const quantity = Number(item.quantity ?? 0);
      if (
        !productVariantId ||
        !Number.isSafeInteger(quantity) ||
        quantity <= 0
      ) {
        throw new BadRequestException("Produto ou quantidade inválida.");
      }
      const price = await this.resolvePrice(
        actor.companyId,
        customerId,
        productVariantId,
      );
      if (salesChannelId && salesChannelId !== price.salesChannelId) {
        throw new BadRequestException(
          "Os produtos precisam usar a mesma tabela comercial.",
        );
      }
      salesChannelId = price.salesChannelId;
      quoted.push({
        productVariantId,
        quantity,
        ...price,
        totalAmount: Math.round(price.unitPrice * quantity * 100) / 100,
      });
    }
    return {
      items: quoted,
      totalAmount:
        Math.round(
          quoted.reduce((sum, item) => sum + item.totalAmount, 0) * 100,
        ) / 100,
    };
  }

  @Post("orders")
  async createOrder(
    @Req() request: { user?: PartnerActor },
    @Body()
    body: {
      customerId?: string;
      items?: Array<{
        productVariantId?: string;
        warehouseId?: string;
        quantity?: number;
      }>;
      deliveryMode?: "PICKUP" | "CUSTOMER_CARRIER";
      carrierName?: string;
      expectedDeliveryDate?: string;
      customerReference?: string;
      notes?: string;
    },
  ) {
    const { actor, partner } = await this.context(request);
    this.assertCanCreateOrders(partner);
    const customerId = String(body.customerId ?? "").trim();
    await this.assertCustomer(partner.id, actor.companyId, customerId);
    const items = body.items ?? [];
    if (!items.length)
      throw new BadRequestException("Adicione ao menos um produto.");
    const options = await this.salesOrders.options(actor.companyId);
    const allowedVariants = new Map(
      options.variants.map((variant) => [variant.productVariantId, variant]),
    );
    const pricedItems = [];
    let salesChannelId = "";
    for (const item of items) {
      const productVariantId = String(item.productVariantId ?? "").trim();
      const quantity = Number(item.quantity ?? 0);
      const variant = allowedVariants.get(productVariantId);
      if (!variant || !Number.isSafeInteger(quantity) || quantity <= 0) {
        throw new BadRequestException("Produto ou quantidade inválida.");
      }
      const price = await this.resolvePrice(
        actor.companyId,
        customerId,
        productVariantId,
      );
      if (salesChannelId && salesChannelId !== price.salesChannelId) {
        throw new BadRequestException(
          "Os produtos precisam usar a mesma tabela comercial.",
        );
      }
      salesChannelId = price.salesChannelId;
      pricedItems.push({
        productVariantId,
        warehouseId: variant.warehouseId,
        quantity,
        unitPrice: price.unitPrice,
      });
    }
    const deliveryMode =
      body.deliveryMode === "CUSTOMER_CARRIER" ? "CUSTOMER_CARRIER" : "PICKUP";
    const carrierName = String(body.carrierName ?? "").trim();
    if (deliveryMode === "CUSTOMER_CARRIER" && !carrierName) {
      throw new BadRequestException(
        "Informe a transportadora escolhida pelo cliente.",
      );
    }
    const orderNumber = await this.nextOrderNumber(actor.companyId);
    const order = await this.salesOrders.create(actor.companyId, {
      code: orderNumber,
      orderNumber,
      customerId,
      salesChannelId,
      freight: 0,
      notes: [
        `Criado no portal por ${partner.name}.`,
        String(body.notes ?? "").trim(),
      ]
        .filter(Boolean)
        .join(" "),
      expectedDeliveryDate: body.expectedDeliveryDate || undefined,
      items: pricedItems,
    });
    await this.database.$executeRawUnsafe(
      `UPDATE "SalesOrder"
          SET "createdByStorefrontPartnerId"=$2,"paymentType"='CASH',
              "paymentTermsSnapshot"='À vista',"freightResponsibility"=$3,
              "carrierName"=$4,"customerReference"=$5,"updatedAt"=NOW()
        WHERE id=$1 AND "companyId"=$6`,
      order.id,
      partner.id,
      deliveryMode,
      carrierName || null,
      String(body.customerReference ?? "").trim() || null,
      actor.companyId,
    );
    return {
      id: order.id,
      code: orderNumber,
      status: "DRAFT",
      totalAmount: Number(order.totalAmount),
      message: "Pedido enviado para conferência da equipe Bispo.",
    };
  }
}
