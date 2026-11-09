import assert from "node:assert/strict";
import test from "node:test";

import { calculateSalesLineDiscount } from "../dist/sales-line-discount.js";

test("calcula desconto em reais e percentual a partir do preço final", () => {
  const result = calculateSalesLineDiscount({
    officialUnitPrice: 55,
    finalUnitPrice: 52,
  });

  assert.equal(result.valid, true);
  assert.equal(result.discountAmount, 3);
  assert.equal(result.discountPercent, 5.455);
  assert.equal(result.finalUnitPrice, 52);
});

test("mantém o preço de tabela quando o preço final não foi informado", () => {
  const result = calculateSalesLineDiscount({ officialUnitPrice: 55 });

  assert.equal(result.valid, true);
  assert.equal(result.finalUnitPrice, 55);
  assert.equal(result.discountAmount, 0);
  assert.equal(result.discountPercent, 0);
});

test("protege limite percentual e preço mínimo", () => {
  const overLimit = calculateSalesLineDiscount({
    officialUnitPrice: 55,
    finalUnitPrice: 49,
    maxDiscountPercent: 5,
  });
  const belowFloor = calculateSalesLineDiscount({
    officialUnitPrice: 55,
    finalUnitPrice: 51,
    minimumPrice: 52,
  });

  assert.equal(overLimit.valid, false);
  assert.match(overLimit.message, /máximo permitido/i);
  assert.equal(belowFloor.valid, false);
  assert.match(belowFloor.message, /mínimo protegido/i);
});
