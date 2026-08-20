CREATE TYPE "PurchaseExternalAcceptanceStatus" AS ENUM ('NOT_SENT', 'SENT', 'VIEWED', 'ACCEPTED', 'DECLINED', 'EXPIRED');

ALTER TABLE "Supplier" ADD COLUMN "contactRole" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "whatsapp" TEXT;

ALTER TABLE "GreenCoffeePurchase" ADD COLUMN "externalAcceptanceStatus" "PurchaseExternalAcceptanceStatus" NOT NULL DEFAULT 'NOT_SENT';
ALTER TABLE "GreenCoffeePurchase" ADD COLUMN "termsVersion" TEXT NOT NULL DEFAULT '2026.08';
ALTER TABLE "GreenCoffeePurchase" ADD COLUMN "termsDocumentUrl" TEXT;
ALTER TABLE "GreenCoffeePurchase" ADD COLUMN "acceptanceConditionText" TEXT;

CREATE TABLE "GreenCoffeePurchaseAcceptance" (
  "id" TEXT NOT NULL,
  "purchaseId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "status" "PurchaseExternalAcceptanceStatus" NOT NULL DEFAULT 'NOT_SENT',
  "channel" TEXT,
  "destinationMasked" TEXT,
  "contactName" TEXT,
  "contactRole" TEXT,
  "tokenHash" TEXT NOT NULL,
  "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
  "tokenRevokedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "viewedAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "declinedAt" TIMESTAMP(3),
  "termsVersion" TEXT NOT NULL,
  "termsDocumentUrl" TEXT,
  "documentHash" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "acceptedByName" TEXT,
  "acceptedByRole" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GreenCoffeePurchaseAcceptance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GreenCoffeePurchaseAcceptance_tokenHash_key" ON "GreenCoffeePurchaseAcceptance"("tokenHash");
CREATE INDEX "GreenCoffeePurchaseAcceptance_purchaseId_status_idx" ON "GreenCoffeePurchaseAcceptance"("purchaseId", "status");
CREATE INDEX "GreenCoffeePurchaseAcceptance_tokenExpiresAt_idx" ON "GreenCoffeePurchaseAcceptance"("tokenExpiresAt");
ALTER TABLE "GreenCoffeePurchaseAcceptance" ADD CONSTRAINT "GreenCoffeePurchaseAcceptance_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "GreenCoffeePurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GreenCoffeePurchaseAcceptance" ADD CONSTRAINT "GreenCoffeePurchaseAcceptance_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
