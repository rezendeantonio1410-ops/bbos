CREATE TABLE IF NOT EXISTS "CustomerCreditEvent" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "requestedLimit" DECIMAL(18,2),
  "requestedTerms" TEXT,
  "monthlyVolume" DECIMAL(18,2),
  "rationale" TEXT,
  "decisionStatus" TEXT,
  "decidedLimit" DECIMAL(18,2),
  "decisionTerms" TEXT,
  "notes" TEXT,
  "actorId" TEXT,
  "actorName" TEXT NOT NULL,
  "actorRole" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "CustomerCreditEvent_company_customer_created_idx"
  ON "CustomerCreditEvent" ("companyId", "customerId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "CustomerCreditEvent_eventType_idx"
  ON "CustomerCreditEvent" ("eventType");
