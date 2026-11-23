-- WIP ADDITIVE migration: Signa submission claims, no application flow enabled yet.
-- Do NOT deploy until create-order transaction, authenticated replay tests and rollback are approved.
-- No existing SalesOrder, payment, fiscal, stock, Pix or Bling records are altered.
CREATE TABLE "PartnerOrderSubmission" (
  id TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "submissionKey" VARCHAR(128) NOT NULL,
  "requestHash" VARCHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'CLAIMED',
  "salesOrderId" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerOrderSubmission_status_check" CHECK (status IN ('CLAIMED', 'COMPLETED')),
  CONSTRAINT "PartnerOrderSubmission_hash_check" CHECK ("requestHash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "PartnerOrderSubmission_completion_check" CHECK (
    (status = 'CLAIMED' AND "salesOrderId" IS NULL AND "completedAt" IS NULL)
    OR
    (status = 'COMPLETED' AND "salesOrderId" IS NOT NULL AND "completedAt" IS NOT NULL)
  ),
  CONSTRAINT "PartnerOrderSubmission_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PartnerOrderSubmission_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "StorefrontPartner"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PartnerOrderSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PartnerOrderSubmission_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PartnerOrderSubmission_scope_key_unique"
  ON "PartnerOrderSubmission" ("companyId", "partnerId", "userId", "submissionKey");

CREATE UNIQUE INDEX "PartnerOrderSubmission_salesOrderId_key"
  ON "PartnerOrderSubmission" ("salesOrderId");

CREATE INDEX "PartnerOrderSubmission_scope_createdAt_idx"
  ON "PartnerOrderSubmission" ("companyId", "partnerId", "userId", "createdAt" DESC);
