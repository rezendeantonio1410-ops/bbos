import assert from "node:assert/strict";
import test from "node:test";
import { parsePartnerEndCustomerPatch } from "./partner-end-customer-input";

const complete = {
  name: " Café Central ", taxId: "11.222.333/0001-81", postalCode: "86010-010",
  street: " Rua Exemplo ", number: " 25 ", district: " Centro ",
  complement: " Sala 2 ", city: " Londrina ", state: " pr ",
};

test("normaliza edição comercial sem interferir no cadastro fiscal", () => {
  assert.deepEqual(
    parsePartnerEndCustomerPatch({ name: "  Cafeteria Aurora  ", city: " Curitiba ", state: " pr " }),
    { name: "Cafeteria Aurora", city: "Curitiba", state: "PR" },
  );
  assert.deepEqual(parsePartnerEndCustomerPatch({ name: "Novo Nome" }), {
    name: "Novo Nome",
  });
  assert.deepEqual(parsePartnerEndCustomerPatch({ complement: "" }), { complement: null });
});

test("edição não pode apagar campos obrigatórios do cadastro comercial", () => {
  for (const attempt of [{ city: "" }, { state: "" }, { taxId: "" }, { postalCode: "" },
    { street: " " }, { number: "" }, { district: "" }]) {
    assert.throws(() => parsePartnerEndCustomerPatch(attempt), /Informe/);
  }
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
    { state: "XX" },
    { city: "x".repeat(121) },
    { name: "x".repeat(181) },
    { state: 12 },
    [],
    null,
  ]) {
    assert.throws(() => parsePartnerEndCustomerPatch(attempt));
  }
});

test("valida dígitos verificadores do CNPJ", () => {
  assert.equal(parsePartnerEndCustomerPatch({ taxId: "11222333000181" }).taxId, "11222333000181");
  for (const taxId of ["11.222.333/0001-82", "00000000000000", "11111111111111", "12345678000100"]) {
    assert.throws(() => parsePartnerEndCustomerPatch({ taxId }), /CNPJ inválido/);
  }
});

test("normaliza CNPJ, CEP e endereço comercial sem alterar destinatário fiscal", () => {
  assert.deepEqual(parsePartnerEndCustomerPatch(complete, "create"), {
    name: "Café Central", taxId: "11222333000181", postalCode: "86010010",
    street: "Rua Exemplo", number: "25", district: "Centro",
    complement: "Sala 2", city: "Londrina", state: "PR",
  });
});

test("cadastro novo exige nome, CNPJ, CEP, rua, número, bairro, cidade e UF; complemento é opcional", () => {
  const { complement: _complement, ...withoutComplement } = complete;
  assert.equal(parsePartnerEndCustomerPatch(withoutComplement, "create").complement, undefined);
  for (const field of ["name", "taxId", "postalCode", "street", "number", "district", "city", "state"] as const) {
    const { [field]: _omitted, ...missing } = complete;
    assert.throws(() => parsePartnerEndCustomerPatch(missing, "create"), /Informe/, field);
    assert.throws(() => parsePartnerEndCustomerPatch({ ...complete, [field]: "" }, "create"), undefined, field);
  }
});
