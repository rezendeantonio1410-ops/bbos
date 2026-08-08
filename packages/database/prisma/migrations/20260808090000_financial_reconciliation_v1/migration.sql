CREATE TYPE "ReconciliationStatus" AS ENUM ('PENDING', 'MATCHED', 'PARTIALLY_MATCHED', 'DIVERGENT', 'IGNORED');
CREATE TYPE "ReconciliationDirection" AS ENUM ('IN', 'OUT');

CREATE TABLE "ReconciliationItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "financialAccountId" TEXT,
    "financialTransactionId" TEXT,
    "customerId" TEXT,
    "supplierId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "documentReference" TEXT,
    "counterpartyName" TEXT,
    "direction" "ReconciliationDirection" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "matchedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "difference" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "ReconciliationStatus" NOT NULL DEFAULT 'PENDING',
    "matchedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReconciliationItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReconciliationEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "reconciliationItemId" TEXT NOT NULL,
    "financialTransactionId" TEXT,
    "statusFrom" "ReconciliationStatus",
    "statusTo" "ReconciliationStatus" NOT NULL,
    "matchedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "difference" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "action" TEXT NOT NULL,
    "actor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReconciliationEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReconciliationItem_financialTransactionId_key" ON "ReconciliationItem"("financialTransactionId");
CREATE INDEX "ReconciliationItem_companyId_status_occurredAt_idx" ON "ReconciliationItem"("companyId", "status", "occurredAt");
CREATE INDEX "ReconciliationItem_financialAccountId_occurredAt_idx" ON "ReconciliationItem"("financialAccountId", "occurredAt");
CREATE INDEX "ReconciliationItem_customerId_occurredAt_idx" ON "ReconciliationItem"("customerId", "occurredAt");
CREATE INDEX "ReconciliationItem_supplierId_occurredAt_idx" ON "ReconciliationItem"("supplierId", "occurredAt");
CREATE INDEX "ReconciliationItem_documentReference_idx" ON "ReconciliationItem"("documentReference");
CREATE INDEX "ReconciliationEvent_companyId_createdAt_idx" ON "ReconciliationEvent"("companyId", "createdAt");
CREATE INDEX "ReconciliationEvent_reconciliationItemId_createdAt_idx" ON "ReconciliationEvent"("reconciliationItemId", "createdAt");

ALTER TABLE "ReconciliationItem" ADD CONSTRAINT "ReconciliationItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReconciliationItem" ADD CONSTRAINT "ReconciliationItem_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReconciliationItem" ADD CONSTRAINT "ReconciliationItem_financialTransactionId_fkey" FOREIGN KEY ("financialTransactionId") REFERENCES "FinancialTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReconciliationItem" ADD CONSTRAINT "ReconciliationItem_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReconciliationItem" ADD CONSTRAINT "ReconciliationItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReconciliationEvent" ADD CONSTRAINT "ReconciliationEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReconciliationEvent" ADD CONSTRAINT "ReconciliationEvent_reconciliationItemId_fkey" FOREIGN KEY ("reconciliationItemId") REFERENCES "ReconciliationItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
