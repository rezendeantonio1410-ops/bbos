CREATE TYPE "CommercialNotificationType" AS ENUM ('PRICE_CHANGED', 'PROMOTION_STARTED', 'PROMOTION_ENDING', 'PRODUCT_AVAILABLE', 'PRODUCT_UNAVAILABLE', 'ORDER_STATUS_CHANGED', 'COMMISSION_RELEASED', 'TARGET_ALERT', 'CUSTOMER_REACTIVATION');

CREATE TABLE "CommercialNotification" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "CommercialNotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3),
  "acknowledgedAt" TIMESTAMP(3),
  CONSTRAINT "CommercialNotification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommercialNotification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CommercialNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "CommercialNotification_userId_readAt_createdAt_idx" ON "CommercialNotification"("userId", "readAt", "createdAt");
CREATE INDEX "CommercialNotification_companyId_type_createdAt_idx" ON "CommercialNotification"("companyId", "type", "createdAt");
