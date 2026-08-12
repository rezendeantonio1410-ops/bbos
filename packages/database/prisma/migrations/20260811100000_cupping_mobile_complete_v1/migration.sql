-- Cupping Mobile V1 complete: secure invitations, staged sensory data and five-cup audit.
CREATE TYPE "CuppingParticipantStatus" AS ENUM ('INVITED', 'NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE "PreferredCuppingChannel" AS ENUM ('QR', 'EMAIL', 'SMS', 'WHATSAPP');
CREATE TYPE "CuppingDescriptorContext" AS ENUM ('AROMA', 'FLAVOR', 'AFTERTASTE', 'ACIDITY', 'BODY');
CREATE TYPE "CuppingCupAttribute" AS ENUM ('UNIFORMITY', 'SWEETNESS', 'CLEAN_CUP');

ALTER TABLE "User" ADD COLUMN "phoneE164" TEXT;
ALTER TABLE "User" ADD COLUMN "preferredCuppingChannel" "PreferredCuppingChannel" NOT NULL DEFAULT 'QR';
ALTER TABLE "CuppingParticipant" ADD COLUMN "status" "CuppingParticipantStatus" NOT NULL DEFAULT 'NOT_STARTED';
ALTER TABLE "CuppingParticipant" ADD COLUMN "startedAt" TIMESTAMP(3);
ALTER TABLE "CuppingParticipant" ADD COLUMN "completedAt" TIMESTAMP(3);
ALTER TABLE "CuppingEvaluation" ADD COLUMN "overall" DECIMAL(5,2);
ALTER TABLE "CuppingEvaluation" ADD COLUMN "totalScore" DECIMAL(5,2);
ALTER TABLE "CuppingEvaluation" ADD COLUMN "bodyType" TEXT;
ALTER TABLE "CuppingEvaluation" ADD COLUMN "aftertastePersistence" TEXT;
ALTER TABLE "CuppingEvaluation" ADD COLUMN "affectiveMemory" TEXT;
ALTER TABLE "CuppingEvaluation" ADD COLUMN "finalImpression" TEXT;
ALTER TABLE "CuppingEvaluation" ADD COLUMN "stageData" JSONB;
ALTER TABLE "CuppingEvaluation" ADD COLUMN "finalizedAt" TIMESTAMP(3);
ALTER TABLE "CuppingEvaluation" ADD COLUMN "reopenedAt" TIMESTAMP(3);
ALTER TABLE "CuppingEvaluation" ADD COLUMN "reopenedById" TEXT;

CREATE TABLE "CuppingDescriptorSelection" (
  "id" TEXT NOT NULL, "evaluationId" TEXT NOT NULL, "context" "CuppingDescriptorContext" NOT NULL,
  "family" TEXT NOT NULL, "subfamily" TEXT, "descriptor" TEXT, "level" INTEGER NOT NULL,
  "intensity" INTEGER NOT NULL, "imageKey" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CuppingDescriptorSelection_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CuppingDescriptorSelection_evaluationId_context_idx" ON "CuppingDescriptorSelection"("evaluationId", "context");

CREATE TABLE "CuppingCupEvaluation" (
  "id" TEXT NOT NULL, "evaluationId" TEXT NOT NULL, "attribute" "CuppingCupAttribute" NOT NULL,
  "cupNumber" INTEGER NOT NULL, "selected" BOOLEAN NOT NULL DEFAULT true, "notes" TEXT,
  CONSTRAINT "CuppingCupEvaluation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CuppingCupEvaluation_evaluationId_attribute_cupNumber_key" ON "CuppingCupEvaluation"("evaluationId", "attribute", "cupNumber");

CREATE TABLE "CuppingCupDefect" (
  "id" TEXT NOT NULL, "cupEvaluationId" TEXT NOT NULL, "defectType" TEXT NOT NULL,
  "defectDescription" TEXT, "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CuppingCupDefect_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CuppingCupDefect_cupEvaluationId_key" ON "CuppingCupDefect"("cupEvaluationId");

CREATE TABLE "CuppingInvitation" (
  "id" TEXT NOT NULL, "sessionId" TEXT NOT NULL, "participantId" TEXT NOT NULL, "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL, "usedAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "CuppingInvitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CuppingInvitation_tokenHash_key" ON "CuppingInvitation"("tokenHash");
CREATE INDEX "CuppingInvitation_sessionId_participantId_expiresAt_idx" ON "CuppingInvitation"("sessionId", "participantId", "expiresAt");

ALTER TABLE "CuppingDescriptorSelection" ADD CONSTRAINT "CuppingDescriptorSelection_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "CuppingEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CuppingCupEvaluation" ADD CONSTRAINT "CuppingCupEvaluation_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "CuppingEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CuppingCupDefect" ADD CONSTRAINT "CuppingCupDefect_cupEvaluationId_fkey" FOREIGN KEY ("cupEvaluationId") REFERENCES "CuppingCupEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CuppingInvitation" ADD CONSTRAINT "CuppingInvitation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CuppingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CuppingInvitation" ADD CONSTRAINT "CuppingInvitation_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "CuppingParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
