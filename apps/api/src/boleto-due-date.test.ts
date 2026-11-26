import assert from "node:assert/strict";
import test from "node:test";
import { boletoDueDate } from "./boleto-itau";

const today = new Date("2026-11-27T15:00:00Z");
test("boleto due date: receivable's date, a chosen date, never in the past", () => {
  assert.equal(boletoDueDate(undefined, new Date("2026-12-07T12:00:00Z"), today).toISOString().slice(0, 10), "2026-12-07");
  assert.equal(boletoDueDate("2026-12-15", new Date("2026-11-20T12:00:00Z"), today).toISOString().slice(0, 10), "2026-12-15");
  assert.equal(boletoDueDate("2026-11-27", new Date("2026-11-20T12:00:00Z"), today).toISOString().slice(0, 10), "2026-11-27");
  assert.throws(() => boletoDueDate(undefined, new Date("2026-11-20T12:00:00Z"), today), /já passou/);
  assert.throws(() => boletoDueDate("2028-01-01", new Date(), today), /1 ano/);
});
