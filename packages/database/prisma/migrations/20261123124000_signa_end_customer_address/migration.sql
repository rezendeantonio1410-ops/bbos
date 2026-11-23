-- Additive, nullable commercial customer address fields. No fiscal Customer changes.
ALTER TABLE "PartnerEndCustomer"
  ADD COLUMN IF NOT EXISTS "postalCode" TEXT,
  ADD COLUMN IF NOT EXISTS "street" TEXT,
  ADD COLUMN IF NOT EXISTS "number" TEXT,
  ADD COLUMN IF NOT EXISTS "district" TEXT,
  ADD COLUMN IF NOT EXISTS "complement" TEXT;
