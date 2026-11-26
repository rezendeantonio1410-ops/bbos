-- Despesas fixas previstas (aluguel, água, luz, seguro...), aprendidas pelo
-- extrato do banco ou cadastradas à mão. Usadas só na previsão do caixa.
-- Aditivo: só cria uma tabela nova.
CREATE TABLE IF NOT EXISTS "RecurringExpense" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "key" VARCHAR(80) NOT NULL,
  "label" VARCHAR(160) NOT NULL,
  "category" VARCHAR(80) NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "dayOfMonth" INTEGER NOT NULL CHECK ("dayOfMonth" BETWEEN 1 AND 31),
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "source" VARCHAR(12) NOT NULL DEFAULT 'EXTRATO',
  "userEdited" BOOLEAN NOT NULL DEFAULT FALSE,
  "lastPaidAt" TIMESTAMP(3),
  "updatedByName" VARCHAR(120),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "RecurringExpense_company_key" ON "RecurringExpense"("companyId", "key");
