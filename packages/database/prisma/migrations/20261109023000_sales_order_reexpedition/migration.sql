-- Mantém cada remessa da reexpedição separada e auditável.
-- O fluxo fiscal e logístico é assíncrono; nenhuma nova venda, cobrança ou baixa
-- comercial é criada para o reenvio do mesmo pacote devolvido.

ALTER TABLE "Shipment" DROP CONSTRAINT IF EXISTS "Shipment_order_key";
DROP INDEX IF EXISTS "Shipment_sales_order_key";
CREATE INDEX IF NOT EXISTS "Shipment_storefront_order_created_idx"
  ON "Shipment"("storefrontOrderId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Shipment_sales_order_created_idx"
  ON "Shipment"("salesOrderId", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS "SalesOrderReexpedition" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "salesOrderId" TEXT NOT NULL,
  "originalShipmentId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'QUEUED',
  reason TEXT NOT NULL,
  "addressSnapshot" JSONB NOT NULL,
  "shipmentSnapshot" JSONB NOT NULL,
  "originalFiscalDocumentId" TEXT,
  "returnFiscalDocumentId" TEXT,
  "replacementFiscalDocumentId" TEXT,
  "replacementShipmentId" TEXT,
  "preparedByUserId" TEXT,
  "preparedByName" TEXT NOT NULL,
  "preparedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalesOrderReexpedition_company_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE CASCADE,
  CONSTRAINT "SalesOrderReexpedition_order_fkey"
    FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"(id) ON DELETE CASCADE,
  CONSTRAINT "SalesOrderReexpedition_original_shipment_fkey"
    FOREIGN KEY ("originalShipmentId") REFERENCES "Shipment"(id) ON DELETE RESTRICT,
  CONSTRAINT "SalesOrderReexpedition_original_fiscal_fkey"
    FOREIGN KEY ("originalFiscalDocumentId") REFERENCES "FiscalDocument"(id) ON DELETE SET NULL,
  CONSTRAINT "SalesOrderReexpedition_return_fiscal_fkey"
    FOREIGN KEY ("returnFiscalDocumentId") REFERENCES "FiscalDocument"(id) ON DELETE SET NULL,
  CONSTRAINT "SalesOrderReexpedition_replacement_fiscal_fkey"
    FOREIGN KEY ("replacementFiscalDocumentId") REFERENCES "FiscalDocument"(id) ON DELETE SET NULL,
  CONSTRAINT "SalesOrderReexpedition_replacement_shipment_fkey"
    FOREIGN KEY ("replacementShipmentId") REFERENCES "Shipment"(id) ON DELETE SET NULL,
  CONSTRAINT "SalesOrderReexpedition_prepared_by_fkey"
    FOREIGN KEY ("preparedByUserId") REFERENCES "User"(id) ON DELETE SET NULL,
  CONSTRAINT "SalesOrderReexpedition_attempt_check" CHECK ("attemptNumber" > 0),
  CONSTRAINT "SalesOrderReexpedition_status_check" CHECK (status IN (
    'QUEUED','CONFIGURATION_REQUIRED','RETURN_FISCAL_PENDING','RETURN_FISCAL_AUTHORIZED',
    'OUTBOUND_FISCAL_PENDING','OUTBOUND_FISCAL_AUTHORIZED','LABEL_PENDING',
    'LABEL_CREATED','FAILED','CANCELLED'
  )),
  CONSTRAINT "SalesOrderReexpedition_order_attempt_key"
    UNIQUE ("salesOrderId", "attemptNumber")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SalesOrderReexpedition_one_active_idx"
  ON "SalesOrderReexpedition"("salesOrderId")
  WHERE status NOT IN ('LABEL_CREATED','CANCELLED');

CREATE INDEX IF NOT EXISTS "SalesOrderReexpedition_company_status_idx"
  ON "SalesOrderReexpedition"("companyId", status, "updatedAt");
