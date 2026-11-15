import assert from "node:assert/strict";
import test from "node:test";
import { resolveSalesOrderPaymentPolicy } from "./sales-order-payment-policy";

test("keeps an order on terms when approved credit covers the total", () => {
  assert.deepEqual(
    resolveSalesOrderPaymentPolicy({
      paymentType: "TERM",
      customerActive: true,
      creditStatus: "APPROVED",
      creditLimit: 10_000,
      openReceivables: 2_000,
      orderTotal: 7_500,
    }),
    { mode: "CREDIT", reason: "APPROVED_CREDIT", availableCredit: 8_000 },
  );
});

test("falls back to Pix when credit is not approved", () => {
  assert.deepEqual(
    resolveSalesOrderPaymentPolicy({
      paymentType: "TERM",
      customerActive: true,
      creditStatus: "NOT_ANALYZED",
      creditLimit: 0,
      openReceivables: 0,
      orderTotal: 340,
    }),
    { mode: "PIX", reason: "CREDIT_NOT_APPROVED", availableCredit: 0 },
  );
});

test("falls back to Pix instead of overspending the available limit", () => {
  assert.deepEqual(
    resolveSalesOrderPaymentPolicy({
      paymentType: "TERM",
      customerActive: true,
      creditStatus: "APPROVED",
      creditLimit: 1_000,
      openReceivables: 700,
      orderTotal: 340,
    }),
    { mode: "PIX", reason: "INSUFFICIENT_CREDIT", availableCredit: 300 },
  );
});

test("cash orders always receive Pix", () => {
  assert.equal(
    resolveSalesOrderPaymentPolicy({
      paymentType: "CASH",
      customerActive: true,
      creditStatus: "APPROVED",
      creditLimit: 10_000,
      openReceivables: 0,
      orderTotal: 100,
    }).mode,
    "PIX",
  );
});

test("inactive customers remain blocked", () => {
  assert.equal(
    resolveSalesOrderPaymentPolicy({
      paymentType: "CASH",
      customerActive: false,
      orderTotal: 100,
    }).mode,
    "BLOCKED",
  );
});
