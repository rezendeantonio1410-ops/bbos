ALTER TYPE "GreenCoffeeSupplierType" ADD VALUE IF NOT EXISTS 'COOPERATIVE';
ALTER TYPE "GreenCoffeeSupplierType" ADD VALUE IF NOT EXISTS 'ASSOCIATION';
ALTER TYPE "GreenCoffeeSupplierType" ADD VALUE IF NOT EXISTS 'EXPORTER';
ALTER TYPE "GreenCoffeeSupplierType" ADD VALUE IF NOT EXISTS 'OTHER';

ALTER TABLE "Supplier" ADD COLUMN "tradeName" TEXT;
ALTER TABLE "SupplierOriginUnit" ADD COLUMN "taxId" TEXT;
ALTER TABLE "SupplierOriginUnit" ADD COLUMN "stateRegistration" TEXT;
ALTER TABLE "SupplierOriginUnit" ADD COLUMN "address" TEXT;
ALTER TABLE "SupplierOriginUnit" ADD COLUMN "latitude" DECIMAL(10,7);
ALTER TABLE "SupplierOriginUnit" ADD COLUMN "longitude" DECIMAL(10,7);
ALTER TABLE "SupplierOriginUnit" ADD COLUMN "altitudeMeters" DECIMAL(10,2);
ALTER TABLE "SupplierOriginUnit" ADD COLUMN "coffeeAreaHa" DECIMAL(12,2);

CREATE TABLE "SupplierOriginProduction" (
    "id" TEXT NOT NULL,
    "originUnitId" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,
    "cultivarId" TEXT,
    "harvest" TEXT,
    "certifications" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupplierOriginProduction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SupplierOriginProduction_originUnitId_active_idx" ON "SupplierOriginProduction"("originUnitId", "active");
CREATE INDEX "SupplierOriginProduction_speciesId_cultivarId_idx" ON "SupplierOriginProduction"("speciesId", "cultivarId");
ALTER TABLE "SupplierOriginProduction" ADD CONSTRAINT "SupplierOriginProduction_originUnitId_fkey" FOREIGN KEY ("originUnitId") REFERENCES "SupplierOriginUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierOriginProduction" ADD CONSTRAINT "SupplierOriginProduction_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "CoffeeSpecies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierOriginProduction" ADD CONSTRAINT "SupplierOriginProduction_cultivarId_fkey" FOREIGN KEY ("cultivarId") REFERENCES "CoffeeVariety"("id") ON DELETE SET NULL ON UPDATE CASCADE;
