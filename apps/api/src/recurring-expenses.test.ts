import assert from "node:assert/strict";
import test from "node:test";
import { readableLabel, recurringCandidates, recurringKey, statementStartBalance, validateRecurring as validate } from "./recurring-expenses";

test("fixed expenses are learned per payee, summing bills of the same month", () => {
  const list = recurringCandidates([
    { key: "76484013000145", label: "SANEPAR", category: "Água", amount: 211.89, date: "2026-11-06" },
    { key: "76484013000145", label: "SANEPAR CIA SANEAMENTO PARANA", category: "Água", amount: 147.65, date: "2026-11-06" },
    { key: "76484013000145", label: "SANEPAR", category: "Água", amount: 300, date: "2026-10-06" },
    { key: "11111111000111", label: "IMOBILIARIA EXEMPLO", category: "Aluguel", amount: 7991.13, date: "2026-11-16" },
    { key: "22222222000122", label: "MARKETING", category: "Marketing / consultoria", amount: 4400, date: "2026-11-04" },
  ]);
  assert.deepEqual(list.map((c) => [c.category, c.amount, c.dayOfMonth]), [["Aluguel", 7991.13, 16], ["Água", 359.54, 6]]);
  assert.equal(list[1]!.label, "Sanepar Cia Saneamento Parana");
});

test("payee key ignores dates when there is no CNPJ; labels read well", () => {
  assert.equal(recurringKey("", "SEGURO ITAUEMPRESA 03/11"), recurringKey("", "SEGURO ITAUEMPRESA 03/12"));
  assert.equal(readableLabel("SEGURO ITAUEMPRESA 03/11"), "Seguro Itauempresa");
  assert.equal(readableLabel("54.262.929 GABRIELE MARTINS DA SILVA"), "Gabriele Martins da Silva");
  assert.equal(readableLabel("COPEL-DIS"), "Copel-Dis");
});

test("cash start is the balance at the start of the statement's last day", () => {
  assert.equal(statementStartBalance(4685.49, [{ date: "2026-11-25", amount: -600 }], "2026-11-26"), 4685.49);
  assert.equal(statementStartBalance(1000, [{ date: "2026-11-26", amount: 200 }, { date: "2026-11-26", amount: -50 }], "2026-11-26"), 850);
});

test("editing a fixed expense validates amount and day", () => {
  assert.deepEqual(validate({ dayOfMonth: 10 }, false), { dayOfMonth: 10 });
  assert.throws(() => validate({ dayOfMonth: 32 }, false), /1 a 31/);
  assert.throws(() => validate({ amount: -1 }, false), /Valor/);
  assert.throws(() => validate({}, true), /nome/);
});
