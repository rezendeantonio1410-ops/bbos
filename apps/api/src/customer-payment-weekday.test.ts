import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { nextPaymentDay, parsePaymentWeekday } from "./customer-payment-weekday";

test("dia de pagamento: aceita 0 a 6 ou nenhum", () => {
  assert.equal(parsePaymentWeekday({ weekday: 4 }), 4);
  assert.equal(parsePaymentWeekday({ weekday: "4" }), 4);
  assert.equal(parsePaymentWeekday({ weekday: null }), null);
  assert.equal(parsePaymentWeekday({ weekday: "" }), null);
  assert.throws(() => parsePaymentWeekday({ weekday: 7 }), /válido/);
  assert.throws(() => parsePaymentWeekday({ weekday: 2.5 }), /válido/);
});

test("vencimento vai para a próxima quinta, nunca antes", () => {
  const friday = new Date("2026-12-11T17:00:00Z");
  assert.equal(nextPaymentDay(friday, 4).toISOString(), "2026-12-17T17:00:00.000Z");
  const thursday = new Date("2026-12-17T12:00:00Z");
  assert.equal(nextPaymentDay(thursday, 4).toISOString(), thursday.toISOString());
  assert.equal(nextPaymentDay(friday, null).toISOString(), friday.toISOString());
  // 01h UTC de sexta ainda é quinta em São Paulo
  assert.equal(nextPaymentDay(new Date("2026-12-18T01:00:00Z"), 4).toISOString(), "2026-12-18T01:00:00.000Z");
});

test("migração: só vendas a prazo, só para frente, horário de São Paulo", () => {
  const sql = readFileSync(join(__dirname, "../../../packages/database/prisma/migrations/20261128000000_customer_payment_weekday/migration.sql"), "utf8");
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "paymentWeekday" SMALLINT/);
  assert.match(sql, /<> 'TERM'/);
  assert.match(sql, /America\/Sao_Paulo/);
  assert.match(sql, /\+ 7\) % 7/);
  assert.doesNotMatch(sql, /UPDATE "AccountsReceivable"|DROP COLUMN|DELETE FROM/);
});

test("rota: só José ou Suzi alteram o dia", () => {
  const source = readFileSync(join(__dirname, "customers.controller.ts"), "utf8");
  const start = source.indexOf('@Patch(":id/payment-weekday")');
  assert.ok(start > 0);
  const body = source.slice(start, start + 1500);
  assert.match(body, /isDesignatedTermCreditApprover/);
  assert.match(body, /parsePaymentWeekday/);
});
