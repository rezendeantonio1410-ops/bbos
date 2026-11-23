import assert from "node:assert/strict";
import test from "node:test";
import {
  approvedPurchaseCorrectionEligible,
  approvedPurchaseFiscalCorrectionEligible,
  parseApprovedPurchaseValueCorrection,
} from "./approved-purchase-value-correction";

test("approved purchase correction accepts the corrected R$ 9.100 and records the old value", () => {
  assert.deepEqual(parseApprovedPurchaseValueCorrection({
    expectedTotalValue: 9000,
    totalValue: 9100,
    reason: "Correção de valor digitado antes da entrada do XML",
  }), {
    expectedTotalValue: 9000, totalValue: 9100,
    reason: "Correção de valor digitado antes da entrada do XML",
  });
});

test("rejects unauthorized fields, fractions of cents and vague reasons", () => {
  for (const input of [
    null, {}, { expectedTotalValue: 9000, totalValue: 9100, reason: "curto" },
    { expectedTotalValue: 9000, totalValue: 9000, reason: "Correção comercial aprovada" },
    { expectedTotalValue: 9000, totalValue: 9100.001, reason: "Correção comercial aprovada" },
    { expectedTotalValue: 9000, totalValue: -9100, reason: "Correção comercial aprovada" },
    { expectedTotalValue: 9000, totalValue: 9100, reason: "Correção comercial aprovada", companyId: "other" },
  ]) assert.throws(() => parseApprovedPurchaseValueCorrection(input));
});

test("only unreceived, unaccepted BRL cash purchases without commission are eligible", () => {
  const purchase = {
    approvalStatus: "APPROVED", status: "CONFIRMED",
    externalAcceptanceStatus: "NOT_SENT",
    operationalStatus: "AWAITING_DELIVERY",
    paymentTermType: "CASH", currency: "BRL",
    brokerCommissionAmount: null, pricePerBag: null,
  };
  assert.equal(approvedPurchaseCorrectionEligible(purchase), true);
  for (const [field, value] of [
    ["approvalStatus", "DRAFT"],
    ["status", "CANCELLED"],
    ["externalAcceptanceStatus", "ACCEPTED"],
    ["operationalStatus", "RECEIVED"],
    ["paymentTermType", "TERM"],
    ["currency", "USD"],
    ["brokerCommissionAmount", 100],
    ["pricePerBag", 1500],
  ] as const) {
    assert.equal(approvedPurchaseCorrectionEligible({ ...purchase, [field]: value }), false, field);
  }
});

test("correcting to the authorized linked NF-e amount keeps the invoice unchanged", () => {
  const invoice = {
    allocationType: "GREEN_COFFEE_PURCHASE",
    direction: "INBOUND",
    status: "AUTHORIZED",
    matchStatus: "DIVERGENT",
    totalAmount: 9100,
  };
  assert.equal(approvedPurchaseFiscalCorrectionEligible([], 9100), true);
  assert.equal(approvedPurchaseFiscalCorrectionEligible([invoice], 9100), true);
  assert.equal(approvedPurchaseFiscalCorrectionEligible([invoice], 9000), false);
  assert.equal(approvedPurchaseFiscalCorrectionEligible([invoice, invoice], 9100), false);
  for (const [field, value] of [
    ["allocationType", "OTHER"],
    ["direction", "OUTBOUND"],
    ["status", "REJECTED"],
    ["matchStatus", "MATCHED"],
    ["totalAmount", 9300],
  ] as const) {
    assert.equal(approvedPurchaseFiscalCorrectionEligible([{ ...invoice, [field]: value }], 9100), false, field);
  }
});
