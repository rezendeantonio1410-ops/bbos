-- Storefront media library v1
-- Central brand library for founders, product proof, origin and editorial imagery.
-- Existing static and product packaging images remain untouched.

CREATE TABLE IF NOT EXISTS "StorefrontMediaAsset" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "productId" TEXT,
  category TEXT NOT NULL,
  "entityKey" TEXT,
  placement TEXT,
  title TEXT NOT NULL,
  "altText" TEXT NOT NULL,
  caption TEXT,
  credit TEXT,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  data BYTEA NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isPrimary" BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StorefrontMediaAsset_company_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE CASCADE,
  CONSTRAINT "StorefrontMediaAsset_product_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "StorefrontMediaAsset_company_category_active_sort_idx"
  ON "StorefrontMediaAsset"("companyId", category, active, "sortOrder");
CREATE INDEX IF NOT EXISTS "StorefrontMediaAsset_company_placement_active_idx"
  ON "StorefrontMediaAsset"("companyId", placement, active);
CREATE INDEX IF NOT EXISTS "StorefrontMediaAsset_product_active_sort_idx"
  ON "StorefrontMediaAsset"("productId", active, "sortOrder");
