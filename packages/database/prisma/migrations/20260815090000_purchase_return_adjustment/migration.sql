ALTER TABLE "GreenCoffeePurchase" ADD COLUMN "returnedByUserId" TEXT;
ALTER TABLE "GreenCoffeePurchase" ADD COLUMN "returnedAt" TIMESTAMP(3);
ALTER TABLE "GreenCoffeePurchase" ADD COLUMN "returnReason" TEXT;
ALTER TABLE "GreenCoffeePurchase" ADD COLUMN "correctionRequest" TEXT;
