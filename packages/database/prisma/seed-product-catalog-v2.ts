import { PrismaClient, ProductLineCode } from "@prisma/client";

export const OFFICIAL_PRODUCT_CATALOG_V2 = [
  { code: ProductLineCode.RAROS, name: "Raros", slug: "raros", description: "Microlotes de disponibilidade excepcional e expressão singular.", positioning: "Exclusividade e origem", sortOrder: 1, products: [
    { code: "RAROS", name: "Raros", slug: "raros", variants: [["RAR-RAR-250", 250]] },
  ] },
  { code: ProductLineCode.EPICOS, name: "Épicos", slug: "epicos", description: "Cafés de alta complexidade para experiências memoráveis.", positioning: "Experiência e descoberta", sortOrder: 2, products: [
    { code: "SINGULAR", name: "Singular", slug: "singular", variants: [["EPI-SIN-500", 500]] },
    { code: "SUBLIME", name: "Sublime", slug: "sublime", variants: [["EPI-SUB-500", 500]] },
  ] },
  { code: ProductLineCode.CLASSICOS, name: "Clássicos", slug: "classicos", description: "Perfis consistentes para consumo recorrente e versátil.", positioning: "Consistência e equilíbrio", sortOrder: 3, products: [
    { code: "CARAMELO", name: "Caramelo", slug: "caramelo", variants: [["CLA-CAR-500", 500]] },
    { code: "DOCE_LEITE", name: "Doce de Leite", slug: "doce-de-leite", variants: [["CLA-DOC-500", 500]] },
    { code: "TANGERINA", name: "Tangerina", slug: "tangerina", variants: [["CLA-TAN-500", 500]] },
  ] },
  { code: ProductLineCode.GOURMET, name: "Gourmet", slug: "gourmet", description: "Cafés equilibrados com qualidade acessível e confiável.", positioning: "Qualidade cotidiana", sortOrder: 4, products: [
    { code: "ESSENCIAL", name: "Essencial", slug: "essencial", variants: [["GOU-ESS-500", 500]] },
    { code: "INTENSO", name: "Intenso", slug: "intenso", variants: [["GOU-INT-500", 500]] },
  ] },
] as const;

export async function seedProductCatalogV2(client: PrismaClient) {
  const company = await client.company.findFirst({ orderBy: { createdAt: "asc" } });
  if (!company) throw new Error("Nenhuma empresa cadastrada para inicializar o catálogo oficial.");

  for (const definition of OFFICIAL_PRODUCT_CATALOG_V2) {
    const line = await client.productLine.upsert({
      where: { companyId_code: { companyId: company.id, code: definition.code } },
      update: { name: definition.name, slug: definition.slug, description: definition.description, positioning: definition.positioning, sortOrder: definition.sortOrder, active: true },
      create: { companyId: company.id, code: definition.code, name: definition.name, slug: definition.slug, description: definition.description, positioning: definition.positioning, sortOrder: definition.sortOrder, active: true },
    });

    for (const productDefinition of definition.products) {
      let product = await client.product.findFirst({ where: { productLineId: line.id, name: { equals: productDefinition.name, mode: "insensitive" } } });
      product = product
        ? await client.product.update({ where: { id: product.id }, data: { code: productDefinition.code, name: productDefinition.name, slug: productDefinition.slug, active: true } })
        : await client.product.create({ data: { productLineId: line.id, code: productDefinition.code, name: productDefinition.name, slug: productDefinition.slug, description: "", active: true } });

      for (const [sku, netWeightGrams] of productDefinition.variants) {
        const variant = await client.productVariant.findFirst({ where: { productId: product.id, netWeightGrams } });
        if (variant) await client.productVariant.update({ where: { id: variant.id }, data: { active: true, salesUnit: "UN" } });
        else await client.productVariant.create({ data: { productId: product.id, sku, netWeightGrams, salesUnit: "UN", active: true } });
      }
    }
  }
}
