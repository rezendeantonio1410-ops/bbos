-- Automatic tracking of export samples (17TRACK). Additive: new nullable columns only.
ALTER TABLE "ExportSample" ADD COLUMN IF NOT EXISTS "trackingRegisteredAt" TIMESTAMP(3);
ALTER TABLE "ExportSample" ADD COLUMN IF NOT EXISTS "trackingSyncedAt" TIMESTAMP(3);
ALTER TABLE "ExportSample" ADD COLUMN IF NOT EXISTS "trackingStatusText" TEXT;
ALTER TABLE "ExportSample" ADD COLUMN IF NOT EXISTS "trackingProblem" TEXT;
