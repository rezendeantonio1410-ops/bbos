-- Product master data required for safe BBOS -> Bling synchronization.
ALTER TYPE "ProductLineCode" ADD VALUE IF NOT EXISTS 'GREEN_COFFEE';

ALTER TABLE "ProductVariant"
  ADD COLUMN IF NOT EXISTS "grossWeightGrams" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "packageWidthCm" DECIMAL(10,2) NOT NULL DEFAULT 18,
  ADD COLUMN IF NOT EXISTS "packageHeightCm" DECIMAL(10,2) NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS "packageDepthCm" DECIMAL(10,2) NOT NULL DEFAULT 11,
  ADD COLUMN IF NOT EXISTS gtin TEXT,
  ADD COLUMN IF NOT EXISTS ncm VARCHAR(8) NOT NULL DEFAULT '09012100',
  ADD COLUMN IF NOT EXISTS "originCode" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cest VARCHAR(7),
  ADD COLUMN IF NOT EXISTS "productionType" VARCHAR(1) NOT NULL DEFAULT 'P',
  ADD COLUMN IF NOT EXISTS "fiscalValidated" BOOLEAN NOT NULL DEFAULT false;

UPDATE "ProductVariant"
   SET "grossWeightGrams" = "netWeightGrams"
 WHERE "grossWeightGrams" < "netWeightGrams";

CREATE UNIQUE INDEX IF NOT EXISTS "ProductVariant_gtin_key"
  ON "ProductVariant"(gtin);

ALTER TABLE "ProductVariant"
  DROP CONSTRAINT IF EXISTS "ProductVariant_gross_weight_check",
  ADD CONSTRAINT "ProductVariant_gross_weight_check"
    CHECK ("grossWeightGrams" >= "netWeightGrams"),
  DROP CONSTRAINT IF EXISTS "ProductVariant_dimensions_check",
  ADD CONSTRAINT "ProductVariant_dimensions_check"
    CHECK ("packageWidthCm" > 0 AND "packageHeightCm" > 0 AND "packageDepthCm" > 0),
  DROP CONSTRAINT IF EXISTS "ProductVariant_ncm_check",
  ADD CONSTRAINT "ProductVariant_ncm_check" CHECK (ncm ~ '^[0-9]{8}$'),
  DROP CONSTRAINT IF EXISTS "ProductVariant_origin_check",
  ADD CONSTRAINT "ProductVariant_origin_check" CHECK ("originCode" BETWEEN 0 AND 8),
  DROP CONSTRAINT IF EXISTS "ProductVariant_cest_check",
  ADD CONSTRAINT "ProductVariant_cest_check" CHECK (cest IS NULL OR cest ~ '^[0-9]{7}$'),
  DROP CONSTRAINT IF EXISTS "ProductVariant_production_type_check",
  ADD CONSTRAINT "ProductVariant_production_type_check" CHECK ("productionType" IN ('P','T'));
