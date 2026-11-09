import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { join } from "node:path";

const root = join(__dirname, "../../..");
const source = (path: string) => readFileSync(join(root, path), "utf8");

test("customer acceptance attempts automatic packaging when roasted coffee is ready", () => {
  const approvals = source("apps/api/src/sales-order-approvals.controller.ts");
  const orders = source("apps/api/src/sales-orders.service.ts");
  assert.match(
    approvals,
    /salesOrders\.confirm\(result\.companyId, result\.salesOrderId\)/,
  );
  assert.match(
    orders,
    /this\.automaticallyPackageReadyOrder\(\s*companyId,\s*id,?\s*\)/,
  );
  assert.match(approvals, /prepara e reserva automaticamente as embalagens/);
  assert.match(approvals, /emissão da NF-e permanece manual/);
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

test("manual reservation reuses the exact bulk coffee mapping instead of requiring packaged stock", () => {
  const orders = source("apps/api/src/sales-orders.service.ts");
  assert.match(
    orders,
    /await this\.allocateRoastedWipForOrder\(transaction, companyId, id\)/,
  );
  assert.match(
    orders,
    /item\.quantity - Number\(bulkReservation\?\.packageQuantity \?\? 0\)/,
  );
  assert.match(orders, /Café torrado a granel insuficiente/);
  assert.match(orders, /SalesOrderStatus\.IN_PRODUCTION/);
  assert.match(orders, /ainda não possui café-base definido/);
});

test("the confirmed legacy White Label mapping is migrated to Gourmet Essencial", () => {
  const migration = source(
    "packages/database/prisma/migrations/20261109001500_map_white_label_classico_to_essencial/migration.sql",
  );
  assert.match(migration, /WHITE_LABEL_CLASSICO_500GR/);
  assert.match(migration, /base_coffee\.code = 'ESSENCIAL'/);
  assert.match(migration, /white_label_line\.code = 'GOURMET'/);
  assert.match(
    migration,
    /base_line\."companyId" = white_label_line\."companyId"/,
  );
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

test("background reconciliation packages fully reserved roasted coffee", () => {
  const orders = source("apps/api/src/sales-orders.service.ts");
  assert.match(orders, /reconcileAutomaticPackaging/);
  assert.match(orders, /setInterval\(/);
  assert.match(orders, /reservation\.status !== "RESERVED"/);
  assert.match(orders, /SALES_ORDER_AUTO_PACK:/);
  assert.match(orders, /sourceType: "SALES_ORDER_WIP_PACKAGING"/);
});

test("automatic packaging leaves fiscal issue as the only manual action", () => {
  const orders = source("apps/api/src/sales-orders.controller.ts");
  const service = source("apps/api/src/sales-orders.service.ts");
  assert.match(orders, /SALES_ORDER_INVOICE_REQUESTED/);
  assert.match(
    orders,
    /pedido precisa estar pronto para expedição antes do faturamento/i,
  );
  assert.match(service, /SalesOrderStatus\.READY_TO_SHIP/);
  assert.match(service, /SET "pickedQuantity"=quantity,"pickedAt"=NOW\(\)/);
  assert.doesNotMatch(service, /SALES_ORDER_INVOICE_REQUESTED/);
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
