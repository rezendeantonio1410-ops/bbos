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

  @Get("dashboard")
  dashboard(@Query("companyId") companyId?: string) { return this.commerce.dashboard(companyId); }

  @Get("channels")
  channels(@Query("companyId") companyId?: string) { return this.commerce.listChannels(companyId); }

  @Post("channels")
  createChannel(@Body() body: Parameters<CommerceService["createChannel"]>[0]) { return this.commerce.createChannel(body); }

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
  createPrice(@Body() body: Parameters<CommerceService["createPrice"]>[0]) { return this.commerce.createPrice(body); }

  @Patch("prices/:id")
  async updateInternalPrice(
    @Param("id") id: string,
    @Req() request: any,
    @Body() body: {
      price?: number;
      maxRequestDiscountPercent?: number;
      maxApprovalDiscountPercent?: number;
      minimumPrice?: number | null;
      minimumMarginPercent?: number | null;
      minimumRoiPercent?: number | null;
    },
  ) {
    const actor = await this.actor(request);
    if (!["ADMIN", "EXECUTIVE"].includes(actor.role)) {
      throw new UnauthorizedException("A política interna de preços é restrita à administração/diretoria.");
    }
    const currentRows = await this.commerce.database.$queryRawUnsafe<any[]>(
      `SELECT * FROM "ProductPrice" WHERE id=$1 AND "companyId"=$2`,
      id,
      actor.companyId,
    );
    const current = currentRows[0];
    if (!current) throw new BadRequestException("Linha de preço não encontrada.");

    const price = body.price === undefined ? Number(current.price) : Number(body.price);
    const maxRequest = body.maxRequestDiscountPercent === undefined
      ? Number(current.maxRequestDiscountPercent ?? 0)
      : Number(body.maxRequestDiscountPercent);
    const maxApproval = body.maxApprovalDiscountPercent === undefined
      ? Number(current.maxApprovalDiscountPercent ?? 0)
      : Number(body.maxApprovalDiscountPercent);
    const minimumPrice = body.minimumPrice === undefined
      ? (current.minimumPrice == null ? null : Number(current.minimumPrice))
      : (body.minimumPrice == null ? null : Number(body.minimumPrice));
    const minimumMargin = body.minimumMarginPercent === undefined
      ? (current.minimumMarginPercent == null ? null : Number(current.minimumMarginPercent))
      : (body.minimumMarginPercent == null ? null : Number(body.minimumMarginPercent));
    const minimumRoi = body.minimumRoiPercent === undefined
      ? (current.minimumRoiPercent == null ? null : Number(current.minimumRoiPercent))
      : (body.minimumRoiPercent == null ? null : Number(body.minimumRoiPercent));

    if (!Number.isFinite(price) || price < 0) throw new BadRequestException("Preço inválido.");
    if (!Number.isFinite(maxRequest) || maxRequest < 0 || maxRequest > 100) throw new BadRequestException("Limite de solicitação de desconto inválido.");
    if (!Number.isFinite(maxApproval) || maxApproval < 0 || maxApproval > 100) throw new BadRequestException("Limite de aprovação de desconto inválido.");
    if (maxApproval > maxRequest) throw new BadRequestException("O limite aprovável não pode ser maior que o limite máximo solicitável.");
    if (minimumPrice !== null && (!Number.isFinite(minimumPrice) || minimumPrice < 0 || minimumPrice > price)) {
      throw new BadRequestException("O preço mínimo deve estar entre zero e o preço oficial.");
    }
    if (minimumMargin !== null && (!Number.isFinite(minimumMargin) || minimumMargin < 0 || minimumMargin > 100)) {
      throw new BadRequestException("Margem mínima inválida.");
    }
    if (minimumRoi !== null && (!Number.isFinite(minimumRoi) || minimumRoi < 0)) {
      throw new BadRequestException("ROI mínimo inválido.");
    }

    const rows = await this.commerce.database.$queryRawUnsafe<any[]>(
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
    return rows[0];
  }
}
