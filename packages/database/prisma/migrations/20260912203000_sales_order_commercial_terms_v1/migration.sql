ALTER TABLE "SalesOrder"
  ADD COLUMN IF NOT EXISTS "freightResponsibility" TEXT,
  ADD COLUMN IF NOT EXISTS "carrierName" TEXT,
  ADD COLUMN IF NOT EXISTS "customerReference" TEXT,
  ADD COLUMN IF NOT EXISTS "incoterm" TEXT,
  ADD COLUMN IF NOT EXISTS "incotermLocation" TEXT;

CREATE INDEX IF NOT EXISTS "SalesOrder_customerReference_idx"
  ON "SalesOrder" ("customerReference");
