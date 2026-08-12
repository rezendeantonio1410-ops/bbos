CREATE TYPE "PriceTableStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'EXPIRED');
CREATE TYPE "CommercialPromotionStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'EXPIRED', 'CANCELLED');

ALTER TABLE "SalesOrderItem"
  ADD COLUMN "priceTableId" TEXT,
  ADD COLUMN "priceValidAt" TIMESTAMP(3),
  ADD COLUMN "promotionId" TEXT;

CREATE TABLE "PriceTable" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "channel" "SalesChannelType" NOT NULL,
  "salesChannelId" TEXT,
  "region" TEXT,
  "territory" TEXT,
  "validFrom" TIMESTAMP(3) NOT NULL,
  "validTo" TIMESTAMP(3),
  "status" "PriceTableStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PriceTable_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PriceTableItem" (
  "id" TEXT NOT NULL,
  "priceTableId" TEXT NOT NULL,
  "productVariantId" TEXT NOT NULL,
  "price" DECIMAL(14,2) NOT NULL,
  "minimumPrice" DECIMAL(14,2),
  "promotionalPrice" DECIMAL(14,2),
  "validFrom" TIMESTAMP(3) NOT NULL,
  "validTo" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PriceTableItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SalesPriceTableAssignment" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "priceTableId" TEXT NOT NULL,
  "salesPersonId" TEXT,
  "customerId" TEXT,
  "region" TEXT,
  "territory" TEXT,
  "channel" "SalesChannelType",
  "validFrom" TIMESTAMP(3) NOT NULL,
  "validTo" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalesPriceTableAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommercialPromotion" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "CommercialPromotionStatus" NOT NULL DEFAULT 'DRAFT',
  "validFrom" TIMESTAMP(3) NOT NULL,
  "validTo" TIMESTAMP(3) NOT NULL,
  "productVariantId" TEXT,
  "priceTableId" TEXT,
  "customerId" TEXT,
  "salesPersonId" TEXT,
  "region" TEXT,
  "promotionalPrice" DECIMAL(14,2),
  "discountPercent" DECIMAL(7,3),
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommercialPromotion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PriceTable_companyId_code_key" ON "PriceTable"("companyId", "code");
CREATE INDEX "PriceTable_companyId_status_validFrom_validTo_idx" ON "PriceTable"("companyId", "status", "validFrom", "validTo");
CREATE INDEX "PriceTableItem_priceTableId_productVariantId_active_idx" ON "PriceTableItem"("priceTableId", "productVariantId", "active");
CREATE INDEX "PriceTableItem_productVariantId_validFrom_validTo_idx" ON "PriceTableItem"("productVariantId", "validFrom", "validTo");
CREATE INDEX "SalesPriceTableAssignment_companyId_validFrom_validTo_idx" ON "SalesPriceTableAssignment"("companyId", "validFrom", "validTo");
CREATE INDEX "SalesPriceTableAssignment_salesPersonId_validFrom_validTo_idx" ON "SalesPriceTableAssignment"("salesPersonId", "validFrom", "validTo");
CREATE INDEX "SalesPriceTableAssignment_customerId_validFrom_validTo_idx" ON "SalesPriceTableAssignment"("customerId", "validFrom", "validTo");
CREATE INDEX "CommercialPromotion_companyId_status_validFrom_validTo_idx" ON "CommercialPromotion"("companyId", "status", "validFrom", "validTo");
CREATE INDEX "CommercialPromotion_productVariantId_validFrom_validTo_idx" ON "CommercialPromotion"("productVariantId", "validFrom", "validTo");

ALTER TABLE "PriceTable" ADD CONSTRAINT "PriceTable_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PriceTable" ADD CONSTRAINT "PriceTable_salesChannelId_fkey" FOREIGN KEY ("salesChannelId") REFERENCES "SalesChannel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PriceTableItem" ADD CONSTRAINT "PriceTableItem_priceTableId_fkey" FOREIGN KEY ("priceTableId") REFERENCES "PriceTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PriceTableItem" ADD CONSTRAINT "PriceTableItem_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesPriceTableAssignment" ADD CONSTRAINT "SalesPriceTableAssignment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesPriceTableAssignment" ADD CONSTRAINT "SalesPriceTableAssignment_priceTableId_fkey" FOREIGN KEY ("priceTableId") REFERENCES "PriceTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesPriceTableAssignment" ADD CONSTRAINT "SalesPriceTableAssignment_salesPersonId_fkey" FOREIGN KEY ("salesPersonId") REFERENCES "SalesPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesPriceTableAssignment" ADD CONSTRAINT "SalesPriceTableAssignment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommercialPromotion" ADD CONSTRAINT "CommercialPromotion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommercialPromotion" ADD CONSTRAINT "CommercialPromotion_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommercialPromotion" ADD CONSTRAINT "CommercialPromotion_priceTableId_fkey" FOREIGN KEY ("priceTableId") REFERENCES "PriceTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommercialPromotion" ADD CONSTRAINT "CommercialPromotion_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommercialPromotion" ADD CONSTRAINT "CommercialPromotion_salesPersonId_fkey" FOREIGN KEY ("salesPersonId") REFERENCES "SalesPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_priceTableId_fkey" FOREIGN KEY ("priceTableId") REFERENCES "PriceTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "CommercialPromotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
