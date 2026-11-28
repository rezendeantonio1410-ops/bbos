import test from "node:test";
import assert from "node:assert/strict";
import { fieldNative, toFieldPoint } from "./field-native";

test("ponto do Android vira o formato do /field/points", () => {
  const p = toFieldPoint({ latitude: -23.31, longitude: -51.16, accuracy: 8, speed: 12.5, time: Date.UTC(2026, 10, 28, 12) });
  assert.deepEqual(p, { at: "2026-11-28T12:00:00.000Z", lat: -23.31, lng: -51.16, accuracy: 8, speed: 12.5 });
});

test("sem hora, precisão ou velocidade usa o relógio e deixa vazio", () => {
  const p = toFieldPoint({ latitude: -23.3, longitude: -51.1, accuracy: null, speed: null, time: null }, Date.UTC(2026, 10, 28, 9));
  assert.equal(p?.at, "2026-11-28T09:00:00.000Z");
  assert.equal(p?.accuracy, null);
  assert.equal(p?.speed, null);
});

test("coordenada inválida é descartada e, fora do app, a ponte fica desligada", () => {
  assert.equal(toFieldPoint({ latitude: Number.NaN, longitude: -51 }), null);
  assert.equal(fieldNative.available(), false);
});
