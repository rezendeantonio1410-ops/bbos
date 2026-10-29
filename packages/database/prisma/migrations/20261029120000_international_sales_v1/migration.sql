ALTER TABLE "Customer"
  ADD COLUMN "countryCode" VARCHAR(2) NOT NULL DEFAULT 'BR',
  ADD COLUMN "countryName" TEXT NOT NULL DEFAULT 'Brasil',
  ADD COLUMN "foreignTaxId" TEXT;

ALTER TABLE "SalesOrder"
  ADD COLUMN "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
  ADD COLUMN "exchangeRateToBrl" DECIMAL(14,6),
  ADD COLUMN "exchangeRateDate" TIMESTAMP(3),
  ADD COLUMN "exportDepartureLocation" TEXT,
  ADD COLUMN "exportDepartureState" VARCHAR(2);

CREATE INDEX "Customer_companyId_countryCode_idx"
  ON "Customer"("companyId", "countryCode");
