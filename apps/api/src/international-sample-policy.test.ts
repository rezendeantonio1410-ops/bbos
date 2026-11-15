import assert from "node:assert/strict";
import test from "node:test";
import { internationalSampleFiscalValues } from "./international-sample-policy";

test("converts one declared customs total to BRL without turning it into revenue", () => {
  assert.deepEqual(
    internationalSampleFiscalValues({
      customsDeclaredValue: 10,
      exchangeRateToBrl: 5.75,
      totalQuantity: 60,
    }),
    { totalBrl: 57.5, unitValueBrl: 0.958333 },
  );
});

test("rejects missing customs value, exchange rate and quantity", () => {
  assert.throws(() =>
    internationalSampleFiscalValues({
      customsDeclaredValue: 0,
      exchangeRateToBrl: 5.75,
      totalQuantity: 60,
    }),
  );
  assert.throws(() =>
    internationalSampleFiscalValues({
      customsDeclaredValue: 10,
      exchangeRateToBrl: 0,
      totalQuantity: 60,
    }),
  );
  assert.throws(() =>
    internationalSampleFiscalValues({
      customsDeclaredValue: 10,
      exchangeRateToBrl: 5.75,
      totalQuantity: 0,
    }),
  );
});
