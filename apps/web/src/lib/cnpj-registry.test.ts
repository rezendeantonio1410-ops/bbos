import assert from "node:assert/strict";
import test from "node:test";
import { cnpjRegistryStatusText, fillEmptyFromCnpj, isValidCnpjDigits, lookupCnpjRegistry, type CnpjRegistryRecord } from "./cnpj-registry";
import { applyCnpjRecord, cnpjRegistrySummary } from "./cnpj-registry";

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
  assert.match(cnpjRegistryStatusText(record), /CNPJ ativo.*IE não encontrada/);
  assert.match(cnpjRegistryStatusText({ ...record, suggestedStateRegistration: "9012345678" }), /IE 9012345678 \(PR\)/);
});

const companyA = {
  cnpj: "11222333000181", legalName: "CAFE A LTDA", tradeName: null, registrationStatus: "ATIVA", active: true, statusDate: "2015-03-10",
  postalCode: "86010010", street: "RUA A", number: "1", complement: null, district: "CENTRO", city: "LONDRINA", state: "PR",
  phone: null, email: "a@a.com",
  details: {
    openingDate: "2010-05-20", statusReason: null, legalNature: "Sociedade Empresária Limitada", companySize: "MICRO EMPRESA",
    shareCapital: 50000, mainActivity: { code: "5611201", description: "Restaurantes e similares" }, secondaryActivities: [],
    simplesOptant: true, simplesSince: "2010-06-01", meiOptant: false, secondaryPhone: null, partners: [],
  },
};
const companyB = { ...companyA, cnpj: "11444777000161", legalName: "CAFE B LTDA", street: "RUA B", city: "CURITIBA" };
const mapping = { legalName: "legalName", street: "street", city: "city", email: "email" } as const;

test("preenche todos os campos vazios com os dados da Receita", () => {
  const filled = applyCnpjRecord({ legalName: "", street: "", city: "", email: "" }, companyA, mapping);
  assert.deepEqual(filled, { legalName: "CAFE A LTDA", street: "RUA A", city: "LONDRINA", email: "a@a.com" });
});

test("outro CNPJ substitui o que a busca anterior preencheu, mas mantém o que foi digitado à mão", () => {
  const afterA = applyCnpjRecord({ legalName: "", street: "", city: "", email: "" }, companyA, mapping);
  const edited = { ...afterA, city: "Cambé" };
  const afterB = applyCnpjRecord(edited, companyB, mapping, { previous: companyA });
  assert.equal(afterB.legalName, "CAFE B LTDA");
  assert.equal(afterB.street, "RUA B");
  assert.equal(afterB.city, "Cambé");
});

test("o botão Buscar na Receita sobrescreve todos os campos", () => {
  const filled = applyCnpjRecord({ legalName: "Digitado", street: "x", city: "y", email: "z@z.com" }, companyA, mapping, { overwrite: true });
  assert.deepEqual(filled, { legalName: "CAFE A LTDA", street: "RUA A", city: "LONDRINA", email: "a@a.com" });
});

test("resumo mostra os dados públicos em português", () => {
  const rows = Object.fromEntries(cnpjRegistrySummary(companyA).map((row) => [row.label, row.value]));
  assert.equal(rows["Situação"], "ATIVA desde 10/03/2015");
  assert.equal(rows["Abertura"], "20/05/2010");
  assert.equal(rows["Simples Nacional"], "Optante desde 01/06/2010");
  assert.equal(rows["Atividade principal"], "5611201 · Restaurantes e similares");
  assert.match(rows["Capital social"] ?? "", /50\.000,00/);
});
