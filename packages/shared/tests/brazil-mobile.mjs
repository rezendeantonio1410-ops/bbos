import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeCustomerPhone as normalize,
  formatBrazilMobile as format,
} from "../dist/brazil-mobile.js";
test("normaliza celular brasileiro com máscara, DDI ou apenas DDD", () => {
  for (const value of [
    "43999129191",
    "(43) 99912-9191",
    "+5543999129191",
    "5543999129191",
  ]) {
    assert.equal(normalize(value), "+5543999129191");
  }
  assert.equal(normalize("55999129191"), "+5555999129191");
});
test("rejeita excesso de dígitos, DDD inválido, celular sem 9 e letras", () => {
  for (const value of [
    "+55439991291910",
    "439991291910",
    "00999129191",
    "43899129191",
    "abc43999129191",
  ]) {
    assert.throws(() => normalize(value));
  }
});
test("preserva campo opcional e números internacionais existentes", () => {
  assert.equal(normalize(""), null);
  assert.equal(normalize("+351912345678"), "+351912345678");
});
test("formata sem apagar silenciosamente dígitos de cadastro inválido", () => {
  assert.equal(format("+5543999129191"), "(43) 99912-9191");
  assert.equal(format("+55439991291910"), "439991291910");
});
