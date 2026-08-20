import assert from "node:assert/strict";
import test from "node:test";
import { evaluateReconciliationMatch } from "../dist/reconciliation-engine.js";

const base = { externalDirection: "IN", transactionDirection: "IN", externalDate: "2026-08-08", transactionDate: "2026-08-08", externalReference: "NF-100", transactionReference: "NF-100", externalCounterparty: "Cliente A", transactionCounterparty: "Cliente A" };

test("match exato", () => {
  const result = evaluateReconciliationMatch({ ...base, externalAmount: 100, transactionAmount: 100 });
  assert.equal(result.status, "MATCHED");
  assert.equal(result.difference, 0);
});

test("divergência de direção ou valor", () => {
  assert.equal(evaluateReconciliationMatch({ ...base, externalAmount: 100, transactionAmount: 90 }).status, "DIVERGENT");
  assert.equal(evaluateReconciliationMatch({ ...base, externalDirection: "OUT", externalAmount: 100, transactionAmount: 100 }).status, "DIVERGENT");
});

test("match parcial", () => {
  const result = evaluateReconciliationMatch({ ...base, externalAmount: 100, transactionAmount: 100, matchedAmount: 60 });
  assert.equal(result.status, "PARTIALLY_MATCHED");
  assert.equal(result.difference, 40);
});

test("pendência sem correspondente contextual", () => {
  const result = evaluateReconciliationMatch({ ...base, externalAmount: 100, transactionAmount: 100, externalReference: "A", transactionReference: "B", externalDate: "2026-08-20", transactionDate: "2026-08-01", externalCounterparty: "A", transactionCounterparty: "B" });
  assert.equal(result.status, "PENDING");
});

test("matching respeita conta financeira", () => {
  const result = evaluateReconciliationMatch({ ...base, externalAmount: 100, transactionAmount: 100, externalAccountId: "conta-a", transactionAccountId: "conta-b" });
  assert.equal(result.status, "DIVERGENT");
  assert.match(result.reasons[0], /Contas/);
});

test("matching respeita moeda", () => {
  const result = evaluateReconciliationMatch({ ...base, externalAmount: 100, transactionAmount: 100, externalCurrency: "EUR", transactionCurrency: "BRL" });
  assert.equal(result.status, "DIVERGENT");
  assert.match(result.reasons[0], /Moedas/);
});

test("sugestão por cliente e data não confirma automaticamente", () => {
  const result = evaluateReconciliationMatch({ ...base, externalAmount: 125, transactionAmount: 100, externalReference: undefined, transactionReference: undefined });
  assert.equal(result.status, "DIVERGENT");
  assert.equal(result.confidence, "divergent");
  assert.ok(result.reasons.includes("cliente/fornecedor correspondente"));
});

test("movimentos de entrada e saída nunca são conciliados entre si", () => {
  const result = evaluateReconciliationMatch({ ...base, externalDirection: "OUT", externalAmount: 100, transactionAmount: 100 });
  assert.equal(result.status, "DIVERGENT");
  assert.equal(result.matchedAmount, 0);
});

test("valor parcial preserva diferença auditável", () => {
  const result = evaluateReconciliationMatch({ ...base, externalAmount: 250, transactionAmount: 250, matchedAmount: 175 });
  assert.equal(result.status, "PARTIALLY_MATCHED");
  assert.equal(result.matchedAmount, 175);
  assert.equal(result.difference, 75);
});
