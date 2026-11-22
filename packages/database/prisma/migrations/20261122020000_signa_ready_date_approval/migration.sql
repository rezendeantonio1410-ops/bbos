-- Preserve the distributor's requested ready date separately from Bispo's confirmed date.
ALTER TABLE "SalesOrder" ADD COLUMN "partnerRequestedReadyDate" TIMESTAMP(3);
ALTER TABLE "SalesOrder" ADD COLUMN "bispoConfirmedReadyDate" TIMESTAMP(3);
ALTER TABLE "SalesOrder" ADD COLUMN "bispoReadyDateConfirmedAt" TIMESTAMP(3);
ALTER TABLE "SalesOrder" ADD COLUMN "bispoReadyDateConfirmedById" TEXT;
-- Existing expectedDeliveryDate continues to represent the legacy delivery forecast.
-- Historical orders are not backfilled with guessed dates.
