CREATE TYPE "CuppingSessionStatus" AS ENUM ('OPEN', 'AWAITING_CLOSURE', 'CLOSED', 'REASSESSMENT');
CREATE TYPE "CuppingDecision" AS ENUM ('APPROVED', 'REJECTED', 'REASSESSMENT');

CREATE TABLE "CuppingSession" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "sampleId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "sessionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "responsibleId" TEXT,
  "responsibleName" TEXT,
  "participantIds" JSONB,
  "protocol" TEXT NOT NULL DEFAULT 'SCA',
  "generalNotes" TEXT,
  "status" "CuppingSessionStatus" NOT NULL DEFAULT 'OPEN',
  "decision" "CuppingDecision",
  "decisionReason" TEXT,
  "decidedById" TEXT,
  "decidedByName" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CuppingSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CuppingEvaluation" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "evaluatorId" TEXT NOT NULL,
  "evaluatorName" TEXT NOT NULL,
  "attributes" JSONB NOT NULL,
  "defects" JSONB,
  "sensoryNotes" JSONB,
  "score" DECIMAL(5,2),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CuppingEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CuppingSession_companyId_code_key" ON "CuppingSession"("companyId", "code");
CREATE INDEX "CuppingSession_companyId_status_idx" ON "CuppingSession"("companyId", "status");
CREATE INDEX "CuppingSession_sampleId_idx" ON "CuppingSession"("sampleId");
CREATE UNIQUE INDEX "CuppingEvaluation_sessionId_evaluatorId_key" ON "CuppingEvaluation"("sessionId", "evaluatorId");
CREATE INDEX "CuppingEvaluation_evaluatorId_idx" ON "CuppingEvaluation"("evaluatorId");

ALTER TABLE "CuppingSession" ADD CONSTRAINT "CuppingSession_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CuppingSession" ADD CONSTRAINT "CuppingSession_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "GreenCoffeeLabSample"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CuppingEvaluation" ADD CONSTRAINT "CuppingEvaluation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CuppingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
