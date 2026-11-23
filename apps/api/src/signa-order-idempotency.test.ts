import assert from "node:assert/strict";
import test from "node:test";
import {
  hashSignaOrderSubmissionRequest,
  parseSignaOrderSubmissionKey,
} from "./signa-order-idempotency";

test("chave de submissão exige formato estável e não aceita caracteres de controle", () => {
  const key = "b2e5d40c-c041-4e08-a588-214a63fa2181";
  assert.equal(parseSignaOrderSubmissionKey(key), key);
  for (const invalid of [null, "", "short", "p".repeat(129), " key-1234567890123456",
    "key-1234567890123456\\n", "key/1234567890123456", 42]) {
    assert.throws(() => parseSignaOrderSubmissionKey(invalid));
  }
});

test("fingerprint é determinístico para objetos com chaves em ordem diferente", () => {
  const first = { customerId: "c1", items: [{ productVariantId: "v1", quantity: 5 }],
    billingRecipientId: "f1", paymentType: "TERM", paymentTermDays: 30 };
  const reordered = { paymentTermDays: 30, billingRecipientId: "f1", paymentType: "TERM",
    items: [{ quantity: 5, productVariantId: "v1" }], customerId: "c1" };
  assert.equal(hashSignaOrderSubmissionRequest(first),
    hashSignaOrderSubmissionRequest(reordered));
});

test("mesma chave não poderá representar destinatário, quantidades ou condições diferentes", () => {
  const baseline = { customerId: "c1", billingRecipientId: "f1",
    items: [{ productVariantId: "v1", quantity: 1 }], paymentType: "CASH" };
  const original = hashSignaOrderSubmissionRequest(baseline);
  for (const modified of [
    { ...baseline, billingRecipientId: "f2" },
    { ...baseline, items: [{ productVariantId: "v1", quantity: 2 }] },
    { ...baseline, paymentType: "TERM", paymentTermDays: 30 },
  ]) {
    assert.notEqual(hashSignaOrderSubmissionRequest(modified), original);
  }
});

test("recusa corpo inválido, valores não serializáveis e payload excessivo", () => {
  for (const invalid of [null, [], "pedido", { quantity: Infinity },
    { callback: () => 1 }, { notes: "x".repeat(65537) }]) {
    assert.throws(() => hashSignaOrderSubmissionRequest(invalid));
  }
});
