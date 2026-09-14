-- Storefront checkout core v1
-- Persists a public order before payment and queues Bling only after approval.

CREATE TABLE IF NOT EXISTS "StorefrontOrder" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'AWAITING_PAYMENT',
  "idempotencyKey" TEXT NOT NULL,
  "confirmationTokenHash" TEXT NOT NULL,
  customer JSONB NOT NULL,
  delivery JSONB NOT NULL,
  items JSONB NOT NULL,
  recurrence JSONB,
  "subtotalCents" INTEGER NOT NULL,
  "shippingCents" INTEGER NOT NULL,
  "totalCents" INTEGER NOT NULL,
  "requestedPaymentMethod" TEXT NOT NULL DEFAULT 'PIX',
  "paymentProvider" TEXT,
  "paymentExternalId" TEXT,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StorefrontOrder_company_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE CASCADE,
  CONSTRAINT "StorefrontOrder_status_check" CHECK (status IN ('AWAITING_PAYMENT','PAID','PAYMENT_FAILED','CANCELLED')),
  CONSTRAINT "StorefrontOrder_payment_method_check" CHECK ("requestedPaymentMethod" IN ('PIX','CARD')),
  CONSTRAINT "StorefrontOrder_idempotency_key" UNIQUE ("idempotencyKey"),
  CONSTRAINT "StorefrontOrder_company_code_key" UNIQUE ("companyId", code)
);

CREATE INDEX IF NOT EXISTS "StorefrontOrder_company_status_idx"
  ON "StorefrontOrder"("companyId", status, "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "StorefrontOrder_payment_external_key"
  ON "StorefrontOrder"("paymentProvider", "paymentExternalId")
  WHERE "paymentExternalId" IS NOT NULL;
