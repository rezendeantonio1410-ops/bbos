-- BBOS Marketplace Management v1
-- Direct marketplace integrations, restricted operators and idempotent ingestion.

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'MARKETPLACE_OPERATOR';

ALTER TABLE "ExternalIntegration" DROP CONSTRAINT IF EXISTS "ExternalIntegration_provider_check";
ALTER TABLE "ExternalIntegration"
  ADD CONSTRAINT "ExternalIntegration_provider_check"
  CHECK (provider IN ('BLING','MELHOR_ENVIO','MERCADO_LIVRE'));

ALTER TABLE "ExternalIntegration"
  ADD COLUMN IF NOT EXISTS "oauthCodeVerifierCiphertext" TEXT;

CREATE TABLE IF NOT EXISTS "MarketplaceOperatorAccess" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "salesChannelId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "operatorCompanyName" TEXT,
  permissions JSONB NOT NULL DEFAULT '{"view":true,"orders":true,"listings":false,"prices":false,"reconciliation":false}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceOperatorAccess_company_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE CASCADE,
  CONSTRAINT "MarketplaceOperatorAccess_channel_fkey" FOREIGN KEY ("salesChannelId") REFERENCES "SalesChannel"(id) ON DELETE CASCADE,
  CONSTRAINT "MarketplaceOperatorAccess_user_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE,
  CONSTRAINT "MarketplaceOperatorAccess_creator_fkey" FOREIGN KEY ("createdById") REFERENCES "User"(id) ON DELETE SET NULL,
  CONSTRAINT "MarketplaceOperatorAccess_user_channel_key" UNIQUE ("userId", "salesChannelId")
);

CREATE INDEX IF NOT EXISTS "MarketplaceOperatorAccess_company_active_idx"
  ON "MarketplaceOperatorAccess"("companyId", active);

CREATE TABLE IF NOT EXISTS "MarketplaceListing" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "salesChannelId" TEXT NOT NULL,
  "productVariantId" TEXT,
  "externalItemId" TEXT NOT NULL,
  "externalSku" TEXT,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'UNKNOWN',
  price DECIMAL(14,2),
  "availableQuantity" INTEGER,
  "soldQuantity" INTEGER,
  permalink TEXT,
  "syncStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "lastError" TEXT,
  metadata JSONB,
  "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceListing_company_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE CASCADE,
  CONSTRAINT "MarketplaceListing_channel_fkey" FOREIGN KEY ("salesChannelId") REFERENCES "SalesChannel"(id) ON DELETE CASCADE,
  CONSTRAINT "MarketplaceListing_variant_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"(id) ON DELETE SET NULL,
  CONSTRAINT "MarketplaceListing_external_key" UNIQUE ("salesChannelId", "externalItemId"),
  CONSTRAINT "MarketplaceListing_sync_check" CHECK ("syncStatus" IN ('PENDING','SYNCED','ATTENTION','ERROR'))
);

CREATE INDEX IF NOT EXISTS "MarketplaceListing_company_status_idx"
  ON "MarketplaceListing"("companyId", status, "syncStatus");

CREATE TABLE IF NOT EXISTS "MarketplaceOrderInbox" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "salesChannelId" TEXT NOT NULL,
  provider TEXT NOT NULL,
  "externalOrderId" TEXT NOT NULL,
  "externalStatus" TEXT,
  "orderedAt" TIMESTAMP(3),
  "grossAmount" DECIMAL(14,2),
  "feeAmount" DECIMAL(14,2),
  "freightAmount" DECIMAL(14,2),
  "importStatus" TEXT NOT NULL DEFAULT 'RECEIVED',
  "salesOrderId" TEXT,
  payload JSONB NOT NULL,
  "lastError" TEXT,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "MarketplaceOrderInbox_company_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE CASCADE,
  CONSTRAINT "MarketplaceOrderInbox_channel_fkey" FOREIGN KEY ("salesChannelId") REFERENCES "SalesChannel"(id) ON DELETE CASCADE,
  CONSTRAINT "MarketplaceOrderInbox_order_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"(id) ON DELETE SET NULL,
  CONSTRAINT "MarketplaceOrderInbox_provider_order_key" UNIQUE (provider, "externalOrderId"),
  CONSTRAINT "MarketplaceOrderInbox_status_check" CHECK ("importStatus" IN ('RECEIVED','READY','IMPORTED','ATTENTION','IGNORED','ERROR'))
);

CREATE INDEX IF NOT EXISTS "MarketplaceOrderInbox_company_status_idx"
  ON "MarketplaceOrderInbox"("companyId", "importStatus", "lastSeenAt" DESC);

CREATE TABLE IF NOT EXISTS "MarketplaceSyncRun" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "salesChannelId" TEXT,
  provider TEXT NOT NULL,
  scope TEXT NOT NULL,
  trigger TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'RUNNING',
  "recordsRead" INTEGER NOT NULL DEFAULT 0,
  "recordsCreated" INTEGER NOT NULL DEFAULT 0,
  "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
  "recordsFailed" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  metadata JSONB,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "MarketplaceSyncRun_company_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE CASCADE,
  CONSTRAINT "MarketplaceSyncRun_channel_fkey" FOREIGN KEY ("salesChannelId") REFERENCES "SalesChannel"(id) ON DELETE SET NULL,
  CONSTRAINT "MarketplaceSyncRun_status_check" CHECK (status IN ('RUNNING','SUCCEEDED','PARTIAL','FAILED'))
);

CREATE INDEX IF NOT EXISTS "MarketplaceSyncRun_company_started_idx"
  ON "MarketplaceSyncRun"("companyId", "startedAt" DESC);
