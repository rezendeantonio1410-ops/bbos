import assert from "node:assert/strict";
import test from "node:test";
import { parsePartnerEndCustomerPatch } from "./partner-end-customer-input";

test("normaliza edição comercial sem interferir no cadastro fiscal", () => {
  assert.deepEqual(
    parsePartnerEndCustomerPatch({ name: "  Cafeteria Aurora  ", city: " Curitiba ", state: " pr " }),
    { name: "Cafeteria Aurora", city: "Curitiba", state: "PR" },
  );
  assert.deepEqual(parsePartnerEndCustomerPatch({ city: "", state: "" }), {
    city: null,
    state: null,
  });
  assert.deepEqual(parsePartnerEndCustomerPatch({ name: "Novo Nome" }), {
    name: "Novo Nome",
  });
});

test("bloqueia alterações de parceiro, empresa, dados fiscais e campos arbitrários", () => {
  for (const attempt of [
    {},
    { partnerId: "outro-parceiro" },
    { companyId: "outra-empresa" },
    { active: false },
    { taxId: "12345678901" },
    { name: "Loja", customerId: "destinatario-nfe" },
    { name: null },
    { name: "A" },
    { state: "BR-SP" },
    { city: "x".repeat(121) },
    { name: "x".repeat(181) },
    { state: 12 },
    [],
    null,
  ]) {
    assert.throws(() => parsePartnerEndCustomerPatch(attempt));
  }
});
