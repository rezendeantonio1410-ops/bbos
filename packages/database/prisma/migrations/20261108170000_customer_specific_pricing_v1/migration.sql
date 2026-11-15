-- Customer-specific prices refine the commercial policy without duplicating
-- products or SKUs. Channel prices remain the source of currency, channel and
-- discount guardrails; a customer price only overrides the negotiated amount.

CREATE TABLE "CustomerProductPrice" (
  id TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "productVariantId" TEXT NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
  price DECIMAL(14,2) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  "validFrom" TIMESTAMP(3),
  "validUntil" TIMESTAMP(3),
  notes TEXT,
  "createdByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CustomerProductPrice_pkey" PRIMARY KEY (id),
  CONSTRAINT "CustomerProductPrice_price_check" CHECK (price >= 0),
  CONSTRAINT "CustomerProductPrice_validity_check" CHECK ("validUntil" IS NULL OR "validFrom" IS NULL OR "validUntil" >= "validFrom"),
  CONSTRAINT "CustomerProductPrice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CustomerProductPrice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CustomerProductPrice_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CustomerProductPrice_customer_variant_currency_key"
  ON "CustomerProductPrice"("customerId", "productVariantId", currency);
CREATE INDEX "CustomerProductPrice_company_customer_active_idx"
  ON "CustomerProductPrice"("companyId", "customerId", active);
CREATE INDEX "CustomerProductPrice_variant_active_idx"
  ON "CustomerProductPrice"("productVariantId", active);

CREATE TABLE "CustomerProductPriceEvent" (
  id TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "customerProductPriceId" TEXT NOT NULL,
  "actorId" TEXT,
  "actorName" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL,
  action VARCHAR(20) NOT NULL,
  "beforeSnapshot" JSONB,
  "afterSnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CustomerProductPriceEvent_pkey" PRIMARY KEY (id),
  CONSTRAINT "CustomerProductPriceEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CustomerProductPriceEvent_customerProductPriceId_fkey" FOREIGN KEY ("customerProductPriceId") REFERENCES "CustomerProductPrice"(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "CustomerProductPriceEvent_company_created_idx"
  ON "CustomerProductPriceEvent"("companyId", "createdAt");
CREATE INDEX "CustomerProductPriceEvent_price_created_idx"
  ON "CustomerProductPriceEvent"("customerProductPriceId", "createdAt");

ALTER TABLE "SalesOrderItem"
  ADD COLUMN "pricingSource" VARCHAR(20) NOT NULL DEFAULT 'CHANNEL',
  ADD COLUMN "baseProductPriceId" TEXT,
  ADD COLUMN "customerProductPriceId" TEXT,
  ADD COLUMN "priceSnapshot" JSONB;

ALTER TABLE "SalesOrderItem"
  ADD CONSTRAINT "SalesOrderItem_pricingSource_check"
  CHECK ("pricingSource" IN ('CHANNEL', 'CUSTOMER', 'SAMPLE', 'LEGACY'));
ALTER TABLE "SalesOrderItem"
  ADD CONSTRAINT "SalesOrderItem_baseProductPriceId_fkey"
  FOREIGN KEY ("baseProductPriceId") REFERENCES "ProductPrice"(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesOrderItem"
  ADD CONSTRAINT "SalesOrderItem_customerProductPriceId_fkey"
  FOREIGN KEY ("customerProductPriceId") REFERENCES "CustomerProductPrice"(id) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "SalesOrderItem_baseProductPriceId_idx" ON "SalesOrderItem"("baseProductPriceId");
CREATE INDEX "SalesOrderItem_customerProductPriceId_idx" ON "SalesOrderItem"("customerProductPriceId");

UPDATE "SalesOrderItem" AS soi
   SET "pricingSource" = CASE
     WHEN so."orderType" = 'SAMPLE' THEN 'SAMPLE'
     ELSE 'LEGACY'
   END,
       "priceSnapshot" = jsonb_build_object(
         'capturedAt', CURRENT_TIMESTAMP,
         'source', CASE WHEN so."orderType" = 'SAMPLE' THEN 'SAMPLE' ELSE 'LEGACY' END,
         'effectiveUnitPrice', soi."unitPrice",
         'currency', so.currency
       )
  FROM "SalesOrder" so
 WHERE so.id = soi."salesOrderId";
