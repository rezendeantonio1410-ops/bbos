import assert from "node:assert/strict";
import test from "node:test";
import { evaluateReconciliationMatch, selectUniqueReconciliationPairs } from "../dist/reconciliation-engine.js";

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

test("conciliação segura exige pares únicos dos dois lados", () => {
  const result = selectUniqueReconciliationPairs(
    ["bank-1", "bank-2", "bank-3"],
    [
      { itemId: "bank-1", transactionId: "book-1" },
      { itemId: "bank-2", transactionId: "book-2" },
      { itemId: "bank-2", transactionId: "book-3" },
    ],
  );
  assert.deepEqual(result.safe, [{ itemId: "bank-1", transactionId: "book-1" }]);
  assert.deepEqual(result.ambiguousItemIds, ["bank-2"]);
  assert.deepEqual(result.unmatchedItemIds, ["bank-3"]);
});

test("um mesmo lançamento interno não é conciliado por ordem da lista", () => {
  const result = selectUniqueReconciliationPairs(
    ["bank-1", "bank-2"],
    [
      { itemId: "bank-1", transactionId: "book-1" },
      { itemId: "bank-2", transactionId: "book-1" },
    ],
  );
  assert.equal(result.safe.length, 0);
  assert.deepEqual(result.ambiguousItemIds, ["bank-1", "bank-2"]);
});
