CREATE TABLE "StorefrontCoupon" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "brokerId" TEXT NOT NULL REFERENCES "Broker"("id") ON DELETE RESTRICT,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "discountType" TEXT NOT NULL CHECK ("discountType" IN ('PERCENT','FIXED')),
  "discountValue" DECIMAL(14,2) NOT NULL CHECK ("discountValue" >= 0),
  "commissionType" TEXT NOT NULL CHECK ("commissionType" IN ('PERCENT','FIXED')),
  "commissionValue" DECIMAL(14,2) NOT NULL CHECK ("commissionValue" >= 0),
  "commissionBasis" TEXT NOT NULL DEFAULT 'NET_SUBTOTAL' CHECK ("commissionBasis" IN ('GROSS_SUBTOTAL','NET_SUBTOTAL')),
  "minimumSubtotalCents" INTEGER NOT NULL DEFAULT 0,
  "usageLimit" INTEGER,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "validFrom" TIMESTAMP(3),
  "validUntil" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StorefrontCoupon_companyId_code_key" UNIQUE ("companyId", "code")
);

CREATE TABLE "StorefrontCouponRedemption" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "couponId" TEXT NOT NULL REFERENCES "StorefrontCoupon"("id") ON DELETE RESTRICT,
  "storefrontOrderId" TEXT NOT NULL REFERENCES "StorefrontOrder"("id") ON DELETE RESTRICT,
  "brokerId" TEXT NOT NULL REFERENCES "Broker"("id") ON DELETE RESTRICT,
  "couponCode" TEXT NOT NULL,
  "grossSubtotalCents" INTEGER NOT NULL,
  "discountCents" INTEGER NOT NULL,
  "netSubtotalCents" INTEGER NOT NULL,
  "commissionCents" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RESERVED' CHECK ("status" IN ('RESERVED','PAYABLE','PAID','CANCELLED')),
  "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StorefrontCouponRedemption_storefrontOrderId_key" UNIQUE ("storefrontOrderId")
);

ALTER TABLE "StorefrontOrder"
  ADD COLUMN "couponId" TEXT REFERENCES "StorefrontCoupon"("id") ON DELETE SET NULL,
  ADD COLUMN "couponCode" TEXT,
  ADD COLUMN "discountCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "commissionCents" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "StorefrontCoupon_companyId_active_idx" ON "StorefrontCoupon"("companyId", "active");
CREATE INDEX "StorefrontCouponRedemption_brokerId_status_idx" ON "StorefrontCouponRedemption"("brokerId", "status");
CREATE INDEX "StorefrontCouponRedemption_companyId_createdAt_idx" ON "StorefrontCouponRedemption"("companyId", "createdAt");
