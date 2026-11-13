import assert from "node:assert/strict";
import test from "node:test";
import { LAB_DECISIONS, labDecisionForForm } from "./lab-decision";

test("shows and submits APPROVED for a pending analysis", () => {
  assert.equal(labDecisionForForm("AWAITING_ANALYSIS"), "APPROVED");
});

test("preserves every final quality decision", () => {
  for (const decision of LAB_DECISIONS) {
    assert.equal(labDecisionForForm(decision), decision);
  }
});
