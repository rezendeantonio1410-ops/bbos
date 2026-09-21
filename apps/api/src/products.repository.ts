import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { Prisma, PrismaClient, type ProductLineCode } from "@bbos/database";
import {
  assertProductPresentationAllowed,
  normalizeProductCode,
  productSlug,
  validateCreateProductSku,
  type CatalogProduct,
  type CreateCatalogProductInput,
  type CreateProductVariantInput,
  type ProductLine,
  // @ts-expect-error Nest uses legacy Node resolution; runtime resolves the package export.
} from "@bbos/shared/product-presentation";

const productInclude = {
  productLine: true,
  variants: { where: { active: true }, orderBy: { netWeightGrams: "asc" as const } },
  storefrontImages: {
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      sortOrder: true,
      isPrimary: true,
      useInHero: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.ProductInclude;

type PersistedProduct = Prisma.ProductGetPayload<{
  include: typeof productInclude;
}>;

const OFFICIAL_LINES: Record<
  ProductLine,
  {
    name: string;
    slug: string;
    description: string;
    positioning: string;
    sortOrder: number;
  }
> = {
  RAROS: {
    name: "Raros",
    slug: "raros",
    description: "Microlotes de disponibilidade excepcional e expressão singular.",
    positioning: "Exclusividade e origem",
    sortOrder: 1,
  },
  EPICOS: {
    name: "Épicos",
    slug: "epicos",
    description: "Cafés de alta complexidade para experiências memoráveis.",
    positioning: "Experiência e descoberta",
    sortOrder: 2,
  },
  CLASSICOS: {
    name: "Clássicos",
    slug: "classicos",
    description: "Perfis consistentes para consumo recorrente e versátil.",
    positioning: "Consistência e equilíbrio",
    sortOrder: 3,
  },
  GOURMET: {
    name: "Gourmet",
    slug: "gourmet",
    description: "Cafés equilibrados com qualidade acessível e confiável.",
    positioning: "Qualidade cotidiana",
    sortOrder: 4,
  },
};

@Injectable()
export class ProductsRepository implements OnModuleDestroy {
  private readonly database = new PrismaClient();

  onModuleDestroy() {
    return this.database.$disconnect();
  }

  async listCatalog(companyId: string): Promise<CatalogProduct[]> {
    await this.ensureOfficialLines(this.database, companyId);
    const products = await this.database.product.findMany({
      where: { active: true, productLine: { companyId, active: true } },
      include: productInclude,
      orderBy: [{ productLine: { sortOrder: "asc" } }, { name: "asc" }],
    });
    return products.map((product) => this.toCatalogProduct(product));
  }

  async listLines(companyId: string) {
    await this.ensureOfficialLines(this.database, companyId);
    return this.database.productLine.findMany({
      where: { companyId, active: true },
      include: {
        products: {
          where: { active: true },
          include: { variants: { where: { active: true }, orderBy: { netWeightGrams: "asc" } } },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { sortOrder: "asc" },
    });
  }

  async findProduct(id: string, companyId: string) {
    const product = await this.database.product.findFirst({
      where: { id, active: true, productLine: { companyId, active: true } },
      include: productInclude,
    });
    return product ? this.toCatalogProduct(product) : null;
  }

  async createProduct(input: CreateCatalogProductInput, companyId: string) {
    const valid = validateCreateProductSku(input);
    return this.database.$transaction(
      async (transaction) => {
        await this.ensureOfficialLines(transaction, companyId);
        const line = await transaction.productLine.findUniqueOrThrow({
          where: {
            companyId_code: { companyId, code: valid.line as ProductLineCode },
          },
        });
        await this.assertVariantAvailable(
          transaction,
          valid.sku,
          valid.packageWeightG,
          line.id,
          valid.productName,
        );
        const slug = productSlug(valid.productName);
        const product = await transaction.product.upsert({
          where: { productLineId_slug: { productLineId: line.id, slug } },
          update: { active: input.active },
          create: {
            productLineId: line.id,
            code: normalizeProductCode(input.productCode || valid.productName),
            name: valid.productName,
            slug,
            description: input.description?.trim() || "",
            active: input.active,
          },
        });
        await transaction.productVariant.create({
          data: {
            productId: product.id,
            sku: valid.sku,
            netWeightGrams: valid.packageWeightG,
            salesUnit: input.commercialUnit,
            active: input.active,
          },
        });
        const result = await transaction.product.findUniqueOrThrow({
          where: { id: product.id },
          include: productInclude,
        });
        return this.toCatalogProduct(result);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async createVariant(productId: string, input: CreateProductVariantInput, companyId: string) {
    return this.database.$transaction(
      async (transaction) => {
        const product = await transaction.product.findUnique({
          where: { id: productId },
          include: { productLine: true },
        });
        if (!product || product.productLine.companyId !== companyId) throw new Error("Produto não encontrado.");
        assertProductPresentationAllowed(
          product.productLine.code as ProductLine,
          input.packageWeightG,
        );
        const sku = input.sku.trim().toLocaleUpperCase("pt-BR");
        if (!sku) throw new Error("SKU é obrigatório.");
        await this.assertVariantAvailable(
          transaction,
          sku,
          input.packageWeightG,
          product.productLineId,
          product.name,
        );
        await transaction.productVariant.create({
          data: {
            productId,
            sku,
            netWeightGrams: input.packageWeightG,
            salesUnit: input.commercialUnit,
            active: input.active,
          },
        });
        const result = await transaction.product.findUniqueOrThrow({
          where: { id: productId },
          include: productInclude,
        });
        return this.toCatalogProduct(result);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async updateProduct(
    id: string,
    input: { name?: string; description?: string; active?: boolean },
    companyId: string,
  ) {
    const data: Prisma.ProductUpdateInput = {
      active: input.active,
      description: input.description?.trim(),
    };
    if (input.name?.trim())
      Object.assign(data, {
        name: input.name.trim(),
        slug: productSlug(input.name),
        code: normalizeProductCode(input.name),
      });
    const current = await this.database.product.findFirst({ where: { id, productLine: { companyId } } });
    if (!current) throw new Error("Produto não encontrado.");
    const result = await this.database.product.update({
      where: { id: current.id },
      data,
      include: productInclude,
    });
    return this.toCatalogProduct(result);
  }

  async updateVariant(id: string, input: { active: boolean }, companyId: string) {
    const current = await this.database.productVariant.findFirst({ where: { id, product: { productLine: { companyId } } } });
    if (!current) throw new Error("Apresentação não encontrada.");
    return this.database.productVariant.update({
      where: { id: current.id },
      data: { active: input.active },
    });
  }

  async addStorefrontImage(
    productId: string,
    companyId: string,
    file: { originalname: string; mimetype: string; buffer: Buffer },
  ) {
    return this.database.$transaction(async (transaction) => {
      const product = await transaction.product.findFirst({
        where: { id: productId, productLine: { companyId } },
        include: { storefrontImages: { select: { id: true } } },
      });
      if (!product) throw new Error("Produto não encontrado.");
      const firstImage = product.storefrontImages.length === 0;
      const last = await transaction.storefrontProductImage.findFirst({
        where: { productId },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      const image = await transaction.storefrontProductImage.create({
        data: {
          productId,
          fileName: file.originalname,
          mimeType: file.mimetype,
          data: Uint8Array.from(file.buffer),
          sortOrder: (last?.sortOrder ?? -1) + 1,
          isPrimary: firstImage,
          useInHero: firstImage,
        },
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          sortOrder: true,
          isPrimary: true,
          useInHero: true,
          updatedAt: true,
        },
      });
      return { ...image, updatedAt: image.updatedAt.toISOString() };
    });
  }

  async updateStorefrontImage(
    productId: string,
    imageId: string,
    companyId: string,
    input: { isPrimary?: boolean; useInHero?: boolean; sortOrder?: number },
  ) {
    return this.database.$transaction(async (transaction) => {
      const current = await transaction.storefrontProductImage.findFirst({
        where: { id: imageId, productId, product: { productLine: { companyId } } },
      });
      if (!current) throw new Error("Imagem não encontrada.");
      if (input.isPrimary === true) {
        await transaction.storefrontProductImage.updateMany({
          where: { productId, id: { not: imageId } },
          data: { isPrimary: false },
        });
      }
      if (input.useInHero === true) {
        await transaction.storefrontProductImage.updateMany({
          where: { productId, id: { not: imageId } },
          data: { useInHero: false },
        });
      }
      const image = await transaction.storefrontProductImage.update({
        where: { id: imageId },
        data: {
          isPrimary: input.isPrimary,
          useInHero: input.useInHero,
          sortOrder: input.sortOrder,
        },
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          sortOrder: true,
          isPrimary: true,
          useInHero: true,
          updatedAt: true,
        },
      });
      return { ...image, updatedAt: image.updatedAt.toISOString() };
    });
  }

  async deleteStorefrontImage(productId: string, imageId: string, companyId: string) {
    return this.database.$transaction(async (transaction) => {
      const current = await transaction.storefrontProductImage.findFirst({
        where: { id: imageId, productId, product: { productLine: { companyId } } },
      });
      if (!current) throw new Error("Imagem não encontrada.");
      await transaction.storefrontProductImage.delete({ where: { id: imageId } });
      const next = await transaction.storefrontProductImage.findFirst({
        where: { productId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });
      if (next && (current.isPrimary || current.useInHero)) {
        await transaction.storefrontProductImage.update({
          where: { id: next.id },
          data: {
            isPrimary: current.isPrimary ? true : next.isPrimary,
            useInHero: current.useInHero ? true : next.useInHero,
          },
        });
      }
      return { deleted: true };
    });
  }

  async listPublicStorefrontImages(companyId: string) {
    const products = await this.database.product.findMany({
      where: { active: true, productLine: { companyId, active: true } },
      select: {
        id: true,
        name: true,
        slug: true,
        storefrontImages: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            fileName: true,
            mimeType: true,
            isPrimary: true,
            useInHero: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });
    return products.map((product) => ({
      ...product,
      storefrontImages: product.storefrontImages.map((image) => ({
        ...image,
        updatedAt: image.updatedAt.toISOString(),
      })),
    }));
  }

  async getPublicStorefrontImage(imageId: string, companyId: string) {
    return this.database.storefrontProductImage.findFirst({
      where: {
        id: imageId,
        product: { active: true, productLine: { companyId, active: true } },
      },
      select: { data: true, mimeType: true, fileName: true, updatedAt: true },
    });
  }

  private async ensureOfficialLines(
    database: Pick<PrismaClient, "productLine"> | Prisma.TransactionClient,
    companyId: string,
  ) {
    for (const [code, definition] of Object.entries(OFFICIAL_LINES) as [ProductLine, (typeof OFFICIAL_LINES)[ProductLine]][]) {
      await database.productLine.upsert({
        where: {
          companyId_code: { companyId, code: code as ProductLineCode },
        },
        update: {
          name: definition.name,
          slug: definition.slug,
          description: definition.description,
          positioning: definition.positioning,
          sortOrder: definition.sortOrder,
          active: true,
        },
        create: {
          companyId,
          code: code as ProductLineCode,
          name: definition.name,
          slug: definition.slug,
          description: definition.description,
          positioning: definition.positioning,
          sortOrder: definition.sortOrder,
          active: true,
        },
      });
    }
  }

  private async assertVariantAvailable(
    transaction: Prisma.TransactionClient,
    sku: string,
    weight: number,
    lineId: string,
    productName: string,
  ) {
    const duplicateSku = await transaction.productVariant.findUnique({
      where: { sku },
    });
    if (duplicateSku) throw new Error(`O SKU ${sku} já está cadastrado.`);
    const duplicatePresentation = await transaction.productVariant.findFirst({
      where: {
        netWeightGrams: weight,
        product: {
          productLineId: lineId,
          name: { equals: productName, mode: "insensitive" },
        },
      },
    });
    if (duplicatePresentation)
      throw new Error(
        `${productName} já possui a apresentação ${weight === 1000 ? "1 kg" : `${weight} g`}.`,
      );
  }

  private toCatalogProduct(product: PersistedProduct): CatalogProduct {
    const line = product.productLine.code as ProductLine;
    return {
      id: product.id,
      line,
      name: product.name,
      active: product.active,
      marginPercent: 0,
      productionKg: 0,
      storefrontImages: product.storefrontImages.map((image) => ({
        ...image,
        updatedAt: image.updatedAt.toISOString(),
      })),
      skus: product.variants.map((variant) => ({
        id: variant.id,
        line,
        productName: product.name,
        sku: variant.sku,
        packageWeightG: variant.netWeightGrams,
        commercialUnit: variant.salesUnit === "KG" ? "KG" : "UN",
        active: variant.active,
        stockUnits: 0,
        salesAmount: 0,
      })),
    };
  }
}
