ALTER TABLE "SalesOrder"
  ADD COLUMN IF NOT EXISTS "paymentType" TEXT NOT NULL DEFAULT 'LEGACY',
  ADD COLUMN IF NOT EXISTS "paymentTermsSnapshot" TEXT;

CREATE INDEX IF NOT EXISTS "SalesOrder_paymentType_status_idx"
  ON "SalesOrder" ("paymentType", status);
