import test from "node:test";
import assert from "node:assert/strict";
import { createSignaOrderDraft, parseSignaOrderDraft, signaOrderDraftKey } from "./signa-order-draft";

const allowed = new Set(["reserva-500", "reserva-1000"]);

test("persists only allowed products, quantities and operational date, not customer or fiscal data", () => {
  const input = [{ productVariantId: "reserva-500", quantity: 2, customerName: "Private", unitPrice: 76.8 }];
  const draft = createSignaOrderDraft(input, allowed, "PICKUP", "2026-12-15", 100000);
  assert.ok(draft);
  assert.deepEqual(draft.lines, [{ productVariantId: "reserva-500", quantity: 2 }]);
  assert.equal(JSON.stringify(draft).includes("Private"), false);
  assert.equal(JSON.stringify(draft).includes("76.8"), false);
  assert.deepEqual(parseSignaOrderDraft(JSON.stringify(draft), allowed, 100100), draft);
});

test("rejects disabled catalog SKUs, repeated SKUs, invalid quantity and impossible date", () => {
  assert.equal(createSignaOrderDraft([{ productVariantId: "other", quantity: 1 }], allowed, "PICKUP", ""), null);
  assert.equal(createSignaOrderDraft([{ productVariantId: "reserva-500", quantity: 0 }], allowed, "PICKUP", ""), null);
  assert.equal(createSignaOrderDraft([{ productVariantId: "reserva-500", quantity: 1.5 }], allowed, "PICKUP", ""), null);
  assert.equal(createSignaOrderDraft([{ productVariantId: "reserva-500", quantity: 1 }, { productVariantId: "reserva-500", quantity: 1 }], allowed, "PICKUP", ""), null);
  assert.equal(createSignaOrderDraft([{ productVariantId: "reserva-500", quantity: 1 }], allowed, "PICKUP", "2026-02-30"), null);
});

test("recovery requires current catalog permission, valid storage and 30-day TTL", () => {
  const draft = createSignaOrderDraft([{ productVariantId: "reserva-1000", quantity: 3 }], allowed, "CUSTOMER_CARRIER", "", 100000);
  assert.ok(draft);
  assert.equal(parseSignaOrderDraft(JSON.stringify(draft), new Set(["reserva-500"]), 100001), null);
  assert.equal(parseSignaOrderDraft(JSON.stringify(draft), allowed, 100000 + 31 * 86400000), null);
  assert.equal(parseSignaOrderDraft("{bad", allowed), null);
  assert.equal(parseSignaOrderDraft(JSON.stringify({ ...draft, savedAt: 200000 }), allowed, 100000), null);
  assert.notEqual(signaOrderDraftKey("partner-a"), signaOrderDraftKey("partner-b"));
});


test("recovery strips injected customer, fiscal and pricing fields from forged local storage", () => {
  const original = createSignaOrderDraft([{ productVariantId: "reserva-500", quantity: 1 }], allowed, "PICKUP", "", 100000);
  assert.ok(original);
  const poisoned = {
    ...original,
    customerId: "private-customer",
    billingRecipientId: "private-billing",
    totalAmount: 99999,
    lines: [{ productVariantId: "reserva-500", quantity: 1, unitPrice: 76.8, taxId: "private-tax-id" }],
  };
  const restored = parseSignaOrderDraft(JSON.stringify(poisoned), allowed, 100001);
  assert.deepEqual(restored, original);
  for (const sensitive of ["private-customer", "private-billing", "private-tax-id", "76.8", "99999"]) {
    assert.equal(JSON.stringify(restored).includes(sensitive), false);
  }
});
