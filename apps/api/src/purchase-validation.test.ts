import { test } from "node:test";
import assert from "node:assert/strict";
import { missingPurchaseApprovalFields } from "./purchase-validation";

const complete = (maxMoisturePercent: number) => ({
  supplierId: "supplier-1",
  supplier: { id: "supplier-1", name: "Fornecedor", taxId: "00.000.000/0001-00", city: "Londrina", state: "PR" },
  species: "ARABICA",
  harvest: "2026/27",
  contractedWeightKg: 300,
  pricePerKg: 12,
  totalValue: 3600,
  paymentTermType: "INSTALLMENTS",
  expectedAt: new Date(),
  process: "Natural",
  qualityCategory: "Comercial",
  maxMoisturePercent,
});

test("umidade máxima aceita os limites operacionais", () => {
  assert.equal(missingPurchaseApprovalFields(complete(10)).some((item) => item.includes("Umidade")), false);
  assert.equal(missingPurchaseApprovalFields(complete(12.5)).some((item) => item.includes("Umidade")), false);
});

test("umidade máxima rejeita valores fora do intervalo", () => {
  assert.equal(missingPurchaseApprovalFields(complete(9.9)).some((item) => item.includes("Umidade")), true);
  assert.equal(missingPurchaseApprovalFields(complete(12.6)).some((item) => item.includes("Umidade")), true);
});
