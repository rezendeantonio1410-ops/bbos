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

const COMPANY_TAX_ID = "12.345.678/0001-90";
const productInclude = {
  productLine: true,
  variants: { orderBy: { netWeightGrams: "asc" as const } },
} satisfies Prisma.ProductInclude;

type PersistedProduct = Prisma.ProductGetPayload<{
  include: typeof productInclude;
}>;

@Injectable()
export class ProductsRepository implements OnModuleDestroy {
  private readonly database = new PrismaClient();

  onModuleDestroy() {
    return this.database.$disconnect();
  }

  async listCatalog(): Promise<CatalogProduct[]> {
    const companyId = await this.companyId();
    const products = await this.database.product.findMany({
      where: { productLine: { companyId } },
      include: productInclude,
      orderBy: [{ productLine: { sortOrder: "asc" } }, { name: "asc" }],
    });
    return products.map((product) => this.toCatalogProduct(product));
  }

  async listLines() {
    const companyId = await this.companyId();
    return this.database.productLine.findMany({
      where: { companyId },
      include: {
        products: {
          include: { variants: { orderBy: { netWeightGrams: "asc" } } },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { sortOrder: "asc" },
    });
  }

  async findProduct(id: string) {
    const product = await this.database.product.findUnique({
      where: { id },
      include: productInclude,
    });
    return product ? this.toCatalogProduct(product) : null;
  }

  async createProduct(input: CreateCatalogProductInput) {
    const valid = validateCreateProductSku(input);
    return this.database.$transaction(
      async (transaction) => {
        const companyId = await this.companyId(transaction);
        const line = await transaction.productLine.findUnique({
          where: {
            companyId_code: { companyId, code: valid.line as ProductLineCode },
          },
        });
        if (!line)
          throw new Error(
            "Linha oficial não encontrada. Execute o seed do catálogo.",
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

  async createVariant(productId: string, input: CreateProductVariantInput) {
    return this.database.$transaction(
      async (transaction) => {
        const product = await transaction.product.findUnique({
          where: { id: productId },
          include: { productLine: true },
        });
        if (!product) throw new Error("Produto não encontrado.");
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
    const result = await this.database.product.update({
      where: { id },
      data,
      include: productInclude,
    });
    return this.toCatalogProduct(result);
  }

  async updateVariant(id: string, input: { active: boolean }) {
    return this.database.productVariant.update({
      where: { id },
      data: { active: input.active },
    });
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

  private async companyId(transaction?: Prisma.TransactionClient) {
    const database = transaction ?? this.database;
    const company = await database.company.findUnique({
      where: { taxId: COMPANY_TAX_ID },
      select: { id: true },
    });
    if (!company)
      throw new Error(
        "Empresa Bispo Coffees não encontrada. Execute o seed do catálogo.",
      );
    return company.id;
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
