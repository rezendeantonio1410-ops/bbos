-- Envio direto do distribuidor: a Bispo posta a mercadoria para o cliente final
-- do parceiro com a etiqueta comprada pelo próprio parceiro. Tabelas novas; nada
-- existente é alterado.
CREATE TABLE IF NOT EXISTS "PartnerDirectShipment" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "salesOrderId" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "recipientName" TEXT NOT NULL,
  "recipientTaxId" TEXT,
  "recipientEmail" TEXT,
  "recipientPhone" TEXT,
  "postalCode" TEXT NOT NULL,
  "street" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "complement" TEXT,
  "district" TEXT,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "carrier" TEXT NOT NULL,
  "trackingCode" TEXT NOT NULL,
  "trackingUrl" TEXT,
  "volumes" INTEGER,
  "weightKg" NUMERIC(10,3),
  "notifyEndCustomer" BOOLEAN NOT NULL DEFAULT FALSE,
  "status" TEXT NOT NULL DEFAULT 'AWAITING_POST',
  "postedAt" TIMESTAMP(3),
  "postedByName" TEXT,
  "notifiedAt" TIMESTAMP(3),
  "notifiedTo" TEXT,
  "updatedByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerDirectShipment_company_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
  CONSTRAINT "PartnerDirectShipment_order_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE,
  CONSTRAINT "PartnerDirectShipment_partner_fkey" FOREIGN KEY ("partnerId") REFERENCES "StorefrontPartner"("id") ON DELETE CASCADE,
  CONSTRAINT "PartnerDirectShipment_status_check" CHECK ("status" IN ('AWAITING_POST','POSTED'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "PartnerDirectShipment_order_key" ON "PartnerDirectShipment"("salesOrderId");
CREATE INDEX IF NOT EXISTS "PartnerDirectShipment_company_status_idx" ON "PartnerDirectShipment"("companyId","status");

CREATE TABLE IF NOT EXISTS "PartnerDirectShipmentDocument" (
  "id" TEXT PRIMARY KEY,
  "shipmentId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "data" BYTEA NOT NULL,
  "uploadedByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerDirectShipmentDocument_shipment_fkey" FOREIGN KEY ("shipmentId") REFERENCES "PartnerDirectShipment"("id") ON DELETE CASCADE,
  CONSTRAINT "PartnerDirectShipmentDocument_kind_check" CHECK ("kind" IN ('LABEL','INVOICE','PACKING_LIST','OTHER'))
);
CREATE INDEX IF NOT EXISTS "PartnerDirectShipmentDocument_shipment_idx" ON "PartnerDirectShipmentDocument"("shipmentId","createdAt");
