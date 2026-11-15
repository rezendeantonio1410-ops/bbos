CREATE TABLE "StorefrontPartner" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "taxId" TEXT,
  "contactName" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "pixKey" TEXT,
  "bankDetails" JSONB,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StorefrontPartner_companyId_taxId_key" UNIQUE ("companyId", "taxId")
);

CREATE INDEX "StorefrontPartner_companyId_active_idx" ON "StorefrontPartner"("companyId", "active");

INSERT INTO "StorefrontPartner" (id,"companyId",name,"taxId","contactName",phone,email,"bankDetails",active,"createdAt","updatedAt")
SELECT DISTINCT b.id,b."companyId",b.name,b."taxId",b."contactName",b.phone,b.email,b."bankDetails",b.active,NOW(),NOW()
  FROM "Broker" b
  JOIN "StorefrontCoupon" c ON c."brokerId"=b.id
ON CONFLICT (id) DO NOTHING;

ALTER TABLE "StorefrontCoupon" ADD COLUMN "partnerId" TEXT;
UPDATE "StorefrontCoupon" SET "partnerId"="brokerId";
ALTER TABLE "StorefrontCoupon" ALTER COLUMN "partnerId" SET NOT NULL;
ALTER TABLE "StorefrontCoupon" ADD CONSTRAINT "StorefrontCoupon_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "StorefrontPartner"("id") ON DELETE RESTRICT;
ALTER TABLE "StorefrontCoupon" DROP CONSTRAINT "StorefrontCoupon_brokerId_fkey";
ALTER TABLE "StorefrontCoupon" DROP COLUMN "brokerId";

ALTER TABLE "StorefrontCouponRedemption" ADD COLUMN "partnerId" TEXT;
UPDATE "StorefrontCouponRedemption" SET "partnerId"="brokerId";
ALTER TABLE "StorefrontCouponRedemption" ALTER COLUMN "partnerId" SET NOT NULL;
ALTER TABLE "StorefrontCouponRedemption" ADD CONSTRAINT "StorefrontCouponRedemption_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "StorefrontPartner"("id") ON DELETE RESTRICT;
DROP INDEX "StorefrontCouponRedemption_brokerId_status_idx";
ALTER TABLE "StorefrontCouponRedemption" DROP CONSTRAINT "StorefrontCouponRedemption_brokerId_fkey";
ALTER TABLE "StorefrontCouponRedemption" DROP COLUMN "brokerId";
CREATE INDEX "StorefrontCouponRedemption_partnerId_status_idx" ON "StorefrontCouponRedemption"("partnerId", status);

ALTER TABLE "AccountsPayable" ADD COLUMN "storefrontPartnerId" TEXT REFERENCES "StorefrontPartner"("id") ON DELETE SET NULL;
UPDATE "AccountsPayable" ap
   SET "storefrontPartnerId"=ap."brokerId", "brokerId"=NULL
 WHERE ap.category='COMISSAO_CUPOM'
   AND EXISTS (SELECT 1 FROM "StorefrontPartner" p WHERE p.id=ap."brokerId");
CREATE INDEX "AccountsPayable_storefrontPartnerId_dueDate_idx" ON "AccountsPayable"("storefrontPartnerId", "dueDate");
