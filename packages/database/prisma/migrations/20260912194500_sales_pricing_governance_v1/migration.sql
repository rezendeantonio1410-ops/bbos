ALTER TABLE "ProductPrice"
  ADD COLUMN IF NOT EXISTS "maxRequestDiscountPercent" DECIMAL(7,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "maxApprovalDiscountPercent" DECIMAL(7,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "minimumPrice" DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS "minimumMarginPercent" DECIMAL(7,3),
  ADD COLUMN IF NOT EXISTS "minimumRoiPercent" DECIMAL(7,3);

CREATE TABLE IF NOT EXISTS "SalesDiscountRequest" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "salesOrderId" TEXT NOT NULL,
  "salesOrderItemId" TEXT NOT NULL,
  "productPriceId" TEXT NOT NULL,
  "officialUnitPrice" DECIMAL(14,2) NOT NULL,
  "requestedUnitPrice" DECIMAL(14,2) NOT NULL,
  "discountPercent" DECIMAL(7,3) NOT NULL,
  "discountAmount" DECIMAL(14,2) NOT NULL,
  "rationale" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "requestedById" TEXT,
  "requestedByName" TEXT NOT NULL,
  "requestedByRole" TEXT,
  "decidedById" TEXT,
  "decidedByName" TEXT,
  "decidedByRole" TEXT,
  "decisionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  CONSTRAINT "SalesDiscountRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SalesDiscountRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SalesDiscountRequest_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SalesDiscountRequest_salesOrderItemId_fkey" FOREIGN KEY ("salesOrderItemId") REFERENCES "SalesOrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SalesDiscountRequest_productPriceId_fkey" FOREIGN KEY ("productPriceId") REFERENCES "ProductPrice"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "SalesDiscountRequest_order_status_idx" ON "SalesDiscountRequest"("salesOrderId", "status");
CREATE INDEX IF NOT EXISTS "SalesDiscountRequest_company_created_idx" ON "SalesDiscountRequest"("companyId", "createdAt");
