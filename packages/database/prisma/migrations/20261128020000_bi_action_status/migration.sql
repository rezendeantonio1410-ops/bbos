-- Status das ações do plano 5W2H da Leitura (BI). Tabela nova; nada
-- existente é alterado. Uma linha por ação e mês.
CREATE TABLE IF NOT EXISTS "BiActionStatus" (
  "companyId" TEXT NOT NULL,
  "month" TEXT NOT NULL,
  "actionKey" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "title" TEXT,
  "updatedById" TEXT,
  "updatedByName" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BiActionStatus_pkey" PRIMARY KEY ("companyId","month","actionKey"),
  CONSTRAINT "BiActionStatus_company_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
  CONSTRAINT "BiActionStatus_status_check" CHECK ("status" IN ('TODO','DOING','DONE','DISMISSED'))
);
