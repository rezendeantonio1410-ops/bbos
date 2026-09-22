ALTER TABLE "SalesOrder"
  ADD COLUMN IF NOT EXISTS "brokerId" TEXT,
  ADD COLUMN IF NOT EXISTS "brokerCommissionPercent" DECIMAL(7,4),
  ADD COLUMN IF NOT EXISTS "brokerCommissionAmount" DECIMAL(14,2);

CREATE INDEX IF NOT EXISTS "SalesOrder_brokerId_idx" ON "SalesOrder"("brokerId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SalesOrder_brokerId_fkey'
  ) THEN
    ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_brokerId_fkey"
      FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
