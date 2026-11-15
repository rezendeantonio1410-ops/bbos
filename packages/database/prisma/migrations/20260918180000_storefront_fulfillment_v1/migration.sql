-- Storefront fulfillment v1
-- Locks carrier quotes to checkout orders and records the complete customer-facing journey.

CREATE TABLE IF NOT EXISTS "ShippingQuote" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'VALID',
  "destinationPostalCode" TEXT NOT NULL,
  "originPostalCode" TEXT NOT NULL,
  "cartFingerprint" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "serviceName" TEXT NOT NULL,
  "carrierName" TEXT NOT NULL,
  "providerPriceCents" INTEGER NOT NULL,
  "customerPriceCents" INTEGER NOT NULL,
  "deliveryDays" INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  package JSONB NOT NULL,
  "rawResponse" JSONB,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShippingQuote_company_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE CASCADE,
  CONSTRAINT "ShippingQuote_provider_check" CHECK (provider IN ('MELHOR_ENVIO','FIXED')),
  CONSTRAINT "ShippingQuote_status_check" CHECK (status IN ('VALID','USED','EXPIRED','CANCELLED')),
  CONSTRAINT "ShippingQuote_prices_check" CHECK ("providerPriceCents" >= 0 AND "customerPriceCents" >= 0),
  CONSTRAINT "ShippingQuote_delivery_days_check" CHECK ("deliveryDays" > 0)
);

CREATE INDEX IF NOT EXISTS "ShippingQuote_company_destination_idx"
  ON "ShippingQuote"("companyId", "destinationPostalCode", "createdAt");
CREATE INDEX IF NOT EXISTS "ShippingQuote_expiry_idx"
  ON "ShippingQuote"(status, "expiresAt");

ALTER TABLE "StorefrontOrder"
  ADD COLUMN IF NOT EXISTS "shippingQuoteId" TEXT,
  ADD COLUMN IF NOT EXISTS "shippingProvider" TEXT,
  ADD COLUMN IF NOT EXISTS "shippingServiceId" TEXT,
  ADD COLUMN IF NOT EXISTS "shippingServiceName" TEXT,
  ADD COLUMN IF NOT EXISTS "carrierName" TEXT,
  ADD COLUMN IF NOT EXISTS "estimatedDeliveryDays" INTEGER;

DO $$ BEGIN
  ALTER TABLE "StorefrontOrder"
    ADD CONSTRAINT "StorefrontOrder_shipping_quote_fkey"
    FOREIGN KEY ("shippingQuoteId") REFERENCES "ShippingQuote"(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DROP INDEX IF EXISTS "StorefrontOrder_shipping_quote_key";
CREATE UNIQUE INDEX "StorefrontOrder_shipping_quote_key"
  ON "StorefrontOrder"("shippingQuoteId") WHERE "shippingQuoteId" IS NOT NULL;

ALTER TABLE "StorefrontOrder" DROP CONSTRAINT IF EXISTS "StorefrontOrder_status_check";
ALTER TABLE "StorefrontOrder" ADD CONSTRAINT "StorefrontOrder_status_check"
  CHECK (status IN (
    'AWAITING_PAYMENT','PAID','PREPARING','INVOICED','SHIPPED','DELIVERED',
    'PAYMENT_FAILED','EXCEPTION','CANCELLED'
  ));

CREATE TABLE IF NOT EXISTS "StorefrontOrderEvent" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "storefrontOrderId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  source TEXT NOT NULL,
  public BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB,
  "idempotencyKey" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StorefrontOrderEvent_company_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE CASCADE,
  CONSTRAINT "StorefrontOrderEvent_order_fkey" FOREIGN KEY ("storefrontOrderId") REFERENCES "StorefrontOrder"(id) ON DELETE CASCADE,
  CONSTRAINT "StorefrontOrderEvent_type_check" CHECK ("eventType" IN (
    'ORDER_RECEIVED','PAYMENT_CONFIRMED','PREPARING','INVOICE_AUTHORIZED',
    'SHIPMENT_CREATED','SHIPPED','OUT_FOR_DELIVERY','DELIVERED','EXCEPTION','CANCELLED'
  )),
  CONSTRAINT "StorefrontOrderEvent_source_check" CHECK (source IN ('BBOS','MERCADO_PAGO','BLING','MELHOR_ENVIO','CARRIER','ADMIN')),
  CONSTRAINT "StorefrontOrderEvent_idempotency_key" UNIQUE ("idempotencyKey")
);

CREATE INDEX IF NOT EXISTS "StorefrontOrderEvent_order_occurred_idx"
  ON "StorefrontOrderEvent"("storefrontOrderId", "occurredAt");

CREATE TABLE IF NOT EXISTS "Shipment" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "storefrontOrderId" TEXT NOT NULL,
  "shippingQuoteId" TEXT,
  provider TEXT NOT NULL,
  "externalId" TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  "serviceId" TEXT NOT NULL,
  "serviceName" TEXT NOT NULL,
  "carrierName" TEXT NOT NULL,
  "providerPriceCents" INTEGER NOT NULL,
  "customerPriceCents" INTEGER NOT NULL,
  "labelUrl" TEXT,
  "trackingCode" TEXT,
  "trackingUrl" TEXT,
  "postedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  metadata JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Shipment_company_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE CASCADE,
  CONSTRAINT "Shipment_order_fkey" FOREIGN KEY ("storefrontOrderId") REFERENCES "StorefrontOrder"(id) ON DELETE CASCADE,
  CONSTRAINT "Shipment_quote_fkey" FOREIGN KEY ("shippingQuoteId") REFERENCES "ShippingQuote"(id) ON DELETE SET NULL,
  CONSTRAINT "Shipment_provider_check" CHECK (provider IN ('MELHOR_ENVIO','BLING_ENVIOS','MANUAL')),
  CONSTRAINT "Shipment_status_check" CHECK (status IN (
    'PENDING','CARTED','PURCHASED','LABEL_READY','POSTED','IN_TRANSIT',
    'OUT_FOR_DELIVERY','DELIVERED','EXCEPTION','CANCELLED'
  )),
  CONSTRAINT "Shipment_order_key" UNIQUE ("storefrontOrderId")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Shipment_provider_external_key"
  ON "Shipment"(provider, "externalId") WHERE "externalId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "Shipment_company_status_idx"
  ON "Shipment"("companyId", status, "updatedAt");

CREATE TABLE IF NOT EXISTS "CustomerNotificationOutbox" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "storefrontOrderId" TEXT NOT NULL,
  "orderEventId" TEXT NOT NULL,
  channel TEXT NOT NULL,
  destination TEXT NOT NULL,
  template TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempts INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3),
  "lastError" TEXT,
  "providerMessageId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerNotification_company_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE CASCADE,
  CONSTRAINT "CustomerNotification_order_fkey" FOREIGN KEY ("storefrontOrderId") REFERENCES "StorefrontOrder"(id) ON DELETE CASCADE,
  CONSTRAINT "CustomerNotification_event_fkey" FOREIGN KEY ("orderEventId") REFERENCES "StorefrontOrderEvent"(id) ON DELETE CASCADE,
  CONSTRAINT "CustomerNotification_channel_check" CHECK (channel IN ('EMAIL','WHATSAPP')),
  CONSTRAINT "CustomerNotification_status_check" CHECK (status IN ('PENDING','PROCESSING','SENT','FAILED','CANCELLED')),
  CONSTRAINT "CustomerNotification_idempotency_key" UNIQUE ("idempotencyKey")
);

CREATE INDEX IF NOT EXISTS "CustomerNotification_status_idx"
  ON "CustomerNotificationOutbox"(status, "nextAttemptAt", "createdAt");

-- Existing orders receive an auditable initial event without triggering retroactive messages.
INSERT INTO "StorefrontOrderEvent"
  (id,"companyId","storefrontOrderId","eventType",title,detail,source,public,metadata,"idempotencyKey","occurredAt","createdAt")
SELECT
  'evt-backfill-' || id,
  "companyId",
  id,
  'ORDER_RECEIVED',
  'Pedido recebido',
  'Recebemos os dados do seu pedido.',
  'BBOS',
  TRUE,
  '{}'::jsonb,
  'storefront:received:' || id,
  "createdAt",
  NOW()
FROM "StorefrontOrder"
ON CONFLICT ("idempotencyKey") DO NOTHING;
