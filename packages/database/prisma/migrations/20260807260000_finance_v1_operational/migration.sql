CREATE TYPE "FinancialAccountType" AS ENUM ('CASH','BANK','DIGITAL_ACCOUNT','OTHER');
CREATE TYPE "ReceivableStatus" AS ENUM ('OPEN','PARTIALLY_PAID','PAID','OVERDUE','CANCELLED');
CREATE TYPE "PayableStatus" AS ENUM ('OPEN','PARTIALLY_PAID','PAID','OVERDUE','CANCELLED');
CREATE TYPE "FinancialTransactionType" AS ENUM ('RECEIPT','PAYMENT','TRANSFER_IN','TRANSFER_OUT','ADJUSTMENT');

ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "invoicedAt" TIMESTAMP(3);

CREATE TABLE "FinancialAccount" (
  "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "name" TEXT NOT NULL,
  "type" "FinancialAccountType" NOT NULL, "currency" TEXT NOT NULL DEFAULT 'BRL',
  "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0, "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinancialAccount_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AccountsReceivable" (
  "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "customerId" TEXT NOT NULL, "salesOrderId" TEXT,
  "invoiceId" TEXT, "issueDate" TIMESTAMP(3) NOT NULL, "dueDate" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL, "openAmount" DECIMAL(14,2) NOT NULL,
  "status" "ReceivableStatus" NOT NULL DEFAULT 'OPEN', "paymentDate" TIMESTAMP(3), "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccountsReceivable_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AccountsPayable" (
  "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "supplierId" TEXT, "costCenterId" TEXT,
  "description" TEXT NOT NULL, "issueDate" TIMESTAMP(3) NOT NULL, "dueDate" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL, "openAmount" DECIMAL(14,2) NOT NULL,
  "status" "PayableStatus" NOT NULL DEFAULT 'OPEN', "category" TEXT NOT NULL, "paymentDate" TIMESTAMP(3), "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccountsPayable_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Payment" (
  "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "accountsReceivableId" TEXT, "accountsPayableId" TEXT,
  "financialAccountId" TEXT NOT NULL, "amount" DECIMAL(14,2) NOT NULL, "paidAt" TIMESTAMP(3) NOT NULL,
  "method" TEXT NOT NULL, "notes" TEXT, "idempotencyKey" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "FinancialTransaction" (
  "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "financialAccountId" TEXT NOT NULL, "paymentId" TEXT,
  "costCenterId" TEXT, "type" "FinancialTransactionType" NOT NULL, "amount" DECIMAL(14,2) NOT NULL,
  "category" TEXT NOT NULL, "description" TEXT NOT NULL, "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "FinancialTransaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AccountsReceivable_salesOrderId_key" ON "AccountsReceivable"("salesOrderId");
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");
CREATE UNIQUE INDEX "FinancialTransaction_paymentId_key" ON "FinancialTransaction"("paymentId");
CREATE INDEX "FinancialAccount_companyId_active_idx" ON "FinancialAccount"("companyId","active");
CREATE INDEX "AccountsReceivable_companyId_status_dueDate_idx" ON "AccountsReceivable"("companyId","status","dueDate");
CREATE INDEX "AccountsPayable_companyId_status_dueDate_idx" ON "AccountsPayable"("companyId","status","dueDate");
CREATE INDEX "FinancialTransaction_companyId_occurredAt_idx" ON "FinancialTransaction"("companyId","occurredAt");
ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountsReceivable" ADD CONSTRAINT "AccountsReceivable_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountsReceivable" ADD CONSTRAINT "AccountsReceivable_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountsReceivable" ADD CONSTRAINT "AccountsReceivable_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountsPayable" ADD CONSTRAINT "AccountsPayable_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountsPayable" ADD CONSTRAINT "AccountsPayable_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountsPayable" ADD CONSTRAINT "AccountsPayable_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_accountsReceivableId_fkey" FOREIGN KEY ("accountsReceivableId") REFERENCES "AccountsReceivable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_accountsPayableId_fkey" FOREIGN KEY ("accountsPayableId") REFERENCES "AccountsPayable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
