CREATE TABLE IF NOT EXISTS "PackagingInventoryBalance" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
  "materialId" TEXT NOT NULL REFERENCES "PackagingMaterial"(id) ON DELETE CASCADE,
  "onHand" DECIMAL(14,3) NOT NULL DEFAULT 0,
  reserved DECIMAL(14,3) NOT NULL DEFAULT 0,
  "averageUnitCost" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("materialId"),
  CHECK ("onHand" >= 0 AND reserved >= 0)
);
