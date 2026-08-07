ALTER TYPE "CostType" ADD VALUE IF NOT EXISTS 'GAS';
ALTER TYPE "CostType" ADD VALUE IF NOT EXISTS 'LABEL';
ALTER TYPE "CostType" ADD VALUE IF NOT EXISTS 'VALVE';
ALTER TYPE "CostType" ADD VALUE IF NOT EXISTS 'BOX';
ALTER TYPE "CostType" ADD VALUE IF NOT EXISTS 'SUPPLIES';
ALTER TYPE "CostType" ADD VALUE IF NOT EXISTS 'DEPRECIATION';
ALTER TYPE "CostType" ADD VALUE IF NOT EXISTS 'MAINTENANCE';

ALTER TABLE "CostEvent" ADD COLUMN "productVariantId" TEXT;
ALTER TABLE "CostCenter" ADD COLUMN "monthlyBudget" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "ProductiveResource"
  ADD COLUMN "energyRatePerKwh" DECIMAL(14,4) NOT NULL DEFAULT 0,
  ADD COLUMN "gasRatePerUnit" DECIMAL(14,4) NOT NULL DEFAULT 0;

ALTER TABLE "CostCalculationSnapshot"
  ADD COLUMN "absorbedCostPerUnit" DECIMAL(14,4),
  ADD COLUMN "absorbedCostPerKg" DECIMAL(14,4),
  ADD COLUMN "netRevenue" DECIMAL(14,4),
  ADD COLUMN "grossMarginPercent" DECIMAL(9,4),
  ADD COLUMN "industrialMarginPercent" DECIMAL(9,4),
  ADD COLUMN "contributionMarginPercent" DECIMAL(9,4),
  ADD COLUMN "afterAllocationMarginPercent" DECIMAL(9,4),
  ADD COLUMN "profitPerUnit" DECIMAL(14,4),
  ADD COLUMN "profitPerKg" DECIMAL(14,4);

CREATE INDEX "CostEvent_productVariantId_occurredAt_idx" ON "CostEvent"("productVariantId", "occurredAt");
ALTER TABLE "CostEvent" ADD CONSTRAINT "CostEvent_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

UPDATE "CostEvent" ce
SET "productVariantId" = po."productVariantId"
FROM "ProductionOrder" po
WHERE ce."productionOrderId" = po.id
  AND ce."productVariantId" IS NULL
  AND po."productVariantId" IS NOT NULL;
