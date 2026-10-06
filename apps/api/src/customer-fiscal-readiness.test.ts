import assert from "node:assert/strict";
import test from "node:test";
import {
  assessCustomerFiscalReadiness,
  normalizeCustomerFiscalData,
} from "./customer-fiscal-readiness";

test("aceita pessoa física com documento e endereço fiscal completos", () => {
  const result = assessCustomerFiscalReadiness({
    name: "Cliente Exemplo",
    taxId: "529.982.247-25",
    postalCode: "86027-750",
    address: "Rua Exemplo",
    addressNumber: "100",
    district: "Centro",
    city: "Londrina",
    state: "PR",
  });

  assert.equal(result.ready, true);
  assert.equal(result.documentType, "CPF");
  assert.equal(result.normalized.stateRegistrationType, "NON_TAXPAYER");
});

test("exige razão social e situação da inscrição estadual para CNPJ", () => {
  const result = assessCustomerFiscalReadiness({
    name: "Empresa Exemplo",
    taxId: "04.252.011/0001-10",
    postalCode: "86027-750",
    address: "Rua Exemplo",
    addressNumber: "100",
    district: "Centro",
    city: "Londrina",
    state: "PR",
  });

  assert.equal(result.ready, false);
  assert.deepEqual(result.issues, [
    "razão social",
    "situação da inscrição estadual",
  ]);
});

test("normaliza cadastro empresarial isento", () => {
  const normalized = normalizeCustomerFiscalData({
    name: "Empresa Exemplo",
    legalName: "Empresa Exemplo Ltda.",
    taxId: "04.252.011/0001-10",
    postalCode: "86027-750",
    address: "Rua Exemplo",
    addressNumber: "S/N",
    addressComplement: "Sala 2",
    district: "Centro",
    city: "Londrina",
    state: "pr",
    stateRegistrationType: "EXEMPT",
    stateRegistration: "123456",
  });

  assert.equal(normalized.taxId, "04252011000110");
  assert.equal(normalized.postalCode, "86027750");
  assert.equal(normalized.state, "PR");
  assert.equal(normalized.stateRegistration, "");
});
