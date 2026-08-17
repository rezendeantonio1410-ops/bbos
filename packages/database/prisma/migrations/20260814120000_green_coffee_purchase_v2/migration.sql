CREATE TYPE "PurchaseApprovalStatus" AS ENUM ('DRAFT','PENDING_APPROVAL','UNDER_REVIEW','APPROVED','REJECTED');
CREATE TYPE "PurchaseOperationalStatus" AS ENUM ('NOT_STARTED','AWAITING_DELIVERY','PARTIALLY_RECEIVED','RECEIVED','CLOSED','CANCELLED');
CREATE TYPE "PurchasePaymentTermType" AS ENUM ('CASH','DAYS_AFTER_PURCHASE','FIXED_DATE','INSTALLMENTS','ADVANCE_AND_BALANCE','AFTER_RECEIPT','CUSTOM');
CREATE TYPE "PurchaseInstallmentStatus" AS ENUM ('PLANNED','COMMITTED','PAID','CANCELLED');

ALTER TABLE "GreenCoffeePurchase"
  ADD COLUMN "approvalStatus" "PurchaseApprovalStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "operationalStatus" "PurchaseOperationalStatus" NOT NULL DEFAULT 'AWAITING_DELIVERY',
  ADD COLUMN "createdByUserId" TEXT,
  ADD COLUMN "createdByName" TEXT,
  ADD COLUMN "approvedByUserId" TEXT,
  ADD COLUMN "approvedByName" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "rejectedByUserId" TEXT,
  ADD COLUMN "rejectedAt" TIMESTAMP(3),
  ADD COLUMN "rejectionReason" TEXT,
  ADD COLUMN "department" TEXT,
  ADD COLUMN "approverName" TEXT,
  ADD COLUMN "supplierSnapshot" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "qualityCategory" TEXT NOT NULL DEFAULT 'Outra',
  ADD COLUMN "additionalSpecification" TEXT,
  ADD COLUMN "contractReference" TEXT,
  ADD COLUMN "paymentTermType" "PurchasePaymentTermType" NOT NULL DEFAULT 'CUSTOM',
  ADD COLUMN "paymentTermData" JSONB NOT NULL DEFAULT '{}';

UPDATE "GreenCoffeePurchase"
SET "createdByUserId" = "buyerId", "createdByName" = "buyerName",
    "approvalStatus" = CASE
      WHEN "confirmedAt" IS NOT NULL AND "status"::text <> 'DRAFT'
        THEN 'APPROVED'::"PurchaseApprovalStatus"
      ELSE 'DRAFT'::"PurchaseApprovalStatus" END,
    "approvedByUserId" = CASE
      WHEN "confirmedAt" IS NOT NULL AND "status"::text <> 'DRAFT' THEN "buyerId"
      ELSE NULL END,
    "approvedByName" = CASE
      WHEN "confirmedAt" IS NOT NULL AND "status"::text <> 'DRAFT' THEN "buyerName"
      ELSE NULL END,
    "approvedAt" = CASE
      WHEN "confirmedAt" IS NOT NULL AND "status"::text <> 'DRAFT' THEN "confirmedAt"
      ELSE NULL END,
    "supplierSnapshot" = jsonb_build_object('supplierId', "supplierId"),
    "operationalStatus" = CASE "status"::text
      WHEN 'DRAFT' THEN 'NOT_STARTED'::"PurchaseOperationalStatus"
      WHEN 'PARTIALLY_RECEIVED' THEN 'PARTIALLY_RECEIVED'::"PurchaseOperationalStatus"
      WHEN 'RECEIVED' THEN 'RECEIVED'::"PurchaseOperationalStatus"
      WHEN 'CLOSED' THEN 'CLOSED'::"PurchaseOperationalStatus"
      WHEN 'CANCELLED' THEN 'CANCELLED'::"PurchaseOperationalStatus"
      ELSE 'AWAITING_DELIVERY'::"PurchaseOperationalStatus" END;

ALTER TABLE "GreenCoffeePurchase" ALTER COLUMN "createdByUserId" SET NOT NULL;
ALTER TABLE "GreenCoffeePurchase" ALTER COLUMN "createdByName" SET NOT NULL;

CREATE TABLE "GreenCoffeePurchaseInstallment" (
  "id" TEXT NOT NULL,
  "purchaseId" TEXT NOT NULL,
  "installmentNumber" INTEGER NOT NULL,
  "percentage" DECIMAL(7,4) NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "status" "PurchaseInstallmentStatus" NOT NULL DEFAULT 'PLANNED',
  "accountsPayableId" TEXT,
  "paidAt" TIMESTAMP(3),
  "paymentReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GreenCoffeePurchaseInstallment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GreenCoffeePurchaseInstallment_purchaseId_installmentNumber_key" ON "GreenCoffeePurchaseInstallment"("purchaseId","installmentNumber");
CREATE UNIQUE INDEX "GreenCoffeePurchaseInstallment_accountsPayableId_key" ON "GreenCoffeePurchaseInstallment"("accountsPayableId");
CREATE INDEX "GreenCoffeePurchaseInstallment_status_dueDate_idx" ON "GreenCoffeePurchaseInstallment"("status","dueDate");
ALTER TABLE "GreenCoffeePurchaseInstallment" ADD CONSTRAINT "GreenCoffeePurchaseInstallment_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "GreenCoffeePurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GreenCoffeePurchaseInstallment" ADD CONSTRAINT "GreenCoffeePurchaseInstallment_accountsPayableId_fkey" FOREIGN KEY ("accountsPayableId") REFERENCES "AccountsPayable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SupplierBankAccount" (
  "id" TEXT NOT NULL,"companyId" TEXT NOT NULL,"supplierId" TEXT NOT NULL,
  "bankName" TEXT NOT NULL,"bankCode" TEXT,"agency" TEXT,"accountNumber" TEXT,"accountType" TEXT,
  "holderName" TEXT NOT NULL,"holderTaxId" TEXT NOT NULL,"pixKey" TEXT,"pixType" TEXT,
  "iban" TEXT,"swiftBic" TEXT,"country" TEXT NOT NULL DEFAULT 'Brasil',"active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierBankAccount_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SupplierBankAccount_supplierId_active_idx" ON "SupplierBankAccount"("supplierId","active");
ALTER TABLE "SupplierBankAccount" ADD CONSTRAINT "SupplierBankAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierBankAccount" ADD CONSTRAINT "SupplierBankAccount_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CoffeeSpecies" (
  "id" TEXT NOT NULL,"companyId" TEXT NOT NULL,"code" TEXT NOT NULL,"name" TEXT NOT NULL,"active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CoffeeSpecies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CoffeeSpecies_companyId_code_key" ON "CoffeeSpecies"("companyId","code");
ALTER TABLE "CoffeeSpecies" ADD CONSTRAINT "CoffeeSpecies_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CoffeeVariety" (
  "id" TEXT NOT NULL,"speciesId" TEXT NOT NULL,"code" TEXT NOT NULL,"name" TEXT NOT NULL,"active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CoffeeVariety_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CoffeeVariety_speciesId_code_key" ON "CoffeeVariety"("speciesId","code");
CREATE INDEX "CoffeeVariety_speciesId_active_idx" ON "CoffeeVariety"("speciesId","active");
ALTER TABLE "CoffeeVariety" ADD CONSTRAINT "CoffeeVariety_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "CoffeeSpecies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "CoffeeSpecies" ("id","companyId","code","name","updatedAt")
SELECT 'sp_' || md5("id" || ':ARABICA'), "id", 'ARABICA', 'Arábica', CURRENT_TIMESTAMP FROM "Company"
ON CONFLICT ("companyId","code") DO NOTHING;

INSERT INTO "CoffeeVariety" ("id","speciesId","code","name","updatedAt")
SELECT 'vr_' || md5(s."id" || ':' || v.code), s."id", v.code, v.name, CURRENT_TIMESTAMP
FROM "CoffeeSpecies" s CROSS JOIN (VALUES
 ('IPR_98','IPR 98'),('IPR_99','IPR 99'),('IPR_100','IPR 100'),('IPR_102','IPR 102'),
 ('IPR_103','IPR 103'),('IPR_104','IPR 104'),('IPR_105','IPR 105'),('IPR_106','IPR 106'),
 ('IPR_107','IPR 107'),('OTHER','Outra'),('NOT_INFORMED','Não informada')
) AS v(code,name) WHERE s."code" = 'ARABICA'
ON CONFLICT ("speciesId","code") DO NOTHING;
