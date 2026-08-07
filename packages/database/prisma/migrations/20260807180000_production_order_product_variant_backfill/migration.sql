-- ProductionOrder → ProductVariant progressive migration.
-- Legacy textual snapshots remain intact and nullable relations preserve old rows.

ALTER TABLE "FinishedGoodsMovement" ADD COLUMN "productVariantId" TEXT;

ALTER TABLE "FinishedGoodsMovement"
  ADD CONSTRAINT "FinishedGoodsMovement_productVariantId_fkey"
  FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "FinishedGoodsMovement_productVariantId_occurredAt_idx"
  ON "FinishedGoodsMovement"("productVariantId", "occurredAt");

-- ProductVariant.sku is globally unique, therefore this mapping is unambiguous.
UPDATE "ProductionOrder" AS production_order
SET "productVariantId" = variant."id"
FROM "ProductVariant" AS variant
WHERE production_order."productVariantId" IS NULL
  AND UPPER(TRIM(production_order."sku")) = UPPER(TRIM(variant."sku"));

UPDATE "FinishedProduct" AS finished_product
SET "productVariantId" = variant."id"
FROM "ProductVariant" AS variant
WHERE finished_product."productVariantId" IS NULL
  AND UPPER(TRIM(finished_product."sku")) = UPPER(TRIM(variant."sku"));

UPDATE "FinishedGoodsMovement" AS movement
SET "productVariantId" = COALESCE(production_order."productVariantId", finished_product."productVariantId")
FROM "ProductionOrder" AS production_order, "FinishedProduct" AS finished_product
WHERE movement."productionOrderId" = production_order."id"
  AND movement."finishedProductId" = finished_product."id"
  AND movement."productVariantId" IS NULL
  AND (
    production_order."productVariantId" IS NOT NULL
    OR finished_product."productVariantId" IS NOT NULL
  );
