export const PRODUCT_LINES = [
  "RAROS",
  "EPICOS",
  "CLASSICOS",
  "GOURMET",
] as const;
export type ProductLine = (typeof PRODUCT_LINES)[number];
export type ProductPresentationWeightG = 250 | 500 | 1000;
export const PRODUCT_LINE_LABELS: Record<ProductLine, string> = {
  RAROS: "Raros",
  EPICOS: "Épicos",
  CLASSICOS: "Clássicos",
  GOURMET: "Gourmet",
};
export const PRODUCT_LINE_META: Record<
  ProductLine,
  { slug: string; description: string; positioning: string; sortOrder: number }
> = {
  RAROS: {
    slug: "raros",
    description:
      "Microlotes de disponibilidade excepcional e expressão singular.",
    positioning: "Exclusividade e origem",
    sortOrder: 1,
  },
  EPICOS: {
    slug: "epicos",
    description: "Cafés de alta complexidade para experiências memoráveis.",
    positioning: "Experiência e descoberta",
    sortOrder: 2,
  },
  CLASSICOS: {
    slug: "classicos",
    description: "Perfis consistentes para consumo recorrente e versátil.",
    positioning: "Consistência e equilíbrio",
    sortOrder: 3,
  },
  GOURMET: {
    slug: "gourmet",
    description: "Cafés equilibrados com qualidade acessível e confiável.",
    positioning: "Qualidade cotidiana",
    sortOrder: 4,
  },
};
export const PRODUCT_PRESENTATION_RULES: Readonly<
  Record<ProductLine, readonly ProductPresentationWeightG[]>
> = {
  RAROS: [250],
  EPICOS: [250],
  CLASSICOS: [500, 1000],
  GOURMET: [500, 1000],
};
export type CreateProductSkuInput = {
  line: ProductLine;
  productName: string;
  sku: string;
  packageWeightG: number;
};
export type CatalogSku = CreateProductSkuInput & {
  id: string;
  commercialUnit: "UN" | "KG";
  active: boolean;
  stockUnits: number;
  salesAmount: number;
};
export type CatalogProduct = {
  id: string;
  line: ProductLine;
  name: string;
  active: boolean;
  marginPercent: number;
  productionKg: number;
  skus: CatalogSku[];
};

export type ProductionVariantEligibility = {
  id: string;
  active: boolean;
  netWeightGrams: number;
  product: {
    active: boolean;
    productLine: { active: boolean; code: ProductLine };
  };
};

export function validateProductionVariantEligibility<
  T extends ProductionVariantEligibility,
>(variant: T | null | undefined): T {
  if (!variant) throw new Error("Apresentação/SKU não encontrada.");
  if (!variant.active) throw new Error("A apresentação/SKU está inativa.");
  if (!variant.product.active) throw new Error("O produto está inativo.");
  if (!variant.product.productLine.active)
    throw new Error("A linha de produto está inativa.");
  assertProductPresentationAllowed(
    variant.product.productLine.code,
    variant.netWeightGrams,
  );
  return variant;
}

export function resolveLegacyProductVariant<
  T extends { id: string; sku: string },
>(legacySku: string | null | undefined, variants: readonly T[]): T | null {
  const normalized = legacySku?.trim().toLocaleUpperCase("pt-BR");
  if (!normalized) return null;
  const matches = variants.filter(
    (variant) =>
      variant.sku.trim().toLocaleUpperCase("pt-BR") === normalized,
  );
  return matches.length === 1 ? matches[0]! : null;
}
export type CreateCatalogProductInput = CreateProductSkuInput & {
  productCode?: string;
  description?: string;
  commercialUnit: "UN" | "KG";
  active: boolean;
};

export type CreateProductVariantInput = {
  sku: string;
  packageWeightG: number;
  commercialUnit: "UN" | "KG";
  active: boolean;
};

export const normalizeProductCode = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .toLocaleUpperCase("pt-BR");

export const productSlug = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const PRODUCT_CATALOG_DEMO: CatalogProduct[] = [
  {
    id: "classicos-caramelo",
    line: "CLASSICOS",
    name: "Caramelo",
    active: true,
    marginPercent: 22.8,
    productionKg: 1480,
    skus: [
      {
        id: "sku-caramelo-500",
        line: "CLASSICOS",
        productName: "Caramelo",
        sku: "CLA-CAR-500",
        packageWeightG: 500,
        commercialUnit: "UN",
        active: true,
        stockUnits: 1240,
        salesAmount: 98600,
      },
      {
        id: "sku-caramelo-1k",
        line: "CLASSICOS",
        productName: "Caramelo",
        sku: "CLA-CAR-1K",
        packageWeightG: 1000,
        commercialUnit: "UN",
        active: true,
        stockUnits: 680,
        salesAmount: 74100,
      },
    ],
  },
  {
    id: "classicos-doce-leite",
    line: "CLASSICOS",
    name: "Doce de Leite",
    active: true,
    marginPercent: 21.6,
    productionKg: 1160,
    skus: [
      {
        id: "sku-doce-500",
        line: "CLASSICOS",
        productName: "Doce de Leite",
        sku: "CLA-DOC-500",
        packageWeightG: 500,
        commercialUnit: "UN",
        active: true,
        stockUnits: 940,
        salesAmount: 81200,
      },
      {
        id: "sku-doce-1k",
        line: "CLASSICOS",
        productName: "Doce de Leite",
        sku: "CLA-DOC-1K",
        packageWeightG: 1000,
        commercialUnit: "UN",
        active: true,
        stockUnits: 430,
        salesAmount: 53800,
      },
    ],
  },
  {
    id: "classicos-aureo",
    line: "CLASSICOS",
    name: "Áureo",
    active: true,
    marginPercent: 24.1,
    productionKg: 920,
    skus: [
      {
        id: "sku-aureo-500",
        line: "CLASSICOS",
        productName: "Áureo",
        sku: "CLA-AUR-500",
        packageWeightG: 500,
        commercialUnit: "UN",
        active: true,
        stockUnits: 760,
        salesAmount: 69400,
      },
      {
        id: "sku-aureo-1k",
        line: "CLASSICOS",
        productName: "Áureo",
        sku: "CLA-AUR-1K",
        packageWeightG: 1000,
        commercialUnit: "UN",
        active: true,
        stockUnits: 380,
        salesAmount: 44700,
      },
    ],
  },
  {
    id: "gourmet-melpo",
    line: "GOURMET",
    name: "Melpo",
    active: true,
    marginPercent: 25.3,
    productionKg: 780,
    skus: [
      {
        id: "sku-melpo-500",
        line: "GOURMET",
        productName: "Melpo",
        sku: "GOU-MEL-500",
        packageWeightG: 500,
        commercialUnit: "UN",
        active: true,
        stockUnits: 620,
        salesAmount: 62200,
      },
      {
        id: "sku-melpo-1k",
        line: "GOURMET",
        productName: "Melpo",
        sku: "GOU-MEL-1K",
        packageWeightG: 1000,
        commercialUnit: "UN",
        active: true,
        stockUnits: 310,
        salesAmount: 38200,
      },
    ],
  },
];
export class ProductPresentationRuleError extends Error {
  readonly line: ProductLine;
  readonly packageWeightG: number;
  constructor(message: string, line: ProductLine, packageWeightG: number) {
    super(message);
    this.name = "ProductPresentationRuleError";
    this.line = line;
    this.packageWeightG = packageWeightG;
  }
}
export const isProductLine = (value: unknown): value is ProductLine =>
  typeof value === "string" && PRODUCT_LINES.includes(value as ProductLine);
export const getAllowedPresentations = (
  line: ProductLine,
): readonly ProductPresentationWeightG[] => PRODUCT_PRESENTATION_RULES[line];
export const isPresentationAllowed = (
  line: ProductLine,
  packageWeightG: number,
): packageWeightG is ProductPresentationWeightG =>
  PRODUCT_PRESENTATION_RULES[line].some((weight) => weight === packageWeightG);
export function assertProductPresentationAllowed(
  line: ProductLine,
  packageWeightG: number,
): asserts packageWeightG is ProductPresentationWeightG {
  if (isPresentationAllowed(line, packageWeightG)) return;
  const allowed = PRODUCT_PRESENTATION_RULES[line]
    .map((weight) => (weight === 1000 ? "1 kg" : `${weight} g`))
    .join(" ou ");
  throw new ProductPresentationRuleError(
    `${PRODUCT_LINE_LABELS[line]} permite somente apresentação ${allowed}.`,
    line,
    packageWeightG,
  );
}
export function validateCreateProductSku(
  input: CreateProductSkuInput,
): CreateProductSkuInput {
  if (!isProductLine(input.line)) throw new Error("Linha de produto inválida.");
  if (!input.productName.trim()) throw new Error("Produto é obrigatório.");
  if (!input.sku.trim()) throw new Error("SKU é obrigatório.");
  assertProductPresentationAllowed(input.line, input.packageWeightG);
  return {
    ...input,
    productName: input.productName.trim(),
    sku: input.sku.trim().toLocaleUpperCase("pt-BR"),
  };
}

export function assertCatalogSkuAvailable(
  catalog: readonly CatalogProduct[],
  input: CreateProductSkuInput,
) {
  const valid = validateCreateProductSku(input);
  const normalizedName = valid.productName.toLocaleLowerCase("pt-BR");
  const duplicateSku = catalog.some((product) =>
    product.skus.some(
      (variant) =>
        variant.sku.toLocaleUpperCase("pt-BR") ===
        valid.sku.toLocaleUpperCase("pt-BR"),
    ),
  );
  if (duplicateSku) throw new Error(`O SKU ${valid.sku} já está cadastrado.`);
  const product = catalog.find(
    (item) =>
      item.line === valid.line &&
      item.name.toLocaleLowerCase("pt-BR") === normalizedName,
  );
  if (
    product?.skus.some(
      (variant) => variant.packageWeightG === valid.packageWeightG,
    )
  ) {
    const presentation =
      valid.packageWeightG === 1000 ? "1 kg" : `${valid.packageWeightG} g`;
    throw new Error(
      `${valid.productName} já possui a apresentação ${presentation}.`,
    );
  }
  return valid;
}
