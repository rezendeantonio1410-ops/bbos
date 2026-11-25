import assert from "node:assert/strict";
import test from "node:test";
import { checkoutErrors, deliverySummary, freeShippingRegion, validFullName, validHouseNumber, validMobile } from "./storefront-checkout-validation";

const ok = {
  name: "Ana Souza", email: "ana@exemplo.com", phone: "(43) 99999-1234", cpf: "529.982.247-25",
  postalCode: "86010-000", street: "Rua Pará", number: "1188", complement: "apto 3",
  district: "Centro", city: "Londrina", state: "PR",
};

test("complete checkout has no errors", () => {
  assert.deepEqual(checkoutErrors(ok), {});
});

test("blocks the problems seen in real orders", () => {
  const e = checkoutErrors({ ...ok, name: "Ana", phone: "4333334444", number: "", district: " " });
  assert.ok(e.name && e.phone && e.number && e.district);
  assert.equal(checkoutErrors({ ...ok, number: "S/N" }).number, undefined);
  assert.ok(checkoutErrors({ ...ok, number: "apto 3" }).number);
});

test("mobile phone needs a real DDD and the 9", () => {
  assert.equal(validMobile("(43) 99999-1234"), true);
  assert.equal(validMobile("(00) 99999-1234"), false);
  assert.equal(validMobile("(20) 99999-1234"), false);
  assert.equal(validMobile("(43) 3333-4444"), false);
  assert.equal(validMobile("(43) 99999-9999"), false);
});

test("full name and house number", () => {
  assert.equal(validFullName("José Rezende"), true);
  assert.equal(validFullName("José R"), false);
  for (const n of ["12", "120A", "1200-B", "s/n"]) assert.equal(validHouseNumber(n), true, n);
  for (const n of ["Rua 2", "apto 3", "--"]) assert.equal(validHouseNumber(n), false, n);
});

test("delivery summary and free-shipping region", () => {
  assert.deepEqual(deliverySummary(ok), { line1: "Rua Pará, 1188 – apto 3", line2: "Centro · Londrina/PR", cep: "86010-000" });
  assert.equal(freeShippingRegion("86010-000"), true);
  assert.equal(freeShippingRegion("01310-100"), true);
  assert.equal(freeShippingRegion("40020-000"), false);
  assert.equal(freeShippingRegion("860"), null);
});
