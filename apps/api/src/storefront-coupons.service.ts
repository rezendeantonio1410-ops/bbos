import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaClient } from "@bbos/database";

export type CouponCalculation = {
  id: string;
  code: string;
  partnerId: string;
  ownerName: string;
  discountCents: number;
  commissionCents: number;
  netSubtotalCents: number;
};

const normalizedCode = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "");

@Injectable()
export class StorefrontCouponsService {
  private readonly database = new PrismaClient();

  normalize(value: unknown) {
    return normalizedCode(value);
  }

  async calculate(
    companyId: string,
    rawCode: unknown,
    subtotalCents: number,
  ): Promise<CouponCalculation> {
    const code = normalizedCode(rawCode);
    if (!code) throw new BadRequestException("Informe um cupom válido.");
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT c.*, b.name AS "ownerName"
         FROM "StorefrontCoupon" c
         JOIN "StorefrontPartner" b ON b.id=c."partnerId"
        WHERE c."companyId"=$1 AND c.code=$2
        LIMIT 1`,
      companyId,
      code,
    );
    const coupon = rows[0];
    const now = Date.now();
    if (!coupon || !coupon.active)
      throw new BadRequestException("Cupom inválido ou inativo.");
    if (coupon.validFrom && new Date(coupon.validFrom).getTime() > now)
      throw new BadRequestException("Este cupom ainda não está disponível.");
    if (coupon.validUntil && new Date(coupon.validUntil).getTime() < now)
      throw new BadRequestException("Este cupom expirou.");
    if (
      coupon.usageLimit != null &&
      Number(coupon.usageCount) >= Number(coupon.usageLimit)
    )
      throw new BadRequestException(
        "Este cupom atingiu o limite de utilizações.",
      );
    if (subtotalCents < Number(coupon.minimumSubtotalCents || 0))
      throw new BadRequestException(
        "O valor mínimo deste cupom ainda não foi atingido.",
      );

    const discountCents = Math.min(
      subtotalCents,
      coupon.discountType === "PERCENT"
        ? Math.round((subtotalCents * Number(coupon.discountValue)) / 100)
        : Math.round(Number(coupon.discountValue) * 100),
    );
    const netSubtotalCents = subtotalCents - discountCents;
    const commissionBase =
      coupon.commissionBasis === "GROSS_SUBTOTAL"
        ? subtotalCents
        : netSubtotalCents;
    const commissionCents =
      coupon.commissionType === "PERCENT"
        ? Math.round((commissionBase * Number(coupon.commissionValue)) / 100)
        : Math.round(Number(coupon.commissionValue) * 100);
    return {
      id: coupon.id,
      code,
      partnerId: coupon.partnerId,
      ownerName: coupon.ownerName,
      discountCents,
      commissionCents,
      netSubtotalCents,
    };
  }
}
