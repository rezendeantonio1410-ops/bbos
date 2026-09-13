-- BBOS Fiscal Integration Core v1
-- Provider-agnostic fiscal layer prepared for Bling API v3 / OAuth.

CREATE TABLE IF NOT EXISTS "ExternalIntegration" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DISCONNECTED',
  "providerAccountId" TEXT,
  scopes JSONB,
  "connectedAt" TIMESTAMP(3),
  "lastSyncAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExternalIntegration_company_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE CASCADE,
  CONSTRAINT "ExternalIntegration_provider_check" CHECK (provider IN ('BLING')),
  CONSTRAINT "ExternalIntegration_status_check" CHECK (status IN ('DISCONNECTED','CONNECTING','CONNECTED','ERROR')),
  CONSTRAINT "ExternalIntegration_company_provider_key" UNIQUE ("companyId", provider)
);

CREATE TABLE IF NOT EXISTS "FiscalDocument" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  direction TEXT NOT NULL,
  "documentType" TEXT NOT NULL DEFAULT 'NFE',
  status TEXT NOT NULL DEFAULT 'PENDING',
  number TEXT,
  series TEXT,
  "accessKey" TEXT,
  "issueDate" TIMESTAMP(3),
  "operationDate" TIMESTAMP(3),
  "supplierId" TEXT,
  "customerId" TEXT,
  "greenCoffeeReceiptId" TEXT,
  "salesOrderId" TEXT,
  "externalProvider" TEXT,
  "externalId" TEXT,
  "totalAmount" DECIMAL(14,2),
  "payloadSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FiscalDocument_company_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE CASCADE,
  CONSTRAINT "FiscalDocument_supplier_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"(id) ON DELETE SET NULL,
  CONSTRAINT "FiscalDocument_customer_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"(id) ON DELETE SET NULL,
  CONSTRAINT "FiscalDocument_receipt_fkey" FOREIGN KEY ("greenCoffeeReceiptId") REFERENCES "GreenCoffeeReceipt"(id) ON DELETE SET NULL,
  CONSTRAINT "FiscalDocument_sales_order_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"(id) ON DELETE SET NULL,
  CONSTRAINT "FiscalDocument_direction_check" CHECK (direction IN ('INBOUND','OUTBOUND')),
  CONSTRAINT "FiscalDocument_type_check" CHECK ("documentType" IN ('NFE','NFCE','NFSE','OTHER')),
  CONSTRAINT "FiscalDocument_status_check" CHECK (status IN ('PENDING','IMPORTED','READY','SENT','AUTHORIZED','REJECTED','CANCELLED','ERROR'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "FiscalDocument_accessKey_key" ON "FiscalDocument"("accessKey") WHERE "accessKey" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "FiscalDocument_company_direction_status_idx" ON "FiscalDocument"("companyId", direction, status);
CREATE INDEX IF NOT EXISTS "FiscalDocument_receipt_idx" ON "FiscalDocument"("greenCoffeeReceiptId");
CREATE INDEX IF NOT EXISTS "FiscalDocument_sales_order_idx" ON "FiscalDocument"("salesOrderId");
CREATE UNIQUE INDEX IF NOT EXISTS "FiscalDocument_external_provider_id_key" ON "FiscalDocument"("externalProvider", "externalId") WHERE "externalId" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "IntegrationOutbox" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  provider TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "aggregateType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempts INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3),
  "lastError" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntegrationOutbox_company_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE CASCADE,
  CONSTRAINT "IntegrationOutbox_status_check" CHECK (status IN ('PENDING','PROCESSING','SENT','FAILED','CANCELLED')),
  CONSTRAINT "IntegrationOutbox_idempotency_key" UNIQUE ("idempotencyKey")
);

CREATE INDEX IF NOT EXISTS "IntegrationOutbox_provider_status_idx" ON "IntegrationOutbox"(provider, status, "nextAttemptAt");
CREATE INDEX IF NOT EXISTS "IntegrationOutbox_aggregate_idx" ON "IntegrationOutbox"("aggregateType", "aggregateId");

CREATE TABLE IF NOT EXISTS "IntegrationWebhookEvent" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT,
  provider TEXT NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "eventName" TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'RECEIVED',
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "lastError" TEXT,
  CONSTRAINT "IntegrationWebhookEvent_company_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE SET NULL,
  CONSTRAINT "IntegrationWebhookEvent_provider_event_key" UNIQUE (provider, "providerEventId"),
  CONSTRAINT "IntegrationWebhookEvent_status_check" CHECK (status IN ('RECEIVED','PROCESSED','IGNORED','ERROR'))
);

CREATE INDEX IF NOT EXISTS "IntegrationWebhookEvent_status_idx" ON "IntegrationWebhookEvent"(provider, status, "receivedAt");
