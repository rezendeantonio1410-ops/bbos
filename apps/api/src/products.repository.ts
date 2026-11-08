import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import {
  Prisma,
  PrismaClient,
  prisma,
  type ProductLineCode,
} from "@bbos/database";
import {
  assertProductPresentationAllowed,
  normalizeProductCode,
  productSlug,
  validateCreateCatalogProduct,
  type CatalogProduct,
  type CreateCatalogProductInput,
  type CreateProductVariantInput,
  type ProductLine,
  // @ts-expect-error Nest uses legacy Node resolution; runtime resolves the package export.
} from "@bbos/shared/product-presentation";

const productInclude = {
  productLine: true,
  baseCoffeeProduct: {
    select: { id: true, name: true, productLineId: true, commercialKind: true },
  },
  variants: {
    where: { active: true },
    orderBy: { netWeightGrams: "asc" as const },
    include: {
      channelPrices: {
        where: {
          active: true,
          salesChannel: { code: "CONSUMIDOR_FINAL" },
        },
        include: { salesChannel: true },
        orderBy: { createdAt: "desc" as const },
      },
    },
  },
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
    description:
      "Microlotes de disponibilidade excepcional e expressão singular.",
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
  GREEN_COFFEE: {
    name: "Café Verde",
    slug: "cafe-verde",
    description:
      "Café verde comercializável, com cadastro fiscal e logístico próprio.",
    positioning: "Matéria-prima e exportação",
    sortOrder: 5,
  },
};

@Injectable()
export class ProductsRepository implements OnModuleDestroy {
  private readonly database = prisma;

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
          include: {
            variants: {
              where: { active: true },
              orderBy: { netWeightGrams: "asc" },
            },
          },
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
    const valid = validateCreateCatalogProduct(input);
    return this.database.$transaction(
      async (transaction) => {
        await this.ensureOfficialLines(transaction, companyId);
        const line = await transaction.productLine.findUniqueOrThrow({
          where: {
            companyId_code: { companyId, code: valid.line as ProductLineCode },
          },
        });
        const baseCoffeeProduct = valid.baseCoffeeProductId
          ? await transaction.product.findFirst({
              where: {
                id: valid.baseCoffeeProductId,
                active: true,
                commercialKind: "STANDARD",
                productLineId: line.id,
                productLine: { companyId },
              },
            })
          : null;
        if (valid.commercialKind === "WHITE_LABEL" && !baseCoffeeProduct)
          throw new Error(
            "O café-base do White Label deve estar ativo e pertencer à mesma linha selecionada.",
          );
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
          update: {
            active: input.active,
            commercialKind: valid.commercialKind,
            baseCoffeeProductId: baseCoffeeProduct?.id ?? null,
          },
          create: {
            productLineId: line.id,
            code: normalizeProductCode(input.productCode || valid.productName),
            name: valid.productName,
            slug,
            description: input.description?.trim() || "",
            active: input.active,
            commercialKind: valid.commercialKind,
            baseCoffeeProductId: baseCoffeeProduct?.id ?? null,
          },
        });
        const variant = await transaction.productVariant.create({
          data: {
            productId: product.id,
            sku: valid.sku,
            netWeightGrams: valid.packageWeightG,
            grossWeightGrams: valid.grossWeightG,
            packageWidthCm: valid.packageWidthCm,
            packageHeightCm: valid.packageHeightCm,
            packageDepthCm: valid.packageDepthCm,
            gtin: valid.gtin || null,
            ncm: valid.ncm,
            originCode: valid.originCode,
            cest: valid.cest || null,
            productionType: valid.productionType,
            fiscalValidated: valid.fiscalValidated,
            salesUnit: input.commercialUnit,
            active: input.active,
          },
        });
        await this.createConsumerPrice(
          transaction,
          companyId,
          variant.id,
          valid,
        );
        const result = await transaction.product.findUniqueOrThrow({
          where: { id: product.id },
          include: productInclude,
        });
        return this.toCatalogProduct(result);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async createVariant(
    productId: string,
    input: CreateProductVariantInput,
    companyId: string,
  ) {
    return this.database.$transaction(
      async (transaction) => {
        const product = await transaction.product.findUnique({
          where: { id: productId },
          include: { productLine: true },
        });
        if (!product || product.productLine.companyId !== companyId)
          throw new Error("Produto não encontrado.");
        const valid = validateCreateCatalogProduct({
          ...input,
          line: product.productLine.code as ProductLine,
          productName: product.name,
        });
        assertProductPresentationAllowed(
          product.productLine.code as ProductLine,
          valid.packageWeightG,
        );
        const sku = valid.sku;
        if (!sku) throw new Error("SKU é obrigatório.");
        await this.assertVariantAvailable(
          transaction,
          sku,
          valid.packageWeightG,
          product.productLineId,
          product.name,
        );
        const variant = await transaction.productVariant.create({
          data: {
            productId,
            sku,
            netWeightGrams: valid.packageWeightG,
            grossWeightGrams: valid.grossWeightG,
            packageWidthCm: valid.packageWidthCm,
            packageHeightCm: valid.packageHeightCm,
            packageDepthCm: valid.packageDepthCm,
            gtin: valid.gtin || null,
            ncm: valid.ncm,
            originCode: valid.originCode,
            cest: valid.cest || null,
            productionType: valid.productionType,
            fiscalValidated: valid.fiscalValidated,
            salesUnit: input.commercialUnit,
            active: input.active,
          },
        });
        await this.createConsumerPrice(
          transaction,
          companyId,
          variant.id,
          valid,
        );
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
    input: {
      name?: string;
      description?: string;
      active?: boolean;
      commercialKind?: "STANDARD" | "WHITE_LABEL";
      baseCoffeeProductId?: string | null;
    },
    companyId: string,
  ) {
    const current = await this.database.product.findFirst({
      where: { id, productLine: { companyId } },
    });
    if (!current) throw new Error("Produto não encontrado.");
    const commercialKind = input.commercialKind ?? current.commercialKind;
    if (!["STANDARD", "WHITE_LABEL"].includes(commercialKind))
      throw new Error("Tipo comercial do produto inválido.");
    const baseCoffeeProductId =
      commercialKind === "WHITE_LABEL"
        ? (input.baseCoffeeProductId ?? current.baseCoffeeProductId)
        : null;
    if (commercialKind === "WHITE_LABEL") {
      if (!baseCoffeeProductId)
        throw new Error(
          "Selecione o café-base em que este White Label se enquadra.",
        );
      if (baseCoffeeProductId === current.id)
        throw new Error(
          "O White Label não pode usar a si mesmo como café-base.",
        );
      const baseCoffeeProduct = await this.database.product.findFirst({
        where: {
          id: baseCoffeeProductId,
          active: true,
          commercialKind: "STANDARD",
          productLineId: current.productLineId,
          productLine: { companyId },
        },
      });
      if (!baseCoffeeProduct)
        throw new Error(
          "O café-base do White Label deve estar ativo e pertencer à mesma linha.",
        );
    }
    const data: Prisma.ProductUncheckedUpdateInput = {
      active: input.active,
      description: input.description?.trim(),
      commercialKind,
      baseCoffeeProductId,
    };
    if (input.name?.trim())
      Object.assign(data, {
        name: input.name.trim(),
        slug: productSlug(input.name),
        code: normalizeProductCode(input.name),
      });
    const result = await this.database.product.update({
      where: { id: current.id },
      data,
      include: productInclude,
    });
    return this.toCatalogProduct(result);
  }

  async updateVariant(
    id: string,
    input: { active: boolean },
    companyId: string,
  ) {
    const current = await this.database.productVariant.findFirst({
      where: { id, product: { productLine: { companyId } } },
    });
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
        where: {
          id: imageId,
          productId,
          product: { productLine: { companyId } },
        },
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

  async deleteStorefrontImage(
    productId: string,
    imageId: string,
    companyId: string,
  ) {
    return this.database.$transaction(async (transaction) => {
      const current = await transaction.storefrontProductImage.findFirst({
        where: {
          id: imageId,
          productId,
          product: { productLine: { companyId } },
        },
      });
      if (!current) throw new Error("Imagem não encontrada.");
      await transaction.storefrontProductImage.delete({
        where: { id: imageId },
      });
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
    for (const [code, definition] of Object.entries(OFFICIAL_LINES) as [
      ProductLine,
      (typeof OFFICIAL_LINES)[ProductLine],
    ][]) {
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

  private async createConsumerPrice(
    transaction: Prisma.TransactionClient,
    companyId: string,
    productVariantId: string,
    input: Pick<
      CreateCatalogProductInput,
      "retailPrice" | "maxDiscountPercent"
    >,
  ) {
    const channel = await transaction.salesChannel.findFirst({
      where: { companyId, code: "CONSUMIDOR_FINAL", active: true },
    });
    if (!channel)
      throw new Error(
        "O canal Consumidor final precisa estar ativo antes de cadastrar o produto.",
      );
    const minimumPrice =
      Math.round(
        Number(input.retailPrice) *
          (1 - Number(input.maxDiscountPercent) / 100) *
          100,
      ) / 100;
    await transaction.productPrice.create({
      data: {
        companyId,
        productVariantId,
        salesChannelId: channel.id,
        currency: "BRL",
        price: input.retailPrice,
        active: true,
        validFrom: new Date(),
        maxRequestDiscountPercent: input.maxDiscountPercent,
        maxApprovalDiscountPercent: input.maxDiscountPercent,
        minimumPrice,
      },
    });
  }

  async suggestNcm(companyId: string, kind: "ROASTED" | "GREEN") {
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT pv.ncm,COUNT(*)::int AS uses,MAX(pv."updatedAt") AS "lastUsedAt"
         FROM "ProductVariant" pv
         JOIN "Product" p ON p.id=pv."productId"
         JOIN "ProductLine" pl ON pl.id=p."productLineId"
        WHERE pl."companyId"=$1
          AND pv."fiscalValidated"=true
          AND pv.ncm ~ '^[0-9]{8}$'
          AND (($2='GREEN' AND pl.code='GREEN_COFFEE')
            OR ($2='ROASTED' AND pl.code<>'GREEN_COFFEE'))
        GROUP BY pv.ncm
        ORDER BY uses DESC,"lastUsedAt" DESC
        LIMIT 1`,
      companyId,
      kind,
    );
    let historical = String(rows[0]?.ncm ?? "").replace(/\D/g, "");
    if (!historical) {
      const mappedProfiles = await this.database.$queryRawUnsafe<any[]>(
        `SELECT REGEXP_REPLACE(COALESCE(metadata->>'ncm',''),'[^0-9]','','g') AS ncm,
                COUNT(*)::int AS uses,MAX("updatedAt") AS "lastUsedAt"
           FROM "IntegrationResourceMap"
          WHERE "companyId"=$1
            AND provider='BLING'
            AND "resourceType"='STOREFRONT_PRODUCT_PROFILE'
            AND REGEXP_REPLACE(COALESCE(metadata->>'ncm',''),'[^0-9]','','g') ~ '^[0-9]{8}$'
            AND (($2='GREEN' AND REGEXP_REPLACE(metadata->>'ncm','[^0-9]','','g') LIKE '09011%')
              OR ($2='ROASTED' AND REGEXP_REPLACE(metadata->>'ncm','[^0-9]','','g') LIKE '09012%'))
          GROUP BY REGEXP_REPLACE(COALESCE(metadata->>'ncm',''),'[^0-9]','','g')
          ORDER BY uses DESC,"lastUsedAt" DESC
          LIMIT 1`,
        companyId,
        kind,
      );
      historical = String(mappedProfiles[0]?.ncm ?? "").replace(/\D/g, "");
    }
    return {
      ncm: historical || (kind === "GREEN" ? "09011110" : "09012100"),
      source: historical ? "HISTORY" : "OFFICIAL_REFERENCE",
      description:
        kind === "GREEN"
          ? "Café não torrado, não descafeinado, em grão"
          : "Café torrado, não descafeinado",
    };
  }

  private toCatalogProduct(product: PersistedProduct): CatalogProduct {
    const line = product.productLine.code as ProductLine;
    return {
      id: product.id,
      line,
      name: product.name,
      active: product.active,
      commercialKind:
        product.commercialKind === "WHITE_LABEL" ? "WHITE_LABEL" : "STANDARD",
      baseCoffeeProductId: product.baseCoffeeProductId,
      baseCoffeeProductName: product.baseCoffeeProduct?.name ?? null,
      marginPercent: 0,
      productionKg: 0,
      storefrontImages: product.storefrontImages.map((image) => ({
        ...image,
        updatedAt: image.updatedAt.toISOString(),
      })),
      skus: product.variants.map((variant) => ({
        ...(variant.channelPrices[0]
          ? {
              retailPrice: Number(variant.channelPrices[0].price),
              maxDiscountPercent: Number(
                variant.channelPrices[0].maxRequestDiscountPercent,
              ),
              minimumPrice: Number(
                variant.channelPrices[0].minimumPrice ??
                  variant.channelPrices[0].price,
              ),
            }
          : { retailPrice: 0, maxDiscountPercent: 0, minimumPrice: 0 }),
        id: variant.id,
        line,
        productName: product.name,
        sku: variant.sku,
        packageWeightG: variant.netWeightGrams,
        grossWeightG: variant.grossWeightGrams,
        packageWidthCm: Number(variant.packageWidthCm),
        packageHeightCm: Number(variant.packageHeightCm),
        packageDepthCm: Number(variant.packageDepthCm),
        gtin: variant.gtin,
        ncm: variant.ncm,
        originCode: variant.originCode,
        cest: variant.cest,
        productionType: variant.productionType === "T" ? "T" : "P",
        fiscalValidated: variant.fiscalValidated,
        commercialUnit: variant.salesUnit === "KG" ? "KG" : "UN",
        active: variant.active,
        stockUnits: 0,
        salesAmount: 0,
      })),
    };
  }
}
