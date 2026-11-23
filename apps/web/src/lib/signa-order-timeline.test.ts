import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getSignaOrderTimelineEvents } from "./signa-order-timeline";

const events = [
  { id: "late", orderId: "pedido-A", occurredAt: "2026-11-22T19:00:00Z" },
  { id: "other", orderId: "pedido-B", occurredAt: "2026-11-22T17:00:00Z" },
  { id: "early", orderId: "pedido-A", occurredAt: "2026-11-22T18:00:00Z" },
];

test("Ver detalhes apresenta somente eventos do pedido selecionado, na ordem temporal", () => {
  assert.deepEqual(
    getSignaOrderTimelineEvents(events, "pedido-A").map((event) => event.id),
    ["early", "late"],
  );
  assert.deepEqual(
    getSignaOrderTimelineEvents(events, "pedido-B").map((event) => event.id),
    ["other"],
  );
});

test("sem seleção ou sem eventos não mostra o histórico de outros pedidos", () => {
  assert.deepEqual(getSignaOrderTimelineEvents(events, null), []);
  assert.deepEqual(getSignaOrderTimelineEvents(events, "inexistente"), []);
  assert.equal(events[0].id, "late"); // no mutation
});

test("interface conecta Ver detalhes ao painel individual e recebe os eventos reais", () => {
  const dashboard = readFileSync(
    new URL("../app/parceiro/SignaEnterpriseDashboard.tsx", import.meta.url),
    "utf8",
  );
  const page = readFileSync(
    new URL("../app/parceiro/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(dashboard, /setExpandedOrder\(value=>value===o\.id\?null:o\.id\)/);
  assert.match(dashboard, /getSignaOrderTimelineEvents\(events,expandedOrder\)/);
  assert.match(dashboard, /id="signa-order-timeline"/);
  assert.match(page, /events=\{data\.notifications\}/);
});
