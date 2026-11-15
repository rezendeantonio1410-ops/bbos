import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@bbos/database";
import { ProductionService } from "./production.service";

const profile = (name: string, line = "GOURMET") => ({
  id: "product-1",
  productLineId: "line-1",
  code: "ESSENCIAL",
  name,
  slug: "essencial",
  description: "",
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  productLine: {
    id: "line-1",
    companyId: "company-1",
    code: line,
    name: line,
    slug: line.toLocaleLowerCase("pt-BR"),
    description: "",
    positioning: "",
    sortOrder: 1,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  variants: [
    {
      id: "variant-1",
      productId: "product-1",
      sku: "GOU-ESS-1000",
      netWeightGrams: 1000,
      active: true,
    },
  ],
});

const transactionFor = (product: ReturnType<typeof profile>) =>
  ({
    product: { findUnique: async () => product },
  }) as unknown as Prisma.TransactionClient;

test("OP por linha aceita um perfil oficial de café torrado", async () => {
  const result = await new ProductionService().requireProductionProduct(
    transactionFor(profile("Essencial")),
    "product-1",
  );
  assert.equal(result.product.name, "Essencial");
  assert.equal(result.variant.id, "variant-1");
});

test("OP por linha rejeita White Label como perfil de torra", async () => {
  await assert.rejects(
    new ProductionService().requireProductionProduct(
      transactionFor(profile("Café Gourmet White Label")),
      "product-1",
    ),
    /destinação do pedido e da embalagem/,
  );
});

test("OP de torra rejeita a linha de café verde", async () => {
  await assert.rejects(
    new ProductionService().requireProductionProduct(
      transactionFor(profile("Café verde", "GREEN_COFFEE")),
      "product-1",
    ),
    /somente linhas de café torrado/,
  );
});
