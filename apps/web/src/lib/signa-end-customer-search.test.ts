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
