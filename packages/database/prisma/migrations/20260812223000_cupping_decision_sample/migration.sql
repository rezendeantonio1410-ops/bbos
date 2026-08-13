ALTER TABLE "CuppingDecision" ADD COLUMN "sampleId" TEXT;

CREATE INDEX "CuppingDecision_sessionId_sampleId_idx"
ON "CuppingDecision"("sessionId", "sampleId");

ALTER TABLE "CuppingDecision"
ADD CONSTRAINT "CuppingDecision_sampleId_fkey"
FOREIGN KEY ("sampleId") REFERENCES "LabSample"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
