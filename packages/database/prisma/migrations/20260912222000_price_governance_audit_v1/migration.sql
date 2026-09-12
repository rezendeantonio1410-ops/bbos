CREATE TABLE IF NOT EXISTS "PriceGovernanceEvent" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "productPriceId" TEXT NOT NULL,
  "actorId" TEXT,
  "actorName" TEXT NOT NULL,
  "actorRole" TEXT,
  "beforeSnapshot" JSONB NOT NULL,
  "afterSnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PriceGovernanceEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PriceGovernanceEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PriceGovernanceEvent_productPriceId_fkey" FOREIGN KEY ("productPriceId") REFERENCES "ProductPrice"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PriceGovernanceEvent_price_created_idx" ON "PriceGovernanceEvent"("productPriceId", "createdAt");
CREATE INDEX IF NOT EXISTS "PriceGovernanceEvent_company_created_idx" ON "PriceGovernanceEvent"("companyId", "createdAt");
