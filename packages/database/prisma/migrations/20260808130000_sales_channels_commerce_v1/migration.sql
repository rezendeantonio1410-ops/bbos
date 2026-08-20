-- Sales channels and channel pricing. Existing orders remain compatible via nullable salesChannelId.
CREATE TYPE "SalesChannelType" AS ENUM ('ECOMMERCE', 'B2B', 'DISTRIBUIDOR', 'CAFETERIA', 'ESCRITORIO', 'EXPORTACAO', 'OUTRO');

CREATE TABLE "SalesChannel" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "SalesChannelType" NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "country" TEXT,
  "currency" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SalesChannel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductPrice" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "productVariantId" TEXT NOT NULL,
  "salesChannelId" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "price" DECIMAL(14,2) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "validFrom" TIMESTAMP(3),
  "validUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductPrice_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SalesOrder" ADD COLUMN "salesChannelId" TEXT;

CREATE UNIQUE INDEX "SalesChannel_companyId_code_key" ON "SalesChannel"("companyId", "code");
CREATE INDEX "SalesChannel_companyId_active_idx" ON "SalesChannel"("companyId", "active");
CREATE UNIQUE INDEX "ProductPrice_productVariantId_salesChannelId_currency_validFrom_key" ON "ProductPrice"("productVariantId", "salesChannelId", "currency", "validFrom");
CREATE INDEX "ProductPrice_companyId_salesChannelId_active_idx" ON "ProductPrice"("companyId", "salesChannelId", "active");
CREATE INDEX "ProductPrice_productVariantId_active_idx" ON "ProductPrice"("productVariantId", "active");
CREATE INDEX "SalesOrder_salesChannelId_status_idx" ON "SalesOrder"("salesChannelId", "status");

ALTER TABLE "SalesChannel" ADD CONSTRAINT "SalesChannel_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductPrice" ADD CONSTRAINT "ProductPrice_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductPrice" ADD CONSTRAINT "ProductPrice_productVariantId_fkey"
  FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductPrice" ADD CONSTRAINT "ProductPrice_salesChannelId_fkey"
  FOREIGN KEY ("salesChannelId") REFERENCES "SalesChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_salesChannelId_fkey"
  FOREIGN KEY ("salesChannelId") REFERENCES "SalesChannel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
