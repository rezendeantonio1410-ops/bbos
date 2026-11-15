-- Storefront payment resilience v1
-- One business order can have many provider payment attempts.
-- The latest provider id remains mirrored on StorefrontOrder for backwards compatibility.

CREATE TABLE IF NOT EXISTS "StorefrontPaymentAttempt" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "storefrontOrderId" TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'MERCADO_PAGO',
  method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'CREATING',
  "attemptNumber" INTEGER NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "externalId" TEXT,
  "checkoutUrl" TEXT,
  "providerStatus" TEXT,
  "providerStatusDetail" TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3),
  "lastError" TEXT,
  "processingStartedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  metadata JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StorefrontPaymentAttempt_company_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE CASCADE,
  CONSTRAINT "StorefrontPaymentAttempt_order_fkey"
    FOREIGN KEY ("storefrontOrderId") REFERENCES "StorefrontOrder"(id) ON DELETE CASCADE,
  CONSTRAINT "StorefrontPaymentAttempt_provider_check"
    CHECK (provider IN ('MERCADO_PAGO')),
  CONSTRAINT "StorefrontPaymentAttempt_method_check"
    CHECK (method IN ('PIX','CARD')),
  CONSTRAINT "StorefrontPaymentAttempt_status_check"
    CHECK (status IN (
      'CREATING','AWAITING_PAYMENT','PROCESSING','PAID','FAILED',
      'CANCELLED','EXPIRED','ERROR'
    )),
  CONSTRAINT "StorefrontPaymentAttempt_attempt_number_check"
    CHECK ("attemptNumber" > 0),
  CONSTRAINT "StorefrontPaymentAttempt_amount_check"
    CHECK ("amountCents" > 0),
  CONSTRAINT "StorefrontPaymentAttempt_idempotency_key"
    UNIQUE ("idempotencyKey"),
  CONSTRAINT "StorefrontPaymentAttempt_order_attempt_key"
    UNIQUE ("storefrontOrderId","attemptNumber")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StorefrontPaymentAttempt_external_key"
  ON "StorefrontPaymentAttempt"(provider,"externalId")
  WHERE "externalId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "StorefrontPaymentAttempt_order_status_idx"
  ON "StorefrontPaymentAttempt"("storefrontOrderId",status,"createdAt");

CREATE INDEX IF NOT EXISTS "StorefrontPaymentAttempt_worker_idx"
  ON "StorefrontPaymentAttempt"(status,"nextAttemptAt","updatedAt");

-- Backfill the current/latest provider attempt so existing orders remain fully auditable.
INSERT INTO "StorefrontPaymentAttempt" (
  id,"companyId","storefrontOrderId",provider,method,status,"attemptNumber",
  "amountCents","idempotencyKey","externalId","providerStatus","paidAt",metadata,
  "createdAt","updatedAt"
)
SELECT
  'pay-backfill-' || id,
  "companyId",
  id,
  COALESCE("paymentProvider",'MERCADO_PAGO'),
  "requestedPaymentMethod",
  CASE
    WHEN status='PAID' THEN 'PAID'
    WHEN status IN ('PAYMENT_FAILED','EXCEPTION') THEN 'FAILED'
    WHEN status='CANCELLED' THEN 'CANCELLED'
    ELSE 'AWAITING_PAYMENT'
  END,
  1,
  "totalCents",
  'payment-backfill:' || id,
  "paymentExternalId",
  status,
  "paidAt",
  jsonb_build_object('source','STORE_ORDER_BACKFILL'),
  "createdAt",
  "updatedAt"
FROM "StorefrontOrder"
WHERE "paymentExternalId" IS NOT NULL
ON CONFLICT DO NOTHING;
