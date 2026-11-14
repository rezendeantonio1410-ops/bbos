ALTER TYPE "CostType" ADD VALUE IF NOT EXISTS 'WATER';

ALTER TABLE "AccountsPayable"
  ADD COLUMN IF NOT EXISTS "competenceDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "documentType" TEXT,
  ADD COLUMN IF NOT EXISTS "documentNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "documentUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS "creationKey" TEXT,
  ADD COLUMN IF NOT EXISTS "recurrenceGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "recurrenceIndex" INTEGER,
  ADD COLUMN IF NOT EXISTS "recurrenceCount" INTEGER,
  ADD COLUMN IF NOT EXISTS "costEventId" TEXT,
  ADD COLUMN IF NOT EXISTS "createdById" TEXT,
  ADD COLUMN IF NOT EXISTS "createdByName" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "AccountsPayable_creationKey_key"
  ON "AccountsPayable"("creationKey");
CREATE UNIQUE INDEX IF NOT EXISTS "AccountsPayable_costEventId_key"
  ON "AccountsPayable"("costEventId");
CREATE INDEX IF NOT EXISTS "AccountsPayable_companyId_competenceDate_idx"
  ON "AccountsPayable"("companyId", "competenceDate");
CREATE INDEX IF NOT EXISTS "AccountsPayable_companyId_supplierId_documentNumber_idx"
  ON "AccountsPayable"("companyId", "supplierId", "documentNumber");
CREATE INDEX IF NOT EXISTS "AccountsPayable_recurrenceGroupId_recurrenceIndex_idx"
  ON "AccountsPayable"("recurrenceGroupId", "recurrenceIndex");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AccountsPayable_costEventId_fkey'
  ) THEN
    ALTER TABLE "AccountsPayable"
      ADD CONSTRAINT "AccountsPayable_costEventId_fkey"
      FOREIGN KEY ("costEventId") REFERENCES "CostEvent"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
