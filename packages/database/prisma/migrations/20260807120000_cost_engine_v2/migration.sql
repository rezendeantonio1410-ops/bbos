-- Cost Engine V2: additive migration. Existing operational costs remain intact.
CREATE TYPE "CostNature" AS ENUM ('DIRECT', 'INDIRECT_INDUSTRIAL', 'CORPORATE');
CREATE TYPE "CostCenterCategory" AS ENUM ('INDUSTRIAL', 'LOGISTICS_INVENTORY', 'CORPORATE');
CREATE TYPE "AllocationMethod" AS ENUM ('KG_PRODUCED', 'MACHINE_HOURS', 'LABOR_HOURS', 'ENERGY_CONSUMPTION', 'AREA', 'REVENUE', 'FIXED_PERCENTAGE', 'UNITS_PRODUCED');
CREATE TYPE "AllocationPeriodStatus" AS ENUM ('OPEN', 'CALCULATED', 'CLOSED');
CREATE TYPE "AllocationRuleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'APPLIED', 'CANCELLED');

CREATE TABLE "CostCenter" (
  "id" TEXT PRIMARY KEY, "companyId" TEXT NOT NULL, "code" TEXT NOT NULL,
  "name" TEXT NOT NULL, "category" "CostCenterCategory" NOT NULL,
  "description" TEXT NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true,
  "allocationMethod" "AllocationMethod" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CostCenter_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "CostCenter_companyId_code_key" ON "CostCenter"("companyId", "code");
CREATE INDEX "CostCenter_companyId_category_active_idx" ON "CostCenter"("companyId", "category", "active");

CREATE TABLE "ProductiveResource" (
  "id" TEXT PRIMARY KEY, "companyId" TEXT NOT NULL, "costCenterId" TEXT NOT NULL,
  "name" TEXT NOT NULL, "code" TEXT NOT NULL, "purchaseValue" DECIMAL(14,2) NOT NULL,
  "residualValue" DECIMAL(14,2) NOT NULL DEFAULT 0, "usefulLifeMonths" INTEGER NOT NULL,
  "expectedProductiveHours" DECIMAL(14,3) NOT NULL,
  "maintenanceCostEstimate" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "energyConsumption" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "gasConsumption" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "otherHourlyCost" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductiveResource_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
  CONSTRAINT "ProductiveResource_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "ProductiveResource_companyId_code_key" ON "ProductiveResource"("companyId", "code");
CREATE INDEX "ProductiveResource_costCenterId_active_idx" ON "ProductiveResource"("costCenterId", "active");

CREATE TABLE "ProductionResourceUsage" (
  "id" TEXT PRIMARY KEY, "productionOrderId" TEXT NOT NULL, "resourceId" TEXT NOT NULL,
  "machineHours" DECIMAL(14,3) NOT NULL DEFAULT 0, "laborHours" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "measuredEnergy" DECIMAL(14,4), "measuredGas" DECIMAL(14,4), "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductionResourceUsage_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE,
  CONSTRAINT "ProductionResourceUsage_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "ProductiveResource"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "ProductionResourceUsage_productionOrderId_resourceId_key" ON "ProductionResourceUsage"("productionOrderId", "resourceId");
CREATE INDEX "ProductionResourceUsage_resourceId_createdAt_idx" ON "ProductionResourceUsage"("resourceId", "createdAt");

CREATE TABLE "AllocationPeriod" (
  "id" TEXT PRIMARY KEY, "companyId" TEXT NOT NULL, "code" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL, "endsAt" TIMESTAMP(3) NOT NULL,
  "status" "AllocationPeriodStatus" NOT NULL DEFAULT 'OPEN', "calculatedAt" TIMESTAMP(3), "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AllocationPeriod_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "AllocationPeriod_companyId_code_key" ON "AllocationPeriod"("companyId", "code");
CREATE INDEX "AllocationPeriod_companyId_status_startsAt_idx" ON "AllocationPeriod"("companyId", "status", "startsAt");

CREATE TABLE "AllocationRule" (
  "id" TEXT PRIMARY KEY, "companyId" TEXT NOT NULL, "costCenterId" TEXT NOT NULL, "periodId" TEXT NOT NULL,
  "origin" TEXT NOT NULL, "method" "AllocationMethod" NOT NULL, "baseAmount" DECIMAL(14,4) NOT NULL,
  "destinations" JSONB NOT NULL, "results" JSONB, "status" "AllocationRuleStatus" NOT NULL DEFAULT 'DRAFT',
  "appliedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AllocationRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
  CONSTRAINT "AllocationRule_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT,
  CONSTRAINT "AllocationRule_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AllocationPeriod"("id") ON DELETE RESTRICT
);
CREATE INDEX "AllocationRule_companyId_periodId_status_idx" ON "AllocationRule"("companyId", "periodId", "status");
CREATE INDEX "AllocationRule_costCenterId_method_idx" ON "AllocationRule"("costCenterId", "method");

CREATE TABLE "CostCalculationSnapshot" (
  "id" TEXT PRIMARY KEY, "companyId" TEXT NOT NULL, "productionOrderId" TEXT, "productVariantId" TEXT,
  "periodCode" TEXT NOT NULL, "calculationVersion" TEXT NOT NULL DEFAULT 'cost-engine-v2',
  "directCost" DECIMAL(14,4) NOT NULL, "industrialCost" DECIMAL(14,4) NOT NULL,
  "corporateAllocation" DECIMAL(14,4) NOT NULL DEFAULT 0, "absorbedCost" DECIMAL(14,4) NOT NULL,
  "costPerUnit" DECIMAL(14,4) NOT NULL, "costPerKg" DECIMAL(14,4) NOT NULL,
  "composition" JSONB NOT NULL, "sourceIds" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CostCalculationSnapshot_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
  CONSTRAINT "CostCalculationSnapshot_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT,
  CONSTRAINT "CostCalculationSnapshot_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT
);
CREATE INDEX "CostCalculationSnapshot_companyId_periodCode_idx" ON "CostCalculationSnapshot"("companyId", "periodCode");
CREATE INDEX "CostCalculationSnapshot_productionOrderId_productVariantId_idx" ON "CostCalculationSnapshot"("productionOrderId", "productVariantId");

ALTER TABLE "CostEvent" ADD COLUMN "nature" "CostNature" NOT NULL DEFAULT 'DIRECT';
ALTER TABLE "CostEvent" ADD COLUMN "costCenterId" TEXT;
ALTER TABLE "CostEvent" ADD COLUMN "allocationRuleId" TEXT;
ALTER TABLE "CostEvent" ADD CONSTRAINT "CostEvent_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id");
ALTER TABLE "CostEvent" ADD CONSTRAINT "CostEvent_allocationRuleId_fkey" FOREIGN KEY ("allocationRuleId") REFERENCES "AllocationRule"("id");
CREATE INDEX "CostEvent_costCenterId_nature_occurredAt_idx" ON "CostEvent"("costCenterId", "nature", "occurredAt");
