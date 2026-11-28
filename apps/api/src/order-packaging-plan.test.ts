import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildPackagingPlan, type PackagingItemRow, type PackagingOpRow } from "./order-packaging-plan";

const item: PackagingItemRow = {
  salesOrderItemId: "i1", productVariantId: "v-wl", productName: "White Label Frutado", sku: "WL-250", quantity: 100, packageWeightG: 250,
  coffeeProductId: "frutado", coffeeName: "Frutado", lineName: "Épicos", reservedUnits: 0, finishedAvailable: 0,
};
const op = (over: Partial<PackagingOpRow>): PackagingOpRow => ({
  id: "op", code: "OP-1", status: "COMPLETED", coffeeProductId: "frutado", plannedKg: 30, greenInputKg: 30, reservedGreenKg: 30, roastedKg: 25.2, packedKg: 0, wipKg: 0, ...over,
});

test("sem torra do mesmo café: pede torra com sugestão de café verde", () => {
  const [plan] = buildPackagingPlan([item], [op({ id: "x", coffeeProductId: "singular", wipKg: 40 })]);
  assert.equal(plan!.state, "NEEDS_ROAST");
  assert.equal(plan!.requiredKg, 25);
  assert.equal(plan!.suggestedGreenKg, 30);
  assert.equal(plan!.coffeeName, "Frutado");
});

test("torra pronta e ainda não embalada atende o pedido", () => {
  const [plan] = buildPackagingPlan([item], [op({ status: "ROASTED", roastedKg: 25.2 })]);
  assert.equal(plan!.state, "READY");
  assert.deepEqual(plan!.readyOp, { id: "op", code: "OP-1", kind: "ROASTED", availableKg: 25.2 });
});

test("saldo torrado de OP concluída atende; saldo pequeno não", () => {
  assert.equal(buildPackagingPlan([item], [op({ wipKg: 26 })])[0]!.readyOp?.kind, "WIP");
  const short = buildPackagingPlan([item], [op({ wipKg: 5.25 })])[0]!;
  assert.equal(short.state, "NEEDS_ROAST");
  assert.equal(short.bestAvailableKg, 5.25);
});

test("torra planejada aparece como em andamento", () => {
  const [plan] = buildPackagingPlan([item], [op({ status: "RESERVED", greenInputKg: 0, roastedKg: 0 })]);
  assert.equal(plan!.state, "ROASTING");
  assert.equal(plan!.roastingOp?.code, "OP-1");
});

test("já reservado ou em estoque não pede torra", () => {
  assert.equal(buildPackagingPlan([{ ...item, reservedUnits: 100 }], [])[0]!.state, "PACKED");
  assert.equal(buildPackagingPlan([{ ...item, finishedAvailable: 120 }], [])[0]!.state, "FROM_STOCK");
});

test("rota usa o mesmo café-base e não grava nada", () => {
  const source = readFileSync(join(__dirname, "production.controller.ts"), "utf8");
  const start = source.indexOf('@Get("sales-orders/:id/packaging-plan")');
  assert.ok(start > 0);
  const body = source.slice(start, source.indexOf("@Get(", start + 10));
  assert.match(body, /baseCoffeeProductId/);
  assert.doesNotMatch(body, /UPDATE|INSERT|\$executeRaw/);
});
