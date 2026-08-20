CREATE TYPE "GreenCoffeeReceiptStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'REVERSED');
CREATE TYPE "GreenCoffeeQualityStatus" AS ENUM ('AWAITING_ANALYSIS', 'APPROVED', 'APPROVED_WITH_RESTRICTION', 'BLOCKED', 'REJECTED');

CREATE TABLE "GreenCoffeeReceipt" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "coffeeLotId" TEXT NOT NULL,
  "receiptNumber" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "status" "GreenCoffeeReceiptStatus" NOT NULL DEFAULT 'CONFIRMED',
  "qualityStatus" "GreenCoffeeQualityStatus" NOT NULL DEFAULT 'AWAITING_ANALYSIS',
  "species" TEXT NOT NULL,
  "farmName" TEXT,
  "municipality" TEXT,
  "state" TEXT,
  "country" TEXT,
  "origin" TEXT NOT NULL,
  "harvest" TEXT,
  "variety" TEXT,
  "process" TEXT,
  "supplierLotCode" TEXT,
  "invoiceNumber" TEXT,
  "transportDocument" TEXT,
  "purchaseOrderNumber" TEXT,
  "notes" TEXT,
  "unit" TEXT NOT NULL DEFAULT 'KG',
  "bagQuantity" INTEGER,
  "bagWeightKg" DECIMAL(14,3),
  "grossWeightKg" DECIMAL(14,3) NOT NULL,
  "tareWeightKg" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "netWeightKg" DECIMAL(14,3) NOT NULL,
  "moisturePercent" DECIMAL(5,2),
  "screen" TEXT,
  "defects" INTEGER,
  "classification" TEXT,
  "qualityNotes" TEXT,
  "confirmedById" TEXT NOT NULL,
  "confirmedByName" TEXT NOT NULL,
  "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GreenCoffeeReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GreenCoffeeReceipt_coffeeLotId_key" ON "GreenCoffeeReceipt"("coffeeLotId");
CREATE UNIQUE INDEX "GreenCoffeeReceipt_idempotencyKey_key" ON "GreenCoffeeReceipt"("idempotencyKey");
CREATE UNIQUE INDEX "GreenCoffeeReceipt_companyId_receiptNumber_key" ON "GreenCoffeeReceipt"("companyId", "receiptNumber");
CREATE INDEX "GreenCoffeeReceipt_companyId_confirmedAt_idx" ON "GreenCoffeeReceipt"("companyId", "confirmedAt");
CREATE INDEX "GreenCoffeeReceipt_supplierId_idx" ON "GreenCoffeeReceipt"("supplierId");
CREATE INDEX "GreenCoffeeReceipt_qualityStatus_idx" ON "GreenCoffeeReceipt"("qualityStatus");

ALTER TABLE "GreenCoffeeReceipt" ADD CONSTRAINT "GreenCoffeeReceipt_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GreenCoffeeReceipt" ADD CONSTRAINT "GreenCoffeeReceipt_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GreenCoffeeReceipt" ADD CONSTRAINT "GreenCoffeeReceipt_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GreenCoffeeReceipt" ADD CONSTRAINT "GreenCoffeeReceipt_coffeeLotId_fkey" FOREIGN KEY ("coffeeLotId") REFERENCES "CoffeeLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
