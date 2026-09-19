ALTER TABLE "StorefrontOrder"
  ADD COLUMN IF NOT EXISTS "salesOrderId" TEXT,
  ADD COLUMN IF NOT EXISTS "fulfillmentStatus" TEXT NOT NULL DEFAULT 'PENDING';

DO $$ BEGIN
  ALTER TABLE "StorefrontOrder" ADD CONSTRAINT "StorefrontOrder_sales_order_fkey"
    FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StorefrontOrder" ADD CONSTRAINT "StorefrontOrder_fulfillment_status_check"
    CHECK ("fulfillmentStatus" IN ('PENDING','RESERVED','WAITING_STOCK','PICKING','READY_TO_SHIP','SHIPPED','DELIVERED','CANCELLED','ERROR'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "StorefrontOrder_sales_order_key"
  ON "StorefrontOrder"("salesOrderId") WHERE "salesOrderId" IS NOT NULL;
