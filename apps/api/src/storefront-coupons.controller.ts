import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Req, UnauthorizedException } from "@nestjs/common";
import { PrismaClient } from "@bbos/database";
import { randomUUID } from "node:crypto";
import { AuthService } from "./auth.service";
import { Public } from "./auth.guard";
import { StorefrontCouponsService } from "./storefront-coupons.service";

@Controller("storefront/coupons")
export class StorefrontCouponsController {
  private readonly database = new PrismaClient();
  constructor(private readonly auth: AuthService, private readonly coupons: StorefrontCouponsService) {}

  private async actor(request: any) {
    const actor = await this.auth.resolve(this.auth.readToken(request));
    if (!actor) throw new UnauthorizedException("Sessão inválida.");
    return actor;
  }

  private async storefrontCompanyId() {
    const configured = process.env.STOREFRONT_COMPANY_ID?.trim();
    if (configured) return configured;
    const companies = await this.database.company.findMany({ select: { id: true }, take: 2 });
    if (companies.length !== 1) throw new BadRequestException("A empresa da loja não está configurada.");
    return companies[0]!.id;
  }

  @Public()
  @Post("validate")
  async validate(@Body() body: { code?: string; subtotalCents?: number }) {
    const subtotalCents = Number(body.subtotalCents);
    if (!Number.isSafeInteger(subtotalCents) || subtotalCents < 0)
      throw new BadRequestException("Subtotal inválido.");
    const result = await this.coupons.calculate(await this.storefrontCompanyId(), body.code, subtotalCents);
    return { code: result.code, discountCents: result.discountCents, netSubtotalCents: result.netSubtotalCents };
  }

  @Get()
  async list(@Req() request: any) {
    const actor = await this.actor(request);
    return this.database.$queryRawUnsafe<any[]>(
      `SELECT c.*, b.name AS "ownerName", b.email AS "ownerEmail",
              COALESCE(SUM(r."commissionCents") FILTER (WHERE r.status IN ('RESERVED','PAYABLE','PAID')),0)::int AS "commissionTotalCents",
              COUNT(r.id)::int AS "redemptionCount"
         FROM "StorefrontCoupon" c
         JOIN "Broker" b ON b.id=c."brokerId"
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
    if (!code || !body.brokerId) throw new BadRequestException("Informe o código e o proprietário do cupom.");
    const discountValue = Number(body.discountValue);
    const commissionValue = Number(body.commissionValue);
    if (!Number.isFinite(discountValue) || discountValue < 0 || !Number.isFinite(commissionValue) || commissionValue < 0)
      throw new BadRequestException("Desconto e comissão devem ser valores válidos.");
    const broker = await this.database.broker.findFirst({ where: { id: body.brokerId, companyId: actor.companyId, active: true } });
    if (!broker) throw new BadRequestException("Proprietário do cupom não encontrado.");
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `INSERT INTO "StorefrontCoupon"
        (id,"companyId","brokerId",code,description,"discountType","discountValue","commissionType","commissionValue","commissionBasis","minimumSubtotalCents","usageLimit","validFrom","validUntil",active,"createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW(),NOW()) RETURNING *`,
      randomUUID(), actor.companyId, broker.id, code, body.description?.trim() || null,
      body.discountType === "FIXED" ? "FIXED" : "PERCENT", discountValue,
      body.commissionType === "FIXED" ? "FIXED" : "PERCENT", commissionValue,
      body.commissionBasis === "GROSS_SUBTOTAL" ? "GROSS_SUBTOTAL" : "NET_SUBTOTAL",
      Math.max(0, Number(body.minimumSubtotalCents || 0)), body.usageLimit ? Number(body.usageLimit) : null,
      body.validFrom ? new Date(body.validFrom) : null, body.validUntil ? new Date(body.validUntil) : null,
      body.active !== false,
    );
    return rows[0];
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Req() request: any, @Body() body: Record<string, any>) {
    const actor = await this.actor(request);
    const current = await this.database.$queryRawUnsafe<any[]>(`SELECT * FROM "StorefrontCoupon" WHERE id=$1 AND "companyId"=$2`, id, actor.companyId);
    if (!current[0]) throw new BadRequestException("Cupom não encontrado.");
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `UPDATE "StorefrontCoupon" SET
         description=COALESCE($3,description), active=COALESCE($4,active), "validUntil"=$5, "usageLimit"=$6, "updatedAt"=NOW()
       WHERE id=$1 AND "companyId"=$2 RETURNING *`,
      id, actor.companyId, body.description === undefined ? current[0].description : body.description?.trim() || null,
      body.active === undefined ? null : Boolean(body.active),
      body.validUntil === undefined ? current[0].validUntil : body.validUntil ? new Date(body.validUntil) : null,
      body.usageLimit === undefined ? current[0].usageLimit : body.usageLimit ? Number(body.usageLimit) : null,
    );
    return rows[0];
  }
}
