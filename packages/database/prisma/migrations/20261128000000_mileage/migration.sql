CREATE TABLE "MileageTrip" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "vehicle" VARCHAR(80) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "distanceMeters" INTEGER NOT NULL,
    "incomplete" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MileageTrip_pkey" PRIMARY KEY ("userId", "id"),
    CONSTRAINT "MileageTrip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "MileageTrip_startedAt_idx" ON "MileageTrip"("startedAt");
