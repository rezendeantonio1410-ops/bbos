import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function report() {
  const [orders, finishedProducts, movements] = await Promise.all([
    prisma.productionOrder.findMany({
      where: { productVariantId: null },
      select: { id: true, code: true, productName: true, sku: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.finishedProduct.findMany({
      where: { productVariantId: null },
      select: { id: true, name: true, sku: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.finishedGoodsMovement.findMany({
      where: { productVariantId: null },
      select: { id: true, productionOrderId: true, finishedProductId: true },
      orderBy: { occurredAt: "asc" },
    }),
  ]);
  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        unmappedProductionOrders: orders,
        unmappedFinishedProducts: finishedProducts,
        unmappedFinishedGoodsMovements: movements,
      },
      null,
      2,
    ),
  );
}

report().finally(() => prisma.$disconnect());
