CREATE TABLE IF NOT EXISTS "ProductStockPolicy" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
  "productVariantId" TEXT NOT NULL REFERENCES "ProductVariant"(id) ON DELETE CASCADE,
  "minimumUnits" INTEGER NOT NULL DEFAULT 0,
  "targetUnits" INTEGER NOT NULL DEFAULT 0,
  "safetyUnits" INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("companyId","productVariantId"),
  CHECK ("minimumUnits" >= 0 AND "targetUnits" >= 0 AND "safetyUnits" >= 0)
);
