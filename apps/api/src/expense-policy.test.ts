import assert from "node:assert/strict";
import test from "node:test";
import {
  expenseAmount,
  expenseCostType,
  expenseDate,
  expensePaymentDate,
  expensePaymentMethod,
  monthlyOccurrence,
  recurrenceCount,
} from "./expense-policy";

test("maps common Bispo expenses to the correct cost type", () => {
  assert.equal(expenseCostType("Água"), "WATER");
  assert.equal(expenseCostType("Energia elétrica"), "ENERGY");
  assert.equal(expenseCostType("Insumos / material de consumo"), "SUPPLIES");
  assert.equal(expenseCostType("Embalagens"), "PACKAGING");
  assert.equal(expenseCostType("Segurança"), "ADMINISTRATIVE");
  assert.equal(expenseCostType("categoria futura"), "OTHER");
});

test("normalizes money and rejects fractions smaller than one cent", () => {
  assert.equal(expenseAmount(52.9), 52.9);
  assert.throws(() => expenseAmount(0), /maior que zero/);
  assert.throws(() => expenseAmount(10.009), /duas casas decimais/);
});

test("parses business dates without shifting the calendar day", () => {
  assert.equal(
    expenseDate("2026-11-13", "Competência").toISOString(),
    "2026-11-13T12:00:00.000Z",
  );
  assert.throws(() => expenseDate("2026-02-31", "Competência"), /inválida/);
});

test("validates payment method and permits the current business date", () => {
  assert.equal(expensePaymentMethod("pix"), "PIX");
  assert.throws(() => expensePaymentMethod("cheque"), /Forma de pagamento/);
  const today = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((result, item) => {
      result[item.type] = item.value;
      return result;
    }, {});
  assert.doesNotThrow(() =>
    expensePaymentDate(`${today.year}-${today.month}-${today.day}`),
  );
});

test("monthly recurrence clamps the last day of short months", () => {
  const january = expenseDate("2027-01-31", "Vencimento");
  assert.equal(
    monthlyOccurrence(january, 1).toISOString(),
    "2027-02-28T12:00:00.000Z",
  );
});

test("monthly recurrence is limited to a safe horizon", () => {
  assert.equal(recurrenceCount(false, 12), 1);
  assert.equal(recurrenceCount(true, 12), 12);
  assert.throws(() => recurrenceCount(true, 25), /entre 2 e 24/);
});
