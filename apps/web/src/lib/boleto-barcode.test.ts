import assert from "node:assert/strict";
import test from "node:test";
import { formatDigitableLine, itfBars } from "./boleto-barcode";

test("ITF barcode for a 44-digit boleto has the FEBRABAN module count", () => {
  const { bars, width } = itfBars("3".repeat(44));
  // start 4 + 22 pairs × (6 narrow + 4 wide) + stop 5 → 4 + 22×18 + 5
  assert.equal(width, 4 + 22 * 18 + 5);
  assert.equal(bars.length, 2 + 44 / 2 * 5 + 2);
  assert.deepEqual(bars[0], [0, 1]);
  assert.throws(() => itfBars("123"));
});

test("digitable line is grouped as printed on the boleto", () => {
  assert.equal(formatDigitableLine("3419109008" + "00000001005" + "71234570001" + "1" + "16560000295000"), "34191.09008 00000.001005 71234.570001 1 16560000295000");
  assert.equal(formatDigitableLine("abc"), "abc");
});
