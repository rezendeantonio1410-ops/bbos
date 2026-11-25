import assert from "node:assert/strict";
import test from "node:test";
import { eventPayloads } from "./storefront-analytics";

const items = [{ id: "caramelo", name: "Caramelo", priceCents: 6800, quantity: 2 }];

test("funnel steps map to Meta and Google names with value in reais", () => {
  const add = eventPayloads("add_to_cart", items);
  assert.equal(add.meta.name, "AddToCart");
  assert.equal(add.google.name, "add_to_cart");
  assert.equal(add.meta.params.value, 136);
  assert.equal(add.meta.params.num_items, 2);
  assert.equal(add.google.params.items[0]?.price, 68);
});

test("purchase carries the order id so it is never counted twice", () => {
  const buy = eventPayloads("purchase", items, { valueCents: 15890, orderId: "WEB-1" });
  assert.equal(buy.meta.name, "Purchase");
  assert.equal(buy.meta.params.value, 158.9);
  assert.deepEqual(buy.meta.options, { eventID: "purchase-WEB-1" });
  assert.equal((buy.google.params as { transaction_id?: string }).transaction_id, "WEB-1");
});
