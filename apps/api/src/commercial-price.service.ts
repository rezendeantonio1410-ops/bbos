import { BadRequestException, Injectable, type OnModuleDestroy } from "@nestjs/common";
import { CommercialPromotionStatus, PrismaClient, PriceTableStatus, SalesChannelType } from "@bbos/database";

export type CommercialPriceContext = {
  companyId: string;
  productVariantId: string;
  salesPersonId?: string;
  customerId?: string;
  region?: string;
  territory?: string;
  channel?: SalesChannelType;
  currency?: string;
  date?: Date;
};

@Injectable()
export class CommercialPriceService implements OnModuleDestroy {
  readonly database = new PrismaClient();
  onModuleDestroy() { return this.database.$disconnect(); }

  async resolve(context: CommercialPriceContext) {
    const at = context.date ?? new Date();
    const variant = await this.database.productVariant.findFirst({
      where: { id: context.productVariantId, active: true, product: { active: true, productLine: { active: true, companyId: context.companyId } } },
      include: { product: { include: { productLine: true } } },
    });
    if (!variant) throw new BadRequestException("SKU inválido ou não autorizado.");
    const tables = await this.database.priceTable.findMany({
      where: {
        companyId: context.companyId,
        status: PriceTableStatus.ACTIVE,
        validFrom: { lte: at },
        OR: [{ validTo: null }, { validTo: { gt: at } }],
        ...(context.channel ? { channel: context.channel } : {}),
        items: { some: { productVariantId: variant.id, active: true, validFrom: { lte: at }, OR: [{ validTo: null }, { validTo: { gt: at } }] } },
      },
      include: {
        items: { where: { productVariantId: variant.id, active: true, validFrom: { lte: at }, OR: [{ validTo: null }, { validTo: { gt: at } }] }, orderBy: { validFrom: "desc" }, take: 1 },
        assignments: { where: { validFrom: { lte: at }, OR: [{ validTo: null }, { validTo: { gt: at } }] } },
      },
      orderBy: { validFrom: "desc" },
    });
    const currency = context.currency?.toUpperCase();
    const ranked = tables.map((table) => {
      const assignment = table.assignments.find((item) => {
        if (item.customerId && item.customerId !== context.customerId) return false;
        if (item.salesPersonId && item.salesPersonId !== context.salesPersonId) return false;
        if (item.region && item.region !== context.region) return false;
        if (item.territory && item.territory !== context.territory) return false;
        if (item.channel && item.channel !== context.channel) return false;
        return true;
      });
      if (currency && table.currency.toUpperCase() !== currency) return null;
      if (table.salesChannelId && context.channel && table.channel !== context.channel) return null;
      const score = assignment ? (assignment.customerId ? 100 : 0) + (assignment.salesPersonId ? 80 : 0) + (assignment.territory ? 60 : 0) + (assignment.region ? 50 : 0) + (assignment.channel ? 40 : 0) : 1;
      return { table, item: table.items[0], score };
    }).filter(Boolean).sort((a, b) => (b!.score - a!.score) || (b!.table.validFrom.getTime() - a!.table.validFrom.getTime())) as Array<{ table: typeof tables[number]; item: typeof tables[number]["items"][number]; score: number }>;
    const chosen = ranked[0];
    if (chosen) {
      const promotion = await this.findPromotion(context, chosen.table.id, at);
      const base = Number(chosen.item.price);
      const promotionPrice = promotion?.promotionalPrice != null ? Number(promotion.promotionalPrice) : promotion?.discountPercent != null ? base * (1 - Number(promotion.discountPercent) / 100) : null;
      return { price: promotionPrice ?? base, listPrice: base, minimumPrice: chosen.item.minimumPrice == null ? null : Number(chosen.item.minimumPrice), priceTableId: chosen.table.id, source: promotionPrice != null ? "PROMOTION" : "PRICE_TABLE", validFrom: chosen.item.validFrom, validTo: chosen.item.validTo ?? chosen.table.validTo, promotion: promotion ? { id: promotion.id, name: promotion.name, price: promotionPrice } : null };
    }
    const fallback = await this.database.productPrice.findFirst({ where: { companyId: context.companyId, productVariantId: variant.id, active: true, ...(context.currency ? { currency: context.currency.toUpperCase() } : {}), validFrom: { lte: at }, OR: [{ validUntil: null }, { validUntil: { gt: at } }] }, orderBy: { validFrom: "desc" } });
    if (!fallback) return { price: null, listPrice: null, minimumPrice: null, priceTableId: null, source: "UNPRICED", validFrom: null, validTo: null, promotion: null };
    return { price: Number(fallback.price), listPrice: Number(fallback.price), minimumPrice: null, priceTableId: null, source: "PRODUCT_PRICE", validFrom: fallback.validFrom, validTo: fallback.validUntil, promotion: null };
  }

  private findPromotion(context: CommercialPriceContext, priceTableId: string, at: Date) {
    return this.database.commercialPromotion.findFirst({ where: { companyId: context.companyId, status: CommercialPromotionStatus.ACTIVE, validFrom: { lte: at }, validTo: { gt: at }, OR: [{ productVariantId: context.productVariantId }, { productVariantId: null }], AND: [{ OR: [{ priceTableId }, { priceTableId: null }] }, { OR: [{ customerId: context.customerId }, { customerId: null }] }, { OR: [{ salesPersonId: context.salesPersonId }, { salesPersonId: null }] }, { OR: [{ region: context.region }, { region: null }] }] }, orderBy: { updatedAt: "desc" } });
  }
}
