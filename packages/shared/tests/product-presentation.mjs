import test from "node:test";
import assert from "node:assert/strict";
import {
  assertCatalogSkuAvailable,
  isValidGtin,
  PRODUCT_CATALOG_DEMO,
  resolveLegacyProductVariant,
  validateCreateCatalogProduct,
  validateCreateProductSku,
  validateProductionVariantEligibility,
} from "../dist/product-presentation.js";

const allowed = [
  ["RAROS", 250],
  ["EPICOS", 250],
  ["CLASSICOS", 250],
  ["CLASSICOS", 500],
  ["CLASSICOS", 1000],
  ["GOURMET", 250],
  ["GOURMET", 500],
  ["GOURMET", 1000],
  ["GREEN_COFFEE", 1000],
  ["GREEN_COFFEE", 30000],
  ["GREEN_COFFEE", 60000],
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

const validProduct = {
  line: "GOURMET",
  productName: "Essencial",
  sku: "GOU-ESS-500",
  packageWeightG: 500,
  commercialUnit: "UN",
  active: true,
  grossWeightG: 530,
  packageWidthCm: 15,
  packageHeightCm: 24,
  packageDepthCm: 8,
  retailPrice: 52,
  maxDiscountPercent: 10,
  gtin: "7891000315507",
  ncm: "09012100",
  originCode: 0,
  productionType: "P",
  fiscalValidated: true,
};

test("cadastro mestre aceita produto completo e normaliza SKU e NCM", () => {
  const result = validateCreateCatalogProduct({
    ...validProduct,
    sku: " gou-ess-500 ",
    ncm: "0901.21.00",
  });
  assert.equal(result.sku, "GOU-ESS-500");
  assert.equal(result.ncm, "09012100");
  assert.equal(result.gtin, "7891000315507");
});

test("White Label exige linha torrada e vínculo com café-base", () => {
  assert.throws(
    () =>
      validateCreateCatalogProduct({
        ...validProduct,
        commercialKind: "WHITE_LABEL",
      }),
    /café-base|cafe-base/i,
  );
  assert.throws(
    () =>
      validateCreateCatalogProduct({
        ...validProduct,
        line: "GREEN_COFFEE",
        packageWeightG: 30000,
        grossWeightG: 30500,
        commercialKind: "WHITE_LABEL",
        baseCoffeeProductId: "coffee-1",
      }),
    /linha de café torrado/i,
  );
  const result = validateCreateCatalogProduct({
    ...validProduct,
    commercialKind: "WHITE_LABEL",
    baseCoffeeProductId: " coffee-1 ",
  });
  assert.equal(result.commercialKind, "WHITE_LABEL");
  assert.equal(result.baseCoffeeProductId, "coffee-1");
});

test("produto padrão ignora vínculo White Label residual", () => {
  const result = validateCreateCatalogProduct({
    ...validProduct,
    commercialKind: "STANDARD",
    baseCoffeeProductId: "coffee-1",
  });
  assert.equal(result.commercialKind, "STANDARD");
  assert.equal(result.baseCoffeeProductId, undefined);
});

test("cadastro mestre bloqueia peso, preço, desconto e NCM inconsistentes", () => {
  assert.throws(
    () => validateCreateCatalogProduct({ ...validProduct, grossWeightG: 499 }),
    /peso bruto/,
  );
  assert.throws(
    () => validateCreateCatalogProduct({ ...validProduct, retailPrice: 0 }),
    /preço de venda/,
  );
  assert.throws(
    () =>
      validateCreateCatalogProduct({
        ...validProduct,
        maxDiscountPercent: 101,
      }),
    /desconto máximo/,
  );
  assert.throws(
    () => validateCreateCatalogProduct({ ...validProduct, ncm: "090121" }),
    /NCM/,
  );
});

test("GTIN é validado pelo dígito verificador", () => {
  assert.equal(isValidGtin("7891000315507"), true);
  assert.equal(isValidGtin("7891000315508"), false);
});
