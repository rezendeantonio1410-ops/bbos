import {
  BadRequestException,
  Injectable,
  type OnModuleDestroy,
} from "@nestjs/common";
import { prisma, type Prisma } from "@bbos/database";
import {
  ROASTED_PRODUCT_LINES,
  validateProductionVariantEligibility,
  // @ts-expect-error Nest uses legacy Node resolution; runtime resolves the package export.
} from "@bbos/shared/product-presentation";

@Injectable()
export class ProductionService implements OnModuleDestroy {
  readonly database = prisma;

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

  async requireProductionProduct(
    transaction: Prisma.TransactionClient,
    productId: string | undefined,
  ) {
    if (!productId)
      throw new BadRequestException(
        "Selecione uma linha e um perfil de café válidos.",
      );
    const product = await transaction.product.findUnique({
      where: { id: productId },
      include: {
        productLine: true,
        variants: {
          where: { active: true },
          orderBy: [{ netWeightGrams: "desc" }, { sku: "asc" }],
        },
      },
    });
    if (!product || !product.active || !product.productLine.active)
      throw new BadRequestException("Linha ou perfil de café inativo.");
    if (
      !(ROASTED_PRODUCT_LINES as readonly string[]).includes(
        product.productLine.code,
      )
    )
      throw new BadRequestException(
        "A ordem de torra aceita somente linhas de café torrado.",
      );
    const normalizedName = product.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR");
    if (
      normalizedName.includes("white label") ||
      normalizedName.includes("private label") ||
      normalizedName.includes("marca branca")
    )
      throw new BadRequestException(
        "Private Label é uma destinação do pedido e da embalagem, não um perfil de torra.",
      );
    const variant = product.variants[0];
    if (!variant)
      throw new BadRequestException(
        "Este perfil ainda não possui referência fiscal ativa no catálogo.",
      );
    try {
      return {
        product,
        variant: validateProductionVariantEligibility({
          ...variant,
          product: {
            ...product,
            productLine: product.productLine,
          },
        }),
      };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Perfil de café inválido.",
      );
    }
  }
}
