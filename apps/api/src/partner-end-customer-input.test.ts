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

test("bloqueia alterações de parceiro, empresa, destinatário fiscal e campos arbitrários", () => {
  for (const attempt of [
    {},
    { partnerId: "outro-parceiro" },
    { companyId: "outra-empresa" },
    { active: false },
    { taxId: "12345678901" },
    { postalCode: "1234" },
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


test("normaliza CNPJ, CEP e endereço comercial sem alterar destinatário fiscal", () => {
  assert.deepEqual(parsePartnerEndCustomerPatch({
    name: " Café Central ", taxId: "12.345.678/0001-95", postalCode: "86010-010",
    street: " Rua Exemplo ", number: " 25 ", district: " Centro ",
    complement: " Sala 2 ", city: " Londrina ", state: " pr ",
  }), {
    name: "Café Central", taxId: "12345678000195", postalCode: "86010010",
    street: "Rua Exemplo", number: "25", district: "Centro",
    complement: "Sala 2", city: "Londrina", state: "PR",
  });
});
