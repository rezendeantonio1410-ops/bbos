import assert from "node:assert/strict";
import test from "node:test";
import { planInboundPayables } from "./inbound-payables";

test("one payable per duplicata, with stable keys", () => {
  const plan = planInboundPayables({
    id: "doc1", number: "4521", issueDate: "2026-11-10T00:00:00Z", totalAmount: "900",
    paymentSnapshot: [{ number: "001", dueDate: "2026-12-10", amount: 450 }, { number: "002", dueDate: "2027-01-10", amount: "450.00" }],
  });
  assert.deepEqual(plan, [
    { key: "doc1:1".replace(/^/, "nfe-in:"), number: "001", dueDate: "2026-12-10", amount: 450 },
    { key: "nfe-in:doc1:2", number: "002", dueDate: "2027-01-10", amount: 450 },
  ]);
});

test("no duplicatas: single payable due on the issue date; nothing without value", () => {
  assert.deepEqual(planInboundPayables({ id: "d2", issueDate: new Date("2026-11-18T03:00:00Z"), totalAmount: 120.5, paymentSnapshot: [{ number: "01", dueDate: null, amount: 120.5 }] }), [
    { key: "nfe-in:d2:1", number: "001", dueDate: "2026-11-18", amount: 120.5 },
  ]);
  assert.deepEqual(planInboundPayables({ id: "d3", issueDate: null, totalAmount: 10 }), []);
  assert.deepEqual(planInboundPayables({ id: "d4", issueDate: "2026-11-01", totalAmount: 0 }), []);
});
