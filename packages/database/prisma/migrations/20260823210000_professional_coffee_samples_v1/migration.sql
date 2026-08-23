CREATE TYPE "ProfessionalSampleSource" AS ENUM ('OFFER', 'RECEIPT', 'CONTROL');
CREATE TYPE "ProfessionalSampleStatus" AS ENUM ('RECEIVED', 'IN_ANALYSIS', 'EVALUATED', 'APPROVED_FOR_PURCHASE', 'REJECTED', 'REASSESSMENT');

CREATE TABLE "ProfessionalCoffeeSample" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "source" "ProfessionalSampleSource" NOT NULL,
  "code" TEXT NOT NULL,
  "status" "ProfessionalSampleStatus" NOT NULL DEFAULT 'RECEIVED',
  "supplierId" TEXT,
  "originUnitId" TEXT,
  "contactName" TEXT,
  "country" TEXT,
  "state" TEXT,
  "municipality" TEXT,
  "region" TEXT,
  "harvest" TEXT,
  "species" TEXT,
  "cultivar" TEXT,
  "process" TEXT,
  "screen" TEXT,
  "informedDefects" INTEGER,
  "informedMoisture" DECIMAL(5,2),
  "supplierLotCode" TEXT,
  "receivedAt" TIMESTAMP(3),
  "notes" TEXT,
  "purchaseId" TEXT,
  "receiptId" TEXT,
  "sourceSampleId" TEXT,
  "approvedById" TEXT,
  "approvedByName" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdByName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProfessionalCoffeeSample_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProfessionalSampleEvaluation" (
  "id" TEXT NOT NULL,
  "sampleId" TEXT NOT NULL,
  "evaluatorId" TEXT NOT NULL,
  "evaluatorName" TEXT NOT NULL,
  "attributes" JSONB NOT NULL,
  "descriptors" JSONB,
  "sensoryMap" JSONB,
  "defects" INTEGER,
  "moisture" DECIMAL(5,2),
  "screen" TEXT,
  "score" DECIMAL(5,2),
  "notes" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProfessionalSampleEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProfessionalCoffeeSample_companyId_code_key" ON "ProfessionalCoffeeSample"("companyId", "code");
CREATE UNIQUE INDEX "ProfessionalCoffeeSample_purchaseId_key" ON "ProfessionalCoffeeSample"("purchaseId");
CREATE UNIQUE INDEX "ProfessionalCoffeeSample_receiptId_key" ON "ProfessionalCoffeeSample"("receiptId");
CREATE INDEX "ProfessionalCoffeeSample_companyId_status_idx" ON "ProfessionalCoffeeSample"("companyId", "status");
CREATE INDEX "ProfessionalCoffeeSample_companyId_source_idx" ON "ProfessionalCoffeeSample"("companyId", "source");
CREATE INDEX "ProfessionalCoffeeSample_supplierId_status_idx" ON "ProfessionalCoffeeSample"("supplierId", "status");
CREATE UNIQUE INDEX "ProfessionalSampleEvaluation_sampleId_evaluatorId_key" ON "ProfessionalSampleEvaluation"("sampleId", "evaluatorId");
CREATE INDEX "ProfessionalSampleEvaluation_sampleId_completedAt_idx" ON "ProfessionalSampleEvaluation"("sampleId", "completedAt");

ALTER TABLE "ProfessionalCoffeeSample" ADD CONSTRAINT "ProfessionalCoffeeSample_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfessionalCoffeeSample" ADD CONSTRAINT "ProfessionalCoffeeSample_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProfessionalCoffeeSample" ADD CONSTRAINT "ProfessionalCoffeeSample_originUnitId_fkey" FOREIGN KEY ("originUnitId") REFERENCES "SupplierOriginUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProfessionalCoffeeSample" ADD CONSTRAINT "ProfessionalCoffeeSample_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "GreenCoffeePurchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProfessionalCoffeeSample" ADD CONSTRAINT "ProfessionalCoffeeSample_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "GreenCoffeeReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProfessionalCoffeeSample" ADD CONSTRAINT "ProfessionalCoffeeSample_sourceSampleId_fkey" FOREIGN KEY ("sourceSampleId") REFERENCES "ProfessionalCoffeeSample"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProfessionalSampleEvaluation" ADD CONSTRAINT "ProfessionalSampleEvaluation_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "ProfessionalCoffeeSample"("id") ON DELETE CASCADE ON UPDATE CASCADE;
