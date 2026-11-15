import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = join(__dirname, "../../..");
const source = (path: string) => readFileSync(join(root, path), "utf8");

test("edição é limitada a rascunho e a funções comerciais autorizadas", () => {
  const controller = source("apps/api/src/sales-orders.controller.ts");
  assert.match(controller, /@Patch\(":id\/draft"\)/);
  assert.match(controller, /\["ADMIN", "EXECUTIVE", "SALES"\]/);
  assert.match(controller, /current\.status !== "DRAFT"/);
  assert.match(controller, /status='APPROVED'/);
  assert.match(controller, /motivo da correção/i);
});

test("correção recalcula preços, revoga aceite antigo e registra antes/depois", () => {
  const controller = source("apps/api/src/sales-orders.controller.ts");
  const migration = source(
    "packages/database/prisma/migrations/20261108213000_sales_order_term_approval_v1/migration.sql",
  );
  assert.match(controller, /resolveInternalPrice/);
  assert.match(controller, /SET status='REVOKED'/);
  assert.match(controller, /INSERT INTO "SalesOrderEditAudit"/);
  assert.match(controller, /beforeSnapshot/);
  assert.match(controller, /afterSnapshot/);
  assert.match(migration, /CREATE TABLE "SalesOrderEditAudit"/);
});
