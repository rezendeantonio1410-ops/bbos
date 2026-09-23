-- BBOS inbound fiscal documents v1
-- Keeps the authorized XML immutable and separates fiscal, purchasing and physical receipt events.

ALTER TABLE "FiscalDocument"
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'MANUAL_UPLOAD',
  ADD COLUMN IF NOT EXISTS "xmlContent" TEXT,
  ADD COLUMN IF NOT EXISTS "xmlHash" TEXT,
  ADD COLUMN IF NOT EXISTS "schemaVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "authorizationProtocol" TEXT,
  ADD COLUMN IF NOT EXISTS "issuerTaxId" TEXT,
  ADD COLUMN IF NOT EXISTS "issuerName" TEXT,
  ADD COLUMN IF NOT EXISTS "recipientTaxId" TEXT,
  ADD COLUMN IF NOT EXISTS "operationNature" TEXT,
  ADD COLUMN IF NOT EXISTS "productsAmount" DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS "freightAmount" DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS "discountAmount" DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS "paymentSnapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "validationIssues" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "matchStatus" TEXT NOT NULL DEFAULT 'UNMATCHED',
  ADD COLUMN IF NOT EXISTS "importedById" TEXT,
  ADD COLUMN IF NOT EXISTS "importedByName" TEXT,
  ADD COLUMN IF NOT EXISTS "importedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "FiscalDocument_company_xml_hash_key"
  ON "FiscalDocument"("companyId", "xmlHash") WHERE "xmlHash" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "FiscalDocument_company_imported_at_idx"
  ON "FiscalDocument"("companyId", "importedAt" DESC);
CREATE INDEX IF NOT EXISTS "FiscalDocument_issuer_tax_id_idx"
  ON "FiscalDocument"("companyId", "issuerTaxId");

CREATE TABLE IF NOT EXISTS "FiscalDocumentItem" (
  id TEXT PRIMARY KEY,
  "fiscalDocumentId" TEXT NOT NULL,
  "itemNumber" INTEGER NOT NULL,
  "supplierProductCode" TEXT,
  description TEXT NOT NULL,
  ncm TEXT,
  cest TEXT,
  cfop TEXT,
  "commercialUnit" TEXT,
  quantity DECIMAL(14,4) NOT NULL,
  "unitValue" DECIMAL(14,6) NOT NULL,
  "totalValue" DECIMAL(14,2) NOT NULL,
  "freightAmount" DECIMAL(14,2),
  "discountAmount" DECIMAL(14,2),
  "taxSnapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "rawSnapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FiscalDocumentItem_document_fkey" FOREIGN KEY ("fiscalDocumentId") REFERENCES "FiscalDocument"(id) ON DELETE CASCADE,
  CONSTRAINT "FiscalDocumentItem_document_item_key" UNIQUE ("fiscalDocumentId", "itemNumber")
);

CREATE INDEX IF NOT EXISTS "FiscalDocumentItem_document_idx" ON "FiscalDocumentItem"("fiscalDocumentId");
CREATE INDEX IF NOT EXISTS "FiscalDocumentItem_ncm_cfop_idx" ON "FiscalDocumentItem"(ncm, cfop);

CREATE TABLE IF NOT EXISTS "FiscalDocumentAllocation" (
  id TEXT PRIMARY KEY,
  "fiscalDocumentId" TEXT NOT NULL,
  "fiscalDocumentItemId" TEXT,
  "allocationType" TEXT NOT NULL,
  "purchaseId" TEXT,
  "receiptId" TEXT,
  "costCenterId" TEXT,
  "accountsPayableId" TEXT,
  "targetReferenceId" TEXT,
  category TEXT,
  description TEXT,
  "allocatedQuantity" DECIMAL(14,4),
  "allocatedAmount" DECIMAL(14,2),
  status TEXT NOT NULL DEFAULT 'ALLOCATED',
  "matchSnapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdById" TEXT NOT NULL,
  "createdByName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FiscalDocumentAllocation_document_fkey" FOREIGN KEY ("fiscalDocumentId") REFERENCES "FiscalDocument"(id) ON DELETE CASCADE,
  CONSTRAINT "FiscalDocumentAllocation_item_fkey" FOREIGN KEY ("fiscalDocumentItemId") REFERENCES "FiscalDocumentItem"(id) ON DELETE CASCADE,
  CONSTRAINT "FiscalDocumentAllocation_purchase_fkey" FOREIGN KEY ("purchaseId") REFERENCES "GreenCoffeePurchase"(id) ON DELETE RESTRICT,
  CONSTRAINT "FiscalDocumentAllocation_receipt_fkey" FOREIGN KEY ("receiptId") REFERENCES "GreenCoffeeReceipt"(id) ON DELETE SET NULL,
  CONSTRAINT "FiscalDocumentAllocation_cost_center_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"(id) ON DELETE SET NULL,
  CONSTRAINT "FiscalDocumentAllocation_payable_fkey" FOREIGN KEY ("accountsPayableId") REFERENCES "AccountsPayable"(id) ON DELETE SET NULL,
  CONSTRAINT "FiscalDocumentAllocation_type_check" CHECK ("allocationType" IN ('GREEN_COFFEE_PURCHASE','PACKAGING_MATERIAL','GAS_ENERGY','MAINTENANCE','FIXED_ASSET','SERVICE','ADMINISTRATIVE_EXPENSE','TAX','OTHER'))
);

CREATE INDEX IF NOT EXISTS "FiscalAllocation_document_idx" ON "FiscalDocumentAllocation"("fiscalDocumentId");
CREATE INDEX IF NOT EXISTS "FiscalAllocation_item_idx" ON "FiscalDocumentAllocation"("fiscalDocumentItemId");
CREATE INDEX IF NOT EXISTS "FiscalAllocation_type_idx" ON "FiscalDocumentAllocation"("allocationType");
CREATE INDEX IF NOT EXISTS "FiscalAllocation_purchase_idx" ON "FiscalDocumentAllocation"("purchaseId");
CREATE INDEX IF NOT EXISTS "FiscalAllocation_receipt_idx" ON "FiscalDocumentAllocation"("receiptId");
CREATE INDEX IF NOT EXISTS "FiscalAllocation_cost_center_idx" ON "FiscalDocumentAllocation"("costCenterId");
CREATE INDEX IF NOT EXISTS "FiscalAllocation_payable_idx" ON "FiscalDocumentAllocation"("accountsPayableId");

CREATE TABLE IF NOT EXISTS "FiscalDocumentEvent" (
  id TEXT PRIMARY KEY,
  "fiscalDocumentId" TEXT NOT NULL,
  type TEXT NOT NULL,
  source TEXT NOT NULL,
  "eventCode" TEXT,
  "protocolNumber" TEXT,
  status TEXT,
  message TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FiscalDocumentEvent_document_fkey" FOREIGN KEY ("fiscalDocumentId") REFERENCES "FiscalDocument"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "FiscalDocumentEvent_document_occurred_idx"
  ON "FiscalDocumentEvent"("fiscalDocumentId", "occurredAt" DESC);

CREATE TABLE IF NOT EXISTS "FiscalDistributionState" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'SEFAZ_DFE',
  environment TEXT NOT NULL DEFAULT 'PRODUCTION',
  "lastNsu" TEXT NOT NULL DEFAULT '000000000000000',
  "maxNsu" TEXT NOT NULL DEFAULT '000000000000000',
  status TEXT NOT NULL DEFAULT 'IDLE',
  "lastSyncAt" TIMESTAMP(3),
  "nextSyncAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FiscalDistributionState_company_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE CASCADE,
  CONSTRAINT "FiscalDistributionState_company_provider_key" UNIQUE ("companyId", provider)
);

CREATE INDEX IF NOT EXISTS "FiscalDistributionState_next_sync_idx"
  ON "FiscalDistributionState"(status, "nextSyncAt");
