ALTER TABLE "SalesOrder"
  ADD COLUMN IF NOT EXISTS "shippingQuoteId" TEXT,
  ADD COLUMN IF NOT EXISTS "shippingProvider" TEXT,
  ADD COLUMN IF NOT EXISTS "shippingServiceId" TEXT,
  ADD COLUMN IF NOT EXISTS "shippingServiceName" TEXT,
  ADD COLUMN IF NOT EXISTS "estimatedDeliveryDays" INTEGER;

DO $$ BEGIN
  ALTER TABLE "SalesOrder"
    ADD CONSTRAINT "SalesOrder_shipping_quote_fkey"
    FOREIGN KEY ("shippingQuoteId") REFERENCES "ShippingQuote"(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "SalesOrder_shippingQuoteId_idx" ON "SalesOrder"("shippingQuoteId");
