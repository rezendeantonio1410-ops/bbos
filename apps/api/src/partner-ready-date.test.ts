import assert from "node:assert/strict";
import test from "node:test";
import { isValidPartnerRequestedReadyDate } from "./partner-ready-date";

test("aceita datas reais no formato ISO, inclusive ano bissexto", () => {
  assert.equal(isValidPartnerRequestedReadyDate("2026-11-22"), true);
  assert.equal(isValidPartnerRequestedReadyDate("2028-02-29"), true);
});

test("rejeita datas inexistentes, formatos ambíguos e espaços", () => {
  for (const invalid of [
    "2026-02-29", "2026-11-31", "2026-13-01", "2026-00-01",
    "22/11/2026", "2026-1-02", "2026-11-22 ", "2026-11-22T09:00:00Z",
    "\\d{4}-\\d{2}-\\d{2}", "",
  ]) {
    assert.equal(isValidPartnerRequestedReadyDate(invalid), false, invalid);
  }
});
