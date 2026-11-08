import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { join } from "node:path";

const root = join(__dirname, "../../..");
const source = (path: string) => readFileSync(join(root, path), "utf8");

test("customer acceptance reserves the order without packaging it", () => {
  const approvals = source("apps/api/src/sales-order-approvals.controller.ts");
  assert.match(
    approvals,
    /salesOrders\.confirm\(result\.companyId, result\.salesOrderId\)/,
  );
  assert.doesNotMatch(approvals, /completeReadyForOrder|orderPackaging/);
  assert.match(approvals, /estoque de café torrado a granel/);
});

test("the ordered SKU is used only to calculate the bulk kilogram reservation", () => {
  const orders = source("apps/api/src/sales-orders.service.ts");
  assert.match(
    orders,
    /packageQuantity \* Number\(item\.netWeightGrams\)\) \/ 1000/,
  );
  assert.match(orders, /INSERT INTO "RoastedWipReservation"/);
  assert.match(orders, /SET "reservedKg"="reservedKg"\+\$2/);
  assert.match(
    orders,
    /COALESCE\(product\."baseCoffeeProductId",pv\."productId"\) AS "stockProductId"/,
  );
  assert.match(
    orders,
    /source_product\."productLineId"=target_product\."productLineId"/,
  );
  assert.match(orders, /source_product\.id=target_product\.id/);
});

test("the operational endpoint is read-only and identifies the stock as bulk", () => {
  const reservations = source("apps/api/src/order-packaging.controller.ts");
  assert.match(reservations, /@Controller\("production\/bulk-reservations"\)/);
  assert.match(reservations, /stockForm: "BULK_ROASTED_COFFEE"/);
  assert.doesNotMatch(
    reservations,
    /@Post|FinishedGoodsMovement|PackagingConsumption/,
  );
});

test("background jobs do not convert reserved bulk coffee into packages", () => {
  const worker = source("apps/api/src/integration-worker.service.ts");
  assert.doesNotMatch(worker, /orderPackaging|processReady/);
});

test("physical packaging and fiscal issue remain separate later actions", () => {
  const orders = source("apps/api/src/sales-orders.controller.ts");
  const production = source("apps/api/src/production.controller.ts");
  assert.match(orders, /SALES_ORDER_INVOICE_REQUESTED/);
  assert.match(
    orders,
    /pedido precisa estar pronto para expedição antes do faturamento/i,
  );
  assert.match(production, /SalesOrderStatus\.READY_TO_SHIP/);
  assert.match(production, /SET "pickedQuantity"=quantity,"pickedAt"=NOW\(\)/);
  assert.match(
    production,
    /COALESCE\(product\."baseCoffeeProductId",pv\."productId"\)=\$2/,
  );
});

test("packaging consumes the reserved WIP allocation for the same order item", () => {
  const migration = source(
    "packages/database/prisma/migrations/20261108213000_sales_order_term_approval_v1/migration.sql",
  );
  assert.match(migration, /SALES_ORDER_WIP_PACKAGING/);
  assert.match(migration, /"consumedKg"="consumedKg"\+take_kg/);
  assert.match(migration, /"reservedKg"=GREATEST\(0,"reservedKg"-take_kg\)/);
  assert.match(migration, /Reserva de WIP torrado insuficiente/);
});
