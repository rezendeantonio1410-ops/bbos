ALTER TYPE "CommercialNotificationType" ADD VALUE IF NOT EXISTS 'CREDIT_SUBMITTED';
ALTER TYPE "CommercialNotificationType" ADD VALUE IF NOT EXISTS 'CREDIT_UNDER_REVIEW';
ALTER TYPE "CommercialNotificationType" ADD VALUE IF NOT EXISTS 'CREDIT_DOCUMENT_REQUESTED';
ALTER TYPE "CommercialNotificationType" ADD VALUE IF NOT EXISTS 'CREDIT_APPROVED';
ALTER TYPE "CommercialNotificationType" ADD VALUE IF NOT EXISTS 'CREDIT_PARTIALLY_APPROVED';
ALTER TYPE "CommercialNotificationType" ADD VALUE IF NOT EXISTS 'CREDIT_REJECTED';
ALTER TYPE "CommercialNotificationType" ADD VALUE IF NOT EXISTS 'DOCUMENT_REQUESTED';
ALTER TYPE "CommercialNotificationType" ADD VALUE IF NOT EXISTS 'DOCUMENT_RECEIVED';
ALTER TYPE "CommercialNotificationType" ADD VALUE IF NOT EXISTS 'DOCUMENT_REJECTED';
ALTER TABLE "CustomerContact" ADD COLUMN "primary" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CreditRequest" ADD COLUMN "analystUserId" TEXT, ADD COLUMN "decisionReason" TEXT, ADD COLUMN "internalNotes" TEXT;
CREATE TABLE "CustomerAddress" (
  "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "customerId" TEXT NOT NULL, "type" TEXT NOT NULL, "street" TEXT NOT NULL, "number" TEXT, "complement" TEXT, "district" TEXT, "city" TEXT NOT NULL, "state" TEXT NOT NULL, "postalCode" TEXT, "country" TEXT NOT NULL DEFAULT 'BR', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CustomerAddress_customerId_type_idx" ON "CustomerAddress"("customerId","type");
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditRequest" ADD CONSTRAINT "CreditRequest_analystUserId_fkey" FOREIGN KEY ("analystUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
