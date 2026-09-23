CREATE TABLE IF NOT EXISTS "SalesOrderCustomerEvent" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "salesOrderId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  source TEXT NOT NULL,
  public BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  "idempotencyKey" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalesOrderCustomerEvent_company_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE CASCADE,
  CONSTRAINT "SalesOrderCustomerEvent_order_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"(id) ON DELETE CASCADE,
  CONSTRAINT "SalesOrderCustomerEvent_idempotency_key" UNIQUE ("idempotencyKey")
);

CREATE INDEX IF NOT EXISTS "SalesOrderCustomerEvent_order_occurred_idx"
  ON "SalesOrderCustomerEvent"("salesOrderId", "occurredAt");

ALTER TABLE "CustomerNotificationOutbox"
  ALTER COLUMN "storefrontOrderId" DROP NOT NULL,
  ALTER COLUMN "orderEventId" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "salesOrderId" TEXT,
  ADD COLUMN IF NOT EXISTS "salesOrderEventId" TEXT;

DO $$ BEGIN
  ALTER TABLE "CustomerNotificationOutbox"
    ADD CONSTRAINT "CustomerNotification_sales_order_fkey"
    FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CustomerNotificationOutbox"
    ADD CONSTRAINT "CustomerNotification_sales_event_fkey"
    FOREIGN KEY ("salesOrderEventId") REFERENCES "SalesOrderCustomerEvent"(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "CustomerNotification_sales_order_idx"
  ON "CustomerNotificationOutbox"("salesOrderId", "createdAt");
