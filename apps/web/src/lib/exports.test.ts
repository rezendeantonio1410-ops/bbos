import assert from "node:assert/strict";
import test from "node:test";
import { alertText, countryName, flag, journeyIndex } from "./exports";

test("bandeira e nome do país pela sigla", () => {
  assert.equal(flag("JP"), "🇯🇵");
  assert.equal(flag("us"), "🌐");
  assert.equal(countryName("DE"), "Alemanha");
  assert.equal(countryName("ZZ"), "ZZ");
});

test("linha da amostra: alfândega fica no ponto do trânsito", () => {
  assert.equal(journeyIndex("PREPARED"), 0);
  assert.equal(journeyIndex("CUSTOMS"), journeyIndex("IN_TRANSIT"));
  assert.equal(journeyIndex("EVALUATED"), 4);
});

test("texto dos alertas", () => {
  assert.equal(alertText({ kind: "CUSTOMS_STUCK", days: 4 }), "Na alfândega há 4 dias");
  assert.equal(alertText({ kind: "FOLLOW_UP", days: 0 }), "Cobrar resposta hoje");
  assert.equal(alertText(null), null);
});
