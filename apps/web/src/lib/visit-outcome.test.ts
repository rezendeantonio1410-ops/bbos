import test from "node:test";
import assert from "node:assert/strict";
import { visitPayload } from "./visit-outcome";

const now = new Date("2026-11-28T17:00:00Z");

test("Fez pedido: visita de pós-venda com resultado PEDIDO e local", () => {
  const body = visitPayload({ kind: "ORDER" }, now, { lat: -23.3, lng: -51.1 });
  assert.equal(body.outcome, "PEDIDO");
  assert.equal(body.purpose, "POS_VENDA");
  assert.equal(body.visitAt, "2026-11-28T17:00:00.000Z");
  assert.equal(body.latitude, -23.3);
  assert.ok(body.facts.length >= 3);
});

test("Sem pedido guarda o motivo; Voltar em 7 dias agenda a próxima ação", () => {
  const no = visitPayload({ kind: "NO_ORDER", reason: "Preço" }, now, null);
  assert.equal(no.outcome, "ACOMPANHAR");
  assert.match(no.facts, /Motivo: Preço/);
  assert.equal("latitude" in no, false);
  const later = visitPayload({ kind: "LATER", days: 7 }, now, null);
  assert.equal(later.nextActionAt, "2026-12-05T17:00:00.000Z");
  assert.equal(later.nextAction, "Voltar a visitar o cliente");
});
