CREATE TABLE "CommercialCatalogDocument" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "priceTableId" TEXT,
  "version" TEXT NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validFrom" TIMESTAMP(3) NOT NULL,
  "validUntil" TIMESTAMP(3),
  "options" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'VIGENTE',
  "documentHash" TEXT,
  "revokedAt" TIMESTAMP(3),
  "supersededAt" TIMESTAMP(3),
  "validationUrl" TEXT,
  CONSTRAINT "CommercialCatalogDocument_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CommercialCatalogDocument_companyId_generatedAt_idx" ON "CommercialCatalogDocument"("companyId", "generatedAt");
CREATE INDEX "CommercialCatalogDocument_priceTableId_status_idx" ON "CommercialCatalogDocument"("priceTableId", "status");
CREATE INDEX "CommercialCatalogDocument_userId_generatedAt_idx" ON "CommercialCatalogDocument"("userId", "generatedAt");
ALTER TABLE "CommercialCatalogDocument" ADD CONSTRAINT "CommercialCatalogDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommercialCatalogDocument" ADD CONSTRAINT "CommercialCatalogDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercialCatalogDocument" ADD CONSTRAINT "CommercialCatalogDocument_priceTableId_fkey" FOREIGN KEY ("priceTableId") REFERENCES "PriceTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
