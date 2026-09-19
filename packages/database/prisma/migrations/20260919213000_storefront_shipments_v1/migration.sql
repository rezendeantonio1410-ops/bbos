-- Melhor Envio lifecycle for paid storefront orders.
CREATE TABLE IF NOT EXISTS "StorefrontShipment" (
  id TEXT PRIMARY KEY,
  "orderId" TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'MELHOR_ENVIO',
  status TEXT NOT NULL DEFAULT 'WAITING_INVOICE',
  "providerServiceId" INTEGER NOT NULL,
  "providerShipmentId" TEXT,
  "invoiceKey" TEXT,
  "labelUrl" TEXT,
  "trackingCode" TEXT,
  "trackingPayload" JSONB,
  "lastError" TEXT,
  "purchasedAt" TIMESTAMP(3),
  "generatedAt" TIMESTAMP(3),
  "lastTrackedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StorefrontShipment_order_fkey" FOREIGN KEY ("orderId") REFERENCES "StorefrontOrder"(id) ON DELETE CASCADE,
  CONSTRAINT "StorefrontShipment_provider_check" CHECK (provider IN ('MELHOR_ENVIO')),
  CONSTRAINT "StorefrontShipment_status_check" CHECK (status IN ('WAITING_INVOICE','PROCESSING','LABEL_READY','POSTED','IN_TRANSIT','DELIVERED','ERROR','CANCELLED')),
  CONSTRAINT "StorefrontShipment_order_key" UNIQUE ("orderId")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StorefrontShipment_provider_id_key"
  ON "StorefrontShipment"(provider,"providerShipmentId")
  WHERE "providerShipmentId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "StorefrontShipment_status_idx"
  ON "StorefrontShipment"(status,"updatedAt");
