import {
  BadRequestException,
  Body,
  Controller,
  ConflictException,
  Delete,
  ForbiddenException,
  Get,
  Header,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { Prisma, prisma } from "@bbos/database";
import { randomUUID } from "node:crypto";
import { SalesOrdersService, type CreateSalesOrderInput } from "./sales-orders.service";
import { SalesOrderTermApprovalService } from "./sales-order-term-approval.service";
import { SalesOrderCustomerLifecycleService } from "./sales-order-customer-lifecycle.service";
import { assessCustomerFiscalReadiness } from "./customer-fiscal-readiness";
import { loadSalesOrderBillingData } from "./sales-order-billing-data";
import { buildPartnerPixView } from "./partner-pix";
import { buildSalesOrderBillingPdf } from "./sales-order-billing-pdf";
import { pdfContentDisposition } from "./sales-order-pdf-download";
import { isValidPartnerRequestedReadyDate } from "./partner-ready-date";
import { parseSignaReportYear, signaReportYearBounds } from "./signa-report-period";
import { selectSignaFiscalRecipient } from "./signa-billing-recipient";
import { parseBillableUnitPrice } from "./partner-price-validation";
import { parsePartnerEndCustomerPatch, partnerEndCustomerFields, isPartnerEndCustomerUniqueViolation } from "./partner-end-customer-input";
import {
  hashSignaOrderSubmissionRequest,
  parseSignaOrderSubmissionKey,
  resolveSignaSubmissionReplay,
  splitSignaSubmission,
} from "./signa-order-idempotency";
import { selectDistributorCatalogVisibility } from "./signa-catalog-visibility";
import { parseSignaServerDraftPayload, parseSignaDraftVersion, hasSignaServerDraftCapacity, MAX_SIGNA_SERVER_DRAFTS_PER_USER, type SignaServerDraftPayload } from "./signa-server-draft";

type PartnerActor = {
  id?: string | null;
  name?: string | null;
  companyId: string;
  role: string;
  storefrontPartnerId?: string | null;
};

/** Another request committed the same scoped submission key first. */
class SignaSubmissionClaimedElsewhere extends Error {
  constructor() {
    super("Envio já registrado por outra requisição.");
    this.name = "SignaSubmissionClaimedElsewhere";
  }
}

@Controller("partner-portal")
export class PartnerPortalController {
  private readonly database = prisma;

  constructor(
    private readonly salesOrders: SalesOrdersService,
    private readonly termApprovals: SalesOrderTermApprovalService,
    private readonly customerLifecycle: SalesOrderCustomerLifecycleService,
  ) {}

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
    if (
      !["SELLER", "SALES_MANAGER", "DISTRIBUTOR"].includes(
        partner.portalAccessLevel,
      )
    ) {
      throw new ForbiddenException(
        "Seu nível de acesso permite apenas consultar negócios e comissões.",
      );
    }
  }

  private assertCanManageCustomerPortfolio(partner: any) {
    if (!["SELLER", "SALES_MANAGER"].includes(partner.portalAccessLevel)) {
      throw new ForbiddenException(
        "Esta ação não está disponível para este perfil.",
      );
    }
  }

  private async assertCustomer(
    partner: any,
    companyId: string,
    customerId: string,
  ) {
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT c.id,c.name,c."tradeName",c.segment,c.active,c."postalCode",c."creditStatus",c."creditLimit",c."paymentTerms"
         FROM "Customer" c
        WHERE c.id=$2 AND c."companyId"=$3
          AND ($4::boolean OR EXISTS (
            SELECT 1 FROM "StorefrontPartnerCustomer" link
             WHERE link."partnerId"=$1 AND link."customerId"=c.id
          ))
        LIMIT 1`,
      partner.id,
      customerId,
      companyId,
      partner.portalAccessLevel === "SALES_MANAGER",
    );
    if (!rows[0] || !rows[0].active) {
      throw new BadRequestException("Cliente não liberado para este parceiro.");
    }
    return rows[0];
  }

  private async assertPartnerOrder(
    partner: any,
    companyId: string,
    orderId: string,
  ) {
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT so.id
         FROM "SalesOrder" so
        WHERE so.id=$2 AND so."companyId"=$3
          AND (
            $4::boolean
            OR ($5::boolean AND (so."createdByStorefrontPartnerId"=$1 OR EXISTS (
              SELECT 1 FROM "StorefrontPartnerCustomer" link
               WHERE link."partnerId"=$1 AND link."customerId"=so."customerId"
                 AND so."createdByStorefrontPartnerId" IS NULL
            ) OR EXISTS (
              SELECT 1 FROM "StorefrontPartner" signa
              JOIN "Customer" recipient ON recipient.id=so."customerId"
              WHERE signa.id=$1 AND signa."companyId"=so."companyId"
                AND signa.active=true AND signa."portalAccessLevel"='DISTRIBUTOR'
                AND LOWER(TRIM(signa.name))='signa coffee'
                AND recipient."companyId"=signa."companyId" AND recipient.active=true
                AND ((LOWER(TRIM(recipient.name))='signa coffee' AND length(regexp_replace(COALESCE(recipient."taxId",''),'[^0-9]','','g'))=14)
                  OR (LOWER(TRIM(recipient.name))='rodrigo lampert ribas' AND length(regexp_replace(COALESCE(recipient."taxId",''),'[^0-9]','','g'))=11))
            )))
            OR (NOT $5::boolean AND so."createdByStorefrontPartnerId"=$1)
          )
        LIMIT 1`,
      partner.id,
      orderId,
      companyId,
      partner.portalAccessLevel === "SALES_MANAGER",
      partner.portalAccessLevel === "DISTRIBUTOR",
    );
    if (!rows[0]) {
      throw new ForbiddenException(
        "Este pedido não pertence à carteira deste distribuidor.",
      );
    }
  }

  // Legacy BBOS orders invoiced to Signa or Rodrigo are visible to Signa only.
  // This is read-only portfolio visibility: never reassign fiscal customer or order owner.
  private signaHistoricalOrderScope() {
    return `EXISTS (
      SELECT 1 FROM "StorefrontPartner" signa
      JOIN "Customer" recipient ON recipient.id=so."customerId"
      WHERE signa.id=$2 AND signa."companyId"=so."companyId"
        AND signa.active=true AND signa."portalAccessLevel"='DISTRIBUTOR'
        AND LOWER(TRIM(signa.name))='signa coffee'
        AND recipient."companyId"=signa."companyId" AND recipient.active=true
        AND (
          (LOWER(TRIM(recipient.name))='signa coffee'
            AND length(regexp_replace(COALESCE(recipient."taxId",''),'[^0-9]','','g'))=14)
          OR (LOWER(TRIM(recipient.name))='rodrigo lampert ribas'
            AND length(regexp_replace(COALESCE(recipient."taxId",''),'[^0-9]','','g'))=11)
        )
    )`;
  }

  private async resolvePrice(
    companyId: string,
    customerId: string,
    productVariantId: string,
    distributor = false,
  ) {
    if (distributor) {
      const distributorRows = await this.database.$queryRawUnsafe<any[]>(
        `WITH distributor_channel AS (
           SELECT sc.id,sc.name,sc.type::text AS type
             FROM "SalesChannel" sc
            WHERE sc."companyId"=$3 AND sc.active=true AND sc.type='DISTRIBUIDOR'
            ORDER BY sc."createdAt" ASC
            LIMIT 1
         ), customer_price AS (
           SELECT cpp.id,cpp.price,cpp.currency
             FROM "CustomerProductPrice" cpp
            WHERE cpp."companyId"=$3
              AND cpp."customerId"=$1
              AND cpp."productVariantId"=$2
              AND cpp.active=true
              AND (cpp."validFrom" IS NULL OR cpp."validFrom" <= NOW())
              AND (cpp."validUntil" IS NULL OR cpp."validUntil" >= NOW())
            ORDER BY cpp."validFrom" DESC NULLS LAST,cpp."updatedAt" DESC
            LIMIT 1
         )
         SELECT cpp.id AS "customerProductPriceId",
                cpp.price AS "customerPrice",cpp.currency,
                sc.id AS "salesChannelId",sc.name AS "salesChannelName",
                sc.type AS "salesChannelType",
                pp.id AS "productPriceId",pp.price AS "channelPrice"
           FROM customer_price cpp
           CROSS JOIN distributor_channel sc
           LEFT JOIN LATERAL (
             SELECT candidate.id,candidate.price
               FROM "ProductPrice" candidate
              WHERE candidate."companyId"=$3
                AND candidate."productVariantId"=$2
                AND candidate."salesChannelId"=sc.id
                AND candidate.currency=cpp.currency
                AND candidate.active=true
                AND (candidate."validFrom" IS NULL OR candidate."validFrom" <= NOW())
                AND (candidate."validUntil" IS NULL OR candidate."validUntil" >= NOW())
              ORDER BY candidate."validFrom" DESC NULLS LAST,candidate."createdAt" DESC
              LIMIT 1
           ) pp ON TRUE`,
        customerId,
        productVariantId,
        companyId,
      );
      if (!distributorRows[0]) {
        throw new BadRequestException(
          "Produto sem preço vigente na lista exclusiva deste distribuidor.",
        );
      }
      const unitPrice = parseBillableUnitPrice(distributorRows[0].customerPrice);
      if (unitPrice === null) {
        throw new BadRequestException(
          "Produto com preço exclusivo inválido. Contacte a Bispo antes de enviar o pedido.",
        );
      }
      return {
        unitPrice,
        currency: distributorRows[0].currency,
        productPriceId:
          (distributorRows[0].productPriceId as string | null) ?? undefined,
        customerProductPriceId: distributorRows[0]
          .customerProductPriceId as string,
        pricingSource: "CUSTOMER" as const,
        salesChannelId: distributorRows[0].salesChannelId as string,
        salesChannelName: distributorRows[0].salesChannelName as string,
        salesChannelType: distributorRows[0].salesChannelType as string,
      };
    }
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `WITH base_price AS (
         SELECT pp.id AS "productPriceId",pp.price AS "channelPrice",pp.currency,
                sc.id AS "salesChannelId",sc.name AS "salesChannelName",
                sc.type::text AS "salesChannelType",c.segment
           FROM "Customer" c
           JOIN "ProductPrice" pp
             ON pp."companyId"=c."companyId" AND pp."productVariantId"=$2
           JOIN "SalesChannel" sc ON sc.id=pp."salesChannelId" AND sc.active=true
          WHERE c.id=$1 AND c."companyId"=$3 AND pp.active=true
            AND (pp."validFrom" IS NULL OR pp."validFrom" <= NOW())
            AND (pp."validUntil" IS NULL OR pp."validUntil" >= NOW())
            AND (
              c.segment IS NULL
              OR c.segment NOT ILIKE '%varejo%'
              OR sc.code='VAREJO'
            )
          ORDER BY CASE
            WHEN c.segment ILIKE '%distrib%' AND sc.type='DISTRIBUIDOR' THEN 0
            WHEN c.segment ILIKE '%cafeter%' AND sc.type='CAFETERIA' THEN 0
            WHEN c.segment ILIKE '%escrit%' AND sc.type='ESCRITORIO' THEN 0
            WHEN c.segment ILIKE '%export%' AND sc.type='EXPORTACAO' THEN 0
            WHEN c.segment ILIKE '%consum%' AND sc.code='CONSUMIDOR_FINAL' THEN 0
            WHEN c.segment ILIKE '%varejo%' AND sc.code='VAREJO' THEN 0
            WHEN sc.type='B2B' THEN 1 ELSE 5 END,
            pp."validFrom" DESC NULLS LAST,pp."createdAt" DESC
          LIMIT 1
       )
       SELECT bp.*,
              cpp.id AS "customerProductPriceId",
              cpp.price AS "customerPrice"
         FROM base_price bp
         LEFT JOIN LATERAL (
           SELECT candidate.id,candidate.price
             FROM "CustomerProductPrice" candidate
            WHERE candidate."companyId"=$3
              AND candidate."customerId"=$1
              AND candidate."productVariantId"=$2
              AND candidate.currency=bp.currency
              AND candidate.active=true
              AND (candidate."validFrom" IS NULL OR candidate."validFrom" <= NOW())
              AND (candidate."validUntil" IS NULL OR candidate."validUntil" >= NOW())
            ORDER BY candidate."validFrom" DESC NULLS LAST,candidate."updatedAt" DESC
            LIMIT 1
         ) cpp ON TRUE`,
      customerId,
      productVariantId,
      companyId,
    );
    if (!rows[0]) {
      throw new BadRequestException(
        "Produto sem preço vigente para o canal comercial deste cliente.",
      );
    }
    const unitPrice = parseBillableUnitPrice(
      rows[0].customerPrice ?? rows[0].channelPrice,
    );
    if (unitPrice === null) {
      throw new BadRequestException(
        "Produto com preço inválido. Contacte a Bispo antes de enviar o pedido.",
      );
    }
    return {
      unitPrice,
      currency: rows[0].currency,
      productPriceId: rows[0].productPriceId as string,
      customerProductPriceId:
        (rows[0].customerProductPriceId as string | null) ?? null,
      pricingSource: rows[0].customerProductPriceId
        ? ("CUSTOMER" as const)
        : ("CHANNEL" as const),
      salesChannelId: rows[0].salesChannelId as string,
      salesChannelName: rows[0].salesChannelName as string,
      salesChannelType: rows[0].salesChannelType as string,
    };
  }

  private isSignaDistributor(partner: { portalAccessLevel?: string; name?: string }): boolean {
    return partner.portalAccessLevel === "DISTRIBUTOR" &&
      String(partner.name ?? "").trim().toLowerCase() === "signa coffee";
  }

  private async distributorCatalog(
    companyId: string,
    customerId: string,
    requireExplicitCatalog = false,
  ): Promise<{ variantIds: Set<string>; exclusive: boolean }> {
    const catalogRows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT catalog."productVariantId"
         FROM "CustomerCatalogProduct" catalog
         JOIN "CustomerProductPrice" cpp
           ON cpp."companyId"=catalog."companyId"
          AND cpp."customerId"=catalog."customerId"
          AND cpp."productVariantId"=catalog."productVariantId"
          AND cpp.active=true
          AND (cpp."validFrom" IS NULL OR cpp."validFrom" <= NOW())
          AND (cpp."validUntil" IS NULL OR cpp."validUntil" >= NOW())
        WHERE catalog."companyId"=$1 AND catalog."customerId"=$2
          AND catalog.active=true
        ORDER BY catalog."sortOrder" ASC,catalog."displayProductName" ASC`,
      companyId,
      customerId,
    );
    const visible = selectDistributorCatalogVisibility(
      catalogRows.map((row) => String(row.productVariantId)),
      requireExplicitCatalog,
    );
    // Signa's private catalog must fail closed if its explicit allowlist is
    // absent, not fall back to generic distributor prices.
    if (!visible.needsLegacyFallback) {
      return { variantIds: visible.variantIds, exclusive: true };
    }
    const explicitRows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT cpp."productVariantId"
         FROM "CustomerProductPrice" cpp
        WHERE cpp."companyId"=$1 AND cpp."customerId"=$2 AND cpp.active=true
          AND (cpp."validFrom" IS NULL OR cpp."validFrom" <= NOW())
          AND (cpp."validUntil" IS NULL OR cpp."validUntil" >= NOW())`,
      companyId,
      customerId,
    );
    const exclusive = explicitRows.length > 0;
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT DISTINCT pp."productVariantId"
         FROM "ProductPrice" pp
         JOIN "SalesChannel" sc
           ON sc.id=pp."salesChannelId" AND sc."companyId"=pp."companyId"
          AND sc.active=true AND sc.type='DISTRIBUIDOR'
        WHERE pp."companyId"=$1 AND pp.active=true
          AND (pp."validFrom" IS NULL OR pp."validFrom" <= NOW())
          AND (pp."validUntil" IS NULL OR pp."validUntil" >= NOW())
          AND (
            NOT $3::boolean
            OR EXISTS (
              SELECT 1 FROM "CustomerProductPrice" cpp
               WHERE cpp."companyId"=pp."companyId"
                 AND cpp."customerId"=$2
                 AND cpp."productVariantId"=pp."productVariantId"
                 AND cpp.currency=pp.currency
                 AND cpp.active=true
                 AND (cpp."validFrom" IS NULL OR cpp."validFrom" <= NOW())
                 AND (cpp."validUntil" IS NULL OR cpp."validUntil" >= NOW())
            )
          )`,
      companyId,
      customerId,
      exclusive,
    );
    return {
      variantIds: new Set(rows.map((row) => String(row.productVariantId))),
      exclusive,
    };
  }

  private async distributorVariantOptions(
    companyId: string,
    customerId: string,
    variantIds: Set<string>,
  ) {
    if (!variantIds.size) return [];
    const catalogRows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT catalog."productVariantId",catalog."displayLineName",
              catalog."displayProductName",catalog."sortOrder",cpp.price AS "catalogPrice"
         FROM "CustomerCatalogProduct" catalog
         JOIN "CustomerProductPrice" cpp
           ON cpp."companyId"=catalog."companyId"
          AND cpp."customerId"=catalog."customerId"
          AND cpp."productVariantId"=catalog."productVariantId"
          AND cpp.active=true
          AND (cpp."validFrom" IS NULL OR cpp."validFrom" <= NOW())
          AND (cpp."validUntil" IS NULL OR cpp."validUntil" >= NOW())
        WHERE catalog."companyId"=$1 AND catalog."customerId"=$2
          AND catalog.active=true
          AND catalog."productVariantId"=ANY($3::text[])`,
      companyId,
      customerId,
      [...variantIds],
    );
    const catalogByVariant = new Map(
      catalogRows.map((row) => [String(row.productVariantId), row]),
    );
    const variants = await this.database.productVariant.findMany({
      where: {
        id: { in: [...variantIds] },
        active: true,
        product: {
          active: true,
          productLine: { companyId, active: true },
        },
      },
      include: {
        product: { include: { productLine: true } },
        finishedProducts: {
          where: { companyId },
          include: { warehouse: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: [{ product: { name: "asc" } }, { netWeightGrams: "asc" }],
    });
    return variants
      .map((variant) => {
        const primaryStock = variant.finishedProducts[0] ?? null;
        const physicalStock = variant.finishedProducts.reduce(
          (sum, item) => sum + Number(item.quantityOnHand),
          0,
        );
        const reservedStock = variant.finishedProducts.reduce(
          (sum, item) => sum + Number(item.reservedQuantity),
          0,
        );
        const catalog = catalogByVariant.get(variant.id);
        return {
          productVariantId: variant.id,
          warehouseId: primaryStock?.warehouseId ?? "",
          warehouse: primaryStock?.warehouse.name ?? "Produção sob encomenda",
          line: catalog?.displayLineName ?? variant.product.productLine.name,
          lineCode: variant.product.productLine.code,
          product: catalog?.displayProductName ?? variant.product.name,
          internalLine: variant.product.productLine.name,
          internalProduct: variant.product.name,
          catalogSortOrder: Number(catalog?.sortOrder ?? 9999),
          catalogPrice:
            catalog?.catalogPrice == null ? null : Number(catalog.catalogPrice),
          sku: variant.sku,
          presentationGrams: variant.netWeightGrams,
          salesUnit: variant.salesUnit,
          physicalStock,
          reservedStock,
          availableStock: Math.max(0, physicalStock - reservedStock),
          onHand: physicalStock,
          reserved: reservedStock,
          available: Math.max(0, physicalStock - reservedStock),
          productionToOrder: true,
        };
      })
      .sort(
        (left, right) =>
          left.catalogSortOrder - right.catalogSortOrder ||
          left.presentationGrams - right.presentationGrams,
      );
  }

  private async nextOrderNumber(
    companyId: string,
    client: Prisma.TransactionClient | typeof prisma = this.database,
  ) {
    const year = new Date().getFullYear();
    const prefix = `P-${year}-`;
    const rows = await client.$queryRawUnsafe<any[]>(
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
    const isSalesManager = partner.portalAccessLevel === "SALES_MANAGER";
    const isDistributor = partner.portalAccessLevel === "DISTRIBUTOR";

    const [
      metricsRows,
      coupons,
      businesses,
      partnerOrders,
      partnerNotifications,
    ] = await Promise.all([
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
                so."paymentType"::text AS "paymentType",so."paymentTermsSnapshot",
                c.name AS "customerName",c.name AS "billingRecipientName",
                endcustomer.name AS "endCustomerName",
                COALESCE((SELECT sum(oi.quantity * pv."netWeightGrams") / 1000.0
                  FROM "SalesOrderItem" oi
                  JOIN "ProductVariant" pv ON pv.id=oi."productVariantId"
                  WHERE oi."salesOrderId"=so.id),0)::float AS "volumeKg",
                ar.status::text AS "receivableStatus",
                ar."dueDate",ar.amount AS "receivableAmount",ar."openAmount",
                ar."paymentDate",fiscal.number AS "invoiceNumber",
                fiscal.status::text AS "invoiceStatus",
                fiscal."pdfAvailable" AS "invoicePdfAvailable",
                (so."paymentType"='TERM' AND ar.status IN ('OPEN','PARTIALLY_PAID','OVERDUE')
                  AND ar."openAmount">0 AND fiscal.status='AUTHORIZED') AS "billingAvailable",
                (so."paymentType" IN ('TERM','CASH') AND so."orderType"<>'SAMPLE'
                  AND ar.status IN ('OPEN','PARTIALLY_PAID','OVERDUE')
                  AND ar."openAmount">0 AND ar."dueDate" IS NOT NULL
                  AND fiscal.status='AUTHORIZED') AS "pixAvailable"
           FROM "SalesOrder" so
           JOIN "Customer" c ON c.id=so."customerId"
           LEFT JOIN "PartnerEndCustomer" endcustomer ON endcustomer.id=so."partnerEndCustomerId"
             AND endcustomer."companyId"=so."companyId" AND endcustomer."partnerId"=$2
           LEFT JOIN LATERAL (
             SELECT title.status,title."dueDate",title.amount,title."openAmount",title."paymentDate"
               FROM "AccountsReceivable" title
              WHERE title."salesOrderId"=so.id AND title."companyId"=so."companyId"
              ORDER BY title."createdAt" DESC
              LIMIT 1
           ) ar ON TRUE
           LEFT JOIN LATERAL (
             SELECT fd.number,fd.status,
                    (COALESCE(
                      NULLIF(fd."payloadSnapshot"#>>'{blingNfe,linkPDF}',''),
                      NULLIF(fd."payloadSnapshot"#>>'{blingNfe,linkDanfe}','')
                    ) IS NOT NULL) AS "pdfAvailable"
               FROM "FiscalDocument" fd
              WHERE fd."companyId"=so."companyId" AND fd."salesOrderId"=so.id
                AND fd.direction='OUTBOUND'
              ORDER BY fd."createdAt" DESC
              LIMIT 1
           ) fiscal ON TRUE
          WHERE so."companyId"=$1
            AND (
              $3::boolean
              OR ($4::boolean AND (so."createdByStorefrontPartnerId"=$2 OR EXISTS (
                SELECT 1 FROM "StorefrontPartnerCustomer" link
                 WHERE link."partnerId"=$2 AND link."customerId"=so."customerId"
                 AND so."createdByStorefrontPartnerId" IS NULL
              ) OR ${this.signaHistoricalOrderScope()}))
              OR (NOT $4::boolean AND so."createdByStorefrontPartnerId"=$2)
            )
            AND so.status <> 'CANCELLED'
          ORDER BY so."orderedAt" DESC
          LIMIT 100`,
        actor.companyId,
        partner.id,
        isSalesManager,
        isDistributor,
      ),
      this.database.$queryRawUnsafe<any[]>(
        `SELECT event.id,event."salesOrderId" AS "orderId",
                  COALESCE(so."orderNumber",so.code) AS "orderCode",
                  event."eventType",event.title,event.detail,event.source,event."occurredAt"
             FROM "SalesOrderCustomerEvent" event
             JOIN "SalesOrder" so ON so.id=event."salesOrderId"
            WHERE event."companyId"=$1 AND event.public=TRUE
              AND (
                $3::boolean
                OR ($4::boolean AND (so."createdByStorefrontPartnerId"=$2 OR EXISTS (
                  SELECT 1 FROM "StorefrontPartnerCustomer" link
                   WHERE link."partnerId"=$2 AND link."customerId"=so."customerId"
                 AND so."createdByStorefrontPartnerId" IS NULL
                ) OR ${this.signaHistoricalOrderScope()}))
                OR (NOT $4::boolean AND so."createdByStorefrontPartnerId"=$2)
              )
            ORDER BY event."occurredAt" DESC
            LIMIT 30`,
        actor.companyId,
        partner.id,
        isSalesManager,
        isDistributor,
      ),
    ]);

    return {
      partner,
      capabilities: {
        canCreateCustomers: ["SELLER", "SALES_MANAGER"].includes(
          partner.portalAccessLevel,
        ),
        canCreateOrders: ["SELLER", "SALES_MANAGER", "DISTRIBUTOR"].includes(
          partner.portalAccessLevel,
        ),
        canManageCustomerPortfolio: ["SELLER", "SALES_MANAGER"].includes(
          partner.portalAccessLevel,
        ),
        canRequestCredit: ["SELLER", "SALES_MANAGER"].includes(
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
      notifications: partnerNotifications,
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
                c."stateRegistration",c."stateRegistrationType",c."creditStatus",c."creditLimit",c."paymentTerms",
                EXISTS (
                  SELECT 1 FROM "CustomerCreditEvent" req
                   WHERE req."customerId"=c.id AND req."companyId"=c."companyId" AND req."eventType"='REQUEST'
                     AND NOT EXISTS (
                       SELECT 1 FROM "CustomerCreditEvent" dec
                        WHERE dec."customerId"=c.id AND dec."companyId"=c."companyId" AND dec."eventType"='DECISION'
                          AND dec."createdAt" > req."createdAt"
                     )
                ) AS "creditReviewPending"
           FROM "Customer" c
          WHERE c."companyId"=$2 AND c.active=true
            AND ($3::boolean OR EXISTS (
              SELECT 1 FROM "StorefrontPartnerCustomer" link
               WHERE link."partnerId"=$1 AND link."customerId"=c.id
            ))
          ORDER BY c.name ASC`,
        partner.id,
        actor.companyId,
        partner.portalAccessLevel === "SALES_MANAGER",
      ),
      this.salesOrders.options(actor.companyId),
    ]);
    const distributorCustomer =
      partner.portalAccessLevel === "DISTRIBUTOR" && customers.length === 1
        ? customers[0]
        : null;
    const catalog = distributorCustomer
      ? await this.distributorCatalog(
          actor.companyId,
          distributorCustomer.id,
          this.isSignaDistributor(partner),
        )
      : null;
    // Never return the unrestricted internal product list to a distributor.
    // An ambiguous pricing customer must result in no visible catalog until
    // the account configuration is fixed, not a leak across price lists.
    const variants = catalog
      ? await this.distributorVariantOptions(
          actor.companyId,
          distributorCustomer.id,
          catalog.variantIds,
        )
      : partner.portalAccessLevel === "DISTRIBUTOR"
        ? []
        : internalOptions.variants;
    return {
      customers: customers.map((customer) => ({
        ...customer,
        fiscalReadiness: assessCustomerFiscalReadiness(customer),
      })),
      variants: variants.map((variant) => ({
        ...variant,
        availableStock:
          "availableStock" in variant
            ? variant.availableStock
            : variant.available,
      })),
      catalog: {
        distributor: Boolean(catalog),
        exclusive: catalog?.exclusive ?? false,
        productCount: variants.length,
      },
      // Scope browser drafts by authenticated principal; never use a buyer-only key.
      draftScope: partner.portalAccessLevel === "DISTRIBUTOR" && actor.id
        ? { companyId: actor.companyId, partnerId: partner.id, userId: actor.id }
        : null,
    };
  }

  @Get("orders/:orderId/billing/pdf")
  async billingPdf(
    @Req() request: { user?: PartnerActor },
    @Param("orderId") orderId: string,
    @Res() response: any,
  ) {
    const { actor, partner } = await this.context(request);
    await this.assertPartnerOrder(partner, actor.companyId, orderId);
    const order = await this.salesOrders.get(actor.companyId, orderId);
    const data = await loadSalesOrderBillingData(
      this.database,
      order,
      actor.companyId,
    );
    const pdf = buildSalesOrderBillingPdf(data);
    const orderCode = String(order.orderNumber ?? order.code).replace(
      /[^A-Za-z0-9_-]/g,
      "-",
    );
    response.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": pdfContentDisposition(`Cobranca-${orderCode}.pdf`),
      "Content-Length": pdf.length,
      "Cache-Control": "private, no-store",
    });
    response.send(pdf);
  }

  @Get("orders/:orderId/pix")
  async orderPix(
    @Req() request: { user?: PartnerActor },
    @Param("orderId") orderId: string,
    @Res({ passthrough: true }) response: any,
  ) {
    const { actor, partner } = await this.context(request);
    await this.assertPartnerOrder(partner, actor.companyId, orderId);
    const order = await this.salesOrders.get(actor.companyId, orderId);
    const data = await loadSalesOrderBillingData(
      this.database,
      order,
      actor.companyId,
      { allowCash: true },
    );
    response.set({ "Cache-Control": "private, no-store" });
    return buildPartnerPixView(data);
  }

  @Get("orders/:orderId/invoice/pdf")
  async invoicePdf(
    @Req() request: { user?: PartnerActor },
    @Param("orderId") orderId: string,
    @Res() response: any,
  ) {
    const { actor, partner } = await this.context(request);
    await this.assertPartnerOrder(partner, actor.companyId, orderId);
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT fd.number,fd.status::text AS status,
              COALESCE(
                NULLIF(fd."payloadSnapshot"#>>'{blingNfe,linkPDF}',''),
                NULLIF(fd."payloadSnapshot"#>>'{blingNfe,linkDanfe}','')
              ) AS "pdfUrl"
         FROM "FiscalDocument" fd
        WHERE fd."companyId"=$1 AND fd."salesOrderId"=$2
          AND fd.direction='OUTBOUND'
        ORDER BY fd."createdAt" DESC
        LIMIT 1`,
      actor.companyId,
      orderId,
    );
    const invoice = rows[0];
    const pdfUrl = String(invoice?.pdfUrl ?? "").trim();
    if (invoice?.status !== "AUTHORIZED" || !/^https:\/\//i.test(pdfUrl)) {
      throw new NotFoundException(
        "O DANFE ficará disponível após a autorização da NF-e.",
      );
    }
    response.set({ "Cache-Control": "private, no-store" });
    response.redirect(302, pdfUrl);
  }

  @Post("customers")
  async createCustomer(
    @Req() request: { user?: PartnerActor },
    @Body() body: Record<string, any>,
  ) {
    const { actor, partner } = await this.context(request);
    this.assertCanManageCustomerPortfolio(partner);
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

  @Get("customers/:customerId/visits")
  async customerVisits(
    @Req() request: { user?: PartnerActor },
    @Param("customerId") customerId: string,
  ) {
    const { actor, partner } = await this.context(request);
    this.assertCanManageCustomerPortfolio(partner);
    await this.assertCustomer(partner, actor.companyId, customerId);
    return this.database.$queryRawUnsafe<any[]>(
      `SELECT v.id,v."customerId",v."storefrontPartnerId",v."recordedByName",v."visitAt",
              v."contactName",v.purpose,v.outcome,v.facts,v."nextAction",v."nextActionAt",
              v."createdAt",c.name AS "customerName",c."tradeName" AS "customerTradeName"
         FROM "CustomerVisit" v
         JOIN "Customer" c ON c.id=v."customerId" AND c."companyId"=v."companyId"
        WHERE v."companyId"=$1 AND v."customerId"=$2
        ORDER BY v."visitAt" DESC,v."createdAt" DESC
        LIMIT 100`,
      actor.companyId,
      customerId,
    );
  }

  @Post("customers/:customerId/visits")
  async createCustomerVisit(
    @Req() request: { user?: PartnerActor },
    @Param("customerId") customerId: string,
    @Body() body: Record<string, any>,
  ) {
    const { actor, partner } = await this.context(request);
    this.assertCanManageCustomerPortfolio(partner);
    await this.assertCustomer(partner, actor.companyId, customerId);

    const visitAt = new Date(String(body.visitAt ?? ""));
    if (Number.isNaN(visitAt.getTime())) {
      throw new BadRequestException("Informe a data e a hora da visita.");
    }
    const purpose = String(body.purpose ?? "").trim();
    const outcome = String(body.outcome ?? "").trim();
    const facts = String(body.facts ?? "").trim();
    if (!purpose)
      throw new BadRequestException("Informe o objetivo da visita.");
    if (!outcome)
      throw new BadRequestException("Informe o resultado da visita.");
    if (facts.length < 3) {
      throw new BadRequestException(
        "Registre os principais fatos que aconteceram na visita.",
      );
    }
    const nextActionAtRaw = String(body.nextActionAt ?? "").trim();
    const nextActionAt = nextActionAtRaw ? new Date(nextActionAtRaw) : null;
    if (nextActionAt && Number.isNaN(nextActionAt.getTime())) {
      throw new BadRequestException("A data da próxima ação é inválida.");
    }
    const visitId = randomUUID();
    const recordedByName =
      String(actor.name ?? "").trim() ||
      String(partner.contactName ?? partner.name).trim() ||
      "Vendedor";
    await this.database.$executeRawUnsafe(
      `INSERT INTO "CustomerVisit"
        (id,"companyId","customerId","storefrontPartnerId","recordedByUserId","recordedByName",
         "visitAt","contactName",purpose,outcome,facts,"nextAction","nextActionAt","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW())`,
      visitId,
      actor.companyId,
      customerId,
      partner.id,
      actor.id ?? null,
      recordedByName,
      visitAt,
      String(body.contactName ?? "").trim() || null,
      purpose,
      outcome,
      facts,
      String(body.nextAction ?? "").trim() || null,
      nextActionAt,
    );
    return { id: visitId, ok: true };
  }

  @Post("customers/:customerId/credit-request")
  async requestCustomerCredit(
    @Req() request: { user?: PartnerActor },
    @Param("customerId") customerId: string,
    @Body() body: Record<string, any>,
  ) {
    const { actor, partner } = await this.context(request);
    this.assertCanManageCustomerPortfolio(partner);
    const customer = await this.assertCustomer(
      partner,
      actor.companyId,
      customerId,
    );
    const pending = (
      await this.database.$queryRawUnsafe<any[]>(
        `SELECT EXISTS (
           SELECT 1 FROM "CustomerCreditEvent" req
            WHERE req."customerId"=$1 AND req."companyId"=$2 AND req."eventType"='REQUEST'
              AND NOT EXISTS (
                SELECT 1 FROM "CustomerCreditEvent" dec
                 WHERE dec."customerId"=$1 AND dec."companyId"=$2 AND dec."eventType"='DECISION'
                   AND dec."createdAt" > req."createdAt"
              )
         ) AS pending`,
        customerId,
        actor.companyId,
      )
    )[0]?.pending;
    if (pending) {
      throw new BadRequestException(
        "Já existe uma solicitação de crédito aguardando decisão.",
      );
    }
    const requestedLimit = Number(body.requestedLimit ?? 0);
    if (!Number.isFinite(requestedLimit) || requestedLimit <= 0) {
      throw new BadRequestException(
        "Informe um limite de crédito solicitado maior que zero.",
      );
    }
    const requestedTerms = String(body.requestedTerms ?? "").trim();
    if (!requestedTerms) {
      throw new BadRequestException(
        "Informe a condição de pagamento solicitada.",
      );
    }
    const monthlyVolume =
      body.monthlyVolume === undefined || body.monthlyVolume === ""
        ? null
        : Number(body.monthlyVolume);
    if (
      monthlyVolume !== null &&
      (!Number.isFinite(monthlyVolume) || monthlyVolume < 0)
    ) {
      throw new BadRequestException("Volume mensal estimado inválido.");
    }
    const rationale = String(body.rationale ?? "").trim();
    if (!rationale) {
      throw new BadRequestException(
        "Informe a justificativa da solicitação de crédito.",
      );
    }
    const keepsCurrentApproval = customer.creditStatus === "APPROVED";
    await this.database.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(
        `INSERT INTO "CustomerCreditEvent"
          (id,"companyId","customerId","eventType","requestedLimit","requestedTerms","monthlyVolume",rationale,
           "actorId","actorName","actorRole","createdAt")
         VALUES ($1,$2,$3,'REQUEST',$4,$5,$6,$7,$8,$9,$10,NOW())`,
        randomUUID(),
        actor.companyId,
        customerId,
        requestedLimit,
        requestedTerms,
        monthlyVolume,
        rationale,
        actor.id ?? null,
        String(actor.name ?? partner.contactName ?? partner.name),
        "VENDEDOR",
      );
      if (!keepsCurrentApproval) {
        await transaction.$executeRawUnsafe(
          `UPDATE "Customer" SET "creditStatus"='UNDER_REVIEW',"updatedAt"=NOW()
            WHERE id=$1 AND "companyId"=$2`,
          customerId,
          actor.companyId,
        );
      }
    });
    return {
      ok: true,
      status: keepsCurrentApproval ? "APPROVED" : "UNDER_REVIEW",
      creditReviewPending: true,
    };
  }

  /**
   * Only the authenticated Signa distributor, whose linked pricing Customer
   * has the same CNPJ as its partner account, may see these fiscal choices.
   * The end-customer commercial registry must never be used as an NF-e recipient.
   */
  private async findSignaBillingRecipients(companyId: string, partner: any) {
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT DISTINCT recipient.*,
              CASE WHEN length(regexp_replace(COALESCE(recipient."taxId",''),'[^0-9]','','g'))=14 THEN 'CNPJ'
                   WHEN length(regexp_replace(COALESCE(recipient."taxId",''),'[^0-9]','','g'))=11 THEN 'CPF'
                   ELSE 'INVALID' END AS "documentType",
              pricing.id AS "pricingCustomerId"
         FROM "StorefrontPartner" p
         JOIN "StorefrontPartnerCustomer" link ON link."partnerId"=p.id
         JOIN "Customer" pricing ON pricing.id=link."customerId"
           AND pricing."companyId"=p."companyId" AND pricing.active=true
         JOIN "Customer" recipient ON recipient."companyId"=p."companyId"
           AND recipient.active=true
        WHERE p.id=$1 AND p."companyId"=$2 AND p.active=true
          AND p."portalAccessLevel"='DISTRIBUTOR'
          AND LOWER(TRIM(p.name))='signa coffee'
          AND LOWER(TRIM(pricing.name))='signa coffee'
          AND regexp_replace(COALESCE(p."taxId",''),'[^0-9]','','g') =
              regexp_replace(COALESCE(pricing."taxId",''),'[^0-9]','','g')
          AND (
            (recipient.id=pricing.id AND length(regexp_replace(COALESCE(recipient."taxId",''),'[^0-9]','','g'))=14)
            OR
            (LOWER(TRIM(recipient.name))='rodrigo lampert ribas'
             AND length(regexp_replace(COALESCE(recipient."taxId",''),'[^0-9]','','g'))=11)
          )
        ORDER BY recipient.name`,
      partner.id,
      companyId,
    );
    return rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      documentType: row.documentType as "CPF" | "CNPJ",
      pricingCustomerId: String(row.pricingCustomerId),
      taxIdVerificationStatus: String(row.taxIdVerificationStatus ?? "NOT_VERIFIED"),
      fiscalReady: assessCustomerFiscalReadiness(row).ready,
    }));
  }

  @Get("billing-recipients")
  async billingRecipients(@Req() request: { user?: PartnerActor }) {
    const { actor, partner } = await this.context(request);
    const enabled = partner.portalAccessLevel === "DISTRIBUTOR" &&
      String(partner.name ?? "").trim().toLowerCase() === "signa coffee";
    if (!enabled) return { enabled: false, recipients: [] };
    const recipients = await this.findSignaBillingRecipients(actor.companyId, partner);
    return {
      enabled: true,
      recipients: recipients.map(({ id, name, documentType, taxIdVerificationStatus, fiscalReady }) => ({
        id, name, documentType, taxIdVerificationStatus, fiscalReady,
      })),
    };
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
    await this.assertCustomer(partner, actor.companyId, customerId);
    const items = body.items ?? [];
    if (!items.length)
      throw new BadRequestException("Adicione ao menos um produto.");
    const distributorCatalog =
      partner.portalAccessLevel === "DISTRIBUTOR"
        ? await this.distributorCatalog(
            actor.companyId,
            customerId,
            this.isSignaDistributor(partner),
          )
        : null;
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
      if (
        distributorCatalog &&
        !distributorCatalog.variantIds.has(productVariantId)
      ) {
        throw new BadRequestException(
          "Produto não liberado na lista comercial deste distribuidor.",
        );
      }
      const price = await this.resolvePrice(
        actor.companyId,
        customerId,
        productVariantId,
        partner.portalAccessLevel === "DISTRIBUTOR",
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

  @Get("commercial-reports")
  async commercialReports(
    @Req() request: { user?: PartnerActor },
    @Query("year") yearQuery?: string,
  ) {
    const { actor, partner } = await this.context(request);
    if (partner.portalAccessLevel !== "DISTRIBUTOR") {
      throw new ForbiddenException("Relatórios disponíveis apenas para distribuidores.");
    }
    // All report sections share identical, bound date boundaries.
    // Do not silently apply a year filter only to the monthly summary.
    let year: number | null;
    try {
      year = parseSignaReportYear(yearQuery);
    } catch {
      throw new BadRequestException("Informe um ano válido entre 2000 e 2099.");
    }
    const { start, end } = signaReportYearBounds(year);
    // Values are order totals, not tax invoices or settled receipts.
    // Every aggregate is restricted by company AND the authenticated partner.
    const [monthly, products, regions, years] = await Promise.all([
      this.database.$queryRawUnsafe<any[]>(
        `SELECT to_char(date_trunc('month', so."createdAt"),'YYYY-MM') AS month,
                count(DISTINCT so.id)::int AS orders,
                COALESCE(sum(item.quantity * variant."netWeightGrams") / 1000.0,0)::float AS kilograms,
                COALESCE(sum(item."totalAmount"),0)::float AS "orderValue"
           FROM "SalesOrder" so
           JOIN "SalesOrderItem" item ON item."salesOrderId"=so.id AND item."companyId"=so."companyId"
           JOIN "ProductVariant" variant ON variant.id=item."productVariantId"
          WHERE so."companyId"=$1 AND (so."createdByStorefrontPartnerId"=$2 OR ${this.signaHistoricalOrderScope()})
            AND so.status::text NOT IN ('CANCELLED')
            AND ($3::timestamp IS NULL OR so."createdAt" >= $3::timestamp)
            AND ($4::timestamp IS NULL OR so."createdAt" < $4::timestamp)
          GROUP BY date_trunc('month', so."createdAt")
          ORDER BY month DESC LIMIT 36`,
        actor.companyId, partner.id, start, end,
      ),
      this.database.$queryRawUnsafe<any[]>(
        `SELECT item.sku,
                COALESCE(NULLIF(TRIM(catalog."displayProductName"),''),
                  CASE
                    WHEN product.code IN ('WHITE_LABEL_ESSENCIAL','WHITE_LABEL_CLASSICO_500GR') THEN 'Clássicos'
                    WHEN product.code='WHITE_LABEL_CLASSICO' THEN 'Caramelo'
                    WHEN product.code='WHITE_LABEL_FRUTADO' THEN 'Frutado'
                    WHEN product.code='WHITE_LABEL_RARO' THEN 'Reserva'
                    ELSE item."productName"
                  END) AS product,
                count(DISTINCT so.id)::int AS orders,
                COALESCE(sum(item.quantity),0)::int AS units,
                COALESCE(sum(item.quantity * variant."netWeightGrams") / 1000.0,0)::float AS kilograms,
                COALESCE(sum(item."totalAmount"),0)::float AS "orderValue"
           FROM "SalesOrder" so
           JOIN "SalesOrderItem" item ON item."salesOrderId"=so.id AND item."companyId"=so."companyId"
           JOIN "ProductVariant" variant ON variant.id=item."productVariantId"
           JOIN "Product" product ON product.id=variant."productId"
           LEFT JOIN LATERAL (
             SELECT cp."displayProductName"
               FROM "CustomerCatalogProduct" cp
               JOIN "Customer" customer ON customer.id=cp."customerId"
              WHERE cp."companyId"=so."companyId"
                AND cp."productVariantId"=variant.id
                AND cp.active=true
                AND LOWER(TRIM(customer.name))='signa coffee'
              ORDER BY cp."updatedAt" DESC LIMIT 1
           ) catalog ON TRUE
          WHERE so."companyId"=$1 AND (so."createdByStorefrontPartnerId"=$2 OR ${this.signaHistoricalOrderScope()})
            AND so.status::text NOT IN ('CANCELLED')
            AND ($3::timestamp IS NULL OR so."createdAt" >= $3::timestamp)
            AND ($4::timestamp IS NULL OR so."createdAt" < $4::timestamp)
          GROUP BY item.sku,item."productName",catalog."displayProductName",product.code
          ORDER BY "orderValue" DESC LIMIT 100`,
        actor.companyId, partner.id, start, end,
      ),
      this.database.$queryRawUnsafe<any[]>(
        `SELECT ec.state,ec.city,count(DISTINCT so.id)::int AS orders,
                count(DISTINCT ec.id)::int AS customers,
                COALESCE(sum(item.quantity * variant."netWeightGrams") / 1000.0,0)::float AS kilograms,
                COALESCE(sum(item."totalAmount"),0)::float AS "orderValue"
           FROM "SalesOrder" so
           JOIN "PartnerEndCustomer" ec ON ec.id=so."partnerEndCustomerId"
             AND ec."partnerId"=$2 AND ec."companyId"=$1
           JOIN "SalesOrderItem" item ON item."salesOrderId"=so.id AND item."companyId"=so."companyId"
           JOIN "ProductVariant" variant ON variant.id=item."productVariantId"
          WHERE so."companyId"=$1 AND (so."createdByStorefrontPartnerId"=$2 OR ${this.signaHistoricalOrderScope()})
            AND so.status::text NOT IN ('CANCELLED')
            AND ($3::timestamp IS NULL OR so."createdAt" >= $3::timestamp)
            AND ($4::timestamp IS NULL OR so."createdAt" < $4::timestamp)
          GROUP BY ec.state,ec.city ORDER BY "orderValue" DESC LIMIT 100`,
        actor.companyId, partner.id, start, end,
      ),
      this.database.$queryRawUnsafe<Array<{ year: number }>>(
        `SELECT DISTINCT EXTRACT(YEAR FROM so."createdAt")::int AS year
           FROM "SalesOrder" so
          WHERE so."companyId"=$1 AND (so."createdByStorefrontPartnerId"=$2 OR ${this.signaHistoricalOrderScope()})
            AND so.status::text NOT IN ('CANCELLED')
          ORDER BY year DESC LIMIT 30`,
        actor.companyId, partner.id,
      ),
    ]);
    return {
      monthly, products, regions,
      availableYears: years.map((row) => String(row.year)),
      selectedYear: year,
      basis: "ORDER_VALUE", currency: "BRL",
      notice: "Valores de pedidos; não equivalem a notas fiscais autorizadas ou pagamentos recebidos.",
    };
  }

  /** One active commercial record per CNPJ inside the same company/partner wallet. */
  private async assertEndCustomerTaxIdAvailable(
    companyId: string,
    partnerId: string,
    taxId: string | null,
    exceptId: string | null,
  ) {
    if (!taxId) return;
    const rows = await this.database.$queryRawUnsafe<Array<{ id: string; name: string }>>(
      `SELECT id,name FROM "PartnerEndCustomer"
        WHERE "companyId"=$1 AND "partnerId"=$2 AND active=true AND "taxId"=$3
          AND ($4::text IS NULL OR id<>$4)
        LIMIT 1`,
      companyId, partnerId, taxId, exceptId,
    );
    if (rows[0]) {
      throw new ConflictException(`CNPJ já cadastrado para ${rows[0].name}. Selecione o cliente existente.`);
    }
  }

  // Commercial end customers are isolated from fiscal recipients and scoped by tenant/partner.
  @Get("end-customers")
  @Header("Cache-Control", "private, no-store")
  async listEndCustomers(@Req() request: { user?: PartnerActor }) {
    const { actor, partner } = await this.context(request);
    if (partner.portalAccessLevel !== "DISTRIBUTOR") {
      throw new ForbiddenException("Cadastro disponível apenas para distribuidores.");
    }
    const customers = await this.database.$queryRawUnsafe<any[]>(
      `SELECT id,name,"taxId",email,phone,"postalCode",street,number,district,complement,city,state,notes,"createdAt"
         FROM "PartnerEndCustomer"
        WHERE "companyId"=$1 AND "partnerId"=$2 AND active=true
        ORDER BY name ASC LIMIT 500`,
      actor.companyId, partner.id,
    );
    return { customers };
  }

  @Get("end-customer-history")
  async endCustomerHistory(@Req() request: { user?: PartnerActor }) {
    const { actor, partner } = await this.context(request);
    if (partner.portalAccessLevel !== "DISTRIBUTOR") {
      throw new ForbiddenException("Histórico disponível apenas para distribuidores.");
    }
    const customers = await this.database.$queryRawUnsafe<Array<{
      id: string; name: string; city: string | null; state: string | null;
      orderCount: number; totalOrders: number; lastOrderAt: Date | null;
    }>>(
      `SELECT ec.id,ec.name,ec.city,ec.state,
        count(so.id)::int AS "orderCount",
        COALESCE(sum(so."totalAmount"),0)::float AS "totalOrders",
        max(so."createdAt") AS "lastOrderAt"
       FROM "PartnerEndCustomer" ec
       LEFT JOIN "SalesOrder" so ON so."partnerEndCustomerId"=ec.id
         AND so."companyId"=ec."companyId"
         AND so."createdByStorefrontPartnerId"=ec."partnerId"
         AND so.status::text <> 'CANCELLED'
       WHERE ec."companyId"=$1 AND ec."partnerId"=$2 AND ec.active=true
       GROUP BY ec.id,ec.name,ec.city,ec.state
       ORDER BY ec.name ASC LIMIT 500`,
      actor.companyId, partner.id,
    );
    return { customers, notice: "Valores de pedidos; não representam faturamento ou recebimentos." };
  }

  @Get("end-customers/:endCustomerId/orders")
  async endCustomerOrders(
    @Req() request: { user?: PartnerActor },
    @Param("endCustomerId") endCustomerId: string,
  ) {
    const { actor, partner } = await this.context(request);
    if (partner.portalAccessLevel !== "DISTRIBUTOR") {
      throw new ForbiddenException("Histórico disponível apenas para distribuidores.");
    }
    const customers = await this.database.$queryRawUnsafe<Array<{id:string}>>(
      `SELECT id FROM "PartnerEndCustomer" WHERE id=$1 AND "companyId"=$2 AND "partnerId"=$3 AND active=true LIMIT 1`,
      endCustomerId,actor.companyId,partner.id,
    );
    if (!customers.length) throw new NotFoundException("Cliente não encontrado.");
    const orders = await this.database.$queryRawUnsafe<Array<{
      id:string; code:string; status:string; totalAmount:number; orderedAt:Date;
    }>>(
      `SELECT so.id,so.code,so.status::text AS status,so."totalAmount"::float AS "totalAmount",
              so."createdAt" AS "orderedAt"
         FROM "SalesOrder" so
        WHERE so."companyId"=$1 AND so."createdByStorefrontPartnerId"=$2
          AND so."partnerEndCustomerId"=$3
        ORDER BY so."createdAt" DESC LIMIT 200`,
      actor.companyId,partner.id,endCustomerId,
    );
    return { orders };
  }

  @Post("end-customers")
  async createEndCustomer(
    @Req() request: { user?: PartnerActor },
    @Body() body: Record<string, unknown>,
  ) {
    const { actor, partner } = await this.context(request);
    if (partner.portalAccessLevel !== "DISTRIBUTOR") {
      throw new ForbiddenException("Cadastro disponível apenas para distribuidores.");
    }
    let values: ReturnType<typeof parsePartnerEndCustomerPatch>;
    try {
      values = parsePartnerEndCustomerPatch(body, "create");
    } catch (cause) {
      throw new BadRequestException(cause instanceof Error ? cause.message : "Cadastro inválido.");
    }
    if (!values.name) throw new BadRequestException("Informe a razão social do cliente.");
    await this.assertEndCustomerTaxIdAvailable(actor.companyId, partner.id, values.taxId ?? null, null);
    const id = randomUUID();
    await this.database.$executeRawUnsafe(
      `INSERT INTO "PartnerEndCustomer"
        (id,"companyId","partnerId",name,"taxId","postalCode",street,number,district,complement,city,state,
         email,phone,notes,"createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW(),NOW())`,
      id, actor.companyId, partner.id, values.name, values.taxId ?? null,
      values.postalCode ?? null, values.street ?? null, values.number ?? null,
      values.district ?? null, values.complement ?? null, values.city ?? null, values.state ?? null,
      values.email ?? null, values.phone ?? null, values.notes ?? null,
    ).catch((error: unknown) => {
      if (isPartnerEndCustomerUniqueViolation(error)) {
        throw new ConflictException("CNPJ já cadastrado nesta carteira. Selecione o cliente existente.");
      }
      throw error;
    });
    return { id, ...values, message: "Cliente comercial cadastrado." };
  }

  // Scoped commercial record only: never update fiscal Customer or billing recipient.
  @Patch("end-customers/:customerId")
  async updateEndCustomer(
    @Req() request: { user?: PartnerActor },
    @Param("customerId") customerId: string,
    @Body() body: unknown,
  ) {
    const { actor, partner } = await this.context(request);
    if (partner.portalAccessLevel !== "DISTRIBUTOR") {
      throw new ForbiddenException("Cadastro disponível apenas para distribuidores.");
    }
    let changes: ReturnType<typeof parsePartnerEndCustomerPatch>;
    try {
      changes = parsePartnerEndCustomerPatch(body, "update");
    } catch (cause) {
      throw new BadRequestException(cause instanceof Error ? cause.message : "Dados inválidos.");
    }
    if (changes.taxId) {
      await this.assertEndCustomerTaxIdAvailable(actor.companyId, partner.id, changes.taxId, customerId);
    }
    const fields = partnerEndCustomerFields;
    const keys = fields.filter(key => Object.prototype.hasOwnProperty.call(changes, key));
    const assignments = keys.map((key, index) => `"${key}"=$${index + 4}`).join(", ");
    const values = keys.map(key => changes[key] ?? null);
    const updated = await this.database.$queryRawUnsafe<Array<{
      id: string; name: string; taxId: string | null; postalCode: string | null;
      street: string | null; number: string | null; district: string | null;
      complement: string | null; city: string | null; state: string | null;
      email: string | null; phone: string | null; notes: string | null;
    }>>(
      `UPDATE "PartnerEndCustomer"
          SET ${assignments}, "updatedAt"=NOW()
        WHERE id=$1 AND "companyId"=$2 AND "partnerId"=$3 AND active=true
        RETURNING id,name,"taxId","postalCode",street,number,district,complement,city,state,email,phone,notes`,
      customerId, actor.companyId, partner.id, ...values,
    ).catch((error: unknown) => {
      if (isPartnerEndCustomerUniqueViolation(error)) {
        throw new ConflictException("CNPJ já cadastrado nesta carteira. Selecione o cliente existente.");
      }
      throw error;
    });
    if (!updated[0]) throw new NotFoundException("Cliente comercial não encontrado nesta carteira.");
    return { ...updated[0], message: "Cadastro comercial atualizado." };
  }

  /**
   * Private partner drafts are NOT SalesOrders. All reads/writes include the
   * authenticated user, company and distributor, and never trigger production,
   * stock reservation, NF-e, receivables, Pix or Bling.
   */
  private async signaDraftContext(request: { user?: PartnerActor }) {
    const { actor, partner } = await this.context(request);
    if (!this.isSignaDistributor(partner) || !actor.id) {
      throw new ForbiddenException("Rascunhos estão disponíveis apenas para o usuário Signa autenticado.");
    }
    return { actor, partner, userId: actor.id };
  }

  private async validatedSignaDraft(raw: unknown, actor: PartnerActor, partner: any) {
    let draft: SignaServerDraftPayload;
    try {
      draft = parseSignaServerDraftPayload(raw);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Rascunho inválido.");
    }
    if (draft.customerId) {
      await this.assertCustomer(partner, actor.companyId, draft.customerId);
    }
    if (draft.items.length) {
      if (!draft.customerId) {
        throw new BadRequestException("Selecione o comprador antes de salvar produtos.");
      }
      const visible = await this.distributorCatalog(actor.companyId, draft.customerId, true);
      if (draft.items.some(item => !visible.variantIds.has(item.productVariantId))) {
        throw new BadRequestException("Produto fora do catálogo exclusivo Signa.");
      }
    }
    if (draft.partnerEndCustomerId) {
      const rows = await this.database.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM "PartnerEndCustomer"
          WHERE id=$1 AND "companyId"=$2 AND "partnerId"=$3 AND active=true LIMIT 1`,
        draft.partnerEndCustomerId, actor.companyId, partner.id,
      );
      if (!rows[0]) throw new BadRequestException("Cliente final não liberado para este parceiro.");
    }
    if (draft.billingRecipientId) {
      if (!draft.customerId) {
        throw new BadRequestException("Selecione o comprador antes do destinatário fiscal.");
      }
      const recipients = await this.findSignaBillingRecipients(actor.companyId, partner);
      if (!recipients.some(row =>
        row.id === draft.billingRecipientId && row.pricingCustomerId === draft.customerId
      )) {
        throw new BadRequestException("Destinatário fiscal não autorizado.");
      }
    }
    return draft;
  }

  @Get("order-drafts")
  @Header("Cache-Control", "private, no-store")
  async listOrderDrafts(@Req() request: { user?: PartnerActor }) {
    const { actor, partner, userId } = await this.signaDraftContext(request);
    const drafts = await this.database.$queryRawUnsafe<any[]>(
      `SELECT id,version,payload,"createdAt","updatedAt"
         FROM "PartnerOrderDraft"
        WHERE "companyId"=$1 AND "partnerId"=$2 AND "userId"=$3 AND status='DRAFT'
        ORDER BY "updatedAt" DESC LIMIT 100`,
      actor.companyId, partner.id, userId,
    );
    return { drafts };
  }

  @Get("order-drafts/:draftId")
  @Header("Cache-Control", "private, no-store")
  async getOrderDraft(
    @Req() request: { user?: PartnerActor },
    @Param("draftId") draftId: string,
  ) {
    const { actor, partner, userId } = await this.signaDraftContext(request);
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT id,version,payload,"createdAt","updatedAt"
         FROM "PartnerOrderDraft"
        WHERE id=$1 AND "companyId"=$2 AND "partnerId"=$3 AND "userId"=$4 AND status='DRAFT'
        LIMIT 1`,
      draftId, actor.companyId, partner.id, userId,
    );
    if (!rows[0]) throw new NotFoundException("Rascunho não encontrado neste acesso.");
    return rows[0];
  }

  @Post("order-drafts")
  async createOrderDraft(
    @Req() request: { user?: PartnerActor },
    @Body() body: { payload?: unknown },
  ) {
    const { actor, partner, userId } = await this.signaDraftContext(request);
    const payload = await this.validatedSignaDraft(body?.payload, actor, partner);
    const id = randomUUID();

    // Serialise creation within the same company/partner/user scope.
    // Without the transaction lock, simultaneous clicks can bypass the
    // per-user limit and push older drafts outside the 100-row listing.
    const rows = await this.database.$transaction(async tx => {
      await tx.$queryRawUnsafe(
        `SELECT pg_advisory_xact_lock(hashtextextended($1 || ':' || $2 || ':' || $3, 0)) IS NULL AS acquired`,
        actor.companyId, partner.id, userId,
      );
      const counts = await tx.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*) AS count FROM "PartnerOrderDraft"
          WHERE "companyId"=$1 AND "partnerId"=$2 AND "userId"=$3 AND status='DRAFT'`,
        actor.companyId, partner.id, userId,
      );
      if (!hasSignaServerDraftCapacity(counts[0]?.count ?? BigInt(MAX_SIGNA_SERVER_DRAFTS_PER_USER))) {
        throw new ConflictException(
          `Limite de ${MAX_SIGNA_SERVER_DRAFTS_PER_USER} rascunhos na conta. Exclua um rascunho antigo antes de criar outro.`,
        );
      }
      return tx.$queryRawUnsafe<any[]>(
        `INSERT INTO "PartnerOrderDraft"
           (id,"companyId","partnerId","userId",status,version,payload,"createdAt","updatedAt")
           VALUES ($1,$2,$3,$4,'DRAFT',1,$5::jsonb,NOW(),NOW())
           RETURNING id,version,payload,"createdAt","updatedAt"`,
        id, actor.companyId, partner.id, userId, JSON.stringify(payload),
      );
    });
    return rows[0];
  }

  @Patch("order-drafts/:draftId")
  async updateOrderDraft(
    @Req() request: { user?: PartnerActor },
    @Param("draftId") draftId: string,
    @Body() body: { version?: unknown; payload?: unknown },
  ) {
    const { actor, partner, userId } = await this.signaDraftContext(request);
    let version: number;
    try {
      version = parseSignaDraftVersion(body?.version);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Versão inválida.");
    }
    const payload = await this.validatedSignaDraft(body?.payload, actor, partner);
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `UPDATE "PartnerOrderDraft"
          SET payload=$6::jsonb,version=version+1,"updatedAt"=NOW()
        WHERE id=$1 AND "companyId"=$2 AND "partnerId"=$3 AND "userId"=$4
          AND version=$5 AND status='DRAFT'
        RETURNING id,version,payload,"createdAt","updatedAt"`,
      draftId, actor.companyId, partner.id, userId, version, JSON.stringify(payload),
    );
    if (!rows[0]) throw new ConflictException("Rascunho não encontrado ou alterado em outra sessão. Recarregue antes de salvar.");
    return rows[0];
  }

  @Delete("order-drafts/:draftId")
  async deleteOrderDraft(
    @Req() request: { user?: PartnerActor },
    @Param("draftId") draftId: string,
    @Body() body: { version?: unknown },
  ) {
    const { actor, partner, userId } = await this.signaDraftContext(request);
    let version: number;
    try {
      version = parseSignaDraftVersion(body?.version);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Versão inválida.");
    }
    const rows = await this.database.$queryRawUnsafe<Array<{ id: string }>>(
      `DELETE FROM "PartnerOrderDraft"
        WHERE id=$1 AND "companyId"=$2 AND "partnerId"=$3 AND "userId"=$4
          AND version=$5 AND status='DRAFT' RETURNING id`,
      draftId, actor.companyId, partner.id, userId, version,
    );
    if (!rows[0]) throw new ConflictException("Rascunho não encontrado ou alterado em outra sessão.");
    return { ok: true };
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
      paymentType?: "CASH" | "TERM";
      paymentTermDays?: number;
      expectedDeliveryDate?: string;
      partnerEndCustomerId?: string | null;
      billingRecipientId?: string;
      customerReference?: string;
      notes?: string;
      submissionKey?: string;
    },
  ) {
    const { actor, partner } = await this.context(request);
    this.assertCanCreateOrders(partner);
    const signaDistributor = this.isSignaDistributor(partner);
    // Signa submissions are idempotent: the same key + same payload returns the
    // original order; a different payload or an in-flight key is refused.
    let submission: { key: string; hash: string; userId: string } | null = null;
    if (signaDistributor) {
      if (!actor.id) {
        throw new ForbiddenException("Envio disponível apenas para o usuário Signa autenticado.");
      }
      try {
        const { submissionKey, payload } = splitSignaSubmission(body);
        submission = {
          key: parseSignaOrderSubmissionKey(submissionKey),
          hash: hashSignaOrderSubmissionRequest(payload),
          userId: actor.id,
        };
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error
            ? `${error.message} Atualize a página e envie novamente.`
            : "Envio inválido.",
        );
      }
      const previous = await this.replaySignaSubmission(actor, partner, submission);
      if (previous) return previous;
    }
    const customerId = String(body.customerId ?? "").trim();
    await this.assertCustomer(partner, actor.companyId, customerId);
    let fiscalCustomerId = customerId;
    if (signaDistributor) {
      const available = await this.findSignaBillingRecipients(actor.companyId, partner);
      const selected = selectSignaFiscalRecipient(
        customerId,
        String(body.billingRecipientId ?? "").trim(),
        available.filter((entry) => entry.pricingCustomerId === customerId),
      );
      if (!selected) {
        throw new BadRequestException(
          "Selecione um destinatário fiscal válido: Signa (CNPJ) ou Rodrigo (CPF).",
        );
      }
      fiscalCustomerId = selected;
    } else if (body.billingRecipientId) {
      throw new BadRequestException("Destinatário fiscal não autorizado para este parceiro.");
    }
    const partnerEndCustomerId = String(body.partnerEndCustomerId ?? "").trim();
    if (partnerEndCustomerId) {
      if (partner.portalAccessLevel !== "DISTRIBUTOR") {
        throw new BadRequestException("Cliente final disponível apenas para distribuidores.");
      }
      const endCustomers = await this.database.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM "PartnerEndCustomer"
          WHERE id=$1 AND "companyId"=$2 AND "partnerId"=$3 AND active=true LIMIT 1`,
        partnerEndCustomerId, actor.companyId, partner.id,
      );
      if (!endCustomers.length) {
        throw new BadRequestException("Cliente final não pertence à carteira deste parceiro.");
      }
    }
    const items = body.items ?? [];
    if (!items.length)
      throw new BadRequestException("Adicione ao menos um produto.");
    const distributorCatalog =
      partner.portalAccessLevel === "DISTRIBUTOR"
        ? await this.distributorCatalog(
            actor.companyId,
            customerId,
            this.isSignaDistributor(partner),
          )
        : null;
    const options = distributorCatalog
      ? {
          variants: await this.distributorVariantOptions(
            actor.companyId,
            customerId,
            distributorCatalog.variantIds,
          ),
        }
      : await this.salesOrders.options(actor.companyId);
    const allowedVariants = new Map(
      options.variants
        .filter(
          (variant) =>
            !distributorCatalog ||
            distributorCatalog.variantIds.has(
              String(variant.productVariantId ?? ""),
            ),
        )
        .map((variant) => [variant.productVariantId, variant]),
    );
    const pricedItems: CreateSalesOrderInput["items"] = [];
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
        partner.portalAccessLevel === "DISTRIBUTOR",
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
        pricingSource: price.pricingSource,
        baseProductPriceId: price.productPriceId,
        customerProductPriceId: price.customerProductPriceId,
        priceSnapshot: {
          capturedAt: new Date().toISOString(),
          source: price.pricingSource,
          salesChannelId: price.salesChannelId,
          salesChannelName: price.salesChannelName,
          officialUnitPrice: price.unitPrice,
          pricingCustomerId: customerId,
        },
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
    const paymentType = body.paymentType === "TERM" ? "TERM" : "CASH";
    const paymentTermDays = Number(body.paymentTermDays ?? 0);
    if (
      paymentType === "TERM" &&
      (!Number.isSafeInteger(paymentTermDays) ||
        paymentTermDays < 1 ||
        paymentTermDays > 365)
    ) {
      throw new BadRequestException(
        "Informe um prazo de pagamento entre 1 e 365 dias.",
      );
    }
    const paymentTermsSnapshot =
      paymentType === "TERM"
        ? `${paymentTermDays} dias após a emissão da NF-e`
        : "À vista na emissão da NF-e";
    // The partner's requested ready date is not a Bispo commitment.
    const requestedReadyDate = String(body.expectedDeliveryDate ?? "").trim();
    if (
      partner.portalAccessLevel === "DISTRIBUTOR" &&
      requestedReadyDate &&
      !isValidPartnerRequestedReadyDate(requestedReadyDate)
    ) {
      throw new BadRequestException("Informe uma data válida para o produto pronto.");
    }
    const customerReference = String(body.customerReference ?? "").trim() || null;
    const orderNotes = [
      `Criado no portal por ${partner.name}.`,
      signaDistributor ? `Conta de preços: Signa Coffee. Destinatário fiscal: ${fiscalCustomerId === customerId ? "Signa (CNPJ)" : "Rodrigo (CPF)"}.` : "",
      partner.portalAccessLevel === "DISTRIBUTOR"
        ? "Pedido de distribuidor sob encomenda: aguardando aprovação de José ou Suzi, confirmação da data de entrega e liberação para produção."
        : "",
      String(body.notes ?? "").trim(),
    ]
      .filter(Boolean)
      .join(" ");
    // Claim, order number, SalesOrder, items, accessory fields and claim
    // completion commit or roll back together. A concurrent request with the
    // same scoped key blocks on the unique index and then sees the claim.
    const created = await this.database
      .$transaction(
        async (transaction) => {
          let claimId: string | null = null;
          if (submission) {
            const claimed = await transaction.$queryRawUnsafe<Array<{ id: string }>>(
              `INSERT INTO "PartnerOrderSubmission"
                 (id,"companyId","partnerId","userId","submissionKey","requestHash",status,"createdAt","updatedAt")
               VALUES ($1,$2,$3,$4,$5,$6,'CLAIMED',NOW(),NOW())
               ON CONFLICT ("companyId","partnerId","userId","submissionKey") DO NOTHING
               RETURNING id`,
              randomUUID(), actor.companyId, partner.id, submission.userId,
              submission.key, submission.hash,
            );
            if (!claimed[0]) throw new SignaSubmissionClaimedElsewhere();
            claimId = claimed[0].id;
          }
          // Serialise portal order numbering per company until commit.
          await transaction.$queryRawUnsafe(
            `SELECT pg_advisory_xact_lock(hashtextextended('partner-order-number:' || $1, 0)) IS NULL AS locked`,
            actor.companyId,
          );
          const orderNumber = await this.nextOrderNumber(actor.companyId, transaction);
          const order = await this.salesOrders.create(
            actor.companyId,
            {
              code: orderNumber,
              orderNumber,
              customerId: fiscalCustomerId,
              createdByStorefrontPartnerId: partner.id,
              salesChannelId,
              freight: 0,
              notes: orderNotes,
              expectedDeliveryDate: body.expectedDeliveryDate || undefined,
              items: pricedItems,
            },
            transaction,
          );
          await transaction.$executeRawUnsafe(
            `UPDATE "SalesOrder"
                SET "createdByStorefrontPartnerId"=$2,"paymentType"=$3,
                    "paymentTermsSnapshot"=$4,"freightResponsibility"=$5,
                    "carrierName"=$6,"customerReference"=$7,"updatedAt"=NOW()
              WHERE id=$1 AND "companyId"=$8`,
            order.id,
            partner.id,
            paymentType,
            paymentTermsSnapshot,
            deliveryMode,
            carrierName || null,
            customerReference,
            actor.companyId,
          );
          if (partnerEndCustomerId) {
            await transaction.$executeRawUnsafe(
              `UPDATE "SalesOrder" SET "partnerEndCustomerId"=$3
                WHERE id=$1 AND "companyId"=$2 AND "createdByStorefrontPartnerId"=$4`,
              order.id, actor.companyId, partnerEndCustomerId, partner.id,
            );
          }
          if (partner.portalAccessLevel === "DISTRIBUTOR" && requestedReadyDate) {
            await transaction.$executeRawUnsafe(
              `UPDATE "SalesOrder" SET "partnerRequestedReadyDate"=$3::timestamp
                WHERE id=$1 AND "companyId"=$2`,
              order.id,
              actor.companyId,
              requestedReadyDate,
            );
          }
          if (claimId) {
            const completed = await transaction.$executeRawUnsafe(
              `UPDATE "PartnerOrderSubmission"
                  SET status='COMPLETED',"salesOrderId"=$2,"completedAt"=NOW(),"updatedAt"=NOW()
                WHERE id=$1 AND "companyId"=$3 AND "partnerId"=$4 AND status='CLAIMED'`,
              claimId, order.id, actor.companyId, partner.id,
            );
            if (completed !== 1) throw new ConflictException("Envio do pedido não pôde ser confirmado.");
          }
          return { orderId: order.id, orderNumber, totalAmount: Number(order.totalAmount) };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          maxWait: 10_000,
          timeout: 30_000,
        },
      )
      .catch((error: unknown) => {
        if (error instanceof SignaSubmissionClaimedElsewhere) return null;
        throw error;
      });
    if (!created) {
      // Another request committed this key first: answer with its outcome.
      const previous = submission
        ? await this.replaySignaSubmission(actor, partner, submission)
        : null;
      if (previous) return previous;
      throw new ConflictException("Este pedido já está sendo enviado. Aguarde alguns segundos e atualize a lista.");
    }
    const { orderId, orderNumber } = created;
    await this.afterPartnerOrderCommitted(actor, partner, {
      orderId,
      orderNumber,
      paymentType,
      requestedDeliveryDate: body.expectedDeliveryDate || null,
    });
    return {
      id: orderId,
      code: orderNumber,
      status: "DRAFT",
      totalAmount: created.totalAmount,
      paymentType,
      paymentTermsSnapshot,
      replayed: false,
      message: this.partnerOrderMessage(partner),
    };
  }

  private partnerOrderMessage(partner: any) {
    return partner.portalAccessLevel === "DISTRIBUTOR"
      ? "Pedido enviado para aprovação de José ou Suzi. A data desejada será confirmada antes da liberação para produção."
      : "Pedido enviado para conferência da equipe Bispo.";
  }

  /**
   * Returns the original response for a repeated Signa submission, refuses a
   * reused key with a different payload, or null when the key is unused.
   */
  private async replaySignaSubmission(
    actor: PartnerActor,
    partner: any,
    submission: { key: string; hash: string; userId: string },
  ) {
    const rows = await this.database.$queryRawUnsafe<Array<{
      status: string; requestHash: string; salesOrderId: string | null;
    }>>(
      `SELECT status,"requestHash","salesOrderId" FROM "PartnerOrderSubmission"
        WHERE "companyId"=$1 AND "partnerId"=$2 AND "userId"=$3 AND "submissionKey"=$4
        LIMIT 1`,
      actor.companyId, partner.id, submission.userId, submission.key,
    );
    if (!rows[0]) return null;
    const decision = resolveSignaSubmissionReplay(rows[0], submission.hash);
    if (decision.kind === "payload-mismatch") {
      throw new ConflictException(
        "Este envio já foi usado para um pedido com outro conteúdo. Atualize a página e envie novamente.",
      );
    }
    if (decision.kind === "in-progress") {
      throw new ConflictException("Este pedido já está sendo enviado. Aguarde alguns segundos e atualize a lista.");
    }
    const orders = await this.database.$queryRawUnsafe<Array<{
      id: string; code: string; status: string; totalAmount: unknown;
      paymentType: string | null; paymentTermsSnapshot: string | null;
      partnerRequestedReadyDate: Date | null;
    }>>(
      `SELECT id,COALESCE("orderNumber",code) AS code,status::text AS status,"totalAmount",
              "paymentType"::text AS "paymentType","paymentTermsSnapshot","partnerRequestedReadyDate"
         FROM "SalesOrder"
        WHERE id=$1 AND "companyId"=$2 AND "createdByStorefrontPartnerId"=$3 LIMIT 1`,
      decision.salesOrderId, actor.companyId, partner.id,
    );
    const order = orders[0];
    if (!order) throw new ConflictException("Pedido original deste envio não está disponível.");
    // Completes any post-commit step interrupted by a timeout. All are idempotent.
    await this.afterPartnerOrderCommitted(actor, partner, {
      orderId: order.id,
      orderNumber: order.code,
      paymentType: order.paymentType === "TERM" ? "TERM" : "CASH",
      requestedDeliveryDate: order.partnerRequestedReadyDate
        ? order.partnerRequestedReadyDate.toISOString().slice(0, 10)
        : null,
    });
    return {
      id: order.id,
      code: order.code,
      status: order.status,
      totalAmount: Number(order.totalAmount),
      paymentType: order.paymentType,
      paymentTermsSnapshot: order.paymentTermsSnapshot,
      replayed: true,
      message: `Pedido ${order.code} já havia sido recebido. Nenhum pedido duplicado foi criado.`,
    };
  }

  /** Post-commit side effects. Each one is idempotent so a retry can re-run it. */
  private async afterPartnerOrderCommitted(
    actor: PartnerActor,
    partner: any,
    order: {
      orderId: string;
      orderNumber: string;
      paymentType: "CASH" | "TERM";
      requestedDeliveryDate: string | null;
    },
  ) {
    if (order.paymentType === "TERM") {
      await this.termApprovals.ensureForOrder(actor.companyId, order.orderId, {
        id: actor.id ?? partner.id,
        companyId: actor.companyId,
        name: String(actor.name ?? partner.contactName ?? partner.name),
        email: partner.email,
        role: actor.role,
      });
    }
    await this.customerLifecycle.record(
      order.orderId,
      "ORDER_SUBMITTED",
      "Pedido enviado para aprovação",
      `${partner.name} enviou o pedido ${order.orderNumber} para aprovação da Bispo Coffees.`,
      "BBOS",
      `partner-order:submitted:${order.orderId}`,
      {
        partnerId: partner.id,
        requestedDeliveryDate: order.requestedDeliveryDate,
      },
      false,
    );
    if (partner.portalAccessLevel === "DISTRIBUTOR") {
      const notificationMessage = `${partner.name} enviou o pedido ${order.orderNumber}. Confirme a data de entrega e aprove a liberação para produção.`;
      for (const targetRole of ["ADMIN", "EXECUTIVE"]) {
        const notificationType = `SALES_DISTRIBUTOR_ORDER:${order.orderId}:${targetRole}`;
        await this.database.$executeRawUnsafe(
          `INSERT INTO "OperationalNotification"
            (id,"companyId",type,title,message,"targetRole","createdAt")
           SELECT $1,$2,$3,$4,$5,$6,NOW()
            WHERE NOT EXISTS (
              SELECT 1 FROM "OperationalNotification"
               WHERE "companyId"=$2 AND type=$3 AND "targetRole"=$6
            )`,
          randomUUID(),
          actor.companyId,
          notificationType,
          "Pedido de distribuidor aguardando aprovação",
          notificationMessage,
          targetRole,
        );
      }
    }
  }
}
