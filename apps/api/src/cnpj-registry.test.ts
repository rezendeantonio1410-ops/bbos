import assert from "node:assert/strict";
import test from "node:test";
import { CnpjLookupError, CnpjRegistryClient, mapBrasilApiCnpj } from "./cnpj-registry";

const sample = {
  cnpj: "11222333000181",
  razao_social: "CAFETERIA EXEMPLO LTDA",
  nome_fantasia: "CAFE EXEMPLO",
  descricao_situacao_cadastral: "ATIVA",
  data_situacao_cadastral: "2015-03-10",
  cep: "86010010",
  descricao_tipo_de_logradouro: "RUA",
  logradouro: "SERGIPE",
  numero: "100",
  complemento: "SALA 2",
  bairro: "CENTRO",
  municipio: "LONDRINA",
  uf: "PR",
  ddd_telefone_1: "4333334444",
  email: "CONTATO@EXEMPLO.COM.BR",
};

test("mapeia a resposta da BrasilAPI para o cadastro BBOS (sem IE)", () => {
  const record = mapBrasilApiCnpj(sample);
  assert.equal(record.legalName, "CAFETERIA EXEMPLO LTDA");
  assert.equal(record.tradeName, "CAFE EXEMPLO");
  assert.equal(record.active, true);
  assert.equal(record.postalCode, "86010010");
  assert.equal(record.street, "RUA SERGIPE");
  assert.equal(record.city, "LONDRINA");
  assert.equal(record.state, "PR");
  assert.equal(record.email, "contato@exemplo.com.br");
  assert.equal("stateRegistration" in record, false);
});

test("situação diferente de ATIVA é sinalizada", () => {
  assert.equal(mapBrasilApiCnpj({ ...sample, descricao_situacao_cadastral: "BAIXADA" }).active, false);
});

test("CNPJ inválido não consulta a rede; 404 vira NOT_FOUND; falha vira UNAVAILABLE; cache evita repetição", async () => {
  let calls = 0;
  const ok = new CnpjRegistryClient(async () => { calls += 1; return { status: 200, ok: true, json: async () => sample }; });
  await assert.rejects(ok.lookup("11.111.111/1111-11"), (e: unknown) => e instanceof CnpjLookupError && e.code === "INVALID");
  assert.equal(calls, 0);
  await ok.lookup("11.222.333/0001-81");
  await ok.lookup("11222333000181");
  assert.equal(calls, 1);
  const missing = new CnpjRegistryClient(async () => ({ status: 404, ok: false, json: async () => ({}) }));
  await assert.rejects(missing.lookup("11222333000181"), (e: unknown) => e instanceof CnpjLookupError && e.code === "NOT_FOUND");
  const down = new CnpjRegistryClient(async () => { throw new Error("timeout"); });
  await assert.rejects(down.lookup("11222333000181"), (e: unknown) => e instanceof CnpjLookupError && e.code === "UNAVAILABLE");
});
