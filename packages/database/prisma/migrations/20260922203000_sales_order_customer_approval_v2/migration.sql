ALTER TABLE "SalesOrderCustomerApproval"
  ADD COLUMN IF NOT EXISTS "destinationMasked" TEXT,
  ADD COLUMN IF NOT EXISTS "customerPhoneSnapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "viewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "verificationRequired" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "verificationCodeHash" TEXT,
  ADD COLUMN IF NOT EXISTS "verificationCodeExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "verificationCodeVerifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "acceptedIpHash" TEXT,
  ADD COLUMN IF NOT EXISTS "acceptedUserAgent" TEXT,
  ADD COLUMN IF NOT EXISTS "termsVersion" TEXT NOT NULL DEFAULT 'sales-order-acceptance-v1',
  ADD COLUMN IF NOT EXISTS "termsText" TEXT NOT NULL DEFAULT 'Confirmo que revisei os produtos, quantidades, valores, frete, prazo e condições comerciais desta proposta e autorizo a Bispo Coffees a confirmar o pedido.',
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "SalesOrderCustomerApproval_companyId_createdAt_idx"
  ON "SalesOrderCustomerApproval" ("companyId", "createdAt" DESC);
