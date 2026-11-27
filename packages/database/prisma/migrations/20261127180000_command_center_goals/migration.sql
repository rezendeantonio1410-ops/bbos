-- Central de comando v6: meta de vendas do mês e tarefas adiadas ("Feito",
-- "Amanhã", "Adiar 7 dias"). Só tabelas novas; nada existente é alterado.
CREATE TABLE IF NOT EXISTS "CommandCenterGoal" (
  "companyId" TEXT NOT NULL,
  "month" TEXT NOT NULL,
  "salesTarget" NUMERIC(14,2),
  "updatedByName" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommandCenterGoal_pkey" PRIMARY KEY ("companyId","month"),
  CONSTRAINT "CommandCenterGoal_company_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "CommandCenterTaskSnooze" (
  "companyId" TEXT NOT NULL,
  "taskKey" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "until" TIMESTAMP(3) NOT NULL,
  "createdByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommandCenterTaskSnooze_pkey" PRIMARY KEY ("companyId","taskKey"),
  CONSTRAINT "CommandCenterTaskSnooze_company_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
  CONSTRAINT "CommandCenterTaskSnooze_action_check" CHECK ("action" IN ('DONE','TOMORROW','WEEK'))
);
CREATE INDEX IF NOT EXISTS "CommandCenterTaskSnooze_until_idx" ON "CommandCenterTaskSnooze"("companyId","until");
