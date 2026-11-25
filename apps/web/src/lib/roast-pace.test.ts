import assert from "node:assert/strict";
import test from "node:test";
import { businessDaysLeft, roastPace } from "./roast-pace";

test("25/11/2026 (quarta): restam 26, 27 e 30 como dias úteis", () => {
  assert.equal(businessDaysLeft(new Date(2026, 10, 25)), 3);
});

test("ritmo da torra mostra o atraso e quanto torrar por dia", () => {
  const pace = roastPace(42, 359, new Date(2026, 10, 25));
  assert.deepEqual(pace, { expectedKg: 299, behindKg: 257, missingKg: 317, daysLeft: 3, perDayKg: 106 });
  assert.equal(roastPace(320, 359, new Date(2026, 10, 25)).behindKg, 0);
  assert.equal(roastPace(10, 0, new Date(2026, 10, 25)).expectedKg, 0);
});
