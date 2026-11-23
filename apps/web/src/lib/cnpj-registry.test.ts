import assert from "node:assert/strict";
import test from "node:test";
import { cnpjRegistryStatusText, fillEmptyFromCnpj, isValidCnpjDigits, lookupCnpjRegistry, type CnpjRegistryRecord } from "./cnpj-registry";

const record: CnpjRegistryRecord = {
  cnpj: "11222333000181", legalName: "CAFETERIA EXEMPLO LTDA", tradeName: "CAFE EXEMPLO",
  registrationStatus: "ATIVA", active: true, statusDate: null, postalCode: "86010010",
  street: "RUA SERGIPE", number: "100", complement: null, district: "CENTRO",
  city: "LONDRINA", state: "PR", phone: null, email: null,
};

test("preenche só campos vazios e mantém o que o usuário digitou", () => {
  const filled = fillEmptyFromCnpj({ name: "Café da Praça", postalCode: "", street: "", number: "" }, record, {
    name: "legalName", postalCode: "postalCode", street: "street", number: "number",
  });
  assert.deepEqual(filled, { name: "Café da Praça", postalCode: "86010010", street: "RUA SERGIPE", number: "100" });
});

test("consulta usa a API do BBOS e trata 404, CNPJ inválido e indisponibilidade", async () => {
  assert.equal(isValidCnpjDigits("11.222.333/0001-81"), true);
  assert.equal((await lookupCnpjRegistry("11111111111111", async () => { throw new Error("não deveria chamar"); })).kind, "invalid");
  let url = "";
  const found = await lookupCnpjRegistry("11.222.333/0001-81", (async (input: string) => { url = input; return new Response(JSON.stringify(record), { status: 200 }); }) as typeof fetch);
  assert.equal(url, "/api/company-registry/cnpj/11222333000181");
  assert.equal(found.kind, "found");
  assert.equal((await lookupCnpjRegistry("11222333000181", (async () => new Response("{}", { status: 404 })) as typeof fetch)).kind, "not-found");
  assert.equal((await lookupCnpjRegistry("11222333000181", (async () => { throw new Error("offline"); }) as typeof fetch)).kind, "error");
});

test("situação inativa gera alerta", () => {
  assert.match(cnpjRegistryStatusText({ ...record, active: false, registrationStatus: "BAIXADA" }), /Atenção: CNPJ com situação BAIXADA/);
  assert.match(cnpjRegistryStatusText(record), /CNPJ ativo/);
});
