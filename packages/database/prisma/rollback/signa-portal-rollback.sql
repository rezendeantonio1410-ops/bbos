-- Manual rollback for the pending Signa portal migrations (reverse order).
-- NOT a Prisma migration (outside prisma/migrations). Run only with explicit
-- approval, after a backup, and only if the release is being reverted.
-- WARNING: drops server drafts, submission claims and the commercial address
-- columns of PartnerEndCustomer; also drops the active commercial CNPJ index. SalesOrder rows are never deleted: the
-- PartnerOrderSubmission FK is dropped together with the table.
BEGIN;
DROP INDEX IF EXISTS "PartnerEndCustomer_active_scoped_cnpj_unique";
DELETE FROM "_prisma_migrations" WHERE migration_name='20261123180000_signa_end_customer_unique_cnpj';
DROP TABLE IF EXISTS "PartnerOrderSubmission";
DELETE FROM "_prisma_migrations" WHERE migration_name='20261123150000_signa_order_submission_claims';
ALTER TABLE "PartnerEndCustomer"
  DROP COLUMN IF EXISTS "postalCode",
  DROP COLUMN IF EXISTS "street",
  DROP COLUMN IF EXISTS "number",
  DROP COLUMN IF EXISTS "district",
  DROP COLUMN IF EXISTS "complement";
DELETE FROM "_prisma_migrations" WHERE migration_name='20261123124000_signa_end_customer_address';
DROP TABLE IF EXISTS "PartnerOrderDraft";
DELETE FROM "_prisma_migrations" WHERE migration_name='20261123030000_signa_order_drafts';
COMMIT;
