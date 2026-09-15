ALTER TABLE "ProductionRequirement"
  ADD COLUMN IF NOT EXISTS "productionOrderId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ProductionRequirement_productionOrderId_fkey'
  ) THEN
    ALTER TABLE "ProductionRequirement"
      ADD CONSTRAINT "ProductionRequirement_productionOrderId_fkey"
      FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "ProductionRequirement_productionOrderId_key"
  ON "ProductionRequirement"("productionOrderId")
  WHERE "productionOrderId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "ProductionRequirement_variant_status_idx"
  ON "ProductionRequirement"("companyId", "productVariantId", status);
