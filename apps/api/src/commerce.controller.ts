import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { CommerceService } from "./commerce.service";
import { AuthService } from "./auth.service";

@Controller("commerce")
export class CommerceController {
  constructor(
    private readonly commerce: CommerceService,
    private readonly auth: AuthService,
  ) {}

  private async actor(request: any) {
    const actor = await this.auth.resolve(this.auth.readToken(request));
    if (!actor) throw new UnauthorizedException("Sessão inválida.");
    return actor;
  }

  private requireManagement(actor: any) {
    if (!["ADMIN", "EXECUTIVE"].includes(actor.role)) {
      throw new UnauthorizedException(
        "Alterações comerciais são restritas à Gestão.",
      );
    }
  }

  private async basePriceForCustomer(
    companyId: string,
    customerId: string,
    productVariantId: string,
  ) {
    const rows = await this.commerce.database.$queryRawUnsafe<any[]>(
      `SELECT pp.id AS "productPriceId", pp.price, pp.currency,
              pp."minimumPrice", pp."minimumMarginPercent", pp."minimumRoiPercent",
              sc.id AS "salesChannelId", sc.name AS "salesChannelName", sc.type AS "salesChannelType",
              pv."unitCost", c.segment
         FROM "Customer" c
         JOIN "ProductPrice" pp
           ON pp."companyId"=c."companyId"
          AND pp."productVariantId"=$3
         JOIN "SalesChannel" sc ON sc.id=pp."salesChannelId" AND sc.active=true
         JOIN "ProductVariant" pv ON pv.id=pp."productVariantId"
        WHERE c.id=$2 AND c."companyId"=$1
          AND pp.active=true
          AND (pp."validFrom" IS NULL OR pp."validFrom" <= NOW())
          AND (pp."validUntil" IS NULL OR pp."validUntil" >= NOW())
          AND (c.segment IS NULL OR c.segment NOT ILIKE '%varejo%' OR sc.code='VAREJO')
        ORDER BY CASE
          WHEN c.segment ILIKE '%distrib%' AND sc.type='DISTRIBUIDOR' THEN 0
          WHEN c.segment ILIKE '%cafeter%' AND sc.type='CAFETERIA' THEN 0
          WHEN c.segment ILIKE '%escrit%' AND sc.type='ESCRITORIO' THEN 0
          WHEN c.segment ILIKE '%export%' AND sc.type='EXPORTACAO' THEN 0
          WHEN c.segment ILIKE '%consum%' AND sc.code='CONSUMIDOR_FINAL' THEN 0
          WHEN c.segment ILIKE '%varejo%' AND sc.code='VAREJO' THEN 0
          WHEN sc.type='B2B' THEN 1
          ELSE 5
        END,
        pp."validFrom" DESC NULLS LAST,
        pp."createdAt" DESC
        LIMIT 1`,
      companyId,
      customerId,
      productVariantId,
    );
    return rows[0] ?? null;
  }

  @Get("dashboard")
  async dashboard(@Req() request: any) {
    const actor = await this.actor(request);
    return this.commerce.dashboard(actor.companyId);
  }

  @Get("channels")
  async channels(@Req() request: any) {
    const actor = await this.actor(request);
    return this.commerce.listChannels(actor.companyId);
  }

  @Get("multichannel")
  async multichannel(@Req() request: any) {
    const actor = await this.actor(request);
    return this.commerce.multichannel(actor.companyId);
  }

  @Post("channels")
  async createChannel(
    @Req() request: any,
    @Body() body: Parameters<CommerceService["createChannel"]>[0],
  ) {
    const actor = await this.actor(request);
    this.requireManagement(actor);
    return this.commerce.createChannel({ ...body, companyId: actor.companyId });
  }

  @Patch("channels/:id/connection")
  async updateChannelConnection(
    @Param("id") id: string,
    @Req() request: any,
    @Body()
    body: Parameters<CommerceService["updateChannelConnection"]>[2],
  ) {
    const actor = await this.actor(request);
    this.requireManagement(actor);
    return this.commerce.updateChannelConnection(actor.companyId, id, body);
  }

  @Get("prices")
  async prices(
    @Req() request: any,
    @Query() query: { salesChannelId?: string; productVariantId?: string },
  ) {
    const actor = await this.actor(request);
    return this.commerce.database.$queryRawUnsafe<any[]>(
      `SELECT pp.id, pp."companyId", pp."productVariantId", pp."salesChannelId", pp.currency, pp.price,
              pp.active, pp."validFrom", pp."validUntil", pp."createdAt", pp."updatedAt",
              pp."maxRequestDiscountPercent", pp."maxApprovalDiscountPercent",
              pp."minimumPrice", pp."minimumMarginPercent", pp."minimumRoiPercent",
              sc.code AS "channelCode", sc.name AS "channelName", sc.type AS "channelType",
              pv.sku, pv."netWeightGrams", p.name AS "productName", pl.name AS "lineName"
         FROM "ProductPrice" pp
         JOIN "SalesChannel" sc ON sc.id=pp."salesChannelId"
         JOIN "ProductVariant" pv ON pv.id=pp."productVariantId"
         JOIN "Product" p ON p.id=pv."productId"
         JOIN "ProductLine" pl ON pl.id=p."productLineId"
        WHERE pp."companyId"=$1
          AND ($2::text IS NULL OR pp."salesChannelId"=$2)
          AND ($3::text IS NULL OR pp."productVariantId"=$3)
        ORDER BY sc.name ASC, pl."sortOrder" ASC, p.name ASC, pv."netWeightGrams" ASC, pp."createdAt" DESC`,
      actor.companyId,
      query.salesChannelId || null,
      query.productVariantId || null,
    );
  }

  @Post("prices")
  async createPrice(
    @Req() request: any,
    @Body() body: Parameters<CommerceService["createPrice"]>[0],
  ) {
    const actor = await this.actor(request);
    this.requireManagement(actor);
    return this.commerce.createPrice({ ...body, companyId: actor.companyId });
  }

  @Get("customer-prices")
  async customerPrices(
    @Req() request: any,
    @Query("customerId") customerId: string,
  ) {
    const actor = await this.actor(request);
    if (!customerId)
      throw new BadRequestException(
        "Selecione um cliente para consultar os preços.",
      );
    const customers = await this.commerce.database.$queryRawUnsafe<any[]>(
      `SELECT id,name,"tradeName",segment,active
         FROM "Customer"
        WHERE id=$1 AND "companyId"=$2
        LIMIT 1`,
      customerId,
      actor.companyId,
    );
    const customer = customers[0];
    if (!customer) throw new BadRequestException("Cliente não encontrado.");

    const rows = await this.commerce.database.$queryRawUnsafe<any[]>(
      `SELECT pv.id AS "productVariantId", pv.sku, pv."netWeightGrams",
              p.name AS "productName", pl.name AS "lineName",
              bp."productPriceId", bp."salesChannelId", bp."salesChannelName", bp."salesChannelType",
              bp.currency, bp.price AS "channelPrice", bp."minimumPrice",
              bp."minimumMarginPercent", bp."minimumRoiPercent", bp."unitCost",
              cpp.id AS "customerProductPriceId", cpp.price AS "customerPrice",
              cpp.active AS "customerPriceActive", cpp."validFrom", cpp."validUntil", cpp.notes,
              CASE
                WHEN cpp.id IS NOT NULL AND cpp.active=true
                 AND (cpp."validFrom" IS NULL OR cpp."validFrom" <= NOW())
                 AND (cpp."validUntil" IS NULL OR cpp."validUntil" >= NOW())
                THEN cpp.price ELSE bp.price
              END AS "effectivePrice",
              CASE
                WHEN cpp.id IS NOT NULL AND cpp.active=true
                 AND (cpp."validFrom" IS NULL OR cpp."validFrom" <= NOW())
                 AND (cpp."validUntil" IS NULL OR cpp."validUntil" >= NOW())
                THEN 'CUSTOMER' ELSE 'CHANNEL'
              END AS "pricingSource"
         FROM "ProductVariant" pv
         JOIN "Product" p ON p.id=pv."productId" AND p.active=true
         JOIN "ProductLine" pl ON pl.id=p."productLineId" AND pl.active=true
         JOIN "Customer" c ON c.id=$2 AND c."companyId"=$1
         LEFT JOIN LATERAL (
           SELECT pp.id AS "productPriceId", pp.price, pp.currency,
                  pp."minimumPrice", pp."minimumMarginPercent", pp."minimumRoiPercent",
                  sc.id AS "salesChannelId", sc.name AS "salesChannelName", sc.type AS "salesChannelType",
                  pv."unitCost"
             FROM "ProductPrice" pp
             JOIN "SalesChannel" sc ON sc.id=pp."salesChannelId" AND sc.active=true
            WHERE pp."companyId"=$1 AND pp."productVariantId"=pv.id AND pp.active=true
              AND (pp."validFrom" IS NULL OR pp."validFrom" <= NOW())
              AND (pp."validUntil" IS NULL OR pp."validUntil" >= NOW())
              AND (c.segment IS NULL OR c.segment NOT ILIKE '%varejo%' OR sc.code='VAREJO')
            ORDER BY CASE
              WHEN c.segment ILIKE '%distrib%' AND sc.type='DISTRIBUIDOR' THEN 0
              WHEN c.segment ILIKE '%cafeter%' AND sc.type='CAFETERIA' THEN 0
              WHEN c.segment ILIKE '%escrit%' AND sc.type='ESCRITORIO' THEN 0
              WHEN c.segment ILIKE '%export%' AND sc.type='EXPORTACAO' THEN 0
              WHEN c.segment ILIKE '%consum%' AND sc.code='CONSUMIDOR_FINAL' THEN 0
              WHEN c.segment ILIKE '%varejo%' AND sc.code='VAREJO' THEN 0
              WHEN sc.type='B2B' THEN 1
              ELSE 5
            END,
            pp."validFrom" DESC NULLS LAST,
            pp."createdAt" DESC
            LIMIT 1
         ) bp ON TRUE
         LEFT JOIN "CustomerProductPrice" cpp
           ON cpp."companyId"=$1
          AND cpp."customerId"=c.id
          AND cpp."productVariantId"=pv.id
          AND cpp.currency=bp.currency
        WHERE pl."companyId"=$1 AND pv.active=true
        ORDER BY pl."sortOrder",p.name,pv."netWeightGrams"`,
      actor.companyId,
      customerId,
    );
    return { customer, prices: rows };
  }

  @Post("customer-prices")
  async setCustomerPrice(
    @Req() request: any,
    @Body()
    body: {
      customerId: string;
      productVariantId: string;
      price: number;
      validFrom?: string | null;
      validUntil?: string | null;
      notes?: string | null;
    },
  ) {
    const actor = await this.actor(request);
    this.requireManagement(actor);
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0)
      throw new BadRequestException("Informe um preço negociado válido.");
    const base = await this.basePriceForCustomer(
      actor.companyId,
      body.customerId,
      body.productVariantId,
    );
    if (!base)
      throw new BadRequestException(
        "Defina primeiro o preço do perfil comercial deste cliente para o SKU.",
      );
    const minimumPrice =
      base.minimumPrice == null ? null : Number(base.minimumPrice);
    if (minimumPrice !== null && price < minimumPrice) {
      throw new BadRequestException(
        `O preço negociado não pode ficar abaixo do mínimo de ${Number(minimumPrice).toLocaleString("pt-BR", { style: "currency", currency: base.currency })}.`,
      );
    }
    const unitCost = Number(base.unitCost ?? 0);
    const marginPercent =
      price > 0 ? ((price - unitCost) / price) * 100 : -Infinity;
    const roiPercent =
      unitCost > 0 ? ((price - unitCost) / unitCost) * 100 : Infinity;
    if (
      base.minimumMarginPercent != null &&
      marginPercent < Number(base.minimumMarginPercent)
    ) {
      throw new BadRequestException(
        `Preço bloqueado: margem ${marginPercent.toFixed(1)}% abaixo do mínimo ${Number(base.minimumMarginPercent).toFixed(1)}%.`,
      );
    }
    if (
      base.minimumRoiPercent != null &&
      roiPercent < Number(base.minimumRoiPercent)
    ) {
      throw new BadRequestException(
        `Preço bloqueado: ROI ${roiPercent.toFixed(1)}% abaixo do mínimo ${Number(base.minimumRoiPercent).toFixed(1)}%.`,
      );
    }
    const validFrom = body.validFrom ? new Date(body.validFrom) : null;
    const validUntil = body.validUntil ? new Date(body.validUntil) : null;
    if (validFrom && Number.isNaN(validFrom.getTime()))
      throw new BadRequestException("Data inicial inválida.");
    if (validUntil && Number.isNaN(validUntil.getTime()))
      throw new BadRequestException("Data final inválida.");
    if (validFrom && validUntil && validUntil < validFrom)
      throw new BadRequestException(
        "A validade final não pode ser anterior à inicial.",
      );

    const currentRows = await this.commerce.database.$queryRawUnsafe<any[]>(
      `SELECT * FROM "CustomerProductPrice"
        WHERE "companyId"=$1 AND "customerId"=$2 AND "productVariantId"=$3 AND currency=$4
        LIMIT 1`,
      actor.companyId,
      body.customerId,
      body.productVariantId,
      base.currency,
    );
    const before = currentRows[0] ?? null;
    const id = before?.id ?? randomUUID();
    const notes = String(body.notes ?? "").trim() || null;
    const after = {
      price,
      currency: base.currency,
      active: true,
      validFrom: validFrom?.toISOString() ?? null,
      validUntil: validUntil?.toISOString() ?? null,
      notes,
      inheritedChannel: base.salesChannelName,
      inheritedProductPriceId: base.productPriceId,
    };
    return this.commerce.database.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<any[]>(
        `INSERT INTO "CustomerProductPrice"
          (id,"companyId","customerId","productVariantId",currency,price,active,"validFrom","validUntil",notes,"createdByName","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8,$9,$10,NOW(),NOW())
         ON CONFLICT ("customerId","productVariantId",currency)
         DO UPDATE SET price=EXCLUDED.price,active=true,"validFrom"=EXCLUDED."validFrom",
                       "validUntil"=EXCLUDED."validUntil",notes=EXCLUDED.notes,"updatedAt"=NOW()
         RETURNING *`,
        id,
        actor.companyId,
        body.customerId,
        body.productVariantId,
        base.currency,
        price,
        validFrom,
        validUntil,
        notes,
        actor.name,
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO "CustomerProductPriceEvent"
          (id,"companyId","customerProductPriceId","actorId","actorName","actorRole",action,"beforeSnapshot","afterSnapshot","createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,NOW())`,
        randomUUID(),
        actor.companyId,
        rows[0].id,
        actor.id,
        actor.name,
        actor.role,
        before ? "UPDATE" : "CREATE",
        before ? JSON.stringify(before) : null,
        JSON.stringify(after),
      );
      return { ...rows[0], inheritedChannel: base.salesChannelName };
    });
  }

  @Patch("customer-prices/:id")
  async updateCustomerPriceStatus(
    @Param("id") id: string,
    @Req() request: any,
    @Body() body: { active: boolean },
  ) {
    const actor = await this.actor(request);
    this.requireManagement(actor);
    if (typeof body.active !== "boolean")
      throw new BadRequestException("Status do preço negociado inválido.");
    const currentRows = await this.commerce.database.$queryRawUnsafe<any[]>(
      `SELECT * FROM "CustomerProductPrice" WHERE id=$1 AND "companyId"=$2`,
      id,
      actor.companyId,
    );
    const current = currentRows[0];
    if (!current)
      throw new BadRequestException("Preço negociado não encontrado.");
    return this.commerce.database.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<any[]>(
        `UPDATE "CustomerProductPrice" SET active=$3,"updatedAt"=NOW()
          WHERE id=$1 AND "companyId"=$2 RETURNING *`,
        id,
        actor.companyId,
        body.active,
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO "CustomerProductPriceEvent"
          (id,"companyId","customerProductPriceId","actorId","actorName","actorRole",action,"beforeSnapshot","afterSnapshot","createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,'STATUS',$7::jsonb,$8::jsonb,NOW())`,
        randomUUID(),
        actor.companyId,
        id,
        actor.id,
        actor.name,
        actor.role,
        JSON.stringify(current),
        JSON.stringify({ ...current, active: body.active }),
      );
      return rows[0];
    });
  }

  @Get("customer-prices/:id/history")
  async customerPriceHistory(@Param("id") id: string, @Req() request: any) {
    const actor = await this.actor(request);
    return this.commerce.database.$queryRawUnsafe<any[]>(
      `SELECT id,action,"actorName","actorRole","beforeSnapshot","afterSnapshot","createdAt"
         FROM "CustomerProductPriceEvent"
        WHERE "customerProductPriceId"=$1 AND "companyId"=$2
        ORDER BY "createdAt" DESC`,
      id,
      actor.companyId,
    );
  }

  @Get("prices/:id/history")
  async priceHistory(@Param("id") id: string, @Req() request: any) {
    const actor = await this.actor(request);
    return this.commerce.database.$queryRawUnsafe<any[]>(
      `SELECT id, "actorName", "actorRole", "beforeSnapshot", "afterSnapshot", "createdAt"
         FROM "PriceGovernanceEvent"
        WHERE "productPriceId"=$1 AND "companyId"=$2
        ORDER BY "createdAt" DESC`,
      id,
      actor.companyId,
    );
  }

  @Patch("prices/:id")
  async updateInternalPrice(
    @Param("id") id: string,
    @Req() request: any,
    @Body()
    body: {
      price?: number;
      maxRequestDiscountPercent?: number;
      maxApprovalDiscountPercent?: number;
      minimumPrice?: number | null;
      minimumMarginPercent?: number | null;
      minimumRoiPercent?: number | null;
    },
  ) {
    const actor = await this.actor(request);
    this.requireManagement(actor);

    const currentRows = await this.commerce.database.$queryRawUnsafe<any[]>(
      `SELECT * FROM "ProductPrice" WHERE id=$1 AND "companyId"=$2`,
      id,
      actor.companyId,
    );
    const current = currentRows[0];
    if (!current)
      throw new BadRequestException("Linha de preço não encontrada.");

    const price =
      body.price === undefined ? Number(current.price) : Number(body.price);
    const maxRequest =
      body.maxRequestDiscountPercent === undefined
        ? Number(current.maxRequestDiscountPercent ?? 0)
        : Number(body.maxRequestDiscountPercent);
    const maxApproval =
      body.maxApprovalDiscountPercent === undefined
        ? Number(current.maxApprovalDiscountPercent ?? 0)
        : Number(body.maxApprovalDiscountPercent);
    const minimumPrice =
      body.minimumPrice === undefined
        ? current.minimumPrice == null
          ? null
          : Number(current.minimumPrice)
        : body.minimumPrice == null
          ? null
          : Number(body.minimumPrice);
    const minimumMargin =
      body.minimumMarginPercent === undefined
        ? current.minimumMarginPercent == null
          ? null
          : Number(current.minimumMarginPercent)
        : body.minimumMarginPercent == null
          ? null
          : Number(body.minimumMarginPercent);
    const minimumRoi =
      body.minimumRoiPercent === undefined
        ? current.minimumRoiPercent == null
          ? null
          : Number(current.minimumRoiPercent)
        : body.minimumRoiPercent == null
          ? null
          : Number(body.minimumRoiPercent);

    if (!Number.isFinite(price) || price < 0)
      throw new BadRequestException("Preço inválido.");
    if (!Number.isFinite(maxRequest) || maxRequest < 0 || maxRequest > 100)
      throw new BadRequestException(
        "Limite de solicitação de desconto inválido.",
      );
    if (!Number.isFinite(maxApproval) || maxApproval < 0 || maxApproval > 100)
      throw new BadRequestException(
        "Limite de aprovação de desconto inválido.",
      );
    if (maxApproval > maxRequest)
      throw new BadRequestException(
        "O limite aprovável não pode ser maior que o limite máximo solicitável.",
      );
    if (
      minimumPrice !== null &&
      (!Number.isFinite(minimumPrice) ||
        minimumPrice < 0 ||
        minimumPrice > price)
    ) {
      throw new BadRequestException(
        "O preço mínimo deve estar entre zero e o preço oficial.",
      );
    }
    if (
      minimumMargin !== null &&
      (!Number.isFinite(minimumMargin) ||
        minimumMargin < 0 ||
        minimumMargin > 100)
    ) {
      throw new BadRequestException("Margem mínima inválida.");
    }
    if (
      minimumRoi !== null &&
      (!Number.isFinite(minimumRoi) || minimumRoi < 0)
    ) {
      throw new BadRequestException("ROI mínimo inválido.");
    }

    const beforeSnapshot = {
      price: Number(current.price),
      maxRequestDiscountPercent: Number(current.maxRequestDiscountPercent ?? 0),
      maxApprovalDiscountPercent: Number(
        current.maxApprovalDiscountPercent ?? 0,
      ),
      minimumPrice:
        current.minimumPrice == null ? null : Number(current.minimumPrice),
      minimumMarginPercent:
        current.minimumMarginPercent == null
          ? null
          : Number(current.minimumMarginPercent),
      minimumRoiPercent:
        current.minimumRoiPercent == null
          ? null
          : Number(current.minimumRoiPercent),
    };
    const afterSnapshot = {
      price,
      maxRequestDiscountPercent: maxRequest,
      maxApprovalDiscountPercent: maxApproval,
      minimumPrice,
      minimumMarginPercent: minimumMargin,
      minimumRoiPercent: minimumRoi,
    };

    return this.commerce.database.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<any[]>(
        `UPDATE "ProductPrice"
            SET price=$3,
                "maxRequestDiscountPercent"=$4,
                "maxApprovalDiscountPercent"=$5,
                "minimumPrice"=$6,
                "minimumMarginPercent"=$7,
                "minimumRoiPercent"=$8,
                "updatedAt"=NOW()
          WHERE id=$1 AND "companyId"=$2
          RETURNING *`,
        id,
        actor.companyId,
        price,
        maxRequest,
        maxApproval,
        minimumPrice,
        minimumMargin,
        minimumRoi,
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO "PriceGovernanceEvent"
          (id,"companyId","productPriceId","actorId","actorName","actorRole","beforeSnapshot","afterSnapshot","createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,NOW())`,
        randomUUID(),
        actor.companyId,
        id,
        actor.id,
        actor.name,
        actor.role,
        JSON.stringify(beforeSnapshot),
        JSON.stringify(afterSnapshot),
      );
      return rows[0];
    });
  }
}
