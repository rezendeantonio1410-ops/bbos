-- Recover invoice jobs that were incorrectly considered sent when Bling
-- returned the placeholder NF-e identifier 0 instead of a real document ID.

UPDATE "IntegrationOutbox" o
SET
  status = 'PENDING',
  attempts = 0,
  "lastError" = NULL,
  "nextAttemptAt" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "FiscalDocument" f
WHERE o.provider = 'BLING'
  AND o."eventType" = 'SALES_ORDER_INVOICE_REQUESTED'
  AND o."aggregateType" = 'SALES_ORDER'
  AND o."aggregateId" = f."salesOrderId"
  AND o.status = 'SENT'
  AND f.direction = 'OUTBOUND'
  AND f.status = 'SENT'
  AND (f."externalId" IS NULL OR BTRIM(f."externalId") IN ('', '0'));
