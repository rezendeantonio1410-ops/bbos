import test from "node:test";
import assert from "node:assert/strict";
import { parseSignaServerDraftPayload, parseSignaDraftVersion } from "./signa-server-draft";

test("accepts an incomplete server draft without triggering an order or payment", () => {
  assert.deepEqual(parseSignaServerDraftPayload({}), {
    customerId: null, partnerEndCustomerId: null, billingRecipientId: null,
    items: [], deliveryMode: "PICKUP", carrierName: "",
    expectedDeliveryDate: "", customerReference: "", notes: "",
  });
});

test("preserves only explicitly permitted fields, including commercial/fiscal selections", () => {
  const draft = parseSignaServerDraftPayload({
    customerId: "signa", partnerEndCustomerId: "buyer-1",
    billingRecipientId: "rodrigo", items: [{ productVariantId: "reserva-500", quantity: 2 }],
    deliveryMode: "CUSTOMER_CARRIER", carrierName: "  Transportadora  ",
    expectedDeliveryDate: "2028-02-29", customerReference: "123", notes: "  Preferência  ",
  });
  assert.deepEqual(draft.items, [{ productVariantId: "reserva-500", quantity: 2 }]);
  assert.equal(draft.billingRecipientId, "rodrigo");
  assert.equal(draft.expectedDeliveryDate, "2028-02-29");
  assert.equal(draft.carrierName, "Transportadora");
  assert.equal(draft.notes, "Preferência");
});

test("rejects forged prices, fiscal/finance fields, duplicate SKUs, invalid quantities and dates", () => {
  for (const payload of [
    { totalAmount: 0 },
    { taxId: "11111111111" },
    { paymentType: "CASH" },
    { companyId: "other" },
    { partnerId: "other" },
    { items: [{ productVariantId: "reserva-500", quantity: 1, unitPrice: 0 }] },
    { items: [{ productVariantId: "reserva-500", quantity: 1 }, { productVariantId: "reserva-500", quantity: 1 }] },
    { items: [{ productVariantId: "reserva-500", quantity: 0 }] },
    { items: [{ productVariantId: "reserva-500", quantity: 2.1 }] },
    { expectedDeliveryDate: "2027-02-29" },
    { notes: "x".repeat(2001) },
    { items: "invalid" },
  ]) {
    assert.throws(() => parseSignaServerDraftPayload(payload));
  }
});

test("duplicating a server draft copies allowed payload only, not identity or concurrency metadata", () => {
  const saved = {
    id: "draft-original", version: 7, companyId: "company-a", userId: "user-a",
    payload: {
      customerId: "signa", partnerEndCustomerId: null, billingRecipientId: null,
      items: [{ productVariantId: "reserva-500", quantity: 3 }],
      notes: "  Entregar após conferência  ",
    },
  };
  // POST must receive only `saved.payload`, never the record's scope or metadata.
  assert.throws(() => parseSignaServerDraftPayload(saved));
  const duplicated = parseSignaServerDraftPayload(saved.payload);
  assert.deepEqual(duplicated.items, [{ productVariantId: "reserva-500", quantity: 3 }]);
  assert.equal(duplicated.customerId, "signa");
  assert.equal(duplicated.notes, "Entregar após conferência");
  assert.equal("id" in duplicated, false);
  assert.equal("version" in duplicated, false);
  assert.equal("userId" in duplicated, false);
  assert.notStrictEqual(duplicated.items, saved.payload.items);
});

test("rejects invalid concurrency versions", () => {
  for (const value of [0, -1, null, "1", 1.2, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => parseSignaDraftVersion(value));
  }
  assert.equal(parseSignaDraftVersion(3), 3);
});
