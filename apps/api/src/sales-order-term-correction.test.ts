import assert from "node:assert/strict";
import test from "node:test";
import { fourteenDayDueDate, parseTermCorrection } from "./sales-order-term-correction";

test("14-day term correction requires an explicit justification and forbids extra fields", () => {
  assert.deepEqual(parseTermCorrection({ days: 14, reason: "Venda negociada a prazo com 14 dias" }), {
    days: 14, reason: "Venda negociada a prazo com 14 dias",
  });
  for (const body of [null, {}, { days: 30, reason: "Venda negociada a prazo" },
    { days: 14, reason: "curto" },
    { days: 14, reason: "Venda a prazo aprovada", amount: 0 },
  ]) assert.throws(() => parseTermCorrection(body));
});

test("date is based on order date in São Paulo, not QR code expiration", () => {
  assert.equal(fourteenDayDueDate(new Date("2026-11-23T20:03:40.405Z")).toISOString().slice(0,10),"2026-12-07");
  assert.equal(fourteenDayDueDate(new Date("2026-11-24T01:00:00.000Z")).toISOString().slice(0,10),"2026-12-07");
});
