CREATE TYPE "PurchaseConfirmationDocumentStatus" AS ENUM ('DRAFT', 'ACCEPTED', 'SUPERSEDED', 'CANCELLED');

CREATE TABLE "Broker" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "tradeName" TEXT,
    "taxId" TEXT,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "bankDetails" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Broker_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Broker" ADD CONSTRAINT "Broker_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Broker_companyId_taxId_key" ON "Broker"("companyId", "taxId");
CREATE INDEX "Broker_companyId_active_idx" ON "Broker"("companyId", "active");

ALTER TABLE "GreenCoffeePurchase"
  ADD COLUMN "brokerId" TEXT,
  ADD COLUMN "brokerCommissionPercent" DECIMAL(7,4),
  ADD COLUMN "brokerCommissionAmount" DECIMAL(14,2);
CREATE INDEX "GreenCoffeePurchase_brokerId_idx" ON "GreenCoffeePurchase"("brokerId");
ALTER TABLE "GreenCoffeePurchase" ADD CONSTRAINT "GreenCoffeePurchase_brokerId_fkey"
  FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PurchaseConfirmationDocumentVersion" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "PurchaseConfirmationDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "snapshot" JSONB NOT NULL,
    "documentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    CONSTRAINT "PurchaseConfirmationDocumentVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PurchaseConfirmationDocumentVersion_purchaseId_version_key"
  ON "PurchaseConfirmationDocumentVersion"("purchaseId", "version");
CREATE INDEX "PurchaseConfirmationDocumentVersion_purchaseId_status_idx"
  ON "PurchaseConfirmationDocumentVersion"("purchaseId", "status");
ALTER TABLE "PurchaseConfirmationDocumentVersion" ADD CONSTRAINT "PurchaseConfirmationDocumentVersion_purchaseId_fkey"
  FOREIGN KEY ("purchaseId") REFERENCES "GreenCoffeePurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccountsPayable"
  ADD COLUMN "brokerId" TEXT,
  ADD COLUMN "brokerCommissionPayableKey" TEXT;
CREATE UNIQUE INDEX "AccountsPayable_brokerCommissionPayableKey_key"
  ON "AccountsPayable"("brokerCommissionPayableKey");
ALTER TABLE "AccountsPayable" ADD CONSTRAINT "AccountsPayable_brokerId_fkey"
  FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
