-- Commercial end customers belong to a distributor, not to the fiscal Customer registry.
CREATE TABLE "PartnerEndCustomer" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "taxId" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "city" TEXT,
  "state" TEXT,
  "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerEndCustomer_partner_fkey" FOREIGN KEY ("partnerId") REFERENCES "StorefrontPartner"("id") ON DELETE CASCADE,
  CONSTRAINT "PartnerEndCustomer_company_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE
);
CREATE INDEX "PartnerEndCustomer_partner_active_idx" ON "PartnerEndCustomer"("companyId","partnerId","active");
CREATE INDEX "PartnerEndCustomer_partner_geo_idx" ON "PartnerEndCustomer"("companyId","partnerId","state","city");
ALTER TABLE "SalesOrder" ADD COLUMN "partnerEndCustomerId" TEXT;
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_partnerEndCustomer_fkey" FOREIGN KEY ("partnerEndCustomerId") REFERENCES "PartnerEndCustomer"("id") ON DELETE SET NULL;
CREATE INDEX "SalesOrder_partnerEndCustomer_idx" ON "SalesOrder"("companyId","partnerEndCustomerId");
-- The fiscal customerId remains unchanged and is the only fiscal invoice recipient.
