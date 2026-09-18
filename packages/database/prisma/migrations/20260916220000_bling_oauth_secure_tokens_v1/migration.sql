-- Bling OAuth secure token persistence for BBOS.
-- Tokens are encrypted by the API before being stored. Plaintext credentials never belong in this table.

ALTER TABLE "ExternalIntegration"
  ADD COLUMN IF NOT EXISTS "accessTokenCiphertext" TEXT,
  ADD COLUMN IF NOT EXISTS "refreshTokenCiphertext" TEXT,
  ADD COLUMN IF NOT EXISTS "tokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "oauthStateHash" TEXT,
  ADD COLUMN IF NOT EXISTS "oauthStateExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "ExternalIntegration_oauthStateHash_key"
  ON "ExternalIntegration"("oauthStateHash")
  WHERE "oauthStateHash" IS NOT NULL;
