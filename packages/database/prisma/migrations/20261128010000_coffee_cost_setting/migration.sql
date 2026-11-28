-- Ajuste manual do custo da matéria-prima por café (BI · Inteligência).
-- Tabela nova; nada existente é alterado.
CREATE TABLE IF NOT EXISTS "CoffeeCostSetting" (
  "companyId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "greenCostPerKg" NUMERIC(14,2) NOT NULL,
  "roastLossPercent" NUMERIC(5,2) NOT NULL DEFAULT 14,
  "updatedById" TEXT,
  "updatedByName" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CoffeeCostSetting_pkey" PRIMARY KEY ("companyId","productId"),
  CONSTRAINT "CoffeeCostSetting_company_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
  CONSTRAINT "CoffeeCostSetting_product_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE,
  CONSTRAINT "CoffeeCostSetting_values_check" CHECK ("greenCostPerKg" > 0 AND "roastLossPercent" >= 0 AND "roastLossPercent" <= 40)
);

-- Linhas em que o lote de café verde pode ser usado (até 3): RAROS, EPICOS,
-- CLASSICOS, GOURMET. Serve para estimar o custo de cafés sem torra registrada.
ALTER TABLE "CoffeeLot" ADD COLUMN IF NOT EXISTS "intendedLines" TEXT[] NOT NULL DEFAULT '{}';
