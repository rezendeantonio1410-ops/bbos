CREATE TABLE IF NOT EXISTS "SalesOrderCustomerApproval" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "salesOrderId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL UNIQUE,
  snapshot JSONB NOT NULL,
  "snapshotHash" TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT,
  "createdByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedByName" TEXT,
  "acceptedByEmail" TEXT,
  "acceptedAt" TIMESTAMP(3),
  "customerNote" TEXT,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "SalesOrderCustomerApproval_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SalesOrderCustomerApproval_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "SalesOrderCustomerApproval_salesOrderId_status_idx"
  ON "SalesOrderCustomerApproval" ("salesOrderId", status);

CREATE INDEX IF NOT EXISTS "SalesOrderCustomerApproval_expiresAt_idx"
  ON "SalesOrderCustomerApproval" ("expiresAt");