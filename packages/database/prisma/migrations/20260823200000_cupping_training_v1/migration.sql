CREATE TYPE "CuppingTrainingLevel" AS ENUM ('DISCOVERY', 'DEVELOPMENT', 'CALIBRATION');
CREATE TYPE "CuppingTrainingStatus" AS ENUM ('OPEN', 'COMPLETED');

CREATE TABLE "CuppingTrainingSession" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "level" "CuppingTrainingLevel" NOT NULL DEFAULT 'DISCOVERY',
  "lesson" TEXT,
  "sampleName" TEXT NOT NULL,
  "sampleContext" JSONB,
  "referenceProfile" JSONB,
  "status" "CuppingTrainingStatus" NOT NULL DEFAULT 'OPEN',
  "createdById" TEXT NOT NULL,
  "createdByName" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CuppingTrainingSession_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CuppingTrainingEvaluation" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "participantName" TEXT NOT NULL,
  "attributes" JSONB NOT NULL,
  "descriptors" JSONB,
  "sensoryMap" JSONB,
  "score" DECIMAL(5,2),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CuppingTrainingEvaluation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CuppingTrainingSession_companyId_code_key" ON "CuppingTrainingSession"("companyId", "code");
CREATE INDEX "CuppingTrainingSession_companyId_status_idx" ON "CuppingTrainingSession"("companyId", "status");
CREATE UNIQUE INDEX "CuppingTrainingEvaluation_sessionId_participantId_key" ON "CuppingTrainingEvaluation"("sessionId", "participantId");
CREATE INDEX "CuppingTrainingEvaluation_participantId_idx" ON "CuppingTrainingEvaluation"("participantId");
ALTER TABLE "CuppingTrainingSession" ADD CONSTRAINT "CuppingTrainingSession_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CuppingTrainingEvaluation" ADD CONSTRAINT "CuppingTrainingEvaluation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CuppingTrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
