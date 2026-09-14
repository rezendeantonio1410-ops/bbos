CREATE TABLE IF NOT EXISTS "ProductionRequirement" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
  "productVariantId" TEXT NOT NULL REFERENCES "ProductVariant"(id) ON DELETE RESTRICT,
  "recommendedUnits" INTEGER NOT NULL,
  "uncoveredDemand" INTEGER NOT NULL DEFAULT 0,
  "availableUnits" INTEGER NOT NULL DEFAULT 0,
  "targetUnits" INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'OPEN',
  source TEXT NOT NULL DEFAULT 'DEMAND_PLANNING',
  "createdByUserId" TEXT,
  "createdByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CHECK ("recommendedUnits" > 0),
  CHECK (status IN ('OPEN','PLANNED','RESOLVED','CANCELLED'))
);
CREATE INDEX IF NOT EXISTS "ProductionRequirement_queue_idx" ON "ProductionRequirement"("companyId",status,"createdAt");
