import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { seedProductCatalog } from "./seed-product-catalog";

test("seed do catálogo é idempotente e persiste 4 linhas, 4 produtos e 8 SKUs", async () => {
  const state = {
    company: null as null | { id: string; taxId: string },
    lines: new Map<string, Record<string, unknown>>(),
    products: new Map<string, Record<string, unknown>>(),
    variants: new Map<string, Record<string, unknown>>(),
  };
  const fake = {
    company: {
      upsert: async ({ create }: { create: { taxId: string } }) =>
        (state.company ??= { id: "company-1", taxId: create.taxId }),
    },
    productLine: {
      upsert: async ({ where, create, update }: any) => {
        const key = `${where.companyId_code.companyId}:${where.companyId_code.code}`;
        const current = state.lines.get(key);
        const value = current
          ? { ...current, ...update }
          : { id: `line-${state.lines.size + 1}`, ...create };
        state.lines.set(key, value);
        return value;
      },
      findMany: async () =>
        [...state.lines.values()]
          .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder))
          .map((line) => ({
            ...line,
            products: [...state.products.values()]
              .filter((product) => product.productLineId === line.id)
              .map((product) => ({
                ...product,
                variants: [...state.variants.values()].filter(
                  (variant) => variant.productId === product.id,
                ),
              })),
          })),
    },
    product: {
      upsert: async ({ where, create, update }: any) => {
        const key = `${where.productLineId_code.productLineId}:${where.productLineId_code.code}`;
        const current = state.products.get(key);
        const value = current
          ? { ...current, ...update }
          : { id: `product-${state.products.size + 1}`, ...create };
        state.products.set(key, value);
        return value;
      },
    },
    productVariant: {
      upsert: async ({ where, create, update }: any) => {
        const current = state.variants.get(where.sku);
        const value = current
          ? { ...current, ...update }
          : { id: `variant-${state.variants.size + 1}`, ...create };
        state.variants.set(where.sku, value);
        return value;
      },
    },
  } as unknown as PrismaClient;

  await seedProductCatalog(fake);
  await seedProductCatalog(fake);

  assert.equal(state.lines.size, 4);
  assert.equal(state.products.size, 4);
  assert.equal(state.variants.size, 8);
  assert.deepEqual([...state.variants.keys()].sort(), [
    "CLA-AUR-1K",
    "CLA-AUR-500",
    "CLA-CAR-1K",
    "CLA-CAR-500",
    "CLA-DOC-1K",
    "CLA-DOC-500",
    "GOU-MEL-1K",
    "GOU-MEL-500",
  ]);
});
