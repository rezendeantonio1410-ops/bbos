-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'EXECUTIVE', 'INDUSTRIAL', 'FINANCE', 'SALES');

-- CreateEnum
CREATE TYPE "CoffeeLotStatus" AS ENUM ('RECEIVED', 'QUALITY_REVIEW', 'APPROVED', 'BLOCKED', 'CONSUMED');

-- CreateEnum
CREATE TYPE "ProductionStatus" AS ENUM ('PLANNED', 'RESERVED', 'IN_PROGRESS', 'ROASTED', 'PACKAGING', 'COMPLETED', 'BLOCKED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProductionPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "FinishedGoodsMovementType" AS ENUM ('ENTRY', 'EXIT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'RESERVED', 'PICKING', 'READY_TO_SHIP', 'INVOICED', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProductLineCode" AS ENUM ('RAROS', 'EPICOS', 'CLASSICOS', 'GOURMET');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('RECEIPT', 'QUALITY_TEST', 'TRANSFER', 'ROAST', 'GRIND', 'PACK', 'LOSS', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "CostType" AS ENUM ('RAW_MATERIAL', 'FREIGHT', 'LABOR', 'ENERGY', 'PACKAGING', 'TAX', 'OVERHEAD', 'OTHER');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tradeName" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'INDUSTRIAL',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT,
    "city" TEXT,
    "state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT,
    "segment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoffeeLot" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "harvest" TEXT,
    "variety" TEXT,
    "qualityScore" DECIMAL(5,2),
    "initialWeightKg" DECIMAL(14,3) NOT NULL,
    "currentWeightKg" DECIMAL(14,3) NOT NULL,
    "reservedWeightKg" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "purchaseCost" DECIMAL(14,2) NOT NULL,
    "landedCost" DECIMAL(14,2) NOT NULL,
    "status" "CoffeeLotStatus" NOT NULL DEFAULT 'RECEIVED',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoffeeLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Blend" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Blend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlendComponent" (
    "id" TEXT NOT NULL,
    "blendId" TEXT NOT NULL,
    "coffeeLotId" TEXT NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlendComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionOrder" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "blendId" TEXT,
    "code" TEXT NOT NULL,
    "productName" TEXT NOT NULL DEFAULT 'Produto não definido',
    "sku" TEXT NOT NULL DEFAULT 'SKU-PENDENTE',
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "responsible" TEXT NOT NULL DEFAULT 'Não atribuído',
    "priority" "ProductionPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "ProductionStatus" NOT NULL DEFAULT 'PLANNED',
    "plannedWeightKg" DECIMAL(14,3) NOT NULL,
    "actualInputKg" DECIMAL(14,3),
    "actualOutputKg" DECIMAL(14,3),
    "plannedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionBatch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "machine" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "greenInputKg" DECIMAL(14,3) NOT NULL,
    "roastedOutputKg" DECIMAL(14,3) NOT NULL,
    "lossKg" DECIMAL(14,3) NOT NULL,
    "lossPercent" DECIMAL(7,3) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "curveData" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionConsumption" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "productionBatchId" TEXT,
    "coffeeLotId" TEXT NOT NULL,
    "reservedKg" DECIMAL(14,3) NOT NULL,
    "consumedKg" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "percentage" DECIMAL(7,3) NOT NULL,
    "realCostPerKg" DECIMAL(14,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionConsumption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackagingConsumption" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "materialType" TEXT NOT NULL,
    "materialName" TEXT NOT NULL,
    "sku" TEXT,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "unitCost" DECIMAL(14,4) NOT NULL,
    "totalCost" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackagingConsumption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinishedGoodsMovement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "finishedProductId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "type" "FinishedGoodsMovementType" NOT NULL,
    "packageQuantity" INTEGER NOT NULL,
    "totalWeightKg" DECIMAL(14,3) NOT NULL,
    "reason" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinishedGoodsMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinishedProduct" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "blendId" TEXT,
    "productionOrderId" TEXT,
    "warehouseId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "line" "ProductLineCode" NOT NULL DEFAULT 'CLASSICOS',
    "packageWeightG" INTEGER NOT NULL,
    "quantityOnHand" INTEGER NOT NULL DEFAULT 0,
    "standardPrice" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinishedProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductLine" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" "ProductLineCode" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "positioning" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "productLineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "netWeightGrams" INTEGER NOT NULL,
    "salesUnit" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "coffeeCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "industrialCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "packagingCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "labelCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "boxCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "laborCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "energyCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "otherCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "marginPercent" DECIMAL(7,3) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrder" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "finishedProductId" TEXT,
    "code" TEXT NOT NULL,
    "orderNumber" TEXT,
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "orderedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orderDate" TIMESTAMP(3),
    "expectedDeliveryDate" TIMESTAMP(3),
    "subtotal" DECIMAL(14,2),
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "freight" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndustrialEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productionOrderId" TEXT,
    "coffeeLotId" TEXT,
    "warehouseId" TEXT,
    "type" "EventType" NOT NULL,
    "quantityKg" DECIMAL(14,3),
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndustrialEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "coffeeLotId" TEXT,
    "blendId" TEXT,
    "productionOrderId" TEXT,
    "productVariantId" TEXT,
    "finishedProductId" TEXT,
    "salesOrderId" TEXT,
    "type" "CostType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "quantityBasis" DECIMAL(14,3),
    "description" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_taxId_key" ON "Company"("taxId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_companyId_idx" ON "User"("companyId");

-- CreateIndex
CREATE INDEX "Supplier_companyId_idx" ON "Supplier"("companyId");

-- CreateIndex
CREATE INDEX "Customer_companyId_idx" ON "Customer"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_companyId_code_key" ON "Warehouse"("companyId", "code");

-- CreateIndex
CREATE INDEX "CoffeeLot_supplierId_warehouseId_idx" ON "CoffeeLot"("supplierId", "warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "CoffeeLot_companyId_code_key" ON "CoffeeLot"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Blend_companyId_code_version_key" ON "Blend"("companyId", "code", "version");

-- CreateIndex
CREATE UNIQUE INDEX "BlendComponent_blendId_coffeeLotId_key" ON "BlendComponent"("blendId", "coffeeLotId");

-- CreateIndex
CREATE INDEX "ProductionOrder_blendId_status_idx" ON "ProductionOrder"("blendId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionOrder_companyId_code_key" ON "ProductionOrder"("companyId", "code");

-- CreateIndex
CREATE INDEX "ProductionBatch_companyId_completedAt_idx" ON "ProductionBatch"("companyId", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionBatch_productionOrderId_code_key" ON "ProductionBatch"("productionOrderId", "code");

-- CreateIndex
CREATE INDEX "ProductionConsumption_coffeeLotId_idx" ON "ProductionConsumption"("coffeeLotId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionConsumption_productionOrderId_coffeeLotId_key" ON "ProductionConsumption"("productionOrderId", "coffeeLotId");

-- CreateIndex
CREATE INDEX "PackagingConsumption_productionOrderId_idx" ON "PackagingConsumption"("productionOrderId");

-- CreateIndex
CREATE INDEX "FinishedGoodsMovement_productionOrderId_occurredAt_idx" ON "FinishedGoodsMovement"("productionOrderId", "occurredAt");

-- CreateIndex
CREATE INDEX "FinishedGoodsMovement_finishedProductId_warehouseId_idx" ON "FinishedGoodsMovement"("finishedProductId", "warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "FinishedProduct_companyId_sku_key" ON "FinishedProduct"("companyId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "ProductLine_companyId_slug_key" ON "ProductLine"("companyId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProductLine_companyId_code_key" ON "ProductLine"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Product_productLineId_slug_key" ON "Product"("productLineId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_active_idx" ON "ProductVariant"("productId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_netWeightGrams_key" ON "ProductVariant"("productId", "netWeightGrams");

-- CreateIndex
CREATE INDEX "SalesOrder_customerId_status_idx" ON "SalesOrder"("customerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_companyId_code_key" ON "SalesOrder"("companyId", "code");

-- CreateIndex
CREATE INDEX "IndustrialEvent_companyId_occurredAt_idx" ON "IndustrialEvent"("companyId", "occurredAt");

-- CreateIndex
CREATE INDEX "IndustrialEvent_productionOrderId_idx" ON "IndustrialEvent"("productionOrderId");

-- CreateIndex
CREATE INDEX "CostEvent_companyId_occurredAt_idx" ON "CostEvent"("companyId", "occurredAt");

-- CreateIndex
CREATE INDEX "CostEvent_productVariantId_occurredAt_idx" ON "CostEvent"("productVariantId", "occurredAt");

-- CreateIndex
CREATE INDEX "CostEvent_coffeeLotId_blendId_productionOrderId_finishedPro_idx" ON "CostEvent"("coffeeLotId", "blendId", "productionOrderId", "finishedProductId", "salesOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_revokedAt_idx" ON "AuthSession"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoffeeLot" ADD CONSTRAINT "CoffeeLot_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoffeeLot" ADD CONSTRAINT "CoffeeLot_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoffeeLot" ADD CONSTRAINT "CoffeeLot_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blend" ADD CONSTRAINT "Blend_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlendComponent" ADD CONSTRAINT "BlendComponent_blendId_fkey" FOREIGN KEY ("blendId") REFERENCES "Blend"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlendComponent" ADD CONSTRAINT "BlendComponent_coffeeLotId_fkey" FOREIGN KEY ("coffeeLotId") REFERENCES "CoffeeLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_blendId_fkey" FOREIGN KEY ("blendId") REFERENCES "Blend"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBatch" ADD CONSTRAINT "ProductionBatch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBatch" ADD CONSTRAINT "ProductionBatch_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionConsumption" ADD CONSTRAINT "ProductionConsumption_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionConsumption" ADD CONSTRAINT "ProductionConsumption_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionConsumption" ADD CONSTRAINT "ProductionConsumption_productionBatchId_fkey" FOREIGN KEY ("productionBatchId") REFERENCES "ProductionBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionConsumption" ADD CONSTRAINT "ProductionConsumption_coffeeLotId_fkey" FOREIGN KEY ("coffeeLotId") REFERENCES "CoffeeLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackagingConsumption" ADD CONSTRAINT "PackagingConsumption_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackagingConsumption" ADD CONSTRAINT "PackagingConsumption_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinishedGoodsMovement" ADD CONSTRAINT "FinishedGoodsMovement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinishedGoodsMovement" ADD CONSTRAINT "FinishedGoodsMovement_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinishedGoodsMovement" ADD CONSTRAINT "FinishedGoodsMovement_finishedProductId_fkey" FOREIGN KEY ("finishedProductId") REFERENCES "FinishedProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinishedGoodsMovement" ADD CONSTRAINT "FinishedGoodsMovement_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinishedProduct" ADD CONSTRAINT "FinishedProduct_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinishedProduct" ADD CONSTRAINT "FinishedProduct_blendId_fkey" FOREIGN KEY ("blendId") REFERENCES "Blend"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinishedProduct" ADD CONSTRAINT "FinishedProduct_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinishedProduct" ADD CONSTRAINT "FinishedProduct_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductLine" ADD CONSTRAINT "ProductLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_productLineId_fkey" FOREIGN KEY ("productLineId") REFERENCES "ProductLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_finishedProductId_fkey" FOREIGN KEY ("finishedProductId") REFERENCES "FinishedProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndustrialEvent" ADD CONSTRAINT "IndustrialEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndustrialEvent" ADD CONSTRAINT "IndustrialEvent_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndustrialEvent" ADD CONSTRAINT "IndustrialEvent_coffeeLotId_fkey" FOREIGN KEY ("coffeeLotId") REFERENCES "CoffeeLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndustrialEvent" ADD CONSTRAINT "IndustrialEvent_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostEvent" ADD CONSTRAINT "CostEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostEvent" ADD CONSTRAINT "CostEvent_coffeeLotId_fkey" FOREIGN KEY ("coffeeLotId") REFERENCES "CoffeeLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostEvent" ADD CONSTRAINT "CostEvent_blendId_fkey" FOREIGN KEY ("blendId") REFERENCES "Blend"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostEvent" ADD CONSTRAINT "CostEvent_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostEvent" ADD CONSTRAINT "CostEvent_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostEvent" ADD CONSTRAINT "CostEvent_finishedProductId_fkey" FOREIGN KEY ("finishedProductId") REFERENCES "FinishedProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostEvent" ADD CONSTRAINT "CostEvent_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

