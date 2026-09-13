-- Bind operational events to the fiscal core without coupling business logic to Bling.

CREATE OR REPLACE FUNCTION bbos_register_inbound_fiscal_document()
RETURNS trigger AS $$
BEGIN
  IF NEW."invoiceNumber" IS NOT NULL AND length(trim(NEW."invoiceNumber")) > 0 THEN
    INSERT INTO "FiscalDocument" (
      id,"companyId",direction,"documentType",status,number,"issueDate","operationDate",
      "supplierId","greenCoffeeReceiptId","payloadSnapshot","createdAt","updatedAt"
    ) VALUES (
      'fiscal-in-' || md5(NEW.id), NEW."companyId", 'INBOUND', 'NFE', 'IMPORTED', NEW."invoiceNumber",
      NEW."confirmedAt", NEW."confirmedAt", NEW."supplierId", NEW.id,
      jsonb_build_object('receiptNumber',NEW."receiptNumber",'source','GREEN_COFFEE_RECEIPT'), NOW(), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      number=EXCLUDED.number,
      "supplierId"=EXCLUDED."supplierId",
      "greenCoffeeReceiptId"=EXCLUDED."greenCoffeeReceiptId",
      "updatedAt"=NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "GreenCoffeeReceipt_fiscal_document_trg" ON "GreenCoffeeReceipt";
CREATE TRIGGER "GreenCoffeeReceipt_fiscal_document_trg"
AFTER INSERT OR UPDATE OF "invoiceNumber" ON "GreenCoffeeReceipt"
FOR EACH ROW EXECUTE FUNCTION bbos_register_inbound_fiscal_document();

CREATE OR REPLACE FUNCTION bbos_prepare_outbound_fiscal_document()
RETURNS trigger AS $$
DECLARE
  fiscal_id TEXT;
  integration_connected BOOLEAN;
BEGIN
  IF NEW.status::text = 'INVOICED' AND (OLD.status::text IS DISTINCT FROM 'INVOICED') THEN
    fiscal_id := 'fiscal-out-' || md5(NEW.id);
    INSERT INTO "FiscalDocument" (
      id,"companyId",direction,"documentType",status,"operationDate","customerId","salesOrderId",
      "totalAmount","payloadSnapshot","createdAt","updatedAt"
    ) VALUES (
      fiscal_id, NEW."companyId", 'OUTBOUND', 'NFE', 'READY', COALESCE(NEW."invoicedAt",NOW()),
      NEW."customerId", NEW.id, NEW."totalAmount",
      jsonb_build_object('orderNumber',COALESCE(NEW."orderNumber",NEW.code),'source','SALES_ORDER'), NOW(), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      status='READY',
      "customerId"=EXCLUDED."customerId",
      "salesOrderId"=EXCLUDED."salesOrderId",
      "totalAmount"=EXCLUDED."totalAmount",
      "updatedAt"=NOW();

    SELECT EXISTS(
      SELECT 1 FROM "ExternalIntegration"
       WHERE "companyId"=NEW."companyId" AND provider='BLING' AND status='CONNECTED'
    ) INTO integration_connected;

    IF integration_connected THEN
      INSERT INTO "IntegrationOutbox" (
        id,"companyId",provider,"eventType","aggregateType","aggregateId",payload,status,"idempotencyKey","createdAt","updatedAt"
      ) VALUES (
        'outbox-' || md5('BLING:FISCAL_DOCUMENT:' || fiscal_id), NEW."companyId", 'BLING', 'FISCAL_DOCUMENT_READY',
        'FISCAL_DOCUMENT', fiscal_id,
        jsonb_build_object('fiscalDocumentId',fiscal_id,'salesOrderId',NEW.id),
        'PENDING', 'BLING:FISCAL_DOCUMENT:' || fiscal_id, NOW(), NOW()
      ) ON CONFLICT ("idempotencyKey") DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "SalesOrder_outbound_fiscal_document_trg" ON "SalesOrder";
CREATE TRIGGER "SalesOrder_outbound_fiscal_document_trg"
AFTER UPDATE OF status ON "SalesOrder"
FOR EACH ROW EXECUTE FUNCTION bbos_prepare_outbound_fiscal_document();
