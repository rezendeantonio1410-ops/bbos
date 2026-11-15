-- A physical receipt is not, by itself, a fiscal document. NF-e records must
-- originate from an authorized XML or from the DF-e distribution service.
DROP TRIGGER IF EXISTS "GreenCoffeeReceipt_fiscal_document_trg"
ON "GreenCoffeeReceipt";

DROP FUNCTION IF EXISTS bbos_register_inbound_fiscal_document();

DO $$
DECLARE
  target_document_id CONSTANT TEXT := 'fiscal-in-4d74c1b25cec1b1ebaa5e7b5a32d7f63';
  target_company_id CONSTANT TEXT := 'cmszzhc0z0000fu31ovnwja4m';
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "FiscalDocument" f
    WHERE f.id = target_document_id
      AND f."companyId" = target_company_id
      AND f.direction = 'INBOUND'
      AND f."documentType" = 'NFE'
      AND f.status = 'IMPORTED'
      AND f.number = '13927'
      AND f."accessKey" IS NULL
      AND COALESCE(f."totalAmount", 0) = 0
      AND f."matchStatus" = 'UNMATCHED'
      AND f."payloadSnapshot"->>'source' = 'GREEN_COFFEE_RECEIPT'
  ) THEN
    RAISE NOTICE 'Empty inbound fiscal document is not present; cleanup skipped.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "FiscalDocumentItem"
    WHERE "fiscalDocumentId" = target_document_id
  ) OR EXISTS (
    SELECT 1
    FROM "FiscalDocumentAllocation"
    WHERE "fiscalDocumentId" = target_document_id
  ) OR EXISTS (
    SELECT 1
    FROM "FiscalDocumentEvent"
    WHERE "fiscalDocumentId" = target_document_id
  ) THEN
    RAISE EXCEPTION
      'Refusing to delete fiscal document % because it gained operational dependencies.',
      target_document_id;
  END IF;

  DELETE FROM "FiscalDocument"
  WHERE id = target_document_id
    AND "companyId" = target_company_id;
END $$;
