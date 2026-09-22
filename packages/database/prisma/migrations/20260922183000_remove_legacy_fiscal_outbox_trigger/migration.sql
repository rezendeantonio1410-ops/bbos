-- The API owns outbound NF-e dispatch through SALES_ORDER_INVOICE_REQUESTED.
-- Keeping the legacy status trigger creates a second command for the same invoice.
DROP TRIGGER IF EXISTS "SalesOrder_outbound_fiscal_document_trg" ON "SalesOrder";
DROP FUNCTION IF EXISTS bbos_prepare_outbound_fiscal_document();
