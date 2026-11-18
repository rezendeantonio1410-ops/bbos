import assert from "node:assert/strict";
import test from "node:test";

import {
  confidenceLabel,
  formatCnpj,
  normalizeTaxId,
} from "./customer-tax-id-suggestion-panel";

test("normaliza e formata um CNPJ completo", () => {
  assert.equal(normalizeTaxId("12.345.678/0001-90"), "12345678000190");
  assert.equal(formatCnpj("12345678000190"), "12.345.678/0001-90");
});

test("preserva o valor enquanto o CNPJ ainda estiver incompleto", () => {
  assert.equal(formatCnpj("12345678"), "12345678");
});

test("traduz a confiança da sugestão em orientação clara", () => {
  assert.equal(confidenceLabel(0.9), "Compatibilidade alta");
  assert.equal(confidenceLabel(0.7), "Compatibilidade média");
  assert.equal(confidenceLabel(0.4), "Revisar com atenção");
});
