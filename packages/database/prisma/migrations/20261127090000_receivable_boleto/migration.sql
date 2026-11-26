-- Boletos (Itaú Bolecode) emitidos a partir de contas a receber.
-- Aditivo: só cria uma tabela nova; nenhuma tabela existente é alterada.
CREATE TABLE IF NOT EXISTS "ReceivableBoleto" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "accountsReceivableId" TEXT NOT NULL REFERENCES "AccountsReceivable"("id") ON DELETE CASCADE,
  "mode" VARCHAR(12) NOT NULL,
  "status" VARCHAR(12) NOT NULL DEFAULT 'ISSUED',
  "ourNumber" VARCHAR(8) NOT NULL,
  "digitableLine" VARCHAR(47) NOT NULL,
  "barcode" VARCHAR(44) NOT NULL,
  "pixCopyPaste" TEXT,
  "externalId" VARCHAR(80),
  "amount" DECIMAL(14,2) NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "issuedById" TEXT,
  "issuedByName" VARCHAR(120),
  "paidAt" TIMESTAMP(3),
  "paidAmount" DECIMAL(14,2),
  "paymentId" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "ReceivableBoleto_company_mode_ourNumber_key" ON "ReceivableBoleto"("companyId", "mode", "ourNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "ReceivableBoleto_one_open_per_receivable" ON "ReceivableBoleto"("accountsReceivableId") WHERE "status" = 'ISSUED';
CREATE INDEX IF NOT EXISTS "ReceivableBoleto_company_status_idx" ON "ReceivableBoleto"("companyId", "status", "dueDate");
