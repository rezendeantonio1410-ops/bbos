import { Controller, ForbiddenException, Get, Req } from "@nestjs/common";
import { prisma } from "@bbos/database";

type PartnerActor = {
  companyId: string;
  role: string;
  storefrontPartnerId?: string | null;
};

@Controller("partner-portal")
export class PartnerPortalController {
  private readonly database = prisma;

  @Get("summary")
  async summary(@Req() request: { user?: PartnerActor }) {
    const actor = request.user;
    if (!actor || actor.role !== "PARTNER" || !actor.storefrontPartnerId) {
      throw new ForbiddenException("Acesso restrito ao parceiro de venda.");
    }

    const partners = await this.database.$queryRawUnsafe<any[]>(
      `SELECT id,name,"contactName",email,phone,"pixKey",active
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

    const [metricsRows, coupons, businesses] = await Promise.all([
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
    ]);

    return {
      partner,
      metrics: metricsRows[0] ?? {
        businessCount: 0,
        salesCents: 0,
        commissionEarnedCents: 0,
        commissionPaidCents: 0,
        commissionOpenCents: 0,
      },
      coupons,
      businesses,
      updatedAt: new Date().toISOString(),
    };
  }
}
