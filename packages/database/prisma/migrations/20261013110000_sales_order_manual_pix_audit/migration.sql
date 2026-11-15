-- Auditable receipt source for order-level manual Pix approvals.
-- The actor fields intentionally keep a historical snapshot instead of a
-- foreign key so the audit survives later user renames or deactivation.

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS source VARCHAR(40) NOT NULL DEFAULT 'FINANCE',
  ADD COLUMN IF NOT EXISTS reference VARCHAR(180),
  ADD COLUMN IF NOT EXISTS "recordedById" TEXT,
  ADD COLUMN IF NOT EXISTS "recordedByName" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "recordedByRole" VARCHAR(40);

CREATE INDEX IF NOT EXISTS "Payment_companyId_source_paidAt_idx"
  ON "Payment"("companyId", source, "paidAt");
