-- Multi-channel sales core: marketplace connection, fees and external order traceability.
ALTER TABLE "SalesChannel"
  ADD COLUMN "platformCode" VARCHAR(30),
  ADD COLUMN "connectionStatus" VARCHAR(20) NOT NULL DEFAULT 'NOT_CONNECTED',
  ADD COLUMN "externalAccountId" TEXT,
  ADD COLUMN "commissionPercent" DECIMAL(7,4),
  ADD COLUMN "fixedFee" DECIMAL(14,2),
  ADD COLUMN "fulfillmentMode" VARCHAR(30),
  ADD COLUMN "lastSyncedAt" TIMESTAMP(3),
  ADD COLUMN "settings" JSONB;

ALTER TABLE "SalesOrder"
  ADD COLUMN "externalOrderId" TEXT,
  ADD COLUMN "externalOrderNumber" TEXT,
  ADD COLUMN "externalStatus" TEXT,
  ADD COLUMN "channelGrossAmount" DECIMAL(14,2),
  ADD COLUMN "channelFeeAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "channelFreightAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "channelNetAmount" DECIMAL(14,2),
  ADD COLUMN "channelPayload" JSONB,
  ADD COLUMN "importedAt" TIMESTAMP(3),
  ADD COLUMN "channelUpdatedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "SalesOrder_companyId_salesChannelId_externalOrderId_key"
  ON "SalesOrder"("companyId", "salesChannelId", "externalOrderId");
CREATE INDEX "SalesOrder_companyId_importedAt_idx"
  ON "SalesOrder"("companyId", "importedAt");
CREATE INDEX "SalesChannel_companyId_platformCode_idx"
  ON "SalesChannel"("companyId", "platformCode");

INSERT INTO "SalesChannel" (
  id, "companyId", code, name, type, active, country, currency,
  "platformCode", "connectionStatus", "fulfillmentMode", "createdAt", "updatedAt"
)
SELECT md5(c.id || ':mercado-livre'), c.id, 'MERCADO_LIVRE', 'Mercado Livre',
       'ECOMMERCE'::"SalesChannelType", true, 'BR', 'BRL',
       'MERCADO_LIVRE', 'NOT_CONNECTED', 'SELLER', NOW(), NOW()
  FROM "Company" c
ON CONFLICT ("companyId", code) DO UPDATE SET
  "platformCode"='MERCADO_LIVRE', active=true, "updatedAt"=NOW();

INSERT INTO "SalesChannel" (
  id, "companyId", code, name, type, active, country, currency,
  "platformCode", "connectionStatus", "fulfillmentMode", "createdAt", "updatedAt"
)
SELECT md5(c.id || ':shopee'), c.id, 'SHOPEE', 'Shopee',
       'ECOMMERCE'::"SalesChannelType", true, 'BR', 'BRL',
       'SHOPEE', 'NOT_CONNECTED', 'SELLER', NOW(), NOW()
  FROM "Company" c
ON CONFLICT ("companyId", code) DO UPDATE SET
  "platformCode"='SHOPEE', active=true, "updatedAt"=NOW();

INSERT INTO "SalesChannel" (
  id, "companyId", code, name, type, active, country, currency,
  "platformCode", "connectionStatus", "fulfillmentMode", "createdAt", "updatedAt"
)
SELECT md5(c.id || ':amazon'), c.id, 'AMAZON', 'Amazon',
       'ECOMMERCE'::"SalesChannelType", true, 'BR', 'BRL',
       'AMAZON', 'NOT_CONNECTED', 'SELLER', NOW(), NOW()
  FROM "Company" c
ON CONFLICT ("companyId", code) DO UPDATE SET
  "platformCode"='AMAZON', active=true, "updatedAt"=NOW();

UPDATE "SalesChannel"
   SET "platformCode"='BISPO_STORE', "connectionStatus"='CONNECTED',
       "fulfillmentMode"=COALESCE("fulfillmentMode", 'SELLER')
 WHERE code IN ('ECOMMERCE', 'CONSUMIDOR_FINAL') AND "platformCode" IS NULL;
