CREATE TYPE "CuppingPublicKind" AS ENUM ('PROFESSIONAL', 'TRAINING');
CREATE TYPE "CuppingPublicStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'CANCELLED');
CREATE TYPE "CuppingParticipantStatus" AS ENUM ('JOINED', 'IN_PROGRESS', 'COMPLETED');

CREATE TABLE "CuppingPublicSession" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "kind" "CuppingPublicKind" NOT NULL,
  "code" TEXT NOT NULL,
  "status" "CuppingPublicStatus" NOT NULL DEFAULT 'DRAFT',
  "tokenHash" TEXT NOT NULL,
  "tokenExpiresAt" TIMESTAMP(3),
  "professionalSampleId" TEXT,
  "referenceProfile" JSONB,
  "createdById" TEXT NOT NULL,
  "createdByName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "openedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  CONSTRAINT "CuppingPublicSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CuppingParticipant" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "normalizedPhone" TEXT NOT NULL,
  "institution" TEXT,
  "status" "CuppingParticipantStatus" NOT NULL DEFAULT 'JOINED',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "CuppingParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CuppingParticipantEvaluation" (
  "id" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "attributes" JSONB NOT NULL,
  "descriptors" JSONB,
  "sensoryMap" JSONB,
  "score" DECIMAL(5,2),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CuppingParticipantEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CuppingPublicSession_companyId_code_key" ON "CuppingPublicSession"("companyId", "code");
CREATE UNIQUE INDEX "CuppingPublicSession_tokenHash_key" ON "CuppingPublicSession"("tokenHash");
CREATE INDEX "CuppingPublicSession_companyId_status_idx" ON "CuppingPublicSession"("companyId", "status");
CREATE INDEX "CuppingPublicSession_professionalSampleId_idx" ON "CuppingPublicSession"("professionalSampleId");
CREATE UNIQUE INDEX "CuppingParticipant_sessionId_normalizedPhone_key" ON "CuppingParticipant"("sessionId", "normalizedPhone");
CREATE INDEX "CuppingParticipant_sessionId_status_idx" ON "CuppingParticipant"("sessionId", "status");
CREATE UNIQUE INDEX "CuppingParticipantEvaluation_participantId_key" ON "CuppingParticipantEvaluation"("participantId");

ALTER TABLE "CuppingPublicSession" ADD CONSTRAINT "CuppingPublicSession_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CuppingPublicSession" ADD CONSTRAINT "CuppingPublicSession_professionalSampleId_fkey" FOREIGN KEY ("professionalSampleId") REFERENCES "ProfessionalCoffeeSample"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CuppingParticipant" ADD CONSTRAINT "CuppingParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CuppingPublicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CuppingParticipantEvaluation" ADD CONSTRAINT "CuppingParticipantEvaluation_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "CuppingParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
