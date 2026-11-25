-- Export area: foreign buyers (kept apart from domestic customers), samples
-- sent abroad with a tracking timeline, and export contracts.
-- Additive only: four new tables. No existing row or table changes.

CREATE TABLE IF NOT EXISTS "ExportBuyer" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  city TEXT,
  "legalRepresentative" TEXT,
  "contactName" TEXT,
  email TEXT,
  phone TEXT,
  messenger TEXT,
  language TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  incoterm TEXT,
  "taxId" TEXT,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'PROSPECT',
  notes TEXT,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExportBuyer_company_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE CASCADE,
  CONSTRAINT "ExportBuyer_country_check" CHECK (country ~ '^[A-Z]{2}$'),
  CONSTRAINT "ExportBuyer_currency_check" CHECK (currency IN ('USD','EUR','GBP','JPY','BRL')),
  CONSTRAINT "ExportBuyer_status_check" CHECK (status IN ('PROSPECT','ACTIVE','INACTIVE'))
);
CREATE INDEX IF NOT EXISTS "ExportBuyer_company_idx" ON "ExportBuyer"("companyId", name);

CREATE TABLE IF NOT EXISTS "ExportContract" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "buyerId" TEXT NOT NULL,
  code TEXT NOT NULL,
  product TEXT NOT NULL,
  "quantityKg" DECIMAL(12,2) NOT NULL,
  "unitPrice" DECIMAL(12,4),
  "priceUnit" TEXT NOT NULL DEFAULT 'PER_LB',
  currency TEXT NOT NULL DEFAULT 'USD',
  incoterm TEXT,
  "shipmentFrom" DATE,
  "shipmentTo" DATE,
  status TEXT NOT NULL DEFAULT 'NEGOTIATING',
  notes TEXT,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExportContract_company_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE CASCADE,
  CONSTRAINT "ExportContract_buyer_fkey" FOREIGN KEY ("buyerId") REFERENCES "ExportBuyer"(id) ON DELETE RESTRICT,
  CONSTRAINT "ExportContract_code_unique" UNIQUE ("companyId", code),
  CONSTRAINT "ExportContract_quantity_check" CHECK ("quantityKg" > 0),
  CONSTRAINT "ExportContract_price_check" CHECK ("unitPrice" IS NULL OR "unitPrice" >= 0),
  CONSTRAINT "ExportContract_price_unit_check" CHECK ("priceUnit" IN ('PER_LB','PER_KG','PER_BAG_60KG','TOTAL')),
  CONSTRAINT "ExportContract_currency_check" CHECK (currency IN ('USD','EUR','GBP','JPY','BRL')),
  CONSTRAINT "ExportContract_status_check" CHECK (status IN ('NEGOTIATING','SIGNED','SHIPPED','COMPLETED','CANCELLED'))
);
CREATE INDEX IF NOT EXISTS "ExportContract_buyer_idx" ON "ExportContract"("buyerId");

CREATE TABLE IF NOT EXISTS "ExportSample" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "buyerId" TEXT NOT NULL,
  reference TEXT,
  "proformaNumber" TEXT,
  "coffeeType" TEXT NOT NULL DEFAULT 'GREEN',
  "lotReference" TEXT NOT NULL,
  "weightGrams" INTEGER NOT NULL,
  "scaScore" DECIMAL(5,2),
  carrier TEXT,
  "trackingCode" TEXT,
  "shippingCost" DECIMAL(12,2),
  "declaredValue" DECIMAL(12,2),
  "declaredCurrency" TEXT NOT NULL DEFAULT 'USD',
  "shippedByName" TEXT,
  status TEXT NOT NULL DEFAULT 'PREPARED',
  "sentAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "responseDueAt" TIMESTAMP(3),
  "responseDays" INTEGER NOT NULL DEFAULT 7,
  result TEXT,
  "buyerScore" DECIMAL(5,2),
  feedback TEXT,
  "contractId" TEXT,
  notes TEXT,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExportSample_company_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE CASCADE,
  CONSTRAINT "ExportSample_buyer_fkey" FOREIGN KEY ("buyerId") REFERENCES "ExportBuyer"(id) ON DELETE RESTRICT,
  CONSTRAINT "ExportSample_contract_fkey" FOREIGN KEY ("contractId") REFERENCES "ExportContract"(id) ON DELETE SET NULL,
  CONSTRAINT "ExportSample_type_check" CHECK ("coffeeType" IN ('GREEN','ROASTED')),
  CONSTRAINT "ExportSample_weight_check" CHECK ("weightGrams" BETWEEN 1 AND 100000),
  CONSTRAINT "ExportSample_sca_check" CHECK ("scaScore" IS NULL OR "scaScore" BETWEEN 0 AND 100),
  CONSTRAINT "ExportSample_buyer_score_check" CHECK ("buyerScore" IS NULL OR "buyerScore" BETWEEN 0 AND 100),
  CONSTRAINT "ExportSample_cost_check" CHECK ("shippingCost" IS NULL OR "shippingCost" >= 0),
  CONSTRAINT "ExportSample_declared_check" CHECK ("declaredValue" IS NULL OR "declaredValue" >= 0),
  CONSTRAINT "ExportSample_declared_currency_check" CHECK ("declaredCurrency" IN ('USD','EUR','GBP','JPY','BRL')),
  CONSTRAINT "ExportSample_days_check" CHECK ("responseDays" BETWEEN 1 AND 90),
  CONSTRAINT "ExportSample_carrier_check" CHECK (carrier IS NULL OR carrier IN ('DHL','FEDEX','UPS','CORREIOS','TNT','OTHER')),
  CONSTRAINT "ExportSample_status_check" CHECK (status IN ('PREPARED','SENT','IN_TRANSIT','CUSTOMS','DELIVERED','EVALUATED','LOST','RETURNED')),
  CONSTRAINT "ExportSample_result_check" CHECK (result IS NULL OR result IN ('APPROVED','REJECTED','NEEDS_ANOTHER'))
);
CREATE INDEX IF NOT EXISTS "ExportSample_company_status_idx" ON "ExportSample"("companyId", status);
CREATE INDEX IF NOT EXISTS "ExportSample_buyer_idx" ON "ExportSample"("buyerId");
CREATE UNIQUE INDEX IF NOT EXISTS "ExportSample_reference_unique" ON "ExportSample"("companyId", reference) WHERE reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS "ExportSampleEvent" (
  id TEXT PRIMARY KEY,
  "sampleId" TEXT NOT NULL,
  status TEXT NOT NULL,
  note TEXT,
  source TEXT NOT NULL DEFAULT 'MANUAL',
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recordedByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExportSampleEvent_sample_fkey" FOREIGN KEY ("sampleId") REFERENCES "ExportSample"(id) ON DELETE CASCADE,
  CONSTRAINT "ExportSampleEvent_source_check" CHECK (source IN ('MANUAL','TRACKING'))
);
CREATE INDEX IF NOT EXISTS "ExportSampleEvent_sample_idx" ON "ExportSampleEvent"("sampleId", "occurredAt");
