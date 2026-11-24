import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_TAX_RATES, estimateTaxes, normalizeTaxRates } from "./finance-taxes";

test("Lucro Real: PIS/COFINS with input credits, IRPJ/CSLL monthly estimate", () => {
  const lines = estimateTaxes("LUCRO_REAL", DEFAULT_TAX_RATES.LUCRO_REAL, [{ month: "2026-11", revenue: 100_000, inputs: 40_000 }]);
  const by = Object.fromEntries(lines.map((line) => [line.tax, line]));
  assert.equal(by.PIS?.amount, 990); // 1.65% × 60k
  assert.equal(by.COFINS?.amount, 4560); // 7.6% × 60k
  assert.equal(by.PIS?.dueDate, "2026-12-25");
  assert.equal(by.IRPJ?.amount, 1200); // 15% × 8% × 100k, below the surcharge threshold
  assert.equal(by.CSLL?.amount, 1080); // 9% × 12% × 100k
  assert.equal(by.IRPJ?.dueDate, "2026-12-31");
  assert.equal(by.ICMS, undefined); // not estimated until the effective rate is set
});

test("IRPJ surcharge above R$ 20 mil of monthly base and weekend due dates", () => {
  const lines = estimateTaxes("LUCRO_REAL", DEFAULT_TAX_RATES.LUCRO_REAL, [{ month: "2027-03", revenue: 600_000, inputs: 0 }]);
  const irpj = lines.find((line) => line.tax === "IRPJ");
  // base 48k → 15% = 7.200 + 10% × 28k = 2.800
  assert.equal(irpj?.amount, 10_000);
  assert.equal(irpj?.dueDate, "2027-04-30");
  const pis = lines.find((line) => line.tax === "PIS");
  assert.equal(pis?.dueDate, "2027-04-23"); // 25/04/2027 is a Sunday → Friday
});

test("ICMS and Simples only when a rate is informed; validation", () => {
  const rates = normalizeTaxRates("LUCRO_REAL", { icms: "3,5", icmsDueDay: 10 });
  const icms = estimateTaxes("LUCRO_REAL", rates, [{ month: "2026-11", revenue: 10_000, inputs: 0 }]).find((l) => l.tax === "ICMS");
  assert.equal(icms?.amount, 350);
  assert.equal(icms?.dueDate, "2026-12-10");
  const simples = normalizeTaxRates("SIMPLES_NACIONAL", { simples: 6 });
  assert.deepEqual(estimateTaxes("SIMPLES_NACIONAL", simples, [{ month: "2026-11", revenue: 10_000, inputs: 0 }]).map((l) => [l.tax, l.amount, l.dueDate]), [["SIMPLES", 600, "2026-12-18"]]);
  assert.throws(() => normalizeTaxRates("LUCRO_REAL", { pis: 150 }), /inválida/);
  assert.throws(() => normalizeTaxRates("LUCRO_REAL", { icmsDueDay: 31 }), /ICMS/);
  assert.equal(estimateTaxes("LUCRO_REAL", DEFAULT_TAX_RATES.LUCRO_REAL, [{ month: "2026-11", revenue: 0, inputs: 5 }]).length, 0);
});
