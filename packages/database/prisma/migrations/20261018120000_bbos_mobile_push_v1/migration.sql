-- BBOS Mobile v1 is additive: existing operational notifications remain
-- untouched while each user receives an independent mobile inbox.
ALTER TABLE "OperationalNotification" ADD COLUMN "mobilePushBridgedAt" TIMESTAMP(3);

CREATE TABLE "PushSubscription" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "userAgent" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "failureCount" INTEGER NOT NULL DEFAULT 0,
  "lastSuccessfulAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MobileNotification" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sourceOperationalNotificationId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "href" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "readAt" TIMESTAMP(3),
  "pushSentAt" TIMESTAMP(3),
  "pushAttempts" INTEGER NOT NULL DEFAULT 0,
  "pushError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MobileNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_companyId_enabled_idx" ON "PushSubscription"("companyId", "enabled");
CREATE INDEX "PushSubscription_userId_enabled_idx" ON "PushSubscription"("userId", "enabled");

CREATE UNIQUE INDEX "MobileNotification_userId_idempotencyKey_key" ON "MobileNotification"("userId", "idempotencyKey");
CREATE INDEX "MobileNotification_companyId_createdAt_idx" ON "MobileNotification"("companyId", "createdAt");
CREATE INDEX "MobileNotification_userId_readAt_createdAt_idx" ON "MobileNotification"("userId", "readAt", "createdAt");
CREATE INDEX "MobileNotification_pushSentAt_pushAttempts_createdAt_idx" ON "MobileNotification"("pushSentAt", "pushAttempts", "createdAt");
CREATE INDEX "MobileNotification_sourceOperationalNotificationId_idx" ON "MobileNotification"("sourceOperationalNotificationId");
CREATE INDEX "OperationalNotification_companyId_mobilePushBridgedAt_createdAt_idx" ON "OperationalNotification"("companyId", "mobilePushBridgedAt", "createdAt");

ALTER TABLE "PushSubscription"
  ADD CONSTRAINT "PushSubscription_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PushSubscription"
  ADD CONSTRAINT "PushSubscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MobileNotification"
  ADD CONSTRAINT "MobileNotification_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MobileNotification"
  ADD CONSTRAINT "MobileNotification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MobileNotification"
  ADD CONSTRAINT "MobileNotification_sourceOperationalNotificationId_fkey"
  FOREIGN KEY ("sourceOperationalNotificationId") REFERENCES "OperationalNotification"("id") ON DELETE SET NULL ON UPDATE CASCADE;
