ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'PARTNER';

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "storefrontPartnerId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'User_storefrontPartnerId_fkey'
  ) THEN
    ALTER TABLE "User"
      ADD CONSTRAINT "User_storefrontPartnerId_fkey"
      FOREIGN KEY ("storefrontPartnerId")
      REFERENCES "StorefrontPartner"(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "User_storefrontPartnerId_key"
  ON "User"("storefrontPartnerId")
  WHERE "storefrontPartnerId" IS NOT NULL;
