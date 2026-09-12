import { Controller, Get, Req, type OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@bbos/database";

@Controller("sales-orders")
export class SalesOrderCatalogOptionsController implements OnModuleDestroy {
  private readonly database = new PrismaClient();

  onModuleDestroy() {
    return this.database.$disconnect();
  }

  @Get("options")
  async options(@Req() request: any) {
    const companyId = request.user?.companyId as string | undefined;

    const customers = await this.database.customer.findMany({
      where: companyId ? { companyId } : undefined,
      orderBy: { name: "asc" },
    });

    const variants = await this.database.productVariant.findMany({
      where: {
        active: true,
        product: {
          active: true,
          productLine: {
            active: true,
            ...(companyId ? { companyId } : {}),
          },
        },
      },
      include: {
        product: { include: { productLine: true } },
      },
      orderBy: [{ product: { name: "asc" } }, { netWeightGrams: "asc" }],
    });

    const ids = variants.map((variant) => variant.id);
    const balances = ids.length
      ? await this.database.finishedProduct.findMany({
          where: { productVariantId: { in: ids } },
          include: { warehouse: true },
        })
      : [];

    const byVariant = new Map<
      string,
      {
        physicalStock: number;
        reservedStock: number;
        warehouseId: string;
        warehouse: string;
      }
    >();

    for (const balance of balances) {
      if (!balance.productVariantId) continue;
      const current = byVariant.get(balance.productVariantId) ?? {
        physicalStock: 0,
        reservedStock: 0,
        warehouseId: balance.warehouseId,
        warehouse: balance.warehouse.name,
      };
      current.physicalStock += balance.quantityOnHand;
      current.reservedStock += balance.reservedQuantity;
      byVariant.set(balance.productVariantId, current);
    }

    return {
      customers,
      variants: variants.map((variant) => {
        const stock = byVariant.get(variant.id);
        const physicalStock = stock?.physicalStock ?? 0;
        const reservedStock = stock?.reservedStock ?? 0;
        return {
          productVariantId: variant.id,
          warehouseId: stock?.warehouseId ?? "",
          warehouse: stock?.warehouse ?? "Sem saldo registrado",
          line: variant.product.productLine.name,
          lineCode: variant.product.productLine.code,
          product: variant.product.name,
          sku: variant.sku,
          presentationGrams: variant.netWeightGrams,
          salesUnit: variant.salesUnit,
          physicalStock,
          reservedStock,
          availableStock: Math.max(0, physicalStock - reservedStock),
        };
      }),
    };
  }
}
