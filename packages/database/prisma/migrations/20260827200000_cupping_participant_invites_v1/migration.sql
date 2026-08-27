-- Participant-scoped invite tokens for the authenticated Cupping V1 flow.
CREATE TYPE "CuppingParticipantInviteStatus" AS ENUM ('ACTIVE', 'REVOKED');

CREATE TABLE "CuppingParticipantInvite" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "status" "CuppingParticipantInviteStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CuppingParticipantInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CuppingParticipantInvite_tokenHash_key"
  ON "CuppingParticipantInvite"("tokenHash");
CREATE UNIQUE INDEX "CuppingParticipantInvite_sessionId_participantId_key"
  ON "CuppingParticipantInvite"("sessionId", "participantId");
CREATE INDEX "CuppingParticipantInvite_companyId_status_idx"
  ON "CuppingParticipantInvite"("companyId", "status");
CREATE INDEX "CuppingParticipantInvite_sessionId_status_idx"
  ON "CuppingParticipantInvite"("sessionId", "status");
CREATE INDEX "CuppingParticipantInvite_participantId_status_idx"
  ON "CuppingParticipantInvite"("participantId", "status");

ALTER TABLE "CuppingParticipantInvite"
  ADD CONSTRAINT "CuppingParticipantInvite_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CuppingParticipantInvite"
  ADD CONSTRAINT "CuppingParticipantInvite_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "CuppingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
