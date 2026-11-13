import assert from "node:assert/strict";
import test from "node:test";
import { GreenCoffeeQualityStatus } from "@bbos/database";
import { isFinalLabDecision } from "./lab-analysis-decision";

test("keeps awaiting analysis out of the completed lab decisions", () => {
  assert.equal(
    isFinalLabDecision(GreenCoffeeQualityStatus.AWAITING_ANALYSIS),
    false,
  );
});

test("accepts every terminal lab decision", () => {
  assert.equal(isFinalLabDecision(GreenCoffeeQualityStatus.APPROVED), true);
  assert.equal(
    isFinalLabDecision(GreenCoffeeQualityStatus.APPROVED_WITH_RESTRICTION),
    true,
  );
  assert.equal(isFinalLabDecision(GreenCoffeeQualityStatus.BLOCKED), true);
  assert.equal(isFinalLabDecision(GreenCoffeeQualityStatus.REJECTED), true);
});
