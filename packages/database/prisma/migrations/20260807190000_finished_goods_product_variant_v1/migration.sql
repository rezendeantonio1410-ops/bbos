-- ProductVariant → Finished Goods Inventory V1.
-- Additive migration: FinishedProduct and legacy textual SKUs are preserved.

ALTER TYPE "FinishedGoodsMovementType" ADD VALUE IF NOT EXISTS 'PRODUCTION_IN';
ALTER TYPE "FinishedGoodsMovementType" ADD VALUE IF NOT EXISTS 'SALE_OUT';
ALTER TYPE "FinishedGoodsMovementType" ADD VALUE IF NOT EXISTS 'ADJUSTMENT_IN';
ALTER TYPE "FinishedGoodsMovementType" ADD VALUE IF NOT EXISTS 'ADJUSTMENT_OUT';
ALTER TYPE "FinishedGoodsMovementType" ADD VALUE IF NOT EXISTS 'RETURN_IN';
ALTER TYPE "FinishedGoodsMovementType" ADD VALUE IF NOT EXISTS 'LOSS_OUT';

ALTER TABLE "FinishedProduct" ALTER COLUMN "blendId" DROP NOT NULL;
ALTER TABLE "FinishedProduct" ADD COLUMN "reservedQuantity" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "FinishedGoodsMovement" ADD COLUMN "unit" TEXT NOT NULL DEFAULT 'UN';
ALTER TABLE "FinishedGoodsMovement" ADD COLUMN "sourceType" TEXT;
ALTER TABLE "FinishedGoodsMovement" ADD COLUMN "sourceId" TEXT;
ALTER TABLE "FinishedGoodsMovement" ADD COLUMN "idempotencyKey" TEXT;

UPDATE "FinishedGoodsMovement"
SET "sourceType" = 'PRODUCTION_ORDER',
    "sourceId" = "productionOrderId"
WHERE "sourceType" IS NULL;

-- The index establishes one balance per ProductVariant and warehouse.
-- PostgreSQL allows multiple legacy NULL variants while preserving old rows.
CREATE UNIQUE INDEX "FinishedProduct_productVariantId_warehouseId_key"
  ON "FinishedProduct"("productVariantId", "warehouseId");
CREATE UNIQUE INDEX "FinishedGoodsMovement_idempotencyKey_key"
  ON "FinishedGoodsMovement"("idempotencyKey");
CREATE INDEX "FinishedGoodsMovement_productVariantId_type_occurredAt_idx"
  ON "FinishedGoodsMovement"("productVariantId", "type", "occurredAt");
