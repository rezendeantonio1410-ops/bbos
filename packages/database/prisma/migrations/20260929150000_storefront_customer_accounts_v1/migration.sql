-- Storefront customer accounts v1
-- Passwordless identity for the public store. It is deliberately isolated
-- from BBOS users and administrative sessions.

CREATE TABLE IF NOT EXISTS "StorefrontCustomerAccount" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  "taxId" TEXT,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  "sensoryProfile" JSONB,
  "marketingConsent" BOOLEAN NOT NULL DEFAULT FALSE,
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StorefrontCustomerAccount_company_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE CASCADE,
  CONSTRAINT "StorefrontCustomerAccount_company_email_key" UNIQUE ("companyId", email)
);

CREATE INDEX IF NOT EXISTS "StorefrontCustomerAccount_email_idx"
  ON "StorefrontCustomerAccount"(email);

CREATE TABLE IF NOT EXISTS "StorefrontCustomerAccessCode" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  email TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StorefrontCustomerAccessCode_company_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "StorefrontCustomerAccessCode_email_created_idx"
  ON "StorefrontCustomerAccessCode"("companyId", email, "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "StorefrontCustomerAccessCode_expiry_idx"
  ON "StorefrontCustomerAccessCode"("expiresAt") WHERE "consumedAt" IS NULL;

CREATE TABLE IF NOT EXISTS "StorefrontCustomerSession" (
  id TEXT PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StorefrontCustomerSession_account_fkey"
    FOREIGN KEY ("accountId") REFERENCES "StorefrontCustomerAccount"(id) ON DELETE CASCADE,
  CONSTRAINT "StorefrontCustomerSession_token_key" UNIQUE ("tokenHash")
);

CREATE INDEX IF NOT EXISTS "StorefrontCustomerSession_account_idx"
  ON "StorefrontCustomerSession"("accountId", "expiresAt");

CREATE TABLE IF NOT EXISTS "StorefrontCustomerAddress" (
  id TEXT PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT 'Principal',
  "recipientName" TEXT NOT NULL,
  phone TEXT,
  "postalCode" TEXT NOT NULL,
  street TEXT NOT NULL,
  number TEXT NOT NULL,
  complement TEXT,
  district TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StorefrontCustomerAddress_account_fkey"
    FOREIGN KEY ("accountId") REFERENCES "StorefrontCustomerAccount"(id) ON DELETE CASCADE,
  CONSTRAINT "StorefrontCustomerAddress_state_check" CHECK (state ~ '^[A-Z]{2}$')
);

CREATE INDEX IF NOT EXISTS "StorefrontCustomerAddress_account_idx"
  ON "StorefrontCustomerAddress"("accountId", "isDefault" DESC, "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "StorefrontCustomerAddress_one_default_idx"
  ON "StorefrontCustomerAddress"("accountId") WHERE "isDefault"=TRUE;

ALTER TABLE "StorefrontOrder"
  ADD COLUMN IF NOT EXISTS "customerAccountId" TEXT;

DO $$ BEGIN
  ALTER TABLE "StorefrontOrder"
    ADD CONSTRAINT "StorefrontOrder_customer_account_fkey"
    FOREIGN KEY ("customerAccountId") REFERENCES "StorefrontCustomerAccount"(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "StorefrontOrder_customer_account_created_idx"
  ON "StorefrontOrder"("customerAccountId", "createdAt" DESC)
  WHERE "customerAccountId" IS NOT NULL;
