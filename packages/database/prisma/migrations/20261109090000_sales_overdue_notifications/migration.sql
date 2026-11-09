-- Um mesmo título vencido gera um único alerta comercial, inclusive quando
-- mais de uma instância do worker estiver ativa.
CREATE UNIQUE INDEX IF NOT EXISTS "OperationalNotification_sales_overdue_unique_idx"
  ON "OperationalNotification"("companyId", type)
  WHERE type LIKE 'SALES_RECEIVABLE_OVERDUE:%';
