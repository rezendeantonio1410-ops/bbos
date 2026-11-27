import assert from "node:assert/strict";
import test from "node:test";
import { customerDraftFromProspect, missingForCustomer, parseMoneyInput } from "./prospect-to-customer";

const prospect = {
  name: "Padaria Exemplo", taxId: "11222333000181", legalName: "Padaria Exemplo Ltda", tradeName: null,
  phone: "43999990000", email: "contato@exemplo.com", postalCode: "86010000", address: "Rua Exemplo",
  addressNumber: "100", district: "Centro", city: "Londrina", state: "PR", monthlyVolumeKg: 12,
  visits: [
    { recordedByName: "Vendedor Teste", visitAt: "2026-11-20T15:00:00Z", facts: "Primeira conversa." },
    { recordedByName: "Vendedor Teste", visitAt: "2026-11-27T15:00:00Z", facts: "Aprovaram a degustação e vão comprar." },
  ],
};

test("o cadastro do cliente vem pronto do prospect, com a última visita na justificativa", () => {
  const draft = customerDraftFromProspect(prospect);
  assert.equal(draft.tradeName, "Padaria Exemplo");
  assert.equal(draft.taxId, "11222333000181");
  assert.equal(draft.city, "Londrina");
  assert.match(draft.rationale, /12 kg de café por mês/);
  assert.match(draft.rationale, /vão comprar/);
  assert.doesNotMatch(draft.rationale, /Primeira conversa/);
  assert.equal(draft.askCredit, true);
});

test("aponta o que falta antes de enviar", () => {
  const draft = customerDraftFromProspect(prospect);
  assert.deepEqual(missingForCustomer(draft), ["limite de crédito"]);
  assert.deepEqual(missingForCustomer({ ...draft, requestedLimit: "2.000,00" }), []);
  assert.deepEqual(missingForCustomer({ ...draft, askCredit: false, taxId: "", district: "" }), ["CNPJ ou CPF", "bairro"]);
  assert.equal(parseMoneyInput("R$ 2.000,50"), 2000.5);
});
