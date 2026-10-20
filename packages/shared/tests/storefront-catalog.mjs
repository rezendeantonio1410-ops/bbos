import assert from "node:assert/strict";
import test from "node:test";
import {
  formatStorefrontPrice,
  normalizeStorefrontProductId,
  resolveStorefrontProduct,
  STOREFRONT_PRODUCT_CATALOG,
} from "../dist/storefront-catalog.js";

test("Essencial e Intenso mantêm o preço oficial de R$ 52,00", () => {
  assert.equal(STOREFRONT_PRODUCT_CATALOG.essencial.unitPriceCents, 5200);
  assert.equal(STOREFRONT_PRODUCT_CATALOG.intenso.unitPriceCents, 5200);
  assert.equal(formatStorefrontPrice(5200, true), "R$ 52,00");
});

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
