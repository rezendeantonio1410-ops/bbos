CREATE TYPE "CuppingProtocol" AS ENUM ('TRADITIONAL_100', 'CVA_EXPERIENCE');
CREATE TYPE "CuppingDefectSeverity" AS ENUM ('TAINT', 'FAULT');

ALTER TABLE "CuppingSession"
  ALTER COLUMN "protocol" DROP DEFAULT,
  ALTER COLUMN "protocol" TYPE "CuppingProtocol"
    USING (CASE WHEN "protocol" = 'CVA_EXPERIENCE' THEN 'CVA_EXPERIENCE'::"CuppingProtocol" ELSE 'TRADITIONAL_100'::"CuppingProtocol" END),
  ALTER COLUMN "protocol" SET DEFAULT 'TRADITIONAL_100',
  ADD COLUMN "protocolVersion" TEXT NOT NULL DEFAULT '1.0';

ALTER TABLE "CuppingEvaluation"
  ADD COLUMN "rawScore" DECIMAL(5,2),
  ADD COLUMN "defectPenalty" DECIMAL(5,2),
  ADD COLUMN "finalScore" DECIMAL(5,2);

ALTER TABLE "CuppingCupDefect"
  ADD COLUMN "defectSeverity" "CuppingDefectSeverity" NOT NULL DEFAULT 'TAINT';
