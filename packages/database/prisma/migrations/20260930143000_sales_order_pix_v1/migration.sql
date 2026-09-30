-- Commercial order Pix v1
-- Keeps a B2B order in DRAFT until the provider confirms payment, preventing
-- reservation, invoicing and shipment before the funds are accredited.

CREATE TABLE IF NOT EXISTS "SalesOrderPaymentAttempt" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "salesOrderId" TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'MERCADO_PAGO',
  method TEXT NOT NULL DEFAULT 'PIX',
  status TEXT NOT NULL DEFAULT 'CREATING',
  "attemptNumber" INTEGER NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "externalId" TEXT,
  "ticketUrl" TEXT,
  "qrCode" TEXT,
  "qrCodeBase64" TEXT,
  "providerStatus" TEXT,
  "providerStatusDetail" TEXT,
  "paymentReason" TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3),
  "processingStartedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "expiresAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalesOrderPaymentAttempt_company_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE CASCADE,
  CONSTRAINT "SalesOrderPaymentAttempt_order_fkey"
    FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"(id) ON DELETE CASCADE,
  CONSTRAINT "SalesOrderPaymentAttempt_provider_check"
    CHECK (provider IN ('MERCADO_PAGO')),
  CONSTRAINT "SalesOrderPaymentAttempt_method_check"
    CHECK (method IN ('PIX')),
  CONSTRAINT "SalesOrderPaymentAttempt_status_check"
    CHECK (status IN ('CREATING','AWAITING_PAYMENT','PROCESSING','PAID','FAILED','CANCELLED','EXPIRED','ERROR')),
  CONSTRAINT "SalesOrderPaymentAttempt_attempt_number_check"
    CHECK ("attemptNumber" > 0),
  CONSTRAINT "SalesOrderPaymentAttempt_amount_check"
    CHECK ("amountCents" > 0),
  CONSTRAINT "SalesOrderPaymentAttempt_idempotency_key"
    UNIQUE ("idempotencyKey"),
  CONSTRAINT "SalesOrderPaymentAttempt_order_attempt_key"
    UNIQUE ("salesOrderId", "attemptNumber")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SalesOrderPaymentAttempt_external_key"
  ON "SalesOrderPaymentAttempt"(provider, "externalId")
  WHERE "externalId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "SalesOrderPaymentAttempt_one_active_per_order"
  ON "SalesOrderPaymentAttempt"("salesOrderId")
  WHERE status IN ('CREATING','AWAITING_PAYMENT','PROCESSING','ERROR');

CREATE INDEX IF NOT EXISTS "SalesOrderPaymentAttempt_order_status_idx"
  ON "SalesOrderPaymentAttempt"("salesOrderId", status, "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "SalesOrderPaymentAttempt_pending_idx"
  ON "SalesOrderPaymentAttempt"(status, "nextAttemptAt", "updatedAt")
  WHERE status IN ('CREATING','AWAITING_PAYMENT','PROCESSING','ERROR');
