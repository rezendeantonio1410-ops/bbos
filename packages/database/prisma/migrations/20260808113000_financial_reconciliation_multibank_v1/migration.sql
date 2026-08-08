-- Incremental, non-destructive multibank reconciliation support.
CREATE TYPE "BankTransactionDirection" AS ENUM ('CREDIT', 'DEBIT');
CREATE TYPE "BankTransactionSource" AS ENUM ('MANUAL', 'CSV', 'OFX', 'API', 'OPEN_BANKING', 'OTHER');

ALTER TABLE "FinancialAccount"
  ADD COLUMN "accountNumberMasked" TEXT,
  ADD COLUMN "bankCode" TEXT,
  ADD COLUMN "branch" TEXT,
  ADD COLUMN "country" TEXT NOT NULL DEFAULT 'BR',
  ADD COLUMN "financialInstitutionId" TEXT,
  ADD COLUMN "ibanMasked" TEXT;

ALTER TABLE "ReconciliationItem"
  ADD COLUMN "bankTransactionId" TEXT,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'BRL';

CREATE TABLE "FinancialInstitution" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "country" TEXT NOT NULL DEFAULT 'BR',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinancialInstitution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BankTransaction" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "financialAccountId" TEXT NOT NULL,
  "financialInstitutionId" TEXT,
  "externalId" TEXT,
  "transactionDate" TIMESTAMP(3) NOT NULL,
  "postingDate" TIMESTAMP(3),
  "description" TEXT NOT NULL,
  "reference" TEXT,
  "counterparty" TEXT,
  "direction" "BankTransactionDirection" NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "balanceAfter" DECIMAL(14,2),
  "source" "BankTransactionSource" NOT NULL,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rawMetadata" JSONB,
  "reconciliationStatus" "ReconciliationStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinancialInstitution_companyId_active_idx" ON "FinancialInstitution"("companyId", "active");
CREATE UNIQUE INDEX "FinancialInstitution_companyId_code_key" ON "FinancialInstitution"("companyId", "code");
CREATE INDEX "BankTransaction_companyId_transactionDate_idx" ON "BankTransaction"("companyId", "transactionDate");
CREATE INDEX "BankTransaction_financialAccountId_transactionDate_idx" ON "BankTransaction"("financialAccountId", "transactionDate");
CREATE INDEX "BankTransaction_financialAccountId_reconciliationStatus_idx" ON "BankTransaction"("financialAccountId", "reconciliationStatus");
CREATE UNIQUE INDEX "BankTransaction_financialAccountId_externalId_key" ON "BankTransaction"("financialAccountId", "externalId");
CREATE INDEX "FinancialAccount_financialInstitutionId_active_idx" ON "FinancialAccount"("financialInstitutionId", "active");
CREATE UNIQUE INDEX "ReconciliationItem_bankTransactionId_key" ON "ReconciliationItem"("bankTransactionId");

ALTER TABLE "FinancialInstitution" ADD CONSTRAINT "FinancialInstitution_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_financialAccountId_fkey"
  FOREIGN KEY ("financialAccountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_financialInstitutionId_fkey"
  FOREIGN KEY ("financialInstitutionId") REFERENCES "FinancialInstitution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_financialInstitutionId_fkey"
  FOREIGN KEY ("financialInstitutionId") REFERENCES "FinancialInstitution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReconciliationItem" ADD CONSTRAINT "ReconciliationItem_bankTransactionId_fkey"
  FOREIGN KEY ("bankTransactionId") REFERENCES "BankTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
