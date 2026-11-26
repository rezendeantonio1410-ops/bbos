import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { checkoutDecision, readRemoteOrder, retryable, tokenNeedsRefresh, transientStatus } from "./melhor-envio-flow";

test("a label already paid is never paid again (resume after a failure)", () => {
  assert.equal(checkoutDecision({ status: "released", priceCents: 1455 }, 1455), "SKIP");
  assert.equal(checkoutDecision({ status: "generated", priceCents: 2000 }, 1455), "SKIP");
  assert.equal(checkoutDecision({ status: "pending", priceCents: 1455 }, 1455), "CHECKOUT");
  assert.equal(checkoutDecision(null, 1455), "CHECKOUT");
});

test("a new attempt also stops when the carrier price changed after the quote", () => {
  assert.equal(checkoutDecision({ status: "pending", priceCents: 1890 }, 1455), "PRICE_CHANGED");
  assert.equal(checkoutDecision({ status: "pending", priceCents: 1890 }, null), "CHECKOUT");
  assert.deepEqual(readRemoteOrder({ status: "Pending", price: "18.90" }), { status: "pending", priceCents: 1890 });
  assert.equal(readRemoteOrder({}), null);
});

test("only reads and prints are retried; slow or failing provider is retried", () => {
  assert.equal(retryable("GET", "/me/orders/1"), true);
  assert.equal(retryable("POST", "/me/shipment/tracking"), true);
  assert.equal(retryable("POST", "/me/shipment/checkout"), false);
  assert.equal(retryable("POST", "/me/cart"), false);
  assert.equal(transientStatus(503), true);
  assert.equal(transientStatus(429), true);
  assert.equal(transientStatus(422), false);
});

test("token is renewed ahead of time even without shipments", () => {
  const now = Date.parse("2026-11-26T12:00:00Z");
  assert.equal(tokenNeedsRefresh("2026-12-16T00:00:00Z", now, 10), false);
  assert.equal(tokenNeedsRefresh("2026-12-05T00:00:00Z", now, 10), true);
  assert.equal(tokenNeedsRefresh("2026-12-16T00:00:00Z", now, 1), false);
  assert.equal(tokenNeedsRefresh(null, now), true);
});

test("service wiring: timeout, no double checkout, superseded shipments skipped, label alert", () => {
  const service = readFileSync(join(__dirname, "melhor-envio-shipment.service.ts"), "utf8");
  assert.match(service, /AbortSignal\.timeout\(20_000\)/);
  assert.equal((service.match(/"\/me\/shipment\/checkout"/g) ?? []).length, 1);
  assert.equal((service.match(/"\/me\/shipment\/generate"/g) ?? []).length, 1);
  assert.match(service, /newer\.status='DELIVERED'/);
  const dashboard = readFileSync(join(__dirname, "dashboard.service.ts"), "utf8");
  assert.match(dashboard, /sem etiqueta há mais de 3 dias/);
});
