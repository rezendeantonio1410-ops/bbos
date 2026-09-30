UPDATE "FiscalDocument"
SET status = 'AUTHORIZED',
    "updatedAt" = NOW()
WHERE status = 'REJECTED'
  AND "externalProvider" = 'BLING'
  AND "payloadSnapshot"->>'sefazStatusCode' IN ('100', '150');
