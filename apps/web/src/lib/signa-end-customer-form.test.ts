import assert from "node:assert/strict";
import test from "node:test";
import {
  emptySignaEndCustomerForm,
  formatCnpj,
  isValidCnpj,
  validateSignaEndCustomerForm,
} from "./signa-end-customer-form";

const complete = {
  ...emptySignaEndCustomerForm,
  name: " Café Central ", taxId: "11.222.333/0001-81", postalCode: "86010-010",
  street: "Rua Exemplo", number: "25", district: "Centro", city: "Londrina", state: "pr",
};

test("CNPJ: dígitos verificadores e máscara", () => {
  assert.equal(isValidCnpj("11.222.333/0001-81"), true);
  for (const invalid of ["11.222.333/0001-82", "00000000000000", "1122233300018", ""]) {
    assert.equal(isValidCnpj(invalid), false, invalid);
  }
  assert.equal(formatCnpj("11222333000181"), "11.222.333/0001-81");
  assert.equal(formatCnpj("1122"), "11.22");
});

test("ficha completa é normalizada e complemento é opcional", () => {
  const result = validateSignaEndCustomerForm(complete);
  assert.ok(result.ok);
  if (result.ok) {
    assert.equal(result.payload.taxId, "11222333000181");
    assert.equal(result.payload.postalCode, "86010010");
    assert.equal(result.payload.state, "PR");
    assert.equal(result.payload.complement, "");
  }
});

test("cada campo obrigatório bloqueia o salvamento com mensagem própria", () => {
  for (const field of ["name", "taxId", "postalCode", "street", "number", "district", "city", "state"] as const) {
    const result = validateSignaEndCustomerForm({ ...complete, [field]: "" });
    assert.equal(result.ok, false, field);
  }
  assert.equal(validateSignaEndCustomerForm({ ...complete, state: "XX" }).ok, false);
});

test("Signa form accepts the new alphanumeric CNPJ (official example) and masks it", () => {
  assert.equal(isValidCnpj("12.ABC.345/01DE-35"), true);
  assert.equal(isValidCnpj("12ABC34501DE36"), false);
  assert.equal(formatCnpj("12abc34501de35"), "12.ABC.345/01DE-35");
  assert.equal(formatCnpj("12AB"), "12.AB");
  const result = validateSignaEndCustomerForm({
    name: "Cafeteria Teste", taxId: "12.abc.345/01de-35", postalCode: "86010-000", street: "Rua A", number: "10",
    district: "Centro", complement: "", city: "Londrina", state: "PR", stateRegistration: "",
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.payload.taxId, "12ABC34501DE35");
});
