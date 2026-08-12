CREATE TYPE "SalesPersonType" AS ENUM ('INTERNAL_SELLER', 'FIELD_SELLER', 'SALES_REPRESENTATIVE', 'SALES_MANAGER');
CREATE TYPE "SalesPersonStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
CREATE TYPE "SalesTargetType" AS ENUM ('REVENUE', 'VOLUME', 'MARGIN', 'NEW_CUSTOMERS', 'PRODUCT', 'MIX');
CREATE TYPE "SalesVisitStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
CREATE TYPE "SalesOpportunityStage" AS ENUM ('PROSPECT', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST');
CREATE TYPE "CommissionEntryStatus" AS ENUM ('ESTIMATED', 'ACCRUED', 'RELEASED', 'PAID', 'REVERSED');

-- AlterTable
ALTER TABLE "SalesOrder" ADD COLUMN     "salesPersonId" TEXT;

-- CreateTable
CREATE TABLE "SalesPerson" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "SalesPersonType" NOT NULL,
    "status" "SalesPersonStatus" NOT NULL DEFAULT 'ACTIVE',
    "managerId" TEXT,
    "territory" TEXT,
    "region" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "discountLimit" DECIMAL(7,3) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerPortfolioAssignment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "salesPersonId" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "territory" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerPortfolioAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesTarget" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "salesPersonId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "targetType" "SalesTargetType" NOT NULL,
    "targetValue" DECIMAL(14,2) NOT NULL,
    "actualValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesVisit" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "salesPersonId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "status" "SalesVisitStatus" NOT NULL DEFAULT 'SCHEDULED',
    "purpose" TEXT,
    "notes" TEXT,
    "nextAction" TEXT,
    "nextActionDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOpportunity" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "salesPersonId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "stage" "SalesOpportunityStage" NOT NULL DEFAULT 'PROSPECT',
    "estimatedValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "estimatedVolume" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "probability" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "expectedCloseDate" TIMESTAMP(3),
    "lossReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionPlan" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionRule" (
    "id" TEXT NOT NULL,
    "commissionPlanId" TEXT NOT NULL,
    "salesPersonId" TEXT,
    "productVariantId" TEXT,
    "region" TEXT,
    "channel" TEXT,
    "percentage" DECIMAL(7,3),
    "fixedValue" DECIMAL(14,2),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),

    CONSTRAINT "CommissionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionEntry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "salesPersonId" TEXT NOT NULL,
    "salesOrderId" TEXT,
    "invoiceId" TEXT,
    "paymentId" TEXT,
    "commissionPlanId" TEXT,
    "baseAmount" DECIMAL(14,2) NOT NULL,
    "rate" DECIMAL(7,3) NOT NULL DEFAULT 0,
    "commissionAmount" DECIMAL(14,2) NOT NULL,
    "status" "CommissionEntryStatus" NOT NULL DEFAULT 'ESTIMATED',
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "reason" TEXT,

    CONSTRAINT "CommissionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesPerson_userId_key" ON "SalesPerson"("userId");

-- CreateIndex
CREATE INDEX "SalesPerson_companyId_status_idx" ON "SalesPerson"("companyId", "status");

-- CreateIndex
CREATE INDEX "CustomerPortfolioAssignment_companyId_salesPersonId_validTo_idx" ON "CustomerPortfolioAssignment"("companyId", "salesPersonId", "validTo");

-- CreateIndex
CREATE INDEX "CustomerPortfolioAssignment_customerId_validFrom_idx" ON "CustomerPortfolioAssignment"("customerId", "validFrom");

-- CreateIndex
CREATE UNIQUE INDEX "SalesTarget_salesPersonId_period_targetType_key" ON "SalesTarget"("salesPersonId", "period", "targetType");

-- CreateIndex
CREATE INDEX "SalesVisit_companyId_salesPersonId_scheduledAt_idx" ON "SalesVisit"("companyId", "salesPersonId", "scheduledAt");

-- CreateIndex
CREATE INDEX "SalesOpportunity_companyId_salesPersonId_stage_idx" ON "SalesOpportunity"("companyId", "salesPersonId", "stage");

-- CreateIndex
CREATE INDEX "CommissionEntry_companyId_salesPersonId_status_idx" ON "CommissionEntry"("companyId", "salesPersonId", "status");
