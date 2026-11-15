ALTER TABLE "Customer"
  ADD COLUMN IF NOT EXISTS "addressNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "addressComplement" TEXT,
  ADD COLUMN IF NOT EXISTS "stateRegistration" TEXT,
  ADD COLUMN IF NOT EXISTS "stateRegistrationType" TEXT NOT NULL DEFAULT 'NOT_DECLARED';

ALTER TABLE "Customer"
  DROP CONSTRAINT IF EXISTS "Customer_stateRegistrationType_check";

ALTER TABLE "Customer"
  ADD CONSTRAINT "Customer_stateRegistrationType_check"
  CHECK ("stateRegistrationType" IN ('NOT_DECLARED','NUMBER','EXEMPT','NON_TAXPAYER'));

CREATE INDEX IF NOT EXISTS "Customer_companyId_taxId_idx"
  ON "Customer"("companyId", "taxId");
