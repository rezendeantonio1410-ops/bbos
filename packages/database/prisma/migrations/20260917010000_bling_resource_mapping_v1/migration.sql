-- Durable BBOS <-> Bling resource identifiers.
-- Keeps storefront orders independent from the commercial SalesOrder/PV sequence.

CREATE TABLE IF NOT EXISTS "IntegrationResourceMap" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  provider TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "internalKey" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  metadata JSONB,
  "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntegrationResourceMap_company_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE CASCADE,
  CONSTRAINT "IntegrationResourceMap_provider_check" CHECK (provider IN ('BLING')),
  CONSTRAINT "IntegrationResourceMap_company_provider_resource_internal_key" UNIQUE ("companyId",provider,"resourceType","internalKey")
);

CREATE INDEX IF NOT EXISTS "IntegrationResourceMap_external_idx"
  ON "IntegrationResourceMap"("companyId",provider,"resourceType","externalId");
