-- Additive WIP migration: isolated Signa draft documents only.
-- No existing SalesOrder, stock, fiscal, payment or Bling records are changed.
CREATE TABLE "PartnerOrderDraft" (
    id TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    version INTEGER NOT NULL DEFAULT 1,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PartnerOrderDraft_status_check" CHECK (status = 'DRAFT'),
    CONSTRAINT "PartnerOrderDraft_version_check" CHECK (version > 0),
    CONSTRAINT "PartnerOrderDraft_payload_check" CHECK (jsonb_typeof(payload) = 'object'),
    CONSTRAINT "PartnerOrderDraft_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PartnerOrderDraft_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "StorefrontPartner"(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PartnerOrderDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "PartnerOrderDraft_scope_updatedAt_idx" ON "PartnerOrderDraft" ("companyId", "partnerId", "userId", "updatedAt" DESC);
