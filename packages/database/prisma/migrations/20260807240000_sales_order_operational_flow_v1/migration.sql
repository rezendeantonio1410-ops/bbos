-- Sales Order operational flow: additive and backwards compatible.
ALTER TYPE "SalesOrderStatus" ADD VALUE IF NOT EXISTS 'RESERVED';
ALTER TYPE "SalesOrderStatus" ADD VALUE IF NOT EXISTS 'PICKING';
ALTER TYPE "SalesOrderStatus" ADD VALUE IF NOT EXISTS 'READY_TO_SHIP';
ALTER TYPE "SalesOrderStatus" ADD VALUE IF NOT EXISTS 'INVOICED';

ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "orderNumber" TEXT;
ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "orderDate" TIMESTAMP(3);
ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "expectedDeliveryDate" TIMESTAMP(3);
ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "subtotal" DECIMAL(14,2);
ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "discount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "freight" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "SalesOrderItem" ADD COLUMN IF NOT EXISTS "discount" DECIMAL(14,2) NOT NULL DEFAULT 0;

UPDATE "SalesOrder" SET "orderNumber" = "code" WHERE "orderNumber" IS NULL;
UPDATE "SalesOrder" SET "orderDate" = "orderedAt" WHERE "orderDate" IS NULL;
UPDATE "SalesOrder" SET "subtotal" = "totalAmount" WHERE "subtotal" IS NULL;

CREATE INDEX IF NOT EXISTS "SalesOrder_orderNumber_idx" ON "SalesOrder"("orderNumber");
