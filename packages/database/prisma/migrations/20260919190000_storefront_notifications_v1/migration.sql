CREATE TABLE IF NOT EXISTS "StorefrontNotification" (
  id TEXT PRIMARY KEY,
  "orderId" TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  recipient TEXT NOT NULL,
  "providerId" TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StorefrontNotification_order_fkey" FOREIGN KEY ("orderId") REFERENCES "StorefrontOrder"(id) ON DELETE CASCADE,
  CONSTRAINT "StorefrontNotification_status_check" CHECK (status IN ('PENDING','PROCESSING','SENT','FAILED')),
  CONSTRAINT "StorefrontNotification_order_type_key" UNIQUE ("orderId", type)
);

CREATE INDEX IF NOT EXISTS "StorefrontNotification_status_idx"
  ON "StorefrontNotification"(status, "updatedAt");
