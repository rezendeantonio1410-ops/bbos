import test from "node:test";
import assert from "node:assert/strict";
import {
  assertCatalogSkuAvailable,
  PRODUCT_CATALOG_DEMO,
  resolveLegacyProductVariant,
  validateCreateProductSku,
  validateProductionVariantEligibility,
} from "../dist/product-presentation.js";

const allowed = [
  ["RAROS", 250],
  ["EPICOS", 250],
  ["CLASSICOS", 500],
  ["CLASSICOS", 1000],
  ["GOURMET", 500],
  ["GOURMET", 1000],
];

for (const [line, packageWeightG] of allowed) {
  test(`${line} aceita ${packageWeightG} g`, () => {
    assert.equal(
      validateCreateProductSku({
        line,
        productName: "Produto teste",
        sku: `test-${line}-${packageWeightG}`,
        packageWeightG,
      }).packageWeightG,
      packageWeightG,
    );
  });
}

const forbidden = [
  ["RAROS", 500],
  ["RAROS", 1000],
  ["EPICOS", 500],
  ["EPICOS", 1000],
  ["CLASSICOS", 250],
  ["GOURMET", 250],
];

for (const [line, packageWeightG] of forbidden) {
  test(`${line} rejeita ${packageWeightG} g`, () => {
    assert.throws(() =>
      validateCreateProductSku({
        line,
        productName: "Produto teste",
        sku: `INV-${line}-${packageWeightG}`,
        packageWeightG,
      }),
    );
  });
}

test("catálogo rejeita código de SKU duplicado", () => {
  assert.throws(
    () =>
      assertCatalogSkuAvailable(PRODUCT_CATALOG_DEMO, {
        line: "GOURMET",
        productName: "Novo",
        sku: "cla-car-500",
        packageWeightG: 500,
      }),
    /já está cadastrado/,
  );
});

test("produto não recebe a mesma apresentação duas vezes", () => {
  assert.throws(
    () =>
      assertCatalogSkuAvailable(PRODUCT_CATALOG_DEMO, {
        line: "CLASSICOS",
        productName: "Caramelo",
        sku: "CLA-CAR-500-B",
        packageWeightG: 500,
      }),
    /já possui a apresentação/,
  );
});

const eligibleVariant = {
  id: "variant-1",
  sku: "CLA-CAR-500",
  active: true,
  netWeightGrams: 500,
  product: {
    active: true,
    productLine: { active: true, code: "CLASSICOS" },
  },
};

test("OP aceita ProductVariant ativo com produto e linha ativos", () => {
  assert.equal(
    validateProductionVariantEligibility(eligibleVariant).id,
    "variant-1",
  );
});

test("OP rejeita ProductVariant inexistente", () => {
  assert.throws(
    () => validateProductionVariantEligibility(null),
    /não encontrada/,
  );
});

test("OP rejeita ProductVariant inativo", () => {
  assert.throws(
    () =>
      validateProductionVariantEligibility({
        ...eligibleVariant,
        active: false,
      }),
    /inativa/,
  );
});

test("OP rejeita produto ou linha inativos", () => {
  assert.throws(() =>
    validateProductionVariantEligibility({
      ...eligibleVariant,
      product: { ...eligibleVariant.product, active: false },
    }),
  );
  assert.throws(() =>
    validateProductionVariantEligibility({
      ...eligibleVariant,
      product: {
        ...eligibleVariant.product,
        productLine: {
          ...eligibleVariant.product.productLine,
          active: false,
        },
      },
    }),
  );
});

test("backfill legado mapeia somente SKU com correspondência única", () => {
  const variants = [{ id: "variant-1", sku: "CLA-CAR-500" }];
  assert.equal(
    resolveLegacyProductVariant(" cla-car-500 ", variants)?.id,
    "variant-1",
  );
  assert.equal(resolveLegacyProductVariant("BC-ANTIGO", variants), null);
  assert.equal(
    resolveLegacyProductVariant("CLA-CAR-500", [
      ...variants,
      { id: "ambiguous", sku: "CLA-CAR-500" },
    ]),
    null,
  );
});
