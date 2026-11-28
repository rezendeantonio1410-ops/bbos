import assert from "node:assert/strict";
import test from "node:test";
import { CUSTOMER_SEGMENTS, normalizeCustomerSegment, segmentFamily } from "@bbos/shared";

test("unifica grafias e códigos de prospect no nome canônico", () => {
  assert.equal(normalizeCustomerSegment("CAFETERIA"), "Cafeteria");
  assert.equal(normalizeCustomerSegment("Cafeteria"), "Cafeteria");
  assert.equal(normalizeCustomerSegment("POSTO_CONVENIENCIA"), "Conveniência");
  assert.equal(normalizeCustomerSegment("Posto / conveniência"), "Conveniência");
  assert.equal(normalizeCustomerSegment("PADARIA_CONFEITARIA"), "Padaria / confeitaria");
  assert.equal(normalizeCustomerSegment("Restaurante / Hotel"), "Restaurante / Hotel");
  assert.equal(normalizeCustomerSegment("EMPRESA"), "Escritório");
  assert.equal(normalizeCustomerSegment("white label"), "White Label");
  assert.equal(normalizeCustomerSegment(""), null);
  assert.equal(normalizeCustomerSegment("xyz"), null);
  for (const s of CUSTOMER_SEGMENTS) assert.equal(normalizeCustomerSegment(s), s);
});

test("famílias: revenda, pontos de consumo e consumidor final", () => {
  assert.equal(segmentFamily("Distribuidor"), "REVENDA");
  assert.equal(segmentFamily("White Label"), "REVENDA");
  assert.equal(segmentFamily("CAFETERIA"), "CONSUMO");
  assert.equal(segmentFamily("POSTO_CONVENIENCIA"), "CONSUMO");
  assert.equal(segmentFamily("Restaurante / Hotel"), "CONSUMO");
  assert.equal(segmentFamily("E-commerce"), "CONSUMIDOR");
  assert.equal(segmentFamily(null), "OUTRO");
});
