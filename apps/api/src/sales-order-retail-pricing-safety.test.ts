import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = (file: string) =>
  readFileSync(join(__dirname, file), "utf8");

const migration = readFileSync(
  join(
    __dirname,
    "../../../packages/database/prisma/migrations/20261020113500_retail_price_isolation/migration.sql",
  ),
  "utf8",
);

const priceCorrectionMigration = readFileSync(
  join(
    __dirname,
    "../../../packages/database/prisma/migrations/20261020163000_retail_core_price_correction/migration.sql",
  ),
  "utf8",
);

test("pedido interno restringe cliente Varejo ao canal VAREJO", () => {
  const controller = source("sales-orders.controller.ts");
  assert.match(controller, /c\.segment NOT ILIKE '%varejo%'/);
  assert.match(controller, /OR sc\.code = 'VAREJO'/);
  assert.doesNotMatch(
    controller,
    /c\.segment ILIKE '%varejo%'\) AND sc\.type = 'ECOMMERCE'/,
  );
});

test("portal de parceiros aplica a mesma separação de preços", () => {
  const controller = source("partner-portal.controller.ts");
  assert.match(controller, /c\.segment NOT ILIKE '%varejo%'/);
  assert.match(controller, /OR sc\.code='VAREJO'/);
  assert.doesNotMatch(
    controller,
    /c\.segment ILIKE '%varejo%'\) AND sc\.type='ECOMMERCE'/,
  );
});

test("migração cria somente a tabela Varejo com os oito preços oficiais", () => {
  assert.match(migration, /sc\.code = 'VAREJO'/);
  assert.match(migration, /'GOU-ESS-500', 55\.00/);
  assert.match(migration, /'GOU-INT-500', 55\.00/);
  assert.match(migration, /'CLA-CAR-500', 68\.00/);
  assert.match(migration, /'CLA-DOC-500', 68\.00/);
  assert.match(migration, /'CLA-TAN-500', 68\.00/);
  assert.match(migration, /'EPI-SIN-500', 84\.00/);
  assert.match(migration, /'EPI-SUB-500', 84\.00/);
  assert.match(migration, /'RAR-RAR-250', 54\.00/);
  assert.doesNotMatch(migration, /DISTRIBUIDOR/);
});

test("correção altera somente Essencial e Intenso da tabela Varejo para R$ 52,00", () => {
  assert.match(priceCorrectionMigration, /sc\.code = 'VAREJO'/);
  assert.match(priceCorrectionMigration, /pv\.sku IN \('GOU-ESS-500', 'GOU-INT-500'\)/);
  assert.match(priceCorrectionMigration, /price = 52\.00/);
  assert.doesNotMatch(priceCorrectionMigration, /DISTRIBUIDOR/);
  assert.doesNotMatch(priceCorrectionMigration, /CLA-|EPI-|RAR-/);
});
