import {
  BadRequestException,
  Injectable,
  type OnModuleDestroy,
} from "@nestjs/common";
import { PrismaClient, type Prisma } from "@bbos/database";
import {
  validateProductionVariantEligibility,
  // @ts-expect-error Nest uses legacy Node resolution; runtime resolves the package export.
} from "@bbos/shared/product-presentation";

@Injectable()
export class ProductionService implements OnModuleDestroy {
  readonly database = new PrismaClient();

  onModuleDestroy() {
    return this.database.$disconnect();
  }

  async requireActiveVariant(
    transaction: Prisma.TransactionClient,
    productVariantId: string | undefined,
  ) {
    if (!productVariantId)
      throw new BadRequestException(
        "Selecione uma apresentação/SKU válida do catálogo.",
      );
    const variant = await transaction.productVariant.findUnique({
      where: { id: productVariantId },
      include: { product: { include: { productLine: true } } },
    });
    try {
      return validateProductionVariantEligibility(variant);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "SKU inválido.",
      );
    }
  }
}
