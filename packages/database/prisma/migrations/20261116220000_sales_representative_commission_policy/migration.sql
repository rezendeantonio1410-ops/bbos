ALTER TABLE "StorefrontPartner"
  ADD COLUMN "salesCommissionMode" VARCHAR(20),
  ADD COLUMN "salesCommissionPercent" DECIMAL(7,4),
  ADD COLUMN "salesCommissionPerPackage" DECIMAL(14,2);

ALTER TABLE "StorefrontPartner"
  ADD CONSTRAINT "StorefrontPartner_salesCommissionMode_check"
  CHECK (
    "salesCommissionMode" IS NULL
    OR "salesCommissionMode" IN ('PERCENTAGE', 'PER_PACKAGE')
  );

ALTER TABLE "StorefrontPartner"
  ADD CONSTRAINT "StorefrontPartner_salesCommissionPercent_check"
  CHECK (
    "salesCommissionPercent" IS NULL
    OR ("salesCommissionPercent" >= 0 AND "salesCommissionPercent" <= 100)
  );

ALTER TABLE "StorefrontPartner"
  ADD CONSTRAINT "StorefrontPartner_salesCommissionPerPackage_check"
  CHECK (
    "salesCommissionPerPackage" IS NULL
    OR "salesCommissionPerPackage" >= 0
  );
