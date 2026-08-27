-- Preserve the protocol identity for historical and future evaluations.
ALTER TABLE "CuppingSession"
  ADD COLUMN "protocolVersion" TEXT NOT NULL DEFAULT 'v1';

CREATE TABLE "CuppingSessionSample" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL DEFAULT 'GREEN_COFFEE_LAB_SAMPLE',
  "sourceId" TEXT NOT NULL,
  "sampleId" TEXT,
  "professionalSampleId" TEXT,
  "position" INTEGER NOT NULL DEFAULT 1,
  "blindCode" TEXT,
  "coffeeLotId" TEXT,
  "greenCoffeeReceiptId" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CuppingSessionSample_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CuppingSessionSample_sessionId_sourceType_sourceId_key"
  ON "CuppingSessionSample"("sessionId", "sourceType", "sourceId");
CREATE INDEX "CuppingSessionSample_sampleId_idx"
  ON "CuppingSessionSample"("sampleId");
CREATE INDEX "CuppingSessionSample_professionalSampleId_idx" ON "CuppingSessionSample"("professionalSampleId");
CREATE INDEX "CuppingSessionSample_sessionId_position_idx" ON "CuppingSessionSample"("sessionId", "position");

ALTER TABLE "CuppingSessionSample"
  ADD CONSTRAINT "CuppingSessionSample_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "CuppingSession"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CuppingSessionSample"
  ADD CONSTRAINT "CuppingSessionSample_sampleId_fkey"
  FOREIGN KEY ("sampleId") REFERENCES "GreenCoffeeLabSample"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CuppingSessionSample" ADD CONSTRAINT "CuppingSessionSample_professionalSampleId_fkey" FOREIGN KEY ("professionalSampleId") REFERENCES "ProfessionalCoffeeSample"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keep the existing one-sample CuppingSession relation represented in the
-- association table without changing or dropping the legacy sampleId column.
INSERT INTO "CuppingSessionSample" ("id", "sessionId", "sourceType", "sourceId", "sampleId", "position")
SELECT 'legacy-' || "id", "id", 'GREEN_COFFEE_LAB_SAMPLE', "sampleId", "sampleId", 1
FROM "CuppingSession";
