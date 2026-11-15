-- Remove only customer records that are explicitly identified as test data.
-- Real orders, receivables and every green-coffee purchase remain untouched.
-- A JSON copy is kept in-database so this cleanup is recoverable.

CREATE TABLE IF NOT EXISTS "DataCleanupArchive" (
  "cleanupKey" TEXT NOT NULL,
  "tableName" TEXT NOT NULL,
  "recordId" TEXT NOT NULL,
  payload JSONB NOT NULL,
  "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DataCleanupArchive_pkey" PRIMARY KEY ("cleanupKey", "tableName", "recordId")
);

INSERT INTO "DataCleanupArchive" ("cleanupKey", "tableName", "recordId", payload)
SELECT
  '2026-10-05-explicit-test-customers',
  'Customer',
  customer.id,
  to_jsonb(customer)
FROM "Customer" customer
WHERE customer.id IN ('cmu8fblub0007o14kxrg8zkbf', 'cmu8fbluw000ho14k669xxnut')
  AND customer.name IN ('Comprador Teste Bispo', 'Teste BBOS')
ON CONFLICT ("cleanupKey", "tableName", "recordId") DO NOTHING;

DELETE FROM "Customer" customer
WHERE customer.id IN ('cmu8fblub0007o14kxrg8zkbf', 'cmu8fbluw000ho14k669xxnut')
  AND customer.name IN ('Comprador Teste Bispo', 'Teste BBOS')
  AND NOT EXISTS (SELECT 1 FROM "SalesOrder" item WHERE item."customerId" = customer.id)
  AND NOT EXISTS (SELECT 1 FROM "AccountsReceivable" item WHERE item."customerId" = customer.id)
  AND NOT EXISTS (SELECT 1 FROM "FiscalDocument" item WHERE item."customerId" = customer.id)
  AND NOT EXISTS (SELECT 1 FROM "ReconciliationItem" item WHERE item."customerId" = customer.id);
