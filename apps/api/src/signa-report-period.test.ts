import assert from "node:assert/strict";
import test from "node:test";
import { parseSignaReportYear, signaReportYearBounds } from "./signa-report-period";

test("sem ano selecionado, todas as datas são incluídas", () => {
  assert.equal(parseSignaReportYear(undefined), null);
  assert.deepEqual(signaReportYearBounds(null), { start: null, end: null });
});

test("filtro anual usa intervalo fechado-aberto sem perda de 31/dez", () => {
  assert.equal(parseSignaReportYear("2026"), 2026);
  assert.deepEqual(signaReportYearBounds(2026), {
    start: "2026-01-01",
    end: "2027-01-01",
  });
  assert.deepEqual(signaReportYearBounds(2099), {
    start: "2099-01-01",
    end: "2100-01-01",
  });
});

test("rejeita parâmetro de ano malformado e tentativas de injeção", () => {
  for (const invalid of [
    "", "all", " 2026", "2026 ", "26", "1999", "2100", "2026-01",
    "2026 OR TRUE", "2026; DROP TABLE SalesOrder", "2026\n",
  ]) {
    assert.throws(() => parseSignaReportYear(invalid), /Ano de relatório inválido/, invalid);
  }
});
