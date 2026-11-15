CREATE TABLE IF NOT EXISTS "CustomerVisit" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "storefrontPartnerId" TEXT,
  "recordedByUserId" TEXT,
  "recordedByName" TEXT NOT NULL,
  "visitAt" TIMESTAMP(3) NOT NULL,
  "contactName" TEXT,
  "purpose" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "facts" TEXT NOT NULL,
  "nextAction" TEXT,
  "nextActionAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CustomerVisit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerVisit_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CustomerVisit_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CustomerVisit_storefrontPartnerId_fkey"
    FOREIGN KEY ("storefrontPartnerId") REFERENCES "StorefrontPartner"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "CustomerVisit_recordedByUserId_fkey"
    FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CustomerVisit_companyId_customerId_visitAt_idx"
  ON "CustomerVisit"("companyId", "customerId", "visitAt");

CREATE INDEX IF NOT EXISTS "CustomerVisit_storefrontPartnerId_visitAt_idx"
  ON "CustomerVisit"("storefrontPartnerId", "visitAt");

CREATE INDEX IF NOT EXISTS "CustomerVisit_companyId_nextActionAt_idx"
  ON "CustomerVisit"("companyId", "nextActionAt");
