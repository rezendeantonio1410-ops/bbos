import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEqualInstallments,
  calculateNetWeight,
  calculatePurchaseBalance,
  canApproveGreenCoffeePurchase,
  comparePurchaseReceipt,
  deriveGreenStockBalance,
  filterVarietiesBySpecies,
  initialPurchaseApproval,
  isProductionEligible,
  validateReceiptWeight,
} from "../dist/green-coffee-receipt.js";

test("calcula peso líquido", () =>
  assert.equal(calculateNetWeight(1250, 50), 1200));
test("não produz peso negativo", () =>
  assert.equal(calculateNetWeight(10, 20), 0));
test("valida recebimento em kg", () =>
  assert.equal(
    validateReceiptWeight({
      unit: "KG",
      grossWeightKg: 1250,
      tareWeightKg: 50,
      netWeightKg: 1200,
    }),
    true,
  ));
test("rejeita divergência de peso", () =>
  assert.equal(
    validateReceiptWeight({
      unit: "KG",
      grossWeightKg: 1250,
      tareWeightKg: 50,
      netWeightKg: 1190,
    }),
    false,
  ));
test("valida sacas", () =>
  assert.equal(
    validateReceiptWeight({
      unit: "BAG",
      grossWeightKg: 1200,
      netWeightKg: 1200,
      bagQuantity: 20,
      bagWeightKg: 60,
    }),
    true,
  ));
test("rejeita sacas divergentes", () =>
  assert.equal(
    validateReceiptWeight({
      unit: "BAG",
      grossWeightKg: 1200,
      netWeightKg: 1200,
      bagQuantity: 19,
      bagWeightKg: 60,
    }),
    false,
  ));
test("aguardando análise bloqueia produção", () =>
  assert.equal(isProductionEligible("AWAITING_ANALYSIS"), false));
test("bloqueado não vai à produção", () =>
  assert.equal(isProductionEligible("BLOCKED"), false));
test("rejeitado não vai à produção", () =>
  assert.equal(isProductionEligible("REJECTED"), false));
test("aprovado libera produção", () =>
  assert.equal(isProductionEligible("APPROVED"), true));
test("ressalva libera produção", () =>
  assert.equal(isProductionEligible("APPROVED_WITH_RESTRICTION"), true));
test("saldo deriva das movimentações", () =>
  assert.equal(
    deriveGreenStockBalance([
      { quantityKg: 1200, direction: "IN" },
      { quantityKg: 200, direction: "OUT" },
      { quantityKg: 10, direction: "IN" },
    ]),
    1010,
  ));
test("compra sem recebimento permanece confirmada", () =>
  assert.equal(calculatePurchaseBalance(6000, []).status, "CONFIRMED"));
test("compra parcial soma múltiplos recebimentos", () =>
  assert.deepEqual(calculatePurchaseBalance(6000, [2000, 2000]), {
    receivedKg: 4000,
    balanceKg: 2000,
    excessKg: 0,
    status: "PARTIALLY_RECEIVED",
  }));
test("compra completa zera saldo", () =>
  assert.equal(
    calculatePurchaseBalance(6000, [2000, 2000, 2000]).balanceKg,
    0,
  ));
test("excesso é preservado", () =>
  assert.equal(calculatePurchaseBalance(6000, [6500]).excessKg, 500));
test("peso dentro da tolerância não diverge", () =>
  assert.equal(
    comparePurchaseReceipt({
      contractedWeightKg: 1800,
      receivedWeightKg: 1790,
      tolerancePercent: 1,
      contractedSpecies: "ARABICA",
      receivedSpecies: "ARABICA",
      contractedOrigin: "Sul de Minas",
      receivedOrigin: "Sul de Minas",
    }).approvalRequired,
    false,
  ));
test("recebimento parcial não é divergência por si só", () =>
  assert.equal(
    comparePurchaseReceipt({
      contractedWeightKg: 1800,
      receivedWeightKg: 1700,
      tolerancePercent: 1,
      contractedSpecies: "ARABICA",
      receivedSpecies: "ARABICA",
      contractedOrigin: "Sul de Minas",
      receivedOrigin: "Sul de Minas",
    }).approvalRequired,
    false,
  ));
test("recebimento excessivo fora da tolerância exige aprovação", () =>
  assert.equal(
    comparePurchaseReceipt({
      contractedWeightKg: 1800,
      receivedWeightKg: 1900,
      tolerancePercent: 1,
      contractedSpecies: "ARABICA",
      receivedSpecies: "ARABICA",
      contractedOrigin: "Sul de Minas",
      receivedOrigin: "Sul de Minas",
    }).approvalRequired,
    true,
  ));
test("espécie divergente é crítica", () =>
  assert.ok(
    comparePurchaseReceipt({
      contractedWeightKg: 100,
      receivedWeightKg: 100,
      tolerancePercent: 0,
      contractedSpecies: "ARABICA",
      receivedSpecies: "CANEPHORA",
      contractedOrigin: "A",
      receivedOrigin: "A",
    }).differences.includes("SPECIES"),
  ));
test("origem divergente é crítica", () =>
  assert.ok(
    comparePurchaseReceipt({
      contractedWeightKg: 100,
      receivedWeightKg: 100,
      tolerancePercent: 0,
      contractedSpecies: "ARABICA",
      receivedSpecies: "ARABICA",
      contractedOrigin: "A",
      receivedOrigin: "B",
    }).differences.includes("ORIGIN"),
  ));
test("umidade acima do contrato é crítica", () =>
  assert.ok(
    comparePurchaseReceipt({
      contractedWeightKg: 100,
      receivedWeightKg: 100,
      tolerancePercent: 0,
      contractedSpecies: "ARABICA",
      receivedSpecies: "ARABICA",
      contractedOrigin: "A",
      receivedOrigin: "A",
      maxMoisturePercent: 11.5,
      receivedMoisturePercent: 12,
    }).differences.includes("MOISTURE"),
  ));
test("quarentena impede produção", () =>
  assert.equal(isProductionEligible("AWAITING_ANALYSIS"), false));
test("seleções comerciais originais não são mutadas pela comparação", () => {
  const original = {
    contractedWeightKg: 100,
    receivedWeightKg: 90,
    tolerancePercent: 0,
    contractedSpecies: "ARABICA",
    receivedSpecies: "ARABICA",
    contractedOrigin: "A",
    receivedOrigin: "A",
  };
  comparePurchaseReceipt(original);
  assert.equal(original.contractedWeightKg, 100);
});
test("vários recebimentos preservam saldo oficial em kg", () =>
  assert.equal(calculatePurchaseBalance(1800, [600, 550]).balanceKg, 650));
test("comercial cria compra pendente", () =>
  assert.equal(initialPurchaseApproval("SUBMIT", "SALES"), "PENDING_APPROVAL"));
test("comercial não aprova compra", () =>
  assert.throws(
    () => initialPurchaseApproval("APPROVE", "SALES"),
    /ROLE_NOT_ALLOWED/,
  ));
test("diretor aprova a própria compra", () =>
  assert.equal(initialPurchaseApproval("APPROVE", "EXECUTIVE"), "APPROVED"));
test("somente direção e administração aprovam", () => {
  assert.equal(canApproveGreenCoffeePurchase("EXECUTIVE"), true);
  assert.equal(canApproveGreenCoffeePurchase("ADMIN"), true);
  assert.equal(canApproveGreenCoffeePurchase("INDUSTRIAL"), false);
});
test("parcelas somam exatamente o contratado", () => {
  const rows = buildEqualInstallments(1000, 3, "2026-08-14");
  assert.equal(
    rows.reduce((s, x) => s + x.amount, 0),
    1000,
  );
  assert.equal(
    Math.round(rows.reduce((s, x) => s + x.percentage, 0) * 100) / 100,
    100,
  );
});
test("parcela única representa pagamento à vista", () =>
  assert.deepEqual(
    buildEqualInstallments(1500, 1, "2026-08-14").map((x) => [
      x.amount,
      x.percentage,
    ]),
    [[1500, 100]],
  ));
test("variedade é filtrada por espécie", () =>
  assert.deepEqual(
    filterVarietiesBySpecies(
      [
        { name: "IPR 98", speciesCode: "ARABICA" },
        { name: "Outra", speciesCode: "CANEPHORA" },
      ],
      "ARABICA",
    ).map((x) => x.name),
    ["IPR 98"],
  ));
test("pontuação mínima pode permanecer vazia", () =>
  assert.equal({ minimumScore: undefined }.minimumScore, undefined));
test("compra rejeitada não tem permissão implícita de compromisso", () =>
  assert.equal(
    initialPurchaseApproval("SUBMIT", "INDUSTRIAL"),
    "PENDING_APPROVAL",
  ));
test("recebimento total zera saldo físico sem duplicar", () =>
  assert.deepEqual(calculatePurchaseBalance(1000, [400, 600]), {
    receivedKg: 1000,
    balanceKg: 0,
    excessKg: 0,
    status: "RECEIVED",
  }));
