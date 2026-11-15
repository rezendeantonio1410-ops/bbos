import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(
  join(
    process.cwd(),
    "../../packages/database/prisma/migrations/20261012235000_correct_white_label_naming/migration.sql",
  ),
  "utf8",
);

test("normalizes White Label in master and operational product names", () => {
  assert.match(migration, /UPDATE "Product"/);
  assert.match(migration, /UPDATE "FinishedProduct"/);
  assert.match(migration, /UPDATE "ProductionOrder"/);
  assert.match(migration, /UPDATE "SalesOrderItem"/);
  assert.match(migration, /\(whate\|wathe\)/i);
  assert.match(migration, /WHITE_LABEL/);
  assert.match(migration, /white-label/);
  assert.match(migration, /Café Gourmet White Label · 1 kg/);
});

