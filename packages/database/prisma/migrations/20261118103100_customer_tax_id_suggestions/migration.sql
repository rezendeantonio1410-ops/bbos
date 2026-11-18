BEGIN;

-- Fail before changing the schema when legacy registrations would collide
-- after punctuation is removed. The data must be reviewed explicitly rather
-- than silently choosing one customer as the owner of a fiscal identifier.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM "Customer"
     WHERE "taxId" IS NOT NULL
       AND length(regexp_replace("taxId", '[^0-9]', '', 'g')) = 14
     GROUP BY "companyId", regexp_replace("taxId", '[^0-9]', '', 'g')
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Há CNPJs normalizados duplicados na tabela Customer.'
      USING HINT = 'Revise os clientes duplicados por empresa antes de aplicar esta migração.';
  END IF;
END $$;

ALTER TABLE "Customer"
  ADD COLUMN "taxIdVerificationStatus" "TaxVerificationStatus" NOT NULL DEFAULT 'NOT_VERIFIED',
  ADD COLUMN "taxIdVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "taxIdVerificationSource" TEXT;

-- Registrations that predate this workflow must be reviewed. Having fourteen
-- digits alone is not proof that the checksum or ownership is valid.
UPDATE "Customer"
   SET "taxIdVerificationSource" = 'LEGACY_REGISTRATION_PENDING_REVIEW'
 WHERE "taxId" IS NOT NULL
   AND length(regexp_replace("taxId", '[^0-9]', '', 'g')) = 14;

ALTER TABLE "Customer"
  ADD CONSTRAINT "Customer_id_companyId_key" UNIQUE ("id", "companyId");

-- The normalized CNPJ must identify at most one customer inside a company.
-- Formatting differences such as punctuation therefore cannot create a
-- duplicate canonical registration.
CREATE UNIQUE INDEX "Customer_companyId_normalizedCnpj_key"
  ON "Customer"(
    "companyId",
    (regexp_replace("taxId", '[^0-9]', '', 'g'))
  )
  WHERE "taxId" IS NOT NULL
    AND length(regexp_replace("taxId", '[^0-9]', '', 'g')) = 14;

CREATE TABLE "CustomerTaxIdSuggestion" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "taxId" TEXT NOT NULL,
  "legalName" TEXT,
  "tradeName" TEXT,
  "postalCode" TEXT,
  "address" TEXT,
  "addressNumber" TEXT,
  "district" TEXT,
  "city" TEXT,
  "state" TEXT,
  "source" TEXT NOT NULL,
  "confidence" DECIMAL(5,4) NOT NULL,
  "scoreReasons" JSONB,
  "searchCriteria" JSONB,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "searchedByUserId" TEXT,
  "searchedByName" TEXT,
  "selectedAt" TIMESTAMP(3),
  "selectedByUserId" TEXT,
  "selectedByName" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "confirmedByUserId" TEXT,
  "confirmedByName" TEXT,
  "rejectedAt" TIMESTAMP(3),
  "rejectedByUserId" TEXT,
  "rejectedByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CustomerTaxIdSuggestion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerTaxIdSuggestion_taxId_format_check"
    CHECK ("taxId" ~ '^[0-9]{14}$'),
  CONSTRAINT "CustomerTaxIdSuggestion_confidence_check"
    CHECK ("confidence" >= 0 AND "confidence" <= 1),
  CONSTRAINT "CustomerTaxIdSuggestion_status_check"
    CHECK ("status" IN ('DRAFT', 'SELECTED', 'CONFIRMED', 'REJECTED')),
  CONSTRAINT "CustomerTaxIdSuggestion_audit_state_check"
    CHECK (
      "status" = 'DRAFT'
      OR ("status" = 'SELECTED' AND "selectedAt" IS NOT NULL)
      OR (
        "status" = 'CONFIRMED'
        AND "selectedAt" IS NOT NULL
        AND "confirmedAt" IS NOT NULL
      )
      OR ("status" = 'REJECTED' AND "rejectedAt" IS NOT NULL)
    )
);

CREATE INDEX "CustomerTaxIdSuggestion_companyId_customerId_status_createdAt_idx"
  ON "CustomerTaxIdSuggestion"("companyId", "customerId", "status", "createdAt");

CREATE INDEX "CustomerTaxIdSuggestion_companyId_taxId_idx"
  ON "CustomerTaxIdSuggestion"("companyId", "taxId");

ALTER TABLE "CustomerTaxIdSuggestion"
  ADD CONSTRAINT "CustomerTaxIdSuggestion_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- The composite relationship prevents a suggestion from ever pointing to a
-- customer in another company, even if a future write bypasses the API.
ALTER TABLE "CustomerTaxIdSuggestion"
  ADD CONSTRAINT "CustomerTaxIdSuggestion_customerId_companyId_fkey"
  FOREIGN KEY ("customerId", "companyId")
  REFERENCES "Customer"("id", "companyId")
  ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
