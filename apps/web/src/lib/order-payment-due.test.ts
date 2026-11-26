import assert from "node:assert/strict";
import test from "node:test";
import { orderPaymentDue } from "./order-payment-due";

const now = new Date(2026, 10, 26, 21, 0); // 26/11/2026 21h local

test("sem vencimento não mostra nada", () => {
  assert.equal(orderPaymentDue(null, now), null);
  assert.equal(orderPaymentDue("x", now), null);
});

test("vencimento passado fica como vencido", () => {
  assert.deepEqual(orderPaymentDue("2026-11-25T00:00:00Z", now), {
    label: "Vencido 25/11/2026",
    tone: "overdue",
  });
});

test("vencimento hoje e futuro", () => {
  assert.equal(orderPaymentDue("2026-11-26T00:00:00Z", now)?.tone, "today");
  assert.deepEqual(orderPaymentDue("2026-12-02T00:00:00Z", now), {
    label: "Vence 02/12/2026",
    tone: "upcoming",
  });
});
