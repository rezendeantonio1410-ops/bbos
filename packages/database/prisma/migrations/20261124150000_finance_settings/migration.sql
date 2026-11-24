-- Finance parameters per company: minimum cash, revenue target, tax regime
-- and the tax rates used to estimate taxes in the cash flow forecast.
-- Additive only: one new table. No existing row changes.

CREATE TABLE IF NOT EXISTS "FinanceSettings" (
  "companyId" TEXT PRIMARY KEY,
  "minimumCashBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "monthlyRevenueTarget" DECIMAL(14,2),
  "taxRegime" TEXT NOT NULL DEFAULT 'LUCRO_REAL',
  "taxRates" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "taxRatesConfirmedAt" TIMESTAMP(3),
  "updatedByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinanceSettings_company_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE CASCADE,
  CONSTRAINT "FinanceSettings_regime_check" CHECK ("taxRegime" IN ('LUCRO_REAL','LUCRO_PRESUMIDO','SIMPLES_NACIONAL')),
  CONSTRAINT "FinanceSettings_amounts_check" CHECK ("minimumCashBalance" >= 0 AND ("monthlyRevenueTarget" IS NULL OR "monthlyRevenueTarget" >= 0))
);
