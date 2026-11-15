CREATE TYPE "StorefrontPartnerAccessLevel" AS ENUM ('VIEWER', 'SELLER', 'DISTRIBUTOR');

ALTER TABLE "StorefrontPartner"
  ADD COLUMN "portalAccessLevel" "StorefrontPartnerAccessLevel" NOT NULL DEFAULT 'VIEWER';

CREATE TABLE "StorefrontPartnerCustomer" (
  "partnerId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StorefrontPartnerCustomer_pkey" PRIMARY KEY ("partnerId", "customerId"),
  CONSTRAINT "StorefrontPartnerCustomer_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "StorefrontPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StorefrontPartnerCustomer_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "StorefrontPartnerCustomer_customerId_idx"
  ON "StorefrontPartnerCustomer"("customerId");

ALTER TABLE "SalesOrder"
  ADD COLUMN "createdByStorefrontPartnerId" TEXT;

ALTER TABLE "SalesOrder"
  ADD CONSTRAINT "SalesOrder_createdByStorefrontPartnerId_fkey"
  FOREIGN KEY ("createdByStorefrontPartnerId") REFERENCES "StorefrontPartner"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "SalesOrder_createdByStorefrontPartnerId_orderedAt_idx"
  ON "SalesOrder"("createdByStorefrontPartnerId", "orderedAt");
