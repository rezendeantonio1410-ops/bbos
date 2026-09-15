CREATE TABLE IF NOT EXISTS "PackagingMovement" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
  "materialId" TEXT NOT NULL REFERENCES "PackagingMaterial"(id) ON DELETE RESTRICT,
  "productionOrderId" TEXT REFERENCES "ProductionOrder"(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  quantity DECIMAL(14,3) NOT NULL,
  "unitCost" DECIMAL(14,4),
  reason TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (type IN ('ENTRY','CONSUMPTION','ADJUSTMENT_IN','ADJUSTMENT_OUT','LOSS'))
);
CREATE INDEX IF NOT EXISTS "PackagingMovement_material_idx" ON "PackagingMovement"("materialId","occurredAt");
