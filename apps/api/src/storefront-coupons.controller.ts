import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { prisma } from "@bbos/database";
import { randomUUID } from "node:crypto";
import { AuthService } from "./auth.service";
import { Public } from "./auth.guard";
import {
  couponHasLinkedBusiness,
  StorefrontCouponsService,
} from "./storefront-coupons.service";

@Controller("storefront/coupons")
export class StorefrontCouponsController {
  private readonly database = prisma;
  constructor(
    private readonly auth: AuthService,
    private readonly coupons: StorefrontCouponsService,
  ) {}

  private async actor(request: any) {
    const actor = await this.auth.resolve(this.auth.readToken(request));
    if (!actor) throw new UnauthorizedException("Sessão inválida.");
    return actor;
  }

  private async storefrontCompanyId() {
    const configured = process.env.STOREFRONT_COMPANY_ID?.trim();
    if (configured) return configured;
    const companies = await this.database.company.findMany({
      select: { id: true },
      take: 2,
    });
    if (companies.length !== 1)
      throw new BadRequestException("A empresa da loja não está configurada.");
    return companies[0]!.id;
  }

  private async ensureNoLinkedBusiness(couponId: string, companyId: string) {
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT
         EXISTS(
           SELECT 1 FROM "StorefrontOrder"
            WHERE "couponId"=$1 AND "companyId"=$2
         ) AS "hasLinkedOrder",
         EXISTS(
           SELECT 1 FROM "StorefrontCouponRedemption"
            WHERE "couponId"=$1 AND "companyId"=$2
         ) AS "hasRedemption"`,
      couponId,
      companyId,
    );
    if (couponHasLinkedBusiness(rows[0] ?? {}))
      throw new BadRequestException(
        "Este cupom já possui pedido ou negócio vinculado. Para preservar o histórico, ele pode apenas ser ativado ou desativado.",
      );
  }

  @Public()
  @Post("validate")
  async validate(@Body() body: { code?: string; subtotalCents?: number }) {
    const subtotalCents = Number(body.subtotalCents);
    if (!Number.isSafeInteger(subtotalCents) || subtotalCents < 0)
      throw new BadRequestException("Subtotal inválido.");
    const result = await this.coupons.calculate(
      await this.storefrontCompanyId(),
      body.code,
      subtotalCents,
    );
    return {
      code: result.code,
      discountCents: result.discountCents,
      netSubtotalCents: result.netSubtotalCents,
    };
  }

  @Get()
  async list(@Req() request: any) {
    const actor = await this.actor(request);
    return this.database.$queryRawUnsafe<any[]>(
      `SELECT c.*, b.name AS "ownerName", b.email AS "ownerEmail",
              COALESCE(SUM(r."commissionCents") FILTER (WHERE r.status IN ('RESERVED','PAYABLE','PAID')),0)::int AS "commissionTotalCents",
              COUNT(r.id)::int AS "redemptionCount",
              (SELECT COUNT(*)::int FROM "StorefrontOrder" o WHERE o."couponId"=c.id) AS "linkedOrderCount"
         FROM "StorefrontCoupon" c
         JOIN "StorefrontPartner" b ON b.id=c."partnerId"
         LEFT JOIN "StorefrontCouponRedemption" r ON r."couponId"=c.id
        WHERE c."companyId"=$1
        GROUP BY c.id,b.name,b.email
        ORDER BY c."createdAt" DESC`,
      actor.companyId,
    );
  }

  @Post()
  async create(@Req() request: any, @Body() body: Record<string, any>) {
    const actor = await this.actor(request);
    const code = this.coupons.normalize(body.code);
    if (!code || !body.partnerId)
      throw new BadRequestException(
        "Informe o código e o parceiro proprietário do cupom.",
      );
    const discountValue = Number(body.discountValue);
    const commissionValue = Number(body.commissionValue);
    const discountType = body.discountType === "FIXED" ? "FIXED" : "PERCENT";
    const commissionType =
      body.commissionType === "FIXED" ? "FIXED" : "PERCENT";
    if (
      !Number.isFinite(discountValue) ||
      discountValue < 0 ||
      !Number.isFinite(commissionValue) ||
      commissionValue < 0
    )
      throw new BadRequestException(
        "Desconto e comissão devem ser valores válidos.",
      );
    if (discountType === "PERCENT" && discountValue > 100)
      throw new BadRequestException(
        "O desconto percentual ao cliente deve estar entre 0% e 100%.",
      );
    if (commissionType === "PERCENT" && commissionValue > 100)
      throw new BadRequestException(
        "A comissão percentual do parceiro deve estar entre 0% e 100%.",
      );
    const partners = await this.database.$queryRawUnsafe<any[]>(
      `SELECT id FROM "StorefrontPartner" WHERE id=$1 AND "companyId"=$2 AND active=true LIMIT 1`,
      body.partnerId,
      actor.companyId,
    );
    if (!partners[0])
      throw new BadRequestException(
        "Parceiro proprietário do cupom não encontrado.",
      );
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `INSERT INTO "StorefrontCoupon"
        (id,"companyId","partnerId",code,description,"discountType","discountValue","commissionType","commissionValue","commissionBasis","minimumSubtotalCents","usageLimit","validFrom","validUntil",active,"createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW(),NOW()) RETURNING *`,
      randomUUID(),
      actor.companyId,
      partners[0].id,
      code,
      body.description?.trim() || null,
      discountType,
      discountValue,
      commissionType,
      commissionValue,
      body.commissionBasis === "GROSS_SUBTOTAL"
        ? "GROSS_SUBTOTAL"
        : "NET_SUBTOTAL",
      Math.max(0, Number(body.minimumSubtotalCents || 0)),
      body.usageLimit ? Number(body.usageLimit) : null,
      body.validFrom ? new Date(body.validFrom) : null,
      body.validUntil ? new Date(body.validUntil) : null,
      body.active !== false,
    );
    return rows[0];
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Req() request: any,
    @Body() body: Record<string, any>,
  ) {
    const actor = await this.actor(request);
    const current = await this.database.$queryRawUnsafe<any[]>(
      `SELECT * FROM "StorefrontCoupon" WHERE id=$1 AND "companyId"=$2`,
      id,
      actor.companyId,
    );
    if (!current[0]) throw new BadRequestException("Cupom não encontrado.");
    const editableFields = [
      "code",
      "partnerId",
      "description",
      "discountType",
      "discountValue",
      "commissionType",
      "commissionValue",
      "commissionBasis",
      "minimumSubtotalCents",
      "usageLimit",
      "validFrom",
      "validUntil",
    ];
    const changesCommercialRule = editableFields.some((field) =>
      Object.prototype.hasOwnProperty.call(body, field),
    );
    if (changesCommercialRule)
      await this.ensureNoLinkedBusiness(id, actor.companyId);

    const code =
      body.code === undefined
        ? current[0].code
        : this.coupons.normalize(body.code);
    const partnerId = body.partnerId ?? current[0].partnerId;
    const discountType =
      body.discountType === undefined
        ? current[0].discountType
        : body.discountType === "FIXED"
          ? "FIXED"
          : "PERCENT";
    const commissionType =
      body.commissionType === undefined
        ? current[0].commissionType
        : body.commissionType === "FIXED"
          ? "FIXED"
          : "PERCENT";
    const discountValue = Number(
      body.discountValue ?? current[0].discountValue,
    );
    const commissionValue = Number(
      body.commissionValue ?? current[0].commissionValue,
    );
    if (!code)
      throw new BadRequestException("Informe um código de cupom válido.");
    if (
      !Number.isFinite(discountValue) ||
      discountValue < 0 ||
      !Number.isFinite(commissionValue) ||
      commissionValue < 0
    )
      throw new BadRequestException(
        "Desconto e comissão devem ser valores válidos.",
      );
    if (discountType === "PERCENT" && discountValue > 100)
      throw new BadRequestException(
        "O desconto percentual ao cliente deve estar entre 0% e 100%.",
      );
    if (commissionType === "PERCENT" && commissionValue > 100)
      throw new BadRequestException(
        "A comissão percentual do parceiro deve estar entre 0% e 100%.",
      );
    const partners = await this.database.$queryRawUnsafe<any[]>(
      `SELECT id FROM "StorefrontPartner" WHERE id=$1 AND "companyId"=$2 AND active=true LIMIT 1`,
      partnerId,
      actor.companyId,
    );
    if (!partners[0])
      throw new BadRequestException(
        "Parceiro proprietário do cupom não encontrado.",
      );
    const duplicateCodes = await this.database.$queryRawUnsafe<any[]>(
      `SELECT id FROM "StorefrontCoupon" WHERE "companyId"=$1 AND code=$2 AND id<>$3 LIMIT 1`,
      actor.companyId,
      code,
      id,
    );
    if (duplicateCodes[0])
      throw new BadRequestException("Já existe outro cupom com este código.");

    const minimumSubtotalCents = Math.max(
      0,
      Number(body.minimumSubtotalCents ?? current[0].minimumSubtotalCents ?? 0),
    );
    const usageLimit =
      body.usageLimit === undefined
        ? current[0].usageLimit
        : body.usageLimit
          ? Number(body.usageLimit)
          : null;
    if (
      !Number.isSafeInteger(minimumSubtotalCents) ||
      (usageLimit !== null &&
        (!Number.isSafeInteger(usageLimit) || usageLimit < 1))
    )
      throw new BadRequestException(
        "Subtotal mínimo ou limite de usos inválido.",
      );

    const rows = await this.database.$queryRawUnsafe<any[]>(
      `UPDATE "StorefrontCoupon" SET
         code=$3, "partnerId"=$4, description=$5,
         "discountType"=$6, "discountValue"=$7,
         "commissionType"=$8, "commissionValue"=$9, "commissionBasis"=$10,
         "minimumSubtotalCents"=$11, "usageLimit"=$12,
         "validFrom"=$13, "validUntil"=$14,
         active=COALESCE($15,active), "updatedAt"=NOW()
       WHERE id=$1 AND "companyId"=$2 RETURNING *`,
      id,
      actor.companyId,
      code,
      partners[0].id,
      body.description === undefined
        ? current[0].description
        : body.description?.trim() || null,
      discountType,
      discountValue,
      commissionType,
      commissionValue,
      body.commissionBasis === undefined
        ? current[0].commissionBasis
        : body.commissionBasis === "GROSS_SUBTOTAL"
          ? "GROSS_SUBTOTAL"
          : "NET_SUBTOTAL",
      minimumSubtotalCents,
      usageLimit,
      body.validFrom === undefined
        ? current[0].validFrom
        : body.validFrom
          ? new Date(body.validFrom)
          : null,
      body.validUntil === undefined
        ? current[0].validUntil
        : body.validUntil
          ? new Date(body.validUntil)
          : null,
      body.active === undefined ? null : Boolean(body.active),
    );
    return rows[0];
  }

  @Delete(":id")
  async remove(@Param("id") id: string, @Req() request: any) {
    const actor = await this.actor(request);
    const current = await this.database.$queryRawUnsafe<any[]>(
      `SELECT id,code FROM "StorefrontCoupon" WHERE id=$1 AND "companyId"=$2`,
      id,
      actor.companyId,
    );
    if (!current[0]) throw new BadRequestException("Cupom não encontrado.");
    await this.ensureNoLinkedBusiness(id, actor.companyId);
    await this.database.$executeRawUnsafe(
      `DELETE FROM "StorefrontCoupon" WHERE id=$1 AND "companyId"=$2`,
      id,
      actor.companyId,
    );
    return { deleted: true, id, code: current[0].code };
  }
}
