ALTER TABLE "StorefrontPartner"
  ADD COLUMN "legalName" TEXT,
  ADD COLUMN "tradeName" TEXT,
  ADD COLUMN "isSalesPartner" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "isSalesBroker" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "isGreenCoffeeBroker" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "Broker"
  ADD COLUMN "businessPartnerId" TEXT;

-- Partners originally copied from Broker kept the same identifier.
UPDATE "Broker" broker
   SET "businessPartnerId" = partner.id
  FROM "StorefrontPartner" partner
 WHERE broker."businessPartnerId" IS NULL
   AND partner.id = broker.id
   AND partner."companyId" = broker."companyId";

-- Reuse a manually created partner when its company and document match.
UPDATE "Broker" broker
   SET "businessPartnerId" = partner.id
  FROM "StorefrontPartner" partner
 WHERE broker."businessPartnerId" IS NULL
   AND broker."taxId" IS NOT NULL
   AND partner."taxId" = broker."taxId"
   AND partner."companyId" = broker."companyId";

-- Promote every remaining legacy broker to the shared business-partner registry.
INSERT INTO "StorefrontPartner" (
  id, "companyId", name, "legalName", "tradeName", "taxId", "contactName", phone, email, "bankDetails",
  active, "isSalesPartner", "isSalesBroker", "isGreenCoffeeBroker", "createdAt", "updatedAt"
)
SELECT
  broker.id, broker."companyId", broker.name, broker."legalName", broker."tradeName", broker."taxId", broker."contactName",
  broker.phone, broker.email, broker."bankDetails", broker.active, FALSE, TRUE, TRUE,
  broker."createdAt", broker."updatedAt"
FROM "Broker" broker
WHERE broker."businessPartnerId" IS NULL
ON CONFLICT (id) DO NOTHING;

UPDATE "Broker"
   SET "businessPartnerId" = id
 WHERE "businessPartnerId" IS NULL;

-- Legacy brokers were valid in both purchase and sales flows; retain that behavior.
UPDATE "StorefrontPartner" partner
   SET "isSalesBroker" = TRUE,
       "isGreenCoffeeBroker" = TRUE,
       "legalName" = COALESCE(partner."legalName", broker."legalName"),
       "tradeName" = COALESCE(partner."tradeName", broker."tradeName"),
       "updatedAt" = NOW()
  FROM "Broker" broker
 WHERE broker."businessPartnerId" = partner.id;

CREATE UNIQUE INDEX "Broker_businessPartnerId_key"
  ON "Broker"("businessPartnerId");

ALTER TABLE "Broker"
  ADD CONSTRAINT "Broker_businessPartnerId_fkey"
  FOREIGN KEY ("businessPartnerId") REFERENCES "StorefrontPartner"(id)
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "StorefrontPartner_companyId_roles_idx"
  ON "StorefrontPartner"("companyId", "isSalesPartner", "isSalesBroker", "isGreenCoffeeBroker", active);
