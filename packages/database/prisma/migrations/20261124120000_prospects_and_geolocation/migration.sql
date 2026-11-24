-- Prospecting (pré-cadastros), visits to prospects and address coordinates.
-- Additive only: two new tables and nullable columns. No existing row changes.

CREATE TABLE IF NOT EXISTS "Prospect" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  name TEXT NOT NULL,
  segment TEXT NOT NULL DEFAULT 'OUTRO',
  "taxId" TEXT,
  "legalName" TEXT,
  "tradeName" TEXT,
  "contactName" TEXT,
  phone TEXT,
  email TEXT,
  "postalCode" TEXT,
  address TEXT,
  "addressNumber" TEXT,
  district TEXT,
  city TEXT,
  state TEXT,
  profile TEXT,
  "openingHours" TEXT,
  potential TEXT NOT NULL DEFAULT 'A_VERIFICAR',
  "espressoMachine" TEXT NOT NULL DEFAULT 'NAO_VERIFICADO',
  "machineNotes" TEXT,
  "currentSupplier" TEXT,
  "monthlyVolumeKg" DECIMAL(10,2),
  stage TEXT NOT NULL DEFAULT 'NAO_CONTATADO',
  "lostReason" TEXT,
  notes TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  "geocodedAt" TIMESTAMP(3),
  "geocodeSource" TEXT,
  "geocodeAttemptedAt" TIMESTAMP(3),
  "suggestedTaxId" TEXT,
  "suggestedTaxIdConfidence" TEXT,
  "suggestedTaxIdReason" TEXT,
  "lastContactAt" TIMESTAMP(3),
  "nextAction" TEXT,
  "nextActionAt" TIMESTAMP(3),
  "customerId" TEXT,
  "convertedAt" TIMESTAMP(3),
  "importKey" TEXT,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Prospect_company_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE CASCADE,
  CONSTRAINT "Prospect_customer_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"(id) ON DELETE SET NULL,
  CONSTRAINT "Prospect_segment_check" CHECK (segment IN ('CAFETERIA','PADARIA_CONFEITARIA','POSTO_CONVENIENCIA','RESTAURANTE','HOTEL','EMPRESA','EMPORIO','OUTRO')),
  CONSTRAINT "Prospect_potential_check" CHECK (potential IN ('MUITO_ALTA','ALTA','MEDIA','BAIXA','A_VERIFICAR')),
  CONSTRAINT "Prospect_machine_check" CHECK ("espressoMachine" IN ('SIM','NAO','NAO_VERIFICADO')),
  CONSTRAINT "Prospect_stage_check" CHECK (stage IN ('NAO_CONTATADO','CONTATADO','VISITADO','DEGUSTACAO','PROPOSTA','CLIENTE','SEM_INTERESSE')),
  CONSTRAINT "Prospect_suggested_tax_id_check" CHECK ("suggestedTaxId" IS NULL OR "suggestedTaxId" ~ '^[0-9]{14}$'),
  CONSTRAINT "Prospect_suggested_confidence_check" CHECK ("suggestedTaxIdConfidence" IS NULL OR "suggestedTaxIdConfidence" IN ('ALTA','MEDIA','BAIXA')),
  CONSTRAINT "Prospect_volume_check" CHECK ("monthlyVolumeKg" IS NULL OR "monthlyVolumeKg" >= 0),
  CONSTRAINT "Prospect_coordinates_check" CHECK (
    (latitude IS NULL AND longitude IS NULL) OR
    (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180))
);

CREATE INDEX IF NOT EXISTS "Prospect_company_stage_idx" ON "Prospect"("companyId", stage);
CREATE INDEX IF NOT EXISTS "Prospect_company_city_idx" ON "Prospect"("companyId", city);
CREATE UNIQUE INDEX IF NOT EXISTS "Prospect_company_import_key" ON "Prospect"("companyId", "importKey") WHERE "importKey" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "ProspectVisit" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "prospectId" TEXT NOT NULL,
  "recordedByUserId" TEXT,
  "recordedByName" TEXT NOT NULL,
  "visitAt" TIMESTAMP(3) NOT NULL,
  "contactName" TEXT,
  purpose TEXT NOT NULL,
  outcome TEXT NOT NULL,
  facts TEXT NOT NULL,
  "factsTranscript" TEXT,
  "nextAction" TEXT,
  "nextActionAt" TIMESTAMP(3),
  "confirmedFields" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProspectVisit_company_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE CASCADE,
  CONSTRAINT "ProspectVisit_prospect_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"(id) ON DELETE CASCADE,
  CONSTRAINT "ProspectVisit_user_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "ProspectVisit_prospect_idx" ON "ProspectVisit"("prospectId", "visitAt");
CREATE INDEX IF NOT EXISTS "ProspectVisit_company_next_idx" ON "ProspectVisit"("companyId", "nextActionAt");

-- Coordinates and coffee consumption for existing customers (nullable).
ALTER TABLE "Customer"
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "geocodedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "geocodeSource" TEXT,
  ADD COLUMN IF NOT EXISTS "geocodeAttemptedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "monthlyVolumeKg" DECIMAL(10,2);

-- Original voice transcript kept next to the corrected visit report.
ALTER TABLE "CustomerVisit" ADD COLUMN IF NOT EXISTS "factsTranscript" TEXT;
