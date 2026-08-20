CREATE TABLE "SupplierOriginUnit" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Brasil',
    "state" TEXT NOT NULL,
    "municipality" TEXT,
    "coffeeRegionId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupplierOriginUnit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierOriginUnit_supplierId_name_key" ON "SupplierOriginUnit"("supplierId", "name");
CREATE INDEX "SupplierOriginUnit_supplierId_state_active_idx" ON "SupplierOriginUnit"("supplierId", "state", "active");
CREATE INDEX "SupplierOriginUnit_coffeeRegionId_idx" ON "SupplierOriginUnit"("coffeeRegionId");

ALTER TABLE "SupplierOriginUnit" ADD CONSTRAINT "SupplierOriginUnit_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierOriginUnit" ADD CONSTRAINT "SupplierOriginUnit_coffeeRegionId_fkey" FOREIGN KEY ("coffeeRegionId") REFERENCES "CoffeeRegion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GreenCoffeePurchase" ADD COLUMN "originUnitId" TEXT;
CREATE INDEX "GreenCoffeePurchase_originUnitId_idx" ON "GreenCoffeePurchase"("originUnitId");
ALTER TABLE "GreenCoffeePurchase" ADD CONSTRAINT "GreenCoffeePurchase_originUnitId_fkey" FOREIGN KEY ("originUnitId") REFERENCES "SupplierOriginUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
