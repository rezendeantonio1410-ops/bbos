import assert from "node:assert/strict";
import test from "node:test";
import { marketplaceReleases } from "./marketplace-cash";

test("vendas do marketplace viram entradas líquidas na data de liberação, agrupadas por dia", () => {
  const now = new Date("2026-11-27T18:00:00Z");
  const sales = [
    { orderedAt: "2026-11-27T14:00:00Z", gross: 77, fee: 12.5, channel: "Mercado Livre" },
    { orderedAt: "2026-11-27T17:30:00Z", gross: 84, fee: 13.9, channel: "Mercado Livre" },
    { orderedAt: "2026-11-20T12:00:00Z", gross: 100, fee: 15, channel: "Mercado Livre" },
    // vendida há 20 dias: já liberada, não entra
    { orderedAt: "2026-11-07T12:00:00Z", gross: 90, fee: 10, channel: "Mercado Livre" },
    // vendida há 15 dias: libera hoje, ainda entra
    { orderedAt: "2026-11-12T15:00:00Z", gross: 50, fee: 5, channel: "Mercado Livre" },
  ];
  const lines = marketplaceReleases(sales, now);
  assert.deepEqual(lines.map((l) => [l.dueDate, l.amount, l.document]), [
    ["2026-11-27", 45, "1 venda"],
    ["2026-12-05", 85, "1 venda"],
    ["2026-12-12", 134.6, "2 vendas"],
  ]);
  assert.equal(lines[0]!.counterparty, "Mercado Livre · a liberar");
});
