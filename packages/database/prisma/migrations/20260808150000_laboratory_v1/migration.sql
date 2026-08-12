-- Laboratory V1: samples, cupping sessions, evaluations and decisions
CREATE TYPE "LabSampleType" AS ENUM ('ENTRY', 'CONTROL', 'RETEST', 'PRE_PRODUCTION', 'OTHER');
CREATE TYPE "LabSampleStatus" AS ENUM ('PENDING', 'ASSIGNED', 'EVALUATED', 'CONSOLIDATED', 'APPROVED', 'BLOCKED');
CREATE TYPE "CuppingSessionStatus" AS ENUM ('DRAFT', 'OPEN', 'IN_PROGRESS', 'PAUSED', 'CONSOLIDATING', 'CLOSED', 'CANCELLED');
CREATE TYPE "CuppingParticipantRole" AS ENUM ('COORDINATOR', 'CUPPER', 'OBSERVER');
CREATE TYPE "CuppingDecisionType" AS ENUM ('APPROVED', 'APPROVED_WITH_OBSERVATION', 'RETEST_REQUIRED', 'REJECTED');

CREATE TABLE "LabSample" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "lotId" TEXT NOT NULL,
  "sampleCode" TEXT NOT NULL,
  "sampleType" "LabSampleType" NOT NULL DEFAULT 'ENTRY',
  "status" "LabSampleStatus" NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LabSample_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CuppingSession" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "status" "CuppingSessionStatus" NOT NULL DEFAULT 'DRAFT',
  "startedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "coordinatorId" TEXT NOT NULL,
  "protocol" TEXT NOT NULL DEFAULT 'SCA',
  "accessToken" TEXT,
  "accessExpiresAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CuppingSession_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CuppingSessionSample" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "sampleId" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CuppingSessionSample_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CuppingParticipant" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "CuppingParticipantRole" NOT NULL DEFAULT 'CUPPER',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CuppingParticipant_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CuppingEvaluation" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "sampleId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "fragrance" DECIMAL(5,2), "flavor" DECIMAL(5,2), "finish" DECIMAL(5,2), "acidity" DECIMAL(5,2),
  "body" DECIMAL(5,2), "sweetness" DECIMAL(5,2), "uniformity" DECIMAL(5,2), "cleanliness" DECIMAL(5,2),
  "acidityType" TEXT, "notes" TEXT, "autosaveVersion" INTEGER NOT NULL DEFAULT 1,
  "savedAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CuppingEvaluation_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CuppingDescriptor" (
  "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "name" TEXT NOT NULL, "category" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CuppingDescriptor_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CuppingEvaluationDescriptor" (
  "evaluationId" TEXT NOT NULL, "descriptorId" TEXT NOT NULL,
  CONSTRAINT "CuppingEvaluationDescriptor_pkey" PRIMARY KEY ("evaluationId", "descriptorId")
);
CREATE TABLE "CuppingDecision" (
  "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "lotId" TEXT NOT NULL, "sessionId" TEXT NOT NULL,
  "decision" "CuppingDecisionType" NOT NULL, "decisionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decisionById" TEXT NOT NULL, "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CuppingDecision_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SensoryProfile" (
  "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "lotId" TEXT NOT NULL, "sessionId" TEXT,
  "score" DECIMAL(5,2), "attributes" JSONB NOT NULL, "acidityTypes" JSONB NOT NULL, "descriptors" JSONB NOT NULL,
  "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SensoryProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LabSample_companyId_sampleCode_key" ON "LabSample"("companyId", "sampleCode");
CREATE INDEX "LabSample_lotId_status_idx" ON "LabSample"("lotId", "status");
CREATE UNIQUE INDEX "CuppingSession_companyId_code_key" ON "CuppingSession"("companyId", "code");
CREATE UNIQUE INDEX "CuppingSession_accessToken_key" ON "CuppingSession"("accessToken");
CREATE INDEX "CuppingSession_companyId_status_idx" ON "CuppingSession"("companyId", "status");
CREATE UNIQUE INDEX "CuppingSessionSample_sessionId_sampleId_key" ON "CuppingSessionSample"("sessionId", "sampleId");
CREATE UNIQUE INDEX "CuppingParticipant_sessionId_userId_key" ON "CuppingParticipant"("sessionId", "userId");
CREATE UNIQUE INDEX "CuppingEvaluation_sessionId_sampleId_participantId_key" ON "CuppingEvaluation"("sessionId", "sampleId", "participantId");
CREATE INDEX "CuppingEvaluation_companyId_sessionId_idx" ON "CuppingEvaluation"("companyId", "sessionId");
CREATE UNIQUE INDEX "CuppingDescriptor_companyId_name_key" ON "CuppingDescriptor"("companyId", "name");
CREATE INDEX "CuppingDecision_lotId_decisionAt_idx" ON "CuppingDecision"("lotId", "decisionAt");
CREATE INDEX "SensoryProfile_lotId_createdAt_idx" ON "SensoryProfile"("lotId", "createdAt");

ALTER TABLE "LabSample" ADD CONSTRAINT "LabSample_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LabSample" ADD CONSTRAINT "LabSample_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "CoffeeLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LabSample" ADD CONSTRAINT "LabSample_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CuppingSession" ADD CONSTRAINT "CuppingSession_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CuppingSession" ADD CONSTRAINT "CuppingSession_coordinatorId_fkey" FOREIGN KEY ("coordinatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CuppingSessionSample" ADD CONSTRAINT "CuppingSessionSample_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CuppingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CuppingSessionSample" ADD CONSTRAINT "CuppingSessionSample_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "LabSample"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CuppingParticipant" ADD CONSTRAINT "CuppingParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CuppingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CuppingParticipant" ADD CONSTRAINT "CuppingParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CuppingEvaluation" ADD CONSTRAINT "CuppingEvaluation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CuppingEvaluation" ADD CONSTRAINT "CuppingEvaluation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CuppingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CuppingEvaluation" ADD CONSTRAINT "CuppingEvaluation_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "LabSample"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CuppingEvaluation" ADD CONSTRAINT "CuppingEvaluation_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "CuppingParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CuppingEvaluation" ADD CONSTRAINT "CuppingEvaluation_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CuppingDescriptor" ADD CONSTRAINT "CuppingDescriptor_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CuppingEvaluationDescriptor" ADD CONSTRAINT "CuppingEvaluationDescriptor_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "CuppingEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CuppingEvaluationDescriptor" ADD CONSTRAINT "CuppingEvaluationDescriptor_descriptorId_fkey" FOREIGN KEY ("descriptorId") REFERENCES "CuppingDescriptor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CuppingDecision" ADD CONSTRAINT "CuppingDecision_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CuppingDecision" ADD CONSTRAINT "CuppingDecision_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "CoffeeLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CuppingDecision" ADD CONSTRAINT "CuppingDecision_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CuppingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CuppingDecision" ADD CONSTRAINT "CuppingDecision_decisionById_fkey" FOREIGN KEY ("decisionById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SensoryProfile" ADD CONSTRAINT "SensoryProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SensoryProfile" ADD CONSTRAINT "SensoryProfile_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "CoffeeLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SensoryProfile" ADD CONSTRAINT "SensoryProfile_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CuppingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
