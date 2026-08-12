CREATE TYPE "CuppingSessionMode" AS ENUM ('CUPPING', 'TRAINING');

ALTER TABLE "CuppingSession"
ADD COLUMN "mode" "CuppingSessionMode" NOT NULL DEFAULT 'CUPPING';
