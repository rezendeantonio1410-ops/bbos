import assert from "node:assert/strict";
import test from "node:test";
import { searchSignaEndCustomers } from "./signa-end-customer-search";

const customers = [
  { id: "1", name: "Café São José", city: "Londrina", state: "PR" },
  { id: "2", name: "Mercado Açúcar", city: "São Paulo", state: "SP" },
  { id: "3", name: "Cafeteria Norte", city: null, state: null },
];

test("retorna o cadastro recebido, sem criar clientes adicionais", () => {
  assert.deepEqual(searchSignaEndCustomers(customers, "  "), customers);
});

test("pesquisa nome com e sem acentos, ignorando maiúsculas", () => {
  assert.deepEqual(searchSignaEndCustomers(customers, "SAO JOSE").map((x) => x.id), ["1"]);
  assert.deepEqual(searchSignaEndCustomers(customers, "açúcar").map((x) => x.id), ["2"]);
});

test("pesquisa por cidade e UF sem erro para geografia ausente", () => {
  assert.deepEqual(searchSignaEndCustomers(customers, "londrina").map((x) => x.id), ["1"]);
  assert.deepEqual(searchSignaEndCustomers(customers, "sp").map((x) => x.id), ["2"]);
  assert.deepEqual(searchSignaEndCustomers(customers, "fora da carteira"), []);
});

test("não modifica o cadastro recebido", () => {
  const before = JSON.stringify(customers);
  searchSignaEndCustomers(customers, "cafe");
  assert.equal(JSON.stringify(customers), before);
});

test("pesquisa por CNPJ com ou sem máscara, sem confundir com texto", () => {
  const withTaxId = [
    { id: "a", name: "Alfa", taxId: "11222333000181" },
    { id: "b", name: "Beta", taxId: null },
  ];
  assert.deepEqual(searchSignaEndCustomers(withTaxId, "11.222.333/0001-81").map((x) => x.id), ["a"]);
  assert.deepEqual(searchSignaEndCustomers(withTaxId, "2223").map((x) => x.id), ["a"]);
  assert.deepEqual(searchSignaEndCustomers(withTaxId, "999").map((x) => x.id), []);
});

test("search finds a customer by the new alphanumeric CNPJ, masked or not", () => {
  const customers = [
    { id: "a", name: "Café Novo", city: "Londrina", state: "PR", taxId: "12ABC34501DE35" },
    { id: "b", name: "Padaria Antiga", city: "Cambé", state: "PR", taxId: "62835118000197" },
  ];
  assert.deepEqual(searchSignaEndCustomers(customers, "12.ABC.345").map((c) => c.id), ["a"]);
  assert.deepEqual(searchSignaEndCustomers(customers, "12abc").map((c) => c.id), ["a"]);
  assert.deepEqual(searchSignaEndCustomers(customers, "62.835").map((c) => c.id), ["b"]);
});
