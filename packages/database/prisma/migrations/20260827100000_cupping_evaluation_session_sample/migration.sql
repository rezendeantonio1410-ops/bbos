ALTER TABLE "CuppingEvaluation" ADD COLUMN "sessionSampleId" TEXT;

ALTER TABLE "CuppingEvaluation"
  ADD CONSTRAINT "CuppingEvaluation_sessionSampleId_fkey"
  FOREIGN KEY ("sessionSampleId") REFERENCES "CuppingSessionSample"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "CuppingEvaluation_sessionId_evaluatorId_key";
CREATE UNIQUE INDEX "CuppingEvaluation_sessionId_sessionSampleId_evaluatorId_key"
  ON "CuppingEvaluation"("sessionId", "sessionSampleId", "evaluatorId");
