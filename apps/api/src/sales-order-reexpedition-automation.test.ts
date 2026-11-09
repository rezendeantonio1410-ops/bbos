import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const outbox = readFileSync(
  join(__dirname, "integrations/bling/bling-outbox.service.ts"),
  "utf8",
);
const shipment = readFileSync(
  join(__dirname, "melhor-envio-shipment.service.ts"),
  "utf8",
);
const migration = readFileSync(
  join(
    __dirname,
    "../../../packages/database/prisma/migrations/20261109023000_sales_order_reexpedition/migration.sql",
  ),
  "utf8",
);

test("a fila executa devolução, nova saída e etiqueta", () => {
  assert.match(outbox, /SALES_ORDER_REEXPEDITION_REQUESTED/);
  assert.match(outbox, /processSalesOrderReexpedition/);
  assert.match(outbox, /ensureReexpeditionFiscalDocument[\s\S]*"RETURN"/);
  assert.match(outbox, /ensureReexpeditionFiscalDocument[\s\S]*"OUTBOUND"/);
  assert.match(outbox, /createReexpeditionLabel/);
});

test("a reexpedição fiscal não cria nova cobrança comercial", () => {
  const start = outbox.indexOf("private async processSalesOrderReexpedition");
  const end = outbox.indexOf("private fiscalStatus", start);
  const flow = outbox.slice(start, end);
  assert.ok(start > 0 && end > start);
  assert.doesNotMatch(flow, /ensureSalesOrderReceivable/);
  assert.match(outbox, /noCommercialReceivable: true/);
});

test("a nova remessa é separada e preserva a original", () => {
  assert.match(migration, /DROP CONSTRAINT IF EXISTS "Shipment_order_key"/);
  assert.match(migration, /"replacementShipmentId"/);
  assert.match(shipment, /async createReexpeditionLabel/);
  assert.match(shipment, /"customerPriceCents"[\s\S]*,0,/);
  assert.match(shipment, /status='LABEL_CREATED'/);
});
