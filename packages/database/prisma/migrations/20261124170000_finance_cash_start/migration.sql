-- Cash control starting point: the real bank balance on a given date.
-- The cash flow counts from there; earlier history stays untouched.
-- Additive only: two nullable columns.
ALTER TABLE "FinanceSettings"
  ADD COLUMN IF NOT EXISTS "cashStartDate" DATE,
  ADD COLUMN IF NOT EXISTS "cashStartBalance" DECIMAL(14,2);
