ALTER TABLE "AccountsPayable" ADD COLUMN "purchaseId" TEXT;
CREATE INDEX "AccountsPayable_purchaseId_dueDate_idx" ON "AccountsPayable"("purchaseId","dueDate");
ALTER TABLE "AccountsPayable" ADD CONSTRAINT "AccountsPayable_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "GreenCoffeePurchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
UPDATE "AccountsPayable" a
SET "purchaseId" = i."purchaseId"
FROM "GreenCoffeePurchaseInstallment" i
WHERE i."accountsPayableId" = a."id" AND a."purchaseId" IS NULL;
