import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(
  join(
    __dirname,
    "../../../packages/database/prisma/migrations/20261109172000_storefront_tracking_event_types/migration.sql",
  ),
  "utf8",
);

const trackingService = readFileSync(
  join(__dirname, "melhor-envio-shipment.service.ts"),
  "utf8",
);

const trackingEventTypes = [
  "RECEIVED",
  "LABEL_GENERATED",
  "LABEL_RELEASED",
  "LABEL_CREATED",
  "LABEL_PENDING",
  "UNDELIVERED",
  "RETURNED",
  "PAUSED",
  "SUSPENDED",
  "SHIPMENT_CANCELLED",
];

test("a restrição do banco aceita todos os eventos do Melhor Envio", () => {
  for (const eventType of trackingEventTypes) {
    assert.match(trackingService, new RegExp(`event: "${eventType}"`));
    assert.match(migration, new RegExp(`'${eventType}'`));
  }
});

test("a migração substitui a restrição antiga com segurança", () => {
  assert.match(
    migration,
    /DROP CONSTRAINT IF EXISTS "StorefrontOrderEvent_type_check"/,
  );
  assert.match(
    migration,
    /ADD CONSTRAINT "StorefrontOrderEvent_type_check" CHECK/,
  );
});
