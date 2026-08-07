import { PrismaClient } from "@prisma/client";
import { seedProductCatalog } from "./seed-product-catalog";

const prisma = new PrismaClient();

seedProductCatalog(prisma)
  .then((lines) =>
    console.log(
      `Catálogo persistido: ${lines.length} linhas, ${lines.reduce((sum, line) => sum + line.products.length, 0)} produtos e ${lines.reduce((sum, line) => sum + line.products.reduce((subtotal, product) => subtotal + product.variants.length, 0), 0)} SKUs.`,
    ),
  )
  .finally(() => prisma.$disconnect());
