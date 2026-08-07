ALTER TYPE "CostType" ADD VALUE IF NOT EXISTS 'RENT';
ALTER TYPE "CostType" ADD VALUE IF NOT EXISTS 'LOGISTICS';
ALTER TYPE "CostType" ADD VALUE IF NOT EXISTS 'TECHNOLOGY';
ALTER TYPE "CostType" ADD VALUE IF NOT EXISTS 'ADMINISTRATIVE';
ALTER TYPE "CostType" ADD VALUE IF NOT EXISTS 'COMMERCIAL';

ALTER TYPE "AllocationPeriodStatus" ADD VALUE IF NOT EXISTS 'CALCULATING';
ALTER TYPE "AllocationPeriodStatus" ADD VALUE IF NOT EXISTS 'REVIEW';

CREATE TYPE "CostTariffType" AS ENUM ('ENERGY', 'GAS', 'LABOR', 'OTHER');

ALTER TABLE "CostEvent"
  ADD COLUMN "supplierId" TEXT,
  ADD COLUMN "resourceId" TEXT,
  ADD COLUMN "unit" TEXT,
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "competenceAt" TIMESTAMP(3);

ALTER TABLE "AllocationPeriod" ADD COLUMN "name" TEXT;
ALTER TABLE "CostCalculationSnapshot" ADD COLUMN "periodId" TEXT;

CREATE TABLE "CostTariff" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "type" "CostTariffType" NOT NULL,
  "name" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "value" DECIMAL(14,6) NOT NULL,
  "validFrom" TIMESTAMP(3) NOT NULL,
  "validUntil" TIMESTAMP(3),
  "supplierId" TEXT,
  "costCenterId" TEXT NOT NULL,
  "resourceId" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CostTariff_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CostEvent_supplierId_resourceId_idx" ON "CostEvent"("supplierId", "resourceId");
CREATE INDEX "CostCalculationSnapshot_periodId_idx" ON "CostCalculationSnapshot"("periodId");
CREATE INDEX "CostTariff_companyId_type_validFrom_idx" ON "CostTariff"("companyId", "type", "validFrom");
CREATE INDEX "CostTariff_costCenterId_active_idx" ON "CostTariff"("costCenterId", "active");

ALTER TABLE "CostEvent" ADD CONSTRAINT "CostEvent_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CostEvent" ADD CONSTRAINT "CostEvent_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "ProductiveResource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CostCalculationSnapshot" ADD CONSTRAINT "CostCalculationSnapshot_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AllocationPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CostTariff" ADD CONSTRAINT "CostTariff_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CostTariff" ADD CONSTRAINT "CostTariff_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CostTariff" ADD CONSTRAINT "CostTariff_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CostTariff" ADD CONSTRAINT "CostTariff_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "ProductiveResource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "CostEvent" SET "competenceAt" = "occurredAt" WHERE "competenceAt" IS NULL;
UPDATE "CostCalculationSnapshot" s
SET "periodId" = p.id
FROM "AllocationPeriod" p
WHERE s."periodId" IS NULL
  AND s."companyId" = p."companyId"
  AND s."periodCode" = p.code;
