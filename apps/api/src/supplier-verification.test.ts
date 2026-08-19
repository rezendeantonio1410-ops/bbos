import test from "node:test";
import assert from "node:assert/strict";
import { isValidCnpj, isValidCpf, validateStateRegistration, validateTaxId } from "./supplier-verification";

test("valida CPF e CNPJ por dígitos verificadores", () => {
  assert.equal(isValidCpf("529.982.247-25"), true);
  assert.equal(isValidCpf("111.111.111-11"), false);
  assert.equal(isValidCnpj("11.222.333/0001-81"), true);
  assert.equal(isValidCnpj("11.111.111/1111-11"), false);
  assert.equal(validateTaxId("52998224725"), "CPF");
  assert.equal(validateTaxId("11.111.111/1111-11"), null);
});

test("valida formato de IE por UF sem simular consulta externa", () => {
  assert.equal(validateStateRegistration("1234567890", "PR"), true);
  assert.equal(validateStateRegistration("123", "PR"), false);
  assert.equal(validateStateRegistration("123456789", "ES"), true);
});
