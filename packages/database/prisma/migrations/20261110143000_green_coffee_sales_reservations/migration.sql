CREATE TABLE "GreenCoffeeSalesReservation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "salesOrderItemId" TEXT NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "coffeeLotId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantityKg" DECIMAL(14,3) NOT NULL,
    "status" "InventoryReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "idempotencyKey" TEXT NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GreenCoffeeSalesReservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GreenCoffeeSalesReservation_idempotencyKey_key"
ON "GreenCoffeeSalesReservation"("idempotencyKey");

CREATE UNIQUE INDEX "GreenCoffeeSalesReservation_salesOrderItemId_coffeeLotId_key"
ON "GreenCoffeeSalesReservation"("salesOrderItemId", "coffeeLotId");

CREATE INDEX "GreenCoffeeSalesReservation_salesOrderId_status_idx"
ON "GreenCoffeeSalesReservation"("salesOrderId", "status");

CREATE INDEX "GreenCoffeeSalesReservation_coffeeLotId_status_idx"
ON "GreenCoffeeSalesReservation"("coffeeLotId", "status");

CREATE INDEX "GreenCoffeeSalesReservation_productVariantId_status_idx"
ON "GreenCoffeeSalesReservation"("productVariantId", "status");

ALTER TABLE "GreenCoffeeSalesReservation"
ADD CONSTRAINT "GreenCoffeeSalesReservation_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GreenCoffeeSalesReservation"
ADD CONSTRAINT "GreenCoffeeSalesReservation_salesOrderId_fkey"
FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GreenCoffeeSalesReservation"
ADD CONSTRAINT "GreenCoffeeSalesReservation_salesOrderItemId_fkey"
FOREIGN KEY ("salesOrderItemId") REFERENCES "SalesOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GreenCoffeeSalesReservation"
ADD CONSTRAINT "GreenCoffeeSalesReservation_productVariantId_fkey"
FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GreenCoffeeSalesReservation"
ADD CONSTRAINT "GreenCoffeeSalesReservation_coffeeLotId_fkey"
FOREIGN KEY ("coffeeLotId") REFERENCES "CoffeeLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GreenCoffeeSalesReservation"
ADD CONSTRAINT "GreenCoffeeSalesReservation_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
