-- A remotely deleted draft NF-e must not keep a stale DANFE/PDF link in BBOS.
UPDATE "FiscalDocument"
   SET "payloadSnapshot" = COALESCE("payloadSnapshot", '{}'::jsonb)
       - 'blingNfe' - 'blingSend' - 'create' - 'sefazStatusCode' - 'sefazMessage',
       "updatedAt" = NOW()
 WHERE COALESCE("payloadSnapshot", '{}'::jsonb) ? 'remoteDeletionReconciledAt'
   AND "externalId" IS NULL;
