ALTER TABLE "CoffeeVariety" ADD COLUMN "breeder" TEXT;
ALTER TABLE "CoffeeVariety" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "CoffeeRegion" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "country" TEXT NOT NULL DEFAULT 'Brasil',
  "state" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CoffeeRegion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CoffeeRegion_companyId_state_name_key" ON "CoffeeRegion"("companyId", "state", "name");
CREATE INDEX "CoffeeRegion_companyId_state_active_idx" ON "CoffeeRegion"("companyId", "state", "active");
ALTER TABLE "CoffeeRegion" ADD CONSTRAINT "CoffeeRegion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ScreenClassification" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScreenClassification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ScreenClassification_companyId_code_key" ON "ScreenClassification"("companyId", "code");
CREATE INDEX "ScreenClassification_companyId_active_idx" ON "ScreenClassification"("companyId", "active");
ALTER TABLE "ScreenClassification" ADD CONSTRAINT "ScreenClassification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GreenCoffeePurchase"
  ADD COLUMN "speciesId" TEXT,
  ADD COLUMN "cultivarId" TEXT,
  ADD COLUMN "coffeeRegionId" TEXT,
  ADD COLUMN "screenClassificationId" TEXT;
CREATE INDEX "GreenCoffeePurchase_speciesId_idx" ON "GreenCoffeePurchase"("speciesId");
CREATE INDEX "GreenCoffeePurchase_cultivarId_idx" ON "GreenCoffeePurchase"("cultivarId");
CREATE INDEX "GreenCoffeePurchase_coffeeRegionId_idx" ON "GreenCoffeePurchase"("coffeeRegionId");
CREATE INDEX "GreenCoffeePurchase_screenClassificationId_idx" ON "GreenCoffeePurchase"("screenClassificationId");
ALTER TABLE "GreenCoffeePurchase" ADD CONSTRAINT "GreenCoffeePurchase_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "CoffeeSpecies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GreenCoffeePurchase" ADD CONSTRAINT "GreenCoffeePurchase_cultivarId_fkey" FOREIGN KEY ("cultivarId") REFERENCES "CoffeeVariety"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GreenCoffeePurchase" ADD CONSTRAINT "GreenCoffeePurchase_coffeeRegionId_fkey" FOREIGN KEY ("coffeeRegionId") REFERENCES "CoffeeRegion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GreenCoffeePurchase" ADD CONSTRAINT "GreenCoffeePurchase_screenClassificationId_fkey" FOREIGN KEY ("screenClassificationId") REFERENCES "ScreenClassification"("id") ON DELETE SET NULL ON UPDATE CASCADE;
