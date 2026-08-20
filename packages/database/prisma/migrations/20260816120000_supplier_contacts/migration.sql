CREATE TABLE "SupplierContact" (
  "id" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT,
  "whatsapp" TEXT,
  "email" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "canConfirmBusiness" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierContact_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "GreenCoffeePurchaseAcceptance" ADD COLUMN "supplierContactId" TEXT;
ALTER TABLE "GreenCoffeePurchaseAcceptance" ADD COLUMN "contactPhoneSnapshot" TEXT;
ALTER TABLE "GreenCoffeePurchaseAcceptance" ADD COLUMN "contactEmailSnapshot" TEXT;

CREATE INDEX "SupplierContact_supplierId_active_canConfirmBusiness_idx" ON "SupplierContact"("supplierId", "active", "canConfirmBusiness");
CREATE INDEX "GreenCoffeePurchaseAcceptance_supplierContactId_idx" ON "GreenCoffeePurchaseAcceptance"("supplierContactId");
ALTER TABLE "SupplierContact" ADD CONSTRAINT "SupplierContact_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GreenCoffeePurchaseAcceptance" ADD CONSTRAINT "GreenCoffeePurchaseAcceptance_supplierContactId_fkey" FOREIGN KEY ("supplierContactId") REFERENCES "SupplierContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
