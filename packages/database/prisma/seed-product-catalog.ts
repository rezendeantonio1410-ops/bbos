import { PrismaClient, ProductLineCode } from "@prisma/client";

const COMPANY_TAX_ID = "12.345.678/0001-90";

export const OFFICIAL_PRODUCT_CATALOG = [
  {
    code: ProductLineCode.RAROS,
    name: "Raros",
    slug: "raros",
    description:
      "Microlotes de disponibilidade excepcional e expressão singular.",
    positioning: "Exclusividade e origem",
    sortOrder: 1,
    products: [],
  },
  {
    code: ProductLineCode.EPICOS,
    name: "Épicos",
    slug: "epicos",
    description: "Cafés de alta complexidade para experiências memoráveis.",
    positioning: "Experiência e descoberta",
    sortOrder: 2,
    products: [],
  },
  {
    code: ProductLineCode.CLASSICOS,
    name: "Clássicos",
    slug: "classicos",
    description: "Perfis consistentes para consumo recorrente e versátil.",
    positioning: "Consistência e equilíbrio",
    sortOrder: 3,
    products: [
      {
        code: "CARAMELO",
        name: "Caramelo",
        slug: "caramelo",
        variants: [
          ["CLA-CAR-500", 500],
          ["CLA-CAR-1K", 1000],
        ],
      },
      {
        code: "DOCE_LEITE",
        name: "Doce de Leite",
        slug: "doce-de-leite",
        variants: [
          ["CLA-DOC-500", 500],
          ["CLA-DOC-1K", 1000],
        ],
      },
      {
        code: "AUREO",
        name: "Áureo",
        slug: "aureo",
        variants: [
          ["CLA-AUR-500", 500],
          ["CLA-AUR-1K", 1000],
        ],
      },
    ],
  },
  {
    code: ProductLineCode.GOURMET,
    name: "Gourmet",
    slug: "gourmet",
    description: "Cafés equilibrados com qualidade acessível e confiável.",
    positioning: "Qualidade cotidiana",
    sortOrder: 4,
    products: [
      {
        code: "MELPO",
        name: "Melpo",
        slug: "melpo",
        variants: [
          ["GOU-MEL-500", 500],
          ["GOU-MEL-1K", 1000],
        ],
      },
    ],
  },
] as const;

export async function seedProductCatalog(client: PrismaClient) {
  const company = await client.company.upsert({
    where: { taxId: COMPANY_TAX_ID },
    update: {
      name: "Bispo Cafés Especiais Ltda.",
      tradeName: "Bispo Coffees",
      currency: "BRL",
    },
    create: {
      name: "Bispo Cafés Especiais Ltda.",
      tradeName: "Bispo Coffees",
      taxId: COMPANY_TAX_ID,
      currency: "BRL",
    },
  });
  for (const definition of OFFICIAL_PRODUCT_CATALOG) {
    const line = await client.productLine.upsert({
      where: {
        companyId_code: { companyId: company.id, code: definition.code },
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
        companyId: company.id,
        code: definition.code,
        name: definition.name,
        slug: definition.slug,
        description: definition.description,
        positioning: definition.positioning,
        sortOrder: definition.sortOrder,
        active: true,
      },
    });
    for (const productDefinition of definition.products) {
      const product = await client.product.upsert({
        where: {
          productLineId_code: {
            productLineId: line.id,
            code: productDefinition.code,
          },
        },
        update: {
          name: productDefinition.name,
          slug: productDefinition.slug,
          active: true,
        },
        create: {
          productLineId: line.id,
          code: productDefinition.code,
          name: productDefinition.name,
          slug: productDefinition.slug,
          description: "",
          active: true,
        },
      });
      for (const [sku, netWeightGrams] of productDefinition.variants) {
        await client.productVariant.upsert({
          where: { sku },
          update: {
            productId: product.id,
            netWeightGrams,
            salesUnit: "UN",
            active: true,
          },
          create: {
            productId: product.id,
            sku,
            netWeightGrams,
            salesUnit: "UN",
            active: true,
          },
        });
      }
    }
  }
  return client.productLine.findMany({
    where: { companyId: company.id },
    include: { products: { include: { variants: true } } },
    orderBy: { sortOrder: "asc" },
  });
}
