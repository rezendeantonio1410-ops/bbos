-- Product Catalog Persistence V1
-- Additive and backward-compatible: text/SKU legacy columns remain available.
ALTER TABLE "Product" ADD COLUMN "code" TEXT;
UPDATE "Product" SET "code" = UPPER(REPLACE("slug", '-', '_')) WHERE "code" IS NULL;
ALTER TABLE "Product" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "Product_productLineId_code_key" ON "Product"("productLineId", "code");
CREATE UNIQUE INDEX "ProductVariant_productId_netWeightGrams_key" ON "ProductVariant"("productId", "netWeightGrams");

ALTER TABLE "ProductionOrder" ADD COLUMN "productVariantId" TEXT;
ALTER TABLE "FinishedProduct" ADD COLUMN "productVariantId" TEXT;

ALTER TABLE "ProductionOrder"
  ADD CONSTRAINT "ProductionOrder_productVariantId_fkey"
  FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinishedProduct"
  ADD CONSTRAINT "FinishedProduct_productVariantId_fkey"
  FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "ProductionOrder_productVariantId_status_idx" ON "ProductionOrder"("productVariantId", "status");
CREATE INDEX "FinishedProduct_productVariantId_idx" ON "FinishedProduct"("productVariantId");
