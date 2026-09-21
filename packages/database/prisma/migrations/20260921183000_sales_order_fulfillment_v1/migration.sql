ALTER TABLE "Shipment"
  ALTER COLUMN "storefrontOrderId" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "salesOrderId" TEXT;

DO $$ BEGIN
  ALTER TABLE "Shipment"
    ADD CONSTRAINT "Shipment_sales_order_fkey"
    FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Shipment"
    ADD CONSTRAINT "Shipment_order_scope_check"
    CHECK (num_nonnulls("storefrontOrderId","salesOrderId") = 1);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Shipment_sales_order_key"
  ON "Shipment"("salesOrderId")
  WHERE "salesOrderId" IS NOT NULL;
