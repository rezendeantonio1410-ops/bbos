ALTER TABLE "SalesOrder"
  ADD COLUMN IF NOT EXISTS "brokerCommissionMode" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "brokerCommissionPerPackage" DECIMAL(14,2);

UPDATE "SalesOrder"
   SET "brokerCommissionMode" = 'PERCENTAGE'
 WHERE "brokerId" IS NOT NULL
   AND "brokerCommissionMode" IS NULL;
