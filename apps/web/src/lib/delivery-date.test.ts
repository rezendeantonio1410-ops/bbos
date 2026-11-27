import assert from "node:assert/strict";
import test from "node:test";
import { deliveryDaysLate, formatDeliveryDate, todayInSaoPaulo } from "./delivery-date";

test("entrega de hoje não fica atrasada, mesmo à noite em Brasília", () => {
  const evening = Date.parse("2026-11-27T23:30:00Z"); // 20h30 em Brasília
  assert.equal(todayInSaoPaulo(evening), "2026-11-27");
  assert.equal(deliveryDaysLate("2026-11-27T00:00:00.000Z", evening), 0);
  assert.equal(formatDeliveryDate("2026-11-27T00:00:00.000Z"), "27/11/2026");
});

test("atrasa a partir do dia seguinte", () => {
  const nextDay = Date.parse("2026-11-28T13:00:00Z");
  assert.equal(deliveryDaysLate("2026-11-27T00:00:00.000Z", nextDay), 1);
  assert.equal(deliveryDaysLate("2026-11-20T00:00:00.000Z", nextDay), 8);
  assert.equal(deliveryDaysLate(null, nextDay), 0);
});

test("logo depois da meia-noite em Brasília ainda é o dia anterior em UTC-3", () => {
  // 02h UTC de 28/11 = 23h de 27/11 em Brasília: ainda não atrasou.
  assert.equal(deliveryDaysLate("2026-11-27T00:00:00.000Z", Date.parse("2026-11-28T02:00:00Z")), 0);
});
