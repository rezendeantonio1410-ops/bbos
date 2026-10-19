import assert from "node:assert/strict";
import test from "node:test";
import {
  formatStorefrontPrice,
  normalizeStorefrontProductId,
  resolveStorefrontProduct,
  STOREFRONT_PRODUCT_CATALOG,
} from "../dist/storefront-catalog.js";

test("Raro mantém o preço oficial e a apresentação de 250 g", () => {
  assert.deepEqual(STOREFRONT_PRODUCT_CATALOG.raros, {
    id: "raros",
    name: "Raro",
    unitPriceCents: 5400,
    weightGrams: 250,
  });
  assert.equal(formatStorefrontPrice(5400, true), "R$ 54,00");
});

test("identificador legado do Raro é normalizado para o catálogo atual", () => {
  assert.equal(normalizeStorefrontProductId("raro"), "raros");
  assert.equal(resolveStorefrontProduct("raro")?.id, "raros");
});

test("catálogo rejeita produtos desconhecidos", () => {
  assert.equal(resolveStorefrontProduct("produto-inexistente"), null);
});
